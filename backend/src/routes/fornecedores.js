// ═══════════════════════════════════════════════════════════════
// Fornecedores — comparador de preços de insumos por fornecedor.
// Cadastra fornecedores (com telefone p/ pedido no WhatsApp), itens de compra
// (já vem com os insumos clássicos do sushi) e o preço de cada item em cada
// fornecedor.
// ═══════════════════════════════════════════════════════════════
const { Router } = require('express');
const db = require('../db/database');
const router = Router();

function garantirTabelas() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS forn_fornecedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      telefone TEXT,
      observacao TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS forn_itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      unidade TEXT DEFAULT 'un',
      categoria TEXT DEFAULT 'Geral',
      ordem INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS forn_precos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id INTEGER NOT NULL REFERENCES forn_itens(id) ON DELETE CASCADE,
      fornecedor_id INTEGER NOT NULL REFERENCES forn_fornecedores(id) ON DELETE CASCADE,
      preco REAL NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(item_id, fornecedor_id)
    );
  `);
}

// Insumos clássicos do sushi — toda conta já nasce com a lista pronta.
const ITENS_PADRAO = [
  // Pescados
  { nome: 'Salmão', unidade: 'kg', categoria: 'Pescados' },
  { nome: 'Kani', unidade: 'kg', categoria: 'Pescados' },
  { nome: 'Atum', unidade: 'kg', categoria: 'Pescados' },
  { nome: 'Camarão', unidade: 'kg', categoria: 'Pescados' },
  { nome: 'Ovas (Masago)', unidade: 'kg', categoria: 'Pescados' },
  // Laticínios
  { nome: 'Cream Cheese', unidade: 'kg', categoria: 'Laticínios' },
  { nome: 'Cream Cheese Kraft', unidade: 'kg', categoria: 'Laticínios' },
  // Grãos e secos
  { nome: 'Arroz', unidade: 'kg', categoria: 'Grãos e Secos' },
  { nome: 'Gergelim', unidade: 'kg', categoria: 'Grãos e Secos' },
  { nome: 'Panko', unidade: 'kg', categoria: 'Grãos e Secos' },
  { nome: 'Farinha de Trigo', unidade: 'kg', categoria: 'Grãos e Secos' },
  { nome: 'Açúcar', unidade: 'kg', categoria: 'Grãos e Secos' },
  { nome: 'Sal', unidade: 'kg', categoria: 'Grãos e Secos' },
  // Algas
  { nome: 'Nori (alga)', unidade: 'pct', categoria: 'Algas' },
  // Molhos e condimentos
  { nome: 'Vinagre de Arroz', unidade: 'L', categoria: 'Molhos e Condimentos' },
  { nome: 'Shoyu', unidade: 'L', categoria: 'Molhos e Condimentos' },
  { nome: 'Shoyu Sachê', unidade: 'cx', categoria: 'Molhos e Condimentos' },
  { nome: 'Molho Tarê', unidade: 'L', categoria: 'Molhos e Condimentos' },
  { nome: 'Wasabi', unidade: 'kg', categoria: 'Molhos e Condimentos' },
  { nome: 'Gengibre', unidade: 'kg', categoria: 'Molhos e Condimentos' },
  { nome: 'Hondashi', unidade: 'kg', categoria: 'Molhos e Condimentos' },
  { nome: 'Ajinomoto', unidade: 'kg', categoria: 'Molhos e Condimentos' },
  { nome: 'Saquê (Sakê)', unidade: 'L', categoria: 'Molhos e Condimentos' },
  { nome: 'Óleo', unidade: 'L', categoria: 'Molhos e Condimentos' },
  // Hortifrúti
  { nome: 'Cebolinha', unidade: 'maço', categoria: 'Hortifrúti' },
  { nome: 'Pepino', unidade: 'kg', categoria: 'Hortifrúti' },
  { nome: 'Manga', unidade: 'kg', categoria: 'Hortifrúti' },
  { nome: 'Abacate', unidade: 'kg', categoria: 'Hortifrúti' },
  { nome: 'Cenoura', unidade: 'kg', categoria: 'Hortifrúti' },
  { nome: 'Alho Poró', unidade: 'kg', categoria: 'Hortifrúti' },
  { nome: 'Couve', unidade: 'maço', categoria: 'Hortifrúti' },
  { nome: 'Morango', unidade: 'kg', categoria: 'Hortifrúti' },
  { nome: 'Limão', unidade: 'kg', categoria: 'Hortifrúti' },
  // Embalagens
  { nome: 'Embalagem P', unidade: 'cx', categoria: 'Embalagens' },
  { nome: 'Embalagem M', unidade: 'cx', categoria: 'Embalagens' },
  { nome: 'Embalagem G', unidade: 'cx', categoria: 'Embalagens' },
  { nome: 'Embalagem Temaki', unidade: 'cx', categoria: 'Embalagens' },
  { nome: 'Embalagem Poke', unidade: 'cx', categoria: 'Embalagens' },
  { nome: 'Sacola', unidade: 'pct', categoria: 'Embalagens' },
  { nome: 'Filme PVC', unidade: 'un', categoria: 'Embalagens' },
  // Descartáveis
  { nome: 'Hashi', unidade: 'pct', categoria: 'Descartáveis' },
  { nome: 'Guardanapo', unidade: 'pct', categoria: 'Descartáveis' },
  { nome: 'Luva', unidade: 'cx', categoria: 'Descartáveis' },
  { nome: 'Papel Toalha', unidade: 'pct', categoria: 'Descartáveis' },
  // Doces
  { nome: 'Leite Condensado', unidade: 'un', categoria: 'Doces' },
  { nome: 'Chocolate / Nutella', unidade: 'kg', categoria: 'Doces' },
  { nome: 'Massa de Harumaki', unidade: 'pct', categoria: 'Doces' },
];

function seedItensPadrao() {
  const n = db.prepare('SELECT COUNT(*) AS n FROM forn_itens').get().n;
  if (n > 0) return;
  const ins = db.prepare('INSERT INTO forn_itens (nome, unidade, categoria, ordem) VALUES (?,?,?,?)');
  ITENS_PADRAO.forEach((it, i) => ins.run(it.nome, it.unidade, it.categoria, i));
}

// Garante tabelas + seed no banco do tenant a cada request (idempotente/barato).
router.use((req, res, next) => {
  try { garantirTabelas(); seedItensPadrao(); } catch (e) { console.error('[fornecedores] setup:', e.message); }
  next();
});

// ── Dados agregados (fornecedores + itens + preços) ──────────────
router.get('/dados', (req, res) => {
  try {
    res.json({
      fornecedores: db.prepare('SELECT * FROM forn_fornecedores ORDER BY nome').all(),
      itens: db.prepare('SELECT * FROM forn_itens ORDER BY ordem, categoria, nome').all(),
      precos: db.prepare('SELECT item_id, fornecedor_id, preco FROM forn_precos').all(),
    });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ── Fornecedores ─────────────────────────────────────────────────
router.post('/fornecedor', (req, res) => {
  try {
    const { nome, telefone, observacao } = req.body || {};
    if (!nome || !String(nome).trim()) return res.status(400).json({ erro: 'Nome é obrigatório' });
    const r = db.prepare('INSERT INTO forn_fornecedores (nome, telefone, observacao) VALUES (?,?,?)')
      .run(String(nome).trim(), (telefone || '').replace(/\D/g, '') || null, (observacao || '').trim() || null);
    res.status(201).json(db.prepare('SELECT * FROM forn_fornecedores WHERE id=?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.patch('/fornecedor/:id', (req, res) => {
  try {
    const { nome, telefone, observacao } = req.body || {};
    db.prepare(`UPDATE forn_fornecedores SET
      nome = COALESCE(?, nome),
      telefone = COALESCE(?, telefone),
      observacao = COALESCE(?, observacao) WHERE id=?`)
      .run(nome != null ? String(nome).trim() : null,
           telefone != null ? String(telefone).replace(/\D/g, '') : null,
           observacao != null ? String(observacao).trim() : null,
           req.params.id);
    res.json(db.prepare('SELECT * FROM forn_fornecedores WHERE id=?').get(req.params.id));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/fornecedor/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM forn_precos WHERE fornecedor_id=?').run(req.params.id);
    db.prepare('DELETE FROM forn_fornecedores WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ── Itens ────────────────────────────────────────────────────────
router.post('/item', (req, res) => {
  try {
    const { nome, unidade, categoria } = req.body || {};
    if (!nome || !String(nome).trim()) return res.status(400).json({ erro: 'Nome é obrigatório' });
    const ord = (db.prepare('SELECT MAX(ordem) AS m FROM forn_itens').get()?.m || 0) + 1;
    const r = db.prepare('INSERT INTO forn_itens (nome, unidade, categoria, ordem) VALUES (?,?,?,?)')
      .run(String(nome).trim(), (unidade || 'un').trim(), (categoria || 'Geral').trim(), ord);
    res.status(201).json(db.prepare('SELECT * FROM forn_itens WHERE id=?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.patch('/item/:id', (req, res) => {
  try {
    const { nome, unidade, categoria } = req.body || {};
    db.prepare(`UPDATE forn_itens SET
      nome = COALESCE(?, nome),
      unidade = COALESCE(?, unidade),
      categoria = COALESCE(?, categoria) WHERE id=?`)
      .run(nome != null ? String(nome).trim() : null,
           unidade != null ? String(unidade).trim() : null,
           categoria != null ? String(categoria).trim() : null,
           req.params.id);
    res.json(db.prepare('SELECT * FROM forn_itens WHERE id=?').get(req.params.id));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/item/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM forn_precos WHERE item_id=?').run(req.params.id);
    db.prepare('DELETE FROM forn_itens WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ── Preço (upsert item × fornecedor) ─────────────────────────────
router.put('/preco', (req, res) => {
  try {
    const { item_id, fornecedor_id, preco } = req.body || {};
    if (!item_id || !fornecedor_id) return res.status(400).json({ erro: 'item_id e fornecedor_id são obrigatórios' });
    const p = Number(String(preco).replace(',', '.')) || 0;
    if (p <= 0) {
      // preço zerado/limpo → remove o registro (célula vazia)
      db.prepare('DELETE FROM forn_precos WHERE item_id=? AND fornecedor_id=?').run(item_id, fornecedor_id);
      return res.json({ ok: true, removido: true });
    }
    db.prepare(`INSERT INTO forn_precos (item_id, fornecedor_id, preco, updated_at)
      VALUES (?,?,?,datetime('now'))
      ON CONFLICT(item_id, fornecedor_id) DO UPDATE SET preco=excluded.preco, updated_at=datetime('now')`)
      .run(item_id, fornecedor_id, p);
    res.json({ ok: true, preco: p });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
