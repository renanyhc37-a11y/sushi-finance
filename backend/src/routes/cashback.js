const { Router } = require('express');
const db = require('../db/database');

const router = Router();

// ── Migrations ────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS cashback_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    percentual REAL DEFAULT 5,
    minimo_resgate REAL DEFAULT 10,
    ativo INTEGER DEFAULT 1
  );
  INSERT OR IGNORE INTO cashback_config(id) VALUES(1);
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS cashback_saldo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telefone TEXT UNIQUE NOT NULL,
    nome TEXT,
    saldo REAL DEFAULT 0,
    total_ganho REAL DEFAULT 0,
    total_usado REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS cashback_transacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telefone TEXT NOT NULL,
    tipo TEXT NOT NULL,
    valor REAL NOT NULL,
    pedido_id INTEGER,
    descricao TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── Helpers ───────────────────────────────────────────────────
function getConfig() {
  return db.prepare('SELECT * FROM cashback_config WHERE id=1').get();
}

function getSaldo(telefone) {
  const tel = (telefone || '').replace(/\D/g, '');
  return db.prepare('SELECT * FROM cashback_saldo WHERE telefone=?').get(tel) || { saldo: 0, total_ganho: 0, total_usado: 0 };
}

function upsertSaldo(telefone, nome) {
  const tel = (telefone || '').replace(/\D/g, '');
  db.prepare(`
    INSERT INTO cashback_saldo(telefone, nome) VALUES(?,?)
    ON CONFLICT(telefone) DO UPDATE SET nome=COALESCE(EXCLUDED.nome, nome), updated_at=datetime('now')
  `).run(tel, nome || null);
  return db.prepare('SELECT * FROM cashback_saldo WHERE telefone=?').get(tel);
}

// Função exportada para uso em outros módulos (pdv.js, whatsapp)
function creditarCashback(telefone, nome, totalPedido, pedidoId) {
  const cfg = getConfig();
  if (!cfg.ativo) return null;
  const tel = (telefone || '').replace(/\D/g, '');
  if (!tel || tel.length < 8) return null;

  upsertSaldo(tel, nome);
  const valor = Math.round(totalPedido * (cfg.percentual / 100) * 100) / 100;
  if (valor <= 0) return null;

  db.prepare(`UPDATE cashback_saldo SET saldo=saldo+?, total_ganho=total_ganho+?, updated_at=datetime('now') WHERE telefone=?`).run(valor, valor, tel);
  db.prepare(`INSERT INTO cashback_transacoes(telefone, tipo, valor, pedido_id, descricao) VALUES(?,?,?,?,?)`).run(tel, 'ganho', valor, pedidoId || null, `Pedido #${pedidoId || '?'} — ${cfg.percentual}% de R$${Number(totalPedido).toFixed(2)}`);

  return { valor, saldo: db.prepare('SELECT saldo FROM cashback_saldo WHERE telefone=?').get(tel)?.saldo };
}

// Função exportada para uso em outros módulos (cardápio, PDV)
function usarCashback(telefone, valor, pedidoId, descricao) {
  const tel = (telefone || '').replace(/\D/g, '');
  const row = db.prepare('SELECT * FROM cashback_saldo WHERE telefone=?').get(tel);
  if (!row || row.saldo < valor) return { ok: false, erro: 'Saldo insuficiente' };

  db.prepare(`UPDATE cashback_saldo SET saldo=saldo-?, total_usado=total_usado+?, updated_at=datetime('now') WHERE telefone=?`).run(valor, valor, tel);
  db.prepare(`INSERT INTO cashback_transacoes(telefone, tipo, valor, pedido_id, descricao) VALUES(?,?,?,?,?)`).run(tel, 'usado', valor, pedidoId || null, descricao || `Desconto em pedido`);
  return { ok: true, saldo: db.prepare('SELECT saldo FROM cashback_saldo WHERE telefone=?').get(tel).saldo };
}

module.exports = router;
module.exports.creditarCashback = creditarCashback;
module.exports.usarCashback = usarCashback;
module.exports.getSaldo = getSaldo;
module.exports.getConfig = getConfig;

// ── GET /api/cashback/config ──────────────────────────────────
router.get('/config', (req, res) => res.json(getConfig()));

