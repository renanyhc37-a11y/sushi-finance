const { Router } = require('express');
const db = require('../db/database');
const router = Router();

// ── Migrações ─────────────────────────────────────────────────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingrediente_id INTEGER NOT NULL REFERENCES ingredientes(id),
      tipo TEXT NOT NULL CHECK(tipo IN ('entrada','saida','ajuste')),
      quantidade REAL NOT NULL,
      quantidade_anterior REAL,
      observacao TEXT,
      pedido_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS cardapio_ficha_tecnica (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cardapio_item_id INTEGER NOT NULL REFERENCES cardapio_itens(id) ON DELETE CASCADE,
      ingrediente_id INTEGER NOT NULL REFERENCES ingredientes(id) ON DELETE CASCADE,
      quantidade REAL NOT NULL,
      UNIQUE(cardapio_item_id, ingrediente_id)
    );
  `);
} catch (e) { console.error('dashboard migration:', e.message); }

// Tabela de composição de itens (sub-receitas / combos)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cardapio_composicao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_pai_id INTEGER NOT NULL REFERENCES cardapio_itens(id) ON DELETE CASCADE,
      item_filho_id INTEGER NOT NULL REFERENCES cardapio_itens(id) ON DELETE CASCADE,
      quantidade REAL NOT NULL DEFAULT 1,
      UNIQUE(item_pai_id, item_filho_id)
    );
  `);
} catch (e) { console.error('composicao migration:', e.message); }

// Adiciona coluna estoque_minimo se não existir
try { db.exec('ALTER TABLE ingredientes ADD COLUMN estoque_minimo REAL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE ingredientes ADD COLUMN estoque_ideal REAL DEFAULT 0'); } catch {}

// ── Helpers ───────────────────────────────────────────────────
const hoje = () => new Date().toISOString().slice(0, 10);
const mesAtual = () => new Date().toISOString().slice(0, 7);
const semanaAtras = () => {
  const d = new Date(); d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
};
const mesAtras = () => {
  const d = new Date(); d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
};

