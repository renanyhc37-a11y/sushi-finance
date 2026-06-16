const { Router } = require('express');
const db = require('../db/database');

const router = Router();

const STATUS_VALIDOS = ['novo', 'espera', 'preparando', 'pronto', 'entregue', 'cancelado'];

// ── Camada 2: impressão idempotente ──────────────────────────
// Estado de impressão NO SERVIDOR. Sem isto, após uma queda/reload o PDV
// poderia reimprimir comandas já impressas (o desastre da Saipos). Com o
// flag, a impressão automática só dispara para quem NUNCA foi impresso.
try { db.exec("ALTER TABLE pdv_pedidos ADD COLUMN impresso INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE pdv_pedidos ADD COLUMN impresso_em TEXT"); } catch {}

// ── SSE: clientes conectados ──────────────────────────────────
const clientes = new Set();
const clientesPublicos = new Set(); // sem auth — para página de rastreio do cliente

function broadcast(evento, dados) {
  const msg = `event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`;
  clientes.forEach(res => { try { res.write(msg); } catch {} });
  // replica status para clientes públicos
  if (evento === 'status_atualizado') {
    clientesPublicos.forEach(res => { try { res.write(msg); } catch {} });
  }
}

// Handler SSE — exportado para ser registrado antes do requireAuth no index.js
function sseHandler(req, res) {
  const jwt = require('jsonwebtoken');
  const { SECRET } = require('../middleware/requireAuth');
  const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');
  try { jwt.verify(token, SECRET); } catch { return res.status(401).end(); }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write('event: conectado\ndata: {}\n\n');
  const heartbeat = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25000);

  clientes.add(res);
  req.on('close', () => { clientes.delete(res); clearInterval(heartbeat); });
}

// ─────────────────────────────────────────────────────────────

function pedidoComItens(pedido) {
  const itens = db.prepare('SELECT * FROM pdv_itens WHERE pedido_id = ? ORDER BY id').all(pedido.id);
  // Qual a POSIÇÃO deste pedido no histórico do cliente (1º, 2º, ... Nº) —
  // indicador de fidelidade/recorrência mostrado no card do PDV. Conta só os
  // pedidos até este (id <= ?), senão todos os pedidos do cliente mostrariam
  // o mesmo número (o total atual) em vez da posição de cada um.
  let cliente_total_pedidos = 0;
  if (pedido.cliente_telefone) {
    try {
      const r = db.prepare('SELECT COUNT(*) c FROM pdv_pedidos WHERE cliente_telefone = ? AND id <= ?').get(pedido.cliente_telefone, pedido.id);
      cliente_total_pedidos = r?.c || 0;
    } catch {}
  }
  return { ...pedido, itens, cliente_total_pedidos };
}

// GET /api/pdv/pedidos?status=novo&data=2026-06-06&unidade_id=1
router.get('/pedidos', (req, res) => {
  const { status, data, unidade_id } = req.query;
  let q = 'SELECT * FROM pdv_pedidos WHERE 1=1';
  const params = [];

  if (unidade_id) { q += ' AND (unidade_id = ? OR unidade_id IS NULL)'; params.push(Number(unidade_id)); }
  if (status && status !== 'todos') {
    q += ' AND status = ?';
    params.push(status);
  }
  if (data) {
    q += ' AND date(created_at) = ?';
    params.push(data);
  } else {
    q += " AND (date(created_at) = date('now') OR status IN ('novo','preparando','pronto'))";
  }

  q += ' ORDER BY created_at DESC';
  const pedidos = db.prepare(q).all(...params);
  res.json(pedidos.map(pedidoComItens));
});

// GET /api/pdv/pedidos/:id
router.get('/pedidos/:id', (req, res) => {
  const pedido = db.prepare('SELECT * FROM pdv_pedidos WHERE id = ?').get(req.params.id);
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
  res.json(pedidoComItens(pedido));
});

