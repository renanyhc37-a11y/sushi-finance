// Testes da rota PATCH /api/fotos/:id — cobrem os bugs da revisão de código:
//  1) (Crítico) trocar de item_id sem falar de "hero" deixava o hero antigo
//     grudado, podendo gerar DOIS heroes no item de destino.
//  2) (Menor) hero:true numa foto sem item_id gravava hero=1 órfão.
//
// Chama o handler real da rota diretamente da pilha do Router (sem subir
// servidor HTTP) — assim o teste exercita a lógica de verdade, com um banco
// SQLite temporário. Nunca toca em backend/data/sushi.db.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDbPath = path.join(
  os.tmpdir(),
  `sushi-test-fotos-route-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
);
process.env.DB_PATH = tmpDbPath;

const db = require('../db/database');
// fotos_banco.item_id referencia cardapio_itens(id); criamos uma versão
// mínima só para este banco de teste isolado (mesmo padrão do teste de
// bancoFotos.registrarFoto).
db.exec('CREATE TABLE IF NOT EXISTS cardapio_itens (id INTEGER PRIMARY KEY)');
db.exec('INSERT INTO cardapio_itens (id) VALUES (1), (2), (3)');

const { registrarFoto } = require('../services/bancoFotos');
const router = require('./fotos');

after(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(tmpDbPath + suffix); } catch { /* ok se não existir */ }
  }
});

// Pega o handler real registrado em router.patch('/:id', ...).
const patchLayer = router.stack.find(
  (l) => l.route && l.route.path === '/:id' && l.route.methods && l.route.methods.patch
);
if (!patchLayer) throw new Error('rota PATCH /:id não encontrada no router de fotos — ajuste o teste');
const patchHandler = patchLayer.route.stack[0].handle;

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

function patch(id, body) {
  const req = { params: { id: String(id) }, body };
  const res = fakeRes();
  patchHandler(req, res);
  return res;
}

function buscar(id) {
  return db.prepare('SELECT * FROM fotos_banco WHERE id = ?').get(id);
}

let contador = 0;
function novaFoto(item_id = null, hero = 0) {
  contador++;
  const { id } = registrarFoto({
    arquivo: `foto-${contador}-${Date.now()}-${Math.random().toString(16).slice(2)}.webp`,
    largura: 800,
    altura: 800,
    item_id,
    hero,
  });
  return id;
}

test('BUG 1: trocar de item sem mencionar hero não pode deixar dois heroes no item de destino', () => {
  const heroDoItem2 = novaFoto(2, 1); // item 2 já tem seu hero
  const fotoMovendo = novaFoto(1, 1); // hero do item 1, será realocada pro item 2

  patch(fotoMovendo, { item_id: 2 }); // só re-vincula, não fala de hero

  const linhasDoItem2 = db.prepare('SELECT id, hero FROM fotos_banco WHERE item_id = 2').all();
  const heroes = linhasDoItem2.filter((l) => l.hero === 1);

  assert.equal(heroes.length, 1, 'item 2 deve ter exatamente um hero após a realocação');
  assert.equal(heroes[0].id, heroDoItem2, 'o hero do item 2 continua sendo o hero antigo, não o recém-chegado');
  assert.equal(buscar(fotoMovendo).hero, 0, 'a foto realocada não pode carregar hero=1 pro novo item');
});

test('hero explícito no mesmo PATCH que troca o item ainda vence e vira o hero do destino', () => {
  const heroAntigo = novaFoto(3, 1);
  const fotoMovendo = novaFoto(1, 0);

  const res = patch(fotoMovendo, { item_id: 3, hero: true });

  assert.equal(res.body.hero, 1);
  assert.equal(buscar(fotoMovendo).hero, 1);
  assert.equal(buscar(heroAntigo).hero, 0, 'hero explícito deve limpar o hero antigo do item de destino');
});

test('BUG 2: hero:true numa foto sem item_id nunca é gravado como hero', () => {
  const foto = novaFoto(null, 0);

  const res = patch(foto, { hero: true });

  assert.equal(buscar(foto).hero, 0, 'foto sem item não pode virar hero');
  assert.equal(res.body.hero, 0);
});

test('desvincular o item (item_id: null) junto com hero:true não deixa hero órfão', () => {
  const foto = novaFoto(1, 0);

  patch(foto, { item_id: null, hero: true });

  const linha = buscar(foto);
  assert.equal(linha.item_id, null);
  assert.equal(linha.hero, 0);
});

test('setar hero:true limpa o hero das outras fotos do mesmo item', () => {
  const antigoHero = novaFoto(2, 1);
  const novoHero = novaFoto(2, 0);

  patch(novoHero, { hero: true });

  assert.equal(buscar(novoHero).hero, 1);
  assert.equal(buscar(antigoHero).hero, 0);
});

test('enviar só tags não mexe em item_id nem em hero (nem no hero de outras fotos do item)', () => {
  const heroDoItem = novaFoto(1, 1);
  const foto = novaFoto(1, 0);

  const res = patch(foto, { tags: 'salmao,combo' });

  const linha = buscar(foto);
  assert.equal(linha.tags, 'salmao,combo');
  assert.equal(linha.item_id, 1, 'item_id não deveria mudar');
  assert.equal(linha.hero, 0, 'hero não deveria mudar');
  assert.equal(buscar(heroDoItem).hero, 1, 'hero de outra foto do mesmo item não pode ser mexido por um PATCH de tags');
  assert.equal(res.body.tags, 'salmao,combo');
});

test('404 quando a foto não existe', () => {
  const res = patch(999999, { tags: 'x' });
  assert.equal(res.statusCode, 404);
});
