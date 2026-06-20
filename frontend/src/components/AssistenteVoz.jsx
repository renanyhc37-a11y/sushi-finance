import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken } from '../hooks/useAuth';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

function falar(texto) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'pt-BR'; u.rate = 1.08; u.pitch = 0.92;
  const vozes = window.speechSynthesis.getVoices();
  u.voice = vozes.find(v => v.lang === 'pt-BR') || vozes.find(v => v.lang.startsWith('pt')) || null;
  window.speechSynthesis.speak(u);
}

// ── Waveform animada ─────────────────────────────────────────
function Waveform({ ativa, cor = '#f97316' }) {
  const bars = 20;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 32 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div key={i} style={{
          width: 2,
          borderRadius: 2,
          background: cor,
          opacity: ativa ? 0.85 : 0.2,
          height: ativa ? undefined : 4,
          animation: ativa ? `wave ${0.5 + (i % 5) * 0.12}s ${i * 0.04}s ease-in-out infinite alternate` : 'none',
          minHeight: 4,
          maxHeight: 28,
          transition: 'opacity 0.3s',
        }} />
      ))}
    </div>
  );
}

// cores da marca
const COR_IDLE     = '#f97316'; // laranja (accent)
const COR_ESCUTA   = '#f43f5e'; // vermelho ao ouvir
const COR_AZUL     = '#38bdf8'; // azul do sistema

// ── Orb pulsante arrastável ───────────────────────────────────
const ORB_SIZE = 46;
const MARGIN   = 12;
function defaultPos() {
  const saved = localStorage.getItem('ninja_orb_pos');
  if (saved) try { return JSON.parse(saved); } catch {}
  return { right: 16, bottom: 88 };
}

