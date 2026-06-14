const { Router } = require('express');
const db = require('../db/database');
const router = Router();

// ── Migrações ─────────────────────────────────────────────────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS unidades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      cidade TEXT,
      ativo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
  // Inserir unidades padrão se não existirem
  const qtd = db.prepare('SELECT COUNT(*) as n FROM unidades').get().n;
  if (qtd === 0) {
    db.prepare("INSERT INTO unidades (nome, cidade) VALUES (?, ?)").run('37 Sushi Cianorte', 'Cianorte - PR');
    db.prepare("INSERT INTO unidades (nome, cidade) VALUES (?, ?)").run('37 Sushi Paranavaí', 'Paranavaí - PR');
  }
} catch (e) { console.error('unidades migration:', e.message); }

// Adiciona unidade_id nas tabelas principais
['pdv_pedidos', 'despesas', 'boletos', 'ingredientes'].forEach(tabela => {
  try { db.exec(`ALTER TABLE ${tabela} ADD COLUMN unidade_id INTEGER DEFAULT 1`); } catch {}
});

// GET /api/unidades
router.get('/', (req, res) => {
  const unidades = db.prepare('SELECT * FROM unidades WHERE ativo = 1 ORDER BY id').all();
  res.json(unidades);
});

// GET /api/unidades/:id/stats — resumo rápido por unidade
router.get('/:id/stats', (req, res) => {
  const id = req.params.id;
  try {
    const vendasHoje = db.prepare(`
      SELECT COUNT(*) as pedidos, COALESCE(SUM(total),0) as faturamento
      FROM pdv_pedidos WHERE DATE(created_at) = DATE('now')
      AND status != 'cancelado' AND unidade_id = ?
    `).get(id);

    const estoqueCritico = db.prepare(`
      SELECT COUNT(*) as n FROM ingredientes
      WHERE estoque_atual <= estoque_minimo AND estoque_minimo > 0 AND unidade_id = ?
    `).get(id);

    const pedidosAtivos = db.prepare(`
      SELECT COUNT(*) as n FROM pdv_pedidos
      WHERE status IN ('novo','preparando','pronto') AND unidade_id = ?
    `).get(id);

    res.json({
      vendas_hoje: vendasHoje,
      estoque_critico: estoqueCritico.n,
      pedidos_ativos: pedidosAtivos.n,
    });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
