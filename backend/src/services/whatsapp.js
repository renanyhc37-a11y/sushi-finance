/**
 * Serviço de WhatsApp — cliente HTTP para o whatsapp-service (porta 8080).
 * Toda a lógica de IA, banco, rate-limiting e notificações permanece aqui;
 * o transporte (envio/recebimento) fica no processo separado em whatsapp-service/.
 */

const db = require('../db/database');
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const http = require('http');

// ── Estado local (atualizado via webhook do whatsapp-service) ─
let _status = 'desconectado';
let _qr = null;
let _numero = null;
const sseClients = new Set();

function atualizarStatus(novoStatus, qr = null) {
  _status = novoStatus;
  _qr = qr || null;
  const msg = `event: status\ndata: ${JSON.stringify({ status: _status, qr: _qr })}\n\n`;
  for (const res of sseClients) { try { res.write(msg); } catch {} }
  if (novoStatus === 'pronto') {
    for (const res of sseClients) {
      try { res.write(`event: pronto\ndata: {}\n\n`); } catch {}
    }
  }
}

// ── Rate limiting por número ──────────────────────────────────
const _rateMap = new Map();
const RATE_LIMIT = 200;
const RATE_WINDOW_MS = 60 * 60 * 1000;

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
setInterval(() => {
  const agora = Date.now();
  for (const [k, v] of _rateMap) if (agora > v.resetAt) _rateMap.delete(k);
}, RATE_WINDOW_MS);