function OrbBtn({ escutando, processando, onClick }) {
  const cor = escutando ? COR_ESCUTA : COR_IDLE;
  const [pos, setPos] = React.useState(defaultPos);
  const dragging = React.useRef(false);
  const moved    = React.useRef(false);
  const startRef = React.useRef({});

  const savePos = (p) => {
    setPos(p);
    localStorage.setItem('ninja_orb_pos', JSON.stringify(p));
  };

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    dragging.current = true;
    moved.current = false;
    startRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      right:  pos.right,
      bottom: pos.bottom,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging.current) return;
    e.preventDefault();
    const dx = e.clientX - startRef.current.clientX;
    const dy = e.clientY - startRef.current.clientY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
    // right aumenta ao arrastar pra esquerda (dx negativo), bottom aumenta ao arrastar pra cima (dy negativo)
    const newRight  = Math.max(MARGIN, Math.min(window.innerWidth  - ORB_SIZE - MARGIN, startRef.current.right  - dx));
    const newBottom = Math.max(MARGIN, Math.min(window.innerHeight - ORB_SIZE - MARGIN, startRef.current.bottom - dy));
    setPos({ right: newRight, bottom: newBottom });
  };

  const onPointerUp = (e) => {
    if (!dragging.current) return;
    dragging.current = false;
    savePos(pos);
    if (!moved.current) onClick(e);
  };

  return (
    <button
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      title="NinjaContrlol — Assistente de voz (J)"
      style={{
        position: 'fixed',
        bottom: pos.bottom,
        right: pos.right,
        zIndex: 50,
        width: ORB_SIZE,
        height: ORB_SIZE,
        borderRadius: '50%',
        border: 'none',
        cursor: dragging.current ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
        background: `radial-gradient(circle at 35% 35%, ${cor}dd, ${cor}55 60%, transparent)`,
        boxShadow: escutando
          ? `0 0 0 0 ${cor}44, 0 0 20px ${cor}88, 0 3px 16px rgba(0,0,0,0.55)`
          : `0 0 0 0 ${cor}22, 0 0 12px ${cor}55, 0 3px 14px rgba(0,0,0,0.45)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: escutando ? 'orbPulse 1.2s ease-in-out infinite' : processando ? 'orbSpin 1.5s linear infinite' : 'orbIdle 3s ease-in-out infinite',
        transition: 'box-shadow 0.3s, background 0.3s',
      }}>
      {/* Anel externo */}
      <div style={{
        position: 'absolute', inset: -5, borderRadius: '50%',
        border: `1px solid ${cor}44`,
        animation: 'ringExpand 2s ease-out infinite',
      }} />
      {/* Anel médio */}
      <div style={{
        position: 'absolute', inset: -10, borderRadius: '50%',
        border: `1px solid ${cor}22`,
        animation: 'ringExpand 2s 0.4s ease-out infinite',
      }} />
      {/* Ícone */}
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        {processando
          ? <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          : escutando
          ? <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
          : <><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></>
        }
      </svg>
    </button>
  );
}

// ── Painel principal ─────────────────────────────────────────
export default function AssistenteVoz() {
  const [aberto, setAberto] = useState(false);
  const [escutando, setEscutando] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [historico, setHistorico] = useState([]);
  const [processando, setProcessando] = useState(false);
  const [suportado] = useState(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const reconRef = useRef(null);
  const histRef  = useRef(null);
  const navigate = useNavigate();

  const parar = useCallback(() => {
    reconRef.current?.stop();
    setEscutando(false);
  }, []);

  const addLog = useCallback((texto, resposta, ok = true) => {
    setHistorico(h => [{
      texto, resposta, ok,
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }, ...h].slice(0, 40));
    falar(resposta);
  }, []);

  const executarAcao = useCallback((dados) => {
    const { acao, parametros } = dados;
    if (acao === 'nav' && parametros?.pagina) {
      setTimeout(() => navigate(parametros.pagina), 300);
    }
    if (acao === 'lista_add' && parametros?.item) {
      const nome = parametros.item.charAt(0).toUpperCase() + parametros.item.slice(1);
      fetch(`${BASE}/lista-compras`, {
        method: 'POST', headers: authH(),
        body: JSON.stringify({ nome, quantidade: '1', unidade: 'un', categoria: 'Outros' }),
      }).catch(() => {});
    }
  }, [navigate]);

  const processar = useCallback(async (textoOriginal) => {
    setProcessando(true);
    try {
      const res = await fetch(`${BASE}/ia/agente`, {
        method: 'POST', headers: authH(),
        body: JSON.stringify({ comando: textoOriginal }),
      });
      if (res.ok) {
        const dados = await res.json();
        addLog(textoOriginal, dados.resposta_voz || 'Feito!', true);
        executarAcao(dados);
      } else {
        addLog(textoOriginal, 'Não consegui processar. Tente novamente.', false);
      }
    } catch {
      addLog(textoOriginal, 'Erro de conexão. Verifique o servidor.', false);
    }
    setTranscript('');
    setProcessando(false);
  }, [addLog, executarAcao]);

  const iniciarEscuta = useCallback(() => {
    if (!suportado || escutando || processando) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    reconRef.current = rec;
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.onstart = () => setEscutando(true);
    rec.onend   = () => setEscutando(false);
    rec.onresult = async (e) => {
      const final   = Array.from(e.results).filter(r => r.isFinal);
      const interims = Array.from(e.results).filter(r => !r.isFinal);
      const texto = (final.length > 0 ? final : interims).map(r => r[0].transcript).join(' ').trim();
      setTranscript(texto);
      if (e.results[e.results.length - 1].isFinal && texto) {
        await processar(texto);
      }
    };
    rec.onerror = (e) => {
      if (e.error !== 'no-speech') addLog('', `Microfone: ${e.error}`, false);
      setEscutando(false);
    };
    rec.start();
  }, [suportado, escutando, processando, processar, addLog]);

  // Tecla J para abrir/fechar, Espaço para escutar (quando aberto)
  useEffect(() => {
    const fn = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'j' || e.key === 'J') setAberto(v => !v);
      if (e.key === ' ' && aberto && !escutando && !processando) { e.preventDefault(); iniciarEscuta(); }
      if (e.key === 'Escape') { parar(); setAberto(false); }
    };
    const toggle = () => setAberto(v => !v);
    window.addEventListener('keydown', fn);
    window.addEventListener('assistente:toggle', toggle);
    return () => { window.removeEventListener('keydown', fn); window.removeEventListener('assistente:toggle', toggle); };
  }, [aberto, escutando, processando, iniciarEscuta, parar]);

  useEffect(() => {
    if (histRef.current) histRef.current.scrollTop = 0;
  }, [historico]);

  if (!suportado) return null;

  const cor = escutando ? COR_ESCUTA : COR_AZUL;

  return (
    <>
      <style>{`
        @keyframes wave {
          from { height: 4px; }
          to   { height: 24px; }
        }
        @keyframes orbPulse {
          0%,100% { box-shadow: 0 0 0 0 #f43f5e44, 0 0 20px #f43f5e88, 0 3px 16px rgba(0,0,0,.55); }
          50%      { box-shadow: 0 0 0 7px #f43f5e00, 0 0 28px #f43f5eaa, 0 3px 16px rgba(0,0,0,.55); }
        }
        @keyframes orbIdle {
          0%,100% { box-shadow: 0 0 12px #f9731644, 0 3px 14px rgba(0,0,0,.45); }
          50%      { box-shadow: 0 0 22px #f9731666, 0 3px 14px rgba(0,0,0,.45); }
        }
        @keyframes orbSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes ringExpand {
          0%   { opacity: 0.7; transform: scale(1); }
          100% { opacity: 0;   transform: scale(1.5); }
        }
        @keyframes slideUp {
          from { opacity:0; transform: translateY(16px) scale(0.97); }
          to   { opacity:1; transform: translateY(0)    scale(1);    }
        }
        @keyframes scanLine {
          0%   { top: 0%; }
          100% { top: 100%; }
        }
      `}</style>

      <OrbBtn escutando={escutando} processando={processando} onClick={() => setAberto(v => !v)} />

      {aberto && (
        <div style={{
          position: 'fixed',
          bottom: 144,
          right: 16,
          zIndex: 50,
          width: 340,
          maxHeight: 'calc(100vh - 120px)',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 20,
          overflow: 'hidden',
          animation: 'slideUp 0.22s ease-out',
          boxShadow: `0 0 0 1px #f9731618, 0 0 40px #f9731618, 0 24px 48px rgba(0,0,0,0.7)`,
          background: 'rgba(4, 12, 22, 0.97)',
          backdropFilter: 'blur(20px)',
        }}>

          {/* Linha de luz no topo */}
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #f97316 30%, #f97316 70%, transparent)', flexShrink: 0 }} />

          {/* Header */}
          <div style={{
            padding: '14px 16px 12px',
            borderBottom: '1px solid rgba(0,212,255,0.1)',
            flexShrink: 0,
            background: 'linear-gradient(180deg, rgba(0,212,255,0.05) 0%, transparent 100%)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10,
                  background: 'rgba(0,212,255,0.1)',
                  border: '1px solid rgba(0,212,255,0.25)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.75" strokeLinecap="round">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                  </svg>
                </div>
                <div>
                  <p style={{ color: '#e0f7ff', fontWeight: 900, fontSize: 14, lineHeight: 1, letterSpacing: 1 }}>NINJACONTRLOL</p>
                  <p style={{ color: '#f97316', fontSize: 10, marginTop: 2, lineHeight: 1, opacity: 0.7 }}>
                    {processando ? 'processando...' : escutando ? 'ouvindo...' : 'pronto · tecle J ou Espaço'}
                  </p>
                </div>
              </div>
              <button onClick={() => { parar(); setAberto(false); }}
                style={{
                  width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b',
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          {/* Área central — waveform + transcrição */}
          <div style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid rgba(0,212,255,0.07)',
            flexShrink: 0,
          }}>
            {/* Waveform */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <Waveform ativa={escutando} cor={cor} />
            </div>

            {/* Botão de escuta */}
            <button
              onClick={escutando ? parar : iniciarEscuta}
              disabled={processando}
              style={{
                width: '100%', padding: '11px 0',
                borderRadius: 12, border: `1px solid ${cor}44`,
                background: escutando
                  ? 'linear-gradient(135deg, rgba(244,63,94,0.2), rgba(244,63,94,0.08))'
                  : 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.05))',
                color: cor, fontWeight: 800, fontSize: 13,
                cursor: processando ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: processando ? 0.5 : 1,
                transition: 'all 0.2s',
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06)`,
              }}>
              {processando ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'orbSpin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                  Processando...
                </>
              ) : escutando ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  Parar
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                  Falar comando
                </>
              )}
            </button>

            {/* Transcrição ao vivo */}
            {(escutando || transcript) && (
              <div style={{
                marginTop: 10, padding: '8px 12px', borderRadius: 10,
                background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)',
              }}>
                <p style={{ fontSize: 11, color: '#f97316', opacity: 0.6, fontWeight: 700, marginBottom: 3, letterSpacing: 1 }}>OUVINDO</p>
                <p style={{ fontSize: 12, color: '#cbd5e1', fontStyle: 'italic', lineHeight: 1.4 }}>
                  {transcript || <span style={{ color: '#334155' }}>Aguardando...</span>}
                </p>
              </div>
            )}
          </div>

          {/* Histórico */}
          <div ref={histRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 16px' }}>
            {historico.length === 0 ? (
              <div>
                <p style={{ fontSize: 10, color: '#1e3a4a', fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>EXEMPLOS DE COMANDOS</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    ['Quantos pedidos ativos?',                      'Info'],
                    ['Faturamento de hoje',                           'Info'],
                    ['Chegou salmão, 30kg, custou R$ 900',           'Insumo'],
                    ['Chegou cream cheese, 5kg, custou R$ 150',      'Insumo'],
                    ['Registra boleto da Cia do Salmão de R$ 500 vencendo em 7 dias', 'Boleto'],
                    ['Pausa o Hot Roll no cardápio',                  'Ação'],
                    ['Cria um cupom de 10% chamado PROMO',            'Ação'],
                    ['Abre o PDV',                                    'Navegar'],
                    ['Resumo do dia',                                 'Info'],
                  ].map(([cmd, tipo]) => (
                    <button key={cmd}
                      onClick={() => { if (!processando) processar(cmd); }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '7px 10px', borderRadius: 9, border: '1px solid rgba(0,212,255,0.08)',
                        background: 'rgba(0,212,255,0.03)', cursor: 'pointer', textAlign: 'left', gap: 8,
                      }}>
                      <span style={{ fontSize: 11, color: '#64748b' }}>{cmd}</span>
                      <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                        color: tipo === 'Ação' ? '#f97316' : tipo === 'Navegar' ? '#a78bfa' : tipo === 'Insumo' ? '#34d399' : tipo === 'Boleto' ? '#f43f5e' : '#38bdf8',
                        flexShrink: 0,
                      }}>{tipo}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 10, color: '#1e3a4a', fontWeight: 700, letterSpacing: 1, marginBottom: 2 }}>HISTÓRICO</p>
                {historico.map((h, i) => (
                  <div key={i} style={{
                    borderRadius: 12, overflow: 'hidden',
                    border: `1px solid ${h.ok ? 'rgba(0,212,255,0.1)' : 'rgba(244,63,94,0.15)'}`,
                  }}>
                    {/* Comando */}
                    <div style={{
                      padding: '7px 10px', display: 'flex', alignItems: 'flex-start', gap: 7,
                      background: 'rgba(255,255,255,0.02)',
                    }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      </svg>
                      <p style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', flex: 1, lineHeight: 1.4 }}>"{h.texto}"</p>
                      <span style={{ fontSize: 10, color: '#1e3a4a', flexShrink: 0 }}>{h.hora}</span>
                    </div>
                    {/* Resposta */}
                    <div style={{
                      padding: '7px 10px', display: 'flex', alignItems: 'flex-start', gap: 7,
                      background: 'rgba(0,0,0,0.2)',
                      borderTop: '1px solid rgba(255,255,255,0.03)',
                    }}>
                      <div style={{
                        width: 14, height: 14, borderRadius: 4, flexShrink: 0, marginTop: 0.5,
                        background: 'rgba(0,212,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/></svg>
                      </div>
                      <p style={{ fontSize: 11, color: h.ok ? '#94a3b8' : '#f87171', flex: 1, lineHeight: 1.5 }}>{h.resposta}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '8px 16px', borderTop: '1px solid rgba(0,212,255,0.07)', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 9, color: '#1e3a4a', fontWeight: 700, letterSpacing: 1 }}>PVAI · NINJACONTRLOL v2</span>
            {historico.length > 0 && (
              <button onClick={() => setHistorico([])}
                style={{ fontSize: 9, color: '#1e3a4a', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                LIMPAR
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
