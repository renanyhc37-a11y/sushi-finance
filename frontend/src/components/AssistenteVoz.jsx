import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken } from '../hooks/useAuth';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

const COR_IDLE   = '#f97316';
const COR_OUVE   = '#f43f5e';
const COR_AZUL   = '#38bdf8';
const ORB_SIZE   = 44;
const MARGIN     = 12;

const TAG_CORES = {
  Insumo:  { bg: '#052e16', border: '#16a34a', text: '#4ade80' },
  Boleto:  { bg: '#450a0a', border: '#dc2626', text: '#fca5a5' },
  Ação:    { bg: '#431407', border: '#f97316', text: '#fdba74' },
  Navegar: { bg: '#2e1065', border: '#7c3aed', text: '#c4b5fd' },
  Info:    { bg: '#082f49', border: '#0284c7', text: '#7dd3fc' },
  Pedido:  { bg: '#1a2e05', border: '#65a30d', text: '#bef264' },
  Cardápio:{ bg: '#1c1917', border: '#78716c', text: '#d6d3d1' },
  Cupom:   { bg: '#2d1b69', border: '#8b5cf6', text: '#ddd6fe' },
};

function falar(texto) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'pt-BR'; u.rate = 1.05; u.pitch = 0.95;
  const vozes = window.speechSynthesis.getVoices();
  u.voice = vozes.find(v => v.lang === 'pt-BR') || vozes.find(v => v.lang.startsWith('pt')) || null;
  window.speechSynthesis.speak(u);
}

function Waveform({ ativa, cor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 28 }}>
      {Array.from({ length: 18 }).map((_, i) => (
        <div key={i} style={{
          width: 2, borderRadius: 2, background: cor || COR_AZUL,
          opacity: ativa ? 0.85 : 0.18,
          height: ativa ? undefined : 3,
          animation: ativa ? `wave ${0.5 + (i % 5) * 0.11}s ${i * 0.035}s ease-in-out infinite alternate` : 'none',
          minHeight: 3, maxHeight: 26, transition: 'opacity 0.3s',
        }} />
      ))}
    </div>
  );
}

function defaultPos() {
  try { const s = localStorage.getItem('ninja_orb_pos'); if (s) return JSON.parse(s); } catch {}
  return { right: 16, bottom: 88 };
}

