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
// AGENTE DE VOZ — Jarvis
// ══════════════════════════════════════════════════════════════

router.post('/agente', requireAuth, async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const { comando } = req.body;
  if (!comando?.trim()) return res.status(400).json({ erro: 'Comando vazio' });

  // Coleta contexto em tempo real
  let ctx = {};
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const mes  = new Date().toISOString().slice(0, 7);

    ctx.pedidos_ativos = db.prepare(
      `SELECT id, numero, cliente_nome, status, total FROM pdv_pedidos
       WHERE status NOT IN ('entregue','cancelado') ORDER BY id DESC LIMIT 20`
    ).all();

    ctx.resumo_pedidos = db.prepare(
      `SELECT status, COUNT(*) as qt FROM pdv_pedidos WHERE DATE(created_at) = ? GROUP BY status`
    ).all(hoje);

    ctx.faturamento_hoje = db.prepare(
      `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as pedidos
       FROM pdv_pedidos WHERE DATE(created_at) = ? AND status != 'cancelado'`
    ).get(hoje);

    ctx.faturamento_mes = db.prepare(
      `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as pedidos
       FROM pdv_pedidos WHERE strftime('%Y-%m', created_at) = ? AND status != 'cancelado'`
    ).get(mes);

    ctx.boletos_pendentes = db.prepare(
      `SELECT id, fornecedor, descricao, data_vencimento,
        (SELECT COALESCE(SUM(quantidade*valor_unitario),0) FROM boleto_itens WHERE boleto_id=boletos.id) as valor
       FROM boletos WHERE status='pendente' ORDER BY data_vencimento ASC LIMIT 10`
    ).all();

    ctx.itens_cardapio = db.prepare(
      `SELECT i.id, i.nome, i.preco, i.disponivel, c.nome as categoria
       FROM cardapio_itens i LEFT JOIN cardapio_categorias c ON c.id=i.categoria_id
       ORDER BY c.nome, i.nome LIMIT 60`
    ).all();

    ctx.cupons_ativos = db.prepare(
      `SELECT codigo, tipo, valor FROM cupons WHERE ativo=1`
    ).all();

    ctx.insumo_catalogo = db.prepare(
      `SELECT slug, nome, unidade FROM insumo_catalogo WHERE ativo=1 ORDER BY ordem`
    ).all();
  } catch (e) {
    console.warn('[agente] contexto parcial:', e.message);
  }

  if (!apiKey) {
    return res.json({
      resposta_voz: 'Chave de IA não configurada.',
      acao: 'info', parametros: {},
    });
  }

  try {
    const client = new Anthropic({ apiKey });
    const brl = v => `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
    const hoje = new Date().toISOString().slice(0, 10);

    const systemPrompt = `Você é NinjaContrlol, assistente de voz de um sistema de delivery de sushi. Responda em português brasileiro, direto e conciso (máx 2 frases para falar em voz alta).

## CONTEXTO ATUAL (${new Date().toLocaleString('pt-BR')}):

PEDIDOS ATIVOS: ${ctx.pedidos_ativos?.length || 0}
${ctx.pedidos_ativos?.map(p => `  #${p.numero} ${p.cliente_nome} - ${p.status} - ${brl(p.total)}`).join('\n') || '  Nenhum'}

HOJE: ${brl(ctx.faturamento_hoje?.total || 0)} / ${ctx.faturamento_hoje?.pedidos || 0} pedidos
MÊS: ${brl(ctx.faturamento_mes?.total || 0)} / ${ctx.faturamento_mes?.pedidos || 0} pedidos

BOLETOS PENDENTES (${ctx.boletos_pendentes?.length || 0}):
${ctx.boletos_pendentes?.map(b => `  ${b.fornecedor} - ${brl(b.valor)} - vence ${b.data_vencimento}`).join('\n') || '  Nenhum'}

CARDÁPIO (${ctx.itens_cardapio?.length || 0} itens):
${ctx.itens_cardapio?.map(i => `  [${i.id}] ${i.nome} ${brl(i.preco)} ${i.disponivel ? '' : '⛔PAUSADO'}`).join('\n') || '  Sem itens'}

INSUMOS DISPONÍVEIS (slugs para registro de entrada):
${ctx.insumo_catalogo?.map(i => `  ${i.slug} = ${i.nome} (${i.unidade})`).join('\n') || '  Sem catálogo'}

CUPONS ATIVOS: ${ctx.cupons_ativos?.map(c => c.codigo).join(', ') || 'Nenhum'}

## AÇÕES DISPONÍVEIS — retorne EXATAMENTE este JSON (sem markdown):
{
  "resposta_voz": "frase curta para falar em voz alta",
  "acao": "nav|lista_add|pausar_item|ativar_item|criar_cupom|info|cancelar_pedido|registrar_insumo|registrar_boleto|nenhuma",
  "parametros": {}
}

PARÂMETROS POR AÇÃO:
- nav: { "pagina": "/pdv" }
- lista_add: { "item": "cebolinha" }
- pausar_item: { "item_id": 12, "nome": "Hot Roll" }
- ativar_item: { "item_id": 12, "nome": "Hot Roll" }
- criar_cupom: { "codigo": "PROMO10", "tipo": "percentual", "valor": 10, "minimo": 30 }
- cancelar_pedido: { "pedido_id": 5, "numero": 42 }
- registrar_insumo: { "insumo": "salmao", "quantidade": 30, "valor_total": 900, "fornecedor": "Cia do Salmão" }
  (use o slug correto do catálogo acima; para insumos simples: quantidade = peso/qtd na unidade do item)
- registrar_boleto: { "fornecedor": "Atacado X", "descricao": "Compra de insumos", "valor_total": 500, "data_vencimento": "${hoje}", "dias_vencimento": 7 }
  (se o usuário disser "vence em 7 dias" calcule a data; se disser "dia 30" use o mês atual)
- info: (só resposta_voz com os dados do contexto)

Páginas para nav: /dashboard, /pdv, /despesas, /lista-compras, /faturamento, /boletos, /relatorios, /whatsapp, /clientes, /cardapio-admin, /campanhas, /producao, /insumos`;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: `Comando: "${comando.trim()}"` }],
      system: systemPrompt,
    });

    const texto = message.content[0].text.trim();
    let dados;
    try {
      const match = texto.match(/\{[\s\S]*\}/);
      dados = JSON.parse(match ? match[0] : texto);
    } catch {
      return res.json({ resposta_voz: 'Não entendi. Tente novamente.', acao: 'nenhuma', parametros: {} });
    }

    // ── Executa ações que precisam do backend ────────────────
    const p = dados.parametros || {};

    if (dados.acao === 'pausar_item' && p.item_id) {
      try { db.prepare('UPDATE cardapio_itens SET disponivel=0 WHERE id=?').run(p.item_id); } catch {}
    }
    if (dados.acao === 'ativar_item' && p.item_id) {
      try { db.prepare('UPDATE cardapio_itens SET disponivel=1 WHERE id=?').run(p.item_id); } catch {}
    }
    if (dados.acao === 'criar_cupom' && p.codigo) {
      try {
        db.prepare(`INSERT OR IGNORE INTO cupons (codigo,tipo,valor,minimo,usos_maximos) VALUES (?,?,?,?,0)`)
          .run(p.codigo.toUpperCase(), p.tipo || 'percentual', Number(p.valor) || 10, Number(p.minimo) || 0);
      } catch {}
    }
    if (dados.acao === 'cancelar_pedido' && p.pedido_id) {
      try { db.prepare(`UPDATE pdv_pedidos SET status='cancelado' WHERE id=?`).run(p.pedido_id); } catch {}
    }
    if (dados.acao === 'registrar_insumo' && p.insumo && p.valor_total) {
      try {
        const item = db.prepare('SELECT * FROM insumo_catalogo WHERE slug=?').get(p.insumo);
        if (item) {
          const qtd = Number(p.quantidade) || 1;
          const val = Number(p.valor_total);
          db.prepare(`
            INSERT INTO insumo_entrada (data, insumo, peso_util, valor_total, custo_kg, fornecedor)
            VALUES (date('now'), ?, ?, ?, ?, ?)
          `).run(item.slug, qtd, val, qtd > 0 ? val / qtd : 0, p.fornecedor || null);
        }
      } catch (e) { console.warn('[agente] registrar_insumo:', e.message); }
    }
    if (dados.acao === 'registrar_boleto' && p.fornecedor) {
      try {
        let venc = p.data_vencimento;
        if (!venc && p.dias_vencimento) {
          const d = new Date(); d.setDate(d.getDate() + Number(p.dias_vencimento));
          venc = d.toISOString().slice(0, 10);
        }
        if (!venc) venc = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        const r = db.prepare(
          `INSERT INTO boletos (fornecedor, descricao, data_chegada, data_vencimento) VALUES (?,?,date('now'),?)`
        ).run(p.fornecedor, p.descricao || 'Registrado pelo NinjaContrlol', venc);
        if (p.valor_total && r.lastInsertRowid) {
          db.prepare(
            `INSERT INTO boleto_itens (boleto_id, descricao, quantidade, valor_unitario) VALUES (?,?,1,?)`
          ).run(r.lastInsertRowid, p.descricao || p.fornecedor, Number(p.valor_total));
        }
      } catch (e) { console.warn('[agente] registrar_boleto:', e.message); }
    }

    res.json(dados);
  } catch (e) {
    console.error('[agente] erro:', e.message);
    res.status(500).json({ resposta_voz: 'Erro interno. Tente novamente.', acao: 'nenhuma', parametros: {} });
  }
});

module.exports = router;
