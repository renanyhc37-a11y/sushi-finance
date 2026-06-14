import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { api } from '../api/client';
import { PageLoading } from '../components/Loading';
import { brl, pct, mesLabel, mesAtual } from '../lib/fmt';
import { exportarRelatorioPDF } from '../lib/exportPdf';

export default function Relatorios() {
  const [mes, setMes] = useState(mesAtual());

  const { data: dre, isLoading: carregandoDRE } = useQuery({
    queryKey: ['dre', mes],
    queryFn: () => api.get(`/relatorios/dre?mes=${mes}`),
  });

  const { data: evolucao = [] } = useQuery({
    queryKey: ['evolucao'],
    queryFn: () => api.get('/relatorios/evolucao'),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-subtitle capitalize">{mesLabel(mes)}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={mes}
            onChange={e => setMes(e.target.value)}
            className="input max-w-[160px]"
          />
          <button
            onClick={() => exportarRelatorioPDF({ dre, evolucao, mes })}
            disabled={!dre}
            className="btn-secondary flex items-center gap-2"
          >
            📄 Exportar PDF
          </button>
        </div>
      </div>

      {/* DRE */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-slate-800">DRE — Demonstrativo de Resultado</h2>
          <span className="text-xs text-slate-400 capitalize">{mesLabel(mes)}</span>
        </div>
        {carregandoDRE ? (
          <div className="p-6"><PageLoading /></div>
        ) : dre ? (
          <div className="card-body">
            <div className="max-w-lg space-y-1">
              <DRERow label="(+) Faturamento Bruto" valor={dre.faturamento_bruto} bold />
              <DRERow label="(-) Taxas de Cartão" valor={-(dre.taxa_cartao || 0)} negativo />
              <DRERow label="= Faturamento Líquido" valor={dre.faturamento_liquido || 0} bold divider />
              <DRERow label="(-) Despesas Fixas" valor={-dre.despesas_fixas} negativo />
              <DRERow label="(-) Despesas Variáveis" valor={-dre.despesas_variaveis} negativo />
              <DRERow label="= Lucro Líquido" valor={dre.lucro_liquido} bold divider destaque />
            </div>
            {dre.faturamento_bruto > 0 && (
              <p className="text-xs text-slate-400 mt-4">
                Margem líquida:{' '}
                <strong>{pct((dre.lucro_liquido / dre.faturamento_bruto) * 100)}</strong>
              </p>
            )}

            {/* Formas de pagamento */}
            {dre.pagamentos && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                  Formas de Pagamento
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <PagCard label="PIX" valor={dre.pagamentos.pix} cor="text-sky-600" />
                  <PagCard label="Dinheiro" valor={dre.pagamentos.dinheiro} cor="text-emerald-600" />
                  <PagCard label="Crédito" valor={dre.pagamentos.credito} cor="text-violet-600" />
                  <PagCard label="Débito" valor={dre.pagamentos.debito} cor="text-indigo-600" />
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Gráfico evolução */}
      {evolucao.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-slate-800">Evolução Mensal</h2>
          </div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={evolucao.map(e => ({
                  ...e,
                  label: e.mes.slice(5) + '/' + e.mes.slice(2, 4),
                }))}
                margin={{ top: 4, right: 10, bottom: 0, left: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={v => brl(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="faturamento_bruto" name="Faturamento" fill="#e11d48" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro_bruto" name="Líq. s/ Despesas" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lucro_liquido" name="Lucro Líquido" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tabela histórico */}
      {evolucao.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-slate-800">Histórico Mensal</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Mês</th>
                  <th className="text-right">Dias</th>
                  <th className="text-right">Faturamento</th>
                  <th className="text-right">Lucro Bruto</th>
                  <th className="text-right">Lucro Líquido</th>
                </tr>
              </thead>
              <tbody>
                {[...evolucao].reverse().map(e => (
                  <tr key={e.mes}>
                    <td className="font-medium capitalize">{mesLabel(e.mes)}</td>
                    <td className="text-right">{e.total_pedidos}</td>
                    <td className="text-right font-mono">{brl(e.faturamento_bruto)}</td>
                    <td className="text-right font-mono text-emerald-600">{brl(e.lucro_bruto)}</td>
                    <td className={`text-right font-mono font-semibold ${e.lucro_liquido >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {brl(e.lucro_liquido)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

function DRERow({ label, valor, bold, negativo, divider, destaque, sub }) {
  return (
    <div className={[
      'flex items-center justify-between px-3 py-2 rounded-lg text-sm',
      destaque ? 'bg-slate-50 border border-slate-200' : '',
      divider ? 'mt-2' : '',
    ].join(' ')}>
      <div>
        <span className={bold ? 'font-semibold text-slate-900' : 'text-slate-500'}>{label}</span>
        {sub && <span className="text-xs text-slate-400 ml-2">{sub}</span>}
      </div>
      <span className={[
        'font-mono text-sm',
        bold ? 'font-bold' : '',
        (negativo || valor < 0) ? 'text-red-500' : 'text-emerald-600',
      ].join(' ')}>
        {brl(valor)}
      </span>
    </div>
  );
}

function PagCard({ label, valor, cor }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3 text-center">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`font-bold text-sm ${cor}`}>{brl(valor || 0)}</p>
    </div>
  );
}