const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ── Mensagens automáticas por status de pedido ────────────────
const MENSAGENS = {
  espera: (p) =>
`🍣 *Pedido #${p.numero} aceito!*

Olá, *${p.cliente_nome}*! 😊

Seu pedido foi aceito e logo entrará em produção.

📦 *Itens:*
${p.itens.map(i => `  • ${i.quantidade}x ${i.item_nome}`).join('\n')}

💰 *Total:* ${brl(p.total)}
${p.tipo_entrega === 'retirada' ? `🏪 *Retirada no balcão*` : `📍 *Entrega:* ${p.cliente_endereco}`}

Qualquer dúvida, é só responder esta mensagem. 🙏`,

  preparando: (p) => p.tipo_entrega === 'retirada'
? `👨‍🍳 *Pedido #${p.numero} em preparo!*

Olá, *${p.cliente_nome}*!

Seu pedido já está sendo preparado com carinho pela nossa equipe. 🍣✨

Em breve estará pronto para retirada!`
: `👨‍🍳 *Pedido #${p.numero} em preparo!*

Olá, *${p.cliente_nome}*!

Seu pedido já está sendo preparado com carinho pela nossa equipe. 🍣✨

Em breve sairá para entrega!`,

  saindo: (p) => p.tipo_entrega === 'retirada'
? `✅ *Pedido #${p.numero} pronto para retirada!*

Olá, *${p.cliente_nome}*!

Seu pedido está pronto! Pode vir buscar quando quiser. 🎉

📍 Nos encontre em: ${p.cliente_endereco || 'Rua Castro 1465 - Jd Ouro Branco'}

Te esperamos! 😊`
: `🛵 *Pedido #${p.numero} saindo para entrega!*

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

  pixPendente: (p, chave) =>
`🍣 *Pedido #${p.numero} recebido!*

Olá, *${p.cliente_nome}*! 😊

Recebemos seu pedido e ele será *aprovado assim que o pagamento via Pix for confirmado*.

📦 *Itens:*
${p.itens.map(i => `  • ${i.quantidade}x ${i.item_nome}`).join('\n')}

💰 *Total:* ${brl(p.total)}

🔑 *Chave Pix:* ${chave}

👇 O código Pix (copia e cola) vem na mensagem a seguir, pra facilitar copiar.

Assim que o pagamento cair, seu pedido entra em produção! 🙏`,

  pixConfirmado: (p) =>
`✅ *Pagamento confirmado!*

Olá, *${p.cliente_nome}*! 😊

Recebemos a confirmação do seu Pix — o pedido #${p.numero} está aprovado e já entra em produção. 🍣

Obrigado pela preferência!`,
};

// ── HTTP para o whatsapp-service ──────────────────────────────
function httpPost(path, body, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: Number(process.env.WA_PORT || 8080),
      path,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { resolve({}); } });
    });
    req.on('error', () => resolve({ ok: false, error: 'whatsapp-service indisponível' }));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    req.write(data);
    req.end();
  });
}

// typingMs > 0 → o serviço mostra "digitando…" por esse tempo antes de enviar,
// simulando um atendente humano. O timeout do POST acompanha essa espera.
async function enviar(telefone, mensagem, typingMs = 0) {
  const r = await httpPost('/send', { to: telefone, text: mensagem, typingMs }, 8000 + typingMs);
  if (r.ok) console.log(`[WhatsApp] ✅ Enviado para ${telefone}`);
  else console.warn(`[WhatsApp] ❌ Falha ao enviar para ${telefone}:`, r.error || r.status);
  return r.ok === true;
}

// ── SSE de status para o frontend ────────────────────────────
function sseStatus(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  res.write(`event: status\ndata: ${JSON.stringify({ status: _status, qr: _qr })}\n\n`);
  const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 20000);
  sseClients.add(res);
  req.on('close', () => { sseClients.delete(res); clearInterval(hb); });
}

// ── Contexto do pedido para a IA ─────────────────────────────
function contextoPedidoCliente(conversa) {
  try {
    const tel = (conversa?.telefone_real || conversa?.telefone || '').replace(/\D/g, '');
    const nome = (conversa?.nome || '').trim();
    let pedidos = [];
    if (tel.length >= 8) {
      pedidos = db.prepare(
        `SELECT * FROM pdv_pedidos WHERE cliente_telefone LIKE ? ORDER BY id DESC LIMIT 6`
      ).all('%' + tel.slice(-8));
    }
    const primeiroNome = nome.split(/\s+/)[0] || '';
    if (pedidos.length === 0 && primeiroNome.length >= 3) {
      pedidos = db.prepare(`
        SELECT * FROM pdv_pedidos
        WHERE LOWER(cliente_nome) LIKE LOWER(?) || '%'
          AND date(created_at) >= date('now','-2 days')
        ORDER BY id DESC LIMIT 6
      `).all(primeiroNome);
    }
    if (pedidos.length === 0) return '';

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
      ? 'Use estes dados REAIS para responder sobre QUALQUER um desses pedidos. Tempo médio após sair para entrega: 15-30 min. NUNCA diga que não tem acesso ou que o pedido não está registrado.'
      : 'O cliente não tem pedidos em andamento agora; o pedido acima já foi finalizado.';

    return `\n\nPEDIDOS DESTE CLIENTE (você TEM acesso total a isto):\n${corpo}\n${nota}`;
  } catch { return ''; }
}

let io = null;
function setIo(ioInstance) { io = ioInstance; }

const RE_SOLICITACAO = /(wasabi|gengibre|shoyu|tar[eê]|hashi|adicion|acrescent|coloca|incluir|inclua|extra|sem\s+\w+|tira[r]?|troca[r]?|mais\s+\w+)/i;

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
    if ((pedido.observacao || '').includes(marca)) return true;
    const nova = pedido.observacao ? `${pedido.observacao}\n${marca}` : marca;
    db.prepare('UPDATE pdv_pedidos SET observacao=? WHERE id=?').run(nova, pedido.id);
    console.log(`[WhatsApp] Solicitação anexada ao pedido #${pedido.numero}: "${corpo.trim()}"`);
    if (io) io.emit('pedido:atualizado', { id: pedido.id });
    return true;
  } catch (e) { console.error('[WhatsApp] anexarSolicitacao erro:', e.message); return false; }
}

try { db.exec('ALTER TABLE wa_conversas ADD COLUMN telefone_real TEXT'); } catch {}

// Dedup em memória — segunda linha de defesa contra race condition no webhook
const _processados = new Set();

