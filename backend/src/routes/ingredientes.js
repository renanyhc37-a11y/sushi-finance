const { Router } = require('express');
const db = require('../db/database');

const router = Router();

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT i.*,
      (SELECT COUNT(*) FROM compras_ingredientes WHERE ingrediente_id = i.id) as total_compras
    FROM ingredientes i ORDER BY i.nome
  `).all();
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const ing = db.prepare('SELECT * FROM ingredientes WHERE id = ?').get(req.params.id);
  if (!ing) return res.status(404).json({ erro: 'Ingrediente não encontrado' });
  const compras = db.prepare(
    'SELECT * FROM compras_ingredientes WHERE ingrediente_id = ? ORDER BY data DESC'
  ).all(ing.id);
  res.json({ ...ing, compras });
});

router.post('/', (req, res) => {
  const { nome, unidade_medida, fornecedor } = req.body;
  if (!nome || !unidade_medida) return res.status(400).json({ erro: 'nome e unidade_medida obrigatórios' });
  const result = db.prepare(
    'INSERT INTO ingredientes (nome, unidade_medida, fornecedor) VALUES (?, ?, ?)'
  ).run(nome, unidade_medida, fornecedor || null);
  res.status(201).json({ id: result.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { nome, unidade_medida, fornecedor } = req.body;
  const result = db.prepare(
    'UPDATE ingredientes SET nome=?, unidade_medida=?, fornecedor=? WHERE id=?'
  ).run(nome, unidade_medida, fornecedor || null, req.params.id);
  if (!result.changes) return res.status(404).json({ erro: 'Ingrediente não encontrado' });
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  try {
    // Verifica se está em uso em ficha técnica de produto ATIVO
    const emUso = db.prepare(`
      SELECT COUNT(*) as total FROM ficha_tecnica ft
      JOIN produtos p ON p.id = ft.produto_id
      WHERE ft.ingrediente_id=? AND p.ativo=1
    `).get(req.params.id);
    if (emUso.total > 0) {
      return res.status(400).json({ erro: `Este ingrediente está em uso em ${emUso.total} produto(s) ativo(s). Remova-o das fichas técnicas antes de excluir.` });
    }
    // Remove fichas de produtos inativos e compras antes de deletar
    db.prepare('DELETE FROM ficha_tecnica WHERE ingrediente_id=?').run(req.params.id);
    const result = db.prepare('DELETE FROM ingredientes WHERE id=?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ erro: 'Ingrediente não encontrado' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// Importação em lote
router.post('/importar', (req, res) => {
  const { itens } = req.body;
  if (!Array.isArray(itens) || !itens.length) return res.status(400).json({ erro: 'itens obrigatório' });
  const insert = db.prepare('INSERT OR IGNORE INTO ingredientes (nome, unidade_medida, fornecedor) VALUES (?,?,?)');
  const importar = db.transaction(() => {
    let criados = 0;
    for (const it of itens) {
      if (!it.nome || !it.unidade_medida) continue;
      const r = insert.run(it.nome, it.unidade_medida, it.fornecedor || null);
      criados += r.changes;
    }
    return criados;
  });
  const criados = importar();
  res.json({ criados, total: itens.length });
});

// Histórico de preços para gráfico
router.get('/:id/historico', (req, res) => {
  const compras = db.prepare(`
    SELECT data, custo_unitario, quantidade, preco_total
    FROM compras_ingredientes
    WHERE ingrediente_id = ?
    ORDER BY data ASC, id ASC
  `).all(req.params.id);

  if (!compras.length) return res.json({ compras: [], stats: null });

  const precos = compras.map(c => c.custo_unitario);
  const stats = {
    minimo: Math.min(...precos),
    maximo: Math.max(...precos),
    atual: precos[precos.length - 1],
    primeira_compra: compras[0].data,
    ultima_compra: compras[compras.length - 1].data,
    total_compras: compras.length,
    variacao_pct: precos[0] > 0
      ? ((precos[precos.length - 1] - precos[0]) / precos[0]) * 100
      : 0,
  };

  res.json({ compras, stats });
});

// Registrar nova compra e atualizar custo médio ponderado
router.post('/:id/compras', (req, res) => {
  const { data, quantidade, preco_total } = req.body;
  if (!quantidade || !preco_total) return res.status(400).json({ erro: 'quantidade e preco_total obrigatórios' });

  const ing = db.prepare('SELECT * FROM ingredientes WHERE id=?').get(req.params.id);
  if (!ing) return res.status(404).json({ erro: 'Ingrediente não encontrado' });

  const custo_unitario = preco_total / quantidade;
  const novoEstoque = ing.estoque_atual + quantidade;
  const novoCustoMedio = (ing.estoque_atual * ing.custo_unitario + quantidade * custo_unitario) / novoEstoque;

  const registrar = db.transaction(() => {
    db.prepare(
      'INSERT INTO compras_ingredientes (ingrediente_id, data, quantidade, preco_total, custo_unitario) VALUES (?,?,?,?,?)'
    ).run(ing.id, data || new Date().toISOString().slice(0, 10), quantidade, preco_total, custo_unitario);

    db.prepare(
      'UPDATE ingredientes SET custo_unitario=?, estoque_atual=? WHERE id=?'
    ).run(novoCustoMedio, novoEstoque, ing.id);
  });
  registrar();

  res.status(201).json({ custo_unitario: novoCustoMedio, estoque_atual: novoEstoque });
});

module.exports = router;
