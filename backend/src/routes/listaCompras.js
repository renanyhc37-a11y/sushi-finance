const { Router } = require('express');
const db = require('../db/database');

const router = Router();

// Listar todos os itens
router.get('/', (req, res) => {
  const itens = db.prepare(`
    SELECT lc.*, i.nome as ingrediente_nome
    FROM lista_compras lc
    LEFT JOIN ingredientes i ON i.id = lc.ingrediente_id
    ORDER BY lc.comprado ASC, lc.created_at ASC
  `).all();
  res.json(itens);
});

// Sugestões: ingredientes com estoque <= 0 que não estão na lista
router.get('/sugestoes', (req, res) => {
  const sugestoes = db.prepare(`
    SELECT i.id, i.nome, i.unidade_medida, i.estoque_atual
    FROM ingredientes i
    WHERE i.estoque_atual <= 0
    AND i.id NOT IN (
      SELECT ingrediente_id FROM lista_compras
      WHERE ingrediente_id IS NOT NULL AND comprado = 0
    )
    ORDER BY i.nome
  `).all();
  res.json(sugestoes);
});

// Adicionar item
router.post('/', (req, res) => {
  const { nome, quantidade, unidade, ingrediente_id, observacao } = req.body;
  if (!nome) return res.status(400).json({ erro: 'nome obrigatório' });
  const r = db.prepare(
    'INSERT INTO lista_compras (nome, quantidade, unidade, ingrediente_id, observacao) VALUES (?,?,?,?,?)'
  ).run(nome, quantidade || 1, unidade || 'unidade', ingrediente_id || null, observacao || null);
  res.status(201).json({ id: r.lastInsertRowid });
});

// Marcar/desmarcar como comprado (com valor, quantidade e unidade opcionais)
router.patch('/:id/comprado', (req, res) => {
  const { comprado, valor_pago, qtd_comprada, unidade_comprada } = req.body;
  db.prepare(`UPDATE lista_compras
              SET comprado=?, valor_pago=?, qtd_comprada=?, unidade_comprada=?
              WHERE id=?`)
    .run(
      comprado ? 1 : 0,
      comprado && valor_pago ? Number(valor_pago) : null,
      comprado && qtd_comprada ? Number(qtd_comprada) : null,
      comprado && unidade_comprada ? unidade_comprada : null,
      req.params.id
    );

  // Atualiza último preço no catálogo
  if (comprado && valor_pago) {
    const item = db.prepare('SELECT nome, ingrediente_id FROM lista_compras WHERE id=?').get(req.params.id);
    if (item) {
      db.prepare(`UPDATE catalogo_compras SET ultimo_preco=?, ultimo_preco_em=date('now') WHERE lower(nome)=lower(?)`)
        .run(Number(valor_pago), item.nome);

      // Se vinculado a ingrediente, registra compra e atualiza custo
      if (item.ingrediente_id && qtd_comprada && valor_pago) {
        const ing = db.prepare('SELECT * FROM ingredientes WHERE id=?').get(item.ingrediente_id);
        if (ing) {
          const qtd = Number(qtd_comprada);
          const total = Number(valor_pago);
          const custo_unit = total / qtd;
          const novoEstoque = ing.estoque_atual + qtd;
          const novoCustoMedio = novoEstoque > 0
            ? (ing.estoque_atual * ing.custo_unitario + qtd * custo_unit) / novoEstoque
            : custo_unit;

          db.prepare(
            'INSERT INTO compras_ingredientes (ingrediente_id, data, quantidade, preco_total, custo_unitario) VALUES (?,date(\'now\'),?,?,?)'
          ).run(item.ingrediente_id, qtd, total, custo_unit);

          db.prepare(
            'UPDATE ingredientes SET custo_unitario=?, estoque_atual=? WHERE id=?'
          ).run(novoCustoMedio, novoEstoque, item.ingrediente_id);
        }
      }
    }
  }
  res.json({ ok: true });
});

// Editar item
router.put('/:id', (req, res) => {
  const { nome, quantidade, unidade, observacao } = req.body;
  db.prepare(
    'UPDATE lista_compras SET nome=?, quantidade=?, unidade=?, observacao=? WHERE id=?'
  ).run(nome, quantidade, unidade, observacao || null, req.params.id);
  res.json({ ok: true });
});

// Remover item
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM lista_compras WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Limpar itens comprados
router.delete('/comprados/limpar', (req, res) => {
  db.prepare('DELETE FROM lista_compras WHERE comprado=1').run();
  res.json({ ok: true });
});

/* ─── Catálogo ─── */

// Listar catálogo
router.get('/catalogo', (req, res) => {
  res.json(db.prepare('SELECT * FROM catalogo_compras ORDER BY nome').all());
});

// Salvar item no catálogo (a partir da lista ou manual)
router.post('/catalogo', (req, res) => {
  const { nome, quantidade, unidade, observacao } = req.body;
  if (!nome) return res.status(400).json({ erro: 'nome obrigatório' });
  // Evita duplicata por nome
  const existe = db.prepare('SELECT id FROM catalogo_compras WHERE lower(nome)=lower(?)').get(nome);
  if (existe) return res.status(409).json({ erro: 'Item já está no catálogo' });
  const r = db.prepare(
    'INSERT INTO catalogo_compras (nome, quantidade, unidade, observacao) VALUES (?,?,?,?)'
  ).run(nome, quantidade || 1, unidade || 'unidade', observacao || null);
  res.status(201).json({ id: r.lastInsertRowid });
});

// Editar item do catálogo
router.put('/catalogo/:id', (req, res) => {
  const { nome, quantidade, unidade, observacao } = req.body;
  db.prepare(
    'UPDATE catalogo_compras SET nome=?, quantidade=?, unidade=?, observacao=? WHERE id=?'
  ).run(nome, quantidade, unidade, observacao || null, req.params.id);
  res.json({ ok: true });
});

// Remover do catálogo
router.delete('/catalogo/:id', (req, res) => {
  db.prepare('DELETE FROM catalogo_compras WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Adicionar itens selecionados do catálogo à lista ativa
router.post('/catalogo/adicionar-lista', (req, res) => {
  const { ids } = req.body; // array de ids do catálogo
  if (!Array.isArray(ids) || !ids.length) return res.status(400).json({ erro: 'ids obrigatório' });
  const ins = db.prepare(
    'INSERT INTO lista_compras (nome, quantidade, unidade, observacao) VALUES (?,?,?,?)'
  );
  const adicionar = db.transaction(() => {
    for (const id of ids) {
      const item = db.prepare('SELECT * FROM catalogo_compras WHERE id=?').get(id);
      if (item) ins.run(item.nome, item.quantidade, item.unidade, item.observacao);
    }
  });
  adicionar();
  res.json({ ok: true });
});

module.exports = router;