// ── PUT /api/cashback/config ──────────────────────────────────
router.put('/config', (req, res) => {
  const { percentual, minimo_resgate, ativo } = req.body;
  db.prepare(`UPDATE cashback_config SET percentual=COALESCE(?,percentual), minimo_resgate=COALESCE(?,minimo_resgate), ativo=COALESCE(?,ativo) WHERE id=1`)
    .run(percentual ?? null, minimo_resgate ?? null, ativo !== undefined ? (ativo ? 1 : 0) : null);
  res.json(getConfig());
});

// ── GET /api/cashback/saldo/:telefone ─────────────────────────
router.get('/saldo/:telefone', (req, res) => {
  const tel = req.params.telefone.replace(/\D/g, '');
  const row = db.prepare('SELECT * FROM cashback_saldo WHERE telefone=?').get(tel);
  const cfg = getConfig();
  res.json({ ...row, saldo: row?.saldo || 0, total_ganho: row?.total_ganho || 0, config: cfg });
});

// ── POST /api/cashback/creditar (manual) ─────────────────────
router.post('/creditar', (req, res) => {
  const { telefone, nome, valor, descricao } = req.body;
  const tel = (telefone || '').replace(/\D/g, '');
  if (!tel || !valor || isNaN(valor) || valor <= 0) return res.status(400).json({ erro: 'Telefone e valor obrigatórios' });

  upsertSaldo(tel, nome);
  db.prepare(`UPDATE cashback_saldo SET saldo=saldo+?, total_ganho=total_ganho+?, updated_at=datetime('now') WHERE telefone=?`).run(Number(valor), Number(valor), tel);
  db.prepare(`INSERT INTO cashback_transacoes(telefone, tipo, valor, descricao) VALUES(?,?,?,?)`).run(tel, 'manual', Number(valor), descricao || 'Crédito manual');
  res.json({ ok: true, saldo: db.prepare('SELECT * FROM cashback_saldo WHERE telefone=?').get(tel) });
});

// ── POST /api/cashback/usar ───────────────────────────────────
router.post('/usar', (req, res) => {
  const { telefone, valor, pedido_id, descricao } = req.body;
  const tel = (telefone || '').replace(/\D/g, '');
  if (!tel || !valor || isNaN(valor) || valor <= 0) return res.status(400).json({ erro: 'Telefone e valor obrigatórios' });

  const cfg = getConfig();
  const row = db.prepare('SELECT saldo FROM cashback_saldo WHERE telefone=?').get(tel);
  if (!row || row.saldo < cfg.minimo_resgate) return res.status(400).json({ erro: `Saldo mínimo para resgatar é R$${cfg.minimo_resgate.toFixed(2)}` });
  if (Number(valor) > row.saldo) return res.status(400).json({ erro: 'Valor maior que saldo disponível' });

  const result = usarCashback(tel, Number(valor), pedido_id, descricao);
  res.json(result);
});

// ── POST /api/cashback/estornar ───────────────────────────────
router.post('/estornar', (req, res) => {
  const { telefone, valor, descricao } = req.body;
  const tel = (telefone || '').replace(/\D/g, '');
  upsertSaldo(tel, null);
  db.prepare(`UPDATE cashback_saldo SET saldo=MAX(0,saldo-?), updated_at=datetime('now') WHERE telefone=?`).run(Number(valor), tel);
  db.prepare(`INSERT INTO cashback_transacoes(telefone, tipo, valor, descricao) VALUES(?,?,?,?)`).run(tel, 'estorno', Number(valor), descricao || 'Estorno');
  res.json({ ok: true });
});

// ── GET /api/cashback/historico/:telefone ─────────────────────
router.get('/historico/:telefone', (req, res) => {
  const tel = req.params.telefone.replace(/\D/g, '');
  res.json(db.prepare('SELECT * FROM cashback_transacoes WHERE telefone=? ORDER BY created_at DESC LIMIT 50').all(tel));
});

// ── GET /api/cashback/ranking ─────────────────────────────────
router.get('/ranking', (req, res) => {
  res.json(db.prepare('SELECT * FROM cashback_saldo ORDER BY saldo DESC LIMIT 50').all());
});

// ── GET /api/cashback/todos ───────────────────────────────────
router.get('/todos', (req, res) => {
  const { busca = '' } = req.query;
  res.json(db.prepare(`SELECT * FROM cashback_saldo WHERE telefone LIKE ? OR nome LIKE ? ORDER BY saldo DESC`).all(`%${busca}%`, `%${busca}%`));
});
