// ═══════════════════════════════════════════════════════════════
// Assistente do DONO via WhatsApp
// Números autorizados (config whatsapp_admin) falam com o agente
// NinjaContrlol por texto e podem cadastrar boleto por foto (Claude Vision),
// com confirmação explícita antes de gravar. Separado do bot de cliente.
// ═══════════════════════════════════════════════════════════════
const db = require('../db/database');
const Anthropic = require('@anthropic-ai/sdk');
const ia = require('../routes/ia'); // expõe executarAgente

// ── Tabela de auditoria ──────────────────────────────────────
try {
  db.exec(`CREATE TABLE IF NOT EXISTS whatsapp_acoes_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telefone TEXT, tipo TEXT, entrada TEXT, acao TEXT, resultado TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`);
} catch (e) { console.error('[assistenteDono] migration:', e.message); }

// Itens de uma despesa cadastrada por foto de comprovante (produtos comprados)
try {
  db.exec(`CREATE TABLE IF NOT EXISTS despesa_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    despesa_id INTEGER NOT NULL,
    descricao TEXT,
    quantidade REAL DEFAULT 1,
    valor_total REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  )`);
} catch (e) { console.error('[assistenteDono] despesa_itens migration:', e.message); }

function logar(telefone, tipo, entrada, acao, resultado) {
  try {
    db.prepare('INSERT INTO whatsapp_acoes_log (telefone,tipo,entrada,acao,resultado) VALUES (?,?,?,?,?)')
      .run(telefone, tipo, String(entrada || '').slice(0, 500), acao || '', String(resultado || '').slice(0, 500));
  } catch {}
}

// ── Autorização por número (reusa config whatsapp_admin) ─────
// Normaliza para DDD + 8 dígitos (ignora DDI 55 e o 9º dígito) para casar
// com/sem 9º dígito — mesma ambiguidade tratada no gateway.
function chaveNum(s) {
  let d = String(s || '').replace(/\D/g, '');
  if (d.startsWith('55')) d = d.slice(2);
  if (d.length === 11) d = d.slice(0, 2) + d.slice(3); // remove 9º dígito
  return d;
}
function numerosAutorizados() {
  const raw = db.prepare('SELECT valor FROM config WHERE chave=?').get('whatsapp_admin')?.valor || '';
  return raw.split(',').map(chaveNum).filter(Boolean);
}
function ehDono(telefone) {
  const alvo = chaveNum(telefone);
  return !!alvo && numerosAutorizados().includes(alvo);
}

// ── Confirmações pendentes de boleto (memória, TTL 10 min) ───
const pendentes = new Map();
function setPendente(num, kind, dados) { pendentes.set(num, { kind, dados, exp: Date.now() + 600000 }); }
function getPendente(num) {
  const p = pendentes.get(num); if (!p) return null;
  if (Date.now() > p.exp) { pendentes.delete(num); return null; }
  return { kind: p.kind, dados: p.dados };
}

const SIM = /^(sim|confirma|confirmar|isso|pode|ok|blz|beleza|correto|👍|👌|✅)/i;
const NAO = /^(n[aã]o|cancela|cancelar|errado|❌)/i;

