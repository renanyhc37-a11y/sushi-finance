import React, { useState, useEffect, useMemo } from 'react';
import { getToken } from '../../hooks/useAuth';
import { Wallet, TrendingUp, Target, Activity } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ComposedChart, Line, PieChart, Pie, Legend,
} from 'recharts';
import { Card, CardHeader, ChartTooltip, brl, brlK, CORES } from './_shared';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const mesAtual = () => new Date().toISOString().slice(0, 7);
const nomeMesCurto = (mes) => {
  const [a, m] = mes.split('-');
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
};

// Waterfall com Recharts: cada barra é [base invisível, valor visível].
// base = ponto de partida da barra (não desenhado); delta = altura visível.
function montarWaterfall(dre) {
  if (!dre) return [];
  let acumulado = dre.faturamento_bruto;
  const passos = [
    { label: 'Faturamento bruto', valor: dre.faturamento_bruto, tipo: 'total' },
    { label: 'Taxa cartão', valor: -dre.taxa_cartao, tipo: 'saida' },
    { label: 'CMV', valor: -dre.cmv_total, tipo: 'saida' },
    { label: 'Despesas fixas', valor: -dre.despesas_fixas, tipo: 'saida' },
    { label: 'Despesas variáveis', valor: -dre.despesas_variaveis, tipo: 'saida' },
    { label: 'Lucro líquido', valor: dre.lucro_liquido, tipo: 'total', absoluto: true },
  ];
  let corrente = 0;
  return passos.map(p => {
    if (p.tipo === 'total' && p.absoluto) {
      const barra = { label: p.label, base: 0, valor: p.valor, tipo: p.tipo, exibicao: p.valor };
      return barra;
    }
    if (p.tipo === 'total') {
      corrente = p.valor;
      return { label: p.label, base: 0, valor: p.valor, tipo: p.tipo, exibicao: p.valor };
    }
    const inicio = corrente;
    corrente += p.valor;
    const base = Math.min(inicio, corrente);
    const altura = Math.abs(p.valor);
    return { label: p.label, base, valor: altura, tipo: p.tipo, exibicao: p.valor };
  });
}

export default function Financeiro() {
  const [mes, setMes] = useState(mesAtual());
  const [dre, setDre] = useState(null);
  const [evolucao, setEvolucao] = useState([]);
  const [meta, setMeta] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${BASE}/relatorios/dre?mes=${mes}`, { headers: authH() }).then(r => r.json()),
      fetch(`${BASE}/relatorios/evolucao`, { headers: authH() }).then(r => r.json()),
      fetch(`${BASE}/relatorios/meta?mes=${mes}`, { headers: authH() }).then(r => r.json()),
    ]).then(([d, ev, m]) => {
      setDre(d); setEvolucao(ev || []); setMeta(m?.meta || 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [mes]);

  const waterfall = useMemo(() => montarWaterfall(dre), [dre]);
  const evolucaoChart = useMemo(() => evolucao.map(e => ({
    mes: nomeMesCurto(e.mes),
    faturamento: e.faturamento_bruto,
    lucro: e.lucro_liquido,
  })), [evolucao]);

  const pagamentos = dre?.pagamentos || {};
  const pagamentosChart = [
    { label: 'PIX', value: pagamentos.pix || 0, cor: CORES.verde },
    { label: 'Dinheiro', value: pagamentos.dinheiro || 0, cor: CORES.azul },
    { label: 'Crédito', value: pagamentos.credito || 0, cor: CORES.roxo },
    { label: 'Débito', value: pagamentos.debito || 0, cor: CORES.cinza },
  ].filter(p => p.value > 0);

  const progressoMeta = meta > 0 && dre ? Math.min(100, (dre.faturamento_bruto / meta) * 100) : 0;

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="text-sm flex items-center gap-2" style={{ color: 'var(--txt-dim)' }}>
        <Activity size={18} strokeWidth={1.75} style={{ color: 'var(--accent)' }} className="animate-pulse" /> Carregando…
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--txt-strong)' }}>
          <Wallet size={16} strokeWidth={1.75} style={{ color: 'var(--accent)' }} /> DRE do mês
        </h2>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="input max-w-[160px]" />
      </div>

      <Card className="p-4">
        <p className="text-[11px] mb-3" style={{ color: 'var(--txt-dim)' }}>
          Do faturamento bruto até o lucro líquido, passo a passo. CMV calculado só sobre pedidos reais do PDV/cardápio.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={waterfall} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.10)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} width={44} tickFormatter={v => v >= 1000 || v <= -1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0]?.payload;
              return (
                <div className="rounded-xl px-3 py-2 text-xs shadow-2xl" style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline-strong)' }}>
                  <p className="font-bold mb-1" style={{ color: 'var(--txt-strong)' }}>{label}</p>
                  <p style={{ color: item?.exibicao >= 0 ? '#10b981' : '#ef4444' }}>{brl(item?.exibicao)}</p>
                </div>
              );
            }} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
            <Bar dataKey="base" stackId="w" fill="transparent" />
            <Bar dataKey="valor" stackId="w" radius={[4, 4, 4, 4]}>
              {waterfall.map((d, i) => (
                <Cell key={i} fill={d.tipo === 'total' ? (d.exibicao >= 0 ? 'var(--accent)' : '#ef4444') : (d.exibicao >= 0 ? '#10b981' : '#ef4444')} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <CardHeader title="Faturamento e lucro — últimos 12 meses" icon={TrendingUp} cor="var(--accent)" />
          <div className="p-3 pt-4">
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={evolucaoChart} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.10)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} width={38} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip content={<ChartTooltip series={[
                  { key: 'faturamento', label: 'Faturamento', cor: 'var(--accent)', fmt: brl },
                  { key: 'lucro', label: 'Lucro líquido', cor: '#10b981', fmt: brl },
                ]} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="faturamento" fill="var(--accent)" radius={[4, 4, 0, 0]} opacity={0.85} />
                <Line type="monotone" dataKey="lucro" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <CardHeader title="Forma de pagamento" icon={Wallet} cor="#a78bfa" />
          <div className="p-3">
            {pagamentosChart.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--txt-faint)' }}>Sem dados no período</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pagamentosChart} dataKey="value" nameKey="label" innerRadius={44} outerRadius={68} paddingAngle={3} stroke="none">
                      {pagamentosChart.map((p, i) => <Cell key={i} fill={p.cor} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {pagamentosChart.map(p => (
                    <div key={p.label} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.cor }} />
                      <span className="flex-1" style={{ color: 'var(--txt)' }}>{p.label}</span>
                      <span className="font-bold" style={{ color: 'var(--txt-strong)' }}>{brl(p.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {meta > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--txt-strong)' }}>
              <Target size={15} strokeWidth={1.75} style={{ color: 'var(--accent)' }} /> Meta do mês
            </h2>
            <span className="text-xs font-bold" style={{ color: 'var(--txt-dim)' }}>{brl(dre?.faturamento_bruto)} de {brl(meta)}</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--space-elev-2)' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progressoMeta}%`, background: progressoMeta >= 100 ? '#10b981' : 'var(--accent)' }} />
          </div>
        </Card>
      )}
    </div>
  );
}
