const { Router } = require('express');
const db = require('../db/database');
const wa = require('../services/whatsapp');

const router = Router();

// ── Migração das tabelas ──────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS campanhas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'reativacao',
    mensagem TEXT NOT NULL,
    cupom_codigo TEXT,
    filtro TEXT NOT NULL DEFAULT 'inativos_30',
    dias_inativo INTEGER DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'rascunho',
    disparos INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Destinatários de cada campanha — base da medição de conversão/ROI
db.exec(`
  CREATE TABLE IF NOT EXISTS campanha_destinatarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campanha_id INTEGER NOT NULL,
    telefone TEXT NOT NULL,
    nome TEXT,
    enviado_em TEXT NOT NULL DEFAULT (datetime('now')),
    status TEXT NOT NULL DEFAULT 'enviado',   -- 'enviado' | 'erro'
    convertido INTEGER NOT NULL DEFAULT 0,
    pedido_id INTEGER,
    valor_convertido REAL,
    convertido_em TEXT
  )
`);
try { db.exec('CREATE INDEX IF NOT EXISTS idx_camp_dest_tel ON campanha_destinatarios(telefone)'); } catch {}

// ── Atribuição de conversão ───────────────────────────────────
// Chamada quando um pedido é criado (cardápio ou PDV). Procura campanhas
// que enviaram para esse telefone nos últimos N dias e que ainda não
// converteram, e marca a conversão vinculando o pedido e o valor.
// Janela de atribuição padrão: 14 dias.
function registrarConversao(telefone, pedidoId, valor) {
  try {
    const tel = (telefone || '').replace(/\D/g, '');
    if (tel.length < 8) return;
    const fim = tel.slice(-8);
    const dest = db.prepare(`
      SELECT d.* FROM campanha_destinatarios d
      WHERE d.convertido = 0
        AND d.telefone LIKE ?
        AND julianday('now') - julianday(d.enviado_em) <= 14
      ORDER BY d.enviado_em DESC LIMIT 1
    `).get('%' + fim);
    if (!dest) return;
    db.prepare(`UPDATE campanha_destinatarios
      SET convertido=1, pedido_id=?, valor_convertido=?, convertido_em=datetime('now')
      WHERE id=?`).run(pedidoId || null, Number(valor) || 0, dest.id);
    console.log(`[Campanha] 🎯 Conversão atribuída! Campanha #${dest.campanha_id}, telefone ${fim}, R$${Number(valor).toFixed(2)}`);
  } catch (e) { console.error('[Campanha] registrarConversao erro:', e.message); }
}