// ── Fluxo principal ──────────────────────────────────────────
async function processarMensagemDono({ telefone, corpo, tipo, mediaBase64, mediaMime, enviar }) {
  const num = chaveNum(telefone);
  const texto = (corpo || '').trim();

  // 1) Confirmação pendente (boleto OU despesa por foto)
  const pend = getPendente(num);
  if (pend && tipo !== 'imagem') {
    if (SIM.test(texto)) {
      pendentes.delete(num);
      const d = pend.dados;
      if (pend.kind === 'boleto') {
        const ok = gravarBoleto(d);
        await enviar(telefone, ok
          ? `✅ Boleto registrado: ${d.fornecedor || 'fornecedor'} — R$ ${d.valor} vence ${d.vencimento || 'a definir'}.`
          : 'Tive um problema ao gravar o boleto. Tente de novo.');
        logar(telefone, 'boleto_confirmado', JSON.stringify(d), 'registrar_boleto', ok ? 'ok' : 'erro');
      } else {
        const res = gravarDespesa(d);
        await enviar(telefone, res.ok
          ? `✅ Despesa registrada: ${d.estabelecimento || 'compra'} — *R$ ${d.valor}* (${d.categoria || 'Mercado'})${res.itens ? `\n📦 ${res.itens} itens guardados.` : ''}`
          : 'Tive um problema ao gravar a despesa. Tente de novo.');
        logar(telefone, 'despesa_confirmada', JSON.stringify(d), 'registrar_despesa', res.ok ? 'ok' : 'erro');
      }
      return;
    }
    if (NAO.test(texto)) {
      pendentes.delete(num);
      await enviar(telefone, 'Ok, cancelei. 👍');
      logar(telefone, 'cancelado', JSON.stringify(pend.dados), 'cancelado', 'ok');
      return;
    }
    // não é sim/não → segue pro fluxo normal de texto abaixo
  }

  // 2) Imagem → boleto OU comprovante de compra (Claude Vision)
  if (tipo === 'imagem' && mediaBase64 && mediaMime) {
    const dados = await analisarImagem(mediaBase64, mediaMime);
    if (!dados || !dados.tipo || dados.tipo === 'desconhecido' || !dados.valor) {
      await enviar(telefone, 'Não consegui ler essa foto 😕. Manda uma imagem mais nítida do boleto ou do comprovante?');
      logar(telefone, 'imagem_ocr', mediaMime, 'falha_leitura', JSON.stringify(dados || {}));
      return;
    }
    if (dados.tipo === 'boleto') {
      setPendente(num, 'boleto', dados);
      await enviar(telefone,
        `📄 *Boleto detectado:*\n\n• Fornecedor: ${dados.fornecedor || '—'}\n• Valor: *R$ ${dados.valor}*\n• Vencimento: ${dados.vencimento || '—'}\n\nConfere? Responda *sim* pra registrar ou *não* pra cancelar.`);
      logar(telefone, 'boleto_ocr', mediaMime, 'aguardando_confirmacao', JSON.stringify(dados));
    } else {
      setPendente(num, 'despesa', dados);
      const itens = Array.isArray(dados.itens) ? dados.itens : [];
      const itensTxt = itens.slice(0, 15).map(i => `  • ${i.descricao} — R$ ${i.valor}`).join('\n');
      await enviar(telefone,
        `🧾 *Comprovante detectado:*\n\n• Local: ${dados.estabelecimento || '—'}\n• Total: *R$ ${dados.valor}*\n• Categoria: ${dados.categoria || 'Mercado'}` +
        (itens.length ? `\n\n📦 ${itens.length} itens:\n${itensTxt}${itens.length > 15 ? '\n  …' : ''}` : '') +
        `\n\nRegistro como despesa? Responda *sim* pra gravar ou *não* pra cancelar.`);
      logar(telefone, 'despesa_ocr', mediaMime, 'aguardando_confirmacao', JSON.stringify({ ...dados, itens: itens.length }));
    }
    return;
  }

  // 3) Texto → agente NinjaContrlol (executa comando e responde)
  if (texto) {
    let r;
    try { r = await ia.executarAgente({ comando: texto }); }
    catch (e) { console.error('[assistenteDono] agente:', e.message); }
    const resposta = r?.resposta_voz || 'Não entendi. Pode repetir?';
    await enviar(telefone, resposta);
    logar(telefone, 'texto', texto, r?.acao || 'nenhuma', resposta);
    return;
  }

  // 4) Áudio (fase futura)
  if (tipo === 'audio') {
    await enviar(telefone, '🎙️ Comandos por áudio ainda não estão ativos. Por enquanto, me mande por texto ou foto de boleto.');
  }
}

