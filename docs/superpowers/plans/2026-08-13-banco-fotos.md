# Banco de Fotos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a fundação de imagens do Estúdio Criativo — preservar a foto em
alta resolução no upload (hoje o original é destruído), catalogar tudo num banco
de fotos consultável, e dar ao dono uma tela para subir e organizar fotos pelo PC
e pelo celular.

**Architecture:** O pipeline de upload passa a gravar **duas** saídas a partir do
mesmo arquivo: a versão de alta (2400px, para uso criativo) em
`backend/uploads/fotos/`, e a versão web de 900px (para o cardápio) exatamente
como hoje. Uma tabela `fotos_banco` registra a **resolução real** de cada foto —
dado que o Plano B usa para nunca ampliar uma imagem. Nenhum comportamento
atual do cardápio muda.

**Tech Stack:** Node 22 (servidor), Express, `node:sqlite`, `sharp` (já é
dependência), multer (já é dependência), React 18 + Vite.

## Global Constraints

- **Originais NUNCA em `frontend/public/`.** O Vite copia `public/` para `dist/`,
  então cada deploy passaria a carregar todas as fotos em alta (o tarball de
  deploy hoje tem 8,6 MB). Os originais vão para `backend/uploads/fotos/`, que
  fica fora do build. Há precedente no projeto: `backend/uploads/wa-media/`.
- **O cardápio não pode regredir.** A versão web continua 900px / qualidade 78 /
  WebP. Qualquer mudança no peso ou nas dimensões da imagem do cardápio é falha.
- **`otimizar()` não muda.** A preservação da alta é uma função **nova** chamada
  ANTES de `otimizar()` — que apaga o arquivo de origem. Manter `otimizar()`
  intacto elimina risco de regressão em qualquer outro chamador.
- Migrações incrementais em `backend/src/db/database.js`
  (`CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN`). **Nunca `DROP`.**
- Testes com `node:test`. **`npm test` roda `node --test` sem argumento de
  diretório** — passar `src` faz o Node resolver `src/index.js` como módulo,
  subir o servidor de verdade e travar em `EADDRINUSE`.
- Servidor roda **Node 22** (dev local é 24). Nada pode depender de API exclusiva
  do 24.
- Servir imagem para `<img>` precisa ser **rota pública** — tag `<img>` não envia
  header `Authorization`. Seguir o padrão de `/api/chat/media/:filename` em
  `index.js`, que usa `path.basename()` contra path traversal.
- O repositório tem **WIP pré-existente não relacionada** no working tree. Cada
  commit deve conter apenas os arquivos da sua task.

---

### Task 1: Preservar a foto em alta no upload

**Files:**
- Modify: `backend/src/utils/otimizarImagem.js`
- Modify: `backend/src/routes/cardapio.js` (config do multer e rota `POST /itens/:id/foto`)
- Test: `backend/src/utils/otimizarImagem.test.js`

**Interfaces:**
- Produces: `preservarAlta(dirOrigem, arquivo, dirDestino)` →
  `Promise<{ arquivo: string, largura: number, altura: number } | null>`
  (`null` se `sharp` não estiver disponível ou em caso de falha — nunca lança)
- Produces: constantes exportadas `MAX_LADO_ALTA = 2400`, `QUALIDADE_ALTA = 92`
- Consumes: `otimizar()` existente, que permanece inalterado

- [ ] **Step 1: Escrever o teste que falha**

