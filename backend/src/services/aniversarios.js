// Cupom automático de aniversário: verifica diariamente os clientes que fazem
// aniversário hoje e envia uma mensagem no WhatsApp com o cupom configurado.
// Roda a cada 30 min (caso o WhatsApp conecte mais tarde no dia); cada cliente
// só recebe uma vez por ano (controle por aniversario_enviado_ano).

const db = require('./../db/database');
const wa = require('./whatsapp');

const getCfg = chave => db.prepare('SELECT valor FROM config WHERE chave = ?').get(chave)?.valor;

async function verificarAniversarios() {
  // Só envia se o WhatsApp estiver pronto
  if (wa.getStatus().status !== 'pronto') return;

  const agora = new Date();
  const mm = String(agora.getMonth() + 1).padStart(2, '0');
  const dd = String(agora.getDate()).padStart(2, '0');
  const hojeMMDD = `${mm}-${dd}`;
  const ano = agora.getFullYear();

  const cupom = getCfg('cupom_aniversario');
  const nomeLoja = getCfg('nome_restaurante') || 'SushiContrlol';

  let clientes = [];
  try {
    clientes = db.prepare(`
      SELECT id, nome, telefone FROM clientes
      WHERE aniversario = ? AND telefone IS NOT NULL AND telefone != ''
        AND (aniversario_enviado_ano IS NULL OR aniversario_enviado_ano < ?)
    `).all(hojeMMDD, ano);
  } catch { return; }

  for (const c of clientes) {
    const primeiro = (c.nome || '').split(' ')[0] || '';
    let msg = `🎉 Feliz aniversário, ${primeiro}! 🥳\n\nA equipe do ${nomeLoja} deseja um dia incrível pra você!`;
    if (cupom) msg += `\n\n🎁 Como presente, use o cupom *${cupom}* no seu próximo pedido. Aproveite! 🍣`;
    else msg += `\n\nPasse aqui pra comemorar com a gente! 🍣`;

    const ok = await wa.enviar(c.telefone, msg).catch(() => false);
    if (ok) {
      db.prepare('UPDATE clientes SET aniversario_enviado_ano = ? WHERE id = ?').run(ano, c.id);
      console.log(`[aniversário] Parabéns enviado para ${primeiro} (${c.telefone})`);
    }
  }
}

function iniciarAniversarios() {
  // primeira verificação 1 min após subir, depois a cada 30 min
  setTimeout(verificarAniversarios, 60 * 1000);
  const t = setInterval(verificarAniversarios, 30 * 60 * 1000);
  t.unref?.();
  console.log('[aniversário] Verificação automática de aniversários ativada.');
}

module.exports = { iniciarAniversarios, verificarAniversarios };