// Grava o boleto direto (mesmo schema da ação registrar_boleto do agente).
function gravarBoleto(d) {
  try {
    let venc = d.vencimento;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(venc || ''))) {
      const dt = new Date(Date.now() - 3 * 3600000); dt.setDate(dt.getDate() + 7);
      venc = dt.toISOString().slice(0, 10);
    }
    const valor = Number(String(d.valor).replace(',', '.')) || 0;
    // O valor vai no valor_total do boleto (é o que a tela mostra) E também como item.
    const r = db.prepare(`INSERT INTO boletos (fornecedor, descricao, valor_total, data_chegada, data_vencimento) VALUES (?,?,?,date('now','-3 hours'),?)`)
      .run(d.fornecedor || 'Boleto (foto WhatsApp)', 'Cadastrado por foto via WhatsApp', valor, venc);
    if (valor > 0 && r.lastInsertRowid) {
      db.prepare(`INSERT INTO boleto_itens (boleto_id, descricao, quantidade, unidade, valor_unitario) VALUES (?,?,1,'unidade',?)`)
        .run(r.lastInsertRowid, d.fornecedor || 'Boleto', valor);
    }
    return true;
  } catch (e) { console.error('[assistenteDono] gravarBoleto:', e.message); return false; }
}

// Grava a despesa de um comprovante de compra + itens (produtos comprados).
function gravarDespesa(d) {
  try {
    const valor = Number(String(d.valor).replace(',', '.'));
    if (!(valor > 0)) return { ok: false };
    let data = d.data;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) {
      data = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
    }
    const tipo = d.categoria || 'Mercado';
    const desc = `${d.estabelecimento || 'Compra'} (foto WhatsApp)`;
    const r = db.prepare(`INSERT INTO despesas (descricao, categoria, tipo, valor, data_competencia, recorrente) VALUES (?, 'variavel', ?, ?, ?, 0)`)
      .run(desc, tipo, valor, data);
    const despesaId = r.lastInsertRowid;

    let nItens = 0;
    if (Array.isArray(d.itens) && despesaId) {
      const ins = db.prepare(`INSERT INTO despesa_itens (despesa_id, descricao, quantidade, valor_total) VALUES (?,?,?,?)`);
      for (const it of d.itens) {
        if (!it || !it.descricao) continue;
        const v = Number(String(it.valor).replace(',', '.')) || 0;
        const q = Number(it.quantidade) || 1;
        ins.run(despesaId, String(it.descricao).slice(0, 120), q, v);
        nItens++;
      }
    }
    // Aplica automaticamente os vínculos já aprendidos (item → ingrediente),
    // atualizando o custo dos ingredientes conhecidos. Os desconhecidos ficam
    // pendentes de revisão em Ingredientes.
    try { require('../routes/despesas').aplicarMapeamentosAuto(despesaId); } catch (e) { console.error('[assistenteDono] auto-vínculo:', e.message); }

    return { ok: true, itens: nItens };
  } catch (e) { console.error('[assistenteDono] gravarDespesa:', e.message); return { ok: false }; }
}

// Analisa a foto com Claude Vision: classifica boleto x comprovante e extrai os dados.
async function analisarImagem(base64, mime) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const client = new Anthropic({ apiKey });
    const media_type = String(mime).split(';')[0] || 'image/jpeg';
    const msg = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type, data: base64 } },
          { type: 'text', text: `Analise esta foto. Pode ser um BOLETO bancário OU um COMPROVANTE de compra (cupom fiscal, nota, recibo de mercado/atacado/fornecedor/farmácia/posto). Retorne SOMENTE JSON, sem markdown.

Se for BOLETO:
{"tipo":"boleto","fornecedor":"quem recebe (beneficiário)","valor":"total em reais 1234.56 (ponto decimal, SEM R$)","vencimento":"AAAA-MM-DD"}

Se for COMPROVANTE de compra:
{"tipo":"comprovante","estabelecimento":"nome da loja","valor":"total pago 1234.56","data":"AAAA-MM-DD ou null","categoria":"uma de: Supermercado, Fornecedor, Farmácia, Combustível, Outros","itens":[{"descricao":"produto","quantidade":1,"valor":"valor total do item 12.34"}]}

Regras: valores SEMPRE com ponto decimal e sem "R$". Liste os itens que conseguir ler; se não der pra ler os itens, use "itens":[]. Se não for boleto nem comprovante, retorne {"tipo":"desconhecido"}.` },
        ],
      }],
    });
    const t = msg.content[0].text.trim();
    const m = t.match(/\{[\s\S]*\}/);
    return JSON.parse(m ? m[0] : t);
  } catch (e) {
    console.error('[assistenteDono] analisarImagem:', e.message);
    return null;
  }
}

module.exports = { ehDono, processarMensagemDono, analisarImagem, gravarBoleto, gravarDespesa };
