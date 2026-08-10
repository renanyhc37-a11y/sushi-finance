const db = require('../db/database');

// Nota 1-5 por percentil dentro do array ordenado (menor valor = percentil menor).
function notaPorPercentil(ordenados, valor) {
  if (ordenados.length <= 1) return 3;
  let menorIguais = 0;
  for (const v of ordenados) if (v <= valor) menorIguais++;
  const percentil = menorIguais / ordenados.length;
  if (percentil <= 0.2) return 1;
  if (percentil <= 0.4) return 2;
  if (percentil <= 0.6) return 3;
  if (percentil <= 0.8) return 4;
  return 5;
}

function segmentoDeRFV(r, f, v) {
  const media = (r + f + v) / 3;
  if (r <= 2 && (f >= 4 || v >= 4)) return 'em_risco';
  if (media >= 4) return 'fiel';
  if (f >= 3 && r >= 3) return 'recorrente';
  if (r <= 2 && f <= 2) return 'inativo';
  return 'regular';
}

// Calcula RFV (Recência/Frequência/Valor) da base inteira de clientes numa
// única consulta agregada — não faz N+1 (uma query por cliente).
function calcularBaseRFV() {
  const agora = Date.now();

  const agregados = db.prepare(`
    SELECT cliente_telefone AS telefone,
           COUNT(*) AS frequencia,
           SUM(total) AS valor,
           MAX(created_at) AS ultimo_pedido
    FROM pdv_pedidos
    WHERE status != 'cancelado' AND cliente_telefone IS NOT NULL AND cliente_telefone != ''
    GROUP BY cliente_telefone
  `).all();
  const porTelefone = new Map(agregados.map(a => [a.telefone, a]));

  const clientes = db.prepare('SELECT * FROM clientes').all();

  const comHistorico = [];
  const semHistorico = [];
  for (const c of clientes) {
    const ag = porTelefone.get(c.telefone);
    if (!ag) { semHistorico.push(c); continue; }
    const dataUltimo = new Date(ag.ultimo_pedido.replace(' ', 'T') + (ag.ultimo_pedido.endsWith('Z') ? '' : 'Z'));
    const diasDesdeUltimo = Math.floor((agora - dataUltimo.getTime()) / 86400000);
    comHistorico.push({
      cliente: c,
      recencia: diasDesdeUltimo,
      frequencia: ag.frequencia,
      valor: ag.valor,
      ticketMedio: ag.valor / ag.frequencia,
    });
  }

  const recenciasOrdenadas = comHistorico.map(x => x.recencia).sort((a, b) => a - b);
  const frequenciasOrdenadas = comHistorico.map(x => x.frequencia).sort((a, b) => a - b);
  const valoresOrdenados = comHistorico.map(x => x.valor).sort((a, b) => a - b);

  const resultado = comHistorico.map(x => {
    const r = 6 - notaPorPercentil(recenciasOrdenadas, x.recencia); // recência menor = nota maior
    const f = notaPorPercentil(frequenciasOrdenadas, x.frequencia);
    const v = notaPorPercentil(valoresOrdenados, x.valor);
    const percentilValor = valoresOrdenados.length > 1
      ? Math.round((valoresOrdenados.filter(vv => vv <= x.valor).length / valoresOrdenados.length) * 100)
      : 100;
    return {
      id: x.cliente.id, nome: x.cliente.nome, telefone: x.cliente.telefone,
      total_gasto: x.valor, total_pedidos: x.frequencia, ticket_medio: x.ticketMedio,
      dias_desde_ultimo: x.recencia,
      rfv: { r, f, v, percentil_valor: percentilValor },
      segmento: segmentoDeRFV(r, f, v),
      recompensas_disponiveis: (x.cliente.recompensas_ganhas + (x.cliente.recompensas_bonus || 0)) - x.cliente.recompensas_usadas,
      aniversario: x.cliente.aniversario,
    };
  });

  for (const c of semHistorico) {
    resultado.push({
      id: c.id, nome: c.nome, telefone: c.telefone,
      total_gasto: 0, total_pedidos: 0, ticket_medio: 0, dias_desde_ultimo: null,
      rfv: null, segmento: 'novo',
      recompensas_disponiveis: (c.recompensas_ganhas + (c.recompensas_bonus || 0)) - c.recompensas_usadas,
      aniversario: c.aniversario,
    });
  }

  return resultado;
}

function buscarClienteRFV(id) {
  const base = calcularBaseRFV();
  return base.find(c => c.id === Number(id)) || null;
}

module.exports = { calcularBaseRFV, buscarClienteRFV };