// ── GET /api/dashboard — todos os KPIs em tempo real ─────────
router.get('/', (req, res) => {
  const agora = hoje();
  const mes   = mesAtual();
  const semana = semanaAtras();
  const ultimos30 = mesAtras();

  // ── VENDAS HOJE (PDV) ──────────────────────────────────────
  const vendasHoje = db.prepare(`
    SELECT
      COUNT(*) as total_pedidos,
      COALESCE(SUM(total), 0) as faturamento,
      COALESCE(SUM(CASE WHEN forma_pagamento='pix' THEN total ELSE 0 END), 0) as pix,
      COALESCE(SUM(CASE WHEN forma_pagamento='dinheiro' THEN total ELSE 0 END), 0) as dinheiro,
      COALESCE(SUM(CASE WHEN forma_pagamento LIKE 'cartao%' THEN total ELSE 0 END), 0) as cartao,
      COALESCE(AVG(total), 0) as ticket_medio
    FROM pdv_pedidos
    WHERE DATE(created_at) = ? AND status != 'cancelado'
  `).get(agora);

  // ── PEDIDOS POR STATUS (ao vivo) ──────────────────────────
  const pedidosAtivos = db.prepare(`
    SELECT status, COUNT(*) as qtd
    FROM pdv_pedidos
    WHERE DATE(created_at) = ? AND status NOT IN ('entregue','cancelado')
    GROUP BY status
  `).all(agora);

  // ── FATURAMENTO ÚLTIMOS 7 DIAS ─────────────────────────────
  const ultimos7dias = db.prepare(`
    SELECT DATE(created_at) as dia,
           COUNT(*) as pedidos,
           COALESCE(SUM(total), 0) as total
    FROM pdv_pedidos
    WHERE DATE(created_at) >= ? AND status != 'cancelado'
    GROUP BY dia ORDER BY dia
  `).all(semana);

  // ── FATURAMENTO MÊS ATUAL ─────────────────────────────────
  // Combina o faturamento lançado manualmente (página Faturamento Diário)
  // com os pedidos do cardápio online (PDV) dos dias que ainda não foram
  // lançados manualmente — evitando dupla contagem por dia.
  const fatManual = db.prepare(`
    SELECT COALESCE(SUM(total_bruto), 0) as total,
           COALESCE(SUM(quantidade_pedidos), 0) as pedidos
    FROM faturamento_diario WHERE substr(data, 1, 7) = ?
  `).get(mes);

  const fatPdvSemManual = db.prepare(`
    SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as pedidos
    FROM pdv_pedidos
    WHERE strftime('%Y-%m', created_at) = ? AND status != 'cancelado'
      AND DATE(created_at) NOT IN (SELECT data FROM faturamento_diario)
  `).get(mes);

  const fatMes = {
    total:   (fatManual.total || 0) + (fatPdvSemManual.total || 0),
    pedidos: (fatManual.pedidos || 0) + (fatPdvSemManual.pedidos || 0),
  };

  // ── TOP ITENS VENDIDOS (últimos 30 dias) ──────────────────
  const topItens = db.prepare(`
    SELECT pi.item_nome,
           SUM(pi.quantidade) as qtd_vendida,
           SUM(pi.quantidade * pi.valor_unitario) as receita
    FROM pdv_itens pi
    JOIN pdv_pedidos pp ON pp.id = pi.pedido_id
    WHERE DATE(pp.created_at) >= ? AND pp.status != 'cancelado'
    GROUP BY pi.item_nome
    ORDER BY qtd_vendida DESC LIMIT 10
  `).all(ultimos30);

  // ── DESPESAS DO MÊS ───────────────────────────────────────
  const despesasMes = db.prepare(`
    SELECT
      COALESCE(SUM(valor), 0) as total,
      COALESCE(SUM(CASE WHEN categoria='fixo' THEN valor ELSE 0 END), 0) as fixas,
      COALESCE(SUM(CASE WHEN categoria='variavel' THEN valor ELSE 0 END), 0) as variaveis
    FROM despesas WHERE strftime('%Y-%m', data_competencia) = ?
  `).get(mes);

  // ── BOLETOS PENDENTES ─────────────────────────────────────
  const boletosPendentes = db.prepare(`
    SELECT COUNT(*) as qtd, COALESCE(SUM(valor_total), 0) as total
    FROM boletos WHERE status = 'pendente'
  `).get();

  const boletosVencendo = db.prepare(`
    SELECT id, fornecedor, descricao, valor_total, data_vencimento
    FROM boletos
    WHERE status = 'pendente' AND data_vencimento <= date('now', '+7 days')
    ORDER BY data_vencimento LIMIT 5
  `).all();

  // ── ESTOQUE ───────────────────────────────────────────────
  const estoqueCritico = db.prepare(`
    SELECT id, nome, unidade_medida, estoque_atual, estoque_minimo, estoque_ideal, custo_unitario
    FROM ingredientes
    WHERE estoque_atual <= estoque_minimo
    ORDER BY (estoque_atual - estoque_minimo) ASC
  `).all();

  const estoqueBaixo = db.prepare(`
    SELECT id, nome, unidade_medida, estoque_atual, estoque_minimo, estoque_ideal
    FROM ingredientes
    WHERE estoque_atual > estoque_minimo AND estoque_ideal > 0 AND estoque_atual < estoque_ideal * 0.5
    ORDER BY estoque_atual ASC LIMIT 8
  `).all();

  const totalIngredientes = db.prepare(`
    SELECT COUNT(*) as qtd,
           COALESCE(SUM(estoque_atual * custo_unitario), 0) as valor_total_estoque
    FROM ingredientes
  `).get();

  // ── CMV ESTIMADO (últimos 30 dias via ficha técnica) ──────
  // Tenta calcular custo dos itens vendidos via pdv_itens → cardapio_ficha_tecnica
  const cmvEstimado = db.prepare(`
    SELECT COALESCE(SUM(pi.quantidade * cft.quantidade * i.custo_unitario), 0) as cmv
    FROM pdv_itens pi
    JOIN pdv_pedidos pp ON pp.id = pi.pedido_id
    JOIN cardapio_itens ci ON ci.nome = pi.item_nome
    JOIN cardapio_ficha_tecnica cft ON cft.cardapio_item_id = ci.id
    JOIN ingredientes i ON i.id = cft.ingrediente_id
    WHERE DATE(pp.created_at) >= ? AND pp.status != 'cancelado'
  `).get(ultimos30);

  // ── CLIENTES ──────────────────────────────────────────────
  const clientesStats = db.prepare(`
    SELECT
      COUNT(*) as total_clientes,
      COUNT(CASE WHEN DATE(created_at) >= ? THEN 1 END) as novos_mes
    FROM clientes
  `).get(ultimos30);

  const clientesRecorrentes = db.prepare(`
    SELECT COUNT(*) as qtd FROM clientes WHERE total_pedidos >= 3
  `).get();

  // ── MOVIMENTAÇÕES DE ESTOQUE RECENTES ────────────────────
  const movimentacoesRecentes = db.prepare(`
    SELECT em.*, i.nome as ingrediente_nome, i.unidade_medida
    FROM estoque_movimentacoes em
    JOIN ingredientes i ON i.id = em.ingrediente_id
    ORDER BY em.created_at DESC LIMIT 20
  `).all();

  // ── ÚLTIMAS COMPRAS DE INGREDIENTES ──────────────────────
  const ultimasCompras = db.prepare(`
    SELECT ci.*, i.nome as ingrediente_nome, i.unidade_medida
    FROM compras_ingredientes ci
    JOIN ingredientes i ON i.id = ci.ingrediente_id
    ORDER BY ci.created_at DESC LIMIT 10
  `).all();

  // ── LUCRO ESTIMADO DO MÊS ─────────────────────────────────
  const lucroEstimado = fatMes.total - despesasMes.total - (cmvEstimado.cmv || 0);
  const margemEstimada = fatMes.total > 0
    ? ((lucroEstimado / fatMes.total) * 100).toFixed(1)
    : 0;

  // ── PROJEÇÃO DO MÊS ───────────────────────────────────────
  const hoje2 = new Date();
  const diaAtual = hoje2.getDate();
  const diasNoMes = new Date(hoje2.getFullYear(), hoje2.getMonth() + 1, 0).getDate();
  const diasRestantes = diasNoMes - diaAtual;
  const mediaDiaria = diaAtual > 0 ? fatMes.total / diaAtual : 0;
  const projecaoMes = mediaDiaria * diasNoMes;

  // ── TICKET MÉDIO DO MÊS ───────────────────────────────────
  const ticketMesPdv = db.prepare(`
    SELECT COALESCE(AVG(total), 0) as ticket
    FROM pdv_pedidos
    WHERE strftime('%Y-%m', created_at) = ? AND status != 'cancelado'
  `).get(mes);

  // ── HORÁRIO DE PICO (últimos 7 dias) ──────────────────────
  const horarioPico = db.prepare(`
    SELECT strftime('%H', created_at) as hora, COUNT(*) as pedidos
    FROM pdv_pedidos
    WHERE DATE(created_at) >= ? AND status != 'cancelado'
    GROUP BY hora ORDER BY pedidos DESC LIMIT 6
  `).all(semana);

  // ── EVOLUÇÃO 30 DIAS (diária) ─────────────────────────────
  const evolucao30d = db.prepare(`
    SELECT DATE(created_at) as dia, COUNT(*) as pedidos, COALESCE(SUM(total),0) as total
    FROM pdv_pedidos
    WHERE DATE(created_at) >= ? AND status != 'cancelado'
    GROUP BY dia ORDER BY dia
  `).all(ultimos30);

  res.json({
    gerado_em: new Date().toISOString(),
    vendas_hoje: vendasHoje,
    pedidos_ativos: pedidosAtivos,
    ultimos7dias,
    faturamento_mes: fatMes,
    meta_faturamento: Number(db.prepare("SELECT valor FROM config WHERE chave='meta_faturamento_mes'").get()?.valor || 0),
    top_itens: topItens,
    despesas_mes: despesasMes,
    boletos: { pendentes: boletosPendentes, vencendo: boletosVencendo },
    estoque: {
      critico: estoqueCritico,
      baixo: estoqueBaixo,
      total_ingredientes: totalIngredientes.qtd,
      valor_total_estoque: totalIngredientes.valor_total_estoque,
    },
    cmv_estimado_mes: cmvEstimado.cmv || 0,
    lucro_estimado_mes: lucroEstimado,
    margem_estimada: Number(margemEstimada),
    clientes: { ...clientesStats, recorrentes: clientesRecorrentes.qtd },
    movimentacoes_recentes: movimentacoesRecentes,
    ultimas_compras: ultimasCompras,
    projecao: {
      dia_atual: diaAtual,
      dias_no_mes: diasNoMes,
      dias_restantes: diasRestantes,
      media_diaria: parseFloat(mediaDiaria.toFixed(2)),
      projecao_mes: parseFloat(projecaoMes.toFixed(2)),
    },
    ticket_medio_mes: parseFloat((ticketMesPdv.ticket || 0).toFixed(2)),
    horario_pico: horarioPico,
    evolucao30d,
  });
});

