const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cpfValido, formatarCpf } = require('./cpf');

test('aceita CPF válido com pontuação', () => {
  assert.equal(cpfValido('111.444.777-35'), true);
});

test('aceita CPF válido sem pontuação', () => {
  assert.equal(cpfValido('11144477735'), true);
});

test('rejeita CPF com dígito verificador errado', () => {
  assert.equal(cpfValido('111.444.777-30'), false);
});

test('rejeita CPF com todos os dígitos iguais', () => {
  assert.equal(cpfValido('111.111.111-11'), false);
});

test('rejeita CPF com menos de 11 dígitos', () => {
  assert.equal(cpfValido('123456789'), false);
});

test('rejeita vazio/undefined', () => {
  assert.equal(cpfValido(''), false);
  assert.equal(cpfValido(undefined), false);
});

test('formatarCpf aplica a máscara padrão', () => {
  assert.equal(formatarCpf('11144477735'), '111.444.777-35');
});
