const db = require('../db/database');

// Faturamento por dia, num intervalo — reconcilia o lançamento manual
// (tela Faturamento) com os pedidos automáticos do PDV, dia a dia.
// Regra (mesma usada pela tela Faturamento no frontend): se o dia tem
// lançamento manual, ele prevalece; senão, usa o total de pedidos do PDV
// daquele dia (excluindo cancelados). Isso evita contar o mesmo dia duas
// vezes e garante que Dashboard e Faturamento sempre mostrem os mesmos
// números pro mesmo período.
function porDia(dataInicio, dataFim) {
  const manuais = db.prepare(`
    SELECT data, total_bruto as total, quantidade_pedidos as pedidos,
           pix, dinheiro, credito, debito
    FROM faturamento_diario
    WHERE data BETWEEN ? AND ?
  `).all(dataInicio, dataFim);

  const auto = db.prepare(`
    SELECT date(created_at, 'localtime') as data,
           COUNT(*) as pedidos,
           COALESCE(SUM(total), 0) as total,
           COALESCE(SUM(CASE WHEN forma_pagamento='pix'        THEN total ELSE 0 END), 0) as pix,
           COALESCE(SUM(CASE WHEN forma_pagamento='dinheiro'   THEN total ELSE 0 END), 0) as dinheiro,
           COALESCE(SUM(CASE WHEN forma_pagamento='cartao_cred' THEN total ELSE 0 END), 0) as credito,
           COALESCE(SUM(CASE WHEN forma_pagamento='cartao_deb'  THEN total ELSE 0 END), 0) as debito
    FROM pdv_pedidos
    WHERE status != 'cancelado' AND date(created_at, 'localtime') BETWEEN ? AND ?
    GROUP BY data
  `).all(dataInicio, dataFim);

  const porData = new Map();
  for (const a of auto) porData.set(a.data, { ...a, origem: 'auto' });
  for (const m of manuais) porData.set(m.data, { ...m, origem: 'manual' }); // manual sobrescreve

  return Array.from(porData.values()).sort((a, b) => a.data.localeCompare(b.data));
}

// Soma o total/pedidos de uma lista de dias (saída de porDia).
function somar(dias) {
  return dias.reduce((acc, d) => ({
    total: acc.total + (d.total || 0),
    pedidos: acc.pedidos + (d.pedidos || 0),
    pix: acc.pix + (d.pix || 0),
    dinheiro: acc.dinheiro + (d.dinheiro || 0),
    credito: acc.credito + (d.credito || 0),
    debito: acc.debito + (d.debito || 0),
  }), { total: 0, pedidos: 0, pix: 0, dinheiro: 0, credito: 0, debito: 0 });
}

module.exports = { porDia, somar };