async function receberMensagem({ telefone, telefoneReal, nome, corpo, waId, chatId, fotoUrl, mediaUrl, tipo, mediaBase64, mediaMime, deMim }) {
  // Salva mídia recebida via base64 (enviada pelo whatsapp-service)
  if (mediaBase64 && mediaMime) {
    try {
      const fs = require('fs');
      const path = require('path');
      const ext = mediaMime.split('/')[1]?.split(';')[0] || 'bin';
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const dir = path.join(__dirname, '..', '..', 'uploads', 'wa-media');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), Buffer.from(mediaBase64, 'base64'));
      mediaUrl = `/api/chat/media/${filename}`;
      tipo = mediaMime.startsWith('image/') ? 'imagem'
           : mediaMime.startsWith('video/') ? 'video'
           : mediaMime.startsWith('audio/') ? 'audio'
           : 'arquivo';
    } catch (e) {
      console.error('[WhatsApp] Erro ao salvar mídia:', e.message);
    }
  }
  tipo = tipo || 'texto';
  // Dedup — in-memory (race-condition safe) + banco (persistente)
  if (waId) {
    if (_processados.has(waId)) return;
    _processados.add(waId);
    setTimeout(() => _processados.delete(waId), 60000);
    const jaExiste = db.prepare('SELECT id FROM wa_mensagens WHERE wa_id=?').get(waId);
    if (jaExiste) return;
  }

  // ── Mensagem ENVIADA manualmente pelo celular (fromMe, não é eco do app) ──
  // Registra como saída e cancela qualquer resposta da IA pendente para esta
  // conversa: se o dono já respondeu na mão, o bot não deve responder por cima.
  if (deMim) {
    const conv = db.prepare('SELECT * FROM wa_conversas WHERE telefone=?').get(telefone);
    if (!conv) return; // sem conversa prévia não há o que espelhar
    clearTimeout(_debounceIA.get(telefone));
    _debounceIA.delete(telefone);

    const row = db.prepare(`
      INSERT INTO wa_mensagens(conversa_id, wa_id, de, corpo, tipo, de_mim, ia, lida, media_url)
      VALUES(?,?,?,?,?,1,0,1,?)
    `).run(conv.id, waId || null, 'eu', corpo, tipo, mediaUrl || null);

    db.prepare(`UPDATE wa_conversas SET ultima_mensagem=?, ultima_em=datetime('now'), nao_lidas=0 WHERE id=?`)
      .run(corpo, conv.id);

    if (io) {
      io.emit('wa:mensagem', { conversa: conv, mensagem: {
        id: row.lastInsertRowid, conversa_id: conv.id, de: 'eu', corpo, tipo,
        media_url: mediaUrl || null, de_mim: 1, ia: 0, created_at: new Date().toISOString(),
      }});
      io.emit('wa:conversas_atualizar');
    }
    return;
  }

  db.prepare(`
    INSERT INTO wa_conversas(telefone, nome, foto_url, ultima_mensagem, ultima_em, nao_lidas, chat_id, telefone_real)
    VALUES(?,?,?,?,datetime('now'),1,?,?)
    ON CONFLICT(telefone) DO UPDATE SET
      nome = COALESCE(excluded.nome, nome),
      foto_url = COALESCE(excluded.foto_url, foto_url),
      ultima_mensagem = excluded.ultima_mensagem,
      ultima_em = excluded.ultima_em,
      nao_lidas = nao_lidas + 1,
      chat_id = COALESCE(excluded.chat_id, chat_id),
      telefone_real = COALESCE(excluded.telefone_real, telefone_real)
  `).run(telefone, nome, fotoUrl || null, corpo, chatId || null, telefoneReal || null);

  const conversa = db.prepare('SELECT * FROM wa_conversas WHERE telefone=?').get(telefone);

  const msgRow = db.prepare(`
    INSERT INTO wa_mensagens(conversa_id, wa_id, de, corpo, tipo, de_mim, lida, media_url)
    VALUES(?,?,?,?,?,0,0,?)
  `).run(conversa.id, waId || null, telefone, corpo, tipo, mediaUrl || null);

  const mensagem = {
    id: msgRow.lastInsertRowid,
    conversa_id: conversa.id,
    de: telefone,
    corpo,
    tipo,
    media_url: mediaUrl || null,
    de_mim: 0,
    ia: 0,
    created_at: new Date().toISOString(),
  };

  if (io) {
    io.emit('wa:mensagem', { conversa, mensagem });
    io.emit('wa:conversas_atualizar');
  }

  if (RE_SOLICITACAO.test(corpo || '')) anexarSolicitacaoAoPedido(telefoneReal || telefone, corpo, nome);

  // ── Assistente do DONO: números autorizados falam com o NinjaContrlol
  // (texto + foto de boleto), NÃO com o bot de atendimento ao cliente. ──
  try {
    const assistenteDono = require('./assistenteDono');
    if (assistenteDono.ehDono(telefoneReal || telefone)) {
      assistenteDono.processarMensagemDono({
        telefone: telefoneReal || telefone, corpo, tipo, mediaBase64, mediaMime, enviar,
      }).catch(e => console.error('[assistenteDono] erro:', e.message));
      return;
    }
  } catch (e) { console.error('[assistenteDono] require:', e.message); }

  const cfg = db.prepare('SELECT * FROM wa_config WHERE id=1').get();
  if (!conversa.ia_ativa || !cfg?.ia_global) return;

  agendarRespostaIA(telefone);
}