function OrbBtn({ escutando, processando, onClick }) {
  const cor = escutando ? COR_OUVE : COR_IDLE;
  const [pos, setPos] = React.useState(defaultPos);
  const dragging = React.useRef(false);
  const moved    = React.useRef(false);
  const start    = React.useRef({});

  const savePos = p => { setPos(p); localStorage.setItem('ninja_orb_pos', JSON.stringify(p)); };

  const onDown = e => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    dragging.current = true; moved.current = false;
    start.current = { cx: e.clientX, cy: e.clientY, r: pos.right, b: pos.bottom };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = e => {
    if (!dragging.current) return;
    e.preventDefault();
    const dx = e.clientX - start.current.cx;
    const dy = e.clientY - start.current.cy;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved.current = true;
    setPos({
      right:  Math.max(MARGIN, Math.min(window.innerWidth  - ORB_SIZE - MARGIN, start.current.r - dx)),
      bottom: Math.max(MARGIN, Math.min(window.innerHeight - ORB_SIZE - MARGIN, start.current.b - dy)),
    });
  };
  const onUp = e => {
    if (!dragging.current) return;
    dragging.current = false;
    savePos(pos);
    if (!moved.current) onClick(e);
  };

  return (
    <button onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      title="NinjaContrlol (J)"
      style={{
        position: 'fixed', bottom: pos.bottom, right: pos.right, zIndex: 9999,
        width: ORB_SIZE, height: ORB_SIZE, borderRadius: '50%', border: 'none',
        cursor: 'grab', touchAction: 'none', userSelect: 'none',
        background: `radial-gradient(circle at 35% 35%, ${cor}ee, ${cor}55 60%, transparent)`,
        boxShadow: escutando
          ? `0 0 0 0 ${cor}44, 0 0 22px ${cor}99, 0 4px 18px rgba(0,0,0,0.6)`
          : `0 0 12px ${cor}44, 0 4px 14px rgba(0,0,0,0.5)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: escutando ? 'orbPulse 1.2s ease-in-out infinite'
          : processando ? 'orbSpin 1.5s linear infinite'
          : 'orbIdle 3s ease-in-out infinite',
        transition: 'box-shadow 0.3s, background 0.3s',
      }}>
      <div style={{ position: 'absolute', inset: -5, borderRadius: '50%', border: `1px solid ${cor}44`, animation: 'ringExpand 2s ease-out infinite' }} />
      <div style={{ position: 'absolute', inset: -11, borderRadius: '50%', border: `1px solid ${cor}22`, animation: 'ringExpand 2s 0.5s ease-out infinite' }} />
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
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

const HISTORICO_KEY = 'ninja_historico_v3';
function loadHistorico() {
  try { const s = localStorage.getItem(HISTORICO_KEY); return s ? JSON.parse(s) : []; } catch { return []; }
}

const EXEMPLOS = [
  ['Como tá o dia?',                              'Info'],
  ['Quanto faturamos esse mês?',                  'Info'],
  ['Chegou salmão, 25kg, R$ 750, fornecedor Peixaria Central', 'Insumo'],
  ['Registra boleto da Cia do Salmão, R$ 450, vence em 5 dias', 'Boleto'],
  ['Pausa o Hot Roll',                            'Cardápio'],
  ['Ativa o Hot Roll',                            'Cardápio'],
  ['Muda o preço do Combo Salmão pra R$ 89,90',  'Cardápio'],
  ['Cria cupom NINJA10 de 10% mínimo R$ 50',     'Cupom'],
  ['Pedido 12381 tá pronto',                      'Pedido'],
  ['Abre o cardápio',                             'Navegar'],
  ['Quais boletos vencem essa semana?',           'Info'],
  ['Quem são nossos melhores clientes?',          'Info'],
];

export default function AssistenteVoz() {
  const [aberto, setAberto]       = useState(false);
  const [escutando, setEscutando] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [historico, setHistorico] = useState(loadHistorico);
  const [processando, setProcessando] = useState(false);
  const [inputTexto, setInputTexto] = useState('');
  const [suportado] = useState(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const reconRef  = useRef(null);
  const histRef   = useRef(null);
  const inputRef  = useRef(null);
  const navigate  = useNavigate();

  const parar = useCallback(() => { reconRef.current?.stop(); setEscutando(false); }, []);

  const salvarHistorico = useCallback((h) => {
    localStorage.setItem(HISTORICO_KEY, JSON.stringify(h.slice(0, 60)));
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
    if (!textoOriginal?.trim()) return;
    setProcessando(true);
    setTranscript('');
    try {
      // Envia histórico para contexto de conversa
      const histConversa = historico.slice(0, 8).map(h => ({
        texto: h.texto,
        resposta: h.resposta,
        resposta_raw: h.resposta_raw,
      }));

      const res = await fetch(`${BASE}/ia/agente`, {
        method: 'POST', headers: authH(),
        body: JSON.stringify({ comando: textoOriginal, historico_conversa: histConversa }),
      });

      if (res.ok) {
        const dados = await res.json();
        const novaEntrada = {
          texto: textoOriginal,
          resposta: dados.resposta_voz || 'Feito!',
          resposta_raw: dados.resposta_raw,
          acao: dados.acao,
          tag: dados.tag || 'Info',
          ok: true,
          hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        };
        const novoHist = [novaEntrada, ...historico].slice(0, 60);
        setHistorico(novoHist);
        salvarHistorico(novoHist);
        falar(dados.resposta_voz || 'Feito!');
        executarAcao(dados);
      } else {
        const err = { texto: textoOriginal, resposta: 'Não consegui processar. Tente de novo.', tag: 'Info', ok: false, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };
        setHistorico(h => [err, ...h].slice(0, 60));
      }
    } catch {
      const err = { texto: textoOriginal, resposta: 'Erro de conexão.', tag: 'Info', ok: false, hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) };
      setHistorico(h => [err, ...h].slice(0, 60));
    }
    setProcessando(false);
  }, [historico, executarAcao, salvarHistorico]);

  const iniciarEscuta = useCallback(() => {
    if (escutando || processando) return;
    if (!suportado) { inputRef.current?.focus(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    reconRef.current = rec;
    rec.lang = 'pt-BR'; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 3;
    rec.onstart = () => setEscutando(true);
    rec.onend   = () => setEscutando(false);
    rec.onresult = async (e) => {
      const final    = Array.from(e.results).filter(r => r.isFinal);
      const interims = Array.from(e.results).filter(r => !r.isFinal);
      const texto = (final.length > 0 ? final : interims).map(r => r[0].transcript).join(' ').trim();
      setTranscript(texto);
      if (e.results[e.results.length - 1].isFinal && texto) await processar(texto);
    };
    rec.onerror = (e) => { if (e.error !== 'no-speech') setEscutando(false); setEscutando(false); };
    rec.start();
  }, [suportado, escutando, processando, processar]);

  const enviarTexto = useCallback((e) => {
    e?.preventDefault();
    if (!inputTexto.trim() || processando) return;
    const cmd = inputTexto.trim();
    setInputTexto('');
    processar(cmd);
  }, [inputTexto, processando, processar]);

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

  useEffect(() => { if (aberto && histRef.current) histRef.current.scrollTop = 0; }, [historico, aberto]);

  // Briefing automático: ao abrir pela primeira vez na sessão, busca resumo do dia
  const processarRef = useRef(processar);
  useEffect(() => { processarRef.current = processar; }, [processar]);
  const briefingDone = useRef(false);
  useEffect(() => {
    if (!aberto || briefingDone.current) return;
    briefingDone.current = true;
    const t = setTimeout(() => processarRef.current('briefing do dia'), 700);
    return () => clearTimeout(t);
  }, [aberto]);
  useEffect(() => { if (aberto && !escutando && !processando) setTimeout(() => inputRef.current?.focus(), 150); }, [aberto]);

  const corAtual = escutando ? COR_OUVE : COR_AZUL;

  return (
    <>
      <style>{`
        @keyframes wave { from{height:3px} to{height:24px} }
        @keyframes orbPulse {
          0%,100%{box-shadow:0 0 0 0 #f43f5e44,0 0 22px #f43f5e88,0 4px 18px rgba(0,0,0,.6)}
          50%    {box-shadow:0 0 0 8px #f43f5e00,0 0 30px #f43f5eaa,0 4px 18px rgba(0,0,0,.6)}
        }
        @keyframes orbIdle {
          0%,100%{box-shadow:0 0 12px #f9731644,0 4px 14px rgba(0,0,0,.5)}
          50%    {box-shadow:0 0 24px #f9731666,0 4px 14px rgba(0,0,0,.5)}
        }
        @keyframes orbSpin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes ringExpand { 0%{opacity:.7;transform:scale(1)} 100%{opacity:0;transform:scale(1.55)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(14px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        .ninja-input:focus{outline:none!important}
        .ninja-btn-ex:hover{background:rgba(249,115,22,0.08)!important;border-color:rgba(249,115,22,0.2)!important}
        .ninja-btn-ex:active{transform:scale(.97)}
      `}</style>

      <OrbBtn escutando={escutando} processando={processando} onClick={() => setAberto(v => !v)} />

      {aberto && (
        <div style={{
          position: 'fixed', bottom: 72, right: 16, zIndex: 9998,
          width: 'min(360px, calc(100vw - 32px)',
          maxHeight: 'calc(100dvh - 100px)',
          display: 'flex', flexDirection: 'column', borderRadius: 22, overflow: 'hidden',
          animation: 'slideUp 0.2s ease-out',
          boxShadow: `0 0 0 1px rgba(249,115,22,0.12), 0 0 48px rgba(249,115,22,0.08), 0 28px 56px rgba(0,0,0,0.8)`,
          background: 'rgba(5, 10, 20, 0.98)',
          backdropFilter: 'blur(24px)',
        }}>
          {/* Borda laranja topo */}
          <div style={{ height: 1.5, background: 'linear-gradient(90deg,transparent,#f97316 25%,#38bdf8 75%,transparent)', flexShrink: 0 }} />

          {/* Header */}
          <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid rgba(56,189,248,0.08)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.75" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                </div>
                <div>
                  <p style={{ color: '#f1f5f9', fontWeight: 900, fontSize: 13, lineHeight: 1, letterSpacing: 1.5 }}>NINJACONTRLOL</p>
                  <p style={{ fontSize: 9.5, marginTop: 2.5, lineHeight: 1, color: processando ? '#f97316' : escutando ? COR_OUVE : '#64748b', fontWeight: 700, letterSpacing: 0.5 }}>
                    {processando ? '⟳ processando...' : escutando ? '● ouvindo...' : '○ pronto · J ou Espaço'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {historico.length > 0 && (
                  <button onClick={() => { setHistorico([]); localStorage.removeItem(HISTORICO_KEY); }}
                    title="Limpar histórico"
                    style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#334155' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  </button>
                )}
                <button onClick={() => { parar(); setAberto(false); }}
                  style={{ width: 26, height: 26, borderRadius: 7, border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
          </div>

          {/* Waveform + botão mic */}
          <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid rgba(56,189,248,0.06)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                <Waveform ativa={escutando} cor={corAtual} />
              </div>
              {suportado && (
                <button onClick={escutando ? parar : iniciarEscuta} disabled={processando}
                  style={{
                    width: 36, height: 36, borderRadius: 10, border: `1px solid ${escutando ? COR_OUVE+'66' : 'rgba(249,115,22,0.3)'}`,
                    background: escutando ? 'rgba(244,63,94,0.15)' : 'rgba(249,115,22,0.12)',
                    color: escutando ? COR_OUVE : COR_IDLE, cursor: processando ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    opacity: processando ? 0.4 : 1, transition: 'all 0.2s',
                  }}>
                  {processando
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'orbSpin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    : escutando
                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>
                  }
                </button>
              )}
            </div>

            {/* Transcrição ao vivo */}
            {(escutando || transcript) && (
              <div style={{ marginTop: 7, padding: '6px 10px', borderRadius: 9, background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.12)' }}>
                <p style={{ fontSize: 10.5, color: '#cbd5e1', fontStyle: 'italic', lineHeight: 1.4 }}>
                  {transcript || <span style={{ color: '#334155' }}>Aguardando voz...</span>}
                </p>
              </div>
            )}
          </div>

          {/* Input de texto */}
          <form onSubmit={enviarTexto} style={{ padding: '8px 14px', borderBottom: '1px solid rgba(56,189,248,0.06)', flexShrink: 0, display: 'flex', gap: 7 }}>
            <input
              ref={inputRef}
              className="ninja-input"
              value={inputTexto}
              onChange={e => setInputTexto(e.target.value)}
              placeholder="Digite um comando..."
              disabled={processando}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(249,115,22,0.18)',
                borderRadius: 10, padding: '8px 11px', fontSize: 12, color: '#cbd5e1',
                fontFamily: 'inherit', transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(249,115,22,0.45)'}
              onBlur={e => e.target.style.borderColor = 'rgba(249,115,22,0.18)'}
            />
            <button type="submit" disabled={!inputTexto.trim() || processando}
              style={{
                width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(249,115,22,0.3)',
                background: inputTexto.trim() && !processando ? 'rgba(249,115,22,0.18)' : 'rgba(249,115,22,0.05)',
                color: inputTexto.trim() && !processando ? COR_IDLE : '#334155',
                cursor: inputTexto.trim() && !processando ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s',
              }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </form>

          {/* Histórico / Exemplos */}
          <div ref={histRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 14px', minHeight: 0 }}>
            {historico.length === 0 ? (
              <>
                <p style={{ fontSize: 9.5, color: '#1e3a4a', fontWeight: 700, letterSpacing: 1, marginBottom: 7 }}>EXEMPLOS — clique para executar</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {EXEMPLOS.map(([cmd, tipo]) => {
                    const tc = TAG_CORES[tipo] || TAG_CORES.Info;
                    return (
                      <button key={cmd} className="ninja-btn-ex"
                        onClick={() => !processando && processar(cmd)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '7px 10px', borderRadius: 9, border: '1px solid rgba(255,255,255,0.05)',
                          background: 'rgba(255,255,255,0.02)', cursor: 'pointer', textAlign: 'left', gap: 8,
                          transition: 'all 0.15s',
                        }}>
                        <span style={{ fontSize: 11, color: '#475569', flex: 1 }}>{cmd}</span>
                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, padding: '2px 6px', borderRadius: 5, background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text, flexShrink: 0 }}>{tipo}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 9.5, color: '#1e3a4a', fontWeight: 700, letterSpacing: 1, marginBottom: 7 }}>HISTÓRICO DA CONVERSA</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {historico.map((h, i) => {
                    const tc = TAG_CORES[h.tag] || TAG_CORES.Info;
                    return (
                      <div key={i} style={{ borderRadius: 13, overflow: 'hidden', border: `1px solid ${h.ok ? 'rgba(56,189,248,0.1)' : 'rgba(244,63,94,0.15)'}` }}>
                        {/* Comando do usuário */}
                        <div style={{ padding: '7px 10px', display: 'flex', alignItems: 'flex-start', gap: 7, background: 'rgba(255,255,255,0.02)' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}>
                            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                          </svg>
                          <p style={{ fontSize: 11, color: '#475569', fontStyle: 'italic', flex: 1, lineHeight: 1.4 }}>"{h.texto}"</p>
                          <span style={{ fontSize: 9, color: '#1e3a4a', flexShrink: 0 }}>{h.hora}</span>
                        </div>
                        {/* Resposta */}
                        <div style={{ padding: '7px 10px', display: 'flex', alignItems: 'flex-start', gap: 7, background: 'rgba(0,0,0,0.25)', borderTop: '1px solid rgba(255,255,255,0.025)' }}>
                          <div style={{ width: 14, height: 14, borderRadius: 4, flexShrink: 0, marginTop: 0.5, background: tc.bg, border: `1px solid ${tc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="7" height="7" viewBox="0 0 24 24" fill={tc.text} stroke="none"><circle cx="12" cy="12" r="5"/></svg>
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 11.5, color: h.ok ? '#94a3b8' : '#f87171', lineHeight: 1.5 }}>{h.resposta}</p>
                            {h.acao && h.acao !== 'nenhuma' && h.acao !== 'info' && (
                              <span style={{ display: 'inline-block', marginTop: 4, fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 5, background: tc.bg, border: `1px solid ${tc.border}`, color: tc.text, letterSpacing: 0.5 }}>
                                {h.acao.replace('_', ' ').toUpperCase()} · {h.tag}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '6px 14px', borderTop: '1px solid rgba(56,189,248,0.06)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, color: '#0f2537', fontWeight: 700, letterSpacing: 1 }}>NINJACONTRLOL v3 · PVAI</span>
            <span style={{ fontSize: 9, color: '#0f2537' }}>J=abrir · Espaço=mic · Esc=fechar</span>
          </div>
        </div>
      )}
    </>
  );
}
