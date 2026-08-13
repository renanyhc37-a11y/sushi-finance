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
  // Um proxy/gateway pode responder um 404 com corpo HTML em vez do JSON da
  // Focus NFe — sem o fallback, isso lançaria e a reconciliação nunca veria
  // o httpStatus real (cairia sempre no "ainda processando").
  const data = await r.json().catch(() => ({}));
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

// SEFAZ/NF-e 4.00 espera data_emissao com offset explícito (-03:00), sem
// frações de segundo — new Date().toISOString() gera milissegundos + "Z", que
// não é o formato esperado. Fuso de Brasília fixo (Brasil não usa mais
// horário de verão desde 2019); não confia no fuso do processo Node (server
// pode rodar em UTC).
function dataEmissaoBrasilia() {
  const agora = new Date();
  const offsetMs = agora.getTimezoneOffset() * 60000;
  const utc = new Date(agora.getTime() + offsetMs);
  const brasilia = new Date(utc.getTime() - 3 * 3600000);
  const pad = n => String(n).padStart(2, '0');
  return `${brasilia.getUTCFullYear()}-${pad(brasilia.getUTCMonth() + 1)}-${pad(brasilia.getUTCDate())}T${pad(brasilia.getUTCHours())}:${pad(brasilia.getUTCMinutes())}:${pad(brasilia.getUTCSeconds())}-03:00`;
}

// Limites de tamanho de texto livre exigidos pela SEFAZ (aproximados —
// truncar em vez de mandar sem limite algum, que é o que acontecia antes).
const LIMITE_NOME_DESTINATARIO = 60;
const LIMITE_DESCRICAO_ITEM = 120;

function montarPayloadNfce({ pedido, itens, cpf, cnpjEmitente }) {
  const items = itens.map((item, i) => {
    const valorBruto = Number((item.valor_unitario * item.quantidade).toFixed(2));
    return {
      numero_item: String(i + 1),
      codigo_produto: String(item.id ?? i + 1),
      codigo_ncm: item.ncm || NCM_PADRAO,
      descricao: String(item.item_nome ?? '').slice(0, LIMITE_DESCRICAO_ITEM),
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
  });

  // A soma das formas de pagamento tem que bater com o total da nota. A nota
  // só declara mercadoria (items[].valor_bruto) — pedido.total incluiria
  // frete/desconto do delivery, que não entram na NFC-e em si (frete é
  // serviço separado, prática comum). Usar a soma dos itens evita rejeição
  // pela SEFAZ em praticamente todo pedido com entrega/desconto.
  const valorTotalItens = Number(items.reduce((s, it) => s + it.valor_bruto, 0).toFixed(2));

  return {
    natureza_operacao: 'VENDA AO CONSUMIDOR',
    data_emissao: dataEmissaoBrasilia(),
    presenca_comprador: pedido.tipo_entrega === 'retirada' ? '1' : '4',
    modalidade_frete: '9',
    local_destino: '1',
    cnpj_emitente: cnpjEmitente,
    cpf_destinatario: cpf,
    nome_destinatario: String(pedido.cliente_nome ?? '').slice(0, LIMITE_NOME_DESTINATARIO),
    items,
    formas_pagamento: [{
      forma_pagamento: mapaFormaPagamento[pedido.forma_pagamento] || '99',
      valor_pagamento: valorTotalItens,
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