// ── Debounce da IA ────────────────────────────────────────────
const _debounceIA = new Map();
// Pausa maior: dá tempo do cliente terminar de escrever antes de a IA responder
// (evita "responder por cima" e deixa a conversa mais humana).
const DEBOUNCE_MS = 10000;

function agendarRespostaIA(telefone) {
  clearTimeout(_debounceIA.get(telefone));
  _debounceIA.set(telefone, setTimeout(() => {
    _debounceIA.delete(telefone);
    responderComIA(telefone).catch(err => console.error('[WhatsApp IA] Erro:', err.message));
  }, DEBOUNCE_MS));
}

async function responderComIA(telefone) {
  const conversa = db.prepare('SELECT * FROM wa_conversas WHERE telefone=?').get(telefone);
  if (!conversa || !conversa.ia_ativa) return;
  const cfg = db.prepare('SELECT * FROM wa_config WHERE id=1').get();
  if (!cfg?.ia_global) return;
  if (!checkRateLimit(telefone)) return;

  const ultimoBot = db.prepare(
    'SELECT MAX(id) m FROM wa_mensagens WHERE conversa_id=? AND de_mim=1'
  ).get(conversa.id)?.m || 0;
  const pendentes = db.prepare(
    'SELECT corpo FROM wa_mensagens WHERE conversa_id=? AND de_mim=0 AND id>? ORDER BY id'
  ).all(conversa.id, ultimoBot).map(r => (r.corpo || '').trim()).filter(Boolean);
  const mensagemAtual = pendentes.join('\n') || conversa.ultima_mensagem || '?';

  try {
    const resposta = await gerarRespostaIA(conversa, mensagemAtual, cfg);
    if (resposta) {
      // Delay humano de "digitando": leitura + digitação proporcional ao tamanho
      // (1,8s de base + ~35ms/caractere, no máximo 6s) — deixa menos robótico.
      const typingMs = Math.min(1800 + resposta.length * 35, 6000);
      await enviarEsalvar(conversa, resposta, true, typingMs);
    }
  } catch (err) {
    console.error('[WhatsApp IA] Erro ao gerar resposta:', err.message);
  }
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

function buildSystemPrompt(cfg) {
  let cardapioCtx = '';
  try {
    const itens = db.prepare('SELECT nome, preco FROM cardapio_itens WHERE disponivel=1 ORDER BY ordem LIMIT 200').all();
    if (itens.length) cardapioCtx = `\nCardápio (use estes preços, não invente): ${itens.map(i => `${i.nome} R$${Number(i.preco).toFixed(2)}`).join(' | ')}`;
  } catch {}

  let restConfig = '';
  try {
    const c = db.prepare('SELECT * FROM config WHERE id=1').get();
    if (c?.nome_restaurante) restConfig = `\nRestaurante: ${c.nome_restaurante}.${c.endereco ? ' Endereço: ' + c.endereco + '.' : ''}`;
  } catch {}

  let exemplosCtx = '';
  try {
    const exemplos = db.prepare('SELECT pergunta, resposta FROM wa_exemplos WHERE ativo=1 LIMIT 15').all();
    if (exemplos.length) exemplosCtx = '\n\nExemplos (siga este tom e estilo):\n' + exemplos.map(e => `P: ${e.pergunta}\nR: ${e.resposta}`).join('\n');
  } catch {}

  const appUrl = process.env.APP_URL || 'http://localhost:3001';
  const cardapioUrl = `${appUrl}/cardapio`;

  const horaBR = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', hour: '2-digit', minute: '2-digit' });
  const fmtH = s => (s || '').trim().replace(':00', 'h').replace(':', 'h');
  const [abreStr, fechaStr] = (cfg?.horario_atendimento || '18:00-23:00').split('-');
  const horarioLoja = `${fmtH(abreStr)} às ${fmtH(fechaStr)}`;
  const lojaAberta = dentroDoHorario(cfg?.horario_atendimento);
  const diretriz24h = `\n\nATENDIMENTO (regra absoluta): agora é ${horaBR}. Você (atendente virtual) responde e ajuda o cliente a QUALQUER hora — NUNCA recuse a conversar, NUNCA diga "estamos fora do horário de atendimento". MAS os PEDIDOS só são aceitos no horário da loja: ${horarioLoja}. ${lojaAberta ? 'A loja está ABERTA agora.' : `A loja está FECHADA agora (abre às ${fmtH(abreStr)}).`} NUNCA diga que "funcionamos 24 horas" — apenas o atendimento por mensagem é 24h. O cardápio fica em ${cardapioUrl}.

PEDIDO PELA CONVERSA (você PODE fechar o pedido aqui mesmo): quando o cliente disser o que quer, confirme os itens e quantidades, pergunte a forma de pagamento e o endereço (ou se é retirada). ENDEREÇO — regra que não pode falhar: o endereço de entrega SEMPRE precisa do NÚMERO da casa. Se o cliente mandar só a rua ("Rua das Flores", "moro na Vila X"), pergunte o número antes de seguir ("Só me confirma o número da casa? 😊"). Nunca feche o pedido de entrega sem o número — sem ele o entregador não acha o endereço. Com tudo confirmado, use a ferramenta criar_pedido para lançar o pedido REAL no sistema — ele aparece na cozinha e no cadastro do cliente automaticamente. Use os NOMES EXATOS do cardápio. Depois de criar, confirme ao cliente o NÚMERO e o TOTAL que a ferramenta retornar. Se a ferramenta retornar erro, explique gentilmente e ajuste. NÃO invente número de pedido — só informe o que a ferramenta devolver. Se a loja estiver fechada, não crie o pedido.`;

  // Personalidade + estilo — vale para QUALQUER prompt (customizado ou padrão).
  const diretrizEstilo = `

PERSONALIDADE (como você É): você é o atendente virtual da loja, mas soa como uma PESSOA de verdade que trabalha no sushi e gosta do que faz — caloroso, atencioso, tratando cada cliente como um vizinho querido, nunca como um número de pedido. Você se importa genuinamente com a experiência da pessoa, não só em fechar o pedido rápido. Fala natural, com leveza, como alguém conversando no WhatsApp — sem soar robótico nem formal demais.

COMO SE COMPORTAR:
- Acolha antes de despachar: comece com um cumprimento genuíno ("Oi! Tudo bem por aí? 😊") antes de ir pro cardápio. Nunca abra só com menu numerado nem vá direto ao "digite 1".
- UMA coisa de cada vez: no máximo UMA pergunta por mensagem, e espere a resposta antes de seguir. Não despeje o cardápio inteiro nem várias perguntas juntas. Sem pressa — se o cliente demora, tranquilize ("Sem pressa pra escolher, fico por aqui 🍣"), nunca cobre ("ainda está aí?").
- Confirme com carinho, não só com dados: ao repetir o pedido, comente algo ("Boa escolha, esse é um dos queridinhos da casa!") antes de pedir a confirmação.
- Antes de assumir qualquer coisa (item, quantidade, endereço, pagamento), CONFIRME — priorize precisão sobre rapidez; na dúvida, pergunte em vez de adivinhar.
- Em reclamação: PRIMEIRO acolha o sentimento ("Poxa, sinto muito mesmo que isso aconteceu, não era pra ser assim"), DEPOIS resolva. Nunca responda frio.
- Feche com gentileza, como um "até logo", nunca com corte seco: em vez de "Pedido confirmado.", algo como "Prontinho, já mandei pra cozinha! Espero que aproveite bastante 🍣 Qualquer coisa é só chamar!".

EXPRESSÕES que aproximam (use com naturalidade, VARIANDO — não repita sempre a mesma): "Tudo bem por aí?", "Bateu aquela fome?", "Fico feliz em ajudar", "Sem pressa", "Conta comigo", "Já já chega até você", "Qualquer coisa é só chamar". Emojis com moderação (😊 🍣 🙏): no máximo 1 por mensagem, 2 só num momento especial.

EVITE: menu numerado sem uma frase de acolhimento antes; termos frios ("protocolo", "solicitação", "encerrado"); respostas cortadas tipo "Ok." ou "Confirmado."; deixar reclamação sem validar o sentimento do cliente; repetir sempre a mesma saudação robótica. Nunca mande várias mensagens seguidas por cima do cliente — responda de uma vez, seja claro (2 a 4 frases), e dê espaço para ele responder.`;

  if (cfg?.prompt_sistema) {
    return cfg.prompt_sistema.replace('{LINK_CARDAPIO}', cardapioUrl) + diretrizEstilo + diretriz24h + cardapioCtx + exemplosCtx;
  }
  return `Você é o atendente virtual da loja. Ajude o cliente a tirar dúvidas e a fazer o pedido pelo cardápio: ${cardapioUrl}. Nunca invente preços nem itens.${diretrizEstilo}${diretriz24h}${cardapioCtx}${restConfig}${exemplosCtx}`;
}

// ── Tool: a IA cria o pedido REAL no sistema ──────────────────
const CRIAR_PEDIDO_TOOL = {
  name: 'criar_pedido',
  description: 'Cria o pedido REAL no sistema da loja (aparece no PDV e no cadastro do cliente). Use SOMENTE depois que o cliente confirmar claramente o que quer pedir E você tiver o endereço de entrega (ou for retirada). Nunca invente itens — use apenas os nomes exatos do cardápio.',
  input_schema: {
    type: 'object',
    properties: {
      itens: {
        type: 'array',
        description: 'Itens do pedido',
        items: {
          type: 'object',
          properties: {
            nome: { type: 'string', description: 'Nome exato do item no cardápio' },
            quantidade: { type: 'integer', description: 'Quantidade (mínimo 1)' },
            observacao: { type: 'string', description: 'Observação do item, ex.: sem cebola' },
          },
          required: ['nome', 'quantidade'],
        },
      },
      forma_pagamento: { type: 'string', enum: ['pix', 'dinheiro', 'cartao_cred', 'cartao_deb'], description: 'Forma de pagamento confirmada pelo cliente' },
      tipo_entrega: { type: 'string', enum: ['entrega', 'retirada'], description: 'entrega ou retirada no balcão' },
      endereco: { type: 'string', description: 'Endereço de entrega COMPLETO, SEMPRE com o número da casa (ex.: "Rua das Flores, 123 - ao lado da padaria"). Vazio só se for retirada. Nunca envie um endereço sem número — se o cliente não informou o número, pergunte antes.' },
      observacao: { type: 'string', description: 'Observação geral do pedido' },
    },
    required: ['itens'],
  },
};

// POST interno para o próprio backend (reusa toda a lógica de /cardapio/pedido)
function postInterno(path, body) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost', port: Number(process.env.PORT || 3001), path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let raw = ''; res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, body: {} }); } });
    });
    req.on('error', e => resolve({ status: 0, body: { erro: e.message } }));
    req.setTimeout(9000, () => { req.destroy(); resolve({ status: 0, body: { erro: 'timeout' } }); });
    req.write(data); req.end();
  });
}