// ── GET /api/dashboard/estoque — estoque completo ─────────────
router.get('/estoque', (req, res) => {
  const itens = db.prepare(`
    SELECT i.*,
      (SELECT COALESCE(SUM(CASE WHEN tipo='entrada' THEN quantidade WHEN tipo='saida' THEN -quantidade ELSE quantidade END), 0)
       FROM estoque_movimentacoes WHERE ingrediente_id = i.id
       AND created_at >= date('now', '-30 days')) as movimentacao_30d,
      (SELECT created_at FROM estoque_movimentacoes WHERE ingrediente_id = i.id ORDER BY created_at DESC LIMIT 1) as ultima_movimentacao
    FROM ingredientes i
    ORDER BY
      CASE WHEN i.estoque_atual <= i.estoque_minimo THEN 0
           WHEN i.estoque_ideal > 0 AND i.estoque_atual < i.estoque_ideal * 0.5 THEN 1
           ELSE 2 END,
      i.nome
  `).all();

  res.json(itens);
});

// ── POST /api/dashboard/estoque/entrada ───────────────────────
router.post('/estoque/entrada', (req, res) => {
  const { ingrediente_id, quantidade, observacao, preco_total } = req.body;
  if (!ingrediente_id || !quantidade) return res.status(400).json({ erro: 'ingrediente_id e quantidade obrigatórios' });

  const ing = db.prepare('SELECT * FROM ingredientes WHERE id = ?').get(ingrediente_id);
  if (!ing) return res.status(404).json({ erro: 'Ingrediente não encontrado' });

  const anterior = ing.estoque_atual || 0;
  const nova = anterior + Number(quantidade);

  db.transaction(() => {
    db.prepare('UPDATE ingredientes SET estoque_atual = ? WHERE id = ?').run(nova, ingrediente_id);
    db.prepare(`
      INSERT INTO estoque_movimentacoes (ingrediente_id, tipo, quantidade, quantidade_anterior, observacao)
      VALUES (?, 'entrada', ?, ?, ?)
    `).run(ingrediente_id, Number(quantidade), anterior, observacao || null);

    // Registra também em compras_ingredientes se tiver preco
    if (preco_total) {
      const custo_unitario = Number(preco_total) / Number(quantidade);
      db.prepare(`
        INSERT INTO compras_ingredientes (ingrediente_id, data, quantidade, preco_total, custo_unitario)
        VALUES (?, date('now','localtime'), ?, ?, ?)
      `).run(ingrediente_id, Number(quantidade), Number(preco_total), custo_unitario);
      // Atualiza custo unitário do ingrediente
      db.prepare('UPDATE ingredientes SET custo_unitario = ? WHERE id = ?').run(custo_unitario, ingrediente_id);
    }
  })();

  res.json({ ok: true, estoque_atual: nova });
});

