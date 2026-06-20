const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const Anthropic = require('@anthropic-ai/sdk');
const { requireAuth } = require('../middleware/requireAuth');

const router = Router();

// ── Upload de imagens para banners (multer) ────────────────────
let uploadBanner;
try {
  const multer = require('multer');
  const BANNER_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'banners');
  if (!fs.existsSync(BANNER_DIR)) fs.mkdirSync(BANNER_DIR, { recursive: true });
  const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const EXT_SEGURAS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
  const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, BANNER_DIR),
    filename: (_, file, cb) => {
      const ext = EXT_SEGURAS[file.mimetype] || '.jpg';
      cb(null, `banner_${Date.now()}${ext}`);
    },
  });
  const fileFilter = (_, file, cb) => {
    if (MIME_PERMITIDOS.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG, WebP ou GIF.'));
  };
  uploadBanner = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });
} catch {
  uploadBanner = null;
  console.warn('[ia] multer não instalado — upload de fotos de banner desativado.');
}

// ── Migrações: tabelas de banners e sugestões ──────────────────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS banners_promocao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tag TEXT NOT NULL DEFAULT '🔥 Promoção',
      titulo TEXT NOT NULL,
      subtitulo TEXT,
      destaque TEXT,
      emoji TEXT DEFAULT '🍣',
      cor1 TEXT DEFAULT '#7c2d12',
      cor2 TEXT DEFAULT '#9a3412',
      img TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      ordem INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sugestoes_ia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL DEFAULT 'combo',
      titulo TEXT NOT NULL,
      descricao TEXT,
      preco_sugerido REAL,
      produtos_ids TEXT,
      status TEXT NOT NULL DEFAULT 'pendente',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
} catch (e) { console.error('ia migration:', e.message); }
try { db.exec('ALTER TABLE banners_promocao ADD COLUMN item_id INTEGER'); } catch {}
try { db.exec('ALTER TABLE banners_promocao ADD COLUMN usar_gradiente INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE banners_promocao ADD COLUMN opcoes_escolha TEXT'); } catch {}
try { db.exec('ALTER TABLE banners_promocao ADD COLUMN design TEXT'); } catch {}

// ── Helpers ───────────────────────────────────────────────────
function getContextoDados() {
  // Cardápio real (cardapio_itens + categorias)
  const itens = db.prepare(`
    SELECT i.nome, i.preco, i.descricao, c.nome as categoria
    FROM cardapio_itens i
    LEFT JOIN cardapio_categorias c ON c.id = i.categoria_id
    WHERE i.disponivel = 1
    ORDER BY c.nome, i.nome
  `).all();

  const faturamento = db.prepare(`
    SELECT data, total_bruto, quantidade_pedidos
    FROM faturamento_diario
    ORDER BY data DESC LIMIT 30
  `).all();

  // Top itens do delivery mais pedidos (pdv_itens.item_nome)
  const topPedidos = db.prepare(`
    SELECT item_nome as nome, SUM(quantidade) as total_vendido
    FROM pdv_itens
    GROUP BY item_nome
    ORDER BY total_vendido DESC LIMIT 10
  `).all();

  return { itens, faturamento, topPedidos };
}