// ── Auto-deducao de estoque ───────────────────────────────────
function deduzirEstoque(pedidoId) {
  try {
    const itens = db.prepare('SELECT * FROM pdv_itens WHERE pedido_id = ?').all(pedidoId);
    for (const item of itens) {
      // Busca cardapio_item pelo nome
      const cItem = db.prepare('SELECT id FROM cardapio_itens WHERE nome = ? LIMIT 1').get(item.item_nome);
      if (!cItem) continue;
      // Busca ficha técnica desse item
      const ficha = db.prepare(`
        SELECT cft.*, i.nome as ing_nome, i.estoque_atual, i.custo_unitario
        FROM cardapio_ficha_tecnica cft
        JOIN ingredientes i ON i.id = cft.ingrediente_id
        WHERE cft.cardapio_item_id = ?
      `).all(cItem.id);
      for (const f of ficha) {
        const qtdDeduzir = f.quantidade * item.quantidade;
        const anterior = f.estoque_atual || 0;
        const nova = Math.max(0, anterior - qtdDeduzir);
        db.prepare('UPDATE ingredientes SET estoque_atual = ? WHERE id = ?').run(nova, f.ingrediente_id);
        db.prepare(`
          INSERT INTO estoque_movimentacoes (ingrediente_id, tipo, quantidade, quantidade_anterior, observacao, pedido_id)
          VALUES (?, 'saida', ?, ?, ?, ?)
        `).run(f.ingrediente_id, qtdDeduzir, anterior, `Pedido #${pedidoId} - ${item.item_nome}`, pedidoId);
      }
    }
  } catch (e) { console.error('[pdv] Erro ao deduzir estoque:', e.message); }
}

// PATCH /api/pdv/pedidos/:id/status
router.patch('/pedidos/:id/status', (req, res) => {
  const { status } = req.body;
  if (!STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ erro: `Status inválido. Use: ${STATUS_VALIDOS.join(', ')}` });
  }
  const pedido = db.prepare('SELECT * FROM pdv_pedidos WHERE id = ?').get(req.params.id);
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });

  db.prepare('UPDATE pdv_pedidos SET status = ? WHERE id = ?').run(status, req.params.id);

  // Carimba o horário da etapa (para métricas operacionais), só na 1ª vez
  const colTempo = { espera: 'aceito_em', preparando: 'aceito_em', pronto: 'pronto_em', entregue: 'entregue_em' }[status];
  if (colTempo && !pedido[colTempo]) {
    try { db.prepare(`UPDATE pdv_pedidos SET ${colTempo} = datetime('now') WHERE id = ?`).run(req.params.id); } catch {}
  }

  // Auto-dedução de estoque quando pedido vai para "preparando"
  if (status === 'preparando' && ['novo', 'espera'].includes(pedido.status)) {
    deduzirEstoque(pedido.id);
  }

  // Promoções: registra progresso quando pedido é entregue
  if (status === 'entregue' && pedido.status !== 'entregue') {
    try {
      const { registrarPedidoEntregue } = require('./promocoes');
      registrarPedidoEntregue(pedido.cliente_telefone);
    } catch (e) { console.error('[pdv] Erro ao registrar progresso de promoção:', e.message); }
  }

  // Notifica PDVs conectados
  broadcast('status_atualizado', { id: pedido.id, numero: pedido.numero, status });

  // WhatsApp
  const itens = db.prepare('SELECT * FROM pdv_itens WHERE pedido_id = ?').all(pedido.id);
  require('../services/whatsapp').notificarMudancaStatus({ ...pedido, itens }, status)
    .catch(err => console.error('[pdv] Erro ao notificar WhatsApp:', err.message));

  res.json({ ok: true, status });
});

// PATCH /api/pdv/pedidos/:id/impresso — marca (ou desmarca) comanda como impressa
// Idempotência: o PDV chama isto DEPOIS de mandar a comanda pra impressora.
// Numa recuperação, o front lê impresso=1 e NÃO reimprime. Reimpressão manual
// envia { impresso:false } para liberar nova impressão explícita.
router.patch('/pedidos/:id/impresso', (req, res) => {
  const pedido = db.prepare('SELECT id FROM pdv_pedidos WHERE id = ?').get(req.params.id);
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
  const marcar = req.body?.impresso !== false; // default: marca como impresso
  if (marcar) {
    db.prepare("UPDATE pdv_pedidos SET impresso = 1, impresso_em = datetime('now') WHERE id = ?").run(req.params.id);
  } else {
    db.prepare("UPDATE pdv_pedidos SET impresso = 0, impresso_em = NULL WHERE id = ?").run(req.params.id);
  }
  broadcast('impresso_atualizado', { id: Number(req.params.id), impresso: marcar ? 1 : 0 });
  res.json({ ok: true, impresso: marcar ? 1 : 0 });
});

