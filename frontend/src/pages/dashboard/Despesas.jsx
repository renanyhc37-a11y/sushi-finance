import React, { useState, useEffect, useMemo } from 'react';
import { getToken } from '../../hooks/useAuth';
import { TrendingDown, Activity } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardHeader, ChartTooltip, brl, CORES } from './_shared';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const mesAtual = () => new Date().toISOString().slice(0, 7);
const nomeMesCurto = (mes) => {
  const [a, m] = mes.split('-');
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
};
const CORES_TIPO = ['#60a5fa', '#34d399', '#a78bfa', '#f97316', '#ef4444', '#5b6678', '#fbbf24'];

export default function Despesas() {
  const [mes, setMes] = useState(mesAtual());
  const [dados, setDados] = useState(null);
  const [maiorGasto, setMaiorGasto] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${BASE}/relatorios/despesas-analise?mes=${mes}`, { headers: authH() }).then(r => r.json()),
      fetch(`${BASE}/relatorios/painel-dono?mes=${mes}`, { headers: authH() }).then(r => r.json()),
    ]).then(([d, p]) => { setDados(d); setMaiorGasto(p?.saiu?.maior_gasto || null); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [mes]);

  const porCategoria = (dados?.por_categoria || []).map(c => ({
    label: c.categoria === 'fixo' ? 'Fixas' : 'Variáveis',
    value: c.total,
    cor: c.categoria === 'fixo' ? CORES.roxo : CORES.vermelho,
  }));
  const porTipo = (dados?.por_tipo || []).slice(0, 7);
  const evolucaoChart = useMemo(() => (dados?.evolucao || []).map(e => ({
    mes: nomeMesCurto(e.mes), fixas: e.fixas, variaveis: e.variaveis,
  })), [dados]);

  const totalMes = porCategoria.reduce((s, c) => s + c.value, 0);

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
          <TrendingDown size={16} strokeWidth={1.75} style={{ color: '#ef4444' }} /> Para onde foi o dinheiro
        </h2>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="input max-w-[160px]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <CardHeader title="Fixas vs variáveis" cor="var(--accent)" />
          <div className="p-3">
            {totalMes === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--txt-faint)' }}>Nenhuma despesa lançada nesse mês</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={porCategoria} dataKey="value" nameKey="label" innerRadius={40} outerRadius={64} paddingAngle={3} stroke="none">
                      {porCategoria.map((c, i) => <Cell key={i} fill={c.cor} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {porCategoria.map(c => (
                    <div key={c.label} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.cor }} />
                      <span className="flex-1" style={{ color: 'var(--txt)' }}>{c.label}</span>
                      <span className="font-bold" style={{ color: 'var(--txt-strong)' }}>{brl(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <CardHeader title="Por tipo/fornecedor" cor="#a78bfa" />
          <div className="p-3 space-y-2">
            {porTipo.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--txt-faint)' }}>Sem dados no período</p>
            ) : porTipo.map((t, i) => {
              const pct = totalMes > 0 ? (t.total / totalMes) * 100 : 0;
              return (
                <div key={t.tipo}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: 'var(--txt)' }}>{t.tipo}</span>
                    <span className="font-bold" style={{ color: 'var(--txt-strong)' }}>{brl(t.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'var(--space-elev-2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CORES_TIPO[i % CORES_TIPO.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <CardHeader title="Evolução — últimos 12 meses (fixas vs variáveis)" cor="var(--accent)" />
        <div className="p-3 pt-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={evolucaoChart} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.10)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} width={38} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip content={<ChartTooltip series={[
                { key: 'fixas', label: 'Fixas', cor: CORES.roxo, fmt: brl },
                { key: 'variaveis', label: 'Variáveis', cor: CORES.vermelho, fmt: brl },
              ]} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
              <Bar dataKey="fixas" stackId="d" fill={CORES.roxo} radius={[0, 0, 0, 0]} />
              <Bar dataKey="variaveis" stackId="d" fill={CORES.vermelho} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {maiorGasto && (
        <p className="text-xs text-center" style={{ color: 'var(--txt-dim)' }}>
          Maior gasto do mês: <b style={{ color: 'var(--txt)' }}>{maiorGasto.descricao?.trim() || '—'}</b> — {brl(maiorGasto.valor)}
        </p>
      )}
    </div>
  );
}
