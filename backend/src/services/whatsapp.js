/**
 * Serviço de WhatsApp automático via whatsapp-web.js
 * Conecta uma vez via QR code e envia mensagens automaticamente.
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Caminho absoluto para a sessão — suporta WHATSAPP_SESSION_PATH para multi-unidade
const SESSION_PATH = process.env.WHATSAPP_SESSION_PATH
  ? path.resolve(process.env.WHATSAPP_SESSION_PATH)
  : path.join(__dirname, '..', '..', 'whatsapp-session');

// ──────────────────────────────────────────────────────────────
//  Proteção contra Chromes "zumbis": quando o servidor é encerrado
//  à força, o Chrome do puppeteer pode ficar rodando e travar a
//  pasta de sessão, deixando o WhatsApp preso em "Aguardando QR".
//  Antes de iniciar um novo cliente (cliente sempre é null aqui),
//  matamos qualquer Chrome que ainda esteja segurando a sessão e
//  removemos os locks de instância única.
// ──────────────────────────────────────────────────────────────
function limparChromesZumbis() {
  if (process.platform === 'win32') {
    try {
      execSync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq \'chrome.exe\' -and $_.CommandLine -like \'*whatsapp-session*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"',
        { timeout: 15000, stdio: 'ignore' }
      );
    } catch {}
  } else {
    // Linux/Mac: mata processos chrome/chromium que referenciam a sessão
    try { execSync(`pkill -f "whatsapp-session" 2>/dev/null`, { timeout: 10000, stdio: 'ignore' }); } catch {}
  }
  // Remove locks de instância única que impedem o relançamento
  try {
    const def = path.join(SESSION_PATH, 'session', 'Default');
    ['SingletonLock', 'SingletonCookie', 'SingletonSocket'].forEach(f => {
      try { fs.rmSync(path.join(def, f), { force: true }); } catch {}
    });
  } catch {}
}

let cliente = null;
let status = 'desconectado'; // 'desconectado' | 'aguardando_qr' | 'conectando' | 'pronto' | 'erro'
let reconectando = false;
let qrBase64 = null;
let iniciadoEm = 0; // quando o init atual começou (watchdog de init pendurado)
let qrListeners = new Set(); // SSE listeners aguardando QR

// ── Rate limiting por número ─────────────────────────────────
// Máx 10 respostas automáticas por número a cada 60 minutos
const _rateMap = new Map(); // telefone → { count, resetAt }
const RATE_LIMIT = 200;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hora

function checkRateLimit(telefone) {
  const agora = Date.now();
  const entry = _rateMap.get(telefone);
  if (!entry || agora > entry.resetAt) {
    _rateMap.set(telefone, { count: 1, resetAt: agora + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) {
    console.warn(`[Rate limit] ${telefone} atingiu ${RATE_LIMIT} respostas/hora — ignorando`);
    return false;
  }
  entry.count++;
  return true;
}

// Limpa entradas expiradas a cada hora para não vazar memória
setInterval(() => {
  const agora = Date.now();
  for (const [k, v] of _rateMap) if (agora > v.resetAt) _rateMap.delete(k);
}, RATE_WINDOW_MS);

const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ── Mensagens ────────────────────────────────────────────────
function formatarTelefone(tel) {
  const num = tel.replace(/\D/g, '');
  const comDDI = num.startsWith('55') ? num : `55${num}`;
  return `${comDDI}@c.us`;
}

const MENSAGENS = {
  confirmacao: (p) =>
`🍣 *Sushi Control — Pedido Confirmado!*

Olá, *${p.cliente_nome}*! 😊

Seu pedido foi recebido com sucesso:

📋 *Pedido:* #${p.numero}
📦 *Itens:*
${p.itens.map(i => `  • ${i.quantidade}x ${i.item_nome} — ${brl(i.valor_unitario * i.quantidade)}`).join('\n')}

💰 *Total:* ${brl(p.total)}
📍 *Entrega:* ${p.cliente_endereco}

⏱ Tempo estimado: *40 a 60 minutos*

🔍 *Acompanhe seu pedido em tempo real:*
${process.env.APP_URL || 'http://localhost:3000'}/pedido/${p.id}

Qualquer dúvida, é só responder esta mensagem. 🙏`,

  preparando: (p) =>
`👨‍🍳 *Pedido #${p.numero} em preparo!*

Olá, *${p.cliente_nome}*!

Seu pedido já está sendo preparado com carinho pela nossa equipe. 🍣✨

Em breve sairá para entrega!`,

  saindo: (p) =>
`🛵 *Pedido #${p.numero} saindo para entrega!*

Olá, *${p.cliente_nome}*!

Seu pedido acabou de sair e está a caminho! 🎉

📍 Entregando em: ${p.cliente_endereco}

Fique de olho, chegará em instantes! 😋`,

  entregue: (p) =>
`✅ *Pedido #${p.numero} entregue!*

Olá, *${p.cliente_nome}*!

Seu pedido foi entregue com sucesso. Bom apetite! 🍣🥢

Gostou? Nos conte como foi a experiência — seu feedback é muito importante para nós! ⭐

Obrigado pela preferência. *Até a próxima!* 😊`,

  cancelado: (p) =>
`❌ *Pedido #${p.numero} — Cancelado*

Olá, *${p.cliente_nome}*.

Infelizmente não conseguimos processar seu pedido neste momento. 😔

Por favor, entre em contato conosco para mais informações ou para realizar um novo pedido.

Pedimos desculpas pelo transtorno! 🙏`,
};

// Liga/desliga toda a automação de WhatsApp (WHATSAPP_ENABLED=false no .env).
// Usado quando o número está em outro sistema/CRM, para não haver duas
// automações na mesma conta (causa quedas e risco de banimento).
const WHATSAPP_ATIVO = process.env.WHATSAPP_ENABLED !== 'false';

// ── Inicializar cliente ──────────────────────────────────────
function iniciar() {
  if (!WHATSAPP_ATIVO) { status = 'desligado'; return; }
  if (cliente || reconectando) return;
  reconectando = true;
  status = 'aguardando_qr';
  qrBase64 = null;
  iniciadoEm = Date.now(); // marca o início para o watchdog de init pendurado

  // Auto-cura: remove Chromes zumbis e locks antes de lançar o cliente
  limparChromesZumbis();

  // ── Versão fixada do WhatsApp Web (auto, sem hardcode) ──────
  // Lê a ÚLTIMA versão que conectou com sucesso (gravada no cache local
  // pelo wwebjs) e a fixa via webVersion. Combinado com o cache local,
  // a página carrega SEMPRE essa mesma versão estável em vez de buscar a
  // versão "ao vivo" (que muda e quebra a sessão na restauração com
  // "Execution context was destroyed by navigation"). Resultado: a sessão
  // sobrevive ao restart do servidor sem precisar reescanear o QR.
  // No primeiríssimo scan (cache vazio) fica undefined → busca ao vivo e
  // grava o cache para os próximos restarts.
  const WWEB_CACHE_DIR = path.join(SESSION_PATH, 'wweb-cache');
  let webVersionFixada;
  try {
    const htmls = fs.readdirSync(WWEB_CACHE_DIR).filter(f => f.endsWith('.html'));
    if (htmls.length) {
      htmls.sort(); // a maior versão = a última que funcionou
      webVersionFixada = htmls[htmls.length - 1].replace(/\.html$/, '');
      console.log('[WhatsApp] Versão fixada do cache local:', webVersionFixada);
    }
  } catch {}

  cliente = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
    ...(webVersionFixada ? { webVersion: webVersionFixada } : {}),
    webVersionCache: { type: 'local', path: WWEB_CACHE_DIR },
    puppeteer: {
      headless: true,
      executablePath: process.platform === 'win32'
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : (process.env.CHROME_PATH || '/usr/bin/chromium-browser'),
      protocolTimeout: 120000,
      timeout: 120000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-accelerated-2d-canvas',
        '--disable-features=VizDisplayCompositor,IsolateOrigins,site-per-process',
        '--no-first-run',
        '--no-zygote',
      ],
    },
  });

  cliente.on('qr', async (qr) => {
    status = 'aguardando_qr';
    try {
      qrBase64 = await qrcode.toDataURL(qr, { width: 300, margin: 2 });
      // Notifica todos os listeners SSE
      qrListeners.forEach(res => {
        try { res.write(`event: qr\ndata: ${JSON.stringify({ qr: qrBase64 })}\n\n`); } catch {}
      });
    } catch (err) {
      console.error('[WhatsApp] Erro ao gerar QR:', err);
    }
    console.log('[WhatsApp] Aguardando leitura do QR code...');
  });

  cliente.on('ready', () => {
    status = 'pronto';
    reconectando = false;
    qrBase64 = null;
    qrListeners.forEach(res => {
      try { res.write(`event: pronto\ndata: {}\n\n`); } catch {}
    });
    console.log('[WhatsApp] ✅ Conectado e pronto para enviar mensagens!');
  });

  cliente.on('authenticated', () => {
    status = 'conectando';
    console.log('[WhatsApp] Autenticado.');
    // Se não ficar pronto em 10min, reinicia sem apagar a sessão.
    // (a sincronização INICIAL de contas com muito histórico pode passar de
    //  5min; um timeout curto matava o cliente no meio da sincronização e
    //  reentrava num loop de reconexão que nunca chegava em "pronto")
    setTimeout(async () => {
      if (status === 'conectando') {
        console.warn('[WhatsApp] ⚠ Preso em "conectando" por 10min — reiniciando cliente...');
        try { await cliente?.destroy(); } catch {}
        cliente = null;
        reconectando = false;
        status = 'desconectado';
        setTimeout(() => iniciar(), 3000);
      }
    }, 600000);
  });

  cliente.on('auth_failure', () => {
    status = 'aguardando_qr';
    cliente = null;
    reconectando = false;
    console.error('[WhatsApp] Falha na autenticação — sessão inválida. Limpando sessão e gerando novo QR...');
    // Apaga sessão corrompida para forçar novo QR
    try {
      const sessionDir = path.join(SESSION_PATH, 'session');
      if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
    } catch (e) { console.error('[WhatsApp] Erro ao limpar sessão:', e.message); }
    setTimeout(() => iniciar(), 3000);
  });

  cliente.on('disconnected', (reason) => {
    status = 'desconectado';
    cliente = null;
    reconectando = false;
    console.log('[WhatsApp] Desconectado. Motivo:', reason);
    console.log('[WhatsApp] Reconectando em 10s...');
    setTimeout(() => iniciar(), 10000);
  });

  // ── Receber mensagens ──────────────────────────────────────
  cliente.on('message', async (msg) => {
    try {
      if (msg.isStatus || msg.from === 'status@broadcast') return;
      const chatId = msg.from; // ID real do WhatsApp (pode ser LID)
      const telefone = chatId.replace('@c.us', '').replace('@lid', '').replace(/\D/g,'');
      const corpo = msg.body || '';
      const contact = await msg.getContact().catch(() => null);
      const nome = contact?.pushname || contact?.name || telefone;
      // Número REAL do cliente (resolve LID/número oculto) — usado para casar
      // com o pedido feito no site, onde o cliente digitou o telefone de verdade.
      const telefoneReal = (contact?.number || telefone).replace(/\D/g, '');

      await receberMensagem({ telefone, telefoneReal, nome, corpo, waId: msg.id?.id, chatId });
    } catch (err) {
      console.error('[WhatsApp] Erro ao processar mensagem recebida:', err.message);
    }
  });

  cliente.initialize().catch(async err => {
    console.error('[WhatsApp] Erro ao inicializar:', err.message);
    // CRÍTICO: destrói o cliente e mata o Chrome órfão antes de tentar de novo.
    // Sem isso, o Chrome da tentativa que falhou continua vivo segurando a pasta
    // de sessão, e toda retentativa colide com "The browser is already running".
    try { await cliente?.destroy(); } catch {}
    cliente = null;
    reconectando = false;
    status = 'erro';
    limparChromesZumbis();
    setTimeout(() => iniciar(), 8000);
  });
}

// ── Auto-recuperação permanente ──────────────────────────────
// Rede de segurança: a cada 2min, se o WhatsApp estiver em estado
// terminal ('erro' ou 'desconectado') e ninguém estiver tentando
// reconectar, religa sozinho. Cobre qualquer caso de borda em que a
// cadeia de retry tenha parado — garante que a conexão NUNCA fique
// presa indefinidamente sem intervenção manual.
setInterval(async () => {
  // (a) Estado terminal sem cliente → religa
  if (!reconectando && !cliente && (status === 'erro' || status === 'desconectado')) {
    console.log(`[WhatsApp] 🩺 Auto-recuperação: status="${status}" — religando sozinho...`);
    iniciar();
    return;
  }
  // (b) Init PENDURADO: preso em "aguardando_qr" sem gerar QR por +90s.
  // Acontece quando o initialize() do puppeteer trava na restauração da
  // sessão (nem resolve, nem rejeita). Força destruir e reiniciar limpo.
  if (status === 'aguardando_qr' && !qrBase64 && iniciadoEm && (Date.now() - iniciadoEm > 90000)) {
    console.warn('[WhatsApp] 🩺 Init pendurado em "aguardando_qr" sem QR por +90s — forçando reinício...');
    try { await cliente?.destroy(); } catch {}
    cliente = null;
    reconectando = false;
    status = 'desconectado';
    limparChromesZumbis();
    iniciar();
  }
}, 30000);

// ── Enviar por chatId direto (sem resolver número) ───────────
async function enviarParaChatId(chatIdOuTelefone, mensagem) {
  if (status !== 'pronto' || !cliente) return false;
  try {
    // Se já é um chatId completo (tem @), usa direto
    let chatId = chatIdOuTelefone;
    if (!chatId.includes('@')) {
      const num = chatId.replace(/\D/g,'');
      chatId = (num.startsWith('55') ? num : `55${num}`) + '@c.us';
    }
    console.log(`[WhatsApp] → Enviando para ${chatId}`);
    await cliente.sendMessage(chatId, mensagem);
    console.log(`[WhatsApp] ✅ Enviado para ${chatId}`);
    return true;
  } catch (err) {
    console.error(`[WhatsApp] ❌ Erro ao enviar:`, err.message);
    return false;
  }
}

// ── Enviar mensagem ──────────────────────────────────────────
async function enviar(telefone, mensagem) {
  console.log(`[WhatsApp] Tentando enviar para ${telefone} | status atual: ${status}`);
  if (status !== 'pronto' || !cliente) {
    console.warn('[WhatsApp] ⚠ Não conectado — mensagem NÃO enviada. Status:', status);
    return false;
  }
  try {
    const foneBase = telefone.replace(/\D/g, '');
    const comDDI = foneBase.startsWith('55') ? foneBase : `55${foneBase}`;
    const chatIdFallback = `${comDDI}@c.us`;

    // Tenta obter o chatId correto via getNumberId (resolve LID)
    let chatId = chatIdFallback;
    try {
      const numberId = await cliente.getNumberId(comDDI);
      if (numberId?._serialized) {
        chatId = numberId._serialized;
        console.log(`[WhatsApp] → chatId resolvido: ${chatId}`);
      } else {
        console.log(`[WhatsApp] → getNumberId retornou null, usando fallback: ${chatIdFallback}`);
      }
    } catch (e) {
      console.log(`[WhatsApp] → getNumberId falhou (${e.message}), usando fallback: ${chatIdFallback}`);
    }

    await cliente.sendMessage(chatId, mensagem);
    console.log(`[WhatsApp] ✅ Mensagem enviada para ${telefone} (${chatId})`);
    return true;
  } catch (err) {
    console.error(`[WhatsApp] ❌ Erro ao enviar para ${telefone}:`, err.message);
    return false;
  }
}

// ── API de status/QR via SSE ─────────────────────────────────
function sseStatus(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Envia estado atual imediatamente
  res.write(`event: status\ndata: ${JSON.stringify({ status, qr: qrBase64 })}\n\n`);

  const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20000);
  qrListeners.add(res);
  req.on('close', () => { qrListeners.delete(res); clearInterval(hb); });
}

// ── Mensagens automáticas por evento ────────────────────────
async function notificarNovoPedido(pedido) {
  console.log(`[WhatsApp] notificarNovoPedido — pedido #${pedido.numero} | telefone: ${pedido.cliente_telefone || 'NENHUM'}`);
  if (!pedido.cliente_telefone) {
    console.warn('[WhatsApp] Pedido sem telefone — mensagem não enviada.');
    return;
  }
  try {
    await enviar(pedido.cliente_telefone, MENSAGENS.confirmacao(pedido));
  } catch (err) {
    console.error('[WhatsApp] Erro em notificarNovoPedido:', err.message);
  }
}

async function notificarMudancaStatus(pedido, novoStatus) {
  console.log(`[WhatsApp] notificarMudancaStatus — pedido #${pedido.numero} → ${novoStatus} | telefone: ${pedido.cliente_telefone || 'NENHUM'}`);
  if (!pedido.cliente_telefone) return;
  const mapa = {
    preparando: MENSAGENS.preparando,
    pronto:     MENSAGENS.saindo,
    entregue:   MENSAGENS.entregue,
    cancelado:  MENSAGENS.cancelado,
  };
  const fn = mapa[novoStatus];
  if (!fn) { console.warn(`[WhatsApp] Sem mensagem para status: ${novoStatus}`); return; }
  try {
    await enviar(pedido.cliente_telefone, fn(pedido));
  } catch (err) {
    console.error('[WhatsApp] Erro em notificarMudancaStatus:', err.message);
  }
}

// ── Chat: receber mensagem, salvar no banco, responder com IA ──
const db = require('../db/database');
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Coluna pra guardar o número real do cliente (resolve LID) na conversa
try { db.exec('ALTER TABLE wa_conversas ADD COLUMN telefone_real TEXT'); } catch {}

// ── Pedido do cliente para o contexto da IA ──────────────────
// Busca o pedido mais recente do cliente (pelo telefone real) e devolve uma
// descrição em linguagem natural do STATUS atual, pra IA saber tudo sobre o
// pedido e responder rastreamento ("já saiu pra entrega?") com precisão.
function contextoPedidoCliente(conversa) {
  try {
    const tel = (conversa?.telefone_real || conversa?.telefone || '').replace(/\D/g, '');
    const nome = (conversa?.nome || '').trim();

    // 1. Casa pelo TELEFONE (quando o número real do cliente bate com o do
    //    pedido feito no site).
    let pedidos = [];
    if (tel.length >= 8) {
      pedidos = db.prepare(
        `SELECT * FROM pdv_pedidos WHERE cliente_telefone LIKE ? ORDER BY id DESC LIMIT 6`
      ).all('%' + tel.slice(-8));
    }
    // 2. Fallback pelo NOME — essencial para conversas via LID (identificador
    //    de privacidade do WhatsApp), em que o telefone da conversa NÃO casa
    //    com o do pedido. Restrito aos últimos 2 dias para não pegar homônimos
    //    de pedidos antigos.
    const primeiroNome = nome.split(/\s+/)[0] || '';
    if (pedidos.length === 0 && primeiroNome.length >= 3) {
      // Casa pelo PRIMEIRO NOME como prefixo, pois o pushname do WhatsApp
      // ("renan") costuma diferir do nome digitado no site ("Renan Hayashi",
      // "Renanyhc"). Prefixo cobre as duas direções.
      pedidos = db.prepare(`
        SELECT * FROM pdv_pedidos
        WHERE LOWER(cliente_nome) LIKE LOWER(?) || '%'
          AND date(created_at) >= date('now','-2 days')
        ORDER BY id DESC LIMIT 6
      `).all(primeiroNome);
    }
    if (pedidos.length === 0) return '';

    // Prioriza os pedidos em andamento; se não houver, mostra o último.
    const ativos = pedidos.filter(p => ['novo', 'preparando', 'pronto'].includes(p.status));
    const relevantes = ativos.length ? ativos : [pedidos[0]];

    const statusTxt = (s) => ({
      novo:       'recebido, aguardando a cozinha começar',
      preparando: 'EM PREPARO na cozinha',
      pronto:     'PRONTO e SAIU PARA ENTREGA (a caminho do cliente)',
      entregue:   'ENTREGUE ao cliente',
      cancelado:  'CANCELADO',
    }[s] || s);
    const hora = c => { try { return new Date(c + 'Z').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

    const bloco = (p) => {
      const itens = db.prepare('SELECT quantidade, item_nome FROM pdv_itens WHERE pedido_id=?').all(p.id);
      const listaItens = itens.map(i => `${i.quantidade}x ${i.item_nome}`).join(', ');
      let t = '';
      if (p.aceito_em)   t += ` Preparo começou às ${hora(p.aceito_em)}.`;
      if (p.pronto_em)   t += ` Saiu para entrega às ${hora(p.pronto_em)}.`;
      if (p.entregue_em) t += ` Entregue às ${hora(p.entregue_em)}.`;
      return `• Pedido #${p.numero} (feito às ${hora(p.created_at)}) — Status: ${statusTxt(p.status)}.${t}\n  Itens: ${listaItens || '—'}. Total: R$${Number(p.total).toFixed(2)}.${p.bairro ? ` Bairro: ${p.bairro}.` : ''}${p.agendado_para ? ` Agendado para: ${p.agendado_para}.` : ''}`;
    };

    const corpo = relevantes.map(bloco).join('\n');
    const nota = ativos.length
      ? 'Use estes dados REAIS para responder sobre QUALQUER um desses pedidos (status, itens, horários, "já saiu?", "cadê meu pedido #X?"). Tempo médio após sair para entrega: 15-30 min. NUNCA diga que não tem acesso ou que o pedido não está registrado.'
      : 'O cliente não tem pedidos em andamento agora; o pedido acima já foi finalizado.';

    return `\n\nPEDIDOS DESTE CLIENTE (você TEM acesso total a isto):\n${corpo}\n${nota}`;
  } catch { return ''; }
}

let io = null; // Socket.io instance (setada pelo index.js)
function setIo(ioInstance) { io = ioInstance; }

// Detecta pedidos de acompanhamento/ajuste vindos pelo WhatsApp
const RE_SOLICITACAO = /(wasabi|gengibre|shoyu|tar[eê]|hashi|adicion|acrescent|coloca|incluir|inclua|extra|sem\s+\w+|tira[r]?|troca[r]?|mais\s+\w+)/i;

// Best-effort: anexa a solicitação do cliente nas observações do pedido
// ATIVO dele (ainda não entregue/cancelado), pra aparecer no PDV.
// Casa pelo final do telefone E, como fallback, pelo primeiro nome — pois
// conversas via LID têm telefone que NÃO bate com o do pedido (senão o bot
// dizia "avisei a cozinha" mas a observação nunca era anexada).
function anexarSolicitacaoAoPedido(telefone, corpo, nome) {
  try {
    const tel = (telefone || '').replace(/\D/g, '');
    let pedido = null;
    if (tel.length >= 8) {
      pedido = db.prepare(`
        SELECT id, numero, observacao FROM pdv_pedidos
        WHERE cliente_telefone LIKE ? AND status IN ('novo','preparando','pronto')
          AND date(created_at) >= date('now','-2 days')
        ORDER BY id DESC LIMIT 1
      `).get('%' + tel.slice(-8));
    }
    // Fallback por primeiro nome (caso LID)
    const primeiroNome = (nome || '').trim().split(/\s+/)[0] || '';
    if (!pedido && primeiroNome.length >= 3) {
      pedido = db.prepare(`
        SELECT id, numero, observacao FROM pdv_pedidos
        WHERE LOWER(cliente_nome) LIKE LOWER(?) || '%' AND status IN ('novo','preparando','pronto')
          AND date(created_at) >= date('now','-2 days')
        ORDER BY id DESC LIMIT 1
      `).get(primeiroNome);
    }
    if (!pedido) return false;
    const marca = `📩 WhatsApp: ${corpo.trim()}`;
    if ((pedido.observacao || '').includes(marca)) return true; // evita duplicar
    const nova = pedido.observacao ? `${pedido.observacao}\n${marca}` : marca;
    db.prepare('UPDATE pdv_pedidos SET observacao=? WHERE id=?').run(nova, pedido.id);
    console.log(`[WhatsApp] Solicitação anexada ao pedido #${pedido.numero}: "${corpo.trim()}"`);
    if (io) io.emit('pedido:atualizado', { id: pedido.id });
    return true;
  } catch (e) { console.error('[WhatsApp] anexarSolicitacao erro:', e.message); return false; }
}

async function receberMensagem({ telefone, telefoneReal, nome, corpo, waId, chatId }) {
  // Upsert conversa — salva o chatId real para envio correto + telefone real
  db.prepare(`
    INSERT INTO wa_conversas(telefone, nome, ultima_mensagem, ultima_em, nao_lidas, chat_id, telefone_real)
    VALUES(?,?,?,datetime('now'),1,?,?)
    ON CONFLICT(telefone) DO UPDATE SET
      nome = COALESCE(excluded.nome, nome),
      ultima_mensagem = excluded.ultima_mensagem,
      ultima_em = excluded.ultima_em,
      nao_lidas = nao_lidas + 1,
      chat_id = COALESCE(excluded.chat_id, chat_id),
      telefone_real = COALESCE(excluded.telefone_real, telefone_real)
  `).run(telefone, nome, corpo, chatId || null, telefoneReal || null);

  const conversa = db.prepare('SELECT * FROM wa_conversas WHERE telefone=?').get(telefone);

  // Salva mensagem recebida
  const msgRow = db.prepare(`
    INSERT INTO wa_mensagens(conversa_id, wa_id, de, corpo, de_mim, lida)
    VALUES(?,?,?,?,0,0)
  `).run(conversa.id, waId || null, telefone, corpo);

  const mensagem = {
    id: msgRow.lastInsertRowid,
    conversa_id: conversa.id,
    de: telefone,
    corpo,
    de_mim: 0,
    ia: 0,
    created_at: new Date().toISOString(),
  };

  // Emite para todos os clientes conectados via Socket.io
  if (io) {
    io.emit('wa:mensagem', { conversa, mensagem });
    io.emit('wa:conversas_atualizar');
  }

  // Se for um pedido de acompanhamento/ajuste, anexa ao pedido ativo do
  // cliente pra a equipe ver no PDV (torna real o "avisei a equipe" da IA).
  // Usa o telefone REAL (resolve LID) pra casar com o pedido do site.
  if (RE_SOLICITACAO.test(corpo || '')) anexarSolicitacaoAoPedido(telefoneReal || telefone, corpo, nome);

  // Verifica se IA está ativa para esta conversa
  const cfg = db.prepare('SELECT * FROM wa_config WHERE id=1').get();
  if (!conversa.ia_ativa || !cfg?.ia_global) return;

  // Em vez de responder imediatamente (o que gera várias saudações quando o
  // cliente manda 2-3 mensagens seguidas), agenda UMA resposta com debounce:
  // espera alguns segundos após a última mensagem e responde só uma vez.
  agendarRespostaIA(telefone);
}

// ── Debounce de resposta da IA ───────────────────────────────
// Agrupa mensagens recebidas em rajada: cada nova mensagem reinicia o timer,
// e quando ele expira gera UMA única resposta considerando todo o histórico.
const _debounceIA = new Map(); // telefone -> timeout
const DEBOUNCE_MS = 6000;

function agendarRespostaIA(telefone) {
  clearTimeout(_debounceIA.get(telefone));
  _debounceIA.set(telefone, setTimeout(() => {
    _debounceIA.delete(telefone);
    responderComIA(telefone).catch(err => console.error('[WhatsApp IA] Erro:', err.message));
  }, DEBOUNCE_MS));
}

async function responderComIA(telefone) {
  const conversa = db.prepare('SELECT * FROM wa_conversas WHERE telefone=?').get(telefone);
  if (!conversa || !conversa.ia_ativa) return; // pode ter sido assumida nesse meio tempo
  const cfg = db.prepare('SELECT * FROM wa_config WHERE id=1').get();
  if (!cfg?.ia_global) return;

  // O bot atende 24h: NÃO há restrição de horário para responder dúvidas.
  // (O horário de atendimento vale só para a LOJA aceitar pedidos, não para a IA.)

  // Rate limiting — uma resposta por rajada consome um token
  if (!checkRateLimit(telefone)) return;

  // Junta as mensagens do cliente ainda não respondidas (após a última do bot)
  const ultimoBot = db.prepare(
    'SELECT MAX(id) m FROM wa_mensagens WHERE conversa_id=? AND de_mim=1'
  ).get(conversa.id)?.m || 0;
  const pendentes = db.prepare(
    'SELECT corpo FROM wa_mensagens WHERE conversa_id=? AND de_mim=0 AND id>? ORDER BY id'
  ).all(conversa.id, ultimoBot).map(r => (r.corpo || '').trim()).filter(Boolean);
  const mensagemAtual = pendentes.join('\n') || conversa.ultima_mensagem || '?';

  try {
    const resposta = await gerarRespostaIA(conversa, mensagemAtual, cfg);
    if (resposta) await enviarEsalvar(conversa, resposta, true);
  } catch (err) {
    console.error('[WhatsApp IA] Erro ao gerar resposta:', err.message);
  }
}

function buildSystemPrompt(cfg) {
  let cardapioCtx = '';
  try {
    const itens = db.prepare('SELECT nome, preco FROM cardapio_itens WHERE disponivel=1 ORDER BY ordem LIMIT 200').all();
    if (itens.length) cardapioCtx = `\nCardápio (use estes preços, não invente): ${itens.map(i => `${i.nome} R$${Number(i.preco).toFixed(2)}`).join(' | ')}`;
  } catch {}

  let restConfig = '';
  try {
    const c = db.prepare('SELECT * FROM config WHERE id=1').get();
    if (c?.nome_restaurante) restConfig = `\nRestaurante: ${c.nome_restaurante}.${c.endereco?' Endereço: '+c.endereco+'.':''}`;
  } catch {}

  let exemplosCtx = '';
  try {
    const exemplos = db.prepare('SELECT pergunta, resposta FROM wa_exemplos WHERE ativo=1 LIMIT 15').all();
    if (exemplos.length) exemplosCtx = '\n\nExemplos (siga este tom e estilo):\n' + exemplos.map(e => `P: ${e.pergunta}\nR: ${e.resposta}`).join('\n');
  } catch {}

  const appUrl = process.env.APP_URL || 'http://localhost:3001';
  const cardapioUrl = `${appUrl}/cardapio`;

  // Diretriz de atendimento 24h — IMPEDE a IA de dizer "fora do horário".
  // Sem isto, a IA copiava mensagens "Estamos fora do horário" do próprio
  // histórico (poluído por respostas antigas) e se recusava a atender de
  // madrugada. O horário só restringe a LOJA aceitar pedidos, nunca o bot.
  const horaBR = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', hour: '2-digit', minute: '2-digit' });
  const fmtH = s => (s || '').trim().replace(':00', 'h').replace(':', 'h');
  const [abreStr, fechaStr] = (cfg?.horario_atendimento || '18:00-23:00').split('-');
  const horarioLoja = `${fmtH(abreStr)} às ${fmtH(fechaStr)}`;
  const lojaAberta = dentroDoHorario(cfg?.horario_atendimento);
  const diretriz24h = `\n\nATENDIMENTO (regra absoluta): agora é ${horaBR}. Você (atendente virtual) responde e ajuda o cliente a QUALQUER hora, dia ou madrugada — NUNCA recuse a conversar, NUNCA diga "estamos fora do horário de atendimento" nem mande o cliente voltar depois. MAS os PEDIDOS só são aceitos no horário de funcionamento da loja: ${horarioLoja}, todos os dias. ${lojaAberta ? 'A loja está ABERTA agora — o cliente pode pedir normalmente pelo site.' : `A loja está FECHADA agora para pedidos (abre às ${fmtH(abreStr)}). Se o cliente quiser fazer um pedido, avise com gentileza que a cozinha abre às ${fmtH(abreStr)}, mas continue ajudando com dúvidas normalmente.`} NUNCA diga que "funcionamos 24 horas" — isso é FALSO; apenas o atendimento por mensagem é 24h, a cozinha tem horário (${horarioLoja}). O cardápio fica em ${cardapioUrl}.`;

  if (cfg?.prompt_sistema) {
    return cfg.prompt_sistema.replace('{LINK_CARDAPIO}', cardapioUrl) + diretriz24h + cardapioCtx + exemplosCtx;
  }
  return `Atendente virtual de sushi. Regras: resposta curta (max 2 linhas), máx 1 emoji, português natural. Cardápio/pedido: ${cardapioUrl}. Não invente preços.${diretriz24h}${cardapioCtx}${restConfig}${exemplosCtx}`;
}

async function gerarRespostaIA(conversa, mensagem, cfg) {
  // Histórico reduzido: últimas 6 mensagens (economiza tokens)
  const historico = db.prepare(`
    SELECT corpo, de_mim FROM wa_mensagens
    WHERE conversa_id=? ORDER BY created_at DESC LIMIT 6
  `).all(conversa.id).reverse();

  // Prompt base + contexto do PEDIDO REAL do cliente (status/rastreamento)
  const ctxPedido = contextoPedidoCliente(conversa);
  const systemPrompt = buildSystemPrompt(cfg) + ctxPedido;

  // Monta histórico com alternância garantida
  const rawHistory = historico
    .slice(0, -1)
    .map(m => ({ role: m.de_mim ? 'assistant' : 'user', content: (m.corpo || '').trim() }))
    .filter(m => m.content.length > 0);

  const mergedHistory = [];
  for (const msg of rawHistory) {
    const last = mergedHistory[mergedHistory.length - 1];
    if (last && last.role === msg.role) last.content += '\n' + msg.content;
    else mergedHistory.push({ ...msg });
  }
  while (mergedHistory.length > 0 && mergedHistory[mergedHistory.length - 1].role === 'user') mergedHistory.pop();

  const mensagemAtual = (mensagem || '').trim() || '?';

  // Usa Haiku para respostas automáticas (5x mais barato que Opus)
  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [...mergedHistory, { role: 'user', content: mensagemAtual }],
  });

  const uso = resp.usage;
  const custo = ((uso.input_tokens||0) * 0.000001 + (uso.cache_read_input_tokens||0) * 0.0000001 + (uso.output_tokens||0) * 0.000005);
  console.log(`[IA] tokens: ${uso.input_tokens}in ${uso.cache_read_input_tokens||0}cache ${uso.output_tokens}out | custo: $${custo.toFixed(6)}`);

  return resp.content[0]?.text || null;
}

async function enviarEsalvar(conversa, corpo, isIa = false) {
  // Envia pelo WhatsApp (pula se for conversa de teste)
  if (!conversa.telefone.startsWith('TESTE_')) {
    // Usa chat_id real (resolve LID) ou cai no fallback por número
    await enviarParaChatId(conversa.chat_id || conversa.telefone, corpo);
  }

  // Salva no banco
  const row = db.prepare(`
    INSERT INTO wa_mensagens(conversa_id, de, corpo, de_mim, ia, lida)
    VALUES(?,?,?,1,?,1)
  `).run(conversa.id, 'eu', corpo, isIa ? 1 : 0);

  db.prepare(`UPDATE wa_conversas SET ultima_mensagem=?, ultima_em=datetime('now') WHERE id=?`)
    .run(corpo, conversa.id);

  const mensagem = {
    id: row.lastInsertRowid,
    conversa_id: conversa.id,
    de: 'eu',
    corpo,
    de_mim: 1,
    ia: isIa ? 1 : 0,
    created_at: new Date().toISOString(),
  };

  if (io) io.emit('wa:mensagem', { conversa, mensagem });
}

function dentroDoHorario(horario) {
  if (!horario) return true;
  try {
    const [ini, fim] = horario.split('-').map(h => {
      const [hh, mm] = h.trim().split(':').map(Number);
      return hh * 60 + mm;
    });
    const agora = new Date();
    const min = agora.getHours() * 60 + agora.getMinutes();
    return min >= ini && min <= fim;
  } catch { return true; }
}

module.exports = {
  iniciar,
  enviar,
  enviarEsalvar,
  receberMensagem,
  sseStatus,
  setIo,
  notificarNovoPedido,
  notificarMudancaStatus,
  getStatus: () => ({ status, qr: qrBase64 }),
  // Número conectado via QR (o WhatsApp do restaurante). Ex: '5544999998888'
  getNumero: () => { try { return cliente?.info?.wid?.user || null; } catch { return null; } },
  desconectar: async () => { if (cliente) { await cliente.destroy(); cliente = null; status = 'desconectado'; } },
  resetarSessao: async () => {
    console.log('[WhatsApp] Resetando sessão manualmente...');
    try { if (cliente) { await cliente.destroy(); } } catch {}
    cliente = null;
    reconectando = false;
    status = 'aguardando_qr';
    try {
      const sessionDir = path.join(SESSION_PATH, 'session');
      if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log('[WhatsApp] Sessão apagada. Reiniciando...');
    } catch (e) { console.error('[WhatsApp] Erro ao apagar sessão:', e.message); }
    setTimeout(() => iniciar(), 2000);
  },
};