// PATCH /api/pdv/pedidos/:id/pix-confirmado — atendente conferiu o crédito no banco
router.patch('/pedidos/:id/pix-confirmado', (req, res) => {
  const pedido = db.prepare('SELECT id FROM pdv_pedidos WHERE id = ?').get(req.params.id);
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });
  db.prepare("UPDATE pdv_pedidos SET pix_confirmado_em = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// DELETE /api/pdv/pedidos/:id
router.delete('/pedidos/:id', (req, res) => {
  db.prepare('DELETE FROM pdv_pedidos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/pdv/metricas-operacionais?dias=7&limite=60
// Tempos médios de preparo/entrega e pedidos atrasados.
router.get('/metricas-operacionais', (req, res) => {
  const dias = Math.max(1, Math.min(90, Number(req.query.dias) || 7));
  const limite = Number(req.query.limite) || 60; // min para considerar "atrasado"
  const desde = `-${dias} days`;

  const m = db.prepare(`
    SELECT
      AVG(CASE WHEN pronto_em IS NOT NULL THEN (julianday(pronto_em) - julianday(created_at)) * 1440 END) as prep,
      AVG(CASE WHEN pronto_em IS NOT NULL AND entregue_em IS NOT NULL THEN (julianday(entregue_em) - julianday(pronto_em)) * 1440 END) as entrega,
      AVG(CASE WHEN entregue_em IS NOT NULL THEN (julianday(entregue_em) - julianday(created_at)) * 1440 END) as total,
      COUNT(CASE WHEN entregue_em IS NOT NULL THEN 1 END) as entregues,
      COUNT(CASE WHEN entregue_em IS NOT NULL AND (julianday(entregue_em) - julianday(created_at)) * 1440 > ? THEN 1 END) as atrasados
    FROM pdv_pedidos
    WHERE status != 'cancelado' AND date(created_at) >= date('now', ?)
  `).get(limite, desde);

  const r = v => v == null ? null : Math.round(v);
  res.json({
    dias,
    limite_atraso: limite,
    prep_medio: r(m.prep),
    entrega_media: r(m.entrega),
    total_medio: r(m.total),
    entregues: m.entregues || 0,
    atrasados: m.atrasados || 0,
  });
});

// GET /api/pdv/resumo
router.get('/resumo', (req, res) => {
  const rows = db.prepare(
    "SELECT status, COUNT(*) as total FROM pdv_pedidos WHERE date(created_at) = date('now') OR status IN ('novo','preparando','pronto') GROUP BY status"
  ).all();
  const resumo = { novo: 0, preparando: 0, pronto: 0, entregue: 0, cancelado: 0 };
  rows.forEach(r => { if (resumo[r.status] !== undefined) resumo[r.status] = r.total; });
  res.json(resumo);
});

// GET /api/pdv/stats?dias=7
// Retorna: ticket médio, total de pedidos, top itens, faturamento por dia, comparativo
router.get('/stats', (req, res) => {
  const dias = Math.min(parseInt(req.query.dias) || 7, 90);
  try {
    // Faturamento e pedidos por dia (últimos N dias)
    const porDia = db.prepare(`
      SELECT date(created_at) as dia,
             COUNT(*) as total_pedidos,
             COALESCE(SUM(total), 0) as faturamento
      FROM pdv_pedidos
      WHERE status != 'cancelado'
        AND date(created_at) >= date('now', ? || ' days')
      GROUP BY dia ORDER BY dia ASC
    `).all(`-${dias}`);

    // Ticket médio global
    const ticketRow = db.prepare(`
      SELECT AVG(total) as ticket_medio, COUNT(*) as total_pedidos, SUM(total) as total_faturado
      FROM pdv_pedidos
      WHERE status != 'cancelado'
        AND date(created_at) >= date('now', ? || ' days')
    `).get(`-${dias}`);

    // Comparativo período anterior
    const anterior = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total_faturado, COUNT(*) as total_pedidos
      FROM pdv_pedidos
      WHERE status != 'cancelado'
        AND date(created_at) >= date('now', ? || ' days')
        AND date(created_at) < date('now', ? || ' days')
    `).get(`-${dias * 2}`, `-${dias}`);

    // Top 5 itens mais vendidos
    const topItens = db.prepare(`
      SELECT i.item_nome, SUM(i.quantidade) as total_qtd, SUM(i.quantidade * i.valor_unitario) as total_valor
      FROM pdv_itens i
      JOIN pdv_pedidos p ON p.id = i.pedido_id
      WHERE p.status != 'cancelado'
        AND date(p.created_at) >= date('now', ? || ' days')
      GROUP BY i.item_nome ORDER BY total_qtd DESC LIMIT 5
    `).all(`-${dias}`);

    // Forma de pagamento
    const pagamentos = db.prepare(`
      SELECT forma_pagamento, COUNT(*) as total, SUM(total) as valor
      FROM pdv_pedidos
      WHERE status != 'cancelado'
        AND date(created_at) >= date('now', ? || ' days')
        AND forma_pagamento IS NOT NULL
      GROUP BY forma_pagamento ORDER BY total DESC
    `).all(`-${dias}`);

    res.json({
      dias,
      ticket_medio: ticketRow.ticket_medio ? parseFloat(ticketRow.ticket_medio.toFixed(2)) : 0,
      total_pedidos: ticketRow.total_pedidos || 0,
      total_faturado: ticketRow.total_faturado || 0,
      comparativo: {
        faturado_anterior: anterior.total_faturado || 0,
        pedidos_anterior: anterior.total_pedidos || 0,
      },
      por_dia: porDia,
      top_itens: topItens,
      pagamentos,
    });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// GET /api/pdv/relatorio?inicio=2026-01-01&fim=2026-06-30
router.get('/relatorio', (req, res) => {
  const { inicio, fim } = req.query;
  if (!inicio || !fim) return res.status(400).json({ erro: 'inicio e fim são obrigatórios' });
  try {
    const pedidos = db.prepare(`
      SELECT p.*,
        GROUP_CONCAT(i.quantidade || 'x ' || i.item_nome, ' | ') as itens_resumo
      FROM pdv_pedidos p
      LEFT JOIN pdv_itens i ON i.pedido_id = p.id
      WHERE date(p.created_at) BETWEEN ? AND ?
      GROUP BY p.id ORDER BY p.created_at DESC
    `).all(inicio, fim);

    const totais = db.prepare(`
      SELECT COUNT(*) as total_pedidos,
             COALESCE(SUM(total),0) as total_faturado,
             COALESCE(AVG(total),0) as ticket_medio,
             SUM(CASE WHEN status='cancelado' THEN 1 ELSE 0 END) as cancelados
      FROM pdv_pedidos WHERE date(created_at) BETWEEN ? AND ?
    `).get(inicio, fim);

    res.json({ pedidos, totais, inicio, fim });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// GET /api/pdv/cliente/:telefone/historico — últimos pedidos do cliente
router.get('/cliente/:telefone/historico', (req, res) => {
  try {
    const tel = req.params.telefone.replace(/\D/g, '');
    const pedidos = db.prepare(`
      SELECT p.id, p.numero, p.total, p.status, p.forma_pagamento, p.created_at,
             GROUP_CONCAT(i.quantidade || 'x ' || i.item_nome, ' | ') as itens_resumo
      FROM pdv_pedidos p
      LEFT JOIN pdv_itens i ON i.pedido_id = p.id
      WHERE replace(replace(replace(p.cliente_telefone,' ',''),'-',''),'(','') LIKE '%' || ? || '%'
        AND p.status != 'cancelado'
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT 8
    `).all(tel.slice(-8));
    res.json(pedidos);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// GET /api/pdv/metricas-hoje — faturamento e contagens em tempo real do dia
router.get('/metricas-hoje', (req, res) => {
  try {
    const row = db.prepare(`
      SELECT
        COUNT(*) as total_pedidos,
        COALESCE(SUM(total), 0) as faturamento,
        COALESCE(SUM(CASE WHEN forma_pagamento='pix'      THEN total ELSE 0 END), 0) as pix,
        COALESCE(SUM(CASE WHEN forma_pagamento='dinheiro' THEN total ELSE 0 END), 0) as dinheiro,
        COALESCE(SUM(CASE WHEN forma_pagamento='credito'  THEN total ELSE 0 END), 0) as credito,
        COALESCE(SUM(CASE WHEN forma_pagamento='debito'   THEN total ELSE 0 END), 0) as debito,
        COUNT(CASE WHEN status='cancelado' THEN 1 END) as cancelados
      FROM pdv_pedidos
      WHERE date(created_at, 'localtime') = date('now', 'localtime')
        AND status != 'cancelado'
    `).get();
    res.json(row);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// POST /api/pdv/pedido — operador lança pedido manualmente (sem restrições de loja aberta/bairro)
router.post('/pedido', (req, res) => {
  try {
    const { cliente_nome, cliente_telefone, cliente_endereco, bairro, observacao,
            forma_pagamento, tipo_entrega, itens, troco_para, frete = 0 } = req.body;

    if (!cliente_nome?.trim()) return res.status(400).json({ erro: 'Nome obrigatório' });
    if (!Array.isArray(itens) || itens.length === 0) return res.status(400).json({ erro: 'Nenhum item' });

    // Busca preços reais — nunca confia no valor vindo do frontend
    const buscaItem = db.prepare('SELECT id, nome, preco FROM cardapio_itens WHERE id = ?');
    const itensValidos = [];
    for (const i of itens) {
      const qtd = Math.max(1, Math.floor(Number(i.quantidade) || 1));
      const ref = buscaItem.get(Number(i.item_id));
      if (!ref) return res.status(400).json({ erro: `Item #${i.item_id} não encontrado` });
      itensValidos.push({ item_nome: ref.nome, quantidade: qtd, valor_unitario: Number(ref.preco) });
    }

    const subtotal = itensValidos.reduce((s, i) => s + i.valor_unitario * i.quantidade, 0);
    const total = subtotal + Number(frete || 0);

    // Numeração
    const getCfg = k => db.prepare('SELECT valor FROM config WHERE chave=?').get(k)?.valor;
    let numero;
    const comandaProx = getCfg('comanda_proximo');
    if (comandaProx != null && String(comandaProx).trim() !== '') {
      numero = Math.max(1, parseInt(comandaProx, 10) || 1);
      db.prepare("INSERT OR REPLACE INTO config (chave,valor) VALUES ('comanda_proximo',?)").run(String(numero + 1));
    } else {
      const hoje = new Date().toISOString().slice(0, 10);
      const ultimo = db.prepare("SELECT MAX(numero) as n FROM pdv_pedidos WHERE date(created_at)=?").get(hoje);
      numero = (ultimo?.n || 0) + 1;
    }

    const ehRetirada = tipo_entrega === 'retirada';
    const trocoPara = (forma_pagamento === 'dinheiro' && Number(troco_para) > total) ? Number(troco_para) : null;
    const enderecoFinal = ehRetirada ? 'Retirada no balcão' : (cliente_endereco?.trim() || '');

    const { lastInsertRowid: pedidoId } = db.prepare(
      `INSERT INTO pdv_pedidos
         (numero, cliente_nome, cliente_telefone, cliente_endereco, bairro, observacao,
          forma_pagamento, total, frete, troco_para, tipo_entrega)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`
    ).run(numero, cliente_nome.trim(), cliente_telefone?.trim() || null,
          enderecoFinal, bairro?.trim() || null, observacao?.trim() || null,
          forma_pagamento || null, total, Number(frete || 0), trocoPara, ehRetirada ? 'retirada' : 'entrega');

    const insItem = db.prepare('INSERT INTO pdv_itens (pedido_id, item_nome, quantidade, valor_unitario) VALUES (?,?,?,?)');
    itensValidos.forEach(i => insItem.run(pedidoId, i.item_nome, i.quantidade, i.valor_unitario));

    // Atualiza/cria cliente na base
    if (cliente_telefone?.trim()) {
      const tel = cliente_telefone.replace(/\D/g, '');
      const existing = db.prepare('SELECT * FROM clientes WHERE telefone=?').get(tel);
      if (existing) {
        // Fidelidade básica (10 pedidos) só avança se não há promoção customizada de pedidos ativa
        const temPromoAtiva = db.prepare("SELECT COUNT(*) as n FROM promocoes WHERE tipo='pedidos' AND ativo=1").get().n > 0;
        const PEDIDOS_POR_RECOMPENSA = 10;
        const novo_total = existing.total_pedidos + 1;
        db.prepare(`UPDATE clientes SET nome=?, endereco=?, total_pedidos=?,
          recompensas_ganhas=?, updated_at=CURRENT_TIMESTAMP WHERE telefone=?`)
          .run(cliente_nome.trim(), enderecoFinal, novo_total,
               temPromoAtiva ? existing.recompensas_ganhas : Math.floor(novo_total / PEDIDOS_POR_RECOMPENSA), tel);
      } else {
        db.prepare(`INSERT INTO clientes (telefone, nome, endereco, total_pedidos, recompensas_ganhas)
          VALUES (?,?,?,1,0)`).run(tel, cliente_nome.trim(), enderecoFinal);
      }
    }

    const pedido = db.prepare('SELECT * FROM pdv_pedidos WHERE id=?').get(pedidoId);
    pedido.itens = itensValidos;
    pedido.cliente_total_pedidos = 1;

    broadcast('novo_pedido', pedido);
    res.status(201).json(pedido);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// SSE público — sem autenticação, só recebe status_atualizado
function ssePublicoHandler(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();
  res.write('event: conectado\ndata: {}\n\n');
  const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25000);
  clientesPublicos.add(res);
  req.on('close', () => { clientesPublicos.delete(res); clearInterval(hb); });
}

module.exports = { router, broadcast, sseHandler, ssePublicoHandler };
