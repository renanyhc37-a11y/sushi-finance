import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import toast, { Toaster } from 'react-hot-toast';
import { getToken } from '../hooks/useAuth';
import {
  MessageCircle, Zap, Brain, Megaphone, BarChart3, Settings, Bell, BellOff,
  Search, FlaskConical, Check, Package, Hand, Bot, X, Send, RefreshCw,
  AlertTriangle, Mail, Users, DollarSign, User, Pencil, Save, Handshake,
  Smile, PartyPopper, Drama, ArrowLeft, Trash2, Eye, EyeOff, CheckCircle2,
  Tag, Folder, Clock, Circle,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const authJ = () => ({ ...authH(), 'Content-Type': 'application/json' });

const TAGS_OPCOES = [
  { id: 'pedido',     label: 'Pedido',     color: '#22c55e' },
  { id: 'reclamacao', label: 'Reclamação', color: '#ef4444' },
  { id: 'duvida',     label: 'Dúvida',     color: 'var(--accent-2)' },
  { id: 'vip',        label: 'VIP',        color: '#a855f7' },
  { id: 'novo',       label: 'Novo',       color: '#0ea5e9' },
];

function timeAgo(dt) {
  if (!dt) return '';
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
function formatTime(dt) {
  if (!dt) return '';
  return new Date(dt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function Avatar({ nome, size = 40 }) {
  const colors = ['var(--accent)','#0ea5e9','#16a34a','#9333ea','#ec4899','#ef4444','#d4a017'];
  const c = colors[(nome?.charCodeAt(0)||0) % colors.length];
  return <div style={{ width:size, height:size, borderRadius:'50%', background:c, display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.4, fontWeight:900, color:'#fff', flexShrink:0 }}>{(nome||'?').charAt(0).toUpperCase()}</div>;
}

// Som de notificação
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

export default function Chat() {
  const [conversas, setConversas]           = useState([]);
  const [convAtiva, setConvAtiva]           = useState(null);
  const [mensagens, setMensagens]           = useState([]);
  const [texto, setTexto]                   = useState('');
  const [sugestao, setSugestao]             = useState('');
  const [buscandoSugestao, setBuscandoSugestao] = useState(false);
  const [enviando, setEnviando]             = useState(false);
  const [busca, setBusca]                   = useState('');
  const [abaConv, setAbaConv]               = useState('ativas');
  const [aba, setAba]                       = useState('chat'); // chat | config | metricas | broadcast | respostas
  const [config, setConfig]                 = useState({});
  const [salvandoCfg, setSalvandoCfg]       = useState(false);
  const [waStatus, setWaStatus]             = useState('desconectado');
  const [mobileMostrarChat, setMobileMostrarChat] = useState(false);
  const [pedidosCliente, setPedidosCliente] = useState([]);
  const [mostrarPedidos, setMostrarPedidos] = useState(false);
  const [mostrarRespostasRapidas, setMostrarRespostasRapidas] = useState(false);
  const [mostrarTags, setMostrarTags]       = useState(false);
  const [respostasRapidas, setRespostasRapidas] = useState([]);
  const [novaResposta, setNovaResposta]     = useState({ titulo:'', corpo:'', atalho:'' });
  const [metricas, setMetricas]             = useState(null);
  const [broadcast, setBroadcast]           = useState({ titulo:'', corpo:'', filtro:'ativos_semana', limite:80 });
  const [enviandoBroadcast, setEnviandoBroadcast] = useState(false);
  const [broadcasts, setBroadcasts]         = useState([]);
  const [somAtivo, setSomAtivo]             = useState(true);
  const [exemplos, setExemplos]             = useState([]);
  const [novoExemplo, setNovoExemplo]       = useState({ categoria:'geral', pergunta:'', resposta:'' });
  const [editandoExemplo, setEditandoExemplo] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState('todas');

  const fimRef   = useRef(null);
  const inputRef = useRef(null);
  const convAtivaRef = useRef(null);
  convAtivaRef.current = convAtiva;
  const somAtivoRef = useRef(somAtivo);
  somAtivoRef.current = somAtivo;
  const carregarConversasRef = useRef(null);

  useEffect(() => { fimRef.current?.scrollIntoView({ behavior:'smooth' }); }, [mensagens]);

  const carregarConversas = useCallback(async () => {
    const r = await fetch(`${BASE}/chat/conversas?arquivadas=${abaConv==='arquivadas'?1:0}&busca=${busca}`, { headers:authH() });
    if (r.ok) setConversas(await r.json());
  }, [abaConv, busca]);

  // Mantém ref sempre atualizado (evita stale closure no socket)
  carregarConversasRef.current = carregarConversas;

  useEffect(() => { carregarConversas(); }, [carregarConversas]);

  // ── Socket ────────────────────────────────────────────────────
  useEffect(() => {
    const socket = io(window.location.origin, { path:'/socket.io', auth:{ token: getToken() }, transports:['websocket','polling'] });

    socket.on('connect_error', (err) => console.warn('[Socket] erro de conexão:', err.message));

    socket.on('wa:mensagem', ({ conversa, mensagem }) => {
      setConversas(prev => {
        const idx = prev.findIndex(c => c.id === conversa.id);
        const arr = idx >= 0 ? [...prev] : [conversa, ...prev];
        if (idx >= 0) arr[idx] = { ...arr[idx], ...conversa };
        return arr.sort((a,b) => new Date(b.ultima_em)-new Date(a.ultima_em));
      });
      if (convAtivaRef.current?.id === conversa.id) {
        setMensagens(m => [...m, mensagem]);
        setConvAtiva(p => ({ ...p, ...conversa, nao_lidas: 0 }));
      } else if (mensagem.de_mim === 0 && somAtivoRef.current) {
        playNotif();
      }
    });
    socket.on('wa:conversas_atualizar', () => carregarConversasRef.current?.());
    carregarExemplos();

    const token = getToken();
    const sse = new EventSource(`/api/whatsapp/sse?token=${token}`);
    sse.addEventListener('status', e => { try { setWaStatus(JSON.parse(e.data).status); } catch {} });
    sse.addEventListener('pronto', () => setWaStatus('pronto'));

    carregarConfig();
    carregarRespostasRapidas();

    return () => { socket.disconnect(); sse.close(); };
  }, []);

  async function carregarConfig() {
    const r = await fetch(`${BASE}/chat/config`, { headers:authH() });
    if (r.ok) setConfig(await r.json());
  }
  async function carregarRespostasRapidas() {
    const r = await fetch(`${BASE}/chat/respostas-rapidas`, { headers:authH() });
    if (r.ok) setRespostasRapidas(await r.json());
  }
  async function carregarMetricas() {
    const r = await fetch(`${BASE}/chat/metricas`, { headers:authH() });
    if (r.ok) setMetricas(await r.json());
  }
  async function carregarBroadcasts() {
    const r = await fetch(`${BASE}/chat/broadcasts`, { headers:authH() });
    if (r.ok) setBroadcasts(await r.json());
  }
  async function carregarExemplos() {
    const r = await fetch(`${BASE}/chat/exemplos`, { headers:authH() });
    if (r.ok) setExemplos(await r.json());
  }
  async function adicionarExemplo() {
    if (!novoExemplo.pergunta.trim() || !novoExemplo.resposta.trim()) return toast.error('Preencha pergunta e resposta');
    const r = await fetch(`${BASE}/chat/exemplos`, { method:'POST', headers:authJ(), body:JSON.stringify(novoExemplo) });
    if (r.ok) { carregarExemplos(); setNovoExemplo({ categoria:'geral', pergunta:'', resposta:'' }); toast.success('Exemplo adicionado!'); }
  }
  async function salvarExemplo(ex) {
    await fetch(`${BASE}/chat/exemplos/${ex.id}`, { method:'PUT', headers:authJ(), body:JSON.stringify(ex) });
    carregarExemplos(); setEditandoExemplo(null); toast.success('Salvo!');
  }
  async function excluirExemplo(id) {
    await fetch(`${BASE}/chat/exemplos/${id}`, { method:'DELETE', headers:authH() });
    carregarExemplos();
  }
  async function toggleExemplo(ex) {
    await fetch(`${BASE}/chat/exemplos/${ex.id}`, { method:'PUT', headers:authJ(), body:JSON.stringify({ ativo: ex.ativo ? 0 : 1 }) });
    carregarExemplos();
  }

  async function abrirConversa(conv) {
    setConvAtiva(conv); setMobileMostrarChat(true);
    setSugestao(''); setTexto(''); setMostrarPedidos(false); setMostrarTags(false); setMostrarRespostasRapidas(false);
    const r = await fetch(`${BASE}/chat/conversas/${conv.id}/mensagens`, { headers:authH() });
    if (r.ok) { setMensagens(await r.json()); setConversas(prev => prev.map(c => c.id===conv.id ? {...c,nao_lidas:0} : c)); }
    // Busca pedidos do cliente
    const rp = await fetch(`${BASE}/chat/conversas/${conv.id}/pedidos`, { headers:authH() });
    if (rp.ok) setPedidosCliente(await rp.json());
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function enviar(e) {
    e?.preventDefault();
    const corpo = texto.trim(); if (!corpo || !convAtiva) return;
    setEnviando(true); setTexto(''); setSugestao('');
    try {
      const r = await fetch(`${BASE}/chat/conversas/${convAtiva.id}/responder`, { method:'POST', headers:authJ(), body:JSON.stringify({ corpo }) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.erro||'Erro'); }
    } catch(err) { toast.error(err.message); setTexto(corpo); }
    setEnviando(false);
  }

  async function pedirSugestao() {
    if (!convAtiva || buscandoSugestao) return;
    setBuscandoSugestao(true); setSugestao('');
    try {
      const ultima = [...mensagens].reverse().find(m => m.de_mim===0);
      const r = await fetch(`${BASE}/chat/conversas/${convAtiva.id}/ia-sugerir`, { method:'POST', headers:authJ(), body:JSON.stringify({ mensagem_cliente: ultima?.corpo||'' }) });
      const d = await r.json();
      if (d.sugestao) setSugestao(d.sugestao); else toast.error(d.erro||'Sem sugestão');
    } catch(err) { toast.error(err.message); }
    setBuscandoSugestao(false);
  }

  async function toggleIA(conv) {
    const r = await fetch(`${BASE}/chat/conversas/${conv.id}`, { method:'PATCH', headers:authJ(), body:JSON.stringify({ ia_ativa: !conv.ia_ativa }) });
    if (r.ok) { const u = await r.json(); setConversas(p => p.map(c => c.id===conv.id?u:c)); if (convAtiva?.id===conv.id) setConvAtiva(u); toast.success(u.ia_ativa?'🤖 IA ativada':'⏸ IA pausada'); }
  }

  async function assumirConversa(conv) {
    const assumida = !conv.assumida;
    const r = await fetch(`${BASE}/chat/conversas/${conv.id}`, { method:'PATCH', headers:authJ(), body:JSON.stringify({ assumida }) });
    if (r.ok) { const u = await r.json(); setConversas(p => p.map(c => c.id===conv.id?u:c)); setConvAtiva(u); toast.success(assumida?'✋ Você assumiu a conversa':'🤖 IA reativada'); }
  }

  async function arquivar(conv) {
    await fetch(`${BASE}/chat/conversas/${conv.id}`, { method:'PATCH', headers:authJ(), body:JSON.stringify({ arquivada: !conv.arquivada }) });
    if (convAtiva?.id===conv.id) { setConvAtiva(null); setMensagens([]); setMobileMostrarChat(false); }
    carregarConversas(); toast.success(conv.arquivada?'Restaurada':'Arquivada');
  }

  async function salvarConfig() {
    setSalvandoCfg(true);
    const r = await fetch(`${BASE}/chat/config`, { method:'PUT', headers:authJ(), body:JSON.stringify(config) });
    if (r.ok) { setConfig(await r.json()); toast.success('Configurações salvas!'); } else toast.error('Erro ao salvar');
    setSalvandoCfg(false);
  }

  async function toggleTag(conv, tagId) {
    const tags = JSON.parse(conv.tags||'[]');
    const novas = tags.includes(tagId) ? tags.filter(t=>t!==tagId) : [...tags, tagId];
    const r = await fetch(`${BASE}/chat/conversas/${conv.id}`, { method:'PATCH', headers:authJ(), body:JSON.stringify({ tags: novas }) });
    if (r.ok) { const u = await r.json(); setConversas(p=>p.map(c=>c.id===conv.id?u:c)); setConvAtiva(u); }
  }

  async function usarRespostaRapida(rr) {
    setTexto(rr.corpo); setMostrarRespostasRapidas(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function adicionarRespostaRapida() {
    if (!novaResposta.titulo||!novaResposta.corpo) return toast.error('Preencha título e corpo');
    const r = await fetch(`${BASE}/chat/respostas-rapidas`, { method:'POST', headers:authJ(), body:JSON.stringify(novaResposta) });
    if (r.ok) { carregarRespostasRapidas(); setNovaResposta({titulo:'',corpo:'',atalho:''}); toast.success('Resposta adicionada!'); }
  }

  async function excluirRespostaRapida(id) {
    await fetch(`${BASE}/chat/respostas-rapidas/${id}`, { method:'DELETE', headers:authH() });
    carregarRespostasRapidas();
  }

  async function enviarBroadcast() {
    if (!broadcast.corpo.trim()) return toast.error('Escreva a mensagem');
    setEnviandoBroadcast(true);
    const r = await fetch(`${BASE}/chat/broadcast`, { method:'POST', headers:authJ(), body:JSON.stringify(broadcast) });
    const d = await r.json();
    if (d.ok) { toast.success(`Enviando para ${d.total} contatos...`); setBroadcast({titulo:'',corpo:'',filtro:'ativos_semana',limite:80}); carregarBroadcasts(); }
    else toast.error(d.erro||'Erro');
    setEnviandoBroadcast(false);
  }

  async function simularMensagem() {
    await fetch(`${BASE}/chat/simular`, { method:'POST', headers:authJ(), body:JSON.stringify({ telefone:'TESTE_11999999999', nome:'Cliente Teste', corpo:'Olá! Quais sushis vocês têm hoje?' }) });
    toast.success('Mensagem de teste enviada!');
  }

  const IS = { background:'var(--space-elev-2)', border:'1px solid var(--hairline)', color:'var(--txt-strong)', borderRadius:10 };
  const statusColor = { pronto:'#22c55e', aguardando_qr:'var(--accent-2)', conectando:'var(--accent)', desconectado:'var(--txt-dim)', erro:'#ef4444' }[waStatus]||'var(--txt-dim)';
  const conversasFiltradas = conversas.filter(c => (c.nome||c.telefone||'').toLowerCase().includes(busca.toLowerCase()));

  // ── Nav lateral ──
  const navItems = [
    { id:'chat',        Icon: MessageCircle, label:'Conversas' },
    { id:'respostas',   Icon: Zap,           label:'Respostas' },
    { id:'treinamento', Icon: Brain,         label:'Treinar'   },
    { id:'broadcast',   Icon: Megaphone,     label:'Broadcast' },
    { id:'metricas',    Icon: BarChart3,     label:'Métricas'  },
    { id:'config',      Icon: Settings,      label:'Config'    },
  ];

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden" style={{ background:'var(--space-base)' }}>
      <Toaster position="top-right" />

      {/* ── Nav vertical ── */}
      <div className="hidden lg:flex flex-col items-center py-3 gap-1 shrink-0" style={{ width:64, borderRight:'1px solid var(--hairline)' }}>
        {navItems.map(n => (
          <button key={n.id} onClick={() => { setAba(n.id); if(n.id==='metricas') carregarMetricas(); if(n.id==='broadcast') carregarBroadcasts(); if(n.id==='treinamento') carregarExemplos(); }}
            className="w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all"
            style={{ background:aba===n.id?'rgba(var(--accent-rgb),0.12)':'transparent', border:aba===n.id?'1px solid rgba(var(--accent-rgb),0.3)':'1px solid transparent' }}
            title={n.label}>
            <n.Icon size={19} strokeWidth={1.75} style={{ color:aba===n.id?'var(--accent)':'var(--txt-dim)' }} />
            <span className="text-[9px] leading-none" style={{ color:aba===n.id?'var(--accent)':'var(--txt-faint)' }}>{n.label}</span>
          </button>
        ))}
        <div className="mt-auto flex flex-col items-center gap-2 pb-2">
          <button onClick={() => setSomAtivo(p=>!p)} className="w-10 h-10 rounded-xl flex items-center justify-center text-base" style={{ color: somAtivo?'var(--accent)':'var(--txt-faint)' }} title={somAtivo?'Som ativo':'Som desativado'}>
            {somAtivo ? <Bell size={18} strokeWidth={1.75} /> : <BellOff size={18} strokeWidth={1.75} />}
          </button>
          <div className="w-2 h-2 rounded-full" style={{ background:statusColor }} title={`WhatsApp: ${waStatus}`} />
        </div>
      </div>

      {/* ── Sidebar conversas ── */}
      {aba === 'chat' && (
        <div className={`flex flex-col border-r shrink-0 ${mobileMostrarChat?'hidden lg:flex':'flex'} w-full lg:w-72 xl:w-80`} style={{ borderColor:'var(--hairline)' }}>
          <div className="px-3 py-2.5 flex items-center gap-2" style={{ borderBottom:'1px solid var(--hairline)' }}>
            <div className="relative flex-1">
              <Search size={14} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
              <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar..." className="w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none" style={IS} />
            </div>
            <button onClick={simularMensagem} className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background:'var(--space-elev-2)', border:'1px solid var(--hairline-strong)', color:'var(--txt-dim)' }} title="Teste"><FlaskConical size={15} strokeWidth={1.75} /></button>
          </div>
          <div className="flex" style={{ borderBottom:'1px solid var(--hairline)' }}>
            {[['ativas','Ativas'],['arquivadas','Arquivadas']].map(([v,l]) => (
              <button key={v} onClick={()=>setAbaConv(v)} className="flex-1 py-2 text-xs font-bold transition-all"
                style={abaConv===v?{color:'var(--accent)',borderBottom:'2px solid var(--accent)'}:{color:'var(--txt-faint)'}}>
                {l}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversasFiltradas.length===0 && (
              <div className="flex flex-col items-center justify-center h-40 gap-2">
                <span className="opacity-20 text-zinc-400"><MessageCircle size={30} strokeWidth={1.5} /></span>
                <p className="text-xs text-zinc-700">{busca?'Nenhuma encontrada':'Nenhuma conversa ainda'}</p>
                {!busca && <button onClick={simularMensagem} className="text-xs text-orange-500 underline">Simular mensagem</button>}
              </div>
            )}
            {conversasFiltradas.map(conv => {
              const tags = JSON.parse(conv.tags||'[]');
              return (
                <button key={conv.id} onClick={()=>abrirConversa(conv)}
                  className="w-full px-3 py-3 flex items-center gap-3 text-left transition-all hover:bg-white/[0.025]"
                  style={{ borderBottom:'1px solid var(--hairline-soft)', borderLeft:`3px solid ${convAtiva?.id===conv.id?'var(--accent)':'transparent'}`, background:convAtiva?.id===conv.id?'var(--accent-soft)':(Number(conv.nao_lidas)>0?'rgba(var(--accent-rgb),0.035)':'transparent') }}>
                  <div style={{ position:'relative' }}>
                    <Avatar nome={conv.nome||conv.telefone} size={40} />
                    {conv.ia_ativa && !conv.assumida && <div style={{ position:'absolute', bottom:-2, right:-2, width:15, height:15, borderRadius:'50%', background:'#0ea5e9', border:'2px solid var(--space-base)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}><Bot size={8} strokeWidth={2.5} /></div>}
                    {conv.assumida && <div style={{ position:'absolute', bottom:-2, right:-2, width:15, height:15, borderRadius:'50%', background:'var(--accent)', border:'2px solid var(--space-base)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff' }}><Hand size={8} strokeWidth={2.5} /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center gap-2">
                      <span className="font-bold text-[13px] truncate" style={{ color:'var(--txt-strong)' }}>{conv.nome||conv.telefone}</span>
                      <span className="text-[10px] shrink-0" style={{ color: Number(conv.nao_lidas)>0?'var(--accent)':'var(--txt-faint)' }}>{timeAgo(conv.ultima_em)}</span>
                    </div>
                    {tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {tags.map(t => { const tag = TAGS_OPCOES.find(x=>x.id===t); return tag ? <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background:`${tag.color}20`, color:tag.color }}>{tag.label}</span> : null; })}
                      </div>
                    )}
                    <div className="flex justify-between items-center gap-2 mt-1">
                      <span className="text-[12px] truncate" style={{ color: Number(conv.nao_lidas)>0?'var(--txt)':'var(--txt-dim)', fontWeight: Number(conv.nao_lidas)>0?600:400 }}>{conv.ultima_mensagem||'...'}</span>
                      {Number(conv.nao_lidas)>0 && <span className="ml-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-black shrink-0 px-1" style={{ background:'var(--accent)', color:'#fff' }}>{conv.nao_lidas}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Área principal ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── CHAT ── */}
        {aba==='chat' && !convAtiva && !mobileMostrarChat && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
            <span className="opacity-10 text-zinc-400"><MessageCircle size={64} strokeWidth={1.25} /></span>
            <p className="text-zinc-600 font-bold">Selecione uma conversa</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full" style={{ background:statusColor }} />
              <span className="text-xs text-zinc-600">WhatsApp: <strong className="text-zinc-400">{waStatus}</strong></span>
            </div>
          </div>
        )}

        {aba==='chat' && convAtiva && (
          <div className={`flex-1 flex flex-col overflow-hidden ${!mobileMostrarChat?'hidden lg:flex':''}`}>
            {/* Header */}
            <div className="px-4 py-2.5 flex items-center gap-2.5 shrink-0" style={{ borderBottom:'1px solid var(--hairline)' }}>
              <button onClick={()=>{setMobileMostrarChat(false);setConvAtiva(null);}} className="lg:hidden text-zinc-500 mr-1 flex items-center"><ArrowLeft size={20} strokeWidth={1.75} /></button>
              <Avatar nome={convAtiva.nome||convAtiva.telefone} size={34} />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white text-sm truncate">{convAtiva.nome||convAtiva.telefone}</div>
                <div className="text-[10px] text-zinc-600">+{convAtiva.telefone}</div>
              </div>
              {/* Tags */}
              <div className="relative">
                <button onClick={()=>setMostrarTags(p=>!p)} className="px-2 py-1.5 rounded-xl text-[11px] font-bold transition-all" style={{ background:'var(--space-elev-2)', border:'1px solid var(--hairline-strong)', color:'var(--txt-dim)' }} title="Tags"><Tag size={15} strokeWidth={1.75} /></button>
                {mostrarTags && (
                  <div className="absolute right-0 top-9 z-50 rounded-2xl p-3 w-52 space-y-1.5" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline-strong)', boxShadow:'0 8px 32px #000' }}>
                    <div className="text-[10px] text-zinc-600 font-bold mb-2">ETIQUETAS</div>
                    {TAGS_OPCOES.map(tag => {
                      const ativo = JSON.parse(convAtiva.tags||'[]').includes(tag.id);
                      return <button key={tag.id} onClick={()=>toggleTag(convAtiva,tag.id)} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl transition-all text-left" style={{ background:ativo?`${tag.color}15`:'transparent' }}>
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background:tag.color }} />
                        <span className="text-xs" style={{ color:ativo?tag.color:'var(--txt)' }}>{tag.label}</span>
                        {ativo && <span className="ml-auto flex items-center" style={{ color:tag.color }}><Check size={12} strokeWidth={2.5} /></span>}
                      </button>;
                    })}
                  </div>
                )}
              </div>
              {/* Pedidos */}
              {pedidosCliente.length>0 && (
                <button onClick={()=>setMostrarPedidos(p=>!p)} className="px-2 py-1.5 rounded-xl text-[11px] font-bold transition-all" style={{ background:mostrarPedidos?'rgba(var(--accent-rgb),0.12)':'var(--space-elev-2)', border:mostrarPedidos?'1px solid rgba(var(--accent-rgb),0.3)':'1px solid var(--hairline-strong)', color:mostrarPedidos?'var(--accent)':'var(--txt-dim)' }} title="Pedidos do cliente">
                  <span className="flex items-center gap-1"><Package size={13} strokeWidth={1.75} /> {pedidosCliente.length}</span>
                </button>
              )}
              {/* Assumir */}
              <button onClick={()=>assumirConversa(convAtiva)}
                className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-all"
                style={convAtiva.assumida?{background:'rgba(var(--accent-rgb),0.12)',border:'1px solid rgba(var(--accent-rgb),0.3)',color:'var(--accent)'}:{background:'var(--space-elev-2)',border:'1px solid var(--hairline-strong)',color:'var(--txt-dim)'}}>
                <span className="flex items-center gap-1.5">{convAtiva.assumida?<><Hand size={13} strokeWidth={1.75} /> Você</>:<><Bot size={13} strokeWidth={1.75} /> IA</>}</span>
              </button>
              {/* Arquivar */}
              <button onClick={()=>arquivar(convAtiva)} className="w-8 h-8 rounded-xl flex items-center justify-center transition-all" style={{ background:'var(--space-elev-2)', border:'1px solid var(--hairline-strong)', color:'var(--txt-dim)' }} title="Arquivar"><Folder size={15} strokeWidth={1.75} /></button>
            </div>

            {/* Histórico de pedidos */}
            {mostrarPedidos && pedidosCliente.length>0 && (
              <div className="px-4 py-3 space-y-2 shrink-0" style={{ borderBottom:'1px solid var(--hairline)', background:'var(--space-surface)' }}>
                <div className="text-[10px] text-zinc-600 font-bold tracking-widest flex items-center gap-1.5"><Package size={12} strokeWidth={1.75} /> PEDIDOS ANTERIORES</div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {pedidosCliente.map(p => (
                    <div key={p.id} className="shrink-0 rounded-xl px-3 py-2 min-w-[160px]" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white">#{p.numero}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: p.status==='entregue'?'#16a34a20':p.status==='cancelado'?'#ef444420':'var(--accent)20', color: p.status==='entregue'?'#22c55e':p.status==='cancelado'?'#ef4444':'var(--accent)' }}>{p.status}</span>
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-1 truncate">{p.itens||'—'}</div>
                      <div className="text-xs font-bold text-orange-400 mt-0.5">R$ {Number(p.total||0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5" style={{ background:'var(--space-base)' }}>
              {mensagens.length===0 && <div className="text-center text-xs mt-10" style={{ color:'var(--txt-faint)' }}>Nenhuma mensagem ainda</div>}
              {mensagens.map((msg,i) => {
                const minha = msg.de_mim===1;
                // Cliente = bolha neutra (esquerda). Você = bolha na cor da marca.
                // IA = bolha verde (distingue resposta automática). Direita.
                const estilo = !minha
                  ? { background:'var(--space-elev)', color:'var(--txt-strong)', border:'1px solid var(--hairline)' }
                  : msg.ia
                    ? { background:'rgba(16,185,129,0.14)', color:'#6ee7b7', border:'1px solid rgba(16,185,129,0.28)' }
                    : { background:'rgba(var(--accent-rgb),0.16)', color:'var(--txt-strong)', border:'1px solid rgba(var(--accent-rgb),0.35)' };
                return (
                  <div key={msg.id||i} className={`flex ${minha?'justify-end':'justify-start'}`}>
                    <div className="max-w-[78%]">
                      <div className="px-3.5 py-2 text-[13.5px] leading-relaxed"
                        style={{ ...estilo, borderRadius:minha?'16px 16px 4px 16px':'16px 16px 16px 4px', whiteSpace:'pre-wrap', boxShadow:'0 1px 2px rgba(0,0,0,0.25)' }}>
                        {msg.corpo}
                      </div>
                      <div className={`flex items-center gap-1.5 mt-1 px-1 ${minha?'justify-end':'justify-start'}`}>
                        {msg.ia===1 && <span className="text-[9px] font-bold flex items-center gap-0.5" style={{ color:'#34d399' }}><Bot size={10} strokeWidth={2} /> IA</span>}
                        <span className="text-[10px]" style={{ color:'var(--txt-faint)' }}>{formatTime(msg.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={fimRef} />
            </div>

            {/* Sugestão IA */}
            {sugestao && (
              <div className="mx-4 mb-2 p-3 rounded-xl shrink-0" style={{ background:'rgba(14,165,233,0.08)', border:'1px solid rgba(14,165,233,0.2)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div><div className="text-[10px] text-sky-500 font-bold mb-1 flex items-center gap-1"><Bot size={12} strokeWidth={1.75} /> Sugestão da IA</div><div className="text-sm text-sky-100">{sugestao}</div></div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={()=>{setTexto(sugestao);setSugestao('');setTimeout(()=>inputRef.current?.focus(),50);}} className="px-2.5 py-1 rounded-lg text-[11px] font-bold" style={{ background:'rgba(14,165,233,0.2)', color:'#0ea5e9' }}>Usar</button>
                    <button onClick={()=>setSugestao('')} className="px-2 py-1 rounded-lg flex items-center justify-center" style={{ color:'var(--txt-dim)' }}><X size={13} strokeWidth={2} /></button>
                  </div>
                </div>
              </div>
            )}

            {/* Respostas rápidas popup */}
            {mostrarRespostasRapidas && respostasRapidas.length>0 && (
              <div className="mx-4 mb-2 rounded-2xl overflow-hidden shrink-0" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline-strong)', maxHeight:200, overflowY:'auto' }}>
                <div className="px-3 py-2 text-[10px] text-zinc-600 font-bold tracking-widest border-b flex items-center gap-1.5" style={{ borderColor:'var(--hairline)' }}><Zap size={11} strokeWidth={1.75} /> RESPOSTAS RÁPIDAS</div>
                {respostasRapidas.map(rr => (
                  <button key={rr.id} onClick={()=>usarRespostaRapida(rr)} className="w-full px-3 py-2.5 text-left hover:bg-white/[0.03] transition-all border-b" style={{ borderColor:'var(--hairline)' }}>
                    <div className="text-xs font-bold text-white">{rr.titulo} {rr.atalho && <span className="text-zinc-600 font-normal ml-1">{rr.atalho}</span>}</div>
                    <div className="text-[11px] text-zinc-500 truncate mt-0.5">{rr.corpo}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form onSubmit={enviar} className="px-3 py-3 flex items-end gap-2 shrink-0" style={{ borderTop:'1px solid var(--hairline)' }}>
              <button type="button" onClick={()=>setMostrarRespostasRapidas(p=>!p)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 transition-all"
                style={{ background:mostrarRespostasRapidas?'rgba(var(--accent-rgb),0.12)':'var(--space-elev-2)', border:mostrarRespostasRapidas?'1px solid rgba(var(--accent-rgb),0.3)':'1px solid var(--hairline-strong)', color:mostrarRespostasRapidas?'var(--accent)':'var(--txt-dim)' }}
                title="Respostas rápidas"><Zap size={16} strokeWidth={1.75} /></button>
              <button type="button" onClick={pedirSugestao} disabled={buscandoSugestao}
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all"
                style={{ background:'rgba(14,165,233,0.1)', border:'1px solid rgba(14,165,233,0.2)', color:'#0ea5e9' }}
                title="Sugerir com IA">
                {buscandoSugestao?<RefreshCw size={15} strokeWidth={1.75} className="animate-spin" />:<Bot size={16} strokeWidth={1.75} />}
              </button>
              <textarea ref={inputRef} value={texto} onChange={e=>setTexto(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();enviar();}}}
                placeholder="Digite... (Enter envia, Shift+Enter nova linha)"
                rows={Math.min(4, Math.max(1, texto.split('\n').length))}
                className="flex-1 px-3 py-2.5 rounded-2xl text-sm outline-none resize-none"
                style={{ ...IS, borderRadius:18, maxHeight:100, lineHeight:1.5 }} />
              <button type="submit" disabled={enviando||!texto.trim()}
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95"
                style={{ background:texto.trim()?'linear-gradient(135deg,var(--accent),var(--accent-2))':'var(--space-elev-2)', color:texto.trim()?'#000':'var(--txt-faint)' }}>
                {enviando?<RefreshCw size={16} strokeWidth={2} className="animate-spin" />:<Send size={16} strokeWidth={2} />}
              </button>
            </form>
          </div>
        )}

        {/* ── RESPOSTAS RÁPIDAS ── */}
        {aba==='respostas' && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="max-w-xl mx-auto space-y-4">
              <h2 className="text-white font-black text-lg flex items-center gap-2"><Zap size={20} strokeWidth={1.75} style={{ color:'var(--accent)' }} /> Respostas Rápidas</h2>
              <p className="text-xs text-zinc-600 flex items-center gap-1">Clique em <Zap size={12} strokeWidth={1.75} className="inline" /> no chat para usar. Economize tempo nas respostas mais comuns.</p>

              {/* Adicionar nova */}
              <div className="rounded-2xl p-4 space-y-3" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
                <div className="text-xs text-zinc-500 font-bold tracking-widest">+ NOVA RESPOSTA</div>
                <div className="flex gap-2">
                  <input value={novaResposta.titulo} onChange={e=>setNovaResposta(p=>({...p,titulo:e.target.value}))} placeholder="Título (ex: Prazo de entrega)" className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={IS} />
                  <input value={novaResposta.atalho} onChange={e=>setNovaResposta(p=>({...p,atalho:e.target.value}))} placeholder="/atalho" className="w-24 px-3 py-2 rounded-xl text-sm outline-none" style={IS} />
                </div>
                <textarea value={novaResposta.corpo} onChange={e=>setNovaResposta(p=>({...p,corpo:e.target.value}))} placeholder="Texto da resposta..." rows={3} className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={IS} />
                <button onClick={adicionarRespostaRapida} className="w-full py-2.5 rounded-xl font-bold text-sm transition-all" style={{ background:'linear-gradient(135deg,var(--accent),var(--accent-2))', color:'#000' }}>
                  + Adicionar
                </button>
              </div>

              {/* Lista */}
              <div className="space-y-2">
                {respostasRapidas.map(rr => (
                  <div key={rr.id} className="rounded-2xl p-4" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{rr.titulo}</span>
                          {rr.atalho && <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background:'var(--space-elev-2)', color:'var(--accent)' }}>{rr.atalho}</span>}
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">{rr.corpo}</p>
                      </div>
                      <button onClick={()=>excluirRespostaRapida(rr.id)} className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all hover:bg-red-500/10" style={{ color:'var(--txt-faint)' }}><Trash2 size={14} strokeWidth={1.75} /></button>
                    </div>
                  </div>
                ))}
                {respostasRapidas.length===0 && <p className="text-center text-zinc-700 text-xs py-8">Nenhuma resposta cadastrada ainda</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── BROADCAST ── */}
        {aba==='broadcast' && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="max-w-xl mx-auto space-y-4">
              <h2 className="text-white font-black text-lg flex items-center gap-2"><Megaphone size={20} strokeWidth={1.75} style={{ color:'var(--accent)' }} /> Broadcast</h2>
              <p className="text-xs text-zinc-600">Envie uma mensagem para vários clientes de uma vez. Use com moderação.</p>

              {/* Aviso anti-ban */}
              <div className="rounded-xl px-3 py-2 text-xs flex gap-2 items-start" style={{ background:'#1a1500', border:'1px solid #3a2a00', color:'#fbbf24' }}>
                <span className="shrink-0 flex items-center pt-0.5"><AlertTriangle size={13} strokeWidth={1.75} /></span>
                <span>Para evitar ban: prefira "Ativos esta semana", limite máximo 80/dia, e personalize com <code className="bg-black/30 px-1 rounded">{'{nome}'}</code> para não parecer spam.</span>
              </div>

              <div className="rounded-2xl p-4 space-y-3" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
                <div className="text-xs text-zinc-500 font-bold tracking-widest">NOVA MENSAGEM</div>
                <input value={broadcast.titulo} onChange={e=>setBroadcast(p=>({...p,titulo:e.target.value}))} placeholder="Título (interno, para controle)" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={IS} />
                <div className="relative">
                  <textarea value={broadcast.corpo} onChange={e=>setBroadcast(p=>({...p,corpo:e.target.value}))} placeholder={"Olá {nome}! Temos uma promoção especial hoje 🍣"} rows={5} className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ ...IS, lineHeight:1.6 }} />
                  <button onClick={()=>setBroadcast(p=>({...p,corpo:p.corpo+'  {nome}'}))} className="absolute bottom-2 right-2 text-[10px] px-2 py-1 rounded-lg font-bold transition-all hover:opacity-80" style={{ background:'var(--space-elev-2)', color:'var(--accent)', border:'1px solid var(--hairline-strong)' }}>+ {'{nome}'}</button>
                </div>

                <div>
                  <div className="text-xs text-zinc-600 mb-2">Enviar para:</div>
                  <div className="flex gap-2 flex-wrap">
                    {[['ativos_semana','Ativos 7 dias','Recomendado'],['ativos_mes','Ativos 30 dias',''],['todos','Todos','Risco']].map(([v,l,tag]) => (
                      <button key={v} onClick={()=>setBroadcast(p=>({...p,filtro:v}))}
                        className="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all text-left"
                        style={{ background:broadcast.filtro===v?'rgba(var(--accent-rgb),0.12)':'#161616', border:broadcast.filtro===v?'1px solid rgba(var(--accent-rgb),0.3)':'1px solid var(--hairline)', color:broadcast.filtro===v?'var(--accent)':'#666', minWidth:100 }}>
                        {l}{tag && <span className="block text-[10px] mt-0.5 opacity-70">{tag}</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-zinc-600 mb-1">Limite de envios: <span className="text-orange-400 font-bold">{broadcast.limite}</span> contatos</div>
                  <input type="range" min={10} max={200} step={10} value={broadcast.limite} onChange={e=>setBroadcast(p=>({...p,limite:parseInt(e.target.value)}))} className="w-full accent-orange-500" />
                  <div className="flex justify-between text-[10px] text-zinc-700 mt-0.5"><span>10</span><span className="text-yellow-600">80 rec.</span><span className="text-red-700">200 risco</span></div>
                </div>

                <div className="text-[11px] rounded-lg px-3 py-2" style={{ background:'var(--space-base)', color:'var(--txt-dim)' }}>
                  <span className="flex items-center gap-1">Delay: 3–8s aleatório entre envios · {broadcast.corpo.includes('{nome}') ? <><CheckCircle2 size={12} strokeWidth={1.75} className="text-green-500" /> Personalização ativa</> : <><AlertTriangle size={12} strokeWidth={1.75} className="text-amber-500" /> Sem personalização</>}</span>
                </div>

                <button onClick={enviarBroadcast} disabled={enviandoBroadcast||!broadcast.corpo.trim()}
                  className="w-full py-3 rounded-xl font-black text-sm transition-all"
                  style={{ background:enviandoBroadcast||!broadcast.corpo.trim()?'var(--space-elev-2)':'linear-gradient(135deg,var(--accent),var(--accent-2))', color:enviandoBroadcast||!broadcast.corpo.trim()?'var(--txt-faint)':'#000' }}>
                  {enviandoBroadcast?<span className="flex items-center justify-center gap-1.5"><RefreshCw size={15} strokeWidth={2} className="animate-spin" /> Enviando...</span>:<span className="flex items-center justify-center gap-1.5"><Megaphone size={15} strokeWidth={2} /> Enviar broadcast</span>}
                </button>
              </div>

              {/* Histórico */}
              {broadcasts.length>0 && (
                <div className="space-y-2">
                  <div className="text-xs text-zinc-600 font-bold tracking-widest">HISTÓRICO</div>
                  {broadcasts.map(b => (
                    <div key={b.id} className="rounded-2xl p-3" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{b.titulo||'Broadcast'}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background:b.status==='concluido'?'#16a34a20':'var(--accent)20', color:b.status==='concluido'?'#22c55e':'var(--accent)' }}>{b.status}</span>
                      </div>
                      <p className="text-xs text-zinc-600 mt-1 truncate">{b.corpo}</p>
                      <div className="text-[10px] text-zinc-700 mt-1">{b.enviados}/{b.total} enviados · {new Date(b.created_at).toLocaleDateString('pt-BR')}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MÉTRICAS ── */}
        {aba==='metricas' && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="max-w-2xl mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-white font-black text-lg flex items-center gap-2"><BarChart3 size={20} strokeWidth={1.75} style={{ color:'var(--accent)' }} /> Métricas</h2>
                <button onClick={carregarMetricas} className="text-xs text-zinc-500 hover:text-white transition-all flex items-center gap-1"><RefreshCw size={13} strokeWidth={1.75} /> Atualizar</button>
              </div>
              {!metricas ? (
                <div className="text-center text-zinc-700 py-10">Carregando...</div>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label:'Conversas hoje',      val: metricas.conversas_hoje,        Icon: MessageCircle, color:'var(--accent)' },
                      { label:'Mensagens hoje',       val: metricas.mensagens_hoje,        Icon: Mail,          color:'#0ea5e9' },
                      { label:'Respondidas pela IA',  val: metricas.respondidas_ia_hoje,   Icon: Bot,           color:'#22c55e' },
                      { label:'Não lidas',            val: metricas.nao_lidas_total,       Icon: Circle,        color:'#ef4444' },
                    ].map(m => (
                      <div key={m.label} className="rounded-2xl p-4" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
                        <div className="text-2xl font-black" style={{ color:m.color }}>{m.val||0}</div>
                        <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5"><m.Icon size={13} strokeWidth={1.75} /> {m.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl p-4 space-y-3" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
                    <div className="text-xs text-zinc-500 font-bold tracking-widest">ÚLTIMOS 7 DIAS</div>
                    <div className="flex items-end gap-1 h-24">
                      {metricas.por_dia?.map((d,i) => {
                        const max = Math.max(...metricas.por_dia.map(x=>x.total), 1);
                        const h = Math.max(4, Math.round((d.total/max)*88));
                        const hia = Math.max(0, Math.round((d.ia/max)*88));
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.dia}: ${d.total} msgs (${d.ia} IA)`}>
                            <div className="w-full relative flex items-end justify-center" style={{ height:88 }}>
                              <div className="absolute bottom-0 w-full rounded-t-lg opacity-30" style={{ height:h, background:'var(--accent)' }} />
                              <div className="absolute bottom-0 w-full rounded-t-lg" style={{ height:hia, background:'var(--accent)' }} />
                            </div>
                            <span className="text-[8px] text-zinc-700">{d.dia?.slice(5)}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-4 text-[10px] text-zinc-600">
                      <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background:'var(--accent)' }} />Total</span>
                      <span><span className="inline-block w-2 h-2 rounded-full mr-1 opacity-30" style={{ background:'var(--accent)' }} />IA</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl p-4" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
                      <div className="text-2xl font-black text-white">{metricas.mensagens_semana||0}</div>
                      <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5"><Mail size={13} strokeWidth={1.75} /> Mensagens na semana</div>
                    </div>
                    <div className="rounded-2xl p-4" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
                      <div className="text-2xl font-black text-white">{metricas.total_conversas||0}</div>
                      <div className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5"><Users size={13} strokeWidth={1.75} /> Total de contatos</div>
                    </div>
                  </div>
                  {metricas.mensagens_semana > 0 && (
                    <div className="rounded-2xl p-4" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
                      <div className="text-xs text-zinc-500 font-bold tracking-widest mb-2">TAXA DE AUTOMAÇÃO</div>
                      <div className="w-full rounded-full h-3" style={{ background:'var(--space-elev-2)' }}>
                        <div className="h-3 rounded-full transition-all" style={{ width:`${Math.round((metricas.respondidas_ia_semana/metricas.mensagens_semana)*100)}%`, background:'linear-gradient(90deg,var(--accent),var(--accent-2))' }} />
                      </div>
                      <div className="text-sm font-black text-orange-400 mt-2">{Math.round((metricas.respondidas_ia_semana/metricas.mensagens_semana)*100)}% respondido pela IA</div>
                    </div>
                  )}
                  <div className="rounded-2xl p-4" style={{ background:'#0a1a0a', border:'1px solid #1a2e1a' }}>
                    <div className="text-xs font-bold tracking-widest mb-3 flex items-center gap-1.5" style={{ color:'#4ade80' }}><DollarSign size={13} strokeWidth={1.75} /> CUSTO ESTIMADO IA (Claude Haiku)</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-lg font-black text-white">R$ {((metricas.custo_estimado_hoje_usd||0)*5.5).toFixed(3)}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">Hoje</div>
                      </div>
                      <div>
                        <div className="text-lg font-black text-white">~{Math.round(metricas.media_ia_por_dia||0)}/dia</div>
                        <div className="text-xs text-zinc-500 mt-0.5">Média IA</div>
                      </div>
                      <div>
                        <div className="text-lg font-black" style={{ color:'#4ade80' }}>≈ R$ {((metricas.custo_estimado_mensal_brl)||0).toFixed(2)}/mês</div>
                        <div className="text-xs text-zinc-500 mt-0.5">Projeção mensal</div>
                      </div>
                    </div>
                    <div className="text-xs text-zinc-600 mt-2">Haiku 4.5 · $1/M input · $5/M output · ~200 tokens/resposta</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── TREINAMENTO ── */}
        {aba==='treinamento' && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="max-w-2xl mx-auto space-y-4">
              <div>
                <h2 className="text-white font-black text-lg flex items-center gap-2"><Brain size={20} strokeWidth={1.75} style={{ color:'var(--accent)' }} /> Treinar o Bot</h2>
                <p className="text-xs text-zinc-500 mt-1">Ensine o bot a responder do jeito da sua empresa. Quanto mais exemplos, mais preciso ele fica.</p>
              </div>

              {/* Novo exemplo */}
              <div className="rounded-2xl p-4 space-y-3" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
                <div className="text-xs text-zinc-500 font-bold tracking-widest">+ NOVO EXEMPLO</div>
                {/* Categoria */}
                <div className="flex gap-2 flex-wrap">
                  {['geral','pedido','cardapio','pagamento','horario','entrega','reclamacao'].map(cat => (
                    <button key={cat} onClick={() => setNovoExemplo(p=>({...p,categoria:cat}))}
                      className="px-3 py-1 rounded-full text-[11px] font-bold transition-all capitalize"
                      style={{ background:novoExemplo.categoria===cat?'rgba(var(--accent-rgb),0.15)':'#161616', border:novoExemplo.categoria===cat?'1px solid rgba(var(--accent-rgb),0.4)':'1px solid var(--hairline)', color:novoExemplo.categoria===cat?'var(--accent)':'var(--txt-dim)' }}>
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="text-[10px] text-zinc-600 mb-1 flex items-center gap-1"><User size={11} strokeWidth={1.75} /> CLIENTE PERGUNTA</div>
                    <textarea value={novoExemplo.pergunta} onChange={e=>setNovoExemplo(p=>({...p,pergunta:e.target.value}))}
                      placeholder="Ex: Vocês entregam no bairro X?" rows={2}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={IS} />
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-600 mb-1 flex items-center gap-1"><Bot size={11} strokeWidth={1.75} /> BOT RESPONDE</div>
                    <textarea value={novoExemplo.resposta} onChange={e=>setNovoExemplo(p=>({...p,resposta:e.target.value}))}
                      placeholder="Ex: Sim! Entregamos em toda a cidade. É só fazer seu pedido pelo cardápio online." rows={3}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={IS} />
                  </div>
                </div>
                <button onClick={adicionarExemplo}
                  className="w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95"
                  style={{ background:'linear-gradient(135deg,var(--accent),var(--accent-2))', color:'#000' }}>
                  + Adicionar exemplo
                </button>
              </div>

              {/* Filtro por categoria */}
              <div className="flex gap-2 flex-wrap">
                {['todas','geral','pedido','cardapio','pagamento','horario','entrega','reclamacao'].map(cat => {
                  const count = cat==='todas' ? exemplos.length : exemplos.filter(e=>e.categoria===cat).length;
                  if (count===0 && cat!=='todas') return null;
                  return (
                    <button key={cat} onClick={()=>setFiltroCategoria(cat)}
                      className="px-3 py-1 rounded-full text-[11px] font-bold transition-all capitalize"
                      style={{ background:filtroCategoria===cat?'rgba(var(--accent-rgb),0.15)':'var(--space-elev)', border:filtroCategoria===cat?'1px solid rgba(var(--accent-rgb),0.4)':'1px solid var(--hairline)', color:filtroCategoria===cat?'var(--accent)':'var(--txt-dim)' }}>
                      {cat} <span className="opacity-50">({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Lista de exemplos */}
              <div className="space-y-2">
                {exemplos.filter(e => filtroCategoria==='todas' || e.categoria===filtroCategoria).map(ex => (
                  <div key={ex.id} className="rounded-2xl p-4 transition-all" style={{ background:'var(--space-elev)', border:`1px solid ${ex.ativo?'#1e1e1e':'#ff000020'}`, opacity: ex.ativo?1:0.5 }}>
                    {editandoExemplo?.id===ex.id ? (
                      <div className="space-y-2">
                        <textarea value={editandoExemplo.pergunta} onChange={e=>setEditandoExemplo(p=>({...p,pergunta:e.target.value}))} rows={2} className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={IS} />
                        <textarea value={editandoExemplo.resposta} onChange={e=>setEditandoExemplo(p=>({...p,resposta:e.target.value}))} rows={3} className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={IS} />
                        <div className="flex gap-2">
                          <button onClick={()=>salvarExemplo(editandoExemplo)} className="flex-1 py-2 rounded-xl text-xs font-bold" style={{ background:'linear-gradient(135deg,var(--accent),var(--accent-2))', color:'#000' }}>Salvar</button>
                          <button onClick={()=>setEditandoExemplo(null)} className="px-4 py-2 rounded-xl text-xs" style={{ background:'var(--space-elev-2)', color:'var(--txt-dim)' }}>Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ background:'var(--space-elev-2)', color:'var(--txt-dim)' }}>{ex.categoria}</span>
                            {!ex.ativo && <span className="text-[9px] text-red-500">desativado</span>}
                          </div>
                          <div className="rounded-xl px-3 py-2 text-sm" style={{ background:'var(--space-surface)', border:'1px solid var(--hairline)' }}>
                            <span className="text-zinc-500 inline-flex items-center align-middle mr-1"><User size={11} strokeWidth={1.75} /></span>
                            <span className="text-zinc-300">{ex.pergunta}</span>
                          </div>
                          <div className="rounded-xl px-3 py-2 text-sm" style={{ background:'#1a2a1a', border:'1px solid #16a34a22' }}>
                            <span className="text-zinc-500 inline-flex items-center align-middle mr-1"><Bot size={11} strokeWidth={1.75} /></span>
                            <span className="text-green-200">{ex.resposta}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <button onClick={()=>setEditandoExemplo({...ex})} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/5" style={{ color:'var(--txt-dim)' }} title="Editar"><Pencil size={13} strokeWidth={1.75} /></button>
                          <button onClick={()=>toggleExemplo(ex)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/5" style={{ color: ex.ativo?'#22c55e':'var(--txt-dim)' }} title={ex.ativo?'Desativar':'Ativar'}>{ex.ativo?<Eye size={13} strokeWidth={1.75} />:<EyeOff size={13} strokeWidth={1.75} />}</button>
                          <button onClick={()=>excluirExemplo(ex.id)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-red-500/10" style={{ color:'var(--txt-faint)' }} title="Excluir"><Trash2 size={13} strokeWidth={1.75} /></button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {exemplos.length===0 && <p className="text-center text-zinc-700 text-xs py-8">Nenhum exemplo ainda. Adicione acima para treinar o bot.</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIG ── */}
        {aba==='config' && (
          <div className="flex-1 overflow-y-auto p-5">
            <div className="max-w-xl mx-auto space-y-4">
              <h2 className="text-white font-black text-lg flex items-center gap-2"><Settings size={20} strokeWidth={1.75} style={{ color:'var(--accent)' }} /> Configurações</h2>

              <div className="rounded-2xl p-4" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-bold text-sm flex items-center gap-1.5"><Bot size={15} strokeWidth={1.75} /> Respostas automáticas</div>
                    <div className="text-xs text-zinc-500 mt-0.5">IA responde os clientes automaticamente</div>
                  </div>
                  <button onClick={()=>setConfig(p=>({...p,ia_global:p.ia_global?0:1}))} className="w-12 h-6 rounded-full transition-all relative shrink-0" style={{ background:config.ia_global?'var(--accent)':'#252525', border:'1px solid var(--hairline-strong)' }}>
                    <div className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all" style={{ left:config.ia_global?'calc(100% - 22px)':2 }} />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl p-4 space-y-3" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
                <div className="text-xs text-zinc-500 font-bold tracking-widest flex items-center gap-1.5"><Drama size={13} strokeWidth={1.75} /> TOM DO BOT</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id:'formal',    Icon: Handshake,    label:'Formal',    desc:'Profissional' },
                    { id:'amigavel',  Icon: Smile,        label:'Amigável',  desc:'Simpático'    },
                    { id:'divertido', Icon: PartyPopper,  label:'Divertido', desc:'Descontraído' },
                  ].map(tom => {
                    const prompts = {
                      formal:    `Você é o atendente virtual de um restaurante de sushi. Seja profissional, objetivo e cordial. Use no máximo 1 emoji por mensagem — em muitas respostas não use nenhum. Respostas curtas, máximo 3 linhas. Quando o cliente quiser o cardápio ou fazer pedido, envie: {LINK_CARDAPIO}. Nunca invente preços.`,
                      amigavel:  `Você é o atendente do nosso restaurante de sushi! Seja simpático e atencioso, como um atendente humano. Use no máximo 1 emoji por mensagem. Respostas curtas e diretas, máximo 3 linhas. Quando o cliente quiser ver o cardápio ou pedir, manda: {LINK_CARDAPIO}. Nunca invente preços.`,
                      divertido: `Você é o atendente do restaurante de sushi! Seja descontraído e animado, mas sem exagerar. Use no máximo 2 emojis por mensagem. Respostas curtas, máximo 3 linhas. Para cardápio e pedidos: {LINK_CARDAPIO}. Nunca invente preços.`,
                    };
                    const ativo = config.prompt_sistema===prompts[tom.id];
                    return <button key={tom.id} onClick={()=>setConfig(p=>({...p,prompt_sistema:prompts[tom.id]}))}
                      className="p-3 rounded-xl text-left transition-all"
                      style={{ background:ativo?'rgba(var(--accent-rgb),0.12)':'#161616', border:ativo?'1px solid rgba(var(--accent-rgb),0.4)':'1px solid var(--hairline)' }}>
                      <div className="text-xs font-bold flex items-center gap-1.5" style={{ color:ativo?'var(--accent)':'#aaa' }}><tom.Icon size={13} strokeWidth={1.75} /> {tom.label}</div>
                      <div className="text-[10px] text-zinc-600 mt-0.5">{tom.desc}</div>
                    </button>;
                  })}
                </div>
              </div>

              <div className="rounded-2xl p-4 space-y-3" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-zinc-500 font-bold tracking-widest flex items-center gap-1.5"><Pencil size={12} strokeWidth={1.75} /> INSTRUÇÃO PERSONALIZADA</div>
                  <span className="text-[10px] text-zinc-700">opcional</span>
                </div>
                <textarea value={config.prompt_sistema||''} onChange={e=>setConfig(p=>({...p,prompt_sistema:e.target.value}))} rows={7}
                  placeholder="Escreva as instruções do bot. Use {LINK_CARDAPIO} para inserir o link do cardápio automaticamente."
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none" style={{ ...IS, lineHeight:1.6 }} />
                <div className="flex gap-2 items-center">
                  <button onClick={()=>setConfig(p=>({...p,prompt_sistema:(p.prompt_sistema||'')+'{LINK_CARDAPIO}'}))}
                    className="px-2 py-1 rounded-lg text-[10px] font-mono transition-all" style={{ background:'var(--space-elev-2)', border:'1px solid var(--hairline)', color:'var(--accent)' }}>
                    {'{LINK_CARDAPIO}'}
                  </button>
                  <span className="text-[10px] text-zinc-700 flex items-center gap-1"><ArrowLeft size={11} strokeWidth={1.75} /> clique para inserir</span>
                </div>
              </div>

              <div className="rounded-2xl p-4 space-y-3" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
                <div className="text-xs text-zinc-500 font-bold tracking-widest flex items-center gap-1.5"><Clock size={12} strokeWidth={1.75} /> HORÁRIO DE ATENDIMENTO</div>
                <input value={config.horario_atendimento||''} onChange={e=>setConfig(p=>({...p,horario_atendimento:e.target.value}))} placeholder="Ex: 08:00-22:00" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={IS} />
                <div className="text-xs text-zinc-600">Mensagem fora do horário:</div>
                <textarea value={config.mensagem_fora_horario||''} onChange={e=>setConfig(p=>({...p,mensagem_fora_horario:e.target.value}))} rows={2} className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={IS} />
              </div>

              <div className="rounded-2xl p-4 space-y-3" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
                <div className="text-xs text-zinc-500 font-bold tracking-widest flex items-center gap-1.5"><Hand size={12} strokeWidth={1.75} /> PRIMEIRA MENSAGEM</div>
                <textarea value={config.mensagem_boas_vindas||''} onChange={e=>setConfig(p=>({...p,mensagem_boas_vindas:e.target.value}))} rows={2} className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={IS} />
              </div>

              <button onClick={salvarConfig} disabled={salvandoCfg}
                className="w-full py-3 rounded-2xl font-black text-sm transition-all active:scale-95"
                style={{ background:salvandoCfg?'var(--space-elev-2)':'linear-gradient(135deg,var(--accent),var(--accent-2))', color:salvandoCfg?'var(--txt-dim)':'#000' }}>
                {salvandoCfg?<span className="flex items-center justify-center gap-1.5"><RefreshCw size={15} strokeWidth={2} className="animate-spin" /> Salvando...</span>:<span className="flex items-center justify-center gap-1.5"><Save size={15} strokeWidth={2} /> Salvar</span>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
