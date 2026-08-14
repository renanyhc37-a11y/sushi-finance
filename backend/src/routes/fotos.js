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

// Processa um lote de arquivos já salvos pelo multer, convertendo cada um
// para ALTA_DIR e registrando no banco.
//
// Extraído do handler e com as deps injetadas por dois motivos:
//  1) testabilidade — dá pra testar sem multer/sharp/banco reais.
//  2) isolamento de falha — cada arquivo tem seu próprio try/catch, então um
//     arquivo com problema (ex.: erro no banco) não pode abortar o loop e
//     deixar os arquivos seguintes sem processar nem limpar o temporário.
async function processarLoteUploads(files, itemId, deps) {
  const { preservarAlta: pAlta, registrarFoto: rFoto, unlink } = deps;
  const salvas = [];
  const falhas = [];
  for (const f of files) {
    try {
      const alta = await pAlta(TMP_DIR, f.filename, ALTA_DIR);
      try { unlink(path.join(TMP_DIR, f.filename)); } catch {}
      if (!alta) { falhas.push(f.filename); continue; }
      rFoto({ arquivo: alta.arquivo, largura: alta.largura, altura: alta.altura, item_id: itemId });
      salvas.push(alta);
    } catch {
      falhas.push(f.filename);
      try { unlink(path.join(TMP_DIR, f.filename)); } catch {}
    }
  }
  return { salvas, falhas };
}

// POST /api/fotos/upload — vários arquivos de uma vez (campo "fotos")
router.post('/upload', (req, res) => {
  if (!upload) return res.status(503).json({ erro: 'Upload indisponível (multer não instalado)' });
  // O callback passado pro multer NÃO pode ser `async`: multer não espera a
  // Promise, então um throw dentro dele virava unhandled rejection — a
  // requisição ficava pendurada sem resposta. Aqui o callback é síncrono e
  // delega pro processamento assíncrono explicitamente com .then/.catch,
  // garantindo que uma resposta HTTP sempre é enviada.
  upload.array('fotos', 30)(req, res, (err) => {
    if (err) return res.status(400).json({ erro: err.message });
    if (!req.files?.length) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

    const itemId = req.body.item_id ? Number(req.body.item_id) : null;
    processarLoteUploads(req.files, itemId, { preservarAlta, registrarFoto, unlink: fs.unlinkSync })
      .then(({ salvas, falhas }) => {
        res.status(201).json({ salvas: salvas.length, fotos: salvas, falhas: falhas.length });
      })
      .catch((e) => {
        res.status(500).json({ erro: e.message });
      });
  });
});

// Resolve o novo item_id/hero a partir do estado atual da foto e do corpo do
// PATCH. Extraído do handler pra poder ser testado sem Express/banco reais —
// e porque a decisão "o que o hero deveria virar" é a parte com a regra de
// negócio de verdade; o handler só aplica o resultado em SQL.
//
// Invariante que isto garante: no máximo um hero por item, e nenhum hero
// numa foto sem item.
//
//  - hero explícito no corpo sempre vence.
//  - sem hero explícito, mas o item mudou: o hero antigo NÃO é carregado pro
//    item novo (que pode já ter o seu próprio hero) — vira 0.
//  - sem hero explícito e sem mudança de item: hero fica como estava.
//  - hero nunca fica 1 numa foto cujo item final é nulo.
function resolverAtualizacaoFoto(fotoAtual, body = {}) {
  const itemFornecido = Object.prototype.hasOwnProperty.call(body, 'item_id');
  const heroFornecido = Object.prototype.hasOwnProperty.call(body, 'hero');

  const novoItemId = itemFornecido ? (body.item_id || null) : fotoAtual.item_id;

  let novoHero;
  if (heroFornecido) {
    novoHero = body.hero && novoItemId ? 1 : 0;
  } else if (itemFornecido && novoItemId !== fotoAtual.item_id) {
    novoHero = 0;
  } else {
    novoHero = fotoAtual.hero ? 1 : 0;
  }

  return {
    itemFornecido,
    heroFornecido,
    novoItemId,
    novoHero,
    // Só precisa limpar hero de outras fotos quando esta vai ficar hero E
    // pertence a algum item.
    limparIrmaos: novoHero === 1 && !!novoItemId,
  };
}

// PATCH /api/fotos/:id — vincular item, marcar como principal, editar tags
router.patch('/:id', (req, res) => {
  const foto = db.prepare('SELECT * FROM fotos_banco WHERE id = ?').get(req.params.id);
  if (!foto) return res.status(404).json({ erro: 'Foto não encontrada' });

  const body = req.body || {};
  const { tags } = body;
  const { itemFornecido, heroFornecido, novoItemId, novoHero, limparIrmaos } = resolverAtualizacaoFoto(foto, body);

  if (itemFornecido) db.prepare('UPDATE fotos_banco SET item_id = ? WHERE id = ?').run(novoItemId, foto.id);
  if (tags !== undefined) db.prepare('UPDATE fotos_banco SET tags = ? WHERE id = ?').run(tags || null, foto.id);
  if (itemFornecido || heroFornecido) {
    // Só uma foto principal por item
    if (limparIrmaos) db.prepare('UPDATE fotos_banco SET hero = 0 WHERE item_id = ?').run(novoItemId);
    db.prepare('UPDATE fotos_banco SET hero = ? WHERE id = ?').run(novoHero, foto.id);
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

// Exportadas junto com o router (que é uma função/middleware Express — dá
// pra anexar propriedades nela normalmente) só para permitir testar a lógica
// de verdade sem precisar de multer/Express reais.
router.resolverAtualizacaoFoto = resolverAtualizacaoFoto;
router.processarLoteUploads = processarLoteUploads;

module.exports = router;
