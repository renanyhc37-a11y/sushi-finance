import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import { getToken } from '../hooks/useAuth';
import {
  MessageCircle, Zap, Brain, Megaphone, BarChart3, Settings, Bell, BellOff,
  Search, FlaskConical, Check, Package, Hand, Bot, X, Send, RefreshCw,
  AlertTriangle, Mail, Users, DollarSign, User, Pencil, Save, Handshake,
  Smile, PartyPopper, Drama, ArrowLeft, Trash2, Eye, EyeOff, CheckCircle2,
  Tag, Folder, Clock, Circle, ChevronLeft, Image, FileText, Mic, Video,
  Download, ZoomIn, Phone, MoreVertical, CheckCheck,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const authJ = () => ({ ...authH(), 'Content-Type': 'application/json' });

// ── Paleta WhatsApp Web ───────────────────────────────────────
const WA = {
  bg:           '#111b21',
  sidebar:      '#111b21',
  header:       '#202c33',
  input:        '#2a3942',
  sent:         '#005c4b',
  received:     '#202c33',
  border:       '#313d45',
  txtPrimary:   '#e9edef',
  txtSecondary: '#8696a0',
  txtMeta:      '#667781',
  accent:       '#00a884',
  unread:       '#00a884',
  search:       '#202c33',
  hover:        '#202c33',
  active:       '#2a3942',
};

const TAGS_OPCOES = [
  { id: 'pedido',     label: 'Pedido',     color: '#22c55e' },
  { id: 'reclamacao', label: 'Reclamação', color: '#ef4444' },
  { id: 'duvida',     label: 'Dúvida',     color: '#f59e0b' },
  { id: 'vip',        label: 'VIP',        color: '#a855f7' },
  { id: 'novo',       label: 'Novo',       color: '#0ea5e9' },
];

function formatHora(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function formatData(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  const hoje = new Date();
  const diff = Math.floor((hoje - d) / 86400000);
  if (diff === 0) return formatHora(dt);
  if (diff === 1) return 'Ontem';
  if (diff < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
function formatDataMsg(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  const hoje = new Date();
  const diff = Math.floor((hoje - d) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Avatar com foto real ou iniciais ─────────────────────────
function Avatar({ nome, fotoUrl, size = 40, online = false }) {
  const [erro, setErro] = useState(false);
  const colors = ['#0a7c64','#1f6b8e','#8b4513','#6b2a8b','#b5451b','#536878','#4a7c59'];
  const cor = colors[(nome?.charCodeAt(0) || 65) % colors.length];
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {fotoUrl && !erro ? (
        <img
          src={fotoUrl} alt={nome} onError={() => setErro(true)}
          style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          width: size, height: size, borderRadius: '50%', background: cor,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: size * 0.38, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>
          {(nome || '?').charAt(0).toUpperCase()}
        </div>
      )}
      {online && (
        <div style={{
          position: 'absolute', bottom: 1, right: 1,
          width: size * 0.28, height: size * 0.28,
          borderRadius: '50%', background: WA.accent,
          border: `2px solid ${WA.sidebar}`,
        }} />
      )}
    </div>
  );
}

// ── Lightbox para imagens ─────────────────────────────────────
function Lightbox({ src, onClose }) {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.92)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 16, right: 16,
        background: 'rgba(255,255,255,0.1)', border: 'none',
        borderRadius: '50%', width: 44, height: 44, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
      }}><X size={22} /></button>
      <a href={src} download style={{
        position: 'absolute', top: 16, right: 72,
        background: 'rgba(255,255,255,0.1)', borderRadius: '50%',
        width: 44, height: 44, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color: '#fff', textDecoration: 'none',
      }}><Download size={18} /></a>
      <img
        src={src} alt=""
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 8, objectFit: 'contain' }}
      />
    </div>
  );
}

// ── Bolha de mídia ────────────────────────────────────────────
function MidiaBolha({ msg, onImageClick }) {
  const tipo = msg.tipo || 'texto';
  const url = msg.media_url;

  if (tipo === 'imagem' && url) {
    return (
      <div style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden', maxWidth: 280, marginBottom: msg.corpo && msg.corpo !== '[imagem]' ? 6 : 0 }}
        onClick={() => onImageClick(url)}>
        <img src={url} alt="imagem" style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'cover' }} />
      </div>
    );
  }
  if (tipo === 'video' && url) {
    return (
      <video controls style={{ maxWidth: 280, borderRadius: 8, display: 'block', marginBottom: 4 }}>
        <source src={url} />
      </video>
    );
  }
  if (tipo === 'audio' && url) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Mic size={18} style={{ color: WA.accent, flexShrink: 0 }} />
        <audio controls style={{ height: 32, maxWidth: 220 }}>
          <source src={url} />
        </audio>
      </div>
    );
  }
  if (tipo === 'arquivo' && url) {
    return (
      <a href={url} download target="_blank" rel="noreferrer"
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
          background: 'rgba(0,0,0,0.25)', borderRadius: 8, textDecoration: 'none',
          color: WA.txtPrimary, marginBottom: 4,
        }}>
        <FileText size={22} style={{ color: WA.accent }} />
        <span style={{ fontSize: 13, wordBreak: 'break-all' }}>Arquivo anexado</span>
        <Download size={14} style={{ marginLeft: 'auto', flexShrink: 0 }} />
      </a>
    );
  }
  return null;
}

// ── Separador de data ─────────────────────────────────────────
function SepData({ data }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}>
      <span style={{
        background: '#182229', color: WA.txtSecondary, fontSize: 12,
        padding: '5px 12px', borderRadius: 8, fontWeight: 500,
      }}>{data}</span>
    </div>
  );
}

function playNotif() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(); osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

// ── Estilo de input global ────────────────────────────────────
const IS = { background: WA.input, border: 'none', outline: 'none', color: WA.txtPrimary, borderRadius: 8 };

