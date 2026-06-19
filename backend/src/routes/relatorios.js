const { Router } = require('express');
const db = require('../db/database');

const router = Router();

function getMes(mes) {
  return mes || new Date().toISOString().slice(0, 7);
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

module.exports = router;