// ── POST /api/dashboard/estoque/ajuste ────────────────────────
router.post('/estoque/ajuste', (req, res) => {
  const { ingrediente_id, quantidade_nova, observacao } = req.body;
  if (!ingrediente_id || quantidade_nova === undefined) return res.status(400).json({ erro: 'Parâmetros inválidos' });

  const ing = db.prepare('SELECT * FROM ingredientes WHERE id = ?').get(ingrediente_id);
  if (!ing) return res.status(404).json({ erro: 'Ingrediente não encontrado' });

  const anterior = ing.estoque_atual || 0;
  const diff = Number(quantidade_nova) - anterior;

  db.transaction(() => {
    db.prepare('UPDATE ingredientes SET estoque_atual = ? WHERE id = ?').run(Number(quantidade_nova), ingrediente_id);
    db.prepare(`
      INSERT INTO estoque_movimentacoes (ingrediente_id, tipo, quantidade, quantidade_anterior, observacao)
      VALUES (?, 'ajuste', ?, ?, ?)
    `).run(ingrediente_id, diff, anterior, observacao || 'Ajuste manual');
  })();

  res.json({ ok: true, estoque_atual: Number(quantidade_nova) });
});

// ── PATCH /api/dashboard/ingredientes/:id/limites ─────────────
router.patch('/ingredientes/:id/limites', (req, res) => {
  const { estoque_minimo, estoque_ideal } = req.body;
  db.prepare('UPDATE ingredientes SET estoque_minimo = ?, estoque_ideal = ? WHERE id = ?')
    .run(estoque_minimo ?? 0, estoque_ideal ?? 0, req.params.id);
  res.json({ ok: true });
});

