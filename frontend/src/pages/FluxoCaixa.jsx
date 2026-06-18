import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Wallet, ChevronLeft, ChevronRight,
  ArrowDownRight, ArrowUpRight, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { api } from '../api/client';
import { mesAtual } from '../lib/fmt';
import { PageLoading } from '../components/Loading';

const brl  = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlk = (v) => { const n = Number(v || 0); return Math.abs(n) >= 1000 ? `${(n/1000).toFixed(1)}k` : n.toFixed(0); };
const diaCurto = (d) => d ? d.slice(8,10)+'/'+d.slice(5,7) : '';

function mesAnterior(mes) {
  const [y, m] = mes.split('-').map(Number);
  return m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}`;
}
function mesSeguinte(mes) {
  const [y, m] = mes.split('-').map(Number);
  return m === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`;
}
function nomeMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  return new Date(y, m-1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

// Tooltip customizado para o gráfico de barras
function TooltipDia({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: '10px 14px', fontSize: 12, minWidth: 160 }}>
      <p style={{ color: '#888', marginBottom: 6, fontWeight: 700 }}>{label}</p>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
          <span style={{ color: p.color }}>
            {{ entradas: '↑ Entradas', saidas: '↓ Saídas' }[p.dataKey] || p.name}
          </span>
          <span style={{ fontWeight: 700, color: '#fff' }}>{brl(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function TooltipSaldo({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const v = payload[0]?.value;
  return (
    <div style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: 12, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ color: '#888', marginBottom: 4, fontWeight: 700 }}>{label}</p>
      <p style={{ fontWeight: 700, color: v >= 0 ? '#10b981' : '#f87171' }}>{brl(v)}</p>
    </div>
  );
}

export default function FluxoCaixa() {
  const [mes, setMes] = useState(mesAtual());
  const { data, isLoading } = useQuery({
    queryKey: ['fluxo-caixa', mes],
    queryFn: () => api.get(`/fluxo-caixa?mes=${mes}`),
  });

  const t      = data?.totais || {};
  const serie  = data?.serie  || [];
  const saldo  = t.saldo || 0;
  const cobertura = t.saidas > 0 ? Math.min((t.entradas / t.saidas) * 100, 100) : 100;
  const saudavel  = saldo >= 0 && cobertura >= 80;
  const hoje      = new Date().toISOString().slice(0,10);
  const diasRestantes = serie.filter(d => d.data > hoje).length;

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* Header com navegação de mês */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Fluxo de Caixa</h1>
          <p className="page-subtitle">Entradas, saídas e saldo acumulado</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMes(mesAnterior(mes))}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)', color: 'var(--txt-dim)' }}>
            <ChevronLeft size={18} />
          </button>
          <div className="text-sm font-bold capitalize" style={{ minWidth: 160, textAlign: 'center', color: 'var(--txt-strong)' }}>
            {nomeMes(mes)}
          </div>
          <button onClick={() => setMes(mesSeguinte(mes))}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)', color: 'var(--txt-dim)' }}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {isLoading ? <PageLoading /> : (
        <>
          {/* ── Painel de saúde ── */}
          <div className="rounded-2xl p-4 flex items-center gap-4"
            style={{ background: saudavel ? 'rgba(16,185,129,0.06)' : 'rgba(248,113,113,0.06)', border: `1px solid ${saudavel ? 'rgba(16,185,129,0.25)' : 'rgba(248,113,113,0.25)'}` }}>
            {saudavel
              ? <CheckCircle size={28} style={{ color: '#10b981', flexShrink: 0 }} />
              : <AlertTriangle size={28} style={{ color: '#f87171', flexShrink: 0 }} />
            }
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm" style={{ color: saudavel ? '#10b981' : '#f87171' }}>
                {saudavel ? 'Caixa saudável' : 'Atenção: caixa negativo'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--txt-dim)' }}>
                As entradas cobrem {cobertura.toFixed(0)}% das saídas.
                {diasRestantes > 0 ? ` Faltam ${diasRestantes} dias no mês — projeção: ${brl(data?.projecao_mes)}.` : ' Mês encerrado.'}
              </p>
            </div>
            {/* Barra de cobertura */}
            <div className="shrink-0 hidden sm:block" style={{ width: 120 }}>
              <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--txt-faint)' }}>
                <span>Cobertura</span><span>{cobertura.toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <div className="h-2 rounded-full transition-all" style={{ width: `${cobertura}%`, background: saudavel ? '#10b981' : '#f87171' }} />
              </div>
            </div>
          </div>

          {/* ── 4 KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi icon={ArrowUpRight} cor="#10b981" label="Entradas" valor={brl(t.entradas)} sub="faturamento do mês" />
            <Kpi icon={ArrowDownRight} cor="#f87171" label="Saídas" valor={brl(t.saidas)}
              sub={[t.despesas && `${brl(t.despesas)} desp`, t.compras_insumos && `${brl(t.compras_insumos)} insumos`].filter(Boolean).join(' · ')} />
            <Kpi icon={Wallet} cor={saldo >= 0 ? '#10b981' : '#f87171'} label="Saldo do mês" valor={brl(saldo)} destaque />
            <Kpi icon={saldo >= 0 ? TrendingUp : TrendingDown} cor="#818cf8" label="Média diária" valor={brl(data?.saldo_medio_dia)} sub="entradas − saídas / dias" />
          </div>

          {/* ── Gráficos ── */}
          {serie.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Barras: entradas vs saídas por dia */}
              <div className="card p-4">
                <p className="text-xs font-black tracking-widest mb-4" style={{ color: 'var(--txt-dim)' }}>ENTRADAS VS SAÍDAS POR DIA</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={serie} margin={{ top: 0, right: 4, left: 0, bottom: 0 }} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="data" tickFormatter={diaCurto} tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={brlk} tick={{ fill: '#555', fontSize: 10 }} width={38} axisLine={false} tickLine={false} />
                    <Tooltip content={<TooltipDia />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="entradas" name="Entradas" fill="#10b981" radius={[3,3,0,0]} maxBarSize={18} />
                    <Bar dataKey="saidas" name="Saídas" fill="#f87171" radius={[3,3,0,0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 justify-center">
                  <span className="flex items-center gap-1.5 text-[11px]" style={{ color: '#10b981' }}><span className="w-3 h-2 rounded-sm inline-block" style={{ background: '#10b981' }} /> Entradas</span>
                  <span className="flex items-center gap-1.5 text-[11px]" style={{ color: '#f87171' }}><span className="w-3 h-2 rounded-sm inline-block" style={{ background: '#f87171' }} /> Saídas</span>
                </div>
              </div>

              {/* Área: saldo acumulado */}
              <div className="card p-4">
                <p className="text-xs font-black tracking-widest mb-4" style={{ color: 'var(--txt-dim)' }}>SALDO ACUMULADO NO MÊS</p>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={serie} margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradPos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradNeg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f87171" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f87171" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="data" tickFormatter={diaCurto} tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={brlk} tick={{ fill: '#555', fontSize: 10 }} width={38} axisLine={false} tickLine={false} />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.15)" strokeDasharray="4 4" />
                    <Tooltip content={<TooltipSaldo />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
                    <Area dataKey="saldo_acumulado" stroke={saldo >= 0 ? '#10b981' : '#f87171'} strokeWidth={2.5}
                      fill={saldo >= 0 ? 'url(#gradPos)' : 'url(#gradNeg)'} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Tabela diária ── */}
          {serie.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--hairline)' }}>
                <span className="text-sm font-black" style={{ color: 'var(--txt-strong)' }}>Detalhamento diário</span>
                <span className="text-[11px]" style={{ color: 'var(--txt-faint)' }}>{serie.length} dias registrados</span>
              </div>
              <div className="overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                      {['Dia', 'Entradas', 'Saídas', 'Saldo do dia', 'Acumulado'].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Dia' ? 'left' : 'right', color: 'var(--txt-dim)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...serie].reverse().map((d, i) => {
                      const isHoje = d.data === hoje;
                      const positivo = d.saldo_dia >= 0;
                      const maxMovimento = Math.max(...serie.map(s => Math.max(s.entradas || 0, s.saidas || 0)));
                      const pctEnt = maxMovimento > 0 ? ((d.entradas || 0) / maxMovimento * 100) : 0;
                      const pctSai = maxMovimento > 0 ? ((d.saidas || 0) / maxMovimento * 100) : 0;
                      return (
                        <tr key={d.data} style={{
                          borderBottom: '1px solid var(--hairline)',
                          background: isHoje ? 'rgba(var(--accent-rgb),0.06)' : i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                        }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div className="flex items-center gap-2">
                              <span style={{ fontWeight: isHoje ? 800 : 600, color: isHoje ? 'var(--accent)' : 'var(--txt-strong)' }}>
                                {diaCurto(d.data)}
                              </span>
                              {isHoje && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 700 }}>HOJE</span>}
                            </div>
                            {/* Mini barras */}
                            <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                              {d.entradas > 0 && <div style={{ height: 3, borderRadius: 2, width: `${pctEnt}%`, minWidth: 4, background: '#10b981', maxWidth: 80 }} />}
                              {d.saidas > 0 && <div style={{ height: 3, borderRadius: 2, width: `${pctSai}%`, minWidth: 4, background: '#f87171', maxWidth: 80 }} />}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: d.entradas ? '#10b981' : 'var(--txt-faint)' }}>
                            {d.entradas ? brl(d.entradas) : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', color: d.saidas ? '#f87171' : 'var(--txt-faint)' }}>
                            {d.saidas ? brl(d.saidas) : '—'}
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: positivo ? '#10b981' : '#f87171', background: positivo ? 'rgba(16,185,129,0.1)' : 'rgba(248,113,113,0.1)', padding: '2px 8px', borderRadius: 8 }}>
                              {brl(d.saldo_dia)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: d.saldo_acumulado >= 0 ? 'var(--txt-strong)' : '#f87171' }}>
                            {brl(d.saldo_acumulado)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {serie.length === 0 && (
            <div className="card p-16 text-center">
              <p className="text-3xl mb-3">📭</p>
              <p className="font-bold" style={{ color: 'var(--txt-strong)' }}>Nenhum movimento em {nomeMes(mes)}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--txt-dim)' }}>Registre faturamento ou despesas para ver o fluxo.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ icon: Icon, cor, label, valor, sub, destaque }) {
  return (
    <div className="card p-4" style={destaque ? { border: `1px solid ${cor}44` } : undefined}>
      <div className="flex items-center gap-2 mb-2">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${cor}18`, color: cor }}>
          <Icon size={14} strokeWidth={2} />
        </span>
        <span className="text-[11px] font-semibold" style={{ color: 'var(--txt-dim)' }}>{label}</span>
      </div>
      <p className={`font-black ${destaque ? 'text-xl' : 'text-lg'}`} style={{ color: destaque ? cor : 'var(--txt-strong)' }}>{valor}</p>
      {sub && <p className="text-[10px] mt-1 truncate" style={{ color: 'var(--txt-faint)' }}>{sub}</p>}
    </div>
  );
}
