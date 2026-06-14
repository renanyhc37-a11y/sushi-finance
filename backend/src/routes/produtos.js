const { Router } = require('express');
const db = require('../db/database');

const router = Router();

function calcularCustoProduto(produto_id) {
  const itens = db.prepare(`
    SELECT ft.quantidade_usada, i.custo_unitario, i.nome, i.unidade_medida
    FROM ficha_tecnica ft
    JOIN ingredientes i ON i.id = ft.ingrediente_id
    WHERE ft.produto_id = ?
  `).all(produto_id);
  const custo_total = itens.reduce((acc, it) => acc + it.quantidade_usada * it.custo_unitario, 0);
  const ingredientes = itens.map(it => ({
    nome: it.nome,
    unidade_medida: it.unidade_medida,
    quantidade_usada: it.quantidade_usada,
    custo_linha: parseFloat((it.quantidade_usada * it.custo_unitario).toFixed(4)),
  }));
  return { itens, custo_total, ingredientes };
}

router.get('/', (req, res) => {
  const produtos = db.prepare(`
    SELECT p.*, c.nome as categoria
    FROM produtos p
    LEFT JOIN categorias_produto c ON c.id = p.categoria_id
    WHERE p.ativo = 1
    ORDER BY p.nome
  `).all();

  const resultado = produtos.map(p => {
    const { custo_total, ingredientes } = calcularCustoProduto(p.id);
    const cmv = p.preco_venda > 0 ? (custo_total / p.preco_venda) * 100 : 0;
    return { ...p, custo_total, cmv: parseFloat(cmv.toFixed(2)), ingredientes };
  });
  res.json(resultado);
});

router.get('/categorias', (req, res) => {
  res.json(db.prepare('SELECT * FROM categorias_produto ORDER BY nome').all());
});

router.get('/:id', (req, res) => {
  const p = db.prepare(`
    SELECT p.*, c.nome as categoria
    FROM produtos p LEFT JOIN categorias_produto c ON c.id = p.categoria_id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!p) return res.status(404).json({ erro: 'Produto não encontrado' });
  const { itens, custo_total } = calcularCustoProduto(p.id);
  const cmv = p.preco_venda > 0 ? (custo_total / p.preco_venda) * 100 : 0;
  res.json({ ...p, ficha_tecnica: itens, custo_total, cmv: parseFloat(cmv.toFixed(2)) });
});

router.post('/', (req, res) => {
  const { nome, categoria_id, preco_venda, ficha_tecnica } = req.body;
  if (!nome || !preco_venda) return res.status(400).json({ erro: 'nome e preco_venda obrigatórios' });

  const criar = db.transaction(() => {
    const r = db.prepare(
      'INSERT INTO produtos (nome, categoria_id, preco_venda) VALUES (?,?,?)'
    ).run(nome, categoria_id || null, preco_venda);
    const produto_id = r.lastInsertRowid;

    if (Array.isArray(ficha_tecnica)) {
      const ins = db.prepare(
        'INSERT OR REPLACE INTO ficha_tecnica (produto_id, ingrediente_id, quantidade_usada) VALUES (?,?,?)'
      );
      for (const item of ficha_tecnica) {
        ins.run(produto_id, item.ingrediente_id, item.quantidade_usada);
      }
    }
    return produto_id;
  });

  const id = criar();
  res.status(201).json({ id });
});

router.put('/:id', (req, res) => {
  const { nome, categoria_id, preco_venda, ficha_tecnica } = req.body;

  const atualizar = db.transaction(() => {
    db.prepare(
      'UPDATE produtos SET nome=?, categoria_id=?, preco_venda=? WHERE id=?'
    ).run(nome, categoria_id || null, preco_venda, req.params.id);

    if (Array.isArray(ficha_tecnica)) {
      db.prepare('DELETE FROM ficha_tecnica WHERE produto_id=?').run(req.params.id);
      const ins = db.prepare(
        'INSERT INTO ficha_tecnica (produto_id, ingrediente_id, quantidade_usada) VALUES (?,?,?)'
      );
      for (const item of ficha_tecnica) {
        ins.run(req.params.id, item.ingrediente_id, item.quantidade_usada);
      }
    }
  });
  atualizar();
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  try {
    // Remove ficha técnica antes para liberar os ingredientes
    db.prepare('DELETE FROM ficha_tecnica WHERE produto_id=?').run(req.params.id);
    db.prepare('UPDATE produtos SET ativo=0 WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
