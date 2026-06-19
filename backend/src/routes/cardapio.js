const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { requireAuth } = require('../middleware/requireAuth');

// ── Upload de imagens (multer) ────────────────────────────────
let upload;
try {
  const multer = require('multer');
  const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'cardapio');
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
  const EXT_SEGURAS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/heic': '.heic', 'image/heif': '.heif' };
  const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOAD_DIR),
    filename: (_, file, cb) => {
      const ext = EXT_SEGURAS[file.mimetype] || '.jpg';
      cb(null, `item_${Date.now()}${ext}`);
    },
  });
  const fileFilter = (_, file, cb) => {
    if (MIME_PERMITIDOS.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Tipo de arquivo não permitido: ${file.mimetype}. Use JPEG, PNG, WebP ou GIF.`));
  };
  upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter });
} catch {
  upload = null;
  console.warn('[cardapio] multer não instalado — upload de fotos desativado. Rode: npm install multer');
}

function notificarPDV(dados) {
  try { require('./pdv').broadcast('novo_pedido', dados); } catch {}
}
async function notificarWhatsApp(pedido) {
  try {
    await require('../services/whatsapp').notificarNovoPedido(pedido);
  } catch (err) {
    console.error('[cardapio] Erro ao notificar WhatsApp:', err.message);
  }
}

const { gerarPixPayload } = require('../lib/pix');
const qrcodeLib = require('qrcode');

const router = Router();
const brlServer = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');

// GET /api/cardapio/pix?valor=&txid= — gera copia-e-cola + QR (público)
router.get('/pix', async (req, res) => {
  const get = chave => db.prepare("SELECT valor FROM config WHERE chave = ?").get(chave)?.valor;
  const chave = get('pix_chave');
  if (!chave) return res.json({ disponivel: false });
  const codigo = gerarPixPayload({
    chave,
    nome: get('pix_nome') || get('nome_restaurante') || 'Recebedor',
    cidade: get('pix_cidade') || 'Cidade',
    valor: req.query.valor,
    txid: req.query.txid,
  });
  let qr = null;
  try { qr = await qrcodeLib.toDataURL(codigo, { width: 280, margin: 1 }); } catch {}
  res.json({ disponivel: true, codigo, qr });
});

// ── Tabelas ───────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS cardapio_categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    emoji TEXT DEFAULT '🍱',
    ordem INTEGER DEFAULT 0,
    ativo INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS cardapio_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria_id INTEGER NOT NULL REFERENCES cardapio_categorias(id),
    nome TEXT NOT NULL,
    descricao TEXT,
    preco REAL NOT NULL,
    emoji TEXT DEFAULT '🍱',
    disponivel INTEGER DEFAULT 1,
    ordem INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS pdv_pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero INTEGER,
    cliente_nome TEXT NOT NULL,
    cliente_telefone TEXT,
    cliente_endereco TEXT NOT NULL,
    observacao TEXT,
    forma_pagamento TEXT,
    status TEXT DEFAULT 'novo',
    total REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pdv_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL REFERENCES pdv_pedidos(id) ON DELETE CASCADE,
    item_nome TEXT NOT NULL,
    quantidade INTEGER NOT NULL,
    valor_unitario REAL NOT NULL,
    observacao TEXT
  );

  CREATE TABLE IF NOT EXISTS clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telefone TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    endereco TEXT,
    total_pedidos INTEGER DEFAULT 0,
    recompensas_ganhas INTEGER DEFAULT 0,
    recompensas_usadas INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// migrações suaves
try { db.exec('ALTER TABLE pdv_pedidos ADD COLUMN forma_pagamento TEXT'); } catch {}
try { db.exec('ALTER TABLE pdv_pedidos ADD COLUMN fidelidade_pedido INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE pdv_pedidos ADD COLUMN desconto REAL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE pdv_pedidos ADD COLUMN cupom_codigo TEXT'); } catch {}
try { db.exec('ALTER TABLE pdv_pedidos ADD COLUMN troco_para REAL'); } catch {}
try { db.exec('ALTER TABLE pdv_pedidos ADD COLUMN bairro TEXT'); } catch {}
try { db.exec('ALTER TABLE pdv_pedidos ADD COLUMN frete REAL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE pdv_pedidos ADD COLUMN agendado_para TEXT'); } catch {}
try { db.exec('ALTER TABLE pdv_pedidos ADD COLUMN aceito_em TEXT'); } catch {}
try { db.exec('ALTER TABLE pdv_pedidos ADD COLUMN pronto_em TEXT'); } catch {}
try { db.exec('ALTER TABLE pdv_pedidos ADD COLUMN entregue_em TEXT'); } catch {}
try { db.exec('ALTER TABLE pdv_pedidos ADD COLUMN pix_confirmado_em TEXT'); } catch {}
try { db.exec("ALTER TABLE pdv_pedidos ADD COLUMN tipo_entrega TEXT DEFAULT 'entrega'"); } catch {}
try { db.exec('ALTER TABLE pdv_pedidos ADD COLUMN utm_source TEXT'); } catch {}
try { db.exec('ALTER TABLE pdv_pedidos ADD COLUMN utm_medium TEXT'); } catch {}
try { db.exec('ALTER TABLE pdv_pedidos ADD COLUMN utm_campaign TEXT'); } catch {}
try { db.exec('ALTER TABLE clientes ADD COLUMN aniversario TEXT'); } catch {}
try { db.exec('ALTER TABLE clientes ADD COLUMN aniversario_enviado_ano INTEGER'); } catch {}
try { db.exec('ALTER TABLE cardapio_itens ADD COLUMN foto TEXT'); } catch {}
try { db.exec('ALTER TABLE cardapio_categorias ADD COLUMN descricao TEXT'); } catch {}
try { db.exec('ALTER TABLE cardapio_itens ADD COLUMN is_sugestao INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE cardapio_itens ADD COLUMN preco_promo REAL'); } catch {}
try { db.exec('ALTER TABLE cardapio_itens ADD COLUMN promo_tag TEXT'); } catch {}
try { db.exec('ALTER TABLE cardapio_itens ADD COLUMN promo_ativa INTEGER DEFAULT 0'); } catch {}

// Novas tabelas: cupons e config
db.exec(`
  CREATE TABLE IF NOT EXISTS cupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,
    descricao TEXT,
    tipo TEXT NOT NULL DEFAULT 'percentual', -- 'percentual' | 'fixo'
    valor REAL NOT NULL,
    minimo REAL DEFAULT 0,
    usos_maximos INTEGER DEFAULT 0, -- 0 = ilimitado
    usos_atuais INTEGER DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    validade TEXT, -- data ISO ou null
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS config (
    chave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
  );
`);

// Config padrão de horário
const horarioPadrao = {
  seg: { aberto: true,  abre: '18:00', fecha: '23:00' },
  ter: { aberto: true,  abre: '18:00', fecha: '23:00' },
  qua: { aberto: true,  abre: '18:00', fecha: '23:00' },
  qui: { aberto: true,  abre: '18:00', fecha: '23:00' },
  sex: { aberto: true,  abre: '18:00', fecha: '23:30' },
  sab: { aberto: true,  abre: '17:00', fecha: '23:30' },
  dom: { aberto: true,  abre: '17:00', fecha: '23:00' },
};
try {
  db.prepare("INSERT OR IGNORE INTO config (chave, valor) VALUES (?, ?)").run(
    'horario', JSON.stringify(horarioPadrao)
  );
  db.prepare("INSERT OR IGNORE INTO config (chave, valor) VALUES (?, ?)").run(
    'mensagem_fechado', 'Estamos fechados no momento. Volte no horário de funcionamento! 🍣'
  );
} catch {}

// ── Helpers fidelidade ────────────────────────────────────────
const PEDIDOS_POR_RECOMPENSA = 10;
const RECOMPENSA_DESCRICAO   = '1 Temaki Salmão grátis no próximo pedido! 🎁';

function calcFidelidade(total_pedidos, recompensas_ganhas, recompensas_usadas) {
  const recompensas_disponiveis = recompensas_ganhas - recompensas_usadas;
  const pedidos_no_ciclo = total_pedidos % PEDIDOS_POR_RECOMPENSA;
  const proximo_em = PEDIDOS_POR_RECOMPENSA - pedidos_no_ciclo;
  return { total_pedidos, recompensas_ganhas, recompensas_usadas, recompensas_disponiveis, pedidos_no_ciclo, proximo_em };
}

function normalizarTelefone(tel) {
  return tel.replace(/\D/g, '');
}

// ── Seed cardápio ────────────────────────────────────────────
const jaTemCategoria = db.prepare('SELECT COUNT(*) as n FROM cardapio_categorias').get();
if (jaTemCategoria.n === 0) {
  const cats = [
    { nome: 'Combinados', emoji: '🍱', ordem: 1 },
    { nome: 'Especiais',  emoji: '🍣', ordem: 2 },
    { nome: 'Hot Roll',   emoji: '🔥', ordem: 3 },
    { nome: 'Bebidas',    emoji: '🥤', ordem: 4 },
  ];
  const insC = db.prepare('INSERT INTO cardapio_categorias (nome, emoji, ordem) VALUES (?, ?, ?)');
  cats.forEach(c => insC.run(c.nome, c.emoji, c.ordem));

  const [comb, esp, hot, beb] = ['Combinados','Especiais','Hot Roll','Bebidas']
    .map(n => db.prepare('SELECT id FROM cardapio_categorias WHERE nome = ?').get(n).id);

  const itens = [
    [comb, 'Combinado Iniciante',  '15 peças · salmão, atum e uramaki',            44.90, '🍱', 1],
    [comb, 'Combinado Premium',    '20 peças · seleção especial do chef',           59.90, '🍱', 2],
    [comb, 'Combinado Casal',      '30 peças · ideal para 2 pessoas',               79.90, '🍱', 3],
    [comb, 'Combinado Família',    '50 peças · perfeito para toda a família',      129.90, '🍱', 4],
    [esp,  'Sashimi Salmão',       '8 fatias de salmão premium',                    38.90, '🍣', 1],
    [esp,  'Temaki Salmão',        'Cone de alga com salmão e cream cheese',        22.90, '🍣', 2],
    [esp,  'Temaki Especial',      'Cone recheado com salmão, atum e camarão',      26.90, '🍣', 3],
    [esp,  'Niguiri Misto',        '6 peças · salmão + atum + camarão',             29.90, '🍣', 4],
    [hot,  'Hot Roll Salmão',      '8 peças empanadas com salmão e cream cheese',   34.90, '🔥', 1],
    [hot,  'Hot Roll Atum',        '8 peças empanadas com atum e cebola crispy',    32.90, '🔥', 2],
    [hot,  'Hot Roll Philadelphia','8 peças com salmão, cream cheese e pepino',     36.90, '🔥', 3],
    [hot,  'Hot Roll Camarão',     '8 peças empanadas com camarão temperado',       38.90, '🔥', 4],
    [beb,  'Água Mineral 500ml',   'Sem gás ou com gás',                             4.00, '💧', 1],
    [beb,  'Refrigerante Lata',    'Coca-Cola, Guaraná ou Sprite',                   7.00, '🥤', 2],
    [beb,  'Suco Natural',         'Laranja, limão ou maracujá',                     9.90, '🧃', 3],
    [beb,  'Chá Gelado',           'Pêssego ou limão',                               8.00, '🍵', 4],
  ];
  const insI = db.prepare('INSERT INTO cardapio_itens (categoria_id, nome, descricao, preco, emoji, ordem) VALUES (?,?,?,?,?,?)');
  itens.forEach(i => insI.run(...i));
}

// ── GET /api/cardapio ────────────────────────────────────────
router.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store');
  const categorias = db.prepare('SELECT * FROM cardapio_categorias WHERE ativo = 1 ORDER BY ordem').all();
  res.json(categorias.map(cat => ({
    ...cat,
    itens: db.prepare('SELECT id, categoria_id, nome, descricao, preco, emoji, disponivel, ordem, foto, is_sugestao, preco_promo, promo_tag, promo_ativa FROM cardapio_itens WHERE categoria_id = ? AND disponivel = 1 ORDER BY ordem').all(cat.id),
  })));
});

// ── GET /api/cardapio/debug-promo — diagnóstico (remover depois) ─
router.get('/debug-promo', requireAuth, (req, res) => {
  const itens = db.prepare('SELECT id, nome, preco, preco_promo, promo_tag, promo_ativa FROM cardapio_itens ORDER BY id').all();
  res.json(itens);
});

// ══════════════════════════════════════════════════════════════
// ── ROTAS ADMIN (todas exigem autenticação) ───────────────────
// ══════════════════════════════════════════════════════════════

// GET /api/cardapio/admin — tudo (categorias + itens, inclusive inativos)
// Lista plana de todos os itens (para selects de composição)
router.get('/itens', requireAuth, (req, res) => {
  const itens = db.prepare('SELECT id, nome, preco, emoji, categoria_id, disponivel FROM cardapio_itens ORDER BY nome').all();
  res.json(itens);
});

router.get('/admin', requireAuth, (req, res) => {
  const categorias = db.prepare('SELECT * FROM cardapio_categorias ORDER BY ordem, id').all();
  res.json(categorias.map(cat => ({
    ...cat,
    itens: db.prepare('SELECT * FROM cardapio_itens WHERE categoria_id = ? ORDER BY ordem, id').all(cat.id),
  })));
});

// ── CATEGORIAS ────────────────────────────────────────────────

// POST /api/cardapio/categorias
router.post('/categorias', requireAuth, (req, res) => {
  const { nome, emoji, descricao } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório' });
  const maxOrdem = db.prepare('SELECT MAX(ordem) as m FROM cardapio_categorias').get();
  const ordem = (maxOrdem?.m || 0) + 1;
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO cardapio_categorias (nome, emoji, descricao, ordem, ativo) VALUES (?,?,?,?,1)'
  ).run(nome.trim(), emoji || '🍱', descricao?.trim() || null, ordem);
  res.status(201).json(db.prepare('SELECT * FROM cardapio_categorias WHERE id = ?').get(lastInsertRowid));
});

// PATCH /api/cardapio/categorias/:id
router.patch('/categorias/:id', requireAuth, (req, res) => {
  const { nome, emoji, descricao, ativo } = req.body;
  const cat = db.prepare('SELECT * FROM cardapio_categorias WHERE id = ?').get(req.params.id);
  if (!cat) return res.status(404).json({ erro: 'Categoria não encontrada' });
  db.prepare(`UPDATE cardapio_categorias SET
    nome = COALESCE(?, nome),
    emoji = COALESCE(?, emoji),
    descricao = COALESCE(?, descricao),
    ativo = COALESCE(?, ativo)
    WHERE id = ?
  `).run(nome ?? null, emoji ?? null, descricao ?? null,
    ativo !== undefined ? (ativo ? 1 : 0) : null, req.params.id);
  res.json(db.prepare('SELECT * FROM cardapio_categorias WHERE id = ?').get(req.params.id));
});

// DELETE /api/cardapio/categorias/:id
router.delete('/categorias/:id', requireAuth, (req, res) => {
  const itens = db.prepare('SELECT COUNT(*) as n FROM cardapio_itens WHERE categoria_id = ?').get(req.params.id);
  if (itens.n > 0) return res.status(400).json({ erro: `Remova os ${itens.n} itens desta categoria antes de excluí-la` });
  db.prepare('DELETE FROM cardapio_categorias WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/cardapio/categorias/reordenar
router.post('/categorias/reordenar', requireAuth, (req, res) => {
  const { ids } = req.body; // array de ids na nova ordem
  if (!Array.isArray(ids)) return res.status(400).json({ erro: 'ids deve ser array' });
  const upd = db.prepare('UPDATE cardapio_categorias SET ordem = ? WHERE id = ?');
  ids.forEach((id, i) => upd.run(i + 1, id));
  res.json({ ok: true });
});

// ── ITENS ─────────────────────────────────────────────────────

// POST /api/cardapio/itens
router.post('/itens', requireAuth, (req, res) => {
  const { categoria_id, nome, descricao, preco, emoji } = req.body;
  if (!nome?.trim()) return res.status(400).json({ erro: 'Nome é obrigatório' });
  if (!preco || isNaN(Number(preco))) return res.status(400).json({ erro: 'Preço inválido' });
  if (!categoria_id) return res.status(400).json({ erro: 'categoria_id é obrigatório' });
  const maxOrdem = db.prepare('SELECT MAX(ordem) as m FROM cardapio_itens WHERE categoria_id = ?').get(categoria_id);
  const ordem = (maxOrdem?.m || 0) + 1;
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO cardapio_itens (categoria_id, nome, descricao, preco, emoji, ordem, disponivel) VALUES (?,?,?,?,?,?,1)'
  ).run(categoria_id, nome.trim(), descricao?.trim() || null, Number(preco), emoji || '🍱', ordem);
  res.status(201).json(db.prepare('SELECT * FROM cardapio_itens WHERE id = ?').get(lastInsertRowid));
});

// PATCH /api/cardapio/itens/:id
router.patch('/itens/:id', requireAuth, (req, res) => {
  try {
    const { nome, descricao, preco, emoji, disponivel, ordem, categoria_id, is_sugestao, preco_promo, promo_tag, promo_ativa } = req.body;
    const item = db.prepare('SELECT * FROM cardapio_itens WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ erro: 'Item não encontrado' });
    db.prepare(`UPDATE cardapio_itens SET
      nome       = COALESCE(?, nome),
      descricao  = COALESCE(?, descricao),
      preco      = COALESCE(?, preco),
      emoji      = COALESCE(?, emoji),
      disponivel = COALESCE(?, disponivel),
      ordem      = COALESCE(?, ordem),
      categoria_id = COALESCE(?, categoria_id),
      is_sugestao  = COALESCE(?, is_sugestao),
      preco_promo  = ?,
      promo_tag    = ?,
      promo_ativa  = ?
      WHERE id = ?
    `).run(nome ?? null, descricao ?? null, preco !== undefined ? Number(preco) : null,
      emoji ?? null, disponivel !== undefined ? (disponivel ? 1 : 0) : null,
      ordem ?? null, categoria_id ?? null,
      is_sugestao !== undefined ? (is_sugestao ? 1 : 0) : null,
      preco_promo !== undefined ? (preco_promo ? Number(preco_promo) : null) : item.preco_promo,
      promo_tag !== undefined ? (promo_tag || null) : item.promo_tag,
      promo_ativa !== undefined ? (promo_ativa ? 1 : 0) : (item.promo_ativa || 0),
      req.params.id);
    res.json(db.prepare('SELECT * FROM cardapio_itens WHERE id = ?').get(req.params.id));
  } catch (e) { console.error('PATCH /itens/:id:', e); res.status(500).json({ erro: e.message }); }
});

// DELETE /api/cardapio/itens/:id
router.delete('/itens/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM cardapio_itens WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ erro: 'Item não encontrado' });
  // Remove foto antiga se existir
  if (item.foto) {
    const fotoPath = path.join(__dirname, '..', '..', '..', 'frontend', 'public', item.foto.replace(/^\//, ''));
    try { fs.unlinkSync(fotoPath); } catch {}
  }
  db.prepare('DELETE FROM cardapio_itens WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/cardapio/itens/reordenar
router.post('/itens/reordenar', requireAuth, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ erro: 'ids deve ser array' });
  const upd = db.prepare('UPDATE cardapio_itens SET ordem = ? WHERE id = ?');
  ids.forEach((id, i) => upd.run(i + 1, id));
  res.json({ ok: true });
});

// POST /api/cardapio/itens/:id/foto — upload de imagem
router.post('/itens/:id/foto', requireAuth, (req, res) => {
  if (!upload) return res.status(503).json({ erro: 'Upload não disponível. Instale multer: npm install multer' });
  upload.single('foto')(req, res, (err) => {
    if (err) return res.status(400).json({ erro: err.message });
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

    const item = db.prepare('SELECT * FROM cardapio_itens WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ erro: 'Item não encontrado' });

    // Remove foto antiga
    if (item.foto) {
      const old = path.join(__dirname, '..', '..', '..', 'frontend', 'public', item.foto.replace(/^\//, ''));
      try { fs.unlinkSync(old); } catch {}
    }

    const fotoUrl = `/cardapio/${req.file.filename}`;
    db.prepare('UPDATE cardapio_itens SET foto = ? WHERE id = ?').run(fotoUrl, req.params.id);
    res.json({ foto: fotoUrl, item: db.prepare('SELECT * FROM cardapio_itens WHERE id = ?').get(req.params.id) });
  });
});

// DELETE /api/cardapio/itens/:id/foto — remove foto
router.delete('/itens/:id/foto', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM cardapio_itens WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ erro: 'Item não encontrado' });
  if (item.foto) {
    const fotoPath = path.join(__dirname, '..', '..', '..', 'frontend', 'public', item.foto.replace(/^\//, ''));
    try { fs.unlinkSync(fotoPath); } catch {}
    db.prepare('UPDATE cardapio_itens SET foto = NULL WHERE id = ?').run(req.params.id);
  }
  res.json({ ok: true });
});

// ── GET /api/cardapio/cliente/:telefone ──────────────────────
// Público — busca cliente pelo telefone para autofill
router.get('/cliente/:telefone', (req, res) => {
  const tel = normalizarTelefone(req.params.telefone);
  if (tel.length < 8) return res.status(400).json({ erro: 'Telefone inválido' });

  const cliente = db.prepare('SELECT * FROM clientes WHERE telefone = ?').get(tel);
  if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

  res.json({ ...cliente, fidelidade: calcFidelidade(cliente.total_pedidos, cliente.recompensas_ganhas, cliente.recompensas_usadas) });
});

// ── POST /api/cardapio/pedido ────────────────────────────────
router.post('/pedido', (req, res) => {
  const { cliente_nome, cliente_telefone, cliente_endereco, observacao, forma_pagamento, itens, cupom_codigo, troco_para, bairro, aniversario, agendado_para, tipo_entrega, utm } = req.body;

  const ehRetirada = tipo_entrega === 'retirada';
  if (!cliente_nome?.trim())    return res.status(400).json({ erro: 'Nome é obrigatório' });
  // Retirada não precisa de endereço (cliente busca no balcão)
  if (!ehRetirada && !cliente_endereco?.trim()) return res.status(400).json({ erro: 'Endereço é obrigatório' });
  if (!Array.isArray(itens) || itens.length === 0) return res.status(400).json({ erro: 'Carrinho vazio' });
  if (ehRetirada && db.prepare("SELECT valor FROM config WHERE chave='retirada_ativa'").get()?.valor !== '1')
    return res.status(400).json({ erro: 'Retirada não está disponível.' });

  // Bloqueia pedidos com a loja FECHADA (agendamentos para depois são permitidos)
  if (!agendado_para) {
    const st = lojaAberta();
    if (!st.aberta) return res.status(409).json({ erro: 'Estamos fechados no momento 🍣 Confira nosso horário de atendimento.', fechado: true });
  }

  // ── SEGURANÇA: o preço NUNCA vem do cliente. Buscamos o preço real
  // de cada item no banco pelo item_id. Isso impede pedidos fraudados
  // (ex.: cliente alterar valor_unitario para R$0 no navegador).
  const buscaItem = db.prepare('SELECT id, nome, preco, disponivel FROM cardapio_itens WHERE id = ?');
  const itensValidados = [];
  for (const i of itens) {
    const qtd = Math.max(1, Math.floor(Number(i.quantidade) || 0));
    const ref = i.item_id != null ? buscaItem.get(Number(i.item_id)) : null;
    if (!ref) {
      return res.status(400).json({ erro: `Item inválido ou indisponível no carrinho.` });
    }
    if (!ref.disponivel) {
      return res.status(400).json({ erro: `O item "${ref.nome}" não está mais disponível.` });
    }
    const obs = (typeof i.observacao === 'string' && i.observacao.trim()) ? i.observacao.trim() : null;
    itensValidados.push({
      item_nome: ref.nome + (obs ? ` (obs: ${obs})` : ''),
      quantidade: qtd,
      valor_unitario: Number(ref.preco),   // preço autoritativo do banco
      observacao: obs,
    });
  }

  const subtotal = itensValidados.reduce((s, i) => s + (i.valor_unitario * i.quantidade), 0);

  // Aplicar cupom
  let desconto = 0;
  let cupomUsado = null;
  if (cupom_codigo?.trim()) {
    const cupom = db.prepare('SELECT * FROM cupons WHERE UPPER(codigo) = UPPER(?) AND ativo = 1').get(cupom_codigo.trim());
    if (cupom && subtotal >= (cupom.minimo || 0)) {
      // Incremento ATÔMICO: o próprio UPDATE só passa se ainda houver
      // usos disponíveis (usos_maximos = 0 significa ilimitado). Reservamos
      // o uso ANTES de aplicar o desconto, evitando que dois pedidos
      // simultâneos furem o limite (condição de corrida).
      const { changes } = db.prepare(
        'UPDATE cupons SET usos_atuais = usos_atuais + 1 WHERE id = ? AND (usos_maximos = 0 OR usos_atuais < usos_maximos)'
      ).run(cupom.id);
      if (changes === 1) {
        if (cupom.tipo === 'percentual') desconto = subtotal * (cupom.valor / 100);
        else desconto = Math.min(cupom.valor, subtotal);
        cupomUsado = cupom;
      }
    }
  }

  // ── Entrega: pedido mínimo + frete por bairro ────────────────
  const getCfg = chave => db.prepare("SELECT valor FROM config WHERE chave = ?").get(chave)?.valor;
  const pedidoMinimo = Number(getCfg('pedido_minimo') || 0);
  if (pedidoMinimo > 0 && subtotal < pedidoMinimo) {
    return res.status(400).json({ erro: `Pedido mínimo de ${brlServer(pedidoMinimo)} (sem o frete).` });
  }
  let bairrosEntrega = [];
  try { bairrosEntrega = JSON.parse(getCfg('bairros_entrega') || '[]'); } catch {}
  let frete = 0;
  // Retirada: sem frete e sem checagem de bairro/área
  if (!ehRetirada && bairrosEntrega.length > 0) {
    const b = bairro?.trim()
      ? bairrosEntrega.find(x => x.nome.toLowerCase() === bairro.trim().toLowerCase())
      : null;
    if (b) frete = Number(b.taxa) || 0;
    else if (getCfg('aceita_fora_area') !== '0') frete = Number(getCfg('taxa_entrega_padrao') || 0);
    else return res.status(400).json({ erro: 'Endereço fora da nossa área de entrega.' });
  }

  const total = Math.max(0, subtotal - desconto) + frete;

  // ── Numeração da comanda ────────────────────────────────────
  // Modo MANUAL: se o operador definiu um "próximo número" (config
  // comanda_proximo), usa-o e incrementa. Permite zerar/escolher a numeração.
  // Modo AUTOMÁTICO (padrão): reinicia por dia (máx do dia + 1).
  let numero;
  const comandaProx = getCfg('comanda_proximo');
  if (comandaProx !== undefined && comandaProx !== null && String(comandaProx).trim() !== '') {
    numero = Math.max(1, parseInt(comandaProx, 10) || 1);
    db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('comanda_proximo', ?)").run(String(numero + 1));
  } else {
    const hoje = new Date().toISOString().slice(0, 10);
    const ultimo = db.prepare("SELECT MAX(numero) as n FROM pdv_pedidos WHERE date(created_at) = ?").get(hoje);
    numero = (ultimo?.n || 0) + 1;
  }

  // Troco: só faz sentido em dinheiro e quando o valor informado cobre o total
  const trocoPara = (forma_pagamento === 'dinheiro' && Number(troco_para) > total)
    ? Number(troco_para) : null;

  // Agendamento (data/hora futura). Aceita ISO; ignora se no passado.
  const agendadoPara = (agendado_para && new Date(agendado_para) > new Date()) ? agendado_para : null;

  // Endereço: na retirada guarda o aviso (ou endereço da loja) no lugar
  const enderecoFinal = ehRetirada
    ? ('Retirada no balcão' + (getCfg('endereco_loja') ? ' — ' + getCfg('endereco_loja') : ''))
    : cliente_endereco.trim();

  const u = utm && typeof utm === 'object' ? utm : {};
  const lim = v => (typeof v === 'string' ? v.slice(0, 60) : null);

  const stmt = db.prepare(
    'INSERT INTO pdv_pedidos (numero, cliente_nome, cliente_telefone, cliente_endereco, observacao, forma_pagamento, total, desconto, cupom_codigo, troco_para, bairro, frete, agendado_para, tipo_entrega, utm_source, utm_medium, utm_campaign) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  const { lastInsertRowid: pedidoId } = stmt.run(
    numero, cliente_nome.trim(), cliente_telefone?.trim() || null,
    enderecoFinal, observacao?.trim() || null,
    forma_pagamento?.trim() || null, total, desconto || null, cupomUsado?.codigo || null, trocoPara,
    ehRetirada ? null : (bairro?.trim() || null), frete || 0, agendadoPara, ehRetirada ? 'retirada' : 'entrega',
    lim(u.source), lim(u.medium), lim(u.campaign)
  );

  const insItem = db.prepare('INSERT INTO pdv_itens (pedido_id, item_nome, quantidade, valor_unitario, observacao) VALUES (?,?,?,?,?)');
  itensValidados.forEach(i => insItem.run(pedidoId, i.item_nome, i.quantidade, i.valor_unitario, i.observacao));

  // Atribuição de conversão de campanha (se esse cliente recebeu uma campanha)
  if (cliente_telefone?.trim()) {
    try { require('./campanhas').registrarConversao(cliente_telefone, pedidoId, total); } catch {}
  }

  // ── Fidelidade ──────────────────────────────────────────────
  let fidelidade = null;
  let ganhou_recompensa = false;

  // Aniversário no formato MM-DD (a partir de uma data YYYY-MM-DD)
  const anivMMDD = (typeof aniversario === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(aniversario))
    ? aniversario.slice(5, 10) : null;

  if (cliente_telefone?.trim()) {
    const tel = normalizarTelefone(cliente_telefone.trim());
    const clienteExistente = db.prepare('SELECT * FROM clientes WHERE telefone = ?').get(tel);

    if (clienteExistente) {
      // Atualiza cliente existente
      const novo_total = clienteExistente.total_pedidos + 1;
      const novo_ganhas = Math.floor(novo_total / PEDIDOS_POR_RECOMPENSA);
      ganhou_recompensa = novo_ganhas > clienteExistente.recompensas_ganhas;

      db.prepare(`
        UPDATE clientes SET
          nome = ?, endereco = ?, total_pedidos = ?, recompensas_ganhas = ?,
          aniversario = COALESCE(?, aniversario), updated_at = CURRENT_TIMESTAMP
        WHERE telefone = ?
      `).run(cliente_nome.trim(), cliente_endereco.trim(), novo_total, novo_ganhas, anivMMDD, tel);

      const atualizado = db.prepare('SELECT * FROM clientes WHERE telefone = ?').get(tel);
      fidelidade = calcFidelidade(atualizado.total_pedidos, atualizado.recompensas_ganhas, atualizado.recompensas_usadas);
    } else {
      // Cria novo cliente
      db.prepare(`
        INSERT INTO clientes (telefone, nome, endereco, total_pedidos, recompensas_ganhas, aniversario)
        VALUES (?, ?, ?, 1, 0, ?)
      `).run(tel, cliente_nome.trim(), cliente_endereco.trim(), anivMMDD);

      fidelidade = calcFidelidade(1, 0, 0);
    }
  }

  // Notifica PDV
  notificarPDV({
    id: pedidoId, numero, total,
    cliente_nome: cliente_nome.trim(),
    cliente_telefone: cliente_telefone?.trim() || null,
    cliente_endereco: cliente_endereco.trim(),
    fidelidade,
    ganhou_recompensa,
  });

  // WhatsApp
  const pedidoCompleto = {
    id: pedidoId, numero, total,
    cliente_nome: cliente_nome.trim(),
    cliente_telefone: cliente_telefone?.trim() || null,
    cliente_endereco: cliente_endereco.trim(),
    itens: itensValidados.map(i => ({ quantidade: i.quantidade, item_nome: i.item_nome, valor_unitario: i.valor_unitario })),
  };
  notificarWhatsApp(pedidoCompleto);

  res.status(201).json({ id: pedidoId, numero, total, fidelidade, ganhou_recompensa, recompensa_descricao: ganhou_recompensa ? RECOMPENSA_DESCRICAO : null });
});

// ══════════════════════════════════════════════════════════════
// ── HORÁRIO DE FUNCIONAMENTO ──────────────────────────────────
// ══════════════════════════════════════════════════════════════

function getHorario() {
  const row = db.prepare("SELECT valor FROM config WHERE chave = 'horario'").get();
  return row ? JSON.parse(row.valor) : {};
}

function lojaAberta() {
  const get = c => db.prepare("SELECT valor FROM config WHERE chave = ?").get(c)?.valor;

  // 1. Fechado manualmente (força fechamento)
  if (get('fechado_forcado') === '1') {
    return { aberta: false, motivo: 'fechado_forcado' };
  }

  // 2. Aberto manualmente (força abertura)
  if (get('aberto_forcado') === '1') {
    return { aberta: true, forcado: true };
  }

  // 3. Fechamento temporário (pausa rápida)
  const tempRow = db.prepare("SELECT valor FROM config WHERE chave = 'fechamento_temp_ate'").get();
  if (tempRow) {
    const ate = new Date(tempRow.valor);
    if (ate > new Date()) {
      return { aberta: false, motivo: 'fechamento_temp', fecha_temp_ate: tempRow.valor };
    } else {
      try { db.prepare("DELETE FROM config WHERE chave = 'fechamento_temp_ate'").run(); } catch {}
    }
  }

  // 4. Horário programado
  const horario = getHorario();
  const agora = new Date();
  const dias = ['dom','seg','ter','qua','qui','sex','sab'];
  const diaKey = dias[agora.getDay()];
  const diaConfig = horario[diaKey];
  if (!diaConfig || !diaConfig.aberto) return { aberta: false, motivo: 'fechado_hoje' };
  const hhmm = agora.toTimeString().slice(0,5);
  if (hhmm < diaConfig.abre) return { aberta: false, motivo: 'ainda_nao_abriu', abre: diaConfig.abre };
  if (hhmm >= diaConfig.fecha) return { aberta: false, motivo: 'ja_fechou', fecha: diaConfig.fecha };
  return { aberta: true, fecha: diaConfig.fecha };
}

// GET /api/cardapio/config — público, retorna nome e config básica
router.get('/config', (req, res) => {
  const get = chave => db.prepare("SELECT valor FROM config WHERE chave = ?").get(chave)?.valor;
  const tempAte = get('fechamento_temp_ate');
  const tempAtivo = tempAte && new Date(tempAte) > new Date();
  const infoRaw = get('info_strip');
  const info_strip = infoRaw ? JSON.parse(infoRaw) : { entrega: '40–60 min', frete: 'Grátis +R$80', nota: '4.9' };
  let bairros_entrega = [];
  try { bairros_entrega = JSON.parse(get('bairros_entrega') || '[]'); } catch {}
  res.json({
    nome_restaurante: get('nome_restaurante') || 'Sushi Control',
    fechamento_temp: tempAtivo ? { ate: tempAte } : null,
    aberto_forcado: get('aberto_forcado') === '1',
    fechado_forcado: get('fechado_forcado') === '1',
    info_strip,
    google_reviews_url: get('google_reviews_url') || null,
    // Cor de destaque da marca (personalizável por restaurante) — usada no
    // painel e no cardápio. Default: laranja da marca.
    cor_destaque: get('cor_destaque') || '#f97316',
    // Número de WhatsApp do restaurante p/ o cliente acompanhar o pedido:
    // usa o número CONECTADO via QR (o WhatsApp real do restaurante). Se não
    // estiver conectado no momento, cai no admin_whatsapp como reserva.
    whatsapp: ((() => { try { return require('../services/whatsapp').getNumero(); } catch { return null; } })() || get('admin_whatsapp') || '').replace(/\D/g, ''),
    // Entrega
    pedido_minimo: Number(get('pedido_minimo') || 0),
    taxa_entrega_padrao: Number(get('taxa_entrega_padrao') || 0),
    aceita_fora_area: get('aceita_fora_area') !== '0', // padrão: aceita (com taxa padrão)
    bairros_entrega, // [{ nome, taxa }]
    // Pagamento / campos admin
    pix_ativo: !!get('pix_chave'),
    pix_chave: get('pix_chave') || '',
    pix_nome: get('pix_nome') || '',
    pix_cidade: get('pix_cidade') || '',
    cupom_aniversario: get('cupom_aniversario') || '',
    meta_faturamento_mes: Number(get('meta_faturamento_mes') || 0),
    // Retirada
    retirada_ativa: get('retirada_ativa') === '1',
    endereco_loja: get('endereco_loja') || '',
    // Tráfego pago — pixels (públicos: o cardápio precisa deles pra carregar)
    meta_pixel_id: get('meta_pixel_id') || '',
    ga_id: get('ga_id') || '',
    // Numeração da comanda
    comanda_modo: (get('comanda_proximo') || '').trim() !== '' ? 'manual' : 'auto',
    comanda_proximo: (() => {
      const m = (get('comanda_proximo') || '').trim();
      if (m !== '') return parseInt(m, 10) || 1;
      const hoje = new Date().toISOString().slice(0, 10);
      const u = db.prepare("SELECT MAX(numero) as n FROM pdv_pedidos WHERE date(created_at) = ?").get(hoje);
      return (u?.n || 0) + 1; // próximo número no modo automático (só exibição)
    })(),
  });
});

// POST /api/cardapio/abrir-agora — admin, abre imediatamente
router.post('/abrir-agora', requireAuth, (req, res) => {
  db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('aberto_forcado','1')").run();
  db.prepare("DELETE FROM config WHERE chave = 'fechado_forcado'").run();
  db.prepare("DELETE FROM config WHERE chave = 'fechamento_temp_ate'").run();
  res.json({ ok: true });
});

// POST /api/cardapio/fechar-agora — admin, fecha imediatamente
router.post('/fechar-agora', requireAuth, (req, res) => {
  db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('fechado_forcado','1')").run();
  db.prepare("DELETE FROM config WHERE chave = 'aberto_forcado'").run();
  db.prepare("DELETE FROM config WHERE chave = 'fechamento_temp_ate'").run();
  res.json({ ok: true });
});

// DELETE /api/cardapio/modo-forcado — admin, volta ao horário automático
router.delete('/modo-forcado', requireAuth, (req, res) => {
  db.prepare("DELETE FROM config WHERE chave IN ('aberto_forcado','fechado_forcado')").run();
  res.json({ ok: true });
});

// GET /api/cardapio/trafego-relatorio?dias=30 — admin, pedidos por origem (UTM)
router.get('/trafego-relatorio', requireAuth, (req, res) => {
  const dias = Math.min(365, Math.max(1, Number(req.query.dias) || 30));
  const desde = `-${dias} days`;
  const porOrigem = db.prepare(`
    SELECT
      COALESCE(NULLIF(utm_source,''),'(orgânico/direto)') AS origem,
      COALESCE(NULLIF(utm_campaign,''),'—') AS campanha,
      COUNT(*) AS pedidos,
      COALESCE(SUM(total),0) AS faturamento
    FROM pdv_pedidos
    WHERE created_at >= datetime('now', ?)
    GROUP BY origem, campanha
    ORDER BY faturamento DESC
  `).all(desde);
  const totalGeral = db.prepare(`SELECT COUNT(*) p, COALESCE(SUM(total),0) f FROM pdv_pedidos WHERE created_at >= datetime('now', ?)`).get(desde);
  const pago = db.prepare(`SELECT COUNT(*) p, COALESCE(SUM(total),0) f FROM pdv_pedidos WHERE created_at >= datetime('now', ?) AND utm_source IS NOT NULL AND utm_source <> ''`).get(desde);
  res.json({
    dias,
    por_origem: porOrigem,
    total_pedidos: totalGeral.p || 0,
    total_faturamento: totalGeral.f || 0,
    pedidos_pagos: pago.p || 0,
    faturamento_pago: pago.f || 0,
  });
});

// PUT /api/cardapio/config — admin, atualiza configurações
router.put('/config', requireAuth, (req, res) => {
  const { nome_restaurante, info_strip, google_reviews_url } = req.body;
  if (nome_restaurante !== undefined)
    db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)").run('nome_restaurante', nome_restaurante.trim() || 'Sushi Control');
  if (info_strip !== undefined)
    db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)").run('info_strip', JSON.stringify(info_strip));
  if (google_reviews_url !== undefined)
    db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)").run('google_reviews_url', google_reviews_url || '');
  // Cor de destaque (hex). Valida formato #rrggbb; ignora se inválido.
  if (req.body.cor_destaque !== undefined) {
    const c = String(req.body.cor_destaque || '').trim();
    if (/^#[0-9a-fA-F]{6}$/.test(c)) db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('cor_destaque', ?)").run(c);
  }
  // Entrega
  const { pedido_minimo, taxa_entrega_padrao, aceita_fora_area, bairros_entrega } = req.body;
  if (pedido_minimo !== undefined)
    db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('pedido_minimo', ?)").run(String(Number(pedido_minimo) || 0));
  if (taxa_entrega_padrao !== undefined)
    db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('taxa_entrega_padrao', ?)").run(String(Number(taxa_entrega_padrao) || 0));
  if (aceita_fora_area !== undefined)
    db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('aceita_fora_area', ?)").run(aceita_fora_area ? '1' : '0');
  if (bairros_entrega !== undefined) {
    const limpos = (Array.isArray(bairros_entrega) ? bairros_entrega : [])
      .filter(b => b && b.nome?.trim())
      .map(b => ({ nome: b.nome.trim(), taxa: Number(b.taxa) || 0 }));
    db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('bairros_entrega', ?)").run(JSON.stringify(limpos));
  }
  // Pix + cupom aniversário + meta
  const { pix_chave, pix_nome, pix_cidade, cupom_aniversario, meta_faturamento_mes } = req.body;
  if (pix_chave !== undefined) db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('pix_chave', ?)").run((pix_chave || '').trim());
  if (pix_nome !== undefined) db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('pix_nome', ?)").run((pix_nome || '').trim());
  if (pix_cidade !== undefined) db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('pix_cidade', ?)").run((pix_cidade || '').trim());
  if (cupom_aniversario !== undefined) db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('cupom_aniversario', ?)").run((cupom_aniversario || '').trim().toUpperCase());
  if (meta_faturamento_mes !== undefined) db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('meta_faturamento_mes', ?)").run(String(Number(meta_faturamento_mes) || 0));
  // Retirada (cliente busca no balcão)
  const { retirada_ativa, endereco_loja } = req.body;
  if (retirada_ativa !== undefined) db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('retirada_ativa', ?)").run(retirada_ativa ? '1' : '0');
  if (endereco_loja !== undefined) db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('endereco_loja', ?)").run((endereco_loja || '').trim());
  // Tráfego pago — pixels de conversão
  const { meta_pixel_id, ga_id } = req.body;
  if (meta_pixel_id !== undefined) db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('meta_pixel_id', ?)").run((meta_pixel_id || '').replace(/\D/g, ''));
  if (ga_id !== undefined) db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('ga_id', ?)").run((ga_id || '').trim());
  // Numeração da comanda:
  //  - comanda_modo='auto'  → apaga o contador (volta a reiniciar por dia)
  //  - comanda_proximo=N    → modo manual, próxima comanda será N
  const { comanda_modo, comanda_proximo } = req.body;
  if (comanda_modo === 'auto') {
    db.prepare("DELETE FROM config WHERE chave='comanda_proximo'").run();
  } else if (comanda_proximo !== undefined && comanda_proximo !== null && String(comanda_proximo).trim() !== '') {
    const n = Math.max(0, parseInt(comanda_proximo, 10) || 0);
    db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('comanda_proximo', ?)").run(String(Math.max(1, n || 1)));
  }
  res.json({ ok: true });
});

// POST /api/cardapio/fechar-temp — admin, fecha loja temporariamente
router.post('/fechar-temp', requireAuth, (req, res) => {
  const { minutos } = req.body;
  if (!minutos || minutos <= 0) return res.status(400).json({ erro: 'Informe os minutos' });
  const ate = new Date(Date.now() + minutos * 60 * 1000);
  db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)").run('fechamento_temp_ate', ate.toISOString());
  res.json({ ok: true, ate: ate.toISOString() });
});

// DELETE /api/cardapio/fechar-temp — admin, cancela fechamento temp
router.delete('/fechar-temp', requireAuth, (req, res) => {
  db.prepare("DELETE FROM config WHERE chave = 'fechamento_temp_ate'").run();
  res.json({ ok: true });
});

// GET /api/cardapio/horario — público
router.get('/horario', (req, res) => {
  const status = lojaAberta();
  const horario = getHorario();
  const msg = db.prepare("SELECT valor FROM config WHERE chave = 'mensagem_fechado'").get();
  res.json({ ...status, horario, mensagem_fechado: msg?.valor || '' });
});

// PUT /api/cardapio/horario — admin
router.put('/horario', requireAuth, (req, res) => {
  const { horario, mensagem_fechado } = req.body;
  if (horario) db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)").run('horario', JSON.stringify(horario));
  if (mensagem_fechado !== undefined) db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)").run('mensagem_fechado', mensagem_fechado);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════
// ── CUPONS DE DESCONTO ────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

// GET /api/cardapio/cupom-ativo — público, retorna o cupom ativo mais recente (para auto-exibir no cardápio)
router.get('/cupom-ativo', (req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const cupom = db.prepare(`
    SELECT id, codigo, descricao, tipo, valor, minimo
    FROM cupons
    WHERE ativo = 1
      AND (validade IS NULL OR validade >= ?)
      AND (usos_maximos = 0 OR usos_atuais < usos_maximos)
    ORDER BY created_at DESC LIMIT 1
  `).get(hoje);
  if (!cupom) return res.json(null);
  res.json(cupom);
});

// GET /api/cardapio/cupom/:codigo — público, valida cupom
router.get('/cupom/:codigo', (req, res) => {
  const cupom = db.prepare('SELECT * FROM cupons WHERE UPPER(codigo) = UPPER(?) AND ativo = 1').get(req.params.codigo.trim());
  if (!cupom) return res.status(404).json({ erro: 'Cupom inválido ou expirado' });
  if (cupom.usos_maximos > 0 && cupom.usos_atuais >= cupom.usos_maximos)
    return res.status(400).json({ erro: 'Cupom esgotado' });
  if (cupom.validade && new Date(cupom.validade + 'T23:59:59') < new Date())
    return res.status(400).json({ erro: 'Cupom expirado' });
  res.json({ id: cupom.id, codigo: cupom.codigo, descricao: cupom.descricao, tipo: cupom.tipo, valor: cupom.valor, minimo: cupom.minimo });
});

// GET /api/cardapio/cupons — admin, lista todos
router.get('/cupons', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM cupons ORDER BY created_at DESC').all());
});

// POST /api/cardapio/cupons — admin, cria cupom
router.post('/cupons', requireAuth, (req, res) => {
  const { codigo, descricao, tipo, valor, minimo, usos_maximos, validade } = req.body;
  if (!codigo?.trim()) return res.status(400).json({ erro: 'Código é obrigatório' });
  if (!['percentual','fixo'].includes(tipo)) return res.status(400).json({ erro: 'tipo deve ser percentual ou fixo' });
  if (!valor || valor <= 0) return res.status(400).json({ erro: 'Valor inválido' });
  try {
    const { lastInsertRowid } = db.prepare(
      'INSERT INTO cupons (codigo,descricao,tipo,valor,minimo,usos_maximos,validade) VALUES (?,?,?,?,?,?,?)'
    ).run(codigo.trim().toUpperCase(), descricao||null, tipo, Number(valor), Number(minimo||0), Number(usos_maximos||0), validade||null);
    res.status(201).json(db.prepare('SELECT * FROM cupons WHERE id = ?').get(lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ erro: 'Código já existe' });
    res.status(500).json({ erro: e.message });
  }
});

// PATCH /api/cardapio/cupons/:id — admin, edita/ativa/desativa
router.patch('/cupons/:id', requireAuth, (req, res) => {
  const { ativo, descricao, valor, minimo, usos_maximos, validade } = req.body;
  db.prepare(`UPDATE cupons SET
    ativo = COALESCE(?,ativo), descricao = COALESCE(?,descricao),
    valor = COALESCE(?,valor), minimo = COALESCE(?,minimo),
    usos_maximos = COALESCE(?,usos_maximos), validade = COALESCE(?,validade)
    WHERE id = ?
  `).run(ativo !== undefined ? (ativo?1:0) : null, descricao??null, valor??null, minimo??null, usos_maximos??null, validade??null, req.params.id);
  res.json(db.prepare('SELECT * FROM cupons WHERE id = ?').get(req.params.id));
});

// DELETE /api/cardapio/cupons/:id
router.delete('/cupons/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM cupons WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════
// ── RASTREIO DO PEDIDO (público) ──────────────────────────────
// ══════════════════════════════════════════════════════════════

router.get('/pedido/:id/rastreio', (req, res) => {
  const pedido = db.prepare('SELECT * FROM pdv_pedidos WHERE id = ?').get(req.params.id);
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
  const itens = db.prepare('SELECT * FROM pdv_itens WHERE pedido_id = ? ORDER BY id').all(pedido.id);
  // Remove dados sensíveis
  const { ...pub } = pedido;
  delete pub.cliente_endereco;
  res.json({ ...pub, itens });
});

// ── GET /cardapio/banners — banners públicos ──────────────────
router.get('/banners', (req, res) => {
  try {
    const rows = db.prepare(
      `SELECT * FROM banners_promocao WHERE ativo=1 ORDER BY ordem ASC, id ASC`
    ).all();
    res.json(rows);
  } catch {
    res.json([]); // tabela ainda não existe, retorna vazio
  }
});

module.exports = router;
