const { Router } = require('express');
const db = require('../db/database');
const faturamentoDia = require('../lib/faturamentoDia');

const router = Router();

function getMes(mes) {
  return mes || new Date().toISOString().slice(0, 7);
}

function ultimoDiaDoMes(mes) {
  const [ano, m] = mes.split('-').map(Number);
  const ultimo = new Date(ano, m, 0).getDate();
  return `${mes}-${String(ultimo).padStart(2, '0')}`;
}

// ── Tabela de custo manual por item (override da ficha técnica) ───
try { db.exec("CREATE TABLE IF NOT EXISTS cmv_custo_direto (item_nome TEXT PRIMARY KEY, custo_unit REAL NOT NULL, updated_at TEXT DEFAULT (datetime('now')))"); } catch {}

// ── CMV real: custo dos itens efetivamente vendidos no mês ────
// Vendas vêm dos pedidos do PDV (pdv_itens). O custo de cada item sai da
// ficha técnica do cardápio (cardapio_ficha_tecnica × custo do ingrediente).
// Itens sem ficha entram com custo 0 (e são listados como "sem ficha").
// Custo recursivo: ingredientes diretos + sub-composições (até 2 níveis)
function _custoItemCardapio(nome) {
  // Custo manual tem prioridade sobre ficha técnica
  const manual = db.prepare('SELECT custo_unit FROM cmv_custo_direto WHERE item_nome = ?').get(nome);
  if (manual) return { c: manual.custo_unit, tem_ficha: 1, manual: true };
  const item = db.prepare('SELECT id FROM cardapio_itens WHERE nome = ? LIMIT 1').get(nome);
  if (!item) return { c: 0, tem_ficha: 0 };
  return { c: _custoById(item.id), tem_ficha: _temFicha(item.id) };
}

function _temFicha(itemId) {
  const direto = db.prepare('SELECT COUNT(*) AS n FROM cardapio_ficha_tecnica WHERE cardapio_item_id = ?').get(itemId).n;
  const comp   = db.prepare('SELECT COUNT(*) AS n FROM cardapio_composicao WHERE item_pai_id = ?').get(itemId).n;
  return direto + comp;
}

function _custoById(itemId, _visited = new Set()) {
  if (_visited.has(itemId)) return 0; // evita ciclos
  _visited.add(itemId);

  // Custo manual (cmv_custo_direto) tem prioridade — atalho por nome do item.
  // Garante que combos somem o custo manual dos sub-itens, não só ingredientes.
  const nome = db.prepare('SELECT nome FROM cardapio_itens WHERE id = ?').get(itemId)?.nome;
  if (nome) {
    const manual = db.prepare('SELECT custo_unit FROM cmv_custo_direto WHERE item_nome = ?').get(nome);
    if (manual) return manual.custo_unit;
  }

  const direto = db.prepare(`
    SELECT COALESCE(SUM(cft.quantidade * i.custo_unitario), 0) AS c
    FROM cardapio_ficha_tecnica cft
    JOIN ingredientes i ON i.id = cft.ingrediente_id
    WHERE cft.cardapio_item_id = ?
  `).get(itemId)?.c || 0;

  const filhos = db.prepare('SELECT item_filho_id, quantidade FROM cardapio_composicao WHERE item_pai_id = ?').all(itemId);
  const composicao = filhos.reduce((s, f) => s + _custoById(f.item_filho_id, new Set(_visited)) * f.quantidade, 0);

  return direto + composicao;
}

function vendasDoMes(mes) {
  return db.prepare(`
    SELECT pi.item_nome AS nome, SUM(pi.quantidade) AS qtd,
           SUM(pi.quantidade * pi.valor_unitario) AS receita
    FROM pdv_itens pi JOIN pdv_pedidos pp ON pp.id = pi.pedido_id
    WHERE substr(pp.created_at,1,7) = ? AND pp.status != 'cancelado'
    GROUP BY pi.item_nome ORDER BY qtd DESC
  `).all(mes);
}

function cmvDoMes(mes) {
  let cmv = 0;
  for (const v of vendasDoMes(mes)) {
    const r = _custoItemCardapio(v.nome);
    cmv += (r?.c || 0) * v.qtd;
  }
  return cmv;
}

