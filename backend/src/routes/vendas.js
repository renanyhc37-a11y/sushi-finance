const { Router } = require('express');
const db = require('../db/database');
const router = Router();

// Listar vendas por período
router.get('/', (req, res) => {
  const { mes, data } = req.query;
  let q = `
    SELECT vp.*, p.nome as produto_nome, p.preco_venda as preco_atual,
           c.nome as categoria
    FROM vendas_produto vp
    JOIN produtos p ON p.id = vp.produto_id
    LEFT JOIN categorias_produto c ON c.id = p.categoria_id
  `;
  const params = [];
  if (data) {
    q += ' WHERE vp.data = ?'; params.push(data);
  } else if (mes) {
    q += ' WHERE substr(vp.data,1,7) = ?'; params.push(mes);
  }
  q += ' ORDER BY vp.data DESC, vp.created_at DESC';
  res.json(db.prepare(q).all(...params));
});

// Ranking de produtos mais vendidos no mês
router.get('/ranking', (req, res) => {
  const { mes } = req.query;
  const filtro = mes ? 'WHERE substr(vp.data,1,7) = ?' : '';
  const params = mes ? [mes] : [];
  const rows = db.prepare(`
    SELECT p.id, p.nome, c.nome as categoria,
           SUM(vp.quantidade) as total_qtd,
           SUM(vp.quantidade * vp.preco_venda) as total_valor
    FROM vendas_produto vp
    JOIN produtos p ON p.id = vp.produto_id
    LEFT JOIN categorias_produto c ON c.id = p.categoria_id
    ${filtro}
    GROUP BY p.id
    ORDER BY total_qtd DESC
  `).all(...params);
  res.json(rows);
});

// Adicionar venda
router.post('/', (req, res) => {
  const { data, produto_id, quantidade, preco_venda } = req.body;
  if (!produto_id || !quantidade) return res.status(400).json({ erro: 'produto_id e quantidade obrigatórios' });

  // Pega o preço atual do produto se não informado
  let preco = preco_venda;
  if (!preco) {
    const p = db.prepare('SELECT preco_venda FROM produtos WHERE id=?').get(produto_id);
    preco = p?.preco_venda || 0;
  }

  const r = db.prepare(
    'INSERT INTO vendas_produto (data, produto_id, quantidade, preco_venda) VALUES (?,?,?,?)'
  ).run(data || new Date().toISOString().slice(0, 10), produto_id, quantidade, preco);
  res.status(201).json({ id: r.lastInsertRowid });
});

// Editar
router.put('/:id', (req, res) => {
  const { data, produto_id, quantidade, preco_venda } = req.body;
  db.prepare(
    'UPDATE vendas_produto SET data=?, produto_id=?, quantidade=?, preco_venda=? WHERE id=?'
  ).run(data, produto_id, quantidade, preco_venda, req.params.id);
  res.json({ ok: true });
});

// Deletar
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM vendas_produto WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