export default function Chat() {
  const [conversas, setConversas]               = useState([]);
  const [convAtiva, setConvAtiva]               = useState(null);
  const [mensagens, setMensagens]               = useState([]);
  const [texto, setTexto]                       = useState('');
  const [sugestao, setSugestao]                 = useState('');
  const [buscandoSugestao, setBuscandoSugestao] = useState(false);
  const [enviando, setEnviando]                 = useState(false);
  const [busca, setBusca]                       = useState('');
  const [abaConv, setAbaConv]                   = useState('ativas');
  const [aba, setAba]                           = useState('chat');
  const [config, setConfig]                     = useState({});
  const [salvandoCfg, setSalvandoCfg]           = useState(false);
  const [waStatus, setWaStatus]                 = useState('desconectado');
  const [mobileMostrarChat, setMobileMostrarChat] = useState(false);
  const [pedidosCliente, setPedidosCliente]     = useState([]);
  const [mostrarPedidos, setMostrarPedidos]     = useState(false);
  const [mostrarRespostasRapidas, setMostrarRespostasRapidas] = useState(false);
  const [mostrarTags, setMostrarTags]           = useState(false);
  const [respostasRapidas, setRespostasRapidas] = useState([]);
  const [novaResposta, setNovaResposta]         = useState({ titulo:'', corpo:'', atalho:'' });
  const [metricas, setMetricas]                 = useState(null);
  const [broadcast, setBroadcast]               = useState({ titulo:'', corpo:'', filtro:'ativos_semana', limite:80 });
  const [enviandoBroadcast, setEnviandoBroadcast] = useState(false);
  const [broadcasts, setBroadcasts]             = useState([]);
  const [somAtivo, setSomAtivo]                 = useState(true);
  const [exemplos, setExemplos]                 = useState([]);
  const [novoExemplo, setNovoExemplo]           = useState({ categoria:'geral', pergunta:'', resposta:'' });
  const [editandoExemplo, setEditandoExemplo]   = useState(null);
  const [filtroCategoria, setFiltroCategoria]   = useState('todas');
  const [lightbox, setLightbox]                 = useState(null);
  const [mostrarInfo, setMostrarInfo]           = useState(false);

  const fimRef   = useRef(null);
  const inputRef = useRef(null);
  const convAtivaRef = useRef(null);
  convAtivaRef.current = convAtiva;
  const somAtivoRef = useRef(somAtivo);
  somAtivoRef.current = somAtivo;
  const carregarConversasRef = useRef(null);

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensagens]);

  const carregarConversas = useCallback(async () => {
    const r = await fetch(`${BASE}/chat/conversas?arquivadas=${abaConv==='arquivadas'?1:0}&busca=${busca}`, { headers: authH() });
    if (r.ok) setConversas(await r.json());
  }, [abaConv, busca]);

  carregarConversasRef.current = carregarConversas;

  useEffect(() => { carregarConversas(); }, [carregarConversas]);

  // ── Socket ────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(window.location.origin, { path: '/socket.io', auth: { token: getToken() }, transports: ['websocket', 'polling'] });

    socket.on('connect_error', (err) => console.warn('[Socket] erro:', err.message));

    socket.on('wa:mensagem', ({ conversa, mensagem }) => {
      setConversas(prev => {
        const idx = prev.findIndex(c => c.id === conversa.id);
        const arr = idx >= 0 ? [...prev] : [conversa, ...prev];
        if (idx >= 0) arr[idx] = { ...arr[idx], ...conversa };
        return arr.sort((a, b) => new Date(b.ultima_em) - new Date(a.ultima_em));
      });
      if (convAtivaRef.current?.id === conversa.id) {
        setMensagens(m => [...m, mensagem]);
        setConvAtiva(p => ({ ...p, ...conversa, nao_lidas: 0 }));
      } else if (mensagem.de_mim === 0 && somAtivoRef.current) {
        playNotif();
      }
    });
    socket.on('wa:conversas_atualizar', () => carregarConversasRef.current?.());

    const token = getToken();
    const sse = new EventSource(`/api/whatsapp/sse?token=${token}`);
    sse.addEventListener('status', e => { try { setWaStatus(JSON.parse(e.data).status); } catch {} });
    sse.addEventListener('pronto', () => setWaStatus('pronto'));

    carregarConfig();
    carregarRespostasRapidas();
    carregarExemplos();

    return () => { socket.disconnect(); sse.close(); };
  }, []);

  async function carregarConfig() {
    const r = await fetch(`${BASE}/chat/config`, { headers: authH() });
    if (r.ok) setConfig(await r.json());
  }
  async function carregarRespostasRapidas() {
    const r = await fetch(`${BASE}/chat/respostas-rapidas`, { headers: authH() });
    if (r.ok) setRespostasRapidas(await r.json());
  }
  async function carregarMetricas() {
    const r = await fetch(`${BASE}/chat/metricas`, { headers: authH() });
    if (r.ok) setMetricas(await r.json());
  }
  async function carregarBroadcasts() {
    const r = await fetch(`${BASE}/chat/broadcasts`, { headers: authH() });
    if (r.ok) setBroadcasts(await r.json());
  }
  async function carregarExemplos() {
    const r = await fetch(`${BASE}/chat/exemplos`, { headers: authH() });
    if (r.ok) setExemplos(await r.json());
  }
  async function adicionarExemplo() {
    if (!novoExemplo.pergunta.trim() || !novoExemplo.resposta.trim()) return toast.error('Preencha pergunta e resposta');
    const r = await fetch(`${BASE}/chat/exemplos`, { method: 'POST', headers: authJ(), body: JSON.stringify(novoExemplo) });
    if (r.ok) { carregarExemplos(); setNovoExemplo({ categoria: 'geral', pergunta: '', resposta: '' }); toast.success('Exemplo adicionado!'); }
  }
  async function salvarExemplo(ex) {
    await fetch(`${BASE}/chat/exemplos/${ex.id}`, { method: 'PUT', headers: authJ(), body: JSON.stringify(ex) });
    carregarExemplos(); setEditandoExemplo(null); toast.success('Salvo!');
  }
  async function excluirExemplo(id) {
    await fetch(`${BASE}/chat/exemplos/${id}`, { method: 'DELETE', headers: authH() });
    carregarExemplos();
  }
  async function toggleExemplo(ex) {
    await fetch(`${BASE}/chat/exemplos/${ex.id}`, { method: 'PUT', headers: authJ(), body: JSON.stringify({ ativo: ex.ativo ? 0 : 1 }) });
    carregarExemplos();
  }

  async function abrirConversa(conv) {
    setConvAtiva(conv); setMobileMostrarChat(true); setMostrarInfo(false);
    setSugestao(''); setTexto(''); setMostrarPedidos(false); setMostrarTags(false); setMostrarRespostasRapidas(false);
    const r = await fetch(`${BASE}/chat/conversas/${conv.id}/mensagens`, { headers: authH() });
    if (r.ok) { setMensagens(await r.json()); setConversas(prev => prev.map(c => c.id === conv.id ? { ...c, nao_lidas: 0 } : c)); }
    const rp = await fetch(`${BASE}/chat/conversas/${conv.id}/pedidos`, { headers: authH() });
    if (rp.ok) setPedidosCliente(await rp.json());
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function enviar(e) {
    e?.preventDefault();
    const corpo = texto.trim(); if (!corpo || !convAtiva) return;
    setEnviando(true); setTexto(''); setSugestao('');
    try {
      const r = await fetch(`${BASE}/chat/conversas/${convAtiva.id}/responder`, { method: 'POST', headers: authJ(), body: JSON.stringify({ corpo }) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.erro || 'Erro'); }
    } catch (err) { toast.error(err.message); setTexto(corpo); }
    setEnviando(false);
  }

  async function pedirSugestao() {
    if (!convAtiva || buscandoSugestao) return;
    setBuscandoSugestao(true); setSugestao('');
    try {
      const ultima = [...mensagens].reverse().find(m => m.de_mim === 0);
      const r = await fetch(`${BASE}/chat/conversas/${convAtiva.id}/ia-sugerir`, { method: 'POST', headers: authJ(), body: JSON.stringify({ mensagem_cliente: ultima?.corpo || '' }) });
      const d = await r.json();
      if (d.sugestao) setSugestao(d.sugestao); else toast.error(d.erro || 'Sem sugestão');
    } catch (err) { toast.error(err.message); }
    setBuscandoSugestao(false);
  }

  async function toggleIA(conv) {
    const r = await fetch(`${BASE}/chat/conversas/${conv.id}`, { method: 'PATCH', headers: authJ(), body: JSON.stringify({ ia_ativa: !conv.ia_ativa }) });
    if (r.ok) { const u = await r.json(); setConversas(p => p.map(c => c.id === conv.id ? u : c)); if (convAtiva?.id === conv.id) setConvAtiva(u); toast.success(u.ia_ativa ? '🤖 IA ativada' : '⏸ IA pausada'); }
  }

  async function assumirConversa(conv) {
    const assumida = !conv.assumida;
    const r = await fetch(`${BASE}/chat/conversas/${conv.id}`, { method: 'PATCH', headers: authJ(), body: JSON.stringify({ assumida }) });
    if (r.ok) { const u = await r.json(); setConversas(p => p.map(c => c.id === conv.id ? u : c)); setConvAtiva(u); toast.success(assumida ? '✋ Você assumiu a conversa' : '🤖 IA reativada'); }
  }

  async function arquivar(conv) {
    await fetch(`${BASE}/chat/conversas/${conv.id}`, { method: 'PATCH', headers: authJ(), body: JSON.stringify({ arquivada: !conv.arquivada }) });
    if (convAtiva?.id === conv.id) { setConvAtiva(null); setMensagens([]); setMobileMostrarChat(false); }
    carregarConversas(); toast.success(conv.arquivada ? 'Restaurada' : 'Arquivada');
  }

  async function salvarConfig() {
    setSalvandoCfg(true);
    const r = await fetch(`${BASE}/chat/config`, { method: 'PUT', headers: authJ(), body: JSON.stringify(config) });
    if (r.ok) { setConfig(await r.json()); toast.success('Configurações salvas!'); } else toast.error('Erro ao salvar');
    setSalvandoCfg(false);
  }

  async function toggleTag(conv, tagId) {
    const tags = JSON.parse(conv.tags || '[]');
    const novas = tags.includes(tagId) ? tags.filter(t => t !== tagId) : [...tags, tagId];
    const r = await fetch(`${BASE}/chat/conversas/${conv.id}`, { method: 'PATCH', headers: authJ(), body: JSON.stringify({ tags: novas }) });
    if (r.ok) { const u = await r.json(); setConversas(p => p.map(c => c.id === conv.id ? u : c)); setConvAtiva(u); }
  }

  async function enviarBroadcast() {
    if (!broadcast.corpo.trim()) return toast.error('Escreva a mensagem');
    setEnviandoBroadcast(true);
    const r = await fetch(`${BASE}/chat/broadcast`, { method: 'POST', headers: authJ(), body: JSON.stringify(broadcast) });
    const d = await r.json();
    if (d.ok) { toast.success(`Enviando para ${d.total} contatos...`); setBroadcast({ titulo: '', corpo: '', filtro: 'ativos_semana', limite: 80 }); carregarBroadcasts(); }
    else toast.error(d.erro || 'Erro');
    setEnviandoBroadcast(false);
  }

  async function simularMensagem() {
    await fetch(`${BASE}/chat/simular`, { method: 'POST', headers: authJ(), body: JSON.stringify({ telefone: 'TESTE_11999999999', nome: 'Cliente Teste', corpo: 'Olá! Quais sushis vocês têm hoje?' }) });
    toast.success('Mensagem de teste enviada!');
  }

  // Agrupa mensagens por data para os separadores
  function agruparPorData(msgs) {
    const grupos = [];
    let dataAtual = null;
    for (const m of msgs) {
      const d = formatDataMsg(m.created_at);
      if (d !== dataAtual) { grupos.push({ tipo: 'data', data: d, key: `sep-${d}` }); dataAtual = d; }
      grupos.push({ tipo: 'msg', msg: m, key: m.id });
    }
    return grupos;
  }

  const statusColor = { pronto: WA.accent, aguardando_qr: '#f59e0b', conectando: '#3b82f6', desconectado: WA.txtMeta, erro: '#ef4444' }[waStatus] || WA.txtMeta;
  const statusLabel = { pronto: 'Conectado', aguardando_qr: 'Aguardando QR', conectando: 'Conectando...', desconectado: 'Desconectado', erro: 'Erro' }[waStatus] || waStatus;
  const conversasFiltradas = conversas.filter(c => (c.nome || c.telefone || '').toLowerCase().includes(busca.toLowerCase()));

  const navItems = [
    { id: 'chat',        Icon: MessageCircle, label: 'Chat' },
    { id: 'respostas',   Icon: Zap,           label: 'Rápidas' },
    { id: 'treinamento', Icon: Brain,         label: 'Treinar' },
    { id: 'broadcast',   Icon: Megaphone,     label: 'Broadcast' },
    { id: 'metricas',    Icon: BarChart3,     label: 'Métricas' },
    { id: 'config',      Icon: Settings,      label: 'Config' },
  ];

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden', background: WA.bg, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,sans-serif' }}>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1f2937', color: '#e9edef', border: '1px solid #374151' } }} />
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}

      {/* ── Barra nav lateral ── */}
      <div style={{ width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 8, paddingBottom: 8, gap: 2, background: '#0d1418', borderRight: `1px solid ${WA.border}`, flexShrink: 0 }}>
        {navItems.map(n => (
          <button key={n.id} onClick={() => { setAba(n.id); if (n.id === 'metricas') carregarMetricas(); if (n.id === 'broadcast') carregarBroadcasts(); }}
            title={n.label}
            style={{
              width: 44, height: 44, borderRadius: 12, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2, cursor: 'pointer',
              background: aba === n.id ? 'rgba(0,168,132,0.15)' : 'transparent',
              border: aba === n.id ? '1px solid rgba(0,168,132,0.35)' : '1px solid transparent',
              color: aba === n.id ? WA.accent : WA.txtMeta, transition: 'all 0.15s',
            }}>
            <n.Icon size={18} strokeWidth={1.75} />
            <span style={{ fontSize: 8, fontWeight: 600 }}>{n.label}</span>
          </button>
        ))}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingBottom: 4 }}>
          <button onClick={() => setSomAtivo(p => !p)} title={somAtivo ? 'Som ativo' : 'Som desativado'}
            style={{ width: 36, height: 36, borderRadius: 10, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: somAtivo ? WA.accent : WA.txtMeta }}>
            {somAtivo ? <Bell size={17} /> : <BellOff size={17} />}
          </button>
          <div title={`WhatsApp: ${statusLabel}`} style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor }} />
        </div>
      </div>

      {/* ── Sidebar conversas ── */}
      {aba === 'chat' && (
        <div style={{
          width: 360, flexShrink: 0, display: mobileMostrarChat ? 'none' : 'flex',
          flexDirection: 'column', borderRight: `1px solid ${WA.border}`,
          background: WA.sidebar,
        }} className="lg:flex">

          {/* Header sidebar */}
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: WA.header }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#2a3942', display: 'flex', alignItems: 'center', justifyContent: 'center', color: WA.txtSecondary }}>
                <MessageCircle size={20} strokeWidth={1.75} />
              </div>
              <div>
                <div style={{ color: WA.txtPrimary, fontWeight: 600, fontSize: 15 }}>WhatsApp</div>
                <div style={{ color: statusColor, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
                  {statusLabel}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={simularMensagem} title="Simular mensagem teste"
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: WA.txtSecondary }}>
                <FlaskConical size={18} strokeWidth={1.75} />
              </button>
            </div>
          </div>

          {/* Busca */}
          <div style={{ padding: '8px 12px', background: WA.sidebar }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: WA.txtMeta, pointerEvents: 'none' }} />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Pesquisar ou começar nova conversa"
                style={{ ...IS, width: '100%', padding: '8px 12px 8px 36px', fontSize: 14, background: WA.search }} />
            </div>
          </div>

          {/* Tabs ativas/arquivadas */}
          <div style={{ display: 'flex', borderBottom: `1px solid ${WA.border}` }}>
            {[['ativas', 'Conversas'], ['arquivadas', 'Arquivadas']].map(([v, l]) => (
              <button key={v} onClick={() => setAbaConv(v)}
                style={{
                  flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  background: 'transparent', border: 'none',
                  color: abaConv === v ? WA.accent : WA.txtMeta,
                  borderBottom: abaConv === v ? `2px solid ${WA.accent}` : '2px solid transparent',
                }}>{l}</button>
            ))}
          </div>

          {/* Lista de conversas */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {conversasFiltradas.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 160, gap: 8 }}>
                <MessageCircle size={32} style={{ color: WA.txtMeta, opacity: 0.4 }} />
                <p style={{ color: WA.txtMeta, fontSize: 13 }}>{busca ? 'Nenhuma encontrada' : 'Nenhuma conversa ainda'}</p>
                {!busca && <button onClick={simularMensagem} style={{ fontSize: 12, color: WA.accent, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Simular mensagem</button>}
              </div>
            )}
            {conversasFiltradas.map(conv => {
              const tags = JSON.parse(conv.tags || '[]');
              const ativa = convAtiva?.id === conv.id;
              const naoLidas = Number(conv.nao_lidas) > 0;
              return (
                <div key={conv.id} onClick={() => abrirConversa(conv)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                    cursor: 'pointer', borderBottom: `1px solid ${WA.border}`,
                    background: ativa ? WA.active : naoLidas ? 'rgba(0,168,132,0.04)' : 'transparent',
                    transition: 'background 0.1s',
                  }}>
                  <Avatar nome={conv.nome || conv.telefone} fotoUrl={conv.foto_url} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                      <span style={{ color: WA.txtPrimary, fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.nome || conv.telefone}
                      </span>
                      <span style={{ color: naoLidas ? WA.unread : WA.txtMeta, fontSize: 11, flexShrink: 0, marginLeft: 6 }}>
                        {formatData(conv.ultima_em)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, flex: 1 }}>
                        {conv.ia_ativa && !conv.assumida && <Bot size={12} style={{ color: '#0ea5e9', flexShrink: 0 }} />}
                        {conv.assumida && <Hand size={12} style={{ color: WA.accent, flexShrink: 0 }} />}
                        <span style={{ color: naoLidas ? WA.txtPrimary : WA.txtMeta, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: naoLidas ? 500 : 400 }}>
                          {conv.ultima_mensagem || ''}
                        </span>
                      </div>
                      {naoLidas && (
                        <span style={{ background: WA.unread, color: '#fff', fontSize: 11, fontWeight: 700, minWidth: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', flexShrink: 0 }}>
                          {conv.nao_lidas}
                        </span>
                      )}
                    </div>
                    {tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        {tags.map(t => { const tag = TAGS_OPCOES.find(x => x.id === t); return tag ? <span key={t} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: `${tag.color}20`, color: tag.color, fontWeight: 700 }}>{tag.label}</span> : null; })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Área principal ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: WA.bg }}>

        {/* ── CHAT VAZIO ── */}
        {aba === 'chat' && !convAtiva && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#0b141a' }}>
            <div style={{ width: 200, height: 200, borderRadius: '50%', background: 'rgba(0,168,132,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageCircle size={80} style={{ color: 'rgba(0,168,132,0.25)' }} strokeWidth={1} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: WA.txtPrimary, fontSize: 22, fontWeight: 300, marginBottom: 8 }}>WhatsApp Web</p>
              <p style={{ color: WA.txtMeta, fontSize: 14, maxWidth: 320 }}>Selecione uma conversa para começar a enviar mensagens</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
              <span style={{ color: WA.txtMeta, fontSize: 13 }}>{statusLabel}</span>
            </div>
          </div>
        )}

        {/* ── CHAT ATIVO ── */}
        {aba === 'chat' && convAtiva && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            className={!mobileMostrarChat ? 'hidden lg:flex' : ''}>

            {/* Header da conversa */}
            <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, background: WA.header, borderBottom: `1px solid ${WA.border}`, flexShrink: 0 }}>
              <button onClick={() => { setMobileMostrarChat(false); setConvAtiva(null); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: WA.txtSecondary, display: 'flex', alignItems: 'center', marginRight: 4 }}
                className="lg:hidden">
                <ChevronLeft size={22} />
              </button>
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}
                onClick={() => setMostrarInfo(p => !p)}>
                <Avatar nome={convAtiva.nome || convAtiva.telefone} fotoUrl={convAtiva.foto_url} size={40} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: WA.txtPrimary, fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {convAtiva.nome || convAtiva.telefone}
                  </div>
                  <div style={{ color: WA.txtMeta, fontSize: 12 }}>+{convAtiva.telefone}</div>
                </div>
              </div>

              {/* Ações do header */}
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {/* Tags */}
                <div style={{ position: 'relative' }}>
                  <button onClick={() => setMostrarTags(p => !p)}
                    style={{ width: 36, height: 36, borderRadius: '50%', background: mostrarTags ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: WA.txtSecondary }}>
                    <Tag size={17} strokeWidth={1.75} />
                  </button>
                  {mostrarTags && (
                    <div style={{ position: 'absolute', right: 0, top: 44, zIndex: 50, borderRadius: 12, padding: 12, width: 200, background: WA.header, border: `1px solid ${WA.border}`, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                      <div style={{ fontSize: 10, color: WA.txtMeta, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>ETIQUETAS</div>
                      {TAGS_OPCOES.map(tag => {
                        const ativo = JSON.parse(convAtiva.tags || '[]').includes(tag.id);
                        return <button key={tag.id} onClick={() => toggleTag(convAtiva, tag.id)}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, background: ativo ? `${tag.color}15` : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: tag.color }} />
                          <span style={{ fontSize: 13, color: ativo ? tag.color : WA.txtPrimary, flex: 1 }}>{tag.label}</span>
                          {ativo && <Check size={13} style={{ color: tag.color }} />}
                        </button>;
                      })}
                    </div>
                  )}
                </div>

                {/* Pedidos */}
                {pedidosCliente.length > 0 && (
                  <button onClick={() => setMostrarPedidos(p => !p)} title="Pedidos do cliente"
                    style={{ width: 36, height: 36, borderRadius: '50%', background: mostrarPedidos ? 'rgba(0,168,132,0.15)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: mostrarPedidos ? WA.accent : WA.txtSecondary, position: 'relative' }}>
                    <Package size={17} strokeWidth={1.75} />
                    <span style={{ position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: '50%', background: WA.accent, color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{pedidosCliente.length}</span>
                  </button>
                )}

                {/* Assumir / IA */}
                <button onClick={() => assumirConversa(convAtiva)}
                  style={{ padding: '5px 10px', borderRadius: 18, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5, background: convAtiva.assumida ? 'rgba(0,168,132,0.15)' : 'rgba(14,165,233,0.12)', color: convAtiva.assumida ? WA.accent : '#0ea5e9' }}>
                  {convAtiva.assumida ? <><Hand size={13} /> Você</> : <><Bot size={13} /> IA</>}
                </button>

                {/* Arquivar */}
                <button onClick={() => arquivar(convAtiva)} title={convAtiva.arquivada ? 'Restaurar' : 'Arquivar'}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: WA.txtSecondary }}>
                  <Folder size={17} strokeWidth={1.75} />
                </button>
              </div>
            </div>

            {/* Painel pedidos */}
            {mostrarPedidos && pedidosCliente.length > 0 && (
              <div style={{ padding: '10px 16px', background: '#0d1f2d', borderBottom: `1px solid ${WA.border}`, flexShrink: 0 }}>
                <div style={{ fontSize: 10, color: WA.txtMeta, fontWeight: 700, letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Package size={12} /> PEDIDOS ANTERIORES
                </div>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                  {pedidosCliente.map(p => (
                    <div key={p.id} style={{ flexShrink: 0, borderRadius: 10, padding: '8px 12px', minWidth: 150, background: WA.header, border: `1px solid ${WA.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: WA.txtPrimary }}>#{p.numero}</span>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: p.status === 'entregue' ? '#16a34a20' : p.status === 'cancelado' ? '#ef444420' : 'rgba(0,168,132,0.15)', color: p.status === 'entregue' ? '#22c55e' : p.status === 'cancelado' ? '#ef4444' : WA.accent }}>{p.status}</span>
                      </div>
                      <div style={{ fontSize: 11, color: WA.txtMeta, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{p.itens || '—'}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b' }}>R$ {Number(p.total || 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mensagens */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '12px 16px',
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'300\' height=\'300\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Crect width=\'300\' height=\'300\' fill=\'%230b141a\'/%3E%3C/svg%3E")',
              backgroundColor: '#0b141a',
            }}>
              {mensagens.length === 0 && (
                <div style={{ textAlign: 'center', color: WA.txtMeta, fontSize: 13, marginTop: 40 }}>Nenhuma mensagem ainda</div>
              )}
              {agruparPorData(mensagens).map(item => {
                if (item.tipo === 'data') return <SepData key={item.key} data={item.data} />;
                const msg = item.msg;
                const minha = msg.de_mim === 1;
                const temMidia = msg.tipo && msg.tipo !== 'texto' && msg.media_url;
                const temTexto = msg.corpo && msg.corpo !== `[${msg.tipo}]` && msg.corpo.trim();
                return (
                  <div key={item.key} style={{ display: 'flex', justifyContent: minha ? 'flex-end' : 'flex-start', marginBottom: 4 }}>
                    <div style={{
                      maxWidth: '65%', minWidth: 80,
                      background: minha ? WA.sent : WA.received,
                      borderRadius: minha ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      padding: temMidia && !temTexto ? '4px 4px 8px 4px' : '6px 10px 8px 10px',
                      position: 'relative',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.35)',
                    }}>
                      {temMidia && <MidiaBolha msg={msg} onImageClick={setLightbox} />}
                      {temTexto && (
                        <div style={{ fontSize: 14, color: WA.txtPrimary, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', paddingBottom: 2, paddingRight: temMidia ? 0 : 40 }}>
                          {msg.corpo}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: temTexto ? 2 : 4, paddingRight: temMidia && !temTexto ? 6 : 0 }}>
                        {msg.ia === 1 && <span style={{ fontSize: 9, color: '#34d399', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 2 }}><Bot size={9} /> IA</span>}
                        <span style={{ fontSize: 11, color: WA.txtMeta, whiteSpace: 'nowrap' }}>{formatHora(msg.created_at)}</span>
                        {minha && <CheckCheck size={14} style={{ color: WA.accent }} />}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={fimRef} />
            </div>

            {/* Sugestão IA */}
            {sugestao && (
              <div style={{ margin: '0 12px 8px', padding: '10px 14px', borderRadius: 10, background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', flexShrink: 0 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: '#38bdf8', fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Bot size={11} /> Sugestão da IA</div>
                    <div style={{ fontSize: 13, color: '#bae6fd' }}>{sugestao}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => { setTexto(sugestao); setSugestao(''); setTimeout(() => inputRef.current?.focus(), 50); }}
                      style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(14,165,233,0.2)', color: '#0ea5e9', border: 'none', cursor: 'pointer' }}>Usar</button>
                    <button onClick={() => setSugestao('')}
                      style={{ width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: WA.txtMeta }}><X size={14} /></button>
                  </div>
                </div>
              </div>
            )}

            {/* Respostas rápidas popup */}
            {mostrarRespostasRapidas && respostasRapidas.length > 0 && (
              <div style={{ margin: '0 12px 6px', borderRadius: 12, overflow: 'hidden', maxHeight: 200, overflowY: 'auto', background: WA.header, border: `1px solid ${WA.border}`, flexShrink: 0 }}>
                <div style={{ padding: '8px 12px', fontSize: 10, color: WA.txtMeta, fontWeight: 700, letterSpacing: 1, borderBottom: `1px solid ${WA.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Zap size={11} /> RESPOSTAS RÁPIDAS
                </div>
                {respostasRapidas.map(rr => (
                  <button key={rr.id} onClick={() => { setTexto(rr.corpo); setMostrarRespostasRapidas(false); setTimeout(() => inputRef.current?.focus(), 50); }}
                    style={{ width: '100%', padding: '10px 14px', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', borderBottom: `1px solid ${WA.border}` }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: WA.txtPrimary }}>{rr.titulo} {rr.atalho && <span style={{ color: WA.txtMeta, fontWeight: 400 }}>{rr.atalho}</span>}</div>
                    <div style={{ fontSize: 12, color: WA.txtMeta, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{rr.corpo}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{ padding: '8px 12px', background: WA.header, borderTop: `1px solid ${WA.border}`, display: 'flex', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
              <button onClick={() => setMostrarRespostasRapidas(p => !p)}
                style={{ width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: mostrarRespostasRapidas ? WA.accent : WA.txtSecondary, flexShrink: 0 }}
                title="Respostas rápidas">
                <Zap size={20} strokeWidth={1.75} />
              </button>
              <button onClick={pedirSugestao} disabled={buscandoSugestao}
                style={{ width: 40, height: 40, borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', flexShrink: 0 }}
                title="Sugerir com IA">
                {buscandoSugestao ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Bot size={20} strokeWidth={1.75} />}
              </button>
              <textarea ref={inputRef} value={texto} onChange={e => setTexto(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } }}
                placeholder="Digite uma mensagem"
                rows={Math.min(4, Math.max(1, texto.split('\n').length))}
                style={{ flex: 1, padding: '10px 14px', borderRadius: 22, fontSize: 14, outline: 'none', resize: 'none', background: WA.input, color: WA.txtPrimary, border: 'none', lineHeight: 1.5, maxHeight: 120, fontFamily: 'inherit' }} />
              <button onClick={enviar} disabled={enviando || !texto.trim()}
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: texto.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: texto.trim() ? WA.accent : WA.input, color: texto.trim() ? '#fff' : WA.txtMeta, transition: 'all 0.15s' }}>
                {enviando ? <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={18} />}
              </button>
            </div>
          </div>
        )}

        {/* ── RESPOSTAS RÁPIDAS ── */}
        {aba === 'respostas' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <h2 style={{ color: WA.txtPrimary, fontWeight: 700, fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={20} style={{ color: WA.accent }} /> Respostas Rápidas
              </h2>
              <div style={{ borderRadius: 12, padding: 16, marginBottom: 16, background: WA.header, border: `1px solid ${WA.border}` }}>
                <div style={{ fontSize: 11, color: WA.txtMeta, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>+ NOVA RESPOSTA</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input value={novaResposta.titulo} onChange={e => setNovaResposta(p => ({ ...p, titulo: e.target.value }))} placeholder="Título" style={{ ...IS, flex: 1, padding: '8px 12px', fontSize: 14 }} />
                  <input value={novaResposta.atalho} onChange={e => setNovaResposta(p => ({ ...p, atalho: e.target.value }))} placeholder="/atalho" style={{ ...IS, width: 100, padding: '8px 12px', fontSize: 14 }} />
                </div>
                <textarea value={novaResposta.corpo} onChange={e => setNovaResposta(p => ({ ...p, corpo: e.target.value }))} placeholder="Texto da resposta..." rows={3} style={{ ...IS, width: '100%', padding: '8px 12px', fontSize: 14, resize: 'none', display: 'block', marginBottom: 8 }} />
                <button onClick={async () => {
                  if (!novaResposta.titulo || !novaResposta.corpo) return toast.error('Preencha título e corpo');
                  const r = await fetch(`${BASE}/chat/respostas-rapidas`, { method: 'POST', headers: authJ(), body: JSON.stringify(novaResposta) });
                  if (r.ok) { carregarRespostasRapidas(); setNovaResposta({ titulo: '', corpo: '', atalho: '' }); toast.success('Adicionada!'); }
                }} style={{ width: '100%', padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: 14, background: WA.accent, color: '#fff', border: 'none', cursor: 'pointer' }}>+ Adicionar</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {respostasRapidas.map(rr => (
                  <div key={rr.id} style={{ borderRadius: 12, padding: 14, background: WA.header, border: `1px solid ${WA.border}`, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: WA.txtPrimary }}>{rr.titulo}</span>
                        {rr.atalho && <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace', background: WA.input, color: WA.accent }}>{rr.atalho}</span>}
                      </div>
                      <p style={{ fontSize: 13, color: WA.txtMeta, margin: 0 }}>{rr.corpo}</p>
                    </div>
                    <button onClick={async () => { await fetch(`${BASE}/chat/respostas-rapidas/${rr.id}`, { method: 'DELETE', headers: authH() }); carregarRespostasRapidas(); }}
                      style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: WA.txtMeta }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                {respostasRapidas.length === 0 && <p style={{ textAlign: 'center', color: WA.txtMeta, fontSize: 13, padding: 32 }}>Nenhuma resposta cadastrada</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── BROADCAST ── */}
        {aba === 'broadcast' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <h2 style={{ color: WA.txtPrimary, fontWeight: 700, fontSize: 18, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}><Megaphone size={20} style={{ color: WA.accent }} /> Broadcast</h2>
              <div style={{ borderRadius: 10, padding: '10px 14px', marginBottom: 14, background: '#1a1200', border: '1px solid #3a2800', color: '#fbbf24', fontSize: 13, display: 'flex', gap: 8 }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>Prefira "Ativos 7 dias", limite 80/dia, use <code style={{ background: 'rgba(0,0,0,0.3)', padding: '0 4px', borderRadius: 4 }}>{'{nome}'}</code> para personalizar.</span>
              </div>
              <div style={{ borderRadius: 12, padding: 16, marginBottom: 16, background: WA.header, border: `1px solid ${WA.border}` }}>
                <input value={broadcast.titulo} onChange={e => setBroadcast(p => ({ ...p, titulo: e.target.value }))} placeholder="Título (interno)" style={{ ...IS, width: '100%', padding: '8px 12px', fontSize: 14, display: 'block', marginBottom: 8 }} />
                <div style={{ position: 'relative', marginBottom: 12 }}>
                  <textarea value={broadcast.corpo} onChange={e => setBroadcast(p => ({ ...p, corpo: e.target.value }))} placeholder={"Olá {nome}! Temos uma promoção especial hoje 🍣"} rows={5} style={{ ...IS, width: '100%', padding: '8px 12px', fontSize: 14, resize: 'none', lineHeight: 1.6 }} />
                  <button onClick={() => setBroadcast(p => ({ ...p, corpo: p.corpo + '{nome}' }))} style={{ position: 'absolute', bottom: 8, right: 8, fontSize: 10, padding: '3px 8px', borderRadius: 6, background: WA.input, color: WA.accent, border: 'none', cursor: 'pointer', fontWeight: 700 }}>+ {'{nome}'}</button>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: WA.txtMeta, marginBottom: 8 }}>Enviar para:</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {[['ativos_semana', 'Ativos 7d'], ['ativos_mes', 'Ativos 30d'], ['todos', 'Todos']].map(([v, l]) => (
                      <button key={v} onClick={() => setBroadcast(p => ({ ...p, filtro: v }))}
                        style={{ flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: broadcast.filtro === v ? 'rgba(0,168,132,0.15)' : WA.input, border: broadcast.filtro === v ? `1px solid ${WA.accent}` : `1px solid ${WA.border}`, color: broadcast.filtro === v ? WA.accent : WA.txtMeta }}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: WA.txtMeta, marginBottom: 6 }}>Limite: <strong style={{ color: '#f59e0b' }}>{broadcast.limite}</strong> contatos</div>
                  <input type="range" min={10} max={200} step={10} value={broadcast.limite} onChange={e => setBroadcast(p => ({ ...p, limite: parseInt(e.target.value) }))} style={{ width: '100%', accentColor: WA.accent }} />
                </div>
                <button onClick={enviarBroadcast} disabled={enviandoBroadcast || !broadcast.corpo.trim()}
                  style={{ width: '100%', padding: '12px', borderRadius: 8, fontWeight: 700, fontSize: 14, background: enviandoBroadcast || !broadcast.corpo.trim() ? WA.input : WA.accent, color: enviandoBroadcast || !broadcast.corpo.trim() ? WA.txtMeta : '#fff', border: 'none', cursor: broadcast.corpo.trim() ? 'pointer' : 'default' }}>
                  {enviandoBroadcast ? 'Enviando...' : 'Enviar broadcast'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MÉTRICAS ── */}
        {aba === 'metricas' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <div style={{ maxWidth: 680, margin: '0 auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ color: WA.txtPrimary, fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 8 }}><BarChart3 size={20} style={{ color: WA.accent }} /> Métricas</h2>
                <button onClick={carregarMetricas} style={{ fontSize: 12, color: WA.txtMeta, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><RefreshCw size={13} /> Atualizar</button>
              </div>
              {!metricas ? <div style={{ textAlign: 'center', color: WA.txtMeta, padding: 40 }}>Carregando...</div> : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, marginBottom: 16 }}>
                    {[
                      { label: 'Conversas hoje', val: metricas.conversas_hoje, color: WA.accent },
                      { label: 'Mensagens hoje', val: metricas.mensagens_hoje, color: '#38bdf8' },
                      { label: 'Respondidas IA', val: metricas.respondidas_ia_hoje, color: '#22c55e' },
                      { label: 'Não lidas', val: metricas.nao_lidas_total, color: '#ef4444' },
                    ].map(m => (
                      <div key={m.label} style={{ borderRadius: 12, padding: 16, background: WA.header, border: `1px solid ${WA.border}` }}>
                        <div style={{ fontSize: 28, fontWeight: 800, color: m.color }}>{m.val || 0}</div>
                        <div style={{ fontSize: 12, color: WA.txtMeta, marginTop: 4 }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderRadius: 12, padding: 16, background: WA.header, border: `1px solid ${WA.border}`, marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: WA.txtMeta, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>ÚLTIMOS 7 DIAS</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
                      {metricas.por_dia?.map((d, i) => {
                        const max = Math.max(...metricas.por_dia.map(x => x.total), 1);
                        const h = Math.max(4, Math.round((d.total / max) * 70));
                        return (
                          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }} title={`${d.dia}: ${d.total}`}>
                            <div style={{ width: '100%', height: 70, display: 'flex', alignItems: 'flex-end' }}>
                              <div style={{ width: '100%', height: h, borderRadius: '3px 3px 0 0', background: WA.accent, opacity: 0.85 }} />
                            </div>
                            <span style={{ fontSize: 9, color: WA.txtMeta }}>{d.dia?.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div style={{ borderRadius: 12, padding: 16, background: '#0a180a', border: '1px solid #1a2e1a' }}>
                    <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>CUSTO ESTIMADO IA (Haiku)</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                      <div><div style={{ fontSize: 20, fontWeight: 800, color: WA.txtPrimary }}>R$ {((metricas.custo_estimado_hoje_usd || 0) * 5.5).toFixed(3)}</div><div style={{ fontSize: 11, color: WA.txtMeta }}>Hoje</div></div>
                      <div><div style={{ fontSize: 20, fontWeight: 800, color: WA.txtPrimary }}>~{Math.round(metricas.media_ia_por_dia || 0)}/dia</div><div style={{ fontSize: 11, color: WA.txtMeta }}>Média IA</div></div>
                      <div><div style={{ fontSize: 20, fontWeight: 800, color: '#4ade80' }}>R$ {(metricas.custo_estimado_mensal_brl || 0).toFixed(2)}/mês</div><div style={{ fontSize: 11, color: WA.txtMeta }}>Projeção</div></div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── TREINAMENTO ── */}
        {aba === 'treinamento' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <div style={{ maxWidth: 680, margin: '0 auto' }}>
              <h2 style={{ color: WA.txtPrimary, fontWeight: 700, fontSize: 18, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><Brain size={20} style={{ color: WA.accent }} /> Treinar o Bot</h2>
              <p style={{ color: WA.txtMeta, fontSize: 13, marginBottom: 16 }}>Ensine o bot com exemplos de perguntas e respostas. Quanto mais exemplos, mais preciso.</p>
              <div style={{ borderRadius: 12, padding: 16, marginBottom: 16, background: WA.header, border: `1px solid ${WA.border}` }}>
                <div style={{ fontSize: 11, color: WA.txtMeta, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>+ NOVO EXEMPLO</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                  {['geral','pedido','cardapio','pagamento','horario','entrega','reclamacao'].map(cat => (
                    <button key={cat} onClick={() => setNovoExemplo(p => ({ ...p, categoria: cat }))}
                      style={{ padding: '5px 10px', borderRadius: 14, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: novoExemplo.categoria === cat ? 'rgba(0,168,132,0.15)' : WA.input, border: novoExemplo.categoria === cat ? `1px solid ${WA.accent}` : `1px solid ${WA.border}`, color: novoExemplo.categoria === cat ? WA.accent : WA.txtMeta, textTransform: 'capitalize' }}>
                      {cat}
                    </button>
                  ))}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 10, color: WA.txtMeta, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><User size={10} /> CLIENTE PERGUNTA</div>
                  <textarea value={novoExemplo.pergunta} onChange={e => setNovoExemplo(p => ({ ...p, pergunta: e.target.value }))} placeholder="Ex: Vocês entregam no bairro X?" rows={2} style={{ ...IS, width: '100%', padding: '8px 12px', fontSize: 13, resize: 'none' }} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, color: WA.txtMeta, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><Bot size={10} /> BOT RESPONDE</div>
                  <textarea value={novoExemplo.resposta} onChange={e => setNovoExemplo(p => ({ ...p, resposta: e.target.value }))} placeholder="Ex: Sim! Entregamos em toda a cidade." rows={3} style={{ ...IS, width: '100%', padding: '8px 12px', fontSize: 13, resize: 'none' }} />
                </div>
                <button onClick={adicionarExemplo} style={{ width: '100%', padding: '10px', borderRadius: 8, fontWeight: 700, fontSize: 14, background: WA.accent, color: '#fff', border: 'none', cursor: 'pointer' }}>+ Adicionar exemplo</button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {['todas','geral','pedido','cardapio','pagamento','horario','entrega','reclamacao'].map(cat => {
                  const count = cat === 'todas' ? exemplos.length : exemplos.filter(e => e.categoria === cat).length;
                  if (count === 0 && cat !== 'todas') return null;
                  return <button key={cat} onClick={() => setFiltroCategoria(cat)} style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: filtroCategoria === cat ? 'rgba(0,168,132,0.15)' : WA.header, border: filtroCategoria === cat ? `1px solid ${WA.accent}` : `1px solid ${WA.border}`, color: filtroCategoria === cat ? WA.accent : WA.txtMeta, textTransform: 'capitalize' }}>{cat} ({count})</button>;
                })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {exemplos.filter(e => filtroCategoria === 'todas' || e.categoria === filtroCategoria).map(ex => (
                  <div key={ex.id} style={{ borderRadius: 12, padding: 14, background: WA.header, border: `1px solid ${ex.ativo ? WA.border : '#ef444430'}`, opacity: ex.ativo ? 1 : 0.5 }}>
                    {editandoExemplo?.id === ex.id ? (
                      <div>
                        <textarea value={editandoExemplo.pergunta} onChange={e => setEditandoExemplo(p => ({ ...p, pergunta: e.target.value }))} rows={2} style={{ ...IS, width: '100%', padding: '6px 10px', fontSize: 13, resize: 'none', marginBottom: 6 }} />
                        <textarea value={editandoExemplo.resposta} onChange={e => setEditandoExemplo(p => ({ ...p, resposta: e.target.value }))} rows={3} style={{ ...IS, width: '100%', padding: '6px 10px', fontSize: 13, resize: 'none', marginBottom: 8 }} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => salvarExemplo(editandoExemplo)} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 700, background: WA.accent, color: '#fff', border: 'none', cursor: 'pointer' }}>Salvar</button>
                          <button onClick={() => setEditandoExemplo(null)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, background: WA.input, color: WA.txtMeta, border: 'none', cursor: 'pointer' }}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 6, background: WA.input, color: WA.txtMeta, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, display: 'inline-block' }}>{ex.categoria}</span>
                          <div style={{ borderRadius: 8, padding: '8px 10px', background: '#111b21', border: `1px solid ${WA.border}`, marginBottom: 6, fontSize: 13, color: WA.txtPrimary }}><User size={10} style={{ marginRight: 4, verticalAlign: 'middle', color: WA.txtMeta }} />{ex.pergunta}</div>
                          <div style={{ borderRadius: 8, padding: '8px 10px', background: '#0a1f0a', border: '1px solid #1a3a1a', fontSize: 13, color: '#86efac' }}><Bot size={10} style={{ marginRight: 4, verticalAlign: 'middle', color: '#4ade80' }} />{ex.resposta}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <button onClick={() => setEditandoExemplo({ ...ex })} style={{ width: 28, height: 28, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: WA.txtMeta }}><Pencil size={13} /></button>
                          <button onClick={() => toggleExemplo(ex)} style={{ width: 28, height: 28, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ex.ativo ? '#22c55e' : WA.txtMeta }}>{ex.ativo ? <Eye size={13} /> : <EyeOff size={13} />}</button>
                          <button onClick={() => excluirExemplo(ex.id)} style={{ width: 28, height: 28, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: WA.txtMeta }}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {exemplos.length === 0 && <p style={{ textAlign: 'center', color: WA.txtMeta, fontSize: 13, padding: 32 }}>Nenhum exemplo ainda.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIG ── */}
        {aba === 'config' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <div style={{ maxWidth: 560, margin: '0 auto' }}>
              <h2 style={{ color: WA.txtPrimary, fontWeight: 700, fontSize: 18, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Settings size={20} style={{ color: WA.accent }} /> Configurações</h2>
              <div style={{ borderRadius: 12, padding: 16, marginBottom: 12, background: WA.header, border: `1px solid ${WA.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ color: WA.txtPrimary, fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><Bot size={15} /> Respostas automáticas</div>
                  <div style={{ color: WA.txtMeta, fontSize: 12, marginTop: 2 }}>IA responde clientes automaticamente</div>
                </div>
                <button onClick={() => setConfig(p => ({ ...p, ia_global: p.ia_global ? 0 : 1 }))}
                  style={{ width: 48, height: 26, borderRadius: 13, background: config.ia_global ? WA.accent : WA.input, border: 'none', cursor: 'pointer', position: 'relative', transition: 'all 0.2s', flexShrink: 0 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, transition: 'all 0.2s', left: config.ia_global ? 24 : 3 }} />
                </button>
              </div>
              <div style={{ borderRadius: 12, padding: 16, marginBottom: 12, background: WA.header, border: `1px solid ${WA.border}` }}>
                <div style={{ fontSize: 11, color: WA.txtMeta, fontWeight: 700, letterSpacing: 1, marginBottom: 12 }}>TOM DO BOT</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                  {[
                    { id: 'formal', Icon: Handshake, label: 'Formal', desc: 'Profissional', prompt: `Você é o atendente virtual de um restaurante de sushi. Seja profissional, objetivo e cordial. Use no máximo 1 emoji por mensagem. Respostas curtas, máximo 3 linhas. Quando o cliente quiser o cardápio ou fazer pedido, envie: {LINK_CARDAPIO}. Nunca invente preços.` },
                    { id: 'amigavel', Icon: Smile, label: 'Amigável', desc: 'Simpático', prompt: `Você é o atendente do nosso restaurante de sushi! Seja simpático e atencioso. Use no máximo 1 emoji por mensagem. Respostas curtas, máximo 3 linhas. Quando o cliente quiser ver o cardápio ou pedir, manda: {LINK_CARDAPIO}. Nunca invente preços.` },
                    { id: 'divertido', Icon: PartyPopper, label: 'Divertido', desc: 'Descontraído', prompt: `Você é o atendente do restaurante de sushi! Seja descontraído e animado. Use no máximo 2 emojis por mensagem. Respostas curtas, máximo 3 linhas. Para cardápio e pedidos: {LINK_CARDAPIO}. Nunca invente preços.` },
                  ].map(tom => {
                    const ativo = config.prompt_sistema === tom.prompt;
                    return <button key={tom.id} onClick={() => setConfig(p => ({ ...p, prompt_sistema: tom.prompt }))}
                      style={{ padding: 12, borderRadius: 10, cursor: 'pointer', textAlign: 'left', background: ativo ? 'rgba(0,168,132,0.12)' : WA.input, border: ativo ? `1px solid ${WA.accent}` : `1px solid ${WA.border}` }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: ativo ? WA.accent : WA.txtPrimary, display: 'flex', alignItems: 'center', gap: 6 }}><tom.Icon size={13} /> {tom.label}</div>
                      <div style={{ fontSize: 10, color: WA.txtMeta, marginTop: 2 }}>{tom.desc}</div>
                    </button>;
                  })}
                </div>
              </div>
              <div style={{ borderRadius: 12, padding: 16, marginBottom: 12, background: WA.header, border: `1px solid ${WA.border}` }}>
                <div style={{ fontSize: 11, color: WA.txtMeta, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>INSTRUÇÃO PERSONALIZADA</div>
                <textarea value={config.prompt_sistema || ''} onChange={e => setConfig(p => ({ ...p, prompt_sistema: e.target.value }))} rows={7} placeholder="Instruções do bot. Use {LINK_CARDAPIO} para inserir o link." style={{ ...IS, width: '100%', padding: '10px 12px', fontSize: 13, resize: 'none', lineHeight: 1.6, marginBottom: 8 }} />
                <button onClick={() => setConfig(p => ({ ...p, prompt_sistema: (p.prompt_sistema || '') + '{LINK_CARDAPIO}' }))} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, fontFamily: 'monospace', background: WA.input, color: WA.accent, border: 'none', cursor: 'pointer' }}>{'{LINK_CARDAPIO}'}</button>
              </div>
              <div style={{ borderRadius: 12, padding: 16, marginBottom: 12, background: WA.header, border: `1px solid ${WA.border}` }}>
                <div style={{ fontSize: 11, color: WA.txtMeta, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>HORÁRIO DE ATENDIMENTO</div>
                <input value={config.horario_atendimento || ''} onChange={e => setConfig(p => ({ ...p, horario_atendimento: e.target.value }))} placeholder="Ex: 08:00-22:00" style={{ ...IS, width: '100%', padding: '8px 12px', fontSize: 14, marginBottom: 8, display: 'block' }} />
                <div style={{ fontSize: 11, color: WA.txtMeta, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>MENSAGEM FORA DO HORÁRIO</div>
                <textarea value={config.mensagem_fora_horario || ''} onChange={e => setConfig(p => ({ ...p, mensagem_fora_horario: e.target.value }))} rows={2} style={{ ...IS, width: '100%', padding: '8px 12px', fontSize: 13, resize: 'none' }} />
              </div>
              <div style={{ borderRadius: 12, padding: 16, marginBottom: 16, background: WA.header, border: `1px solid ${WA.border}` }}>
                <div style={{ fontSize: 11, color: WA.txtMeta, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>PRIMEIRA MENSAGEM</div>
                <textarea value={config.mensagem_boas_vindas || ''} onChange={e => setConfig(p => ({ ...p, mensagem_boas_vindas: e.target.value }))} rows={2} style={{ ...IS, width: '100%', padding: '8px 12px', fontSize: 13, resize: 'none' }} />
              </div>
              <button onClick={salvarConfig} disabled={salvandoCfg}
                style={{ width: '100%', padding: '13px', borderRadius: 10, fontWeight: 700, fontSize: 14, background: salvandoCfg ? WA.input : WA.accent, color: salvandoCfg ? WA.txtMeta : '#fff', border: 'none', cursor: 'pointer' }}>
                {salvandoCfg ? 'Salvando...' : 'Salvar configurações'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #4b5563; }
      `}</style>
    </div>
  );
}