// Detecta se o endereço tem número da casa (obrigatório para entrega).
// Rejeita "s/n", "sem número" e endereços sem nenhum dígito.
function temNumeroCasa(endereco) {
  const e = (endereco || '').toLowerCase();
  if (/\bs\/?n[°º]?\b|\bsem\s*n[uú]mero\b|\bsn\b/.test(e)) return false;
  return /\d/.test(e);
}

async function executarCriarPedido(conversa, input) {
  try {
    const tel = (conversa?.telefone_real || conversa?.telefone || '').replace(/\D/g, '');
    const nome = (conversa?.nome || '').trim() || 'Cliente WhatsApp';
    if (!Array.isArray(input?.itens) || input.itens.length === 0) return { ok: false, erro: 'Nenhum item informado' };

    // Resolve cada item pelo nome → item_id (preço vem do banco na rota)
    const itens = [];
    const naoEncontrados = [];
    for (const it of input.itens) {
      const q = Math.max(1, Math.floor(Number(it.quantidade) || 1));
      let ref = db.prepare('SELECT id, nome FROM cardapio_itens WHERE nome = ? COLLATE NOCASE AND disponivel = 1').get(it.nome);
      if (!ref) ref = db.prepare("SELECT id, nome FROM cardapio_itens WHERE nome LIKE '%' || ? || '%' AND disponivel = 1 ORDER BY length(nome) LIMIT 1").get(it.nome);
      if (!ref) { naoEncontrados.push(it.nome); continue; }
      itens.push({ item_id: ref.id, quantidade: q, observacao: it.observacao || null });
    }
    if (naoEncontrados.length) return { ok: false, erro: `Itens não encontrados no cardápio: ${naoEncontrados.join(', ')}. Confirme o nome com o cliente.` };

    // Endereço: usa o informado ou o salvo no cadastro
    const ehRetirada = input.tipo_entrega === 'retirada';
    let endereco = (input.endereco || '').trim();
    if (!ehRetirada && !endereco && tel) {
      endereco = db.prepare('SELECT endereco FROM clientes WHERE telefone = ?').get(tel)?.endereco || '';
    }
    if (!ehRetirada && !endereco) return { ok: false, erro: 'Falta o endereço de entrega. Peça o endereço ao cliente antes de criar o pedido.' };
    // Número da casa é OBRIGATÓRIO — sem ele o entregador não acha o endereço
    if (!ehRetirada && !temNumeroCasa(endereco)) {
      return { ok: false, erro: `O endereço "${endereco}" está SEM o número da casa. NÃO crie o pedido ainda. Pergunte de forma gentil e direta o número da residência (ex.: "Só me confirma o número da casa? 😊") e só então lance o pedido com a rua + número juntos. O número é obrigatório para a entrega chegar certinho.` };
    }

    const r = await postInterno('/api/cardapio/pedido', {
      cliente_nome: nome,
      cliente_telefone: tel,
      cliente_endereco: endereco,
      forma_pagamento: input.forma_pagamento || null,
      observacao: input.observacao || null,
      tipo_entrega: ehRetirada ? 'retirada' : 'entrega',
      itens,
    });

    if (r.status === 201 && r.body?.numero) {
      console.log(`[WhatsApp IA] ✅ Pedido #${r.body.numero} criado pela IA (${tel})`);
      return { ok: true, numero: r.body.numero, total: r.body.total };
    }
    if (r.status === 409) return { ok: false, erro: 'A loja está fechada agora — não é possível criar o pedido. Avise o cliente do horário.' };
    return { ok: false, erro: r.body?.erro || 'Não foi possível criar o pedido' };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

async function gerarRespostaIA(conversa, mensagem, cfg) {
  const historico = db.prepare(`
    SELECT corpo, de_mim FROM wa_mensagens
    WHERE conversa_id=? ORDER BY created_at DESC LIMIT 6
  `).all(conversa.id).reverse();

  const ctxPedido = contextoPedidoCliente(conversa);
  const systemPrompt = buildSystemPrompt(cfg) + ctxPedido;

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

  const messages = [...mergedHistory, { role: 'user', content: (mensagem || '').trim() || '?' }];
  const baseReq = {
    model: 'claude-sonnet-5',
    max_tokens: 600,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    tools: [CRIAR_PEDIDO_TOOL],
  };

  let resp = await anthropic.messages.create({ ...baseReq, messages });

  // Loop de tool use: a IA pode chamar criar_pedido. Limita a 2 iterações.
  let guard = 0;
  while (resp.stop_reason === 'tool_use' && guard++ < 2) {
    const toolUse = resp.content.find(c => c.type === 'tool_use');
    if (!toolUse) break;
    const resultado = await executarCriarPedido(conversa, toolUse.input || {});
    messages.push({ role: 'assistant', content: resp.content });
    messages.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(resultado) }] });
    resp = await anthropic.messages.create({ ...baseReq, messages });
  }

  const uso = resp.usage;
  const custo = ((uso.input_tokens || 0) * 0.000001 + (uso.cache_read_input_tokens || 0) * 0.0000001 + (uso.output_tokens || 0) * 0.000005);
  console.log(`[IA] tokens: ${uso.input_tokens}in ${uso.cache_read_input_tokens || 0}cache ${uso.output_tokens}out | custo: $${custo.toFixed(6)}`);

  const textOut = resp.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
  return textOut || null;
}

