const { Router } = require('express');
const db = require('../db/database');

const router = Router();

// Migração da tabela
db.exec(`
  CREATE TABLE IF NOT EXISTS rendimento_salmao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL DEFAULT (date('now')),
    fornecedor TEXT,
    peso_bruto REAL NOT NULL,
    valor_total REAL NOT NULL,
    peso_liquido REAL NOT NULL,
    modo TEXT NOT NULL DEFAULT 'real' CHECK(modo IN ('real','estimativa')),
    percentual_estimado REAL,
    rendimento_pct REAL NOT NULL,
    perda_pct REAL NOT NULL,
    custo_kg_bruto REAL NOT NULL,
    custo_kg_limpo REAL NOT NULL,
    ingrediente_id INTEGER REFERENCES ingredientes(id) ON DELETE SET NULL,
    observacao TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// GET /api/rendimento — histórico paginado
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, i.nome as ingrediente_nome
    FROM rendimento_salmao r
    LEFT JOIN ingredientes i ON i.id = r.ingrediente_id
    ORDER BY r.data DESC, r.id DESC
    LIMIT 100
  `).all();
  res.json(rows);
});

// GET /api/rendimento/dashboard — estatísticas
router.get('/dashboard', (req, res) => {
  const trinta = db.prepare(`
    SELECT
      COUNT(*) as total_registros,
      AVG(rendimento_pct) as media_rendimento,
      MAX(rendimento_pct) as melhor_rendimento,
      MIN(rendimento_pct) as pior_rendimento,
      SUM(peso_liquido) as total_processado_kg,
      AVG(custo_kg_limpo) as custo_medio_kg_limpo
    FROM rendimento_salmao
    WHERE data >= date('now', '-30 days')
  `).get();

  const ultimo = db.prepare(`
    SELECT rendimento_pct, custo_kg_limpo, data, fornecedor
    FROM rendimento_salmao ORDER BY data DESC, id DESC LIMIT 1
  `).get();

  res.json({ ultimos30: trinta, ultimo });
});

// GET /api/rendimento/evolucao — agrupado por mês para gráfico
router.get('/evolucao', (req, res) => {
  const rows = db.prepare(`
    SELECT
      substr(data, 1, 7) as mes,
      COUNT(*) as registros,
      AVG(rendimento_pct) as media_rendimento,
      AVG(custo_kg_limpo) as media_custo_kg_limpo,
      SUM(peso_liquido) as total_kg_limpo
    FROM rendimento_salmao
    GROUP BY mes ORDER BY mes ASC
    LIMIT 12
  `).all();
  res.json(rows);
});

// POST /api/rendimento — registrar novo lote
router.post('/', (req, res) => {
  const {
    data, fornecedor, peso_bruto, valor_total, peso_liquido,
    modo, percentual_estimado, ingrediente_id, observacao,
  } = req.body;

  if (!peso_bruto || !valor_total || !peso_liquido) {
    return res.status(400).json({ erro: 'peso_bruto, valor_total e peso_liquido são obrigatórios' });
  }

  const rendimento_pct = (peso_liquido / peso_bruto) * 100;
  const perda_pct = 100 - rendimento_pct;
  const custo_kg_bruto = valor_total / peso_bruto;
  const custo_kg_limpo = valor_total / peso_liquido;

  const salvar = db.transaction(() => {
    const r = db.prepare(`
      INSERT INTO rendimento_salmao
        (data, fornecedor, peso_bruto, valor_total, peso_liquido, modo,
         percentual_estimado, rendimento_pct, perda_pct, custo_kg_bruto,
         custo_kg_limpo, ingrediente_id, observacao)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      data || new Date().toISOString().slice(0, 10),
      fornecedor || null, peso_bruto, valor_total, peso_liquido,
      modo || 'real', percentual_estimado || null,
      rendimento_pct, perda_pct, custo_kg_bruto, custo_kg_limpo,
      ingrediente_id || null, observacao || null,
    );

    // Atualiza custo do ingrediente vinculado
    if (ingrediente_id) {
      const ing = db.prepare('SELECT * FROM ingredientes WHERE id=?').get(ingrediente_id);
      if (ing) {
        // Custo real por unidade (ingrediente em g → converte de kg para g)
        const unidade = ing.unidade_medida;
        let custo_unit = custo_kg_limpo;
        if (unidade === 'g') custo_unit = custo_kg_limpo / 1000;

        // Registra na tabela de histórico de compras
        db.prepare(`
          INSERT INTO compras_ingredientes (ingrediente_id, data, quantidade, preco_total, custo_unitario)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          ingrediente_id,
          data || new Date().toISOString().slice(0, 10),
          unidade === 'g' ? peso_liquido * 1000 : peso_liquido,
          valor_total,
          custo_unit,
        );

        // Custo médio ponderado
        const qtdNova = unidade === 'g' ? peso_liquido * 1000 : peso_liquido;
        const novoEstoque = ing.estoque_atual + qtdNova;
        const novoCustoMedio = novoEstoque > 0
          ? (ing.estoque_atual * ing.custo_unitario + qtdNova * custo_unit) / novoEstoque
          : custo_unit;

        db.prepare('UPDATE ingredientes SET custo_unitario=?, estoque_atual=? WHERE id=?')
          .run(novoCustoMedio, novoEstoque, ingrediente_id);
      }
    }

    return r.lastInsertRowid;
  });

  const id = salvar();
  res.status(201).json({ id, rendimento_pct, perda_pct, custo_kg_bruto, custo_kg_limpo });
});

// PUT /api/rendimento/:id — editar um registro
// Recalcula os derivados (rendimento/perda/custo). NÃO reajusta o estoque do
// ingrediente retroativamente (o efeito do POST original permanece), para
// evitar dupla contagem; ajustes finos de estoque ficam para o módulo de
// estoque dedicado.
router.put('/:id', (req, res) => {
  const atual = db.prepare('SELECT * FROM rendimento_salmao WHERE id=?').get(req.params.id);
  if (!atual) return res.status(404).json({ erro: 'Registro não encontrado' });

  const {
    data, fornecedor, peso_bruto, valor_total, peso_liquido,
    modo, percentual_estimado, ingrediente_id, observacao,
  } = { ...atual, ...req.body };

  const pb = Number(peso_bruto), vt = Number(valor_total), pl = Number(peso_liquido);
  if (!pb || !vt || !pl || pb <= 0 || pl <= 0) {
    return res.status(400).json({ erro: 'peso_bruto, valor_total e peso_liquido inválidos' });
  }
  const rendimento_pct = (pl / pb) * 100;
  const perda_pct = 100 - rendimento_pct;
  const custo_kg_bruto = vt / pb;
  const custo_kg_limpo = vt / pl;

  db.prepare(`
    UPDATE rendimento_salmao SET
      data=?, fornecedor=?, peso_bruto=?, valor_total=?, peso_liquido=?,
      modo=?, percentual_estimado=?, rendimento_pct=?, perda_pct=?,
      custo_kg_bruto=?, custo_kg_limpo=?, ingrediente_id=?, observacao=?
    WHERE id=?
  `).run(
    data, fornecedor || null, pb, vt, pl,
    modo || 'real', percentual_estimado || null,
    rendimento_pct, perda_pct, custo_kg_bruto, custo_kg_limpo,
    ingrediente_id || null, observacao || null, req.params.id,
  );
  res.json({ ok: true, rendimento_pct, perda_pct, custo_kg_bruto, custo_kg_limpo });
});

// DELETE /api/rendimento/:id
router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM rendimento_salmao WHERE id=?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ erro: 'Registro não encontrado' });
  res.json({ ok: true });
});

module.exports = router;
