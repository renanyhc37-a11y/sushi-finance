const { test } = require('node:test');
const assert = require('node:assert/strict');

test('emitirNfce faz POST com Basic Auth e devolve o JSON da resposta', async () => {
  process.env.FOCUS_NFE_TOKEN = 'token-de-teste';
  process.env.FOCUS_NFE_AMBIENTE = 'homologacao';
  delete require.cache[require.resolve('./focusNfe')];
  const { emitirNfce } = require('./focusNfe');

  const original = global.fetch;
  let urlChamada, optsChamados;
  global.fetch = async (url, opts) => {
    urlChamada = url; optsChamados = opts;
    return { status: 201, json: async () => ({ status: 'autorizado', ref: 'ref-1', chave_nfe: 'abc', caminho_danfe: '/notas/x.html' }) };
  };

  try {
    const r = await emitirNfce('ref-1', { natureza_operacao: 'VENDA AO CONSUMIDOR' });
    assert.equal(r.status, 'autorizado');
    assert.equal(r.chave_nfe, 'abc');
    assert.equal(urlChamada, 'https://homologacao.focusnfe.com.br/v2/nfce?ref=ref-1');
    assert.equal(optsChamados.method, 'POST');
    assert.equal(optsChamados.headers.Authorization, `Basic ${Buffer.from('token-de-teste:').toString('base64')}`);
    assert.equal(optsChamados.headers['Content-Type'], 'application/json');
  } finally {
    global.fetch = original;
  }
});

test('linkCompleto prefixa caminho relativo com a base URL de homologação', () => {
  process.env.FOCUS_NFE_AMBIENTE = 'homologacao';
  delete require.cache[require.resolve('./focusNfe')];
  const { linkCompleto } = require('./focusNfe');
  assert.equal(linkCompleto('/notas/x.html'), 'https://homologacao.focusnfe.com.br/notas/x.html');
});

test('linkCompleto devolve null quando não há caminho', () => {
  const { linkCompleto } = require('./focusNfe');
  assert.equal(linkCompleto(null), null);
  assert.equal(linkCompleto(undefined), null);
});

test('montarPayloadNfce monta natureza, destinatário e formas de pagamento', () => {
  const { montarPayloadNfce } = require('./focusNfe');
  const pedido = { cliente_nome: 'Renan Teste', tipo_entrega: 'entrega', forma_pagamento: 'pix', total: 45.9 };
  const itens = [{ item_nome: 'Combinado 20 peças', quantidade: 1, valor_unitario: 45.9, ncm: '21069090' }];
  const payload = montarPayloadNfce({ pedido, itens, cpf: '11144477735', cnpjEmitente: '12345678000123' });

  assert.equal(payload.cnpj_emitente, '12345678000123');
  assert.equal(payload.cpf_destinatario, '11144477735');
  assert.equal(payload.nome_destinatario, 'Renan Teste');
  assert.equal(payload.presenca_comprador, '4');
  assert.equal(payload.formas_pagamento[0].forma_pagamento, '99');
  assert.equal(payload.formas_pagamento[0].valor_pagamento, 45.9);
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].descricao, 'Combinado 20 peças');
  assert.equal(payload.items[0].codigo_ncm, '21069090');
  assert.equal(payload.items[0].cfop, '5102');
  assert.equal(payload.items[0].icms_situacao_tributaria, '102');
  assert.equal(payload.items[0].valor_bruto, 45.9);
});

test('montarPayloadNfce usa presenca_comprador "1" pra retirada', () => {
  const { montarPayloadNfce } = require('./focusNfe');
  const pedido = { cliente_nome: 'Cliente', tipo_entrega: 'retirada', forma_pagamento: 'dinheiro', total: 10 };
  const itens = [{ item_nome: 'Item', quantidade: 1, valor_unitario: 10, ncm: '21069090' }];
  const payload = montarPayloadNfce({ pedido, itens, cpf: '11144477735', cnpjEmitente: '123' });
  assert.equal(payload.presenca_comprador, '1');
  assert.equal(payload.formas_pagamento[0].forma_pagamento, '01');
});