async function enviarEsalvar(conversa, corpo, isIa = false, typingMs = 0) {
  if (!conversa.telefone.startsWith('TESTE_')) {
    await enviar(conversa.chat_id || conversa.telefone, corpo, typingMs);
  }

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

async function notificarMudancaStatus(pedido, novoStatus) {
  console.log(`[WhatsApp] notificarMudancaStatus — pedido #${pedido.numero} → ${novoStatus} | telefone: ${pedido.cliente_telefone || 'NENHUM'}`);
  if (!pedido.cliente_telefone) return;
  // Pix: o resumo do pedido já foi enviado em notificarPix() na criação —
  // a mensagem de aceite ficaria redundante (mesmos itens/total de novo).
  if (pedido.forma_pagamento === 'pix' && (novoStatus === 'espera' || novoStatus === 'preparando')) return;
  // Fluxo novo: Aceitar leva direto para 'preparando'. Nesse aceite o cliente
  // recebe "foi aceito e logo entrará em produção" (MENSAGENS.espera), NÃO a de
  // "já está sendo preparado". 'pronto' = saiu para entrega.
  const mapa = {
    espera:     MENSAGENS.espera,   // legado
    preparando: MENSAGENS.espera,   // aceite → "aceito, logo entra em produção"
    pronto:     MENSAGENS.saindo,   // saiu para entrega
    entregue:   MENSAGENS.entregue,
    cancelado:  MENSAGENS.cancelado,
  };
  const fn = mapa[novoStatus];
  if (!fn) return;
  try { await enviar(pedido.cliente_telefone, fn(pedido)); } catch (err) {
    console.error('[WhatsApp] Erro em notificarMudancaStatus:', err.message);
  }
}

// Busca o status/QR AO VIVO no whatsapp-service (porta 8080) e sincroniza o
// cache local. Garante que a tela sempre receba o QR atual, mesmo se um webhook
// se perdeu ou o backend reiniciou.
function _getStatusServico() {
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port: Number(process.env.WA_PORT || 8080), path: '/status', method: 'GET' }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(4000, () => { req.destroy(); resolve(null); });
    req.end();
  });
}

