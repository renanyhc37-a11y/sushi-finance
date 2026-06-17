const { Router } = require('express');
const db = require('../db/database');

const router = Router();

const PEDIDOS_POR_RECOMPENSA = 10;

function calcFidelidade(total_pedidos, recompensas_ganhas, recompensas_usadas) {
  const recompensas_disponiveis = recompensas_ganhas - recompensas_usadas;
  const pedidos_no_ciclo = total_pedidos % PEDIDOS_POR_RECOMPENSA;
  const proximo_em = PEDIDOS_POR_RECOMPENSA - pedidos_no_ciclo;
  return { total_pedidos, recompensas_ganhas, recompensas_usadas, recompensas_disponiveis, pedidos_no_ciclo, proximo_em };
}

function comFidelidade(c) {
  return { ...c, fidelidade: calcFidelidade(c.total_pedidos, c.recompensas_ganhas, c.recompensas_usadas) };
}

// GET /api/clientes — lista todos
router.get('/', (req, res) => {
  const clientes = db.prepare('SELECT * FROM clientes ORDER BY updated_at DESC').all();
  res.json(clientes.map(comFidelidade));
});

// GET /api/clientes/aniversarios?dias=30 — próximos aniversários
// aniversario é armazenado como 'MM-DD'. Calcula dias até a próxima
// ocorrência e devolve ordenado, dentro da janela pedida.
router.get('/aniversarios', (req, res) => {
  const dias = Math.min(366, Math.max(1, Number(req.query.dias) || 30));
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const rows = db.prepare(
    "SELECT id, nome, telefone, aniversario, total_pedidos FROM clientes WHERE aniversario IS NOT NULL AND aniversario <> ''"
  ).all();

  const lista = [];
  for (const c of rows) {
    const m = /^(\d{2})-(\d{2})$/.exec(c.aniversario);
    if (!m) continue;
    const mes = Number(m[1]) - 1, dia = Number(m[2]);
    let prox = new Date(hoje.getFullYear(), mes, dia);
    if (prox < hoje) prox = new Date(hoje.getFullYear() + 1, mes, dia);
    const faltam = Math.round((prox - hoje) / 86400000);
    if (faltam <= dias) {
      lista.push({
        id: c.id, nome: c.nome, telefone: c.telefone, total_pedidos: c.total_pedidos,
        aniversario: c.aniversario, dia, mes: mes + 1, dias_para: faltam,
        hoje: faltam === 0,
        data_label: `${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}`,
      });
    }
  }
  lista.sort((a, b) => a.dias_para - b.dias_para);
  res.json(lista);
});

