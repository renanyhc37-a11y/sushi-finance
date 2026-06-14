const { Router } = require('express');
const db = require('../db/database');
const router = Router();

// ──────────────────────────────────────────────────────────────
//  FLUXO DE CAIXA — entradas × saídas ao longo do mês, com saldo
//  acumulado e projeção. Fontes (em sincronia com o resto do sistema):
//   - Entradas: faturamento_diario (total_bruto)
//   - Saídas:   despesas (já inclui boletos pagos, que viram despesa
//               automaticamente ao dar baixa) + compras de insumos
//               (insumo_entrada). Boletos NÃO são contados à parte para
//               não duplicar.
// ──────────────────────────────────────────────────────────────

function porDia(sql, mes) {
  const rows = db.prepare(sql).all(mes);
  const map = {};
  for (const r of rows) {
    // Normaliza: datas com só mês ("2026-06") caem no dia 01; mantém YYYY-MM-DD
    let d = String(r.d || '').slice(0, 10);
    if (d.length === 7) d = d + '-01';
    if (d.length < 10) continue;
    map[d] = (map[d] || 0) + Number(r.v || 0);
  }
  return map;
}

router.get('/', (req, res) => {
  try {
    const mes = req.query.mes || new Date().toISOString().slice(0, 7);

    const entradas = porDia(
      "SELECT data d, SUM(total_bruto) v FROM faturamento_diario WHERE substr(data,1,7)=? GROUP BY data", mes);
    const despesas = porDia(
      "SELECT data_competencia d, SUM(valor) v FROM despesas WHERE substr(data_competencia,1,7)=? GROUP BY data_competencia", mes);
    let comprasInsumos = {};
    try {
      comprasInsumos = porDia(
        "SELECT data d, SUM(valor_total) v FROM insumo_entrada WHERE substr(data,1,7)=? GROUP BY data", mes);
    } catch {}

    // Conjunto de todos os dias com movimento
    const diasSet = new Set([...Object.keys(entradas), ...Object.keys(despesas), ...Object.keys(comprasInsumos)]);
    const dias = [...diasSet].sort();

    let acumulado = 0;
    let totEnt = 0, totDesp = 0, totCompras = 0;
    const serie = dias.map(d => {
      const ent = entradas[d] || 0;
      const desp = despesas[d] || 0;
      const compras = comprasInsumos[d] || 0;
      const saidas = desp + compras;
      const saldoDia = ent - saidas;
      acumulado += saldoDia;
      totEnt += ent; totDesp += desp; totCompras += compras;
      return {
        data: d,
        entradas: ent,
        despesas: desp,
        compras_insumos: compras,
        saidas,
        saldo_dia: saldoDia,
        saldo_acumulado: acumulado,
      };
    });

    const totSaidas = totDesp + totCompras;
    const saldo = totEnt - totSaidas;

    // Projeção: extrapola o saldo médio diário para o mês inteiro
    const hoje = new Date();
    const ehMesAtual = mes === hoje.toISOString().slice(0, 7);
    const diasComMovimento = dias.length || 1;
    const diasNoMes = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();
    const saldoMedioDia = saldo / diasComMovimento;
    const projecao_mes = ehMesAtual ? saldoMedioDia * diasNoMes : saldo;

    res.json({
      mes,
      serie,
      totais: {
        entradas: totEnt,
        saidas: totSaidas,
        despesas: totDesp,
        compras_insumos: totCompras,
        saldo,
      },
      projecao_mes,
      saldo_medio_dia: saldoMedioDia,
    });
  } catch (e) {
    console.error('[fluxo-caixa]', e);
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