router.get('/dashboard', (req, res) => {
  try {
    const mes = getMes(req.query.mes);
    const fatRow = db.prepare(`
      SELECT COUNT(*) as total_dias,
             COALESCE(SUM(total_bruto), 0) as faturamento_bruto,
             COALESCE(SUM(taxa_cartao), 0) as total_taxas
      FROM faturamento_diario WHERE substr(data, 1, 7) = ?
    `).get(mes);
    const despRow = db.prepare(`
      SELECT COALESCE(SUM(valor), 0) as total_despesas
      FROM despesas WHERE substr(data_competencia, 1, 7) = ?
    `).get(mes);
    const faturamento_bruto = fatRow.faturamento_bruto;
    const faturamento_liquido = faturamento_bruto - fatRow.total_taxas;
    const cmv_total = cmvDoMes(mes);
    const cmv_pct = faturamento_bruto > 0 ? (cmv_total / faturamento_bruto) * 100 : 0;
    const lucro_bruto = faturamento_liquido - cmv_total;
    const lucro_liquido = lucro_bruto - despRow.total_despesas;
    const ticket_medio = fatRow.total_dias > 0 ? faturamento_bruto / fatRow.total_dias : 0;
    res.json({
      mes, faturamento_bruto, faturamento_liquido,
      total_pedidos: fatRow.total_dias,
      ticket_medio: parseFloat(ticket_medio.toFixed(2)),
      lucro_bruto,
      lucro_liquido,
      cmv_total: parseFloat(cmv_total.toFixed(2)),
      cmv_pct: parseFloat(cmv_pct.toFixed(2)),
      taxa_cartao: fatRow.total_taxas,
      despesas_operacionais: despRow.total_despesas,
    });
  } catch (e) { console.error('dashboard:', e); res.status(500).json({ erro: e.message }); }
});

router.get('/dre', (req, res) => {
  try {
    const mes = getMes(req.query.mes);
    const fatRow = db.prepare(`
      SELECT COALESCE(SUM(total_bruto),0) as faturamento_bruto,
             COALESCE(SUM(taxa_cartao),0) as total_taxas,
             COALESCE(SUM(pix),0) as total_pix,
             COALESCE(SUM(dinheiro),0) as total_dinheiro,
             COALESCE(SUM(credito),0) as total_credito,
             COALESCE(SUM(debito),0) as total_debito
      FROM faturamento_diario WHERE substr(data, 1, 7) = ?
    `).get(mes);
    const despesas = db.prepare(`
      SELECT categoria, COALESCE(SUM(valor),0) as total
      FROM despesas WHERE substr(data_competencia, 1, 7) = ?
      GROUP BY categoria
    `).all(mes);
    const fixas = despesas.find(d => d.categoria === 'fixo')?.total || 0;
    const variaveis = despesas.find(d => d.categoria === 'variavel')?.total || 0;
    const faturamento_liquido = fatRow.faturamento_bruto - fatRow.total_taxas;
    const cmv_total = cmvDoMes(mes);
    const cmv_pct = fatRow.faturamento_bruto > 0 ? (cmv_total / fatRow.faturamento_bruto) * 100 : 0;
    const lucro_bruto = faturamento_liquido - cmv_total;
    res.json({
      mes,
      faturamento_bruto: fatRow.faturamento_bruto,
      taxa_cartao: fatRow.total_taxas,
      faturamento_liquido,
      cmv_total: parseFloat(cmv_total.toFixed(2)),
      cmv_pct: parseFloat(cmv_pct.toFixed(2)),
      lucro_bruto,
      despesas_fixas: fixas,
      despesas_variaveis: variaveis,
      total_despesas: fixas + variaveis,
      lucro_liquido: lucro_bruto - fixas - variaveis,
      pagamentos: { pix: fatRow.total_pix, dinheiro: fatRow.total_dinheiro, credito: fatRow.total_credito, debito: fatRow.total_debito },
    });
  } catch (e) { console.error('dre:', e); res.status(500).json({ erro: e.message }); }
});

router.get('/cmv-produtos', (req, res) => {
  try {
    const mes = getMes(req.query.mes);
    const linhas = vendasDoMes(mes).map(v => {
      const r = _custoItemCardapio(v.nome);
      const custo_unit = r?.c || 0;
      const sem_ficha = !r || !r.tem_ficha;
      const custo_total = custo_unit * v.qtd;
      const preco_medio = v.qtd > 0 ? v.receita / v.qtd : 0;
      const cmv = preco_medio > 0 ? (custo_unit / preco_medio) * 100 : 0;
      return {
        nome: v.nome, qtd: v.qtd, receita: v.receita,
        custo_unit, custo_total,
        preco_medio,
        cmv: parseFloat(cmv.toFixed(1)),
        margem: v.receita - custo_total,
        sem_ficha,
        custo_manual: !!r?.manual,
      };
    });
    res.json(linhas);
  } catch (e) { console.error('cmv-produtos:', e); res.status(500).json({ erro: e.message }); }
});

