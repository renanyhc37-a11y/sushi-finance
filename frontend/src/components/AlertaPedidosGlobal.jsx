import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ConciergeBell, X } from 'lucide-react';
import { getToken } from '../hooks/useAuth';

const BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Notificação GLOBAL de novos pedidos — funciona em qualquer aba do sistema
 * (não só no PDV). Mostra um banner clicável no topo, toca um alarme e dispara
 * notificação do sistema operacional. Quando o usuário já está no PDV, fica
 * quieto (o PDV tem seu próprio alerta), evitando duplicar.
 */
export default function AlertaPedidosGlobal() {
  const location = useLocation();
  const navigate = useNavigate();
  const [novos, setNovos] = useState([]); // pedidos a exibir no banner
  const audioRef = useRef(null);
  const localRef = useRef(location.pathname);
  localRef.current = location.pathname;

  // Pede permissão de notificação do SO uma vez
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Alarme curto via WebAudio (não precisa de arquivo)
  function tocarAlarme() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioRef.current) audioRef.current = new Ctx();
      const ctx = audioRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const tocarBip = (inicio, freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + inicio);
        gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + inicio + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + inicio + 0.25);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + inicio);
        osc.stop(ctx.currentTime + inicio + 0.27);
      };
      tocarBip(0, 880);
      tocarBip(0.3, 1175);
    } catch {}
  }

  useEffect(() => {
    const es = new EventSource(`${BASE}/pdv/eventos?token=${encodeURIComponent(getToken())}`);

    es.addEventListener('novo_pedido', (e) => {
      // No PDV o próprio PDV cuida do alerta — evita duplicar som/banner
      if (localRef.current === '/pdv') return;
      let dados;
      try { dados = JSON.parse(e.data); } catch { return; }

      setNovos(prev => prev.some(p => p.id === dados.id) ? prev : [...prev, dados]);
      tocarAlarme();

      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const n = new Notification(`🔔 Novo pedido #${dados.numero}`, {
            body: `${dados.cliente_nome} · R$ ${Number(dados.total || 0).toFixed(2).replace('.', ',')}`,
            icon: '/pwa-192x192.png', badge: '/pwa-64x64.png',
            tag: `pedido-${dados.id}`, requireInteraction: true,
          });
          n.onclick = () => { window.focus(); navigate('/pdv'); n.close(); };
        } catch {}
      }
    });

    es.onerror = () => {};
    return () => es.close();
  }, [navigate]);

  if (novos.length === 0) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[60] w-[calc(100%-1.5rem)] max-w-sm space-y-2">
      {novos.map(p => (
        <button key={p.id}
          onClick={() => { navigate('/pdv'); setNovos(n => n.filter(x => x.id !== p.id)); }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all active:scale-[0.98] animate-pulse"
          style={{
            background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
            boxShadow: '0 10px 36px rgba(var(--accent-rgb),0.5)',
            border: '1px solid rgba(255,255,255,0.25)',
          }}>
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.22)' }}>
            <ConciergeBell size={20} strokeWidth={2} color="#fff" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-white font-black text-sm leading-tight">Novo pedido #{p.numero}</span>
            <span className="block text-white/90 text-xs font-semibold truncate">
              {p.cliente_nome} · R$ {Number(p.total || 0).toFixed(2).replace('.', ',')} — toque para abrir o PDV
            </span>
          </span>
          <span onClick={(ev) => { ev.stopPropagation(); setNovos(n => n.filter(x => x.id !== p.id)); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
            <X size={15} strokeWidth={2.5} color="#fff" />
          </span>
        </button>
      ))}
    </div>
  );
}
