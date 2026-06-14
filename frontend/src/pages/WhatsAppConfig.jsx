import React, { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { getToken } from '../hooks/useAuth';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

const STATUS_INFO = {
  desconectado:  { cor: '#6b7280', bg: 'rgba(107,114,128,0.1)',  borda: 'rgba(107,114,128,0.2)', label: 'Desconectado',      emoji: '⚫' },
  aguardando_qr: { cor: 'var(--accent-2)', bg: 'rgba(245,158,11,0.1)',  borda: 'rgba(245,158,11,0.25)', label: 'Aguardando QR Code', emoji: '🟡' },
  conectando:    { cor: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   borda: 'rgba(59,130,246,0.25)', label: 'Conectando...',      emoji: '🔵' },
  pronto:        { cor: '#10b981', bg: 'rgba(16,185,129,0.1)',   borda: 'rgba(16,185,129,0.25)', label: 'Conectado ✓',        emoji: '🟢' },
  erro:          { cor: '#ef4444', bg: 'rgba(239,68,68,0.1)',    borda: 'rgba(239,68,68,0.2)',   label: 'Erro de autenticação','emoji': '🔴' },
};

export default function WhatsAppConfig() {
  const [status, setStatus] = useState('desconectado');
  const [qr, setQr] = useState(null);
  const esRef = useRef(null);

  useEffect(() => {
    // Busca estado atual
    fetch(`${BASE}/whatsapp/status`, { headers: authH() })
      .then(r => r.json())
      .then(d => { setStatus(d.status); if (d.qr) setQr(d.qr); })
      .catch(() => {});

    // SSE para atualizações em tempo real
    const token = getToken();
    const es = new EventSource(`${BASE}/whatsapp/sse?token=${encodeURIComponent(token)}`);
    esRef.current = es;

    es.addEventListener('status', e => {
      const d = JSON.parse(e.data);
      setStatus(d.status);
      if (d.qr) setQr(d.qr);
    });
    es.addEventListener('qr', e => {
      const d = JSON.parse(e.data);
      setQr(d.qr);
      setStatus('aguardando_qr');
    });
    es.addEventListener('pronto', () => {
      setStatus('pronto');
      setQr(null);
      toast.success('WhatsApp conectado! Mensagens automáticas ativadas 🎉');
    });
    es.onerror = () => {};

    return () => es.close();
  }, []);

  async function conectar() {
    setQr(null);
    await fetch(`${BASE}/whatsapp/conectar`, { method: 'POST', headers: authH() });
    setStatus('aguardando_qr');
    toast('Iniciando WhatsApp... Aguarde o QR Code aparecer.', { icon: '📱' });
  }

  async function desconectar() {
    await fetch(`${BASE}/whatsapp/desconectar`, { method: 'POST', headers: authH() });
    setStatus('desconectado');
    setQr(null);
    toast('WhatsApp desconectado.', { icon: '🔌' });
  }

  async function resetarSessao() {
    if (!confirm('Apagar sessão salva e gerar novo QR Code? Você precisará escanear o QR novamente.')) return;
    setQr(null);
    setStatus('aguardando_qr');
    await fetch(`${BASE}/whatsapp/resetar-sessao`, { method: 'POST', headers: authH() });
    toast('Sessão resetada. Aguarde o novo QR Code...', { icon: '🔄' });
  }

  const info = STATUS_INFO[status] || STATUS_INFO.desconectado;

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <Toaster />

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-white">📲 WhatsApp Automático</h1>
        <p className="text-sm text-zinc-500 mt-1">Mensagens automáticas para os clientes a cada atualização do pedido</p>
      </div>

      {/* Status */}
      <div className="rounded-2xl p-4 flex items-center gap-4"
        style={{ background: info.bg, border: `1px solid ${info.borda}` }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
          style={{ background: 'rgba(0,0,0,0.2)' }}>
          {info.emoji}
        </div>
        <div className="flex-1">
          <p className="font-black text-white text-base">{info.label}</p>
          <p className="text-xs mt-0.5" style={{ color: info.cor }}>
            {status === 'pronto' && 'Mensagens sendo enviadas automaticamente'}
            {status === 'aguardando_qr' && 'Escaneie o QR code com seu WhatsApp'}
            {status === 'conectando' && 'Verificando autenticação...'}
            {status === 'desconectado' && 'Clique em Conectar para ativar'}
            {status === 'erro' && 'Desconecte e tente novamente'}
          </p>
        </div>
        {status === 'pronto' && (
          <button onClick={desconectar}
            className="px-3 py-2 rounded-xl text-xs font-bold shrink-0"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            Desconectar
          </button>
        )}
      </div>

      {/* QR Code */}
      {qr && status === 'aguardando_qr' && (
        <div className="rounded-2xl p-6 flex flex-col items-center gap-4"
          style={{ background: '#111', border: '1px solid #1e1e1e' }}>
          <p className="text-sm font-semibold text-zinc-400">Abra o WhatsApp no celular</p>
          <p className="text-xs text-zinc-600 text-center">
            ⋯ → Dispositivos conectados → Conectar dispositivo → Escaneie o código
          </p>
          <div className="p-3 rounded-xl bg-white">
            <img src={qr} alt="QR Code WhatsApp" className="w-56 h-56" />
          </div>
          <p className="text-xs text-zinc-700">O código expira em 60 segundos — um novo é gerado automaticamente</p>
        </div>
      )}

      {/* Botão conectar */}
      {(status === 'desconectado' || status === 'erro') && (
        <button onClick={conectar}
          className="w-full py-4 rounded-2xl font-black text-white text-base"
          style={{ background: 'linear-gradient(135deg, #25d366, #128c7e)', boxShadow: '0 4px 24px rgba(37,211,102,0.3)' }}>
          📱 Conectar WhatsApp
        </button>
      )}

      {/* Botão resetar sessão — aparece quando está travado ou com problema */}
      {(status === 'aguardando_qr' || status === 'conectando' || status === 'erro' || status === 'pronto') && (
        <button onClick={resetarSessao}
          className="w-full py-2.5 rounded-xl text-xs font-bold transition-all"
          style={{ background: 'transparent', color: '#555', border: '1px solid #1e1e1e' }}>
          🔄 Resetar sessão (apaga QR salvo e reconecta do zero)
        </button>
      )}

      {/* Como funciona */}
      <div className="rounded-2xl p-4 space-y-3" style={{ background: '#0f0f0f', border: '1px solid #1a1a1a' }}>
        <p className="text-xs font-bold tracking-widest text-zinc-600">MENSAGENS AUTOMÁTICAS</p>
        {[
          { emoji: '🔔', gatilho: 'Pedido recebido',   msg: 'Confirmação com itens, total e tempo estimado' },
          { emoji: '👨‍🍳', gatilho: 'Em preparo',        msg: 'Aviso que a equipe já está preparando' },
          { emoji: '🛵', gatilho: 'Saindo p/ entrega', msg: 'Aviso que saiu e endereço de entrega' },
          { emoji: '✅', gatilho: 'Entregue',          msg: 'Confirmação de entrega + agradecimento' },
          { emoji: '❌', gatilho: 'Cancelado',         msg: 'Aviso de cancelamento com pedido de desculpas' },
        ].map(({ emoji, gatilho, msg }) => (
          <div key={gatilho} className="flex items-start gap-3">
            <span className="text-lg shrink-0">{emoji}</span>
            <div>
              <p className="text-sm font-semibold text-white">{gatilho}</p>
              <p className="text-xs text-zinc-600">{msg}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-700 text-center">
        Usa o WhatsApp normal via QR Code — gratuito, sem API paga.
        A sessão é salva e reconecta automaticamente ao reiniciar o servidor.
      </p>
    </div>
  );
}