async function getStatusLive() {
  const live = await _getStatusServico();
  if (live) {
    if (live.status) _status = live.status;
    _qr = live.qr || null;
    if (live.numero) _numero = String(live.numero).replace(/\D/g, '');
  }
  return { status: _status, qr: _qr };
}

async function notificarCashback(pedido, valorGanho, saldoTotal) {
  if (_status !== 'pronto') return;
  const tel = (pedido.cliente_telefone || '').replace(/\D/g, '');
  if (!tel || tel.startsWith('TESTE')) return;
  const conv = db.prepare('SELECT * FROM wa_conversas WHERE telefone=?').get(tel);
  if (!conv) return;
  const msg = `✅ *Cashback creditado!*\n\nVocê ganhou *R$ ${Number(valorGanho).toFixed(2)}* de volta no seu pedido! 🎉\n\n💰 Seu saldo atual: *R$ ${Number(saldoTotal).toFixed(2)}*\n\nUse no próximo pedido e economize! 😊`;
  await enviarEsalvar(conv, msg, false);
}

async function notificarPix(pedido, codigoPix, chave) {
  if (!pedido.cliente_telefone) return;
  try {
    await enviar(pedido.cliente_telefone, MENSAGENS.pixPendente(pedido, chave));
    // Código copia-e-cola sozinho na própria mensagem: assim "copiar" no
    // WhatsApp pega só o código, sem o texto do resumo do pedido junto.
    await enviar(pedido.cliente_telefone, codigoPix);
  } catch (err) {
    console.error('[WhatsApp] Erro em notificarPix:', err.message);
  }
}

