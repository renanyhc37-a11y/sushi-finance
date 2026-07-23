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


// ── Lançar por FOTO (comprovante OU boleto) — reusa a lógica do assistente ──
// Fluxo em 2 passos pra ter preview antes de gravar:
//   POST /comprovante/analisar  (multipart 'foto') → lê com Vision, NÃO grava
//   POST /comprovante/confirmar (JSON { tipo, dados }) → grava despesa OU boleto
let uploadFoto;
try {
  const multer = require('multer');
  uploadFoto = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
} catch (e) { console.error('[despesas] multer indisponível:', e.message); }

const assistente = require('../services/assistenteDono');

router.post('/comprovante/analisar', (req, res) => {
  if (!uploadFoto) return res.status(503).json({ erro: 'Upload indisponível (multer não instalado).' });
  uploadFoto.single('foto')(req, res, async (err) => {
    if (err) return res.status(400).json({ erro: err.message });
    if (!req.file) return res.status(400).json({ erro: 'Nenhuma foto enviada.' });
    try {
      const base64 = req.file.buffer.toString('base64');
      const dados = await assistente.analisarImagem(base64, req.file.mimetype);
      if (!dados || !dados.tipo || dados.tipo === 'desconhecido' || !dados.valor) {
        return res.status(422).json({ erro: 'Não consegui ler essa foto. Tente uma imagem mais nítida do boleto ou do comprovante.' });
      }
      res.json(dados); // { tipo:'boleto'|'comprovante', ...campos, itens? }
    } catch (e) {
      console.error('[despesas/comprovante/analisar]', e.message);
      res.status(500).json({ erro: 'Falha ao analisar a foto.' });
    }
  });
});

router.post('/comprovante/confirmar', (req, res) => {
  try {
    const { tipo, dados } = req.body || {};
    if (!dados || !dados.valor) return res.status(400).json({ erro: 'Dados incompletos.' });
    if (tipo === 'boleto') {
      const ok = assistente.gravarBoleto(dados);
      return ok
        ? res.json({ ok: true, tipo: 'boleto', mensagem: 'Boleto registrado.' })
        : res.status(500).json({ erro: 'Não consegui gravar o boleto.' });
    }
    // comprovante → despesa + itens + auto-vínculo (aprendizado)
    const r = assistente.gravarDespesa(dados);
    if (!r.ok) return res.status(500).json({ erro: 'Não consegui gravar a despesa.' });
    res.json({ ok: true, tipo: 'despesa', itens: r.itens || 0, mensagem: 'Despesa registrada.' });
  } catch (e) {
    console.error('[despesas/comprovante/confirmar]', e.message);
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
