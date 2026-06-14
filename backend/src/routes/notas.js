const { Router } = require('express');
const db = require('../db/database');

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS notas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    texto TEXT NOT NULL,
    cor TEXT NOT NULL DEFAULT 'amarelo',
    fixada INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT * FROM notas ORDER BY fixada DESC, created_at DESC
  `).all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { texto, cor } = req.body;
  if (!texto?.trim()) return res.status(400).json({ erro: 'texto obrigatório' });
  const r = db.prepare(
    'INSERT INTO notas (texto, cor) VALUES (?, ?)'
  ).run(texto.trim(), cor || 'amarelo');
  res.status(201).json({ id: r.lastInsertRowid });
});

router.patch('/:id/fixar', (req, res) => {
  const { fixada } = req.body;
  db.prepare('UPDATE notas SET fixada=? WHERE id=?').run(fixada ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.patch('/:id/cor', (req, res) => {
  const { cor } = req.body;
  db.prepare('UPDATE notas SET cor=? WHERE id=?').run(cor, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM notas WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
