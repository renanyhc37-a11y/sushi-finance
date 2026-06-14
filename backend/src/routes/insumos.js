const { Router } = require('express');
const db = require('../db/database');
const router = Router();

// ──────────────────────────────────────────────────────────────
//  INSUMOS — controle de mercadorias que chegam dos fornecedores.
//  Catálogo extensível: salmão (com caixa/perda/calibre), cream cheese,
//  arroz, nori, panko, shoyu (sachê e litro), hashi, embalagens, etc.
//  - Entradas (chegada): registro rápido por item
//  - Consumo: registro manual
//  - Análise: estoque, custo, consumo no mês + faturamento por caixa (salmão)
// ──────────────────────────────────────────────────────────────

const KG_CAIXA_PADRAO = 30;   // caixa de salmão eviscerado ~30kg
const PERDA_PADRAO = 30;      // ~30% de perda → ~70% de aproveitamento (filé)

// ── Tabelas ──────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS insumo_catalogo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    unidade TEXT NOT NULL DEFAULT 'kg',
    tipo TEXT NOT NULL DEFAULT 'simples',
    emoji TEXT,
    ordem INTEGER DEFAULT 100,
    ativo INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS insumo_entrada (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL DEFAULT (date('now')),
    insumo TEXT NOT NULL,
    caixas REAL,
    peso_bruto REAL,
    peso_util REAL NOT NULL,
    valor_total REAL NOT NULL,
    custo_kg REAL NOT NULL,
    perda_pct REAL DEFAULT 0,
    calibre TEXT,
    fornecedor TEXT,
    observacao TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS insumo_consumo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL DEFAULT (date('now')),
    insumo TEXT NOT NULL,
    quantidade_kg REAL NOT NULL,
    observacao TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
// Migrações incrementais
try { db.exec("ALTER TABLE insumo_entrada ADD COLUMN calibre TEXT"); } catch {}
try { db.exec("ALTER TABLE insumo_entrada ADD COLUMN qtd_peixes INTEGER"); } catch {}

// ── Catálogo padrão (semeado uma vez; o adm pode adicionar/editar) ──
const PADRAO = [
  { slug: 'salmao',        nome: 'Salmão',          unidade: 'kg',     tipo: 'salmao',  emoji: '🐟', ordem: 1 },
  { slug: 'cream_cheese',  nome: 'Cream Cheese',    unidade: 'kg',     tipo: 'simples', emoji: '🧀', ordem: 2 },
  { slug: 'arroz',         nome: 'Arroz',           unidade: 'kg',     tipo: 'simples', emoji: '🍚', ordem: 3 },
  { slug: 'nori',          nome: 'Nori (alga)',     unidade: 'pacote', tipo: 'simples', emoji: '🟩', ordem: 4 },
  { slug: 'panko',         nome: 'Farinha Panko',   unidade: 'kg',     tipo: 'simples', emoji: '🌾', ordem: 5 },
  { slug: 'shoyu_litro',   nome: 'Shoyu (litro)',   unidade: 'L',      tipo: 'simples', emoji: '🍶', ordem: 6 },
  { slug: 'shoyu_sache',   nome: 'Shoyu (sachê)',   unidade: 'un',     tipo: 'simples', emoji: '🥡', ordem: 7 },
  { slug: 'hashi',         nome: 'Hashi',           unidade: 'par',    tipo: 'simples', emoji: '🥢', ordem: 8 },
  { slug: 'embalagens',    nome: 'Embalagens',      unidade: 'un',     tipo: 'simples', emoji: '📦', ordem: 9 },
  { slug: 'macarrao',      nome: 'Macarrão',        unidade: 'kg',     tipo: 'simples', emoji: '🍜', ordem: 10 },
  { slug: 'gengibre',      nome: 'Gengibre',        unidade: 'kg',     tipo: 'simples', emoji: '🫚', ordem: 11 },
  { slug: 'wasabi',        nome: 'Wasabi',          unidade: 'kg',     tipo: 'simples', emoji: '🌿', ordem: 12 },
];
{
  const ins = db.prepare("INSERT OR IGNORE INTO insumo_catalogo (slug,nome,unidade,tipo,emoji,ordem) VALUES (?,?,?,?,?,?)");
  for (const c of PADRAO) ins.run(c.slug, c.nome, c.unidade, c.tipo, c.emoji, c.ordem);
}

const catalogo = () => db.prepare('SELECT * FROM insumo_catalogo WHERE ativo=1 ORDER BY ordem ASC, nome ASC').all();
const itemPorSlug = (slug) => db.prepare('SELECT * FROM insumo_catalogo WHERE slug=?').get(slug);

// Calcula quantidade útil + custo a partir do corpo da entrada
function calcEntrada(item, body) {
  const valor_total = Number(body.valor_total) || 0;
  if (item.tipo === 'salmao') {
    const caixas = Number(body.caixas) || 1;
    const peso_bruto = Number(body.peso_bruto) || caixas * KG_CAIXA_PADRAO;
    const perda_pct = body.perda_pct != null ? Number(body.perda_pct) : PERDA_PADRAO;
    const peso_util = peso_bruto * (1 - perda_pct / 100);
    const qtd_peixes = body.qtd_peixes != null ? Number(body.qtd_peixes) || null : null;
    return { caixas, peso_bruto, perda_pct, peso_util, valor_total, custo_kg: peso_util > 0 ? valor_total / peso_util : 0, calibre: body.calibre || null, qtd_peixes };
  }
  // genérico: quantidade na unidade do item
  const qtd = Number(body.quantidade ?? body.peso_util) || 0;
  return { caixas: null, peso_bruto: null, perda_pct: 0, peso_util: qtd, valor_total, custo_kg: qtd > 0 ? valor_total / qtd : 0, calibre: null };
}

// ── CATÁLOGO ────────────────────────────────────────────────
router.get('/catalogo', (req, res) => res.json(catalogo()));

router.post('/catalogo', (req, res) => {
  const nome = (req.body.nome || '').trim();
  if (!nome) return res.status(400).json({ erro: 'Informe o nome do insumo' });
  let slug = (req.body.slug || nome).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  if (!slug) slug = 'item_' + Date.now();
  const unidade = (req.body.unidade || 'un').trim();
  const emoji = req.body.emoji || '📦';
  const ordem = Number(req.body.ordem) || 100;
  try {
    db.prepare("INSERT INTO insumo_catalogo (slug,nome,unidade,tipo,emoji,ordem) VALUES (?,?,?,?,?,?)").run(slug, nome, unidade, 'simples', emoji, ordem);
    res.status(201).json(itemPorSlug(slug));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(400).json({ erro: 'Já existe um insumo com esse nome' });
    res.status(500).json({ erro: e.message });
  }
});

router.patch('/catalogo/:slug', (req, res) => {
  const item = itemPorSlug(req.params.slug);
  if (!item) return res.status(404).json({ erro: 'Insumo não encontrado' });
  const nome = req.body.nome != null ? String(req.body.nome).trim() : item.nome;
  const unidade = req.body.unidade != null ? String(req.body.unidade).trim() : item.unidade;
  const emoji = req.body.emoji != null ? req.body.emoji : item.emoji;
  const ordem = req.body.ordem != null ? Number(req.body.ordem) : item.ordem;
  const ativo = req.body.ativo != null ? (req.body.ativo ? 1 : 0) : item.ativo;
  db.prepare("UPDATE insumo_catalogo SET nome=?, unidade=?, emoji=?, ordem=?, ativo=? WHERE slug=?")
    .run(nome, unidade, emoji, ordem, ativo, req.params.slug);
  res.json(itemPorSlug(req.params.slug));
});

// ── ENTRADAS ────────────────────────────────────────────────
router.get('/entradas', (req, res) => {
  const { insumo, mes } = req.query;
  let q = 'SELECT * FROM insumo_entrada WHERE 1=1';
  const p = [];
  if (insumo) { q += ' AND insumo=?'; p.push(insumo); }
  if (mes) { q += ' AND substr(data,1,7)=?'; p.push(mes); }
  q += ' ORDER BY data DESC, id DESC LIMIT 300';
  res.json(db.prepare(q).all(...p));
});

router.post('/entradas', (req, res) => {
  const item = itemPorSlug(req.body.insumo);
  if (!item) return res.status(400).json({ erro: 'insumo inválido' });
  const c = calcEntrada(item, req.body);
  if (!c.peso_util || c.peso_util <= 0) return res.status(400).json({ erro: 'Informe a quantidade' });
  if (!c.valor_total) return res.status(400).json({ erro: 'Informe o valor pago' });
  const r = db.prepare(`
    INSERT INTO insumo_entrada (data, insumo, caixas, peso_bruto, peso_util, valor_total, custo_kg, perda_pct, calibre, fornecedor, observacao, qtd_peixes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    req.body.data || new Date().toISOString().slice(0, 10),
    item.slug, c.caixas, c.peso_bruto, c.peso_util, c.valor_total, c.custo_kg, c.perda_pct, c.calibre,
    req.body.fornecedor || null, req.body.observacao || null, c.qtd_peixes,
  );
  res.status(201).json({ id: r.lastInsertRowid, ...c });
});

router.put('/entradas/:id', (req, res) => {
  const atual = db.prepare('SELECT * FROM insumo_entrada WHERE id=?').get(req.params.id);
  if (!atual) return res.status(404).json({ erro: 'Entrada não encontrada' });
  const slug = req.body.insumo || atual.insumo;
  const item = itemPorSlug(slug) || { tipo: 'simples' };
  const merged = { ...atual, ...req.body, quantidade: req.body.quantidade ?? atual.peso_util };
  const c = calcEntrada({ ...item, tipo: item.tipo }, merged);
  db.prepare(`
    UPDATE insumo_entrada SET data=?, insumo=?, caixas=?, peso_bruto=?, peso_util=?, valor_total=?, custo_kg=?, perda_pct=?, calibre=?, fornecedor=?, observacao=?, qtd_peixes=?
    WHERE id=?
  `).run(
    merged.data, slug, c.caixas, c.peso_bruto, c.peso_util, c.valor_total, c.custo_kg, c.perda_pct, c.calibre,
    merged.fornecedor || null, merged.observacao || null, c.qtd_peixes, req.params.id,
  );
  res.json({ ok: true, ...c });
});

router.delete('/entradas/:id', (req, res) => {
  const r = db.prepare('DELETE FROM insumo_entrada WHERE id=?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ erro: 'Entrada não encontrada' });
  res.json({ ok: true });
});

// ── CONSUMO ─────────────────────────────────────────────────
router.get('/consumo', (req, res) => {
  const { insumo, mes } = req.query;
  let q = 'SELECT * FROM insumo_consumo WHERE 1=1';
  const p = [];
  if (insumo) { q += ' AND insumo=?'; p.push(insumo); }
  if (mes) { q += ' AND substr(data,1,7)=?'; p.push(mes); }
  q += ' ORDER BY data DESC, id DESC LIMIT 300';
  res.json(db.prepare(q).all(...p));
});

router.post('/consumo', (req, res) => {
  if (!itemPorSlug(req.body.insumo)) return res.status(400).json({ erro: 'insumo inválido' });
  const qtd = Number(req.body.quantidade_kg ?? req.body.quantidade) || 0;
  if (qtd <= 0) return res.status(400).json({ erro: 'Informe a quantidade usada' });
  const r = db.prepare("INSERT INTO insumo_consumo (data, insumo, quantidade_kg, observacao) VALUES (?,?,?,?)")
    .run(req.body.data || new Date().toISOString().slice(0, 10), req.body.insumo, qtd, req.body.observacao || null);
  res.status(201).json({ id: r.lastInsertRowid });
});

router.put('/consumo/:id', (req, res) => {
  const atual = db.prepare('SELECT * FROM insumo_consumo WHERE id=?').get(req.params.id);
  if (!atual) return res.status(404).json({ erro: 'Registro não encontrado' });
  const m = { ...atual, ...req.body };
  db.prepare('UPDATE insumo_consumo SET data=?, insumo=?, quantidade_kg=?, observacao=? WHERE id=?')
    .run(m.data, m.insumo, Number(m.quantidade_kg) || 0, m.observacao || null, req.params.id);
  res.json({ ok: true });
});

router.delete('/consumo/:id', (req, res) => {
  const r = db.prepare('DELETE FROM insumo_consumo WHERE id=?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ erro: 'Registro não encontrado' });
  res.json({ ok: true });
});

// ── RESUMO / ANÁLISE ────────────────────────────────────────
router.get('/resumo', (req, res) => {
  const mes = req.query.mes || new Date().toISOString().slice(0, 7);
  const faturamento_mes = db.prepare(
    "SELECT COALESCE(SUM(total_bruto),0) t FROM faturamento_diario WHERE substr(data,1,7)=?"
  ).get(mes).t;

  const itens = catalogo().map(item => {
    const slug = item.slug;
    const ent = db.prepare('SELECT COALESCE(SUM(peso_util),0) q, COALESCE(SUM(valor_total),0) val, COALESCE(SUM(caixas),0) cx FROM insumo_entrada WHERE insumo=?').get(slug);
    const con = db.prepare('SELECT COALESCE(SUM(quantidade_kg),0) q FROM insumo_consumo WHERE insumo=?').get(slug);
    const entMes = db.prepare('SELECT COALESCE(SUM(peso_util),0) q, COALESCE(SUM(valor_total),0) val, COALESCE(SUM(caixas),0) cx FROM insumo_entrada WHERE insumo=? AND substr(data,1,7)=?').get(slug, mes);
    const conMes = db.prepare('SELECT COALESCE(SUM(quantidade_kg),0) q FROM insumo_consumo WHERE insumo=? AND substr(data,1,7)=?').get(slug, mes);
    const ultima = db.prepare('SELECT data, custo_kg FROM insumo_entrada WHERE insumo=? ORDER BY data DESC, id DESC LIMIT 1').get(slug);

    const estoque = ent.q - con.q;
    const custo_medio = ent.q > 0 ? ent.val / ent.q : 0;
    const out = {
      slug, nome: item.nome, unidade: item.unidade, tipo: item.tipo, emoji: item.emoji,
      estoque, custo_medio, valor_estoque: estoque * custo_medio,
      entradas_mes: entMes.q, entradas_mes_valor: entMes.val, consumo_mes: conMes.q,
      custo_consumo_mes: conMes.q * custo_medio,
      ultima_entrada: ultima?.data || null, ultimo_custo: ultima?.custo_kg || 0,
    };
    if (item.tipo === 'salmao') {
      const kgUtilCaixa = ent.cx > 0 ? ent.q / ent.cx : KG_CAIXA_PADRAO * (1 - PERDA_PADRAO / 100);
      const caixasConsumidas = kgUtilCaixa > 0 ? conMes.q / kgUtilCaixa : 0;

      // peixes: total histórico e do mês
      const peixesTotal = db.prepare('SELECT COALESCE(SUM(qtd_peixes),0) n FROM insumo_entrada WHERE insumo=?').get(slug).n;
      const peixesMes   = db.prepare('SELECT COALESCE(SUM(qtd_peixes),0) n FROM insumo_entrada WHERE insumo=? AND substr(data,1,7)=?').get(slug, mes).n;
      // kg útil por peixe (histórico) para estimar consumo em peixes
      const kgUtilPeixe = peixesTotal > 0 ? ent.q / peixesTotal : 0;
      const peixesConsumidosMes = kgUtilPeixe > 0 ? conMes.q / kgUtilPeixe : 0;

      out.kg_util_por_caixa = kgUtilCaixa;
      out.caixas_mes = entMes.cx;
      out.caixas_consumidas_mes = caixasConsumidas;
      out.faturamento_por_caixa = caixasConsumidas > 0 ? faturamento_mes / caixasConsumidas : 0;
      out.peixes_mes = peixesMes;
      out.kg_util_por_peixe = kgUtilPeixe;
      out.peixes_consumidos_mes = peixesConsumidosMes;
      out.faturamento_por_peixe = peixesConsumidosMes > 0 ? faturamento_mes / peixesConsumidosMes : 0;
    }
    return out;
  });

  res.json({ mes, faturamento_mes, itens });
});

module.exports = router;
