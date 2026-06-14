import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, TrendingUp } from 'lucide-react';
import { api } from '../api/client';
import { mesAtual } from '../lib/fmt';
import { PageLoading } from '../components/Loading';

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Cor do CMV: bom (≤30%), atenção (≤45%), ruim (>45%)
function corCmv(cmv, semFicha) {
  if (semFicha) return 'var(--txt-faint)';
  if (cmv <= 30) return '#10b981';
  if (cmv <= 45) return '#f59e0b';
  return '#ef4444';
}

export default function CmvProdutos() {
  const [mes, setMes] = useState(mesAtual());
  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ['cmv-produtos', mes],
    queryFn: () => api.get(`/relatorios/cmv-produtos?mes=${mes}`),
  });

  const comFicha = linhas.filter(l => !l.sem_ficha);
  const semFicha = linhas.filter(l => l.sem_ficha);
  const totReceita = linhas.reduce((s, l) => s + l.receita, 0);
  const totCusto = comFicha.reduce((s, l) => s + l.custo_total, 0);
  const cmvMedio = totReceita > 0 ? (totCusto / totReceita) * 100 : 0;
  const margemTotal = comFicha.reduce((s, l) => s + l.margem, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">CMV por Produto</h1>
          <p className="page-subtitle">Custo, margem e CMV de cada item vendido no mês</p>
        </div>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="input max-w-[160px]" />
      </div>

      {isLoading ? <PageLoading /> : linhas.length === 0 ? (
        <div className="card p-10 text-center" style={{ color: 'var(--txt-dim)' }}>Nenhuma venda registrada neste mês.</div>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Mini label="Receita (vendas)" valor={brl(totReceita)} cor="#3b82f6" />
            <Mini label="Custo (CMV)" valor={brl(totCusto)} cor="#f59e0b" />
            <Mini label="CMV médio" valor={`${cmvMedio.toFixed(1)}%`} cor={corCmv(cmvMedio, false)} destaque />
            <Mini label="Margem total" valor={brl(margemTotal)} cor="#10b981" />
          </div>

          {/* Aviso de itens sem ficha */}
          {semFicha.length > 0 && (
            <div className="rounded-2xl p-3.5 flex items-start gap-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>{semFicha.length} item(ns) vendido(s) sem ficha técnica</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--txt-dim)' }}>
                  Esses entram no CMV como custo 0 (subestimam o custo real). Cadastre a ficha em <b>Cardápio → ícone de ficha</b> no item: {semFicha.slice(0, 6).map(l => l.nome).join(', ')}{semFicha.length > 6 ? '…' : ''}
                </p>
              </div>
            </div>
          )}

          {/* Tabela */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="text-center">Vendas</th>
                    <th className="text-right">Preço médio</th>
                    <th className="text-right">Custo/un</th>
                    <th className="text-center">CMV</th>
                    <th className="text-right">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l => (
                    <tr key={l.nome}>
                      <td className="font-semibold">
                        {l.nome}
                        {l.sem_ficha && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>sem ficha</span>}
                      </td>
                      <td className="text-center font-mono">{l.qtd}</td>
                      <td className="text-right font-mono" style={{ color: 'var(--txt-dim)' }}>{brl(l.preco_medio)}</td>
                      <td className="text-right font-mono">{l.sem_ficha ? '—' : brl(l.custo_unit)}</td>
                      <td className="text-center">
                        <span className="font-black" style={{ color: corCmv(l.cmv, l.sem_ficha) }}>{l.sem_ficha ? '—' : `${l.cmv}%`}</span>
                      </td>
                      <td className="text-right font-mono font-semibold" style={{ color: l.margem >= 0 ? '#10b981' : '#ef4444' }}>{brl(l.margem)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--txt-faint)' }}>
            <TrendingUp size={12} /> CMV ideal pra sushi costuma ficar entre 30% e 40%. Verde ≤30% · amarelo ≤45% · vermelho acima.
          </p>
        </>
      )}
    </div>
  );
}

function Mini({ label, valor, cor, destaque }) {
  return (
    <div className="card p-3.5" style={destaque ? { border: `1px solid ${cor}55` } : undefined}>
      <p className="text-[11px]" style={{ color: 'var(--txt-dim)' }}>{label}</p>
      <p className={`font-black ${destaque ? 'text-xl' : 'text-lg'}`} style={{ color: cor }}>{valor}</p>
    </div>
  );
}
