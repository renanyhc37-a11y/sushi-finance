const { Router } = require('express');
const db = require('../db/database');

const router = Router();

// ── Setup de tabelas ──────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS promocoes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nome        TEXT    NOT NULL,
    descricao   TEXT,
    tipo        TEXT    DEFAULT 'pedidos',   -- pedidos | valor
    meta        INTEGER DEFAULT 5,           -- ex: 5 pedidos para ganhar
    recompensa  TEXT,                        -- descrição do prêmio
    emoji       TEXT    DEFAULT '🎁',
    banner_id   INTEGER,
    ativo       INTEGER DEFAULT 1,
    created_at  TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS cliente_promocoes (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id             INTEGER NOT NULL,
    promocao_id            INTEGER NOT NULL,
    progresso              INTEGER DEFAULT 0,
    completado             INTEGER DEFAULT 0,
    completado_em          TEXT,
    recompensa_resgatada   INTEGER DEFAULT 0,
    recompensa_resgatada_em TEXT,
    created_at             TEXT    DEFAULT (datetime('now')),
    UNIQUE(cliente_id, promocao_id)
  );
`);

// ── Promoções ─────────────────────────────────────────────────

// GET /api/promocoes
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM cliente_promocoes cp WHERE cp.promocao_id = p.id) as inscritos,
      (SELECT COUNT(*) FROM cliente_promocoes cp WHERE cp.promocao_id = p.id AND cp.completado = 1) as completados,
      (SELECT COUNT(*) FROM cliente_promocoes cp WHERE cp.promocao_id = p.id AND cp.recompensa_resgatada = 1) as resgatados
    FROM promocoes p ORDER BY p.created_at DESC
  `).all();
  res.json(rows);
});

// POST /api/promocoes — criar promoção
router.post('/', (req, res) => {
  const { nome, descricao, tipo = 'pedidos', meta = 5, recompensa, emoji = '🎁', banner_id } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  const r = db.prepare(
    'INSERT INTO promocoes (nome, descricao, tipo, meta, recompensa, emoji, banner_id) VALUES (?,?,?,?,?,?,?)'
  ).run(nome, descricao || '', tipo, meta, recompensa || '', emoji, banner_id || null);
  res.json({ id: r.lastInsertRowid, ok: true });
});

// PATCH /api/promocoes/:id
router.patch('/:id', (req, res) => {
  const { nome, descricao, tipo, meta, recompensa, emoji, ativo } = req.body;
  const p = db.prepare('SELECT * FROM promocoes WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ erro: 'Promoção não encontrada' });
  db.prepare(`UPDATE promocoes SET
    nome       = COALESCE(?, nome),
    descricao  = COALESCE(?, descricao),
    tipo       = COALESCE(?, tipo),
    meta       = COALESCE(?, meta),
    recompensa = COALESCE(?, recompensa),
    emoji      = COALESCE(?, emoji),
    ativo      = COALESCE(?, ativo)
    WHERE id = ?
  `).run(nome ?? null, descricao ?? null, tipo ?? null, meta ?? null, recompensa ?? null, emoji ?? null, ativo ?? null, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/promocoes/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM cliente_promocoes WHERE promocao_id = ?').run(req.params.id);
  db.prepare('DELETE FROM promocoes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/promocoes/:id/participantes
router.get('/:id/participantes', (req, res) => {
  const rows = db.prepare(`
    SELECT cp.*, c.nome, c.telefone,
      p.meta, p.tipo, p.recompensa, p.emoji
    FROM cliente_promocoes cp
    JOIN clientes c ON c.id = cp.cliente_id
    JOIN promocoes p ON p.id = cp.promocao_id
    WHERE cp.promocao_id = ?
    ORDER BY cp.completado DESC, cp.progresso DESC
  `).all(req.params.id);
  res.json(rows);
});

// POST /api/promocoes/:id/inscrever/:clienteId — inscrição manual
router.post('/:id/inscrever/:clienteId', (req, res) => {
  const promo = db.prepare('SELECT * FROM promocoes WHERE id = ?').get(req.params.id);
  if (!promo) return res.status(404).json({ erro: 'Promoção não encontrada' });
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.clienteId);
  if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });
  try {
    db.prepare('INSERT OR IGNORE INTO cliente_promocoes (cliente_id, promocao_id) VALUES (?,?)').run(cliente.id, promo.id);
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ erro: e.message }); }
});

// POST /api/promocoes/progresso/:clienteTelefone — chamado internamente quando pedido é entregue
// Incrementa progresso em todas as promoções ativas do tipo 'pedidos'
function registrarPedidoEntregue(clienteTelefone) {
  if (!clienteTelefone) return;
  const cliente = db.prepare("SELECT * FROM clientes WHERE telefone = ?").get(clienteTelefone);
  if (!cliente) return;

  const promos = db.prepare("SELECT * FROM promocoes WHERE ativo = 1 AND tipo = 'pedidos'").all();
  for (const promo of promos) {
    // Inscreve automaticamente se ainda não está
    db.prepare('INSERT OR IGNORE INTO cliente_promocoes (cliente_id, promocao_id) VALUES (?,?)').run(cliente.id, promo.id);

    const cp = db.prepare('SELECT * FROM cliente_promocoes WHERE cliente_id = ? AND promocao_id = ?').get(cliente.id, promo.id);
    if (!cp || cp.recompensa_resgatada) continue; // já resgatou neste ciclo, não avança
    if (cp.completado && !cp.recompensa_resgatada) continue; // aguardando resgate

    const novoProgresso = (cp.progresso || 0) + 1;
    const completado = novoProgresso >= promo.meta ? 1 : 0;

    db.prepare(`UPDATE cliente_promocoes
      SET progresso = ?, completado = ?, completado_em = CASE WHEN ? = 1 THEN datetime('now') ELSE completado_em END
      WHERE cliente_id = ? AND promocao_id = ?
    `).run(novoProgresso, completado, completado, cliente.id, promo.id);
  }
}

// GET /api/promocoes/cliente/:clienteId — promoções de um cliente específico
router.get('/cliente/:clienteId', (req, res) => {
  const rows = db.prepare(`
    SELECT cp.*, p.nome, p.descricao, p.tipo, p.meta, p.recompensa, p.emoji, p.ativo
    FROM cliente_promocoes cp
    JOIN promocoes p ON p.id = cp.promocao_id
    WHERE cp.cliente_id = ?
    ORDER BY p.ativo DESC, cp.completado DESC, cp.progresso DESC
  `).all(req.params.clienteId);
  res.json(rows);
});

// POST /api/promocoes/resgatar/:clientePromoId — marcar recompensa como resgatada
router.post('/resgatar/:clientePromoId', (req, res) => {
  const cp = db.prepare('SELECT * FROM cliente_promocoes WHERE id = ?').get(req.params.clientePromoId);
  if (!cp) return res.status(404).json({ erro: 'Inscrição não encontrada' });
  if (!cp.completado) return res.status(400).json({ erro: 'Promoção ainda não completada' });
  if (cp.recompensa_resgatada) return res.status(400).json({ erro: 'Já resgatado' });

  // Resgata e reinicia o ciclo para promoções recorrentes
  db.prepare(`UPDATE cliente_promocoes
    SET recompensa_resgatada = 1, recompensa_resgatada_em = datetime('now'),
        progresso = 0, completado = 0, completado_em = NULL
    WHERE id = ?
  `).run(cp.id);
  res.json({ ok: true });
});

module.exports = { router, registrarPedidoEntregue };
