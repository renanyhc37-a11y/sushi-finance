const { Router } = require('express');
const db = require('../db/database');

const router = Router();

// Migração
try { db.exec('ALTER TABLE faturamento_diario ADD COLUMN quantidade_pedidos INTEGER DEFAULT 0'); } catch {}

router.get('/', (req, res) => {
  try {
    const { mes } = req.query;
    let query = 'SELECT * FROM faturamento_diario';
    const params = [];
    if (mes) {
      query += " WHERE substr(data, 1, 7) = ?";
      params.push(mes);
    }
    query += ' ORDER BY data DESC';
    res.json(db.prepare(query).all(...params));
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { data, total_bruto, pix = 0, dinheiro = 0, credito = 0, debito = 0, taxa_cartao = 0, observacao, quantidade_pedidos = 0 } = req.body;
    if (!data || !total_bruto) return res.status(400).json({ erro: 'data e total_bruto obrigatórios' });
    const r = db.prepare(`
      INSERT INTO faturamento_diario (data, total_bruto, pix, dinheiro, credito, debito, taxa_cartao, observacao, quantidade_pedidos)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).run(data, total_bruto, pix, dinheiro, credito, debito, taxa_cartao, observacao || null, Number(quantidade_pedidos));
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { data, total_bruto, pix = 0, dinheiro = 0, credito = 0, debito = 0, taxa_cartao = 0, observacao, quantidade_pedidos = 0 } = req.body;
    const r = db.prepare(`
      UPDATE faturamento_diario SET data=?, total_bruto=?, pix=?, dinheiro=?, credito=?, debito=?, taxa_cartao=?, observacao=?, quantidade_pedidos=?
      WHERE id=?
    `).run(data, total_bruto, pix, dinheiro, credito, debito, taxa_cartao, observacao || null, Number(quantidade_pedidos), req.params.id);
    if (!r.changes) return res.status(404).json({ erro: 'Registro não encontrado' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const r = db.prepare('DELETE FROM faturamento_diario WHERE id=?').run(req.params.id);
    if (!r.changes) return res.status(404).json({ erro: 'Registro não encontrado' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Agrega pedidos reais (pdv_pedidos) por dia, para exibição automática no faturamento
router.get('/pedidos-agrupados', (req, res) => {
  try {
    const { mes } = req.query; // YYYY-MM
    const param = mes ? `${mes}%` : `${new Date().toISOString().slice(0,7)}%`;

    const rows = db.prepare(`
      SELECT
        date(created_at, 'localtime') AS data,
        COUNT(*) AS quantidade_pedidos,
        COALESCE(SUM(total), 0) AS total_bruto,
        COALESCE(SUM(CASE WHEN forma_pagamento='pix'      THEN total ELSE 0 END), 0) AS pix,
        COALESCE(SUM(CASE WHEN forma_pagamento='dinheiro' THEN total ELSE 0 END), 0) AS dinheiro,
        COALESCE(SUM(CASE WHEN forma_pagamento='credito'  THEN total ELSE 0 END), 0) AS credito,
        COALESCE(SUM(CASE WHEN forma_pagamento='debito'   THEN total ELSE 0 END), 0) AS debito
      FROM pdv_pedidos
      WHERE status NOT IN ('cancelado')
        AND date(created_at, 'localtime') LIKE ?
      GROUP BY date(created_at, 'localtime')
      ORDER BY data DESC
    `).all(param);

    res.json(rows);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
