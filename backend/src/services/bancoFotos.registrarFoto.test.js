// Testes do upsert de registrarFoto — cobrem os dois bugs da revisão:
//  1) o ON CONFLICT devia manter a MAIOR resolução (alta), não a última
//     gravada (comumente a web de 900px), independente da ordem de scan.
//  2) o id retornado deve ser sempre o da linha realmente escrita, mesmo
//     no ramo DO UPDATE do upsert.
//
// Usa um banco SQLite temporário — nunca o backend/data/sushi.db real.
// DB_PATH precisa ser definido ANTES de requerer o módulo db (singleton
// abre o arquivo no require).
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDbPath = path.join(
  os.tmpdir(),
  `sushi-test-bancoFotos-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`
);
process.env.DB_PATH = tmpDbPath;

const { registrarFoto } = require('./bancoFotos');
const db = require('../db/database');

// fotos_banco.item_id referencia cardapio_itens(id). Em produção essa tabela
// é criada por routes/cardapio.js (não requerido aqui). O driver node:sqlite
// habilita enforcement de foreign keys por padrão, e SQLite exige que a
// tabela referenciada exista para sequer preparar o INSERT — então criamos
// uma versão mínima só para este banco de teste isolado.
db.exec('CREATE TABLE IF NOT EXISTS cardapio_itens (id INTEGER PRIMARY KEY)');

after(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(tmpDbPath + suffix); } catch { /* ok se não existir */ }
  }
});

function buscar(arquivo) {
  return db.prepare('SELECT id, arquivo, arquivo_web, largura, altura FROM fotos_banco WHERE arquivo = ?').get(arquivo);
}

test('upsert mantém a maior resolução quando a ALTA é catalogada primeiro e a WEB depois', () => {
  const arquivo = `ordem-alta-primeiro-${Date.now()}.webp`;

  registrarFoto({ arquivo, largura: 2400, altura: 1600 }); // passada "alta"
  registrarFoto({ arquivo, arquivo_web: `/cardapio/${arquivo}`, largura: 900, altura: 600 }); // passada "web"

  const row = buscar(arquivo);
  assert.equal(row.largura, 2400, 'largura deveria continuar sendo a da foto em alta');
  assert.equal(row.altura, 1600, 'altura deveria continuar sendo a da foto em alta');
  assert.equal(row.arquivo_web, `/cardapio/${arquivo}`, 'arquivo_web deveria ser gravado mesmo sem vencer a resolução');
});

test('upsert mantém a maior resolução quando a WEB é catalogada primeiro e a ALTA depois', () => {
  const arquivo = `ordem-web-primeiro-${Date.now()}.webp`;

  registrarFoto({ arquivo, arquivo_web: `/cardapio/${arquivo}`, largura: 900, altura: 600 }); // passada "web"
  registrarFoto({ arquivo, largura: 2400, altura: 1600 }); // passada "alta"

  const row = buscar(arquivo);
  assert.equal(row.largura, 2400, 'largura deveria virar a da foto em alta, mesmo chegando depois');
  assert.equal(row.altura, 1600, 'altura deveria virar a da foto em alta, mesmo chegando depois');
  assert.equal(row.arquivo_web, `/cardapio/${arquivo}`, 'arquivo_web catalogado antes não pode se perder');
});

test('caso legado: foto só existe em web (sem cópia em alta) grava a resolução web normalmente', () => {
  const arquivo = `legado-somente-web-${Date.now()}.webp`;

  registrarFoto({ arquivo, arquivo_web: `/cardapio/${arquivo}`, largura: 900, altura: 900 });

  const row = buscar(arquivo);
  assert.equal(row.largura, 900);
  assert.equal(row.altura, 900);
  assert.equal(row.arquivo_web, `/cardapio/${arquivo}`);
});

test('registrarFoto retorna o id da linha realmente escrita no ramo DO UPDATE (não o de outra linha)', () => {
  const arquivoA = `id-linha-a-${Date.now()}.webp`;
  const arquivoB = `id-linha-b-${Date.now()}.webp`;

  const insertA = registrarFoto({ arquivo: arquivoA, largura: 100, altura: 100 });
  const insertB = registrarFoto({ arquivo: arquivoB, largura: 100, altura: 100 }); // bumpa last_insert_rowid

  const updateA = registrarFoto({ arquivo: arquivoA, largura: 3000, altura: 2000 }); // ramo DO UPDATE

  const rowA = buscar(arquivoA);
  assert.equal(updateA.id, rowA.id, 'id retornado deve ser o da linha do arquivoA que foi atualizada');
  assert.notEqual(updateA.id, insertB.id, 'id retornado não pode ser o de uma linha não relacionada (arquivoB)');
  assert.equal(insertA.id, rowA.id, 'sanity check: id do insert original bate com o id final da linha');
});