// GET /api/relatorios/cardapio-fichas — TODOS os itens do cardápio real + custo/CMV.
// É a "folha mestra": lista os 210 itens (e novos aparecem sozinhos), com custo
// vindo da ficha (ingredientes), do combo (composição, recursivo) ou manual.
router.get('/cardapio-fichas', (req, res) => {
  try {
    const itens = db.prepare(`
      SELECT ci.id, ci.nome, ci.preco, ci.emoji, ci.disponivel, c.nome AS categoria
      FROM cardapio_itens ci
      LEFT JOIN cardapio_categorias c ON c.id = ci.categoria_id
      ORDER BY c.ordem, ci.ordem, ci.nome
    `).all();
    const linhas = itens.map(it => {
      const r = _custoItemCardapio(it.nome);
      const custo_unit = r?.c || 0;
      const preco = it.preco || 0;
      const cmv = preco > 0 ? (custo_unit / preco) * 100 : 0;
      return {
        id: it.id, nome: it.nome, categoria: it.categoria || 'Sem categoria',
        emoji: it.emoji, disponivel: it.disponivel,
        preco_venda: preco, custo_unit,
        cmv: parseFloat(cmv.toFixed(1)),
        margem: preco - custo_unit,
        sem_ficha: !r || !r.tem_ficha,
        custo_manual: !!r?.manual,
      };
    });
    res.json(linhas);
  } catch (e) { console.error('cardapio-fichas:', e); res.status(500).json({ erro: e.message }); }
});