Crie `backend/src/utils/otimizarImagem.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { preservarAlta, otimizar, MAX_LADO_ALTA } = require('./otimizarImagem');

// Cria uma imagem de teste real (3000x2000) num diretório temporário
async function criarImagem(dir, nome, largura, altura) {
  const caminho = path.join(dir, nome);
  await sharp({
    create: { width: largura, height: altura, channels: 3, background: { r: 200, g: 80, b: 40 } },
  }).jpeg().toFile(caminho);
  return caminho;
}

test('preservarAlta grava a versão de alta e devolve as dimensões reais', async () => {
  const origem = fs.mkdtempSync(path.join(os.tmpdir(), 'orig-'));
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'alta-'));
  await criarImagem(origem, 'foto.jpg', 3000, 2000);

  const r = await preservarAlta(origem, 'foto.jpg', destino);

  assert.ok(r, 'deveria devolver um resultado');
  assert.ok(fs.existsSync(path.join(destino, r.arquivo)), 'arquivo de alta deveria existir');
  // 3000x2000 reduzido para caber em 2400 → 2400x1600
  assert.equal(r.largura, 2400);
  assert.equal(r.altura, 1600);
});

test('preservarAlta NÃO amplia imagem menor que o limite', async () => {
  const origem = fs.mkdtempSync(path.join(os.tmpdir(), 'orig-'));
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'alta-'));
  await criarImagem(origem, 'pequena.jpg', 900, 900);

  const r = await preservarAlta(origem, 'pequena.jpg', destino);

  assert.equal(r.largura, 900, 'deveria manter 900, não ampliar para 2400');
  assert.equal(r.altura, 900);
});

test('preservarAlta não destrói o arquivo de origem (otimizar roda depois)', async () => {
  const origem = fs.mkdtempSync(path.join(os.tmpdir(), 'orig-'));
  const destino = fs.mkdtempSync(path.join(os.tmpdir(), 'alta-'));
  await criarImagem(origem, 'foto.jpg', 1500, 1500);

  await preservarAlta(origem, 'foto.jpg', destino);

  assert.ok(fs.existsSync(path.join(origem, 'foto.jpg')), 'o original ainda deve existir para otimizar()');
});

test('o cardápio não regride: otimizar continua produzindo no máximo 900px', async () => {
  const origem = fs.mkdtempSync(path.join(os.tmpdir(), 'orig-'));
  await criarImagem(origem, 'foto.jpg', 3000, 2000);

  const { arquivo } = await otimizar(origem, 'foto.jpg');
  const meta = await sharp(path.join(origem, arquivo)).metadata();

  assert.ok(meta.width <= 900, `largura ${meta.width} deveria ser <= 900`);
  assert.ok(meta.height <= 900, `altura ${meta.height} deveria ser <= 900`);
});

test('MAX_LADO_ALTA é 2400', () => {
  assert.equal(MAX_LADO_ALTA, 2400);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && node --test src/utils/otimizarImagem.test.js`
Expected: FAIL — `preservarAlta is not a function`

- [ ] **Step 3: Implementar `preservarAlta`**

Em `backend/src/utils/otimizarImagem.js`, adicione as constantes junto das
existentes (`MAX_LADO`/`QUALIDADE`) e a função nova antes do `module.exports`:

```js
// Versão de ALTA para uso criativo (posts/Stories). 2400px cobre um Story
// 1080×1920 com folga para cortes fechados, sem virar arquivo gigante.
// Vive separada da versão do cardápio: esta prioriza qualidade, aquela peso.
const MAX_LADO_ALTA = 2400;
const QUALIDADE_ALTA = 92;

/**
 * Grava uma cópia em alta resolução ANTES que `otimizar()` destrua o original.
 * Deve ser chamada primeiro — `otimizar()` apaga o arquivo de origem.
 *
 * @param {string} dirOrigem   Diretório onde o multer gravou o arquivo
 * @param {string} arquivo     Nome do arquivo gravado
 * @param {string} dirDestino  Diretório das fotos em alta
 * @returns {Promise<{arquivo:string,largura:number,altura:number}|null>}
 *          null se o sharp não estiver disponível ou em caso de falha.
 *          Nunca lança: falhar a preservação não pode derrubar o upload.
 */
async function preservarAlta(dirOrigem, arquivo, dirDestino) {
  if (!sharp) return null;
  const origem = path.join(dirOrigem, arquivo);
  const ext = path.extname(arquivo).toLowerCase();
  if (IGNORAR.includes(ext)) return null;

  try {
    if (!fs.existsSync(dirDestino)) fs.mkdirSync(dirDestino, { recursive: true });
    const nome = `${path.basename(arquivo, ext)}.webp`;
    const destino = path.join(dirDestino, nome);

    const info = await sharp(origem)
      .rotate() // respeita o EXIF do celular — sem isso a foto sai deitada
      .resize({ width: MAX_LADO_ALTA, height: MAX_LADO_ALTA, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: QUALIDADE_ALTA })
      .toFile(destino);

    return { arquivo: nome, largura: info.width, altura: info.height };
  } catch (err) {
    console.error('[imagem] falha ao preservar alta de', arquivo, '—', err.message);
    return null;
  }
}
```

Atualize o `module.exports` da última linha do arquivo:

```js
module.exports = { otimizar, preservarAlta, disponivel, MAX_LADO, QUALIDADE, MAX_LADO_ALTA, QUALIDADE_ALTA };
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && node --test src/utils/otimizarImagem.test.js`
Expected: PASS — 5/5 testes

- [ ] **Step 5: Ligar no upload do cardápio**

Em `backend/src/routes/cardapio.js`, altere o import da linha 9:

```js
const { otimizar, preservarAlta } = require('../utils/otimizarImagem');
```

Logo abaixo da constante `UPLOAD_DIR` (linha 14), adicione o diretório das
fotos em alta:

