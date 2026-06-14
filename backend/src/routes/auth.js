const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { requireAuth, SECRET } = require('../middleware/requireAuth');

const router = express.Router();

// Garante que a tabela config existe e inicializa a senha padrão
db.exec(`
  CREATE TABLE IF NOT EXISTS config (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  )
`);

// Insere senha padrão "sushi123" se não existir
const existing = db.prepare('SELECT valor FROM config WHERE chave = ?').get('senha_hash');
if (!existing) {
  const hash = bcrypt.hashSync('sushi123', 10);
  db.prepare('INSERT INTO config (chave, valor) VALUES (?, ?)').run('senha_hash', hash);
}

// ── Anti força-bruta no login ────────────────────────────────
// Bloqueia o IP após muitas tentativas erradas seguidas.
const MAX_TENTATIVAS = 8;
const BLOQUEIO_MS = 15 * 60 * 1000; // 15 minutos
const _tentativas = new Map(); // ip -> { count, until }

function ipDe(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'desconhecido';
}

// Limpeza periódica
setInterval(() => {
  const agora = Date.now();
  for (const [ip, info] of _tentativas) {
    if (info.until && info.until < agora) _tentativas.delete(ip);
  }
}, 10 * 60 * 1000).unref?.();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const ip = ipDe(req);
  const reg = _tentativas.get(ip);
  if (reg?.until && reg.until > Date.now()) {
    const min = Math.ceil((reg.until - Date.now()) / 60000);
    return res.status(429).json({ erro: `Muitas tentativas. Tente novamente em ${min} min.` });
  }

  const { senha } = req.body;
  if (!senha) return res.status(400).json({ erro: 'Senha obrigatória' });

  const row = db.prepare('SELECT valor FROM config WHERE chave = ?').get('senha_hash');
  if (!row || !bcrypt.compareSync(senha, row.valor)) {
    const info = _tentativas.get(ip) || { count: 0, until: 0 };
    info.count += 1;
    if (info.count >= MAX_TENTATIVAS) {
      info.until = Date.now() + BLOQUEIO_MS;
      info.count = 0;
    }
    _tentativas.set(ip, info);
    return res.status(401).json({ erro: 'Senha incorreta' });
  }

  _tentativas.delete(ip); // sucesso zera o contador

  const token = jwt.sign({ sub: 'admin' }, SECRET, { expiresIn: '30d' });
  res.json({ token });
});

// GET /api/auth/security-status (protegido) — avisa se ainda usa a senha padrão
router.get('/security-status', requireAuth, (req, res) => {
  try {
    const row = db.prepare('SELECT valor FROM config WHERE chave = ?').get('senha_hash');
    const senha_padrao = !!row && bcrypt.compareSync('sushi123', row.valor);
    res.json({ senha_padrao });
  } catch { res.json({ senha_padrao: false }); }
});

// POST /api/auth/change-password  (protegido)
router.post('/change-password', requireAuth, (req, res) => {
  const { senha_atual, nova_senha } = req.body;
  if (!senha_atual || !nova_senha) {
    return res.status(400).json({ erro: 'Preencha todos os campos' });
  }
  if (nova_senha.length < 6) {
    return res.status(400).json({ erro: 'Nova senha deve ter ao menos 6 caracteres' });
  }
  if (nova_senha === 'sushi123') {
    return res.status(400).json({ erro: 'Escolha uma senha diferente da padrão' });
  }

  const row = db.prepare('SELECT valor FROM config WHERE chave = ?').get('senha_hash');
  if (!row || !bcrypt.compareSync(senha_atual, row.valor)) {
    return res.status(401).json({ erro: 'Senha atual incorreta' });
  }

  const novoHash = bcrypt.hashSync(nova_senha, 10);
  db.prepare('UPDATE config SET valor = ? WHERE chave = ?').run(novoHash, 'senha_hash');
  res.json({ ok: true });
});

module.exports = router;
