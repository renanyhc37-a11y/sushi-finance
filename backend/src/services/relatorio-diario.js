// Relatório diário automático: enviado às 23h (horário de Brasília) para o
// número do administrador configurado em config.whatsapp_admin.
// Só roda se WhatsApp estiver conectado (status=pronto).

const db = require('../db/database');
const wa = require('./whatsapp');

const getCfg = chave => db.prepare('SELECT valor FROM config WHERE chave=?').get(chave)?.valor;

async function enviarRelatorio() {
  if (wa.getStatus().status !== 'pronto') return;

  const adminTel = getCfg('whatsapp_admin');
  if (!adminTel) return;

  const hoje = (() => {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  })();

  try {
    const fat = db.prepare(`
      SELECT COUNT(*) as pedidos,
             COALESCE(SUM(total),0) as faturamento,
             COALESCE(SUM(CASE WHEN pagamento='pix' THEN total ELSE 0 END),0) as pix,
             COALESCE(SUM(CASE WHEN pagamento='dinheiro' THEN total ELSE 0 END),0) as dinheiro,
             COALESCE(SUM(CASE WHEN pagamento='cartao' THEN total ELSE 0 END),0) as cartao
      FROM pdv_pedidos
      WHERE status='entregue' AND date(created_at,'-3 hours')=?
    `).get(hoje);

    const cancelados = db.prepare(`SELECT COUNT(*) as n FROM pdv_pedidos WHERE status='cancelado' AND date(created_at,'-3 hours')=?`).get(hoje)?.n || 0;
    const ticket = fat.pedidos > 0 ? fat.faturamento / fat.pedidos : 0;
    const nomeLoja = getCfg('nome_restaurante') || 'Delivery';

    const fmt = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const msg = [
      `📊 *Relatório do dia — ${nomeLoja}*`,
      `📅 ${hoje.split('-').reverse().join('/')}`,
      ``,
      `✅ Pedidos entregues: *${fat.pedidos}*`,
      cancelados ? `❌ Cancelados: ${cancelados}` : null,
      `💰 Faturamento: *${fmt(fat.faturamento)}*`,
      `🎟 Ticket médio: ${fmt(ticket)}`,
      ``,
      `💳 Cartão: ${fmt(fat.cartao)}`,
      `📱 PIX: ${fmt(fat.pix)}`,
      `💵 Dinheiro: ${fmt(fat.dinheiro)}`,
    ].filter(l => l !== null).join('\n');

    await wa.enviar(adminTel, msg);
    console.log('[relatorio-diario] ✅ Enviado para', adminTel);
  } catch (e) {
    console.warn('[relatorio-diario] Erro:', e.message);
  }
}

function iniciarRelatorioDiario() {
  // Verifica a cada minuto se é hora de enviar (23:00 BRT)
  let enviouHoje = null;
  setInterval(() => {
    const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const h = agora.getHours();
    const dataHoje = agora.toISOString().slice(0, 10);
    if (h === 23 && enviouHoje !== dataHoje) {
      enviouHoje = dataHoje;
      enviarRelatorio();
    }
  }, 60 * 1000);
  console.log('[relatorio-diario] Agendado para 23h BRT');
}

module.exports = { iniciarRelatorioDiario };