// PATCH /api/clientes/:id — atualiza campos editáveis do cliente
router.patch('/:id', (req, res) => {
  const { nome, endereco, bairro, email, observacao, aniversario } = req.body;
  // aniversario esperado em formato 'MM-DD' ou 'DD/MM' → normaliza para 'MM-DD'
  let aniv = null;
  if (aniversario) {
    const m1 = /^(\d{2})[\/\-](\d{2})$/.exec(aniversario.trim());
    if (m1) {
      // detecta se veio DD/MM (dia <= 31, mês <= 12) — armazena MM-DD
      const a = Number(m1[1]), b = Number(m1[2]);
      if (a <= 12 && b <= 31) aniv = `${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`;
      else if (b <= 12)       aniv = `${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`;
    }
  }
  const c = db.prepare('SELECT id FROM clientes WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ erro: 'Cliente não encontrado' });
  db.prepare(`UPDATE clientes SET
    nome = COALESCE(NULLIF(?, ''), nome),
    endereco = COALESCE(NULLIF(?, ''), endereco),
    bairro = COALESCE(NULLIF(?, ''), bairro),
    email = COALESCE(NULLIF(?, ''), email),
    observacao = COALESCE(NULLIF(?, ''), observacao),
    aniversario = ?,
    updated_at = CURRENT_TIMESTAMP
    WHERE id = ?`
  ).run(nome || '', endereco || '', bairro || '', email || '', observacao || '', aniv, req.params.id);
  const atualizado = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  res.json(atualizado);
});

// GET /api/clientes/:id/perfil — análise comportamental completa do cliente
router.get('/:id/perfil', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

  const tel = cliente.telefone;

  // Todos os pedidos não-cancelados
  const pedidos = db.prepare(`
    SELECT p.id, p.numero, p.total, p.forma_pagamento, p.tipo_entrega,
           p.created_at, p.status, p.desconto, p.frete, p.bairro,
           p.cliente_endereco
    FROM pdv_pedidos p
    WHERE p.cliente_telefone = ? AND p.status != 'cancelado'
    ORDER BY p.created_at ASC
  `).all(tel);

  const pedidosCancelados = db.prepare(
    "SELECT COUNT(*) as n FROM pdv_pedidos WHERE cliente_telefone = ? AND status = 'cancelado'"
  ).get(tel).n;

  if (!pedidos.length) {
    return res.json({ cliente: comFidelidade(cliente), pedidos: [], perfil: null, pedidosCancelados });
  }

  // Itens de todos os pedidos
  const ids = pedidos.map(p => p.id);
  const itens = db.prepare(`
    SELECT pi.pedido_id, pi.item_nome, pi.quantidade, pi.valor_unitario
    FROM pdv_itens pi WHERE pi.pedido_id IN (${ids.map(() => '?').join(',')})
  `).all(...ids);

  // ── Métricas gerais ──────────────────────────────────────────
  const totais = pedidos.map(p => p.total);
  const totalGasto = totais.reduce((s, v) => s + v, 0);
  const ticketMedio = totalGasto / pedidos.length;
  const ticketMaximo = Math.max(...totais);
  const ticketMinimo = Math.min(...totais);

  // ── Recência / frequência ────────────────────────────────────
  const datas = pedidos.map(p => new Date(p.created_at + (p.created_at.includes('T') ? '' : 'Z')));
  const primeiro = datas[0];
  const ultimo = datas[datas.length - 1];
  const diasCliente = Math.max(1, Math.round((ultimo - primeiro) / 86400000));
  const diasDesdeUltimo = Math.round((Date.now() - ultimo) / 86400000);

  let intervaloMedioArr = [];
  for (let i = 1; i < datas.length; i++) {
    intervaloMedioArr.push(Math.round((datas[i] - datas[i - 1]) / 86400000));
  }
  const intervaloMedio = intervaloMedioArr.length
    ? Math.round(intervaloMedioArr.reduce((s, v) => s + v, 0) / intervaloMedioArr.length)
    : null;

  // ── Dias da semana ───────────────────────────────────────────
  const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const diasSemana = Array(7).fill(0);
  datas.forEach(d => diasSemana[d.getDay()]++);
  const diaCampeao = diasSemana.indexOf(Math.max(...diasSemana));

  // ── Horários ─────────────────────────────────────────────────
  const horas = Array(24).fill(0);
  datas.forEach(d => horas[d.getHours()]++);
  const horaCampeao = horas.indexOf(Math.max(...horas));

  // ── Forma de pagamento ───────────────────────────────────────
  const pgto = {};
  pedidos.forEach(p => { pgto[p.forma_pagamento || 'outro'] = (pgto[p.forma_pagamento || 'outro'] || 0) + 1; });
  const pgtoFavorito = Object.entries(pgto).sort((a, b) => b[1] - a[1])[0]?.[0];

  // ── Tipo de entrega ──────────────────────────────────────────
  const retiradas = pedidos.filter(p => p.tipo_entrega === 'retirada').length;
  const entregas = pedidos.length - retiradas;

  // ── Itens mais pedidos ───────────────────────────────────────
  const contItens = {};
  itens.forEach(i => {
    if (!contItens[i.item_nome]) contItens[i.item_nome] = { nome: i.item_nome, qtd: 0, gasto: 0 };
    contItens[i.item_nome].qtd += i.quantidade;
    contItens[i.item_nome].gasto += i.quantidade * i.valor_unitario;
  });
  const itensFavoritos = Object.values(contItens)
    .sort((a, b) => b.qtd - a.qtd)
    .slice(0, 8);

  // ── Evolução mensal ──────────────────────────────────────────
  const porMes = {};
  pedidos.forEach(p => {
    const mes = p.created_at.slice(0, 7);
    if (!porMes[mes]) porMes[mes] = { mes, pedidos: 0, gasto: 0 };
    porMes[mes].pedidos++;
    porMes[mes].gasto += p.total;
  });
  const evolucaoMensal = Object.values(porMes).sort((a, b) => a.mes.localeCompare(b.mes)).slice(-12);

  // ── Segmentação RFM simplificada ─────────────────────────────
  let segmento = 'novo';
  if (pedidos.length >= 10 && diasDesdeUltimo <= 30) segmento = 'fiel';
  else if (pedidos.length >= 5 && diasDesdeUltimo <= 14) segmento = 'recorrente';
  else if (pedidos.length >= 10 && diasDesdeUltimo > 60) segmento = 'em_risco';
  else if (diasDesdeUltimo > 90) segmento = 'inativo';
  else if (pedidos.length >= 3) segmento = 'regular';

  // ── Tendência (últimos 3 meses vs 3 meses anteriores) ────────
  const agora = Date.now();
  const ultimos3 = pedidos.filter(p => agora - new Date(p.created_at).getTime() < 90 * 86400000);
  const anteriores3 = pedidos.filter(p => {
    const d = agora - new Date(p.created_at).getTime();
    return d >= 90 * 86400000 && d < 180 * 86400000;
  });
  const tendencia = anteriores3.length === 0 ? 'subindo'
    : ultimos3.length > anteriores3.length ? 'subindo'
    : ultimos3.length < anteriores3.length ? 'caindo'
    : 'estavel';

  res.json({
    cliente: comFidelidade(cliente),
    pedidosCancelados,
    perfil: {
      totalPedidos: pedidos.length,
      totalGasto,
      ticketMedio,
      ticketMaximo,
      ticketMinimo,
      primeiro: primeiro.toISOString(),
      ultimo: ultimo.toISOString(),
      diasCliente,
      diasDesdeUltimo,
      intervaloMedio,
      diasSemana: diasSemana.map((v, i) => ({ dia: DIAS[i], pedidos: v })),
      diaCampeao: DIAS[diaCampeao],
      horas: horas.map((v, h) => ({ hora: h, pedidos: v })),
      horaCampeao,
      pgto,
      pgtoFavorito,
      retiradas,
      entregas,
      itensFavoritos,
      evolucaoMensal,
      segmento,
      tendencia,
    },
    pedidos: pedidos.slice(-20).reverse(), // últimos 20 para o histórico
  });
});

// GET /api/clientes/:id/pedidos — histórico de pedidos do cliente
router.get('/:id/pedidos', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

  const pedidos = db.prepare(`
    SELECT p.*, GROUP_CONCAT(i.quantidade || 'x ' || i.item_nome, ', ') as itens_resumo
    FROM pdv_pedidos p
    LEFT JOIN pdv_itens i ON i.pedido_id = p.id
    WHERE p.cliente_telefone = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT 50
  `).all(cliente.telefone);

  res.json(pedidos);
});

// POST /api/clientes/:id/resgatar — marca um brinde como usado
router.post('/:id/resgatar', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

  const disponiveis = cliente.recompensas_ganhas - cliente.recompensas_usadas;
  if (disponiveis <= 0) return res.status(400).json({ erro: 'Nenhum brinde disponível' });

  db.prepare('UPDATE clientes SET recompensas_usadas = recompensas_usadas + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(cliente.id);

  const atualizado = db.prepare('SELECT * FROM clientes WHERE id = ?').get(cliente.id);
  res.json({ ok: true, cliente: comFidelidade(atualizado) });
});

module.exports = router;
