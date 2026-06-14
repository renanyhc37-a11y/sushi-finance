const { Router } = require('express');
const db = require('../db/database');

const router = Router();

/* ── helpers ── */
function calcTotal(itens) {
  return itens.reduce((acc, i) => acc + (i.quantidade * i.valor_unitario), 0);
}

function comItens(boleto) {
  const itens = db.prepare('SELECT * FROM boleto_itens WHERE boleto_id=? ORDER BY id').all(boleto.id);
  return { ...boleto, itens };
}

function atualizarStatus(id) {
  const b = db.prepare('SELECT status, data_vencimento FROM boletos WHERE id=?').get(id);
  if (!b || b.status === 'pago') return;
  const hoje = new Date().toISOString().slice(0, 10);
  if (b.data_vencimento < hoje) {
    db.prepare("UPDATE boletos SET status='vencido' WHERE id=?").run(id);
  }
}

/* ── GET / ── */
router.get('/', (req, res) => {
  const { status } = req.query;
  let boletos = status
    ? db.prepare('SELECT * FROM boletos WHERE status=? ORDER BY data_vencimento ASC').all(status)
    : db.prepare('SELECT * FROM boletos ORDER BY data_vencimento ASC').all();

  // Atualiza status vencido automaticamente
  const hoje = new Date().toISOString().slice(0, 10);
  boletos.forEach(b => {
    if (b.status === 'pendente' && b.data_vencimento < hoje) {
      db.prepare("UPDATE boletos SET status='vencido' WHERE id=?").run(b.id);
      b.status = 'vencido';
    }
  });

  res.json(boletos.map(comItens));
});

/* ── GET /:id ── */
router.get('/:id', (req, res) => {
  const b = db.prepare('SELECT * FROM boletos WHERE id=?').get(req.params.id);
  if (!b) return res.status(404).json({ erro: 'Boleto não encontrado' });
  res.json(comItens(b));
});

/* ── POST / ── */
router.post('/', (req, res) => {
  const { fornecedor, descricao, data_chegada, data_vencimento, itens = [] } = req.body;
  if (!fornecedor || !data_vencimento) {
    return res.status(400).json({ erro: 'fornecedor e data_vencimento obrigatórios' });
  }

  const valor_total = calcTotal(itens);

  const criar = db.transaction(() => {
    const r = db.prepare(
      `INSERT INTO boletos (fornecedor, descricao, valor_total, data_chegada, data_vencimento)
       VALUES (?,?,?,?,?)`
    ).run(fornecedor, descricao || null, valor_total,
      data_chegada || new Date().toISOString().slice(0, 10), data_vencimento);

    const bId = r.lastInsertRowid;
    const insItem = db.prepare(
      'INSERT INTO boleto_itens (boleto_id, descricao, quantidade, unidade, valor_unitario) VALUES (?,?,?,?,?)'
    );
    for (const item of itens) {
      insItem.run(bId, item.descricao, item.quantidade || 1, item.unidade || 'unidade', item.valor_unitario || 0);
    }
    return bId;
  });

  const id = criar();
  res.status(201).json({ id });
});

/* ── PUT /:id ── */
router.put('/:id', (req, res) => {
  const { fornecedor, descricao, data_chegada, data_vencimento, itens = [] } = req.body;
  const valor_total = calcTotal(itens);

  const atualizar = db.transaction(() => {
    db.prepare(
      `UPDATE boletos SET fornecedor=?, descricao=?, valor_total=?, data_chegada=?, data_vencimento=? WHERE id=?`
    ).run(fornecedor, descricao || null, valor_total, data_chegada, data_vencimento, req.params.id);

    db.prepare('DELETE FROM boleto_itens WHERE boleto_id=?').run(req.params.id);
    const insItem = db.prepare(
      'INSERT INTO boleto_itens (boleto_id, descricao, quantidade, unidade, valor_unitario) VALUES (?,?,?,?,?)'
    );
    for (const item of itens) {
      insItem.run(req.params.id, item.descricao, item.quantidade || 1, item.unidade || 'unidade', item.valor_unitario || 0);
    }
  });

  atualizar();
  res.json({ ok: true });
});

/* ── PATCH /:id/pagar — dar baixa e lançar nas despesas ── */
router.patch('/:id/pagar', (req, res) => {
  const { data_pagamento } = req.body;
  const b = db.prepare('SELECT * FROM boletos WHERE id=?').get(req.params.id);
  if (!b) return res.status(404).json({ erro: 'Boleto não encontrado' });
  if (b.status === 'pago') return res.status(400).json({ erro: 'Boleto já foi pago' });

  const hoje = data_pagamento || new Date().toISOString().slice(0, 10);

  const pagar = db.transaction(() => {
    // Cria despesa automaticamente
    const r = db.prepare(
      `INSERT INTO despesas (descricao, categoria, tipo, valor, data_competencia, recorrente)
       VALUES (?,?,?,?,?,0)`
    ).run(
      `Boleto — ${b.fornecedor}${b.descricao ? ': ' + b.descricao : ''}`,
      'variavel',
      'Fornecedor',
      b.valor_total,
      hoje
    );

    // Atualiza boleto como pago e vincula à despesa
    db.prepare(
      `UPDATE boletos SET status='pago', data_pagamento=?, despesa_id=? WHERE id=?`
    ).run(hoje, r.lastInsertRowid, b.id);

    return r.lastInsertRowid;
  });

  const despesa_id = pagar();
  res.json({ ok: true, despesa_id });
});

/* ── DELETE /:id ── */
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM boletos WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
