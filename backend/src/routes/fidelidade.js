const { Router } = require('express');
const db = require('../db/database');

const router = Router();

// ── Migração ──────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS fidelidade_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    item_id INTEGER,
    ativo INTEGER DEFAULT 1
  );
  INSERT OR IGNORE INTO fidelidade_config(id) VALUES(1);
`);

// Devolve a config + nome do item "vivo" (null se não configurado,
// excluído, ou indisponível). Reaproveitada por cardapio.js (rotas
// públicas do checkout) e pelas rotas admin abaixo.
function getConfigComItem() {
  const cfg = db.prepare('SELECT * FROM fidelidade_config WHERE id = 1').get();
  if (!cfg) return { id: 1, item_id: null, ativo: 1, item_nome: null };
  if (!cfg.item_id) return { ...cfg, item_nome: null };
  const item = db.prepare('SELECT nome, disponivel FROM cardapio_itens WHERE id = ?').get(cfg.item_id);
  return { ...cfg, item_nome: item && item.disponivel ? item.nome : null };
}

// GET /api/fidelidade/config
router.get('/config', (req, res) => res.json(getConfigComItem()));

// PUT /api/fidelidade/config
router.put('/config', (req, res) => {
  const { item_id, ativo } = req.body;
  db.prepare('UPDATE fidelidade_config SET item_id = ?, ativo = ? WHERE id = 1')
    .run(item_id != null ? Number(item_id) : null, ativo ? 1 : 0);
  res.json(getConfigComItem());
});

module.exports = router;
module.exports.getConfigComItem = getConfigComItem;