// GET /api/relatorios/cmv-produtos/:nome/ficha — retorna id do item + ingredientes + composição
router.get('/cmv-produtos/:nome/ficha', (req, res) => {
  try {
    const nome = decodeURIComponent(req.params.nome);
    const item = db.prepare('SELECT id, nome, preco FROM cardapio_itens WHERE nome = ? LIMIT 1').get(nome);
    if (!item) return res.json({ item: null, ficha: [], composicao: [] });
    const ficha = db.prepare(`
      SELECT cft.id, cft.ingrediente_id, cft.quantidade,
             i.nome as ingrediente_nome, i.unidade_medida, i.custo_unitario
      FROM cardapio_ficha_tecnica cft
      JOIN ingredientes i ON i.id = cft.ingrediente_id
      WHERE cft.cardapio_item_id = ?
    `).all(item.id);
    const composicao = db.prepare(`
      SELECT cc.id, cc.item_filho_id, cc.quantidade, ci.nome as filho_nome
      FROM cardapio_composicao cc
      JOIN cardapio_itens ci ON ci.id = cc.item_filho_id
      WHERE cc.item_pai_id = ?
    `).all(item.id);
    res.json({ item, ficha, composicao });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// PATCH /api/relatorios/cmv-produtos/:nome/custo — salva custo manual
router.patch('/cmv-produtos/:nome/custo', (req, res) => {
  try {
    const nome = decodeURIComponent(req.params.nome);
    const custo = parseFloat(req.body?.custo);
    if (isNaN(custo) || custo < 0) return res.status(400).json({ erro: 'Custo inválido' });
    if (custo === 0) {
      db.prepare('DELETE FROM cmv_custo_direto WHERE item_nome = ?').run(nome);
    } else {
      db.prepare("INSERT OR REPLACE INTO cmv_custo_direto (item_nome, custo_unit, updated_at) VALUES (?, ?, datetime('now'))").run(nome, custo);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

router.get('/evolucao', (req, res) => {
  try {
    const meses = db.prepare(`
      SELECT substr(data, 1, 7) as mes,
        SUM(total_bruto) as faturamento_bruto,
        COALESCE(SUM(taxa_cartao),0) as total_taxas,
        COUNT(*) as total_dias
      FROM faturamento_diario
      GROUP BY mes ORDER BY mes DESC LIMIT 12
    `).all();
    const resultado = meses.map(m => {
      const d = db.prepare(`SELECT COALESCE(SUM(valor),0) as t FROM despesas WHERE substr(data_competencia,1,7)=?`).get(m.mes);
      const liq = m.faturamento_bruto - m.total_taxas;
      return { mes: m.mes, faturamento_bruto: m.faturamento_bruto, total_pedidos: m.total_dias, cmv_total: 0, lucro_bruto: liq, lucro_liquido: liq - d.t };
    });
    res.json(resultado.reverse());
  } catch (e) { console.error('evolucao:', e); res.status(500).json({ erro: e.message }); }
});

// ── Itens com comparação mês anterior ─────────────────────────────────────────
router.get('/itens-comp', (req, res) => {
  try {
    const mes = getMes(req.query.mes);
    const [ano, m] = mes.split('-').map(Number);
    const prevDate = new Date(ano, m - 2, 1);
    const mesPrev = prevDate.toISOString().slice(0, 7);

    function enriquecer(vendas) {
      return vendas.map(v => {
        const r = _custoItemCardapio(v.nome);
        const custo_unit = r?.c || 0;
        const custo_total = custo_unit * v.qtd;
        const preco_medio = v.qtd > 0 ? v.receita / v.qtd : 0;
        const cmv_pct = preco_medio > 0 ? (custo_unit / preco_medio) * 100 : 0;
        const margem = v.receita - custo_total;
        const margem_pct = v.receita > 0 ? (margem / v.receita) * 100 : 0;
        return {
          nome: v.nome, qtd: v.qtd, receita: v.receita,
          custo_unit: parseFloat(custo_unit.toFixed(2)),
          custo_total: parseFloat(custo_total.toFixed(2)),
          preco_medio: parseFloat(preco_medio.toFixed(2)),
          cmv_pct: parseFloat(cmv_pct.toFixed(1)),
          margem: parseFloat(margem.toFixed(2)),
          margem_pct: parseFloat(margem_pct.toFixed(1)),
          sem_ficha: !r || !r.tem_ficha,
          custo_manual: !!r?.manual,
        };
      });
    }

    const atual = enriquecer(vendasDoMes(mes));
    const prevMap = enriquecer(vendasDoMes(mesPrev)).reduce((acc, v) => {
      acc[v.nome] = v; return acc;
    }, {});

    const diasRow = db.prepare(`
      SELECT COUNT(DISTINCT date(created_at)) as dias
      FROM pdv_pedidos WHERE substr(created_at,1,7)=? AND status!='cancelado'
    `).get(mes);

    const pedidosRow = db.prepare(`
      SELECT COUNT(*) as total FROM pdv_pedidos
      WHERE substr(created_at,1,7)=? AND status!='cancelado'
    `).get(mes);

    const itens = atual.map(item => ({
      ...item,
      prev_qtd: prevMap[item.nome]?.qtd || 0,
      prev_receita: prevMap[item.nome]?.receita || 0,
      prev_margem: prevMap[item.nome]?.margem || 0,
    }));

    // Itens vendidos no mês anterior mas não no atual
    const zerados = Object.values(prevMap)
      .filter(p => !atual.find(a => a.nome === p.nome))
      .map(p => ({
        nome: p.nome, qtd: 0, receita: 0, custo_unit: p.custo_unit,
        custo_total: 0, preco_medio: p.preco_medio, cmv_pct: p.cmv_pct,
        margem: 0, margem_pct: 0, sem_ficha: p.sem_ficha, custo_manual: p.custo_manual,
        prev_qtd: p.qtd, prev_receita: p.receita, prev_margem: p.margem,
      }));

    res.json({
      mes, mesPrev,
      dias_com_vendas: diasRow.dias || 0,
      total_pedidos: pedidosRow.total || 0,
      itens: [...itens, ...zerados],
    });
  } catch (e) { console.error('itens-comp:', e); res.status(500).json({ erro: e.message }); }
});

// ── Histórico mensal de um item específico ─────────────────────────────────────
router.get('/item-historico', (req, res) => {
  try {
    const nome = req.query.nome;
    if (!nome) return res.status(400).json({ erro: 'nome obrigatório' });
    const rows = db.prepare(`
      SELECT substr(pp.created_at,1,7) as mes,
             SUM(pi.quantidade) as qtd,
             SUM(pi.quantidade * pi.valor_unitario) as receita
      FROM pdv_itens pi JOIN pdv_pedidos pp ON pp.id = pi.pedido_id
      WHERE pi.item_nome = ? AND pp.status != 'cancelado'
      GROUP BY mes ORDER BY mes DESC LIMIT 6
    `).all(nome);
    res.json(rows.reverse());
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// Garante tabela config (pode ter sido criada pelo auth)
db.exec(`CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT NOT NULL)`);

router.get('/meta', (req, res) => {
  const mes = getMes(req.query.mes);
  const row = db.prepare('SELECT valor FROM config WHERE chave = ?').get(`meta_fat_${mes}`);
  res.json({ mes, meta: row ? parseFloat(row.valor) : 0 });
});

router.put('/meta', (req, res) => {
  const { mes, meta } = req.body;
  if (!mes || meta == null) return res.status(400).json({ erro: 'mes e meta obrigatórios' });
  db.prepare(`INSERT INTO config (chave, valor) VALUES (?, ?)
    ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`)
    .run(`meta_fat_${mes}`, String(meta));
  res.json({ ok: true });
});

// ── GET /api/relatorios/rentabilidade?dias=30 ────────────────
// Vendas do período com breakdown de insumos e lucro por produto
router.get('/rentabilidade', (req, res) => {
  try {
    const dias = Math.min(Math.max(parseInt(req.query.dias) || 30, 1), 365);
    const vendas = db.prepare(`
      SELECT pi.item_nome AS nome,
             SUM(pi.quantidade) AS qtd,
             SUM(pi.quantidade * pi.valor_unitario) AS receita
      FROM pdv_itens pi
      JOIN pdv_pedidos pp ON pp.id = pi.pedido_id
      WHERE pp.created_at >= datetime('now', '-' || ? || ' days')
        AND pp.status != 'cancelado'
      GROUP BY pi.item_nome
      ORDER BY receita DESC
    `).all(dias);

    const result = vendas.map(v => {
      const manual = db.prepare('SELECT custo_unit FROM cmv_custo_direto WHERE item_nome = ?').get(v.nome);
      const item   = db.prepare('SELECT id FROM cardapio_itens WHERE nome = ? LIMIT 1').get(v.nome);

      let insumos = [], custo_unit = 0, tem_ficha = false, custo_manual = false;

      if (manual) {
        custo_unit = manual.custo_unit;
        tem_ficha = true;
        custo_manual = true;
      } else if (item) {
        const ficha = db.prepare(`
          SELECT i.nome AS ingrediente, cft.quantidade, i.unidade_medida, i.custo_unitario,
                 cft.quantidade * i.custo_unitario AS custo_subtotal
          FROM cardapio_ficha_tecnica cft
          JOIN ingredientes i ON i.id = cft.ingrediente_id
          WHERE cft.cardapio_item_id = ?
        `).all(item.id);
        if (ficha.length > 0) {
          tem_ficha = true;
          custo_unit = ficha.reduce((s, f) => s + f.custo_subtotal, 0);
          insumos = ficha.map(f => ({
            nome: f.ingrediente,
            qtd_por_unidade: f.quantidade,
            qtd_total: parseFloat((f.quantidade * v.qtd).toFixed(3)),
            unidade: f.unidade_medida,
            custo_unit: f.custo_unitario,
            custo_total: parseFloat((f.custo_subtotal * v.qtd).toFixed(2)),
          }));
        }
      }

      const custo_total = parseFloat((custo_unit * v.qtd).toFixed(2));
      const lucro = parseFloat((v.receita - custo_total).toFixed(2));
      return {
        nome: v.nome, qtd: v.qtd,
        receita: parseFloat(v.receita.toFixed(2)),
        preco_medio: parseFloat((v.receita / v.qtd).toFixed(2)),
        custo_unit: parseFloat(custo_unit.toFixed(2)),
        custo_total, lucro,
        margem: v.receita > 0 ? parseFloat(((lucro / v.receita) * 100).toFixed(1)) : 0,
        cmv_pct: v.receita > 0 ? parseFloat(((custo_total / v.receita) * 100).toFixed(1)) : 0,
        tem_ficha, custo_manual, insumos,
      };
    });
    res.json(result);
  } catch (e) { console.error('rentabilidade:', e); res.status(500).json({ erro: e.message }); }
});

// Coleta recursiva dos ingredientes de um item (combo → sub-itens → ingredientes)
// Soma a quantidade de cada ingrediente por 1 unidade do produto.
function _coletarInsumos(itemId, fator, acc, visited) {
  if (visited.has(itemId)) return;
  visited.add(itemId);
  const dir = db.prepare(`
    SELECT cft.ingrediente_id AS id, cft.quantidade, i.nome, i.unidade_medida, i.custo_unitario
    FROM cardapio_ficha_tecnica cft JOIN ingredientes i ON i.id = cft.ingrediente_id
    WHERE cft.cardapio_item_id = ?
  `).all(itemId);
  for (const d of dir) {
    if (!acc[d.id]) acc[d.id] = { nome: d.nome, unidade: d.unidade_medida, custo_unitario: d.custo_unitario, qtd: 0 };
    acc[d.id].qtd += d.quantidade * fator;
  }
  const filhos = db.prepare('SELECT item_filho_id, quantidade FROM cardapio_composicao WHERE item_pai_id = ?').all(itemId);
  for (const f of filhos) _coletarInsumos(f.item_filho_id, fator * f.quantidade, acc, new Set(visited));
}

// ── Lista de produtos vendidos no período (para o seletor) ────
router.get('/produtos-vendidos', (req, res) => {
  try {
    const dias = Math.min(Math.max(parseInt(req.query.dias) || 90, 1), 365);
    const rows = db.prepare(`
      SELECT pi.item_nome AS nome, SUM(pi.quantidade) AS qtd,
             SUM(pi.quantidade * pi.valor_unitario) AS receita
      FROM pdv_itens pi JOIN pdv_pedidos pp ON pp.id = pi.pedido_id
      WHERE pp.created_at >= datetime('now', '-' || ? || ' days') AND pp.status != 'cancelado'
      GROUP BY pi.item_nome ORDER BY qtd DESC
    `).all(dias);
    res.json(rows);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ── Análise detalhada de UM produto ───────────────────────────
router.get('/produto', (req, res) => {
  try {
    const nome = (req.query.nome || '').trim();
    if (!nome) return res.status(400).json({ erro: 'Informe o produto' });
    const dias = Math.min(Math.max(parseInt(req.query.dias) || 30, 1), 365);

    const venda = db.prepare(`
      SELECT COALESCE(SUM(pi.quantidade),0) AS qtd,
             COALESCE(SUM(pi.quantidade*pi.valor_unitario),0) AS receita,
             COUNT(DISTINCT pp.id) AS pedidos
      FROM pdv_itens pi JOIN pdv_pedidos pp ON pp.id = pi.pedido_id
      WHERE pi.item_nome = ? AND pp.status != 'cancelado'
        AND pp.created_at >= datetime('now', '-' || ? || ' days')
    `).get(nome, dias);

    const qtd = venda.qtd || 0;
    const receita = venda.receita || 0;
    const preco_medio = qtd > 0 ? receita / qtd : 0;

    // Participação no faturamento total do período (todos os produtos)
    const totalPeriodo = db.prepare(`
      SELECT COALESCE(SUM(pi.quantidade*pi.valor_unitario),0) AS total
      FROM pdv_itens pi JOIN pdv_pedidos pp ON pp.id = pi.pedido_id
      WHERE pp.status != 'cancelado' AND pp.created_at >= datetime('now', '-' || ? || ' days')
    `).get(dias).total || 0;
    const participacao = totalPeriodo > 0 ? (receita / totalPeriodo) * 100 : 0;
    const media_dia = qtd / dias;

    const custoInfo = _custoItemCardapio(nome);
    const custo_unit = custoInfo.c || 0;
    const tem_custo = custo_unit > 0;
    const custo_total = custo_unit * qtd;
    const lucro = receita - custo_total;
    const margem = receita > 0 ? (lucro / receita) * 100 : null;
    const cmv_pct = receita > 0 ? (custo_total / receita) * 100 : null;

    // Série temporal por dia
    const por_dia = db.prepare(`
      SELECT date(pp.created_at, '-3 hours') AS dia,
             SUM(pi.quantidade) AS qtd,
             SUM(pi.quantidade*pi.valor_unitario) AS receita
      FROM pdv_itens pi JOIN pdv_pedidos pp ON pp.id = pi.pedido_id
      WHERE pi.item_nome = ? AND pp.status != 'cancelado'
        AND pp.created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY dia ORDER BY dia
    `).all(nome, dias).map(d => ({
      dia: d.dia, qtd: d.qtd,
      receita: parseFloat(d.receita.toFixed(2)),
      custo: parseFloat((custo_unit * d.qtd).toFixed(2)),
      lucro: parseFloat((d.receita - custo_unit * d.qtd).toFixed(2)),
    }));

    // Composição (sub-itens do combo) + insumos rolados
    const item = db.prepare('SELECT id FROM cardapio_itens WHERE nome = ? LIMIT 1').get(nome);
    let composicao = [], insumos = [];
    if (item) {
      composicao = db.prepare(`
        SELECT ci.id AS fid, ci.nome, cc.quantidade AS qtd_por_unid
        FROM cardapio_composicao cc JOIN cardapio_itens ci ON ci.id = cc.item_filho_id
        WHERE cc.item_pai_id = ?
      `).all(item.id).map(c => {
        const cu = _custoById(c.fid);
        return {
          nome: c.nome, qtd_por_unid: c.qtd_por_unid,
          custo_unit: parseFloat(cu.toFixed(2)),
          custo_total: parseFloat((cu * c.qtd_por_unid * qtd).toFixed(2)),
        };
      });
      const acc = {};
      _coletarInsumos(item.id, 1, acc, new Set());
      insumos = Object.values(acc).map(x => ({
        nome: x.nome, unidade: x.unidade,
        qtd_total: parseFloat((x.qtd * qtd).toFixed(3)),
        custo_total: parseFloat((x.qtd * x.custo_unitario * qtd).toFixed(2)),
      })).sort((a, b) => b.custo_total - a.custo_total);
    }

    res.json({
      nome, dias, qtd, pedidos: venda.pedidos || 0,
      receita: parseFloat(receita.toFixed(2)),
      preco_medio: parseFloat(preco_medio.toFixed(2)),
      custo_unit: parseFloat(custo_unit.toFixed(2)),
      custo_total: parseFloat(custo_total.toFixed(2)),
      lucro: parseFloat(lucro.toFixed(2)),
      margem: margem == null ? null : parseFloat(margem.toFixed(1)),
      cmv_pct: cmv_pct == null ? null : parseFloat(cmv_pct.toFixed(1)),
      tem_custo, custo_manual: !!custoInfo.manual,
      participacao: parseFloat(participacao.toFixed(1)),
      media_dia: parseFloat(media_dia.toFixed(2)),
      lucro_unit: parseFloat((preco_medio - custo_unit).toFixed(2)),
      por_dia, composicao, insumos,
    });
  } catch (e) { console.error('produto:', e); res.status(500).json({ erro: e.message }); }
});

// ── Centro de Comando — visão ao vivo do dia ──────────────────
router.get('/centro-comando', (req, res) => {
  try {
    const HOJE = "date(created_at, '-3 hours') = date('now', '-3 hours')";
    const ped = db.prepare(`
      SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS fat, COALESCE(AVG(total),0) AS ticket
      FROM pdv_pedidos WHERE ${HOJE} AND status != 'cancelado'
    `).get();

    // Custo (CMV) dos itens vendidos hoje
    const itensHoje = db.prepare(`
      SELECT pi.item_nome AS nome, SUM(pi.quantidade) AS qtd
      FROM pdv_itens pi JOIN pdv_pedidos pp ON pp.id = pi.pedido_id
      WHERE date(pp.created_at,'-3 hours') = date('now','-3 hours') AND pp.status != 'cancelado'
      GROUP BY pi.item_nome
    `).all();
    let custo = 0, comCusto = 0;
    for (const it of itensHoje) { const r = _custoItemCardapio(it.nome); if (r?.c) { custo += r.c * it.qtd; comCusto++; } }

    const fat = ped.fat || 0;
    const lucro = fat - custo;
    const margem = fat > 0 ? (lucro / fat) * 100 : 0;

    const cli = db.prepare(`
      SELECT COUNT(DISTINCT cliente_telefone) AS n FROM pdv_pedidos
      WHERE ${HOJE} AND status != 'cancelado' AND cliente_telefone IS NOT NULL AND cliente_telefone != ''
    `).get();

    const porHora = db.prepare(`
      SELECT CAST(strftime('%H', datetime(created_at,'-3 hours')) AS INTEGER) AS hora, COUNT(*) AS pedidos
      FROM pdv_pedidos WHERE ${HOJE} AND status != 'cancelado' GROUP BY hora ORDER BY hora
    `).all();

    const top = db.prepare(`
      SELECT pi.item_nome AS nome, SUM(pi.quantidade*pi.valor_unitario) AS receita, SUM(pi.quantidade) AS qtd
      FROM pdv_itens pi JOIN pdv_pedidos pp ON pp.id = pi.pedido_id
      WHERE date(pp.created_at,'-3 hours') = date('now','-3 hours') AND pp.status != 'cancelado'
      GROUP BY pi.item_nome ORDER BY receita DESC LIMIT 4
    `).all();

    const ontem = db.prepare(`
      SELECT COUNT(*) AS n FROM pdv_pedidos
      WHERE date(created_at,'-3 hours') = date('now','-3 hours','-1 day') AND status != 'cancelado'
    `).get();
    const varPedidos = ontem.n > 0 ? ((ped.n - ontem.n) / ontem.n) * 100 : null;

    res.json({
      faturamento: parseFloat(fat.toFixed(2)),
      custo: parseFloat(custo.toFixed(2)),
      lucro: parseFloat(lucro.toFixed(2)),
      margem: parseFloat(margem.toFixed(1)),
      pedidos: ped.n,
      ticket: parseFloat((ped.ticket || 0).toFixed(2)),
      clientes: cli.n,
      var_pedidos: varPedidos == null ? null : Math.round(varPedidos),
      tem_custo: custo > 0,
      por_hora: porHora,
      top: top.map(t => ({ nome: t.nome, receita: parseFloat(t.receita.toFixed(2)), qtd: t.qtd })),
    });
  } catch (e) { console.error('centro-comando:', e); res.status(500).json({ erro: e.message }); }
});

// ── PAINEL DO DONO: Entrou × Saiu × Sobrou (visão de caixa) ──────
//  Fonte da verdade = pedidos do PDV (faturamento, nº pedidos, ticket REAIS).
//  Visão de CAIXA: ENTROU (vendas) − SAIU (despesas + compras de mercadoria)
//  = SOBROU. CMV entra só como indicador de eficiência (não soma no caixa,
//  pra não contar a mercadoria duas vezes). Compara com o mês anterior.
function mesAnterior(mes) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(a, m - 2, 1); // m-2 = mês anterior (0-index)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function resumoCaixaMes(mes) {
  // Reconciliado: usa o lançamento manual/importado do dia quando existe,
  // senão os pedidos do PDV — mesma regra do Dashboard e da tela Faturamento
  // (ver lib/faturamentoDia). Sem isso, faturamento importado de outro PDV
  // some do Painel do Dono por não ter pedido real associado.
  const fat = faturamentoDia.somar(faturamentoDia.porDia(`${mes}-01`, ultimoDiaDoMes(mes)));
  const desp = db.prepare(`
    SELECT COALESCE(SUM(CASE WHEN categoria='fixo' THEN valor ELSE 0 END),0) fixas,
           COALESCE(SUM(CASE WHEN categoria!='fixo' THEN valor ELSE 0 END),0) variaveis,
           COALESCE(SUM(valor),0) total
    FROM despesas WHERE substr(data_competencia,1,7)=?
  `).get(mes);
  const insumo = db.prepare("SELECT COALESCE(SUM(valor_total),0) t FROM insumo_entrada WHERE substr(data,1,7)=?").get(mes).t;
  const saiu = desp.total + insumo;
  const entrou = fat.total;
  return {
    entrou, pedidos: fat.pedidos,
    ticket_medio: fat.pedidos > 0 ? entrou / fat.pedidos : 0,
    despesas_fixas: desp.fixas, despesas_variaveis: desp.variaveis, compras_mercadoria: insumo,
    saiu, sobrou: entrou - saiu,
    margem_pct: entrou > 0 ? ((entrou - saiu) / entrou) * 100 : 0,
  };
}

router.get('/painel-dono', (req, res) => {
  try {
    const mes = getMes(req.query.mes);
    const ant = mesAnterior(mes);
    const cur = resumoCaixaMes(mes);
    const prev = resumoCaixaMes(ant);

    // CMV (eficiência) — mesma base PDV
    const cmv = cmvDoMes(mes);
    const semFicha = vendasDoMes(mes).filter(v => !_custoItemCardapio(v.nome).tem_ficha);

    // Contexto: melhor dia de venda, maior despesa, dias com venda
    // (mesma base reconciliada de resumoCaixaMes — conta dias só com
    // lançamento manual/importado também, não só pedidos reais do PDV)
    const diasMes = faturamentoDia.porDia(`${mes}-01`, ultimoDiaDoMes(mes));
    const melhorDia = diasMes.length
      ? diasMes.reduce((a, b) => (b.total > a.total ? b : a))
      : null;
    const diasComVenda = diasMes.length;
    const maiorGasto = db.prepare(`
      SELECT descricao, valor, categoria FROM despesas
      WHERE substr(data_competencia,1,7)=? ORDER BY valor DESC LIMIT 1
    `).get(mes);

    const delta = (a, b) => (b > 0 ? ((a - b) / b) * 100 : (a > 0 ? 100 : 0));

    res.json({
      mes, mes_anterior: ant,
      entrou: { total: cur.entrou, pedidos: cur.pedidos, ticket_medio: cur.ticket_medio },
      saiu: {
        total: cur.saiu, despesas_fixas: cur.despesas_fixas,
        despesas_variaveis: cur.despesas_variaveis, compras_mercadoria: cur.compras_mercadoria,
        maior_gasto: maiorGasto || null,
      },
      sobrou: { total: cur.sobrou, margem_pct: cur.margem_pct },
      cmv: {
        total: cmv, pct: cur.entrou > 0 ? (cmv / cur.entrou) * 100 : 0,
        itens_sem_ficha: semFicha.length,
        // CMV só é calculável item a item (ficha técnica), então só cobre
        // pedidos reais do PDV/cardápio — faturamento importado de outro
        // PDV não entra aqui por não trazer os itens vendidos.
        apenas_pedidos_pdv: true,
      },
      contexto: {
        melhor_dia: melhorDia ? { dia: melhorDia.data, total: melhorDia.total } : null,
        dias_com_venda: diasComVenda,
        vs_anterior: {
          entrou: delta(cur.entrou, prev.entrou),
          saiu: delta(cur.saiu, prev.saiu),
          sobrou: delta(cur.sobrou, prev.sobrou),
        },
      },
      anterior: { entrou: prev.entrou, saiu: prev.saiu, sobrou: prev.sobrou },
    });
  } catch (e) { console.error('painel-dono:', e); res.status(500).json({ erro: e.message }); }
});

// ── GET /api/relatorios/despesas-analise?mes=YYYY-MM ──────────
// Breakdown do mês por categoria/tipo + evolução dos últimos 12 meses.
// Usado pela aba Despesas do Dashboard unificado.
router.get('/despesas-analise', (req, res) => {
  try {
    const mes = getMes(req.query.mes);
    const porCategoria = db.prepare(`
      SELECT categoria, COALESCE(SUM(valor),0) as total
      FROM despesas WHERE substr(data_competencia,1,7) = ?
      GROUP BY categoria ORDER BY total DESC
    `).all(mes);
    const porTipo = db.prepare(`
      SELECT COALESCE(NULLIF(tipo,''), 'Sem tipo') as tipo, COALESCE(SUM(valor),0) as total
      FROM despesas WHERE substr(data_competencia,1,7) = ?
      GROUP BY tipo ORDER BY total DESC
    `).all(mes);

    const [anoAtual, mesAtualNum] = mes.split('-').map(Number);
    const evolucao = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(anoAtual, mesAtualNum - 1 - i, 1);
      const mesRef = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const row = db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN categoria='fixo' THEN valor ELSE 0 END),0) as fixas,
               COALESCE(SUM(CASE WHEN categoria!='fixo' THEN valor ELSE 0 END),0) as variaveis,
               COALESCE(SUM(valor),0) as total
        FROM despesas WHERE substr(data_competencia,1,7) = ?
      `).get(mesRef);
      evolucao.push({ mes: mesRef, fixas: row.fixas, variaveis: row.variaveis, total: row.total });
    }

    res.json({ mes, por_categoria: porCategoria, por_tipo: porTipo, evolucao });
  } catch (e) { console.error('despesas-analise:', e); res.status(500).json({ erro: e.message }); }
});

module.exports = router;
