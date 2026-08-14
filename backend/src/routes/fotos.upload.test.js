// Testes da lógica de processamento de lote do POST /api/fotos/upload —
// cobrem o bug (Importante) da revisão: multer recebia um callback `async`
// que ele não espera, então um throw dentro do loop virava unhandled
// rejection — a requisição HTTP ficava pendurada sem resposta e os arquivos
// restantes do lote eram pulados, com o temporário deixado para trás.
//
// A parte que decide o resultado por arquivo foi extraída para
// `processarLoteUploads(files, itemId, deps)`, uma função pura (deps
// injetadas) que dá pra testar sem multer/sharp/banco reais.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const router = require('./fotos');

test('processarLoteUploads existe e é exportado junto com o router (refatoração para testabilidade)', () => {
  assert.equal(typeof router.processarLoteUploads, 'function');
});

test('BUG 3: um arquivo falhando no meio do lote não pode travar nem pular os arquivos seguintes', async () => {
  const files = [{ filename: 'a.jpg' }, { filename: 'falha.jpg' }, { filename: 'c.jpg' }];
  const registrados = [];
  const deps = {
    preservarAlta: async (_dir, filename) => ({ arquivo: filename, largura: 100, altura: 100 }),
    registrarFoto: (dados) => {
      if (dados.arquivo === 'falha.jpg') throw new Error('falha simulada no banco');
      registrados.push(dados.arquivo);
      return { id: registrados.length };
    },
    unlink: () => {},
  };

  const { salvas, falhas } = await router.processarLoteUploads(files, null, deps);

  assert.deepEqual(
    registrados,
    ['a.jpg', 'c.jpg'],
    'os arquivos depois do que falhou devem continuar sendo processados'
  );
  assert.equal(salvas.length, 2, 'os 2 arquivos que deram certo devem aparecer como salvos');
  assert.equal(falhas.length, 1, 'o arquivo que falhou deve ser reportado, não silenciosamente sumir');
  assert.ok(falhas.includes('falha.jpg'));
});

test('mesmo se TODO o lote falhar, processarLoteUploads resolve (nunca fica pendurada) — garante que a rota sempre responde', async () => {
  const files = [{ filename: 'x.jpg' }, { filename: 'y.jpg' }];
  const deps = {
    preservarAlta: async () => { throw new Error('boom no preservarAlta'); },
    registrarFoto: () => { throw new Error('nunca deveria chegar aqui'); },
    unlink: () => {},
  };

  const resultado = await router.processarLoteUploads(files, null, deps);

  assert.equal(resultado.salvas.length, 0);
  assert.equal(resultado.falhas.length, 2);
});

test('arquivo cujo preservarAlta devolve null (sharp indisponível/falha) conta como falha, não interrompe o lote', async () => {
  const files = [{ filename: 'ok.jpg' }, { filename: 'sem-sharp.jpg' }, { filename: 'ok2.jpg' }];
  const registrados = [];
  const deps = {
    preservarAlta: async (_dir, filename) => (filename === 'sem-sharp.jpg' ? null : { arquivo: filename, largura: 50, altura: 50 }),
    registrarFoto: (dados) => { registrados.push(dados.arquivo); return { id: registrados.length }; },
    unlink: () => {},
  };

  const { salvas, falhas } = await router.processarLoteUploads(files, null, deps);

  assert.deepEqual(registrados, ['ok.jpg', 'ok2.jpg']);
  assert.equal(salvas.length, 2);
  assert.equal(falhas.length, 1);
  assert.ok(falhas.includes('sem-sharp.jpg'));
});
