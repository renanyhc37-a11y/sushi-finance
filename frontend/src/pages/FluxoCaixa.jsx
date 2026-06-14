import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, Target, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { api } from '../api/client';
import { mesAtual } from '../lib/fmt';
import { PageLoading } from '../components/Loading';

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlk = (v) => {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(0);
};
const diaCurto = (d) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '');

export default function FluxoCaixa() {
  const [mes, setMes] = useState(mesAtual());
  const { data, isLoading } = useQuery({
    queryKey: ['fluxo-caixa', mes],
    queryFn: () => api.get(`/fluxo-caixa?mes=${mes}`),
  });

  const t = data?.totais || {};
  const serie = data?.serie || [];
  const positivo = (t.saldo || 0) >= 0;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fluxo de Caixa</h1>
          <p className="page-subtitle">Entradas × saídas do mês, saldo e projeção</p>
        </div>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="input max-w-[160px]" />
      </div>

      {isLoading ? <PageLoading /> : (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card icon={ArrowUpRight} cor="#10b981" label="Entradas" valor={brl(t.entradas)} sub="faturamento" />
            <Card icon={ArrowDownRight} cor="#f87171" label="Saídas" valor={brl(t.saidas)} sub={`${brl(t.despesas)} desp · ${brl(t.compras_insumos)} insumos`} />
            <Card icon={Wallet} cor={positivo ? '#10b981' : '#f87171'} label="Saldo do mês" valor={brl(t.saldo)} destaque />
            <Card icon={Target} cor="#818cf8" label="Projeção do mês" valor={brl(data?.projecao_mes)} sub={`${brl(data?.saldo_medio_dia)}/dia`} />
          </div>

          {/* Gráfico */}
          <div className="card p-4">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--accent)' }}>Entradas, saídas e saldo acumulado</p>
            {serie.length === 0 ? (
              <div className="py-12 text-center text-sm" style={{ color: 'var(--txt-dim)' }}>Sem movimento neste mês</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                  <XAxis dataKey="data" tickFormatter={diaCurto} tick={{ fill: 'var(--txt-dim)', fontSize: 11 }} />
                  <YAxis tickFormatter={brlk} tick={{ fill: 'var(--txt-dim)', fontSize: 11 }} width={42} />
                  <Tooltip
                    contentStyle={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 12 }}
                    labelFormatter={diaCurto}
                    formatter={(v, n) => [brl(v), { entradas: 'Entradas', saidas: 'Saídas', saldo_acumulado: 'Saldo acumulado' }[n] || n]}
                  />
                  <ReferenceLine y={0} stroke="var(--hairline-strong)" />
                  <Bar dataKey="entradas" fill="#10b981" radius={[3, 3, 0, 0]} barSize={10} />
                  <Bar dataKey="saidas" fill="#f87171" radius={[3, 3, 0, 0]} barSize={10} />
                  <Line dataKey="saldo_acumulado" stroke="var(--accent)" strokeWidth={2.5} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tabela diária */}
          {serie.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Detalhe por dia</span>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Dia</th>
                      <th className="text-right">Entradas</th>
                      <th className="text-right">Despesas</th>
                      <th className="text-right">Insumos</th>
                      <th className="text-right">Saldo do dia</th>
                      <th className="text-right">Acumulado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serie.map(d => (
                      <tr key={d.data}>
                        <td className="font-semibold">{diaCurto(d.data)}</td>
                        <td className="text-right font-mono" style={{ color: '#10b981' }}>{d.entradas ? brl(d.entradas) : '—'}</td>
                        <td className="text-right font-mono" style={{ color: '#f87171' }}>{d.despesas ? brl(d.despesas) : '—'}</td>
                        <td className="text-right font-mono" style={{ color: '#f87171' }}>{d.compras_insumos ? brl(d.compras_insumos) : '—'}</td>
                        <td className="text-right font-mono font-bold" style={{ color: d.saldo_dia >= 0 ? '#10b981' : '#f87171' }}>{brl(d.saldo_dia)}</td>
                        <td className="text-right font-mono font-bold" style={{ color: d.saldo_acumulado >= 0 ? 'var(--txt-strong)' : '#f87171' }}>{brl(d.saldo_acumulado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Card({ icon: Icon, cor, label, valor, sub, destaque }) {
  return (
    <div className="card p-4" style={destaque ? { border: `1px solid ${cor}55` } : undefined}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${cor}1a`, color: cor }}><Icon size={15} strokeWidth={2} /></span>
        <span className="text-[11px]" style={{ color: 'var(--txt-dim)' }}>{label}</span>
      </div>
      <p className={`font-black ${destaque ? 'text-xl' : 'text-lg'}`} style={{ color: destaque ? cor : 'var(--txt-strong)' }}>{valor}</p>
      {sub && <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--txt-faint)' }}>{sub}</p>}
    </div>
  );
}