async function notificarPixConfirmado(pedido) {
  if (!pedido.cliente_telefone) return;
  try {
    await enviar(pedido.cliente_telefone, MENSAGENS.pixConfirmado(pedido));
  } catch (err) {
    console.error('[WhatsApp] Erro em notificarPixConfirmado:', err.message);
  }
}

module.exports = {
  iniciar: () => {
    console.log('[WhatsApp] Serviço externo na porta 8080 — inicie via watchdog.bat');
    // Sincroniza status com o whatsapp-service na inicialização
    setTimeout(() => {
      httpPost('/status_noop', {}).catch(() => {});
      const req = require('http').request({ hostname: 'localhost', port: Number(process.env.WA_PORT || 8080), path: '/status', method: 'GET' }, (res) => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { try { const j = JSON.parse(d); atualizarStatus(j.status, j.qr); if (j.numero) { _numero = String(j.numero).replace(/\D/g, ''); console.log('[WhatsApp] Numero sincronizado:', _numero); } console.log('[WhatsApp] Status sincronizado:', j.status); } catch {} });
      });
      req.on('error', () => {});
      req.end();
    }, 2000);
  },
  enviar,
  enviarEsalvar,
  receberMensagem,
  sseStatus,
  atualizarStatus,
  setIo,
  notificarNovoPedido: async () => {},
  notificarMudancaStatus,
  notificarCashback,
  notificarPix,
  notificarPixConfirmado,
  getStatus: () => ({ status: _status, qr: _qr }),
  getStatusLive,
  getNumero: () => _numero,
  setNumero: (n) => { _numero = n ? String(n).replace(/\D/g, '') : null; },
  desconectar: async () => { await httpPost('/desconectar', {}); },
  resetarSessao: async () => { await httpPost('/resetar', {}); },
};
