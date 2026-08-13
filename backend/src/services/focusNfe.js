// Cliente HTTP da API da Focus NFe (emissão de NFC-e). A emissão de NFC-e é
// SÍNCRONA nessa API: a resposta do POST já vem com o resultado final
// (autorizado/erro_autorizacao), sem necessidade de webhook.
// Doc oficial: https://doc.focusnfe.com.br/reference/emitir_nfce

function baseUrl() {
  if (process.env.FOCUS_NFE_BASE_URL) return process.env.FOCUS_NFE_BASE_URL;
  return process.env.FOCUS_NFE_AMBIENTE === 'producao'
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';
}

function authHeader() {
  const token = process.env.FOCUS_NFE_TOKEN || '';
  return `Basic ${Buffer.from(`${token}:`).toString('base64')}`;
}

async function emitirNfce(ref, payload) {
  const r = await fetch(`${baseUrl()}/v2/nfce?ref=${encodeURIComponent(ref)}`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  return { httpStatus: r.status, ...data };
}

async function consultarNfce(ref) {
  const r = await fetch(`${baseUrl()}/v2/nfce/${encodeURIComponent(ref)}?completa=1`, {
    headers: { Authorization: authHeader() },
  });
  const data = await r.json();
  return { httpStatus: r.status, ...data };
}

function linkCompleto(caminho) {
  if (!caminho) return null;
  return `${baseUrl()}${caminho}`;
}

// ── Defaults fiscais assumidos para Simples Nacional (confirmar com o
// contador antes de produção — ver Global Constraints do plano) ──────────
const NCM_PADRAO = '21069090'; // "outras preparações alimentícias"
const CFOP_VENDA = '5102';     // venda dentro do estado, consumidor final
const ICMS_ORIGEM = '0';
const ICMS_SITUACAO_TRIBUTARIA = '102'; // CSOSN 102 — tributada pelo Simples, sem crédito
const PIS_SITUACAO_TRIBUTARIA = '99';
const COFINS_SITUACAO_TRIBUTARIA = '99';

const mapaFormaPagamento = {
  dinheiro: '01',
  cartao_cred: '03',
  cartao_deb: '04',
  pix: '99', // Focus NFe não documentava código dedicado p/ Pix — confirmar
};

function montarPayloadNfce({ pedido, itens, cpf, cnpjEmitente }) {
  return {
    natureza_operacao: 'VENDA AO CONSUMIDOR',
    data_emissao: new Date().toISOString(),
    presenca_comprador: pedido.tipo_entrega === 'retirada' ? '1' : '4',
    modalidade_frete: '9',
    local_destino: '1',
    cnpj_emitente: cnpjEmitente,
    cpf_destinatario: cpf,
    nome_destinatario: pedido.cliente_nome,
    items: itens.map((item, i) => {
      const valorBruto = Number((item.valor_unitario * item.quantidade).toFixed(2));
      return {
        numero_item: String(i + 1),
        codigo_produto: String(item.id ?? i + 1),
        codigo_ncm: item.ncm || NCM_PADRAO,
        descricao: item.item_nome,
        cfop: CFOP_VENDA,
        unidade_comercial: 'un',
        unidade_tributavel: 'un',
        quantidade_comercial: item.quantidade,
        quantidade_tributavel: item.quantidade,
        valor_unitario_comercial: item.valor_unitario,
        valor_unitario_tributavel: item.valor_unitario,
        valor_bruto: valorBruto,
        icms_origem: ICMS_ORIGEM,
        icms_situacao_tributaria: ICMS_SITUACAO_TRIBUTARIA,
        pis_situacao_tributaria: PIS_SITUACAO_TRIBUTARIA,
        cofins_situacao_tributaria: COFINS_SITUACAO_TRIBUTARIA,
      };
    }),
    formas_pagamento: [{
      forma_pagamento: mapaFormaPagamento[pedido.forma_pagamento] || '99',
      valor_pagamento: pedido.total,
    }],
  };
}

module.exports = {
  emitirNfce,
  consultarNfce,
  linkCompleto,
  montarPayloadNfce,
  mapaFormaPagamento,
  NCM_PADRAO,
};