// ── GET/POST/DELETE cardapio_ficha_tecnica ────────────────────
router.get('/ficha/:cardapio_item_id', (req, res) => {
  const itens = db.prepare(`
    SELECT cft.*, i.nome as ingrediente_nome, i.unidade_medida, i.custo_unitario, i.estoque_atual
    FROM cardapio_ficha_tecnica cft
    JOIN ingredientes i ON i.id = cft.ingrediente_id
    WHERE cft.cardapio_item_id = ?
  `).all(req.params.cardapio_item_id);
  res.json(itens);
});

router.post('/ficha', (req, res) => {
  const { cardapio_item_id, ingrediente_id, quantidade } = req.body;
  if (!cardapio_item_id || !ingrediente_id || !quantidade) return res.status(400).json({ erro: 'Parâmetros obrigatórios' });
  db.prepare(`
    INSERT INTO cardapio_ficha_tecnica (cardapio_item_id, ingrediente_id, quantidade)
    VALUES (?, ?, ?)
    ON CONFLICT(cardapio_item_id, ingrediente_id) DO UPDATE SET quantidade = excluded.quantidade
  `).run(cardapio_item_id, ingrediente_id, Number(quantidade));
  res.status(201).json({ ok: true });
});

router.delete('/ficha/:id', (req, res) => {
  db.prepare('DELETE FROM cardapio_ficha_tecnica WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── GET /api/dashboard/composicao/:item_id — sub-itens do combo ─
// Retorna cada item filho com seu custo unitário calculado recursivamente
router.get('/composicao/:item_id', (req, res) => {
  const linhas = db.prepare(`
    SELECT cc.id, cc.item_filho_id, cc.quantidade,
           ci.nome AS filho_nome, ci.preco AS filho_preco,
           ci.emoji AS filho_emoji
    FROM cardapio_composicao cc
    JOIN cardapio_itens ci ON ci.id = cc.item_filho_id
    WHERE cc.item_pai_id = ?
    ORDER BY ci.nome
  `).all(req.params.item_id);

  // Para cada filho, calcula o custo da ficha técnica
  const result = linhas.map(l => {
    const custo_unit = _custoFilho(l.item_filho_id);
    return { ...l, custo_unit, custo_total: custo_unit * l.quantidade };
  });
  res.json(result);
});

// Custo de um item (ingredientes diretos + sub-composições, 1 nível)
function _custoFilho(itemId) {
  const direto = db.prepare(`
    SELECT COALESCE(SUM(cft.quantidade * i.custo_unitario), 0) AS c
    FROM cardapio_ficha_tecnica cft
    JOIN ingredientes i ON i.id = cft.ingrediente_id
    WHERE cft.cardapio_item_id = ?
  `).get(itemId);

  const composicao = db.prepare(`
    SELECT cc.quantidade, cc.item_filho_id
    FROM cardapio_composicao cc
    WHERE cc.item_pai_id = ?
  `).all(itemId);

  const custoSub = composicao.reduce((s, c) => {
    const sub = db.prepare(`
      SELECT COALESCE(SUM(cft.quantidade * i.custo_unitario), 0) AS c
      FROM cardapio_ficha_tecnica cft
      JOIN ingredientes i ON i.id = cft.ingrediente_id
      WHERE cft.cardapio_item_id = ?
    `).get(c.item_filho_id);
    return s + (sub?.c || 0) * c.quantidade;
  }, 0);

  return (direto?.c || 0) + custoSub;
}

// ── POST /api/dashboard/composicao ────────────────────────────
router.post('/composicao', (req, res) => {
  const { item_pai_id, item_filho_id, quantidade } = req.body;
  if (!item_pai_id || !item_filho_id || !quantidade) return res.status(400).json({ erro: 'Parâmetros obrigatórios' });
  if (item_pai_id === item_filho_id) return res.status(400).json({ erro: 'Um item não pode compor a si mesmo' });
  db.prepare(`
    INSERT INTO cardapio_composicao (item_pai_id, item_filho_id, quantidade)
    VALUES (?, ?, ?)
    ON CONFLICT(item_pai_id, item_filho_id) DO UPDATE SET quantidade = excluded.quantidade
  `).run(Number(item_pai_id), Number(item_filho_id), Number(quantidade));
  res.status(201).json({ ok: true });
});

// ── DELETE /api/dashboard/composicao/:id ──────────────────────
router.delete('/composicao/:id', (req, res) => {
  db.prepare('DELETE FROM cardapio_composicao WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
