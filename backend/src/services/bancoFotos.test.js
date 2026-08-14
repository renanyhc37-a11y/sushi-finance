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