// ── Clientes inativos ─────────────────────────────────────────
router.get('/clientes-inativos', (req, res) => {
  const dias = parseInt(req.query.dias) || 30;
  const limite = parseInt(req.query.limite) || 100;
  try {
    // Clientes importados sem pedido recente (usa '2000-01-01' como fallback = sempre inativos)
    const rowsClientes = db.prepare(`
      SELECT cl.id, cl.nome, cl.telefone,
        NULL as foto_url,
        cl.updated_at as ultima_em,
        (SELECT MAX(p.created_at) FROM pdv_pedidos p
         WHERE REPLACE(REPLACE(p.cliente_telefone,'-',''),' ','') LIKE '%' || SUBSTR(REPLACE(cl.telefone,'+',''), -8) || '%') as ultimo_pedido,
        0 as total_pedidos,
        0 as total_gasto,
        CAST(julianday('now') - julianday(
          COALESCE(
            (SELECT MAX(p.created_at) FROM pdv_pedidos p
             WHERE REPLACE(REPLACE(p.cliente_telefone,'-',''),' ','') LIKE '%' || SUBSTR(REPLACE(cl.telefone,'+',''), -8) || '%'),
            '2000-01-01'
          )
        ) AS INTEGER) as dias_inativo
      FROM clientes cl
      WHERE cl.telefone IS NOT NULL AND cl.telefone NOT LIKE 'TESTE_%'
    `).all();

    // Clientes do WhatsApp sem pedido recente (e sem cadastro em clientes)
    const rowsWA = db.prepare(`
      SELECT
        wc.id, wc.nome, wc.telefone, wc.foto_url, wc.ultima_em,
        MAX(p.created_at) as ultimo_pedido,
        COUNT(p.id) as total_pedidos,
        COALESCE(SUM(p.total), 0) as total_gasto,
        CAST(julianday('now') - julianday(COALESCE(MAX(p.created_at), wc.ultima_em)) AS INTEGER) as dias_inativo
      FROM wa_conversas wc
      LEFT JOIN pdv_pedidos p ON REPLACE(REPLACE(p.cliente_telefone,'-',''),' ','') LIKE '%' || SUBSTR(REPLACE(wc.telefone,'+',''), -8) || '%'
      LEFT JOIN clientes cl2 ON cl2.telefone = REPLACE(REPLACE(wc.telefone,'+',''),' ','')
      WHERE wc.arquivada = 0 AND wc.telefone NOT LIKE 'TESTE_%' AND cl2.id IS NULL
      GROUP BY wc.id
      HAVING CAST(julianday('now') - julianday(COALESCE(MAX(p.created_at), wc.ultima_em)) AS INTEGER) >= ?
    `).all(dias);

    const seen = new Set();
    const rows = [...rowsClientes, ...rowsWA]
      .filter(r => {
        if (r.dias_inativo < dias) return false;
        if (seen.has(r.telefone)) return false;
        seen.add(r.telefone);
        return true;
      })
      .sort((a, b) => b.dias_inativo - a.dias_inativo)
      .slice(0, limite);
    res.json(rows);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ── Estatísticas rápidas ──────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const stats = {
      inativos_7: db.prepare(`SELECT COUNT(*) as n FROM wa_conversas WHERE arquivada=0 AND telefone NOT LIKE 'TESTE_%' AND CAST(julianday('now') - julianday(ultima_em) AS INTEGER) >= 7`).get().n,
      inativos_30: db.prepare(`SELECT COUNT(*) as n FROM wa_conversas WHERE arquivada=0 AND telefone NOT LIKE 'TESTE_%' AND CAST(julianday('now') - julianday(ultima_em) AS INTEGER) >= 30`).get().n,
      inativos_60: db.prepare(`SELECT COUNT(*) as n FROM wa_conversas WHERE arquivada=0 AND telefone NOT LIKE 'TESTE_%' AND CAST(julianday('now') - julianday(ultima_em) AS INTEGER) >= 60`).get().n,
      total_contatos: db.prepare(`SELECT COUNT(*) as n FROM wa_conversas WHERE arquivada=0 AND telefone NOT LIKE 'TESTE_%'`).get().n,
      cupons_ativos: (() => { try { return db.prepare(`SELECT COUNT(*) as n FROM cupons WHERE ativo=1`).get().n; } catch { return 0; } })(),
    };
    res.json(stats);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ── CRUD campanhas ────────────────────────────────────────────
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM campanhas ORDER BY created_at DESC').all());
});

router.post('/', (req, res) => {
  const { titulo, tipo = 'reativacao', mensagem, cupom_codigo, filtro = 'inativos_30', dias_inativo = 30 } = req.body;
  if (!titulo?.trim() || !mensagem?.trim()) return res.status(400).json({ erro: 'Título e mensagem obrigatórios' });
  const r = db.prepare('INSERT INTO campanhas(titulo,tipo,mensagem,cupom_codigo,filtro,dias_inativo) VALUES(?,?,?,?,?,?)')
    .run(titulo.trim(), tipo, mensagem.trim(), cupom_codigo?.trim().toUpperCase() || null, filtro, dias_inativo);
  res.json(db.prepare('SELECT * FROM campanhas WHERE id=?').get(r.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { titulo, mensagem, cupom_codigo, filtro, dias_inativo, status } = req.body;
  db.prepare(`UPDATE campanhas SET
    titulo=COALESCE(?,titulo), mensagem=COALESCE(?,mensagem),
    cupom_codigo=COALESCE(?,cupom_codigo), filtro=COALESCE(?,filtro),
    dias_inativo=COALESCE(?,dias_inativo), status=COALESCE(?,status)
    WHERE id=?`).run(titulo??null, mensagem??null, cupom_codigo?.toUpperCase()??null, filtro??null, dias_inativo??null, status??null, req.params.id);
  res.json(db.prepare('SELECT * FROM campanhas WHERE id=?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM campanhas WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ── Disparar campanha ─────────────────────────────────────────
router.post('/:id/disparar', async (req, res) => {
  const campanha = db.prepare('SELECT * FROM campanhas WHERE id=?').get(req.params.id);
  if (!campanha) return res.status(404).json({ erro: 'Campanha não encontrada' });

  const dias = campanha.dias_inativo || 30;
  const limite = parseInt(req.query.limite) || 80;

  const conversas = db.prepare(`
    SELECT * FROM wa_conversas
    WHERE arquivada=0 AND telefone NOT LIKE 'TESTE_%'
      AND CAST(julianday('now') - julianday(ultima_em) AS INTEGER) >= ?
    LIMIT ?
  `).all(dias, limite);

  if (!conversas.length) return res.status(400).json({ erro: 'Nenhum contato encontrado para este filtro' });

  db.prepare("UPDATE campanhas SET status='disparando' WHERE id=?").run(campanha.id);
  res.json({ ok: true, total: conversas.length });

  (async () => {
    let enviados = 0;
    for (const conv of conversas) {
      let okEnvio = false;
      try {
        const nome = (conv.nome || '').split(' ')[0] || 'cliente';
        let msg = campanha.mensagem.replace(/\{nome\}/gi, nome);
        if (campanha.cupom_codigo) msg += `\n\nUse o cupom: *${campanha.cupom_codigo}*`;
        await wa.enviarEsalvar(conv, msg, false);
        okEnvio = true;
        enviados++;
        db.prepare('UPDATE campanhas SET disparos=? WHERE id=?').run(enviados, campanha.id);
      } catch {}
      // Registra o destinatário (usa telefone real se houver, p/ casar a conversão)
      try {
        db.prepare('INSERT INTO campanha_destinatarios(campanha_id,telefone,nome,status) VALUES(?,?,?,?)')
          .run(campanha.id, (conv.telefone_real || conv.telefone || '').replace(/\D/g, ''), conv.nome || null, okEnvio ? 'enviado' : 'erro');
      } catch {}
      const delay = 3000 + Math.floor(Math.random() * 5000);
      await new Promise(r => setTimeout(r, delay));
    }
    db.prepare("UPDATE campanhas SET status='concluida' WHERE id=?").run(campanha.id);
  })();
});

// ── Resultado / ROI de uma campanha ───────────────────────────
router.get('/:id/resultado', (req, res) => {
  const campanha = db.prepare('SELECT * FROM campanhas WHERE id=?').get(req.params.id);
  if (!campanha) return res.status(404).json({ erro: 'Campanha não encontrada' });
  const ag = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status='enviado' THEN 1 ELSE 0 END) AS enviados,
      SUM(CASE WHEN convertido=1 THEN 1 ELSE 0 END) AS conversoes,
      COALESCE(SUM(valor_convertido),0) AS faturamento
    FROM campanha_destinatarios WHERE campanha_id=?
  `).get(campanha.id);
  const enviados = ag.enviados || 0;
  const conversoes = ag.conversoes || 0;
  const convertidos = db.prepare(`
    SELECT nome, telefone, valor_convertido, convertido_em
    FROM campanha_destinatarios WHERE campanha_id=? AND convertido=1
    ORDER BY convertido_em DESC
  `).all(campanha.id);
  res.json({
    campanha,
    total: ag.total || 0,
    enviados,
    conversoes,
    faturamento: ag.faturamento || 0,
    taxa_conversao: enviados ? (conversoes / enviados) : 0,
    ticket_medio: conversoes ? (ag.faturamento / conversoes) : 0,
    convertidos,
  });
});

// ── Sugestões com IA ──────────────────────────────────────────
router.post('/sugerir-ia', async (req, res) => {
  const { tipo = 'reativacao', contexto = '' } = req.body;
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Contexto do restaurante e cardápio
    let infoRest = '';
    try {
      const cfg = db.prepare('SELECT * FROM config WHERE id=1').get();
      if (cfg?.nome_restaurante) infoRest = `Restaurante: ${cfg.nome_restaurante}.`;
    } catch {}

    let topItens = '';
    try {
      const itens = db.prepare('SELECT nome, preco FROM cardapio_itens WHERE ativo=1 LIMIT 8').all();
      if (itens.length) topItens = `Itens do cardápio: ${itens.map(i => i.nome).join(', ')}.`;
    } catch {}

    const tipoDesc = {
      reativacao: 'reativar clientes que sumiram há mais de 30 dias',
      promocao: 'promover uma oferta ou promoção especial',
      cupom: 'oferecer um cupom de desconto exclusivo',
      novidade: 'anunciar um item novo no cardápio',
      fidelidade: 'recompensar clientes frequentes',
    }[tipo] || tipo;

    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: `Você cria mensagens de WhatsApp para restaurantes de sushi. ${infoRest} ${topItens}
Regras: mensagem curta (máx 4 linhas), tom amigável e pessoal, 1 emoji no máximo, use {nome} para personalizar.`,
      messages: [{
        role: 'user',
        content: `Crie 3 opções de mensagem WhatsApp para ${tipoDesc}.${contexto ? ' Contexto adicional: ' + contexto : ''}
Formato da resposta — apenas as 3 mensagens separadas por linha em branco, sem numeração, sem explicação.`,
      }],
    });

    const texto = resp.content[0]?.text || '';
    const sugestoes = texto.split(/\n\n+/).map(s => s.trim()).filter(Boolean).slice(0, 3);
    res.json({ sugestoes });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// ── Cupons (proxy para facilitar uso na página) ───────────────
router.get('/cupons', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM cupons ORDER BY created_at DESC').all());
  } catch { res.json([]); }
});

router.post('/cupons', (req, res) => {
  const { codigo, descricao, tipo = 'percentual', valor, minimo = 0, usos_maximos = 0, validade } = req.body;
  if (!codigo?.trim() || !valor) return res.status(400).json({ erro: 'Código e valor obrigatórios' });
  try {
    const r = db.prepare('INSERT INTO cupons(codigo,descricao,tipo,valor,minimo,usos_maximos,validade) VALUES(?,?,?,?,?,?,?)')
      .run(codigo.trim().toUpperCase(), descricao||null, tipo, Number(valor), Number(minimo), Number(usos_maximos), validade||null);
    res.json(db.prepare('SELECT * FROM cupons WHERE id=?').get(r.lastInsertRowid));
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(400).json({ erro: 'Código já existe' });
    res.status(500).json({ erro: e.message });
  }
});

router.patch('/cupons/:id', (req, res) => {
  const { ativo, descricao, valor, minimo, usos_maximos, validade } = req.body;
  db.prepare(`UPDATE cupons SET ativo=COALESCE(?,ativo), descricao=COALESCE(?,descricao),
    valor=COALESCE(?,valor), minimo=COALESCE(?,minimo), usos_maximos=COALESCE(?,usos_maximos),
    validade=COALESCE(?,validade) WHERE id=?`)
    .run(ativo!==undefined?(ativo?1:0):null, descricao??null, valor??null, minimo??null, usos_maximos??null, validade??null, req.params.id);
  res.json(db.prepare('SELECT * FROM cupons WHERE id=?').get(req.params.id));
});

router.delete('/cupons/:id', (req, res) => {
  db.prepare('DELETE FROM cupons WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// Gerador de código aleatório
router.get('/gerar-codigo', (req, res) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  res.json({ codigo: code });
});

module.exports = router;
module.exports.registrarConversao = registrarConversao;