```js
// Fotos em ALTA para uso criativo. Fica em backend/uploads/ de propósito:
// frontend/public/ é copiado para dist/ pelo Vite, então guardar aqui evita
// inflar todo deploy com centenas de MB de foto.
const ORIGINAIS_DIR = path.join(__dirname, '..', '..', 'uploads', 'fotos');
```

Ainda em `cardapio.js`, aumente o limite do multer (linha 34) — foto de celular
moderno passa fácil de 10 MB:

```js
  upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 }, fileFilter });
```

Na rota `POST /itens/:id/foto`, insira a preservação **antes** da chamada a
`otimizar()` (que hoje está por volta da linha 476):

```js
    // ORDEM IMPORTA: preservarAlta precisa rodar antes de otimizar(), que
    // apaga o arquivo de origem.
    const alta = await preservarAlta(UPLOAD_DIR, req.file.filename, ORIGINAIS_DIR);

    // Comprime antes de publicar (1,6 MB → ~80 KB). Se o sharp não estiver
    // instalado, devolve o arquivo original e o upload segue normalmente.
    const { arquivo, antes, depois } = await otimizar(UPLOAD_DIR, req.file.filename);
```

E troque o `res.json` final da rota para devolver também os dados da alta:

```js
    res.json({
      foto: fotoUrl,
      alta: alta ? { arquivo: alta.arquivo, largura: alta.largura, altura: alta.altura } : null,
      item: db.prepare('SELECT * FROM cardapio_itens WHERE id = ?').get(req.params.id),
    });
```

- [ ] **Step 6: Verificar manualmente que as duas saídas são geradas**

Suba o backend (`cd backend && npm run dev`), abra o CardapioAdmin no navegador e
troque a foto de um item de teste usando uma imagem grande (>2000px).

Expected:
- `frontend/public/cardapio/` recebe o `.webp` de até 900px (como sempre)
- `backend/uploads/fotos/` recebe o `.webp` de até 2400px (novo)
- A resposta da API traz `alta: { largura, altura }` preenchido

Confira os dois arquivos:
```bash
cd backend && node -e "const s=require('sharp');const fs=require('fs');const d='uploads/fotos';const f=fs.readdirSync(d).pop();s(d+'/'+f).metadata().then(m=>console.log('ALTA:',f,m.width+'x'+m.height))"
```

- [ ] **Step 7: Rodar a suíte inteira e commitar**

Run: `cd backend && npm test`
Expected: PASS — 17/17 (12 existentes + 5 novos)

```bash
git add backend/src/utils/otimizarImagem.js backend/src/utils/otimizarImagem.test.js backend/src/routes/cardapio.js
git commit -m "feat(fotos): preserva versão em alta resolução no upload"
```

---

### Task 2: Tabela `fotos_banco` e catalogação do acervo existente

**Files:**
- Modify: `backend/src/db/database.js` (bloco de migração novo)
- Create: `backend/src/services/bancoFotos.js`
- Test: `backend/src/services/bancoFotos.test.js`

**Interfaces:**
- Consumes: nada das tasks anteriores (o serviço lê o disco e o banco)
- Produces:
  - `registrarFoto({ arquivo, arquivo_web, largura, altura, item_id, hero, tags })` → `{ id }`
  - `catalogarExistentes()` → `Promise<{ inseridas: number, ignoradas: number }>`
  - `listarFotos({ item_id, apenasHero })` → array de linhas de `fotos_banco`
  - `resolucaoSuficiente(foto, larguraAlvo, alturaAlvo)` → `boolean`
    (a base da "regra de ouro" que o Plano B vai consumir)

- [ ] **Step 1: Migração da tabela**

Em `backend/src/db/database.js`, logo após o bloco `notaFiscalIndiceUnico`
(que termina com `try { raw.exec(notaFiscalIndiceUnico); } catch(e) {...}`),
adicione:

