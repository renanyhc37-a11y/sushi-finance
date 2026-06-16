import React, { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { getToken } from '../hooks/useAuth';
import {
  Users, Fish, Gift, Search, RefreshCw, Star, Sparkles, Repeat, Crown, MoonStar,
  Smartphone, MapPin, X, Target, CheckCircle2, Cake, TrendingUp, TrendingDown,
  Minus, Clock, Calendar, CreditCard, ShoppingBag, Bike, BarChart2, Award,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '/api';
const diasDesde = d => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 9999;
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const authH = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

function Selos({ atual, total = 10 }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="w-5 h-5 rounded flex items-center justify-center text-[10px]"
          style={{
            background: i < atual ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${i < atual ? 'rgba(139,92,246,0.7)' : 'rgba(255,255,255,0.06)'}`,
          }}>
          {i < atual ? <Fish size={11} strokeWidth={1.75} className="text-violet-200" /> : ''}
        </div>
      ))}
    </div>
  );
}

function BarraProgresso({ progresso, meta, cor = '#10b981' }) {
  const pct = Math.min(100, Math.round((progresso / meta) * 100));
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', height: 6 }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cor }} />
    </div>
  );
}

const SEGMENTO_CFG = {
  fiel:       { label: 'Cliente Fiel',   cor: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  Icon: Crown },
  recorrente: { label: 'Recorrente',     cor: '#10b981', bg: 'rgba(16,185,129,0.1)',   Icon: Repeat },
  regular:    { label: 'Regular',        cor: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   Icon: Star },
  novo:       { label: 'Novo cliente',   cor: '#8b5cf6', bg: 'rgba(139,92,246,0.1)',   Icon: Sparkles },
  em_risco:   { label: 'Em risco',       cor: '#f97316', bg: 'rgba(249,115,22,0.1)',   Icon: TrendingDown },
  inativo:    { label: 'Inativo',        cor: '#6b7280', bg: 'rgba(107,114,128,0.1)',  Icon: MoonStar },
};

const PGTO_LABEL = { pix: 'PIX', dinheiro: 'Dinheiro', cartao_cred: 'Crédito', cartao_deb: 'Débito' };

function MiniBar({ valor, max, cor }) {
  const pct = max > 0 ? Math.round((valor / max) * 100) : 0;
  return (
    <div className="flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)', height: 5 }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor, transition: 'width .4s' }} />
    </div>
  );
}

function ModalCliente({ cliente, onClose, onResgatar }) {
  const [dados, setDados] = useState(null);
  const [promocoes, setPromocoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resgatando, setResgatando] = useState(null);
  const [aba, setAba] = useState('perfil'); // 'perfil' | 'historico' | 'fidelidade'

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/clientes/${cliente.id}/perfil`, { headers: authH() }).then(r => r.ok ? r.json() : null),
      fetch(`${BASE}/promocoes/cliente/${cliente.id}`, { headers: authH() }).then(r => r.ok ? r.json() : []),
    ]).then(([d, pr]) => { setDados(d); setPromocoes(pr); setLoading(false); })
      .catch(() => setLoading(false));
  }, [cliente.id]);

  async function resgatarPromocao(cp) {
    setResgatando(cp.id);
    try {
      const r = await fetch(`${BASE}/promocoes/resgatar/${cp.id}`, { method: 'POST', headers: authH() });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro');
      toast.success(`🎁 ${cp.recompensa} resgatado!`);
      setPromocoes(prev => prev.map(p => p.id === cp.id ? { ...p, recompensa_resgatada: 1, progresso: 0, completado: 0 } : p));
    } catch (e) { toast.error(e.message); }
    setResgatando(null);
  }

  async function handleResgatar() {
    const fid = dados?.cliente?.fidelidade;
    if (!fid || fid.recompensas_disponiveis <= 0) return;
    setResgatando('fid');
    try {
      const res = await fetch(`${BASE}/clientes/${cliente.id}/resgatar`, { method: 'POST', headers: authH() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Erro');
      toast.success('🎁 Brinde resgatado com sucesso!');
      onResgatar(data.cliente);
      setDados(prev => ({ ...prev, cliente: { ...prev.cliente, ...data.cliente } }));
    } catch (err) { toast.error(err.message); }
    setResgatando(null);
  }

  const perfil = dados?.perfil;
  const fid = dados?.cliente?.fidelidade || cliente.fidelidade;
  const pedidos = dados?.pedidos || [];
  const seg = perfil ? (SEGMENTO_CFG[perfil.segmento] || SEGMENTO_CFG.novo) : null;
  const maxDiaSemana = perfil ? Math.max(...perfil.diasSemana.map(d => d.pedidos)) : 1;
  const maxItem = perfil?.itensFavoritos?.[0]?.qtd || 1;
  const maxMes = perfil ? Math.max(...perfil.evolucaoMensal.map(m => m.gasto)) : 1;

  const ABAS = [
    { id: 'perfil',    label: 'Perfil' },
    { id: 'historico', label: 'Pedidos' },
    { id: 'fidelidade',label: 'Fidelidade' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
        style={{ background: 'var(--space-surface)', border: '1px solid var(--hairline)', maxHeight: '92vh' }}>

        {/* Header */}
        <div className="shrink-0 px-5 py-4" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shrink-0"
              style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
              {cliente.nome.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-black t-strong text-lg leading-none">{cliente.nome}</p>
                {seg && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ background: seg.bg, color: seg.cor }}>
                    <seg.Icon size={9} strokeWidth={2.5} /> {seg.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs t-dim flex items-center gap-1"><Smartphone size={11} /> {cliente.telefone}</span>
                {cliente.endereco && <span className="text-xs t-dim flex items-center gap-1 truncate max-w-[180px]"><MapPin size={11} /> {cliente.endereco}</span>}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl t-dim shrink-0"
              style={{ background: 'var(--space-elev-2)' }}><X size={16} /></button>
          </div>

          {/* Abas */}
          <div className="flex gap-1 mt-3">
            {ABAS.map(a => (
              <button key={a.id} onClick={() => setAba(a.id)}
                className="flex-1 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{
                  background: aba === a.id ? 'rgba(var(--accent-rgb),0.15)' : 'var(--space-elev)',
                  color: aba === a.id ? 'var(--accent)' : 'var(--txt-dim)',
                  border: `1px solid ${aba === a.id ? 'rgba(var(--accent-rgb),0.3)' : 'transparent'}`,
                }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Corpo */}
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">
          {loading ? (
            <div className="py-16 text-center t-dim text-sm animate-pulse">Carregando perfil…</div>
          ) : !perfil ? (
            <div className="py-16 text-center t-dim text-sm">Nenhum pedido registrado ainda.</div>
          ) : (

            /* ── ABA PERFIL ── */
            aba === 'perfil' ? (<>

              {/* KPIs principais */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Total gasto',   val: brl(perfil.totalGasto),              cor: '#10b981', Icon: TrendingUp },
                  { label: 'Ticket médio',  val: brl(perfil.ticketMedio),             cor: 'var(--accent)', Icon: BarChart2 },
                  { label: 'Pedidos',       val: perfil.totalPedidos,                 cor: '#3b82f6', Icon: CheckCircle2 },
                  { label: 'Últ. pedido',   val: `${perfil.diasDesdeUltimo}d atrás`,  cor: perfil.diasDesdeUltimo > 30 ? '#ef4444' : '#10b981', Icon: Clock },
                ].map(({ label, val, cor, Icon }) => (
                  <div key={label} className="p-3 rounded-2xl"
                    style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={12} strokeWidth={1.75} style={{ color: cor }} />
                      <span className="text-[10px] font-bold t-dim uppercase tracking-wider">{label}</span>
                    </div>
                    <p className="text-base font-black t-strong">{val}</p>
                  </div>
                ))}
              </div>

              {/* Tendência + intervalo */}
              <div className="flex gap-2">
                <div className="flex-1 p-3 rounded-2xl flex items-center gap-3"
                  style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  {perfil.tendencia === 'subindo'
                    ? <TrendingUp size={20} style={{ color: '#10b981' }} strokeWidth={1.75} />
                    : perfil.tendencia === 'caindo'
                      ? <TrendingDown size={20} style={{ color: '#ef4444' }} strokeWidth={1.75} />
                      : <Minus size={20} style={{ color: '#6b7280' }} strokeWidth={1.75} />}
                  <div>
                    <p className="text-[10px] font-bold t-dim uppercase tracking-wider">Tendência</p>
                    <p className="text-sm font-black" style={{ color: perfil.tendencia === 'subindo' ? '#10b981' : perfil.tendencia === 'caindo' ? '#ef4444' : '#6b7280' }}>
                      {perfil.tendencia === 'subindo' ? 'Crescendo' : perfil.tendencia === 'caindo' ? 'Caindo' : 'Estável'}
                    </p>
                  </div>
                </div>
                {perfil.intervaloMedio && (
                  <div className="flex-1 p-3 rounded-2xl flex items-center gap-3"
                    style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                    <Calendar size={20} strokeWidth={1.75} style={{ color: '#8b5cf6' }} />
                    <div>
                      <p className="text-[10px] font-bold t-dim uppercase tracking-wider">Frequência</p>
                      <p className="text-sm font-black t-strong">a cada {perfil.intervaloMedio}d</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Dias da semana */}
              <div className="p-4 rounded-2xl space-y-2"
                style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase tracking-wider t-dim">Dias da semana</p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)' }}>
                    prefere {perfil.diaCampeao}
                  </span>
                </div>
                <div className="flex items-end gap-1 h-16">
                  {perfil.diasSemana.map(({ dia, pedidos: qt }) => {
                    const pct = maxDiaSemana > 0 ? (qt / maxDiaSemana) * 100 : 0;
                    const ativo = dia === perfil.diaCampeao;
                    return (
                      <div key={dia} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t-md" style={{ height: `${Math.max(4, pct * 0.52)}px`, background: ativo ? 'var(--accent)' : 'rgba(255,255,255,0.08)', transition: 'height .3s' }} />
                        <span className="text-[9px] font-bold" style={{ color: ativo ? 'var(--accent)' : 'var(--txt-dim)' }}>{dia}</span>
                        {qt > 0 && <span className="text-[9px] t-dim">{qt}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Horário favorito + Pagamento + Entrega */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-2xl text-center"
                  style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  <Clock size={16} strokeWidth={1.75} className="mx-auto mb-1" style={{ color: '#f59e0b' }} />
                  <p className="text-[10px] t-dim font-bold">Horário</p>
                  <p className="text-sm font-black t-strong mt-0.5">{String(perfil.horaCampeao).padStart(2,'0')}h</p>
                </div>
                <div className="p-3 rounded-2xl text-center"
                  style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  <CreditCard size={16} strokeWidth={1.75} className="mx-auto mb-1" style={{ color: '#3b82f6' }} />
                  <p className="text-[10px] t-dim font-bold">Pagamento</p>
                  <p className="text-sm font-black t-strong mt-0.5">{PGTO_LABEL[perfil.pgtoFavorito] || perfil.pgtoFavorito || '—'}</p>
                </div>
                <div className="p-3 rounded-2xl text-center"
                  style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  {perfil.retiradas > perfil.entregas
                    ? <ShoppingBag size={16} strokeWidth={1.75} className="mx-auto mb-1" style={{ color: '#8b5cf6' }} />
                    : <Bike size={16} strokeWidth={1.75} className="mx-auto mb-1" style={{ color: '#10b981' }} />}
                  <p className="text-[10px] t-dim font-bold">Tipo</p>
                  <p className="text-sm font-black t-strong mt-0.5">{perfil.retiradas > perfil.entregas ? 'Retirada' : 'Entrega'}</p>
                </div>
              </div>

              {/* Itens favoritos */}
              {perfil.itensFavoritos.length > 0 && (
                <div className="p-4 rounded-2xl"
                  style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  <p className="text-[10px] font-black uppercase tracking-wider t-dim mb-3">Itens favoritos</p>
                  <div className="space-y-2.5">
                    {perfil.itensFavoritos.map((item, i) => (
                      <div key={item.nome} className="flex items-center gap-2">
                        <span className="text-[10px] font-black t-dim w-4 shrink-0">{i + 1}</span>
                        <span className="text-xs t-strong flex-1 truncate">{item.nome}</span>
                        <MiniBar valor={item.qtd} max={maxItem} cor="var(--accent)" />
                        <span className="text-[10px] font-black t-dim shrink-0 w-8 text-right">{item.qtd}×</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evolução mensal */}
              {perfil.evolucaoMensal.length > 1 && (
                <div className="p-4 rounded-2xl"
                  style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  <p className="text-[10px] font-black uppercase tracking-wider t-dim mb-3">Gasto mensal</p>
                  <div className="flex items-end gap-1 h-16">
                    {perfil.evolucaoMensal.map(m => {
                      const pct = maxMes > 0 ? (m.gasto / maxMes) * 100 : 0;
                      const [ano, mes] = m.mes.split('-');
                      const label = `${mes}/${ano.slice(2)}`;
                      return (
                        <div key={m.mes} className="flex-1 flex flex-col items-center gap-0.5" title={`${label}: ${brl(m.gasto)}`}>
                          <div className="w-full rounded-t" style={{ height: `${Math.max(3, pct * 0.52)}px`, background: 'rgba(var(--accent-rgb),0.6)', transition: 'height .3s' }} />
                          <span className="text-[8px] t-dim">{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ticket min/max */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-2xl" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  <p className="text-[10px] t-dim font-bold mb-1">Menor pedido</p>
                  <p className="text-sm font-black t-strong">{brl(perfil.ticketMinimo)}</p>
                </div>
                <div className="p-3 rounded-2xl" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  <p className="text-[10px] t-dim font-bold mb-1">Maior pedido</p>
                  <p className="text-sm font-black t-strong">{brl(perfil.ticketMaximo)}</p>
                </div>
              </div>

              {/* Cancelamentos */}
              {dados.pedidosCancelados > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <X size={14} style={{ color: '#f87171' }} strokeWidth={2} />
                  <p className="text-xs t-dim">{dados.pedidosCancelados} pedido{dados.pedidosCancelados > 1 ? 's' : ''} cancelado{dados.pedidosCancelados > 1 ? 's' : ''} no histórico</p>
                </div>
              )}

            </>) :

            /* ── ABA HISTÓRICO ── */
            aba === 'historico' ? (
              <div className="space-y-2">
                {pedidos.length === 0
                  ? <p className="py-12 text-center text-sm t-dim">Nenhum pedido</p>
                  : pedidos.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                      <div>
                        <p className="text-sm font-bold t-strong">#{p.numero}</p>
                        <p className="text-[11px] t-dim">
                          {new Date(p.created_at).toLocaleDateString('pt-BR')} · {PGTO_LABEL[p.forma_pagamento] || '—'}
                          {p.tipo_entrega === 'retirada' && ' · Retirada'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black t-strong">{brl(p.total)}</p>
                        <p className="text-[10px] mt-0.5 font-semibold" style={{
                          color: { entregue: '#10b981', cancelado: '#ef4444', pronto: '#f59e0b', preparando: '#f59e0b', novo: '#3b82f6' }[p.status] || '#666'
                        }}>{p.status}</p>
                      </div>
                    </div>
                  ))
                }
              </div>
            ) :

            /* ── ABA FIDELIDADE ── */
            (<>
              {/* Cartão fidelidade */}
              {fid && (
                <div className="rounded-2xl p-4" style={{ background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-xs font-black tracking-widest" style={{ color: '#a78bfa' }}>CARTÃO FIDELIDADE</p>
                      <p className="text-xs t-dim mt-0.5">{fid.total_pedidos} pedido{fid.total_pedidos !== 1 ? 's' : ''} no total</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black" style={{ color: '#c4b5fd' }}>{fid.pedidos_no_ciclo}<span className="text-sm t-dim">/10</span></p>
                      <p className="text-[10px] t-dim">neste ciclo</p>
                    </div>
                  </div>
                  <Selos atual={fid.pedidos_no_ciclo} />
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(139,92,246,0.15)' }}>
                    {fid.recompensas_disponiveis > 0 ? (
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: '#eab308' }}><Gift size={14} /> {fid.recompensas_disponiveis} brinde{fid.recompensas_disponiveis > 1 ? 's' : ''} disponível{fid.recompensas_disponiveis > 1 ? 'is' : ''}</p>
                          <p className="text-[10px] t-dim mt-0.5">1 Temaki Salmão grátis</p>
                        </div>
                        <button onClick={handleResgatar} disabled={!!resgatando}
                          className="px-4 py-2 rounded-xl text-sm font-black disabled:opacity-50 active:scale-95 transition-transform"
                          style={{ background: 'rgba(234,179,8,0.2)', color: '#eab308', border: '1px solid rgba(234,179,8,0.3)' }}>
                          {resgatando === 'fid' ? '…' : <span className="flex items-center gap-1.5">Resgatar <Gift size={14} /></span>}
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs t-dim">
                        Faltam <span className="font-bold" style={{ color: '#a78bfa' }}>{fid.proximo_em}</span> pedido{fid.proximo_em !== 1 ? 's' : ''} para ganhar brinde
                        {fid.recompensas_ganhas > 0 && <span className="ml-2 t-faint">· {fid.recompensas_ganhas} ganho{fid.recompensas_ganhas > 1 ? 's' : ''} no total</span>}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Promoções */}
              {promocoes.length > 0 && (
                <div>
                  <p className="text-[10px] font-black tracking-widest t-dim mb-2 flex items-center gap-1.5"><Target size={12} /> PROMOÇÕES ATIVAS</p>
                  <div className="space-y-2">
                    {promocoes.map(cp => {
                      const completo = cp.completado && !cp.recompensa_resgatada;
                      return (
                        <div key={cp.id} className="rounded-xl p-3"
                          style={{ background: completo ? 'rgba(16,185,129,0.08)' : 'var(--space-elev)', border: `1px solid ${completo ? 'rgba(16,185,129,0.3)' : 'var(--hairline)'}` }}>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-xl shrink-0">{cp.emoji}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-bold t-strong truncate">{cp.nome}</p>
                                <p className="text-[11px] t-dim truncate flex items-center gap-1"><Gift size={10} /> {cp.recompensa}</p>
                              </div>
                            </div>
                            {completo ? (
                              <button onClick={() => resgatarPromocao(cp)} disabled={resgatando === cp.id}
                                className="px-3 py-1.5 rounded-lg text-xs font-black shrink-0 disabled:opacity-50"
                                style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                                {resgatando === cp.id ? '…' : <span className="flex items-center gap-1"><Gift size={12} /> Resgatar</span>}
                              </button>
                            ) : (
                              <span className="text-xs font-black shrink-0" style={{ color: 'var(--accent)' }}>{cp.progresso || 0}/{cp.meta}</span>
                            )}
                          </div>
                          <BarraProgresso progresso={cp.progresso || 0} meta={cp.meta} cor={completo ? '#10b981' : 'var(--accent)'} />
                          <p className="text-[10px] t-dim mt-1.5">
                            {completo
                              ? <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-emerald-500" /> Completado! Clique para resgatar.</span>
                              : `Faltam ${cp.meta - (cp.progresso || 0)} ${cp.tipo === 'pedidos' ? 'pedidos' : 'R$'} para ganhar`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {promocoes.length === 0 && !fid?.recompensas_disponiveis && (
                <div className="py-12 text-center t-dim text-sm">
                  <Award size={28} className="mx-auto mb-3 opacity-30" strokeWidth={1.5} />
                  <p>Nenhuma promoção ativa para este cliente.</p>
                </div>
              )}
            </>)
          )}
        </div>
      </div>
    </div>
  );
}

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState(null);
  const [ordenar, setOrdenar] = useState('recente'); // 'recente' | 'pedidos' | 'nome'
  const [seg, setSeg] = useState('todos'); // segmento ativo
  const [aniversarios, setAniversarios] = useState([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/clientes`, { headers: authH() });
      if (!res.ok) return;
      setClientes(await res.json());
    } catch {}
    try {
      const ra = await fetch(`${BASE}/clientes/aniversarios?dias=30`, { headers: authH() });
      if (ra.ok) setAniversarios(await ra.json());
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  function handleResgatar(clienteAtualizado) {
    setClientes(cs => cs.map(c => c.id === clienteAtualizado.id ? { ...c, ...clienteAtualizado } : c));
    setClienteSelecionado(c => c ? { ...c, ...clienteAtualizado } : c);
  }

  // Segmentação
  const mesAtual = new Date().toISOString().slice(0, 7);
  const ehNovo        = c => (c.created_at || '').slice(0, 7) === mesAtual;
  const ehRecorrente  = c => c.total_pedidos > 1;
  const ehVip         = c => c.total_pedidos >= 10;
  const ehComBrinde   = c => (c.recompensas_ganhas - c.recompensas_usadas) > 0;
  const ehInativo     = c => c.total_pedidos > 0 && diasDesde(c.updated_at) > 30;

  const SEGMENTOS = [
    { id: 'todos',      label: 'Todos',       Icon: Users,    teste: () => true },
    { id: 'novos',      label: 'Novos',       Icon: Sparkles, teste: ehNovo },
    { id: 'recorrentes',label: 'Recorrentes', Icon: Repeat,   teste: ehRecorrente },
    { id: 'vip',        label: 'VIP (10+)',   Icon: Crown,    teste: ehVip },
    { id: 'brinde',     label: 'Com brinde',  Icon: Gift,     teste: ehComBrinde },
    { id: 'inativos',   label: 'Inativos',    Icon: MoonStar, teste: ehInativo },
  ];
  const segAtivo = SEGMENTOS.find(s => s.id === seg) || SEGMENTOS[0];

  const filtrados = clientes
    .filter(c => !busca || c.nome.toLowerCase().includes(busca.toLowerCase()) || c.telefone.includes(busca))
    .filter(c => segAtivo.teste(c))
    .sort((a, b) => {
      if (ordenar === 'pedidos') return b.total_pedidos - a.total_pedidos;
      if (ordenar === 'nome')    return a.nome.localeCompare(b.nome);
      return new Date(b.updated_at) - new Date(a.updated_at);
    });

  const totalClientes = clientes.length;
  const totalPedidos  = clientes.reduce((s, c) => s + c.total_pedidos, 0);
  const comBrinde     = clientes.filter(ehComBrinde).length;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <Toaster />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--cor-texto, #fff)' }}>Clientes</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Cadastros e programa de fidelidade</p>
        </div>
        <button onClick={carregar} className="px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5"
          style={{ background: '#111', color: '#888', border: '1px solid #1a1a1a' }}>
          <RefreshCw size={13} strokeWidth={1.75} /> Atualizar
        </button>
      </div>

      {/* Cards resumo */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Clientes',       valor: totalClientes, Icon: Users, cor: 'var(--accent)' },
          { label: 'Pedidos feitos', valor: totalPedidos,  Icon: Fish,  cor: '#10b981' },
          { label: 'Com brinde',     valor: comBrinde,     Icon: Gift,  cor: '#eab308' },
        ].map(card => (
          <div key={card.label} className="rounded-2xl p-4" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-black" style={{ color: card.cor }}>{card.valor}</p>
              <span className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: `${card.cor}1a` }}><card.Icon size={15} strokeWidth={1.75} style={{ color: card.cor }} /></span>
            </div>
            <p className="text-xs text-zinc-600 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Próximos aniversários */}
      {aniversarios.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.08), rgba(168,85,247,0.06))', border: '1px solid rgba(236,72,153,0.2)' }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(236,72,153,0.15)' }}><Cake size={15} strokeWidth={1.75} style={{ color: '#ec4899' }} /></span>
            <h3 className="text-sm font-black" style={{ color: 'var(--cor-texto, #fff)' }}>Próximos aniversários</h3>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(236,72,153,0.15)', color: '#f472b6' }}>{aniversarios.length}</span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {aniversarios.map(a => {
              const cliente = clientes.find(c => c.id === a.id);
              const quando = a.hoje ? 'HOJE 🎉' : a.dias_para === 1 ? 'amanhã' : `em ${a.dias_para} dias`;
              return (
                <button key={a.id} onClick={() => cliente && setClienteSelecionado(cliente)}
                  className="shrink-0 text-left rounded-xl px-3 py-2.5 transition-all active:scale-95"
                  style={{ background: a.hoje ? 'rgba(236,72,153,0.18)' : '#111', border: `1px solid ${a.hoje ? 'rgba(236,72,153,0.45)' : '#1a1a1a'}`, minWidth: 140 }}>
                  <p className="text-sm font-black truncate" style={{ color: 'var(--cor-texto, #fff)', maxWidth: 130 }}>{a.nome}</p>
                  <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: a.hoje ? '#f472b6' : '#888' }}>
                    <Cake size={11} strokeWidth={1.75} /> {a.data_label} · <span className="font-bold">{quando}</span>
                  </p>
                  {a.total_pedidos > 0 && <p className="text-[10px] text-zinc-600 mt-0.5">{a.total_pedidos} {a.total_pedidos === 1 ? 'pedido' : 'pedidos'}</p>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chips de segmento */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {SEGMENTOS.map(({ id, label, Icon, teste }) => {
          const ativo = seg === id;
          const qtd = id === 'todos' ? clientes.length : clientes.filter(teste).length;
          return (
            <button key={id} onClick={() => setSeg(id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0"
              style={{
                background: ativo ? 'rgba(var(--accent-rgb),0.15)' : '#111',
                color: ativo ? 'var(--accent)' : '#666',
                border: `1px solid ${ativo ? 'rgba(var(--accent-rgb),0.35)' : '#1a1a1a'}`,
              }}>
              <Icon size={14} strokeWidth={1.75} /> {label}
              <span className="text-[10px] opacity-70">{qtd}</span>
            </button>
          );
        })}
      </div>

      {/* Busca + ordenação */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={15} strokeWidth={1.75} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
          <input
            type="text" placeholder="Buscar por nome ou telefone..."
            value={busca} onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white outline-none"
            style={{ background: '#111', border: '1px solid #1a1a1a' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = '#1a1a1a'}
          />
        </div>
        <select value={ordenar} onChange={e => setOrdenar(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-xs font-semibold outline-none"
          style={{ background: '#111', color: '#888', border: '1px solid #1a1a1a' }}>
          <option value="recente">Mais recentes</option>
          <option value="pedidos">Mais pedidos</option>
          <option value="nome">Nome A-Z</option>
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="py-20 text-center">
          <p className="text-zinc-600 animate-pulse">Carregando clientes...</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="py-20 text-center">
          <p className="flex justify-center mb-3 text-zinc-700"><Users size={36} strokeWidth={1.5} /></p>
          <p className="text-zinc-500">{busca || seg !== 'todos' ? 'Nenhum cliente neste filtro' : 'Nenhum cliente cadastrado ainda'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(c => {
            const fid = c.fidelidade || {};
            const temBrinde = (c.recompensas_ganhas - c.recompensas_usadas) > 0;
            return (
              <button key={c.id} onClick={() => setClienteSelecionado(c)}
                className="w-full text-left rounded-2xl p-4 transition-all active:scale-[0.99]"
                style={{ background: '#111', border: `1px solid ${temBrinde ? 'rgba(234,179,8,0.3)' : '#1a1a1a'}` }}>
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-lg shrink-0"
                    style={{ background: temBrinde ? 'rgba(234,179,8,0.15)' : 'rgba(var(--accent-rgb),0.1)', color: temBrinde ? '#eab308' : 'var(--accent)' }}>
                    {c.nome.charAt(0).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-white text-sm truncate">{c.nome}</p>
                      {temBrinde && <span className="text-xs px-1.5 py-0.5 rounded-md font-bold shrink-0 inline-flex items-center gap-1"
                        style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308' }}><Gift size={11} strokeWidth={1.75} /> Brinde</span>}
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5 flex items-center gap-1"><Smartphone size={11} strokeWidth={1.75} /> {c.telefone}</p>
                    {c.endereco && <p className="text-xs text-zinc-700 truncate flex items-center gap-1"><MapPin size={11} strokeWidth={1.75} className="shrink-0" /> {c.endereco}</p>}
                  </div>
                  {/* Stats */}
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-white">{c.total_pedidos}</p>
                    <p className="text-[10px] text-zinc-600">pedido{c.total_pedidos !== 1 ? 's' : ''}</p>
                    {fid.pedidos_no_ciclo !== undefined && (
                      <p className="text-[10px] text-violet-500 mt-0.5 flex items-center justify-end gap-0.5">{fid.pedidos_no_ciclo}/10 <Star size={10} strokeWidth={1.75} /></p>
                    )}
                  </div>
                </div>
                {/* Barra fidelidade */}
                {fid.pedidos_no_ciclo !== undefined && (
                  <div className="mt-3">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${(fid.pedidos_no_ciclo / 10) * 100}%`, background: temBrinde ? '#eab308' : 'rgba(139,92,246,0.7)' }} />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Modal detalhe */}
      {clienteSelecionado && (
        <ModalCliente
          cliente={clienteSelecionado}
          onClose={() => setClienteSelecionado(null)}
          onResgatar={handleResgatar}
        />
      )}
    </div>
  );
}
