const express = require('express');
const router = express.Router();
const db = require('../db/database');

const get = (k) => db.prepare('SELECT valor FROM config WHERE chave=?').get(k)?.valor;
const set = (k, v) => db.prepare('INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)').run(k, v);

// GET /api/setup/status
router.get('/status', (req, res) => {
  try {
  const concluido = get('setup_concluido') === '1';
  const totalIngredientes = db.prepare('SELECT COUNT(*) as n FROM ingredientes').get()?.n ?? 0;
  const totalItensCardapio = db.prepare('SELECT COUNT(*) as n FROM cardapio_itens WHERE disponivel=1').get()?.n ?? 0;
  let totalFichas = 0;
  try { totalFichas = db.prepare('SELECT COUNT(DISTINCT item_id) as n FROM cardapio_ficha_tecnica').get()?.n ?? 0; } catch {}
  const totalPedidos = db.prepare('SELECT COUNT(*) as n FROM pdv_pedidos').get()?.n ?? 0;

  res.json({
    concluido,
    totalIngredientes,
    totalItensCardapio,
    totalFichas,
    totalPedidos,
    checklist: {
      cardapio: totalItensCardapio > 0,
      fichas: totalFichas > 0,
      ingredientes: totalIngredientes > 0,
    },
  });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// POST /api/setup/estoque-inicial
// Body: [{ ingrediente_id, quantidade, preco_total }]
router.post('/estoque-inicial', (req, res) => {
  const itens = req.body;
  if (!Array.isArray(itens) || itens.length === 0) return res.status(400).json({ erro: 'Nenhum item informado' });

  const hoje = new Date().toISOString().slice(0, 10);

  const txn = db.transaction(() => {
    for (const { ingrediente_id, quantidade, preco_total } of itens) {
      if (!quantidade || quantidade <= 0) continue;
      const ing = db.prepare('SELECT * FROM ingredientes WHERE id=?').get(ingrediente_id);
      if (!ing) continue;

      const custo_unitario = preco_total > 0 ? preco_total / quantidade : ing.custo_unitario || 0;
      const novoEstoque = (ing.estoque_atual || 0) + quantidade;
      const estAtual = ing.estoque_atual || 0;
      const custoAtual = ing.custo_unitario || 0;
      const novoCusto = novoEstoque > 0
        ? (estAtual * custoAtual + quantidade * custo_unitario) / novoEstoque
        : custo_unitario;

      db.prepare(
        'INSERT INTO compras_ingredientes (ingrediente_id, data, quantidade, preco_total, custo_unitario) VALUES (?,?,?,?,?)'
      ).run(ingrediente_id, hoje, quantidade, preco_total || custo_unitario * quantidade, custo_unitario);

      db.prepare('UPDATE ingredientes SET custo_unitario=?, estoque_atual=? WHERE id=?')
        .run(novoCusto, novoEstoque, ingrediente_id);
    }
  });
  txn();

  res.json({ ok: true });
});

// POST /api/setup/saldo-abertura
// Body: { data_inicio, data_fim, total_bruto, pix, dinheiro, credito, debito, despesas_total, despesas_descricao }
router.post('/saldo-abertura', (req, res) => {
  const { data_inicio, data_fim, total_bruto, pix = 0, dinheiro = 0, credito = 0, debito = 0, despesas_total = 0, despesas_descricao } = req.body;

  if (!data_fim || !total_bruto) return res.status(400).json({ erro: 'data_fim e total_bruto obrigatórios' });

  if (total_bruto > 0) {
    // Verifica se já existe entrada nessa data
    const existe = db.prepare('SELECT id FROM faturamento_diario WHERE data=?').get(data_fim);
    if (existe) {
      db.prepare(`UPDATE faturamento_diario SET total_bruto=?, pix=?, dinheiro=?, credito=?, debito=?, observacao=? WHERE id=?`)
        .run(total_bruto, pix, dinheiro, credito, debito, `Saldo de abertura (${data_inicio || ''}–${data_fim})`, existe.id);
    } else {
      db.prepare(
        `INSERT INTO faturamento_diario (data, total_bruto, pix, dinheiro, credito, debito, taxa_cartao, observacao)
         VALUES (?,?,?,?,?,?,0,?)`
      ).run(data_fim, total_bruto, pix, dinheiro, credito, debito, `Saldo de abertura (${data_inicio || ''}–${data_fim})`);
    }
  }

  if (despesas_total > 0) {
    db.prepare(
      `INSERT INTO despesas (descricao, categoria, tipo, valor, data_competencia, recorrente)
       VALUES (?,?,?,?,?,0)`
    ).run(
      despesas_descricao || `Despesas anteriores à implantação (${data_inicio || ''}–${data_fim})`,
      'variavel',
      'Implantação',
      despesas_total,
      data_fim
    );
  }

  res.json({ ok: true });
});

// POST /api/setup/concluir
router.post('/concluir', (req, res) => {
  set('setup_concluido', '1');
  set('setup_data', new Date().toISOString());
  res.json({ ok: true });
});

// DELETE /api/setup/reiniciar (para refazer o setup)
router.delete('/reiniciar', (req, res) => {
  db.prepare("DELETE FROM config WHERE chave IN ('setup_concluido','setup_data')").run();
  res.json({ ok: true });
});

module.exports = router;
