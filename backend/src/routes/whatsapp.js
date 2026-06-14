const { Router } = require('express');
const wa = require('../services/whatsapp');

const router = Router();

// GET /api/whatsapp/status — estado atual
router.get('/status', (req, res) => {
  res.json(wa.getStatus());
});

// GET /api/whatsapp/sse — stream SSE com QR e status
router.get('/sse', wa.sseStatus);

// POST /api/whatsapp/conectar — inicia cliente
router.post('/conectar', (req, res) => {
  wa.iniciar();
  res.json({ ok: true });
});

// POST /api/whatsapp/desconectar
router.post('/desconectar', async (req, res) => {
  await wa.desconectar();
  res.json({ ok: true });
});

// POST /api/whatsapp/resetar-sessao — apaga sessão e força novo QR
router.post('/resetar-sessao', async (req, res) => {
  await wa.resetarSessao();
  res.json({ ok: true });
});

module.exports = router;