// ── POST /ia/sugestoes — gera sugestões com Claude ───────────
router.post('/sugestoes', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(400).json({
      erro: 'ANTHROPIC_API_KEY não configurada. Adicione no arquivo .env do backend.',
    });
  }

  const { pedido_operador } = req.body || {};

  try {
    const ctx = getContextoDados();
    const client = new Anthropic({ apiKey });

    const secaoOperador = pedido_operador?.trim()
      ? `\n## Instrução do operador:\n"${pedido_operador.trim()}"\nLeve essa instrução em consideração e priorize sugestões que atendam a esse pedido.\n`
      : '';

    const prompt = `Você é um consultor especializado em delivery de sushi no Brasil.

Analise os dados abaixo e crie 6 sugestões criativas de combos e promoções para aumentar o ticket médio e atrair mais clientes. Use APENAS itens que existem no cardápio listado abaixo.
${secaoOperador}
## Cardápio atual (${ctx.itens.length} itens disponíveis):
${ctx.itens.map(p => `- ${p.nome} (${p.categoria || 'sem categoria'}) — R$ ${Number(p.preco).toFixed(2).replace('.', ',')}`).join('\n')}

## Itens mais pedidos:
${ctx.topPedidos.length ? ctx.topPedidos.map(t => `- ${t.nome}: ${t.total_vendido} unidades`).join('\n') : 'Sem dados de vendas ainda.'}

## Faturamento recente (últimos 30 dias):
${ctx.faturamento.length ? ctx.faturamento.slice(0, 5).map(f => `- ${f.data}: R$ ${Number(f.total_bruto).toFixed(2)} (${f.quantidade_pedidos || 0} pedidos)`).join('\n') : 'Sem dados de faturamento.'}

Retorne EXATAMENTE um JSON válido com este formato (sem markdown, sem explicações):
{
  "sugestoes": [
    {
      "tipo": "combo",
      "titulo": "Nome do combo",
      "descricao": "Descrição curta e atraente (máx 80 chars)",
      "preco_sugerido": 0.00,
      "tag_banner": "🔥 Promoção",
      "destaque_banner": "R$ XX,XX",
      "emoji": "🍣",
      "cor1": "#7c2d12",
      "cor2": "#9a3412",
      "justificativa": "Por que essa sugestão faz sentido (1 frase)"
    }
  ]
}

Tipos possíveis: "combo", "promocao", "fidelidade", "novidade"
Tags possíveis para banner: "🔥 Promoção", "⭐ Destaque", "🚚 Frete Grátis", "✨ Novidade", "💚 Fidelidade", "🎉 Especial"
Emojis: use emojis de comida japonesa relevantes
Cores: use tons escuros e vibrantes (hex), cada sugestão com cores diferentes`;

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const texto = message.content[0].text.trim();
    let dados;
    try {
      // Extrai JSON mesmo se vier com markdown
      const match = texto.match(/\{[\s\S]*\}/);
      dados = JSON.parse(match ? match[0] : texto);
    } catch {
      return res.status(500).json({ erro: 'IA retornou formato inválido', raw: texto });
    }

    // Salva sugestões no banco
    const insert = db.prepare(
      `INSERT INTO sugestoes_ia (tipo, titulo, descricao, preco_sugerido, status)
       VALUES (?, ?, ?, ?, 'pendente')`
    );
    const salvar = db.transaction(() => {
      for (const s of dados.sugestoes) {
        insert.run(s.tipo, s.titulo, s.descricao, s.preco_sugerido || 0);
      }
    });
    salvar();

    res.json({ sugestoes: dados.sugestoes, tokens: message.usage });
  } catch (e) {
    console.error('Erro IA:', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── GET /ia/sugestoes — lista salvas ─────────────────────────
router.get('/sugestoes', (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM sugestoes_ia ORDER BY created_at DESC LIMIT 50`
  ).all();
  res.json(rows);
});

// ── DELETE /ia/sugestoes/:id ──────────────────────────────────
router.delete('/sugestoes/:id', (req, res) => {
  db.prepare('DELETE FROM sugestoes_ia WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════
// BANNERS
// ══════════════════════════════════════════════════════════════

// GET /ia/banners
router.get('/banners', (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM banners_promocao ORDER BY ordem ASC, id ASC`
  ).all();
  res.json(rows);
});

// POST /ia/banners
router.post('/banners', (req, res) => {
  const { tag, titulo, subtitulo, destaque, emoji, cor1, cor2, img, ordem } = req.body;
  if (!titulo) return res.status(400).json({ erro: 'titulo obrigatório' });
  const r = db.prepare(
    `INSERT INTO banners_promocao (tag, titulo, subtitulo, destaque, emoji, cor1, cor2, img, ordem)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(tag || '🔥 Promoção', titulo, subtitulo || '', destaque || '', emoji || '🍣',
       cor1 || '#7c2d12', cor2 || '#9a3412', img || '', ordem || 0);
  res.status(201).json({ id: r.lastInsertRowid });
});

// PUT /ia/banners/:id
router.put('/banners/:id', (req, res) => {
  try {
    const { tag, titulo, subtitulo, destaque, emoji, cor1, cor2, img, ativo, ordem, item_id, usar_gradiente, opcoes_escolha, design } = req.body;
    if (!titulo) return res.status(400).json({ erro: 'titulo obrigatório' });
    db.prepare(
      `UPDATE banners_promocao SET tag=?, titulo=?, subtitulo=?, destaque=?, emoji=?,
       cor1=?, cor2=?, img=?, ativo=?, ordem=?, item_id=?, usar_gradiente=?, opcoes_escolha=?, design=? WHERE id=?`
    ).run(tag, titulo, subtitulo || '', destaque || '', emoji || '🍣',
         cor1 || '#7c2d12', cor2 || '#9a3412', img || '',
         ativo !== undefined ? (ativo ? 1 : 0) : 1, ordem || 0,
         item_id !== undefined ? item_id : null,
         usar_gradiente ? 1 : 0,
         opcoes_escolha ? JSON.stringify(opcoes_escolha) : null,
         design ? JSON.stringify(design) : null,
         req.params.id);
    res.json({ ok: true, id: Number(req.params.id) });
  } catch (e) {
    console.error('[ia] PUT /banners/:id erro:', e.message);
    res.status(500).json({ erro: e.message });
  }
});

// PATCH /ia/banners/:id/item — vincula item do cardápio ao banner
router.patch('/banners/:id/item', requireAuth, (req, res) => {
  const { item_id } = req.body;
  db.prepare('UPDATE banners_promocao SET item_id = ? WHERE id = ?').run(item_id || null, req.params.id);
  res.json({ ok: true });
});

// DELETE /ia/banners/:id
router.delete('/banners/:id', (req, res) => {
  // Remove foto do disco se existir
  const banner = db.prepare('SELECT img FROM banners_promocao WHERE id=?').get(req.params.id);
  if (banner?.img && banner.img.startsWith('/banners/')) {
    const fotoPath = path.join(__dirname, '..', '..', '..', 'frontend', 'public', banner.img.replace(/^\//, ''));
    try { fs.unlinkSync(fotoPath); } catch {}
  }
  db.prepare('DELETE FROM banners_promocao WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// POST /ia/banners/:id/foto — upload de imagem do banner
router.post('/banners/:id/foto', requireAuth, (req, res) => {
  if (!uploadBanner) return res.status(503).json({ erro: 'Upload não disponível. Instale multer: npm install multer' });
  uploadBanner.single('foto')(req, res, (err) => {
    if (err) return res.status(400).json({ erro: err.message });
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
    const banner = db.prepare('SELECT * FROM banners_promocao WHERE id=?').get(req.params.id);
    if (!banner) return res.status(404).json({ erro: 'Banner não encontrado' });
    // Remove foto antiga
    if (banner.img && banner.img.startsWith('/banners/')) {
      const old = path.join(__dirname, '..', '..', '..', 'frontend', 'public', banner.img.replace(/^\//, ''));
      try { fs.unlinkSync(old); } catch {}
    }
    const fotoUrl = `/banners/${req.file.filename}`;
    db.prepare('UPDATE banners_promocao SET img = ? WHERE id = ?').run(fotoUrl, req.params.id);
    res.json({ img: fotoUrl });
  });
});

// ══════════════════════════════════════════════════════════════
// LOGO DO RESTAURANTE
// ══════════════════════════════════════════════════════════════

let uploadLogo;
try {
  const multer = require('multer');
  const PUBLIC_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'public');
  const storageLogo = multer.diskStorage({
    destination: (_, __, cb) => cb(null, PUBLIC_DIR),
    filename: (_, file, cb) => {
      const ext = path.extname(file.originalname) || '.png';
      cb(null, `logo${ext}`);
    },
  });
  uploadLogo = multer({ storage: storageLogo, limits: { fileSize: 2 * 1024 * 1024 } });
} catch {
  uploadLogo = null;
}

// POST /ia/logo — upload da logo
router.post('/logo', requireAuth, (req, res) => {
  if (!uploadLogo) return res.status(503).json({ erro: 'multer não instalado' });
  uploadLogo.single('logo')(req, res, (err) => {
    if (err) return res.status(400).json({ erro: err.message });
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
    const ext = path.extname(req.file.originalname) || '.png';
    const url = `/logo${ext}`;
    res.json({ url });
  });
});

// DELETE /ia/logo — remove a logo
router.delete('/logo', requireAuth, (req, res) => {
  const PUBLIC_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'public');
  ['logo.png', 'logo.jpg', 'logo.jpeg', 'logo.svg', 'logo.webp'].forEach(f => {
    try { fs.unlinkSync(path.join(PUBLIC_DIR, f)); } catch {}
  });
  res.json({ ok: true });
});

// GET /ia/logo — verifica se existe logo
router.get('/logo', (req, res) => {
  const PUBLIC_DIR = path.join(__dirname, '..', '..', '..', 'frontend', 'public');
  const exts = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
  for (const ext of exts) {
    if (fs.existsSync(path.join(PUBLIC_DIR, `logo.${ext}`))) {
      return res.json({ url: `/logo.${ext}` });
    }
  }
  res.json({ url: null });
});

// DELETE /ia/banners/:id/foto — remove foto do banner
router.delete('/banners/:id/foto', requireAuth, (req, res) => {
  const banner = db.prepare('SELECT * FROM banners_promocao WHERE id=?').get(req.params.id);
  if (!banner) return res.status(404).json({ erro: 'Banner não encontrado' });
  if (banner.img && banner.img.startsWith('/banners/')) {
    const fotoPath = path.join(__dirname, '..', '..', '..', 'frontend', 'public', banner.img.replace(/^\//, ''));
    try { fs.unlinkSync(fotoPath); } catch {}
  }
  db.prepare('UPDATE banners_promocao SET img = NULL WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════
// CRIATIVO SOCIAL — gera legenda + hashtags para Instagram
// ══════════════════════════════════════════════════════════════

// POST /api/ia/criativo-social
router.post('/criativo-social', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(400).json({ erro: 'ANTHROPIC_API_KEY não configurada.' });

  const { tema, item_nome, preco, formato = 'post', restaurante = 'Sushi' } = req.body;

  // Cardápio para contexto
  let cardapio = [];
  try {
    cardapio = db.prepare(
      `SELECT ci.nome, ci.preco, cc.nome as categoria
       FROM cardapio_itens ci
       LEFT JOIN cardapio_categorias cc ON cc.id = ci.categoria_id
       WHERE ci.disponivel = 1 ORDER BY RANDOM() LIMIT 12`
    ).all();
  } catch {}

  try {
    const client = new Anthropic({ apiKey });

    const prompt = `Você é o melhor diretor de arte e copywriter de marketing digital do Brasil, especializado em delivery de comida japonesa e Instagram.

Restaurante: ${restaurante}
Formato: ${formato === 'stories' ? 'Instagram Stories (vertical 9:16)' : 'Post Instagram (quadrado 1:1)'}
${item_nome ? `Item em destaque: ${item_nome}${preco ? ` — R$ ${preco}` : ''}` : ''}
${tema ? `Tema/contexto: ${tema}` : ''}

Cardápio disponível:
${cardapio.map(c => `- ${c.nome} (${c.categoria || 'geral'}) R$ ${Number(c.preco).toFixed(2)}`).join('\n')}

Crie conteúdo EXTRAORDINÁRIO e IRRESISTÍVEL para um post que vai viralizar. Retorne EXATAMENTE este JSON (sem markdown):
{
  "headline": "Frase IMPACTANTE em ALL CAPS (máx 28 chars) — deve causar impacto imediato",
  "subheadline": "Segunda linha sensorial e apetitosa (máx 48 chars) — desperte desejo",
  "destaque": "Número ou oferta em destaque (máx 14 chars, ex: 'R$ 49,90' ou '40% OFF')",
  "tag": "Mini tag de contexto (máx 14 chars, ex: '🔥 Só hoje', '⭐ Novo', '🚀 Lançamento')",
  "legenda": "Legenda COMPLETA para o Instagram (3 parágrafos curtos separados por linha em branco, use emojis estratégicos, crie urgência, desperte desejo, call-to-action poderoso no final com link/contato)",
  "hashtags": ["30 hashtags relevantes sem o símbolo #, mix de populares e nicho"],
  "cta": "Call to action URGENTE (máx 18 chars, com emoji, ex: 'Peça já! 🛵')",
  "emoji_principal": "emoji mais relevante para o item/tema",
  "emojis_extras": ["3 emojis complementares em array"],
  "sugestao_horario": "Melhor horário para postar com justificativa curta (ex: '19h — pico de fome pré-jantar')",
  "cor_tema": "vermelho|laranja|dourado|oceano|floresta|roxo|sakura",
  "template_sugerido": "luxo|neon|bold|magazine|cinema|urgente|zen|split|retro|gradient|frame|dark|sticker|duo|wave|poster — qual template combina melhor com este conteúdo",
  "humor": "elegante|energetico|urgente|minimalista|divertido|romantico"
}`;

    const message = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const texto = message.content[0].text.trim();
    const match = texto.match(/\{[\s\S]*\}/);
    const dados = JSON.parse(match ? match[0] : texto);
    res.json(dados);
  } catch (e) {
    console.error('Erro criativo-social:', e);
    res.status(500).json({ erro: e.message });
  }
});

// ══════════════════════════════════════════════════════════════
// AGENTE DE VOZ — NinjaContrlol v3
// ══════════════════════════════════════════════════════════════

router.post('/agente', requireAuth, async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const { comando, historico_conversa = [] } = req.body;
  if (!comando?.trim()) return res.status(400).json({ erro: 'Comando vazio' });

  // ── Coleta contexto em tempo real ───────────────────────────
  let ctx = {};
  try {
    const agora = new Date();
    // Brasília = UTC-3
    const agoraBR = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
    const hoje = agoraBR.toISOString().slice(0, 10);
    const mes  = agoraBR.toISOString().slice(0, 7);
    const ontem = new Date(agoraBR.getTime() - 86400000).toISOString().slice(0, 10);

    ctx.pedidos_ativos = db.prepare(
      `SELECT id, numero, cliente_nome, status, total, bairro, tipo_entrega, created_at
       FROM pdv_pedidos WHERE status NOT IN ('entregue','cancelado') ORDER BY id DESC LIMIT 30`
    ).all();

    ctx.faturamento_hoje = db.prepare(
      `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as pedidos,
              COALESCE(AVG(total),0) as ticket_medio,
              COALESCE(SUM(CASE WHEN forma_pagamento='pix' THEN total ELSE 0 END),0) as pix,
              COALESCE(SUM(CASE WHEN forma_pagamento='dinheiro' THEN total ELSE 0 END),0) as dinheiro,
              COALESCE(SUM(CASE WHEN forma_pagamento LIKE 'cartao%' THEN total ELSE 0 END),0) as cartao,
              COUNT(CASE WHEN status='cancelado' THEN 1 END) as cancelados
       FROM pdv_pedidos WHERE date(created_at,'-3 hours') = ?`
    ).get(hoje);

    ctx.faturamento_ontem = db.prepare(
      `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as pedidos
       FROM pdv_pedidos WHERE date(created_at,'-3 hours') = ? AND status != 'cancelado'`
    ).get(ontem);

    ctx.faturamento_mes = db.prepare(
      `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as pedidos
       FROM pdv_pedidos WHERE strftime('%Y-%m', datetime(created_at,'-3 hours')) = ? AND status != 'cancelado'`
    ).get(mes);

    ctx.boletos_pendentes = db.prepare(
      `SELECT id, fornecedor, descricao, data_vencimento,
        (SELECT COALESCE(SUM(quantidade*valor_unitario),0) FROM boleto_itens WHERE boleto_id=boletos.id) as valor
       FROM boletos WHERE status='pendente' ORDER BY data_vencimento ASC LIMIT 15`
    ).all();

    ctx.boletos_vencendo = ctx.boletos_pendentes.filter(b => {
      const diff = (new Date(b.data_vencimento) - agoraBR) / 86400000;
      return diff <= 3;
    });

    ctx.itens_cardapio = db.prepare(
      `SELECT i.id, i.nome, i.preco, i.disponivel, c.nome as categoria
       FROM cardapio_itens i LEFT JOIN cardapio_categorias c ON c.id=i.categoria_id
       ORDER BY c.nome, i.nome LIMIT 80`
    ).all();

    ctx.cupons = db.prepare(
      `SELECT id, codigo, tipo, valor, ativo, usos_atuais, usos_maximos, validade
       FROM cupons ORDER BY ativo DESC, created_at DESC LIMIT 20`
    ).all();

    ctx.insumo_catalogo = db.prepare(
      `SELECT slug, nome, unidade FROM insumo_catalogo WHERE ativo=1 ORDER BY ordem`
    ).all();

    // Últimas entradas de insumo para contexto de estoque
    ctx.ultimas_entradas = db.prepare(
      `SELECT e.insumo, c.nome, SUM(e.peso_util) as total, MAX(e.data) as ultima_compra
       FROM insumo_entrada e LEFT JOIN insumo_catalogo c ON c.slug = e.insumo
       WHERE e.data >= date('now','-30 days')
       GROUP BY e.insumo ORDER BY ultima_compra DESC LIMIT 10`
    ).all();

    // Top clientes
    ctx.top_clientes = db.prepare(
      `SELECT cliente_nome, cliente_telefone, COUNT(*) as pedidos, SUM(total) as gasto
       FROM pdv_pedidos WHERE status != 'cancelado'
       GROUP BY cliente_telefone ORDER BY gasto DESC LIMIT 5`
    ).all();

    // Itens mais vendidos hoje
    ctx.top_hoje = db.prepare(
      `SELECT i.item_nome, SUM(i.quantidade) as qt
       FROM pdv_itens i JOIN pdv_pedidos p ON p.id=i.pedido_id
       WHERE date(p.created_at,'-3 hours') = ? AND p.status != 'cancelado'
       GROUP BY i.item_nome ORDER BY qt DESC LIMIT 5`
    ).all(hoje);

    // Config da loja (horário, bairros, frete)
    ctx.config_loja = db.prepare(
      `SELECT chave, valor FROM config WHERE chave IN ('loja_aberta','horario','nome_restaurante','frete_gratis_acima')`
    ).all().reduce((a, r) => { a[r.chave] = r.valor; return a; }, {});

  } catch (e) {
    console.warn('[agente] contexto parcial:', e.message);
  }

  if (!apiKey) {
    return res.json({ resposta_voz: 'Chave de IA não configurada.', acao: 'info', parametros: {} });
  }

  try {
    const client = new Anthropic({ apiKey });
    const brl = v => `R$ ${Number(v||0).toFixed(2).replace('.', ',')}`;
    const agora = new Date();
    const agoraBR = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
    const hoje = agoraBR.toISOString().slice(0, 10);
    const horaAtual = agoraBR.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const variacaoHoje = ctx.faturamento_ontem?.total > 0
      ? ((ctx.faturamento_hoje?.total - ctx.faturamento_ontem?.total) / ctx.faturamento_ontem?.total * 100).toFixed(0)
      : null;

    const systemPrompt = `Você é NinjaContrlol — o parceiro digital do delivery ${ctx.config_loja?.nome_restaurante || '37 Sushi'}. Você é ágil, inteligente, proativo e fala como um sócio de confiança, não como um robô. Responda SEMPRE em português brasileiro, de forma direta e calorosa (máx 2 frases para falar em voz alta). Quando registrar algo, confirme brevemente o que foi feito.

## SITUAÇÃO ATUAL — ${horaAtual} de ${hoje}:

### OPERAÇÃO
Pedidos em aberto: ${ctx.pedidos_ativos?.length || 0}
${ctx.pedidos_ativos?.map(p => `  #${p.numero} ${p.cliente_nome} [${p.status}] ${brl(p.total)} ${p.tipo_entrega==='retirada'?'🏪retirada':'🛵'+p.bairro||''}`).join('\n') || '  Nenhum pedido ativo'}

### FATURAMENTO
Hoje: ${brl(ctx.faturamento_hoje?.total)} (${ctx.faturamento_hoje?.pedidos||0} pedidos, ticket médio ${brl(ctx.faturamento_hoje?.ticket_medio)})${variacaoHoje ? ` | ${variacaoHoje > 0 ? '📈+' : '📉'}${variacaoHoje}% vs ontem` : ''}
Ontem: ${brl(ctx.faturamento_ontem?.total)} (${ctx.faturamento_ontem?.pedidos||0} pedidos)
Mês: ${brl(ctx.faturamento_mes?.total)} (${ctx.faturamento_mes?.pedidos||0} pedidos)
Formas hoje: PIX ${brl(ctx.faturamento_hoje?.pix)} | Dinheiro ${brl(ctx.faturamento_hoje?.dinheiro)} | Cartão ${brl(ctx.faturamento_hoje?.cartao)}

### TOP VENDIDOS HOJE
${ctx.top_hoje?.map(t => `  ${t.qt}x ${t.item_nome}`).join('\n') || '  Sem vendas hoje'}

### TOP CLIENTES (geral)
${ctx.top_clientes?.map(c => `  ${c.cliente_nome} — ${c.pedidos} pedidos — ${brl(c.gasto)}`).join('\n') || '  Sem dados'}

### BOLETOS PENDENTES (${ctx.boletos_pendentes?.length||0})${ctx.boletos_vencendo?.length ? ` ⚠️ ${ctx.boletos_vencendo.length} vencendo em até 3 dias!` : ''}
${ctx.boletos_pendentes?.map(b => `  [${b.id}] ${b.fornecedor} ${brl(b.valor)} vence ${b.data_vencimento}${new Date(b.data_vencimento)<agoraBR?' ⚠️VENCIDO':''}`).join('\n') || '  Nenhum'}

### CARDÁPIO (${ctx.itens_cardapio?.length||0} itens)
${ctx.itens_cardapio?.map(i => `  [${i.id}] ${i.nome} ${brl(i.preco)} ${i.disponivel?'✅':'⛔PAUSADO'}`).join('\n') || '  Sem itens'}

### CUPONS (${ctx.cupons?.length||0})
${ctx.cupons?.map(c => `  [${c.id}] ${c.codigo} ${c.tipo}=${c.valor}${c.tipo==='percentual'?'%':' reais'} ${c.ativo?'✅':'⛔desativado'} usos:${c.usos_atuais}/${c.usos_maximos||'∞'} validade:${c.validade||'sem limite'}`).join('\n') || '  Nenhum'}

### INSUMOS DISPONÍVEIS PARA REGISTRO
${ctx.insumo_catalogo?.map(i => `  ${i.slug} = ${i.nome} (${i.unidade})`).join('\n') || '  Sem catálogo'}

### ESTOQUE RECENTE (últimos 30 dias)
${ctx.ultimas_entradas?.map(e => `  ${e.nome||e.insumo}: ${e.total} kg/un total, última compra ${e.ultima_compra}`).join('\n') || '  Sem entradas'}

## AÇÕES DISPONÍVEIS
Retorne EXATAMENTE este JSON (sem markdown, sem explicações):
{
  "resposta_voz": "frase curta e amigável (máx 2 frases)",
  "acao": "uma das ações abaixo ou nenhuma",
  "parametros": {},
  "tag": "categoria da ação para o frontend"
}

AÇÕES E PARÂMETROS:
nav             → { "pagina": "/pdv" }
lista_add       → { "item": "cebolinha" }
pausar_item     → { "item_id": 12, "nome": "Hot Roll" }
ativar_item     → { "item_id": 12, "nome": "Hot Roll" }
alterar_preco   → { "item_id": 12, "nome": "Hot Roll", "novo_preco": 29.90 }
criar_cupom     → { "codigo": "PROMO10", "tipo": "percentual", "valor": 10, "minimo": 30, "usos_maximos": 0, "validade": null }
desativar_cupom → { "cupom_id": 3, "codigo": "PROMO10" }
ativar_cupom    → { "cupom_id": 3, "codigo": "PROMO10" }
cancelar_pedido → { "pedido_id": 5, "numero": 42 }
avancar_pedido  → { "pedido_id": 5, "numero": 42, "novo_status": "pronto" }  (statuses: espera→preparando→pronto→entregue)
registrar_insumo → { "insumo": "salmao", "quantidade": 30, "valor_total": 900, "fornecedor": "Cia do Salmão" }
registrar_boleto → { "fornecedor": "Atacado X", "descricao": "Compra de insumos", "valor_total": 500, "data_vencimento": "${hoje}", "dias_vencimento": null }
pagar_boleto    → { "boleto_id": 3, "fornecedor": "Atacado X" }
toggle_loja     → { "abrir": true }  (true=abrir, false=fechar)
info            → (só resposta_voz com análise dos dados)
nenhuma         → (quando não há ação, apenas conversa)

REGRAS:
- Para "vence em X dias": calcule data_vencimento como ${hoje} + X dias
- Para "dia 30": use ${hoje.slice(0,8)}30 (mesmo mês)
- Para "mês que vem dia 10": use próximo mês
- Para alterar preço, SEMPRE confirme o novo valor antes de executar na resposta_voz
- Quando há boletos vencendo, mencione proativamente se relevante
- Se o usuário pedir "resumo" ou "como tá o dia", dê análise completa com comparativo
- Para nav, use: /dashboard, /pdv, /despesas, /lista-compras, /faturamento, /boletos, /relatorios, /whatsapp, /clientes, /cardapio-admin, /campanhas, /producao, /insumos, /cashback, /metricas
- tag deve ser: "Insumo" | "Boleto" | "Ação" | "Navegar" | "Info" | "Pedido" | "Cardápio" | "Cupom"`;

    // Monta histórico de conversa para contexto (últimas 5 trocas)
    const mensagens = [];
    const hist = (historico_conversa || []).slice(-5);
    for (const h of hist) {
      mensagens.push({ role: 'user', content: h.texto });
      mensagens.push({ role: 'assistant', content: h.resposta_raw || h.resposta });
    }
    mensagens.push({ role: 'user', content: comando.trim() });

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: mensagens,
    });

    const texto = message.content[0].text.trim();
    let dados;
    try {
      const match = texto.match(/\{[\s\S]*\}/);
      dados = JSON.parse(match ? match[0] : texto);
    } catch {
      return res.json({ resposta_voz: 'Não entendi bem. Pode repetir de outro jeito?', acao: 'nenhuma', parametros: {}, tag: 'Info' });
    }

    // ── Executa ações no banco ───────────────────────────────
    const p = dados.parametros || {};

    if (dados.acao === 'pausar_item' && p.item_id) {
      try { db.prepare('UPDATE cardapio_itens SET disponivel=0 WHERE id=?').run(p.item_id); } catch {}
    }
    if (dados.acao === 'ativar_item' && p.item_id) {
      try { db.prepare('UPDATE cardapio_itens SET disponivel=1 WHERE id=?').run(p.item_id); } catch {}
    }
    if (dados.acao === 'alterar_preco' && p.item_id && p.novo_preco) {
      try { db.prepare('UPDATE cardapio_itens SET preco=? WHERE id=?').run(Number(p.novo_preco), p.item_id); } catch {}
    }
    if (dados.acao === 'criar_cupom' && p.codigo) {
      try {
        db.prepare(`INSERT OR IGNORE INTO cupons (codigo,tipo,valor,minimo,usos_maximos,validade,ativo) VALUES (?,?,?,?,?,?,1)`)
          .run(p.codigo.toUpperCase(), p.tipo || 'percentual', Number(p.valor)||10, Number(p.minimo)||0, Number(p.usos_maximos)||0, p.validade||null);
      } catch {}
    }
    if (dados.acao === 'desativar_cupom' && p.cupom_id) {
      try { db.prepare('UPDATE cupons SET ativo=0 WHERE id=?').run(p.cupom_id); } catch {}
    }
    if (dados.acao === 'ativar_cupom' && p.cupom_id) {
      try { db.prepare('UPDATE cupons SET ativo=1 WHERE id=?').run(p.cupom_id); } catch {}
    }
    if (dados.acao === 'cancelar_pedido' && p.pedido_id) {
      try { db.prepare(`UPDATE pdv_pedidos SET status='cancelado' WHERE id=?`).run(p.pedido_id); } catch {}
    }
    if (dados.acao === 'avancar_pedido' && p.pedido_id && p.novo_status) {
      const statusValidos = ['espera','preparando','pronto','entregue'];
      if (statusValidos.includes(p.novo_status)) {
        try { db.prepare(`UPDATE pdv_pedidos SET status=? WHERE id=?`).run(p.novo_status, p.pedido_id); } catch {}
      }
    }
    if (dados.acao === 'registrar_insumo' && p.insumo && p.valor_total) {
      try {
        const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
        let item = db.prepare('SELECT * FROM insumo_catalogo WHERE slug=?').get(p.insumo);
        if (!item) {
          const catalogo = db.prepare('SELECT * FROM insumo_catalogo WHERE ativo=1').all();
          const termo = norm(p.insumo);
          item = catalogo.find(c => norm(c.slug) === termo || norm(c.nome) === termo)
            || catalogo.find(c => norm(c.slug).includes(termo) || termo.includes(norm(c.slug)))
            || catalogo.find(c => norm(c.nome).includes(termo) || termo.includes(norm(c.nome)));
        }
        if (item) {
          const qtd = Number(p.quantidade)||1;
          const val = Number(p.valor_total);
          db.prepare(`INSERT INTO insumo_entrada (data, insumo, peso_util, valor_total, custo_kg, fornecedor) VALUES (date('now','-3 hours'), ?, ?, ?, ?, ?)`)
            .run(item.slug, qtd, val, qtd > 0 ? val/qtd : 0, p.fornecedor||null);
        }
      } catch (e) { console.warn('[agente] registrar_insumo:', e.message); }
    }
    if (dados.acao === 'registrar_boleto' && p.fornecedor) {
      try {
        let venc = p.data_vencimento;
        if ((!venc || venc === hoje) && p.dias_vencimento) {
          const d = new Date(agoraBR); d.setDate(d.getDate() + Number(p.dias_vencimento));
          venc = d.toISOString().slice(0, 10);
        }
        if (!venc) { const d = new Date(agoraBR); d.setDate(d.getDate()+7); venc = d.toISOString().slice(0,10); }
        const r = db.prepare(`INSERT INTO boletos (fornecedor, descricao, data_chegada, data_vencimento) VALUES (?,?,date('now','-3 hours'),?)`)
          .run(p.fornecedor, p.descricao||'Registrado pelo NinjaContrlol', venc);
        if (p.valor_total && r.lastInsertRowid) {
          db.prepare(`INSERT INTO boleto_itens (boleto_id, descricao, quantidade, valor_unitario) VALUES (?,?,1,?)`)
            .run(r.lastInsertRowid, p.descricao||p.fornecedor, Number(p.valor_total));
        }
      } catch (e) { console.warn('[agente] registrar_boleto:', e.message); }
    }
    if (dados.acao === 'pagar_boleto' && p.boleto_id) {
      try { db.prepare(`UPDATE boletos SET status='pago', data_pagamento=date('now','-3 hours') WHERE id=?`).run(p.boleto_id); } catch {}
    }
    if (dados.acao === 'toggle_loja') {
      try { db.prepare(`INSERT OR REPLACE INTO config (chave, valor) VALUES ('loja_aberta', ?)`).run(p.abrir ? '1' : '0'); } catch {}
    }

    // Salva resposta raw para histórico de conversa
    dados.resposta_raw = texto;
    res.json(dados);
  } catch (e) {
    console.error('[agente] erro:', e.message);
    res.status(500).json({ resposta_voz: 'Erro interno. Tente novamente.', acao: 'nenhuma', parametros: {}, tag: 'Info' });
  }
});

// ── Admins do relatório diário WhatsApp ──────────────────────────────────────
// GET /api/ia/relatorio-admins → { numeros: ['554499999', ...] }
router.get('/relatorio-admins', requireAuth, (req, res) => {
  const raw = db.prepare('SELECT valor FROM config WHERE chave=?').get('whatsapp_admin')?.valor || '';
  const numeros = raw ? raw.split(',').map(s => s.trim()).filter(Boolean) : [];
  res.json({ numeros });
});

// PUT /api/ia/relatorio-admins → { numeros: ['554499999', ...] }
router.put('/relatorio-admins', requireAuth, (req, res) => {
  const { numeros } = req.body;
  if (!Array.isArray(numeros)) return res.status(400).json({ erro: 'numeros deve ser array' });
  const valor = numeros.map(s => String(s).trim()).filter(Boolean).join(',');
  db.prepare('INSERT OR REPLACE INTO config (chave,valor) VALUES (?,?)').run('whatsapp_admin', valor);
  res.json({ ok: true, numeros: valor ? valor.split(',') : [] });
});

module.exports = router;
