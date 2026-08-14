const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const db = require('../db/database');
const { registrarFoto, listarFotos, catalogarExistentes, ALTA_DIR } = require('../services/bancoFotos');
const { preservarAlta } = require('../utils/otimizarImagem');

const router = Router();

// Diretório temporário do multer — o arquivo é convertido para ALTA_DIR e
// o temporário é descartado logo em seguida.
const TMP_DIR = path.join(__dirname, '..', '..', 'uploads', 'tmp');

let upload;
try {
  const multer = require('multer');
  if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
  const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/heic': '.heic', 'image/heif': '.heif' };
  const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, TMP_DIR),
    filename: (_, file, cb) => cb(null, `up_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${EXT[file.mimetype] || '.jpg'}`),
  });
  upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024, files: 30 },
    fileFilter: (_, file, cb) => cb(null, MIME_PERMITIDOS.includes(file.mimetype)),
  });
} catch {
  upload = null;
  console.warn('[fotos] multer não instalado — upload desativado.');
}

// GET /api/fotos?item_id=
router.get('/', (req, res) => {
  const item_id = req.query.item_id ? Number(req.query.item_id) : null;
  res.json(listarFotos({ item_id }));
});

// POST /api/fotos/upload — vários arquivos de uma vez (campo "fotos")
router.post('/upload', (req, res) => {
  if (!upload) return res.status(503).json({ erro: 'Upload indisponível (multer não instalado)' });
  upload.array('fotos', 30)(req, res, async (err) => {
    if (err) return res.status(400).json({ erro: err.message });
    if (!req.files?.length) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

    const itemId = req.body.item_id ? Number(req.body.item_id) : null;
    const salvas = [];
    for (const f of req.files) {
      const alta = await preservarAlta(TMP_DIR, f.filename, ALTA_DIR);
      try { fs.unlinkSync(path.join(TMP_DIR, f.filename)); } catch {}
      if (!alta) continue;
      registrarFoto({ arquivo: alta.arquivo, largura: alta.largura, altura: alta.altura, item_id: itemId });
      salvas.push(alta);
    }
    res.status(201).json({ salvas: salvas.length, fotos: salvas });
  });
});

// PATCH /api/fotos/:id — vincular item, marcar como principal, editar tags
router.patch('/:id', (req, res) => {
  const foto = db.prepare('SELECT * FROM fotos_banco WHERE id = ?').get(req.params.id);
  if (!foto) return res.status(404).json({ erro: 'Foto não encontrada' });

  const { item_id, hero, tags } = req.body || {};
  if (item_id !== undefined) db.prepare('UPDATE fotos_banco SET item_id = ? WHERE id = ?').run(item_id || null, foto.id);
  if (tags !== undefined) db.prepare('UPDATE fotos_banco SET tags = ? WHERE id = ?').run(tags || null, foto.id);
  if (hero !== undefined) {
    const alvo = item_id !== undefined ? (item_id || null) : foto.item_id;
    // Só uma foto principal por item
    if (hero && alvo) db.prepare('UPDATE fotos_banco SET hero = 0 WHERE item_id = ?').run(alvo);
    db.prepare('UPDATE fotos_banco SET hero = ? WHERE id = ?').run(hero ? 1 : 0, foto.id);
  }
  res.json(db.prepare('SELECT * FROM fotos_banco WHERE id = ?').get(foto.id));
});

// DELETE /api/fotos/:id
router.delete('/:id', (req, res) => {
  const foto = db.prepare('SELECT * FROM fotos_banco WHERE id = ?').get(req.params.id);
  if (!foto) return res.status(404).json({ erro: 'Foto não encontrada' });
  try { fs.unlinkSync(path.join(ALTA_DIR, foto.arquivo)); } catch {}
  db.prepare('DELETE FROM fotos_banco WHERE id = ?').run(foto.id);
  res.json({ ok: true });
});

// POST /api/fotos/catalogar — varre o disco e registra o que ainda não está no banco
router.post('/catalogar', async (_req, res) => {
  try { res.json(await catalogarExistentes()); }
  catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
