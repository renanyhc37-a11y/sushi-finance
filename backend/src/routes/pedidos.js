const { Router } = require('express');
const db = require('../db/database');

const router = Router();

function custoAtualProduto(produto_id) {
  const itens = db.prepare(`
    SELECT ft.quantidade_usada, i.custo_unitario
    FROM ficha_tecnica ft JOIN ingredientes i ON i.id = ft.ingrediente_id
    WHERE ft.produto_id = ?
  `).all(produto_id);
  return itens.reduce((acc, it) => acc + it.quantidade_usada * it.custo_unitario, 0);
}

router.get('/', (req, res) => {
  const { mes } = req.query;
  let query = 'SELECT * FROM pedidos';
  const params = [];
  if (mes) {
    query += " WHERE strftime('%Y-%m', data) = ?";
    params.push(mes);
  }
  query += ' ORDER BY data DESC, id DESC';
  const pedidos = db.prepare(query).all(...params);

  const resultado = pedidos.map(p => {
    const itens = db.prepare(`
      SELECT ip.*, pr.nome as produto_nome
      FROM itens_pedido ip JOIN produtos pr ON pr.id = ip.produto_id
      WHERE ip.pedido_id = ?
    `).all(p.id);
    const custo_total = itens.reduce((acc, i) => acc + i.custo_unitario * i.quantidade, 0);
    return { ...p, itens, custo_total };
  });
  res.json(resultado);
});

router.post('/', (req, res) => {
  const { data, origem, observacao, itens } = req.body;
  if (!Array.isArray(itens) || !itens.length) return res.status(400).json({ erro: 'itens obrigatório' });

  const salvar = db.transaction(() => {
    const total_bruto = itens.reduce((acc, i) => acc + i.preco_unitario * i.quantidade, 0);
    const r = db.prepare(
      'INSERT INTO pedidos (data, origem, total_bruto, observacao) VALUES (?,?,?,?)'
    ).run(data || new Date().toISOString().slice(0,10), origem || 'manual', total_bruto, observacao || null);
    const pedido_id = r.lastInsertRowid;

    const ins = db.prepare(
      'INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario, custo_unitario) VALUES (?,?,?,?,?)'
    );
    for (const item of itens) {
      const custo = custoAtualProduto(item.produto_id);
      ins.run(pedido_id, item.produto_id, item.quantidade, item.preco_unitario, custo);
    }
    return { pedido_id, total_bruto };
  });

  const result = salvar();
  res.status(201).json(result);
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM pedidos WHERE id=?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ erro: 'Pedido não encontrado' });
  res.json({ ok: true });
});

module.exports = router;
