const { Router } = require('express');
const db = require('../db/database');

const router = Router();

router.get('/', (req, res) => {
  try {
    const { mes } = req.query;
    let query = 'SELECT * FROM despesas';
    const params = [];
    if (mes) {
      // data_competencia pode estar salva como "2026-06" ou "2026-06-01"
      query += " WHERE substr(data_competencia, 1, 7) = ?";
      params.push(mes);
    }
    query += ' ORDER BY data_competencia DESC';
    res.json(db.prepare(query).all(...params));
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

router.post('/', (req, res) => {
  const { descricao, categoria, tipo, valor, data_competencia, recorrente } = req.body;
  if (!descricao || !categoria || !valor || !data_competencia) {
    return res.status(400).json({ erro: 'descricao, categoria, valor e data_competencia obrigatórios' });
  }
  const r = db.prepare(
    'INSERT INTO despesas (descricao, categoria, tipo, valor, data_competencia, recorrente) VALUES (?,?,?,?,?,?)'
  ).run(descricao, categoria, tipo || '', valor, data_competencia, recorrente ? 1 : 0);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/:id', (req, res) => {
  const { descricao, categoria, tipo, valor, data_competencia, recorrente } = req.body;
  const r = db.prepare(
    'UPDATE despesas SET descricao=?, categoria=?, tipo=?, valor=?, data_competencia=?, recorrente=? WHERE id=?'
  ).run(descricao, categoria, tipo || '', valor, data_competencia, recorrente ? 1 : 0, req.params.id);
  if (!r.changes) return res.status(404).json({ erro: 'Despesa não encontrada' });
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM despesas WHERE id=?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ erro: 'Despesa não encontrada' });
  res.json({ ok: true });
});

module.exports = router;
