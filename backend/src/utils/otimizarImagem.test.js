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
