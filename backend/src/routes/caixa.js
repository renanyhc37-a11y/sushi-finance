const { Router } = require('express');
const db = require('../db/database');
const wa = require('../services/whatsapp');

const router = Router();

db.exec(`
  CREATE TABLE IF NOT EXISTS caixa_fechamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    faturamento REAL DEFAULT 0,
    total_pix REAL DEFAULT 0,
    total_dinheiro REAL DEFAULT 0,
    total_cartao REAL DEFAULT 0,
    despesas REAL DEFAULT 0,
    sangrias REAL DEFAULT 0,
    suprimentos REAL DEFAULT 0,
    valor_contado REAL,
    diferenca REAL,
    observacao TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )
`);

const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hoje = () => new Date().toISOString().slice(0, 10);
const getCfg = chave => db.prepare('SELECT valor FROM config WHERE chave = ?').get(chave)?.valor;

function resumoDoDia(data) {
  const v = db.prepare(`
    SELECT COUNT(*) as pedidos,
      COALESCE(SUM(total), 0) as faturamento,
      COALESCE(SUM(CASE WHEN forma_pagamento='pix' THEN total ELSE 0 END), 0) as pix,
      COALESCE(SUM(CASE WHEN forma_pagamento='dinheiro' THEN total ELSE 0 END), 0) as dinheiro,
      COALESCE(SUM(CASE WHEN forma_pagamento LIKE 'cartao%' THEN total ELSE 0 END), 0) as cartao,
      COALESCE(SUM(CASE WHEN forma_pagamento IS NULL OR forma_pagamento='' THEN total ELSE 0 END), 0) as sem_forma
    FROM pdv_pedidos WHERE date(created_at) = ? AND status != 'cancelado'
  `).get(data);
  const desp = db.prepare("SELECT COALESCE(SUM(valor),0) as total FROM despesas WHERE data_competencia = ?").get(data);
  return { ...v, despesas: desp.total };
}

function montarRelatorio(data, r, extra = {}) {
  const dataFmt = data.split('-').reverse().join('/');
  let t = `*FECHAMENTO DE CAIXA — ${dataFmt}*\n\n`;
  t += `Pedidos: ${r.pedidos}\n`;
  t += `Faturamento: ${brl(r.faturamento)}\n\n`;
  t += `*Por forma de pagamento:*\n`;
  t += `• PIX: ${brl(r.pix)}\n`;
  t += `• Dinheiro: ${brl(r.dinheiro)}\n`;
  t += `• Cartão: ${brl(r.cartao)}\n`;
  if (r.sem_forma > 0) t += `• Sem forma: ${brl(r.sem_forma)}\n`;
  t += `\nDespesas do dia: ${brl(r.despesas)}\n`;
  t += `*Resultado: ${brl(r.faturamento - r.despesas)}*\n`;
  if (extra.valor_contado != null && extra.valor_contado !== '') {
    t += `\n*Conferência do caixa (dinheiro):*\n`;
    if (Number(extra.sangrias)) t += `• Sangrias: -${brl(extra.sangrias)}\n`;
    if (Number(extra.suprimentos)) t += `• Suprimentos: +${brl(extra.suprimentos)}\n`;
    t += `• Esperado: ${brl(extra.esperado)}\n`;
    t += `• Contado: ${brl(extra.valor_contado)}\n`;
    const dif = Number(extra.diferenca);
    t += `• Diferença: ${brl(dif)}${dif === 0 ? ' ✓ ok' : (dif > 0 ? ' (sobra)' : ' (falta)')}\n`;
  }
  if (extra.observacao) t += `\nObs: ${extra.observacao}\n`;
  t += `\n_SushiContrlol_`;
  return t;
}

// GET /api/caixa/resumo?data=
router.get('/resumo', (req, res) => {
  const data = req.query.data || hoje();
  const r = resumoDoDia(data);
  const fechamento = db.prepare('SELECT * FROM caixa_fechamentos WHERE data = ? ORDER BY id DESC LIMIT 1').get(data);
  res.json({ data, ...r, fechamento: fechamento || null, admin_whatsapp: getCfg('admin_whatsapp') || '' });
});

// POST /api/caixa/fechar
router.post('/fechar', async (req, res) => {
  const { data, valor_contado, sangrias = 0, suprimentos = 0, observacao, enviar_whatsapp } = req.body;
  const d = data || hoje();
  const r = resumoDoDia(d);
  const esperado = r.dinheiro - Number(sangrias || 0) + Number(suprimentos || 0);
  const contado = (valor_contado === '' || valor_contado == null) ? null : Number(valor_contado);
  const diferenca = contado != null ? Math.round((contado - esperado) * 100) / 100 : null;

  const { lastInsertRowid: id } = db.prepare(`
    INSERT INTO caixa_fechamentos (data, faturamento, total_pix, total_dinheiro, total_cartao, despesas, sangrias, suprimentos, valor_contado, diferenca, observacao)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(d, r.faturamento, r.pix, r.dinheiro, r.cartao, r.despesas, Number(sangrias || 0), Number(suprimentos || 0), contado, diferenca, observacao || null);

  let whatsapp_enviado = false, whatsapp_erro = null;
  if (enviar_whatsapp) {
    const admin = getCfg('admin_whatsapp');
    if (!admin) whatsapp_erro = 'WhatsApp do administrador não configurado';
    else {
      const txt = montarRelatorio(d, r, { valor_contado: contado, sangrias, suprimentos, esperado, diferenca, observacao });
      whatsapp_enviado = await wa.enviar(admin, txt).catch(() => false);
      if (!whatsapp_enviado) whatsapp_erro = 'WhatsApp não conectado ou falhou ao enviar';
    }
  }
  res.json({ ok: true, id, esperado_dinheiro: esperado, diferenca, whatsapp_enviado, whatsapp_erro });
});

// POST /api/caixa/enviar-relatorio — manda o resumo do dia sem fechar
router.post('/enviar-relatorio', async (req, res) => {
  const d = req.body.data || hoje();
  const admin = getCfg('admin_whatsapp');
  if (!admin) return res.status(400).json({ erro: 'Configure o WhatsApp do administrador primeiro.' });
  const r = resumoDoDia(d);
  const ok = await wa.enviar(admin, montarRelatorio(d, r, {})).catch(() => false);
  if (!ok) return res.status(503).json({ erro: 'WhatsApp não conectado.' });
  res.json({ ok: true });
});

// PUT /api/caixa/admin-whatsapp
router.put('/admin-whatsapp', (req, res) => {
  const num = (req.body.numero || '').replace(/\D/g, '');
  db.prepare("INSERT OR REPLACE INTO config (chave, valor) VALUES ('admin_whatsapp', ?)").run(num);
  res.json({ ok: true, numero: num });
});

// GET /api/caixa/historico
router.get('/historico', (req, res) => {
  res.json(db.prepare('SELECT * FROM caixa_fechamentos ORDER BY data DESC, id DESC LIMIT 60').all());
});

module.exports = router;