```js
// ── Banco de fotos (Estúdio Criativo) ─────────────────────────
// largura/altura guardam a resolução REAL do arquivo em alta. É esse dado
// que permite nunca exibir uma foto ampliada num post.
const fotosBancoTabela = `
  CREATE TABLE IF NOT EXISTS fotos_banco (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    arquivo TEXT NOT NULL UNIQUE,
    arquivo_web TEXT,
    largura INTEGER NOT NULL DEFAULT 0,
    altura INTEGER NOT NULL DEFAULT 0,
    item_id INTEGER REFERENCES cardapio_itens(id) ON DELETE SET NULL,
    hero INTEGER NOT NULL DEFAULT 0,
    tags TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_fotos_banco_item ON fotos_banco(item_id);
`;
try { raw.exec(fotosBancoTabela); } catch(e) { console.error('fotosBancoTabela migration:', e.message); }
```

- [ ] **Step 2: Escrever o teste que falha**

Crie `backend/src/services/bancoFotos.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolucaoSuficiente } = require('./bancoFotos');

test('resolucaoSuficiente aceita foto igual ou maior que a área alvo', () => {
  assert.equal(resolucaoSuficiente({ largura: 900, altura: 900 }, 900, 900), true);
  assert.equal(resolucaoSuficiente({ largura: 2400, altura: 1600 }, 1080, 1080), true);
});

test('resolucaoSuficiente recusa foto menor que a área alvo (evita ampliar)', () => {
  assert.equal(resolucaoSuficiente({ largura: 675, altura: 900 }, 1080, 1920), false);
  assert.equal(resolucaoSuficiente({ largura: 900, altura: 900 }, 1080, 1080), false);
});

test('resolucaoSuficiente recusa foto sem dimensão registrada', () => {
  assert.equal(resolucaoSuficiente({ largura: 0, altura: 0 }, 100, 100), false);
  assert.equal(resolucaoSuficiente(null, 100, 100), false);
});
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd backend && node --test src/services/bancoFotos.test.js`
Expected: FAIL — `Cannot find module './bancoFotos'`

- [ ] **Step 4: Implementar o serviço**

Crie `backend/src/services/bancoFotos.js`:

```js
// ══════════════════════════════════════════════════════════════
//  Banco de fotos — catálogo das imagens disponíveis para criação
//
//  A coluna largura/altura guarda a resolução REAL do arquivo em alta.
//  É esse dado que sustenta a "regra de ouro" do Estúdio Criativo:
//  nunca exibir uma foto numa área maior do que ela tem — ampliar é o
//  que faz um post parecer amador.
// ══════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const db = require('../db/database');

let sharp = null;
try { sharp = require('sharp'); } catch { /* sem sharp, catalogação fica indisponível */ }

const ALTA_DIR = path.join(__dirname, '..', '..', 'uploads', 'fotos');
const WEB_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'cardapio');

function registrarFoto({ arquivo, arquivo_web = null, largura = 0, altura = 0, item_id = null, hero = 0, tags = null }) {
  const r = db.prepare(`
    INSERT INTO fotos_banco (arquivo, arquivo_web, largura, altura, item_id, hero, tags)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(arquivo) DO UPDATE SET
      largura = excluded.largura, altura = excluded.altura,
      arquivo_web = COALESCE(excluded.arquivo_web, fotos_banco.arquivo_web)
  `).run(arquivo, arquivo_web, largura, altura, item_id, hero ? 1 : 0, tags);
  return { id: r.lastInsertRowid };
}

function listarFotos({ item_id = null, apenasHero = false } = {}) {
  let q = 'SELECT * FROM fotos_banco WHERE 1=1';
  const p = [];
  if (item_id) { q += ' AND item_id = ?'; p.push(item_id); }
  if (apenasHero) q += ' AND hero = 1';
  q += ' ORDER BY hero DESC, id DESC';
  return db.prepare(q).all(...p);
}

// A regra de ouro: só serve se a foto cobre a área sem precisar ampliar.
function resolucaoSuficiente(foto, larguraAlvo, alturaAlvo) {
  if (!foto) return false;
  const l = Number(foto.largura || 0);
  const a = Number(foto.altura || 0);
  if (l <= 0 || a <= 0) return false;
  return l >= larguraAlvo && a >= alturaAlvo;
}

// Cataloga o acervo que já existe no disco. As fotos antigas só têm a versão
// web de 900px (o original foi destruído pelo otimizador antigo) — elas são
// registradas com a resolução real que têm, e a regra de ouro cuida do resto.
async function catalogarExistentes() {
  if (!sharp) return { inseridas: 0, ignoradas: 0 };
  let inseridas = 0, ignoradas = 0;

  const varrer = async (dir, ehAlta) => {
    if (!fs.existsSync(dir)) return;
    for (const nome of fs.readdirSync(dir)) {
      if (!/\.(webp|jpe?g|png)$/i.test(nome)) { ignoradas++; continue; }
      try {
        const meta = await sharp(path.join(dir, nome)).metadata();
        const item = db.prepare('SELECT id FROM cardapio_itens WHERE foto = ?').get(`/cardapio/${nome}`);
        registrarFoto({
          arquivo: nome,
          arquivo_web: ehAlta ? null : `/cardapio/${nome}`,
          largura: meta.width || 0,
          altura: meta.height || 0,
          item_id: item?.id || null,
          hero: item ? 1 : 0,
        });
        inseridas++;
      } catch { ignoradas++; }
    }
  };

  await varrer(ALTA_DIR, true);
  await varrer(WEB_DIR, false);
  return { inseridas, ignoradas };
}

module.exports = { registrarFoto, listarFotos, resolucaoSuficiente, catalogarExistentes, ALTA_DIR, WEB_DIR };
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd backend && node --test src/services/bancoFotos.test.js`
Expected: PASS — 3/3 testes

- [ ] **Step 6: Catalogar o acervo local e conferir**

Run:
```bash
cd backend && node -e "require('dotenv').config();require('./src/services/bancoFotos').catalogarExistentes().then(r=>console.log(r))"
```
Expected: imprime `{ inseridas: N, ignoradas: M }` com N > 0

Confira que a resolução real foi registrada:
```bash
cd backend && node -e "require('dotenv').config();const db=require('./src/db/database');console.table(db.prepare('SELECT arquivo,largura,altura,item_id,hero FROM fotos_banco LIMIT 5').all())"
```
Expected: dimensões reais preenchidas (não zeros)

- [ ] **Step 7: Commitar**

Run: `cd backend && npm test`
Expected: PASS — 20/20

```bash
git add backend/src/db/database.js backend/src/services/bancoFotos.js backend/src/services/bancoFotos.test.js
git commit -m "feat(fotos): tabela fotos_banco e catalogação do acervo existente"
```

---

### Task 3: API do banco de fotos

**Files:**
- Create: `backend/src/routes/fotos.js`
- Modify: `backend/src/index.js` (montar o router e servir os arquivos em alta)

**Interfaces:**
- Consumes: `registrarFoto`, `listarFotos`, `catalogarExistentes`, `ALTA_DIR` de
  `../services/bancoFotos` (Task 2); `preservarAlta` de `../utils/otimizarImagem`
  (Task 1)
- Produces:
  - `GET  /api/fotos` → lista (aceita `?item_id=`)
  - `POST /api/fotos/upload` → upload de múltiplos arquivos (campo `fotos`)
  - `PATCH /api/fotos/:id` → body `{ item_id?, hero?, tags? }`
  - `DELETE /api/fotos/:id`
  - `POST /api/fotos/catalogar` → dispara `catalogarExistentes()`
  - `GET  /api/fotos/arquivo/:filename` → serve o arquivo em alta (público)

- [ ] **Step 1: Criar o router**

Crie `backend/src/routes/fotos.js`:

```js
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
```

- [ ] **Step 2: Montar o router e servir os arquivos**

Em `backend/src/index.js`, junto da rota de mídia do WhatsApp (por volta da
linha 158, **antes** do `app.use('/api', requireAuth)`), adicione o servidor de
arquivos — precisa ser público porque tag `<img>` não envia JWT:

```js
// Fotos do banco de imagens — pública pelo mesmo motivo da mídia do WhatsApp:
// tag <img> não envia header Authorization. basename() barra path traversal.
app.get('/api/fotos/arquivo/:filename', (req, res) => {
  const p = require('path');
  const f = require('fs');
  const filename = p.basename(req.params.filename);
  const filepath = p.join(__dirname, '..', 'uploads', 'fotos', filename);
  if (!f.existsSync(filepath)) return res.status(404).send('Not found');
  res.sendFile(filepath);
});
```

E monte o router junto dos demais (na lista após `app.use('/api', requireAuth)`):

```js
app.use('/api/fotos', require('./routes/fotos'));
```

- [ ] **Step 3: Verificar a API com o servidor rodando**

Suba o backend (`cd backend && npm run dev`). Com um JWT válido:

```bash
curl -s http://localhost:3001/api/fotos -H "Authorization: Bearer SEU_JWT" | head -c 400
```
Expected: JSON com as fotos catalogadas na Task 2

```bash
curl -s -X POST http://localhost:3001/api/fotos/catalogar -H "Authorization: Bearer SEU_JWT"
```
Expected: `{"inseridas":N,"ignoradas":M}`

Teste o upload com uma imagem grande de verdade:
```bash
curl -s -X POST http://localhost:3001/api/fotos/upload -H "Authorization: Bearer SEU_JWT" -F "fotos=@/caminho/para/foto-grande.jpg"
```
Expected: `{"salvas":1,"fotos":[{"arquivo":"...webp","largura":2400,"altura":...}]}`

Confirme que o arquivo é servido: abra
`http://localhost:3001/api/fotos/arquivo/<arquivo devolvido acima>` no navegador.
Expected: a imagem aparece.

- [ ] **Step 4: Commitar**

```bash
git add backend/src/routes/fotos.js backend/src/index.js
git commit -m "feat(fotos): API do banco de fotos (listar, upload múltiplo, vincular, servir)"
```

---

### Task 4: Tela do Banco de Fotos

**Files:**
- Create: `frontend/src/pages/BancoFotos.jsx`
- Modify: `frontend/src/App.jsx` (rota)

**Interfaces:**
- Consumes: as rotas da Task 3

- [ ] **Step 1: Criar a página**

Crie `frontend/src/pages/BancoFotos.jsx`:

```jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { getToken } from '../hooks/useAuth';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });

// Um Story tem 1080×1920. Abaixo disso a foto não serve como imagem
// principal — só em composição menor. O aviso evita a descoberta tardia,
// olhando um post borrado.
const MIN_LARGURA_HERO = 1080;

export default function BancoFotos() {
  const [fotos, setFotos] = useState([]);
  const [itens, setItens] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const [rf, ri] = await Promise.all([
        fetch(`${BASE}/fotos`, { headers: authH() }),
        fetch(`${BASE}/cardapio/itens`, { headers: authH() }),
      ]);
      if (rf.ok) setFotos(await rf.json());
      if (ri.ok) setItens(await ri.json());
    } catch { toast.error('Erro ao carregar'); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function enviarArquivos(lista) {
    if (!lista?.length) return;
    setEnviando(true);
    const fd = new FormData();
    [...lista].forEach(f => fd.append('fotos', f));
    try {
      const r = await fetch(`${BASE}/fotos/upload`, { method: 'POST', headers: authH(), body: fd });
      const d = await r.json();
      if (!r.ok) { toast.error(d.erro || 'Erro no upload'); return; }
      const baixas = (d.fotos || []).filter(f => f.largura < MIN_LARGURA_HERO).length;
      toast.success(`${d.salvas} foto(s) enviada(s)`);
      if (baixas > 0) {
        toast(`${baixas} chegaram com resolução baixa — servem em composição pequena, mas não como foto principal.`, { duration: 7000 });
      }
      carregar();
    } catch { toast.error('Erro no upload'); }
    finally { setEnviando(false); if (inputRef.current) inputRef.current.value = ''; }
  }

  async function atualizar(id, campos) {
    try {
      const r = await fetch(`${BASE}/fotos/${id}`, {
        method: 'PATCH', headers: { ...authH(), 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      });
      if (!r.ok) { toast.error('Erro ao salvar'); return; }
      carregar();
    } catch { toast.error('Erro ao salvar'); }
  }

  async function excluir(id) {
    if (!confirm('Excluir esta foto do banco?')) return;
    try {
      await fetch(`${BASE}/fotos/${id}`, { method: 'DELETE', headers: authH() });
      carregar();
    } catch { toast.error('Erro ao excluir'); }
  }

  return (
    <div className="p-4 md:p-6">
      <Toaster position="top-right" />
      <h1 className="text-2xl font-black t-strong mb-1">Banco de Fotos</h1>
      <p className="text-sm t-dim mb-5">
        Suba as fotos em alta. As melhores viram imagem principal do item e alimentam os posts.
      </p>

      <label className="inline-flex items-center gap-2 px-4 py-3 rounded-xl font-black cursor-pointer mb-6"
        style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#2563eb' }}>
        {enviando ? 'Enviando...' : '📷 Adicionar fotos'}
        <input ref={inputRef} type="file" accept="image/*" multiple hidden disabled={enviando}
          onChange={e => enviarArquivos(e.target.files)} />
      </label>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
        {fotos.map(f => {
          const baixa = f.largura < MIN_LARGURA_HERO;
          return (
            <div key={f.id} className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
              <img src={`${BASE}/fotos/arquivo/${f.arquivo}`} alt="" loading="lazy"
                className="w-full object-cover" style={{ aspectRatio: '1/1' }} />
              <div className="p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold" style={{ color: baixa ? '#b45309' : 'var(--txt-dim)' }}>
                    {f.largura}×{f.altura}{baixa ? ' · baixa' : ''}
                  </span>
                  {f.hero === 1 && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(22,163,74,0.15)', color: '#15803d' }}>PRINCIPAL</span>
                  )}
                </div>

                <select value={f.item_id || ''} onChange={e => atualizar(f.id, { item_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full text-[11px] rounded-lg px-2 py-1.5 outline-none"
                  style={{ background: 'var(--space-elev-2)', color: 'var(--txt)', border: '1px solid var(--hairline)' }}>
                  <option value="">— sem item —</option>
                  {itens.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                </select>

                <div className="flex gap-1.5">
                  <button onClick={() => atualizar(f.id, { hero: f.hero ? 0 : 1 })} disabled={!f.item_id}
                    className="flex-1 text-[10px] font-black py-1.5 rounded-lg disabled:opacity-40"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
                    {f.hero ? 'Remover principal' : 'Tornar principal'}
                  </button>
                  <button onClick={() => excluir(f.id)}
                    className="px-2 text-[10px] font-black py-1.5 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>✕</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {fotos.length === 0 && (
        <p className="text-sm t-dim mt-8">Nenhuma foto ainda. Comece adicionando as dos seus carros-chefe.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Registrar a rota**

Em `frontend/src/App.jsx`, siga o padrão de import das outras páginas (o
projeto usa `React.lazy` para as rotas) e adicione a rota `/banco-fotos`
apontando para `BancoFotos`. Se o arquivo usar imports diretos em vez de lazy,
siga o estilo que já estiver lá — a regra é **não** introduzir um padrão novo.

- [ ] **Step 3: Verificar no navegador**

Suba backend e frontend (`npm run dev` em cada) e abra `/banco-fotos`.

Expected:
- As fotos catalogadas aparecem com as dimensões reais embaixo
- Fotos abaixo de 1080px de largura aparecem marcadas como "baixa" em âmbar
- Selecionar um item no dropdown salva e recarrega
- "Tornar principal" só habilita depois de vincular um item
- Enviar uma foto grande adiciona ao grid; enviar uma pequena mostra o aviso

Confirme também que **o cardápio continua igual** — abra `/cardapio` e verifique
que as imagens carregam normalmente, sem mudança de peso.

- [ ] **Step 4: Commitar**

Run: `cd frontend && npx eslint src/pages/BancoFotos.jsx`
Expected: 0 erros

```bash
git add frontend/src/pages/BancoFotos.jsx frontend/src/App.jsx
git commit -m "feat(fotos): tela do banco de fotos (upload em lote, vincular item, foto principal)"
```

---

### Task 5: Backup das fotos

**Files:**
- Modify: `backend/src/services/backup.js`

**Interfaces:**
- Consumes: `ALTA_DIR` de `../services/bancoFotos` (Task 2)
- Produces: `espelharFotos()` → `{ copiadas: number }`

- [ ] **Step 1: Implementar o espelhamento**

O backup hoje copia só o `.db`. As fotos em alta passam a ser um ativo que
**não pode ser recriado** sem refotografar, então precisam de cópia.

Copiar tudo todo dia seria desperdício; o espelhamento copia apenas o que ainda
não existe no destino.

Em `backend/src/services/backup.js`, adicione antes de `iniciarBackupAutomatico`:

```js
// Fotos em alta são insubstituíveis (o original só existe aqui) e não cabem
// no .db. Espelha incrementalmente: copia só o que ainda não foi copiado.
function espelharFotos() {
  let copiadas = 0;
  try {
    const { ALTA_DIR } = require('./bancoFotos');
    if (!fs.existsSync(ALTA_DIR)) return { copiadas };
    const destino = path.join(BACKUP_DIR, 'fotos');
    if (!fs.existsSync(destino)) fs.mkdirSync(destino, { recursive: true });

    for (const nome of fs.readdirSync(ALTA_DIR)) {
      const alvo = path.join(destino, nome);
      if (fs.existsSync(alvo)) continue;
      try { fs.copyFileSync(path.join(ALTA_DIR, nome), alvo); copiadas++; } catch {}
    }
    if (copiadas > 0) console.log(`[backup] ${copiadas} foto(s) nova(s) copiada(s)`);
  } catch (err) {
    console.error('[backup] Falha ao espelhar fotos:', err.message);
  }
  return { copiadas };
}
```

Chame dentro de `fazerBackup()`, logo após o `console.log` do banco salvo:

```js
    espelharFotos();
```

E exporte junto:

```js
module.exports = { iniciarBackupAutomatico, fazerBackup, espelharFotos };
```

**Atenção:** diferente dos `.db`, as fotos **não entram na rotação de 14 dias** —
apagar uma foto do backup porque ficou "velha" perderia o arquivo para sempre.
A limpeza existente já filtra por `sushi-*.db`, então a pasta `fotos/` não é
tocada por ela. Não altere esse filtro.

- [ ] **Step 2: Verificar**

Run:
```bash
cd backend && node -e "require('dotenv').config();const b=require('./src/services/backup');console.log(b.espelharFotos())"
```
Expected: `{ copiadas: N }` com N = número de fotos em `uploads/fotos`

Rode de novo:
Expected: `{ copiadas: 0 }` — confirma que é incremental e não recopia

Confirme que os `.db` de backup continuam intactos:
```bash
ls backend/data/backups/ | head -5
```

- [ ] **Step 3: Commitar**

```bash
git add backend/src/services/backup.js
git commit -m "feat(fotos): backup passa a espelhar as fotos em alta"
```

---

### Task 6: Verificação final e deploy

**Files:** nenhum novo — build e deploy pela receita do projeto.

- [ ] **Step 1: Suíte e lint**

Run: `cd backend && npm test`
Expected: PASS — 20/20

Run: `cd backend && npx eslint src/utils/otimizarImagem.js src/services/bancoFotos.js src/routes/fotos.js src/services/backup.js`
Expected: 0 erros

Run: `cd frontend && npx eslint src/pages/BancoFotos.jsx`
Expected: 0 erros

- [ ] **Step 2: Conferir que o cardápio não regrediu**

Este é o risco principal desta entrega. Compare uma imagem do cardápio antes e
depois: as dimensões e o peso devem estar iguais aos de hoje (≤900px, ~30-110 KB).

```bash
cd backend && node -e "const s=require('sharp');const fs=require('fs');const d='../frontend/public/cardapio';const f=fs.readdirSync(d).filter(x=>x.endsWith('.webp')).pop();s(d+'/'+f).metadata().then(m=>console.log('CARDAPIO:',f,m.width+'x'+m.height,Math.round(fs.statSync(d+'/'+f).size/1024)+'KB'))"
```
Expected: ≤900px, peso na mesma faixa de hoje

- [ ] **Step 3: Deploy**

Backend — copiar os arquivos novos e modificados para o servidor, validar sintaxe
com `node --check`, conferir `md5sum` contra o local e reiniciar **apenas** o
processo principal (`pm2 restart 0`; **nunca** o id 1, que é o `whatsapp-service`).
Arquivos: `src/utils/otimizarImagem.js`, `src/services/bancoFotos.js`,
`src/routes/fotos.js`, `src/services/backup.js`, `src/routes/cardapio.js`,
`src/db/database.js`, `src/index.js`.

Confirmar depois do restart:
- `/api/health` responde `ok`
- `POST /api/fotos/catalogar` cataloga as 51 fotos de produção
- A pasta `backend/uploads/fotos/` é criada

Frontend — `npx vite build`, empacotar `dist`, enviar, extrair em `dist.new`,
conferir que o bundle novo contém `banco-fotos`, e trocar atomicamente.

**Atenção no deploy:** `backend/uploads/` **não** é tocado pelo deploy (os
arquivos são copiados individualmente), então as fotos já enviadas sobrevivem.
Confirmar isso explicitamente após o primeiro deploy com fotos no servidor.

- [ ] **Step 4: Avisar o dono**

Depois do deploy, a tela `/banco-fotos` está pronta para uso. Comunicar:

- As **51 fotos atuais** foram catalogadas, mas continuam com a resolução
  antiga (600–900px) — o original delas foi destruído pelo otimizador antigo e
  não há como recuperar.
- **Toda foto nova** enviada a partir de agora é preservada em até 2400px.
- Fotos abaixo de 1080px de largura aparecem marcadas como "baixa" e servem em
  composição pequena, mas não como imagem principal de um Story.
- Vale subir também fotos que não são de prato (cozinha, preparo, embalagem):
  elas rendem muito em Story e são o material que mais afasta a aparência de
  conteúdo genérico.

---

## Self-Review

**Cobertura da spec (Peça 3 — Banco de Fotos):** tabela `fotos_banco` com
resolução real ✅ (Task 2); pipeline dual preservando o original ✅ (Task 1);
catalogação das 51 fotos existentes ✅ (Task 2); upload por PC e celular ✅
(Task 4, `<input type="file" multiple>` funciona nos dois); foto principal por
item ✅ (Task 3/4); backup das fotos ✅ (Task 5). A base da regra de ouro
(`resolucaoSuficiente`) entra aqui ✅ (Task 2) porque depende do dado de
resolução; sua **aplicação** nos templates é do Plano B.

**Fora deste plano (vão para o Plano B):** kit de marca e extração da logo do
PDF, tratamento de imagem (corte por saliência, grade de cor, grão, nitidez),
templates editoriais, área segura do Stories, voz do texto. Nenhum deles é
pré-requisito para começar a subir fotos — que é o objetivo desta entrega.

**Placeholders:** nenhum "TBD"/"a definir". O único passo com margem de decisão
é o Step 2 da Task 4 (registrar a rota em `App.jsx`), que instrui explicitamente
a seguir o padrão existente do arquivo em vez de introduzir um novo — a
alternativa seria cravar um padrão que pode não ser o do arquivo.

**Consistência de tipos:** `preservarAlta()` devolve
`{ arquivo, largura, altura }` e é consumida com esses nomes nas Tasks 1 e 3.
`registrarFoto()` recebe `{ arquivo, arquivo_web, largura, altura, item_id, hero, tags }`,
que são exatamente as colunas de `fotos_banco`. `ALTA_DIR` é exportado na Task 2
e consumido nas Tasks 3 e 5.
