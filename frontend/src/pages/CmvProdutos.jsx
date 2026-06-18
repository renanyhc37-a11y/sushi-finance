import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, TrendingUp, Pencil, Check, X } from 'lucide-react';
import { api } from '../api/client';
import { mesAtual } from '../lib/fmt';
import { PageLoading } from '../components/Loading';
import toast, { Toaster } from 'react-hot-toast';

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function corCmv(cmv, semFicha) {
  if (semFicha) return 'var(--txt-faint)';
  if (cmv <= 30) return '#10b981';
  if (cmv <= 45) return '#f59e0b';
  return '#ef4444';
}

function CustoEditavel({ linha, onSalvo }) {
  const [editando, setEditando] = useState(false);
  const [val, setVal] = useState('');
  const inputRef = useRef(null);

  function abrir() {
    setVal(linha.custo_unit > 0 ? String(linha.custo_unit).replace('.', ',') : '');
    setEditando(true);
    setTimeout(() => inputRef.current?.select(), 50);
  }

  async function salvar() {
    const custo = parseFloat(String(val).replace(',', '.'));
    if (isNaN(custo) || custo < 0) { toast.error('Valor inválido'); return; }
    try {
      await api.patch(`/relatorios/cmv-produtos/${encodeURIComponent(linha.nome)}/custo`, { custo });
      toast.success('Custo salvo!');
      setEditando(false);
      onSalvo();
    } catch (e) { toast.error(e.message); }
  }

  function cancelar() { setEditando(false); }

  if (editando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 11, color: 'var(--txt-faint)' }}>R$</span>
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') cancelar(); }}
          style={{ width: 72, padding: '3px 6px', borderRadius: 8, fontSize: 12, textAlign: 'right', fontFamily: 'monospace', background: '#1a1a2e', border: '1px solid var(--accent)', color: 'var(--txt-strong)', outline: 'none' }}
          autoFocus
        />
        <button onClick={salvar} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
          <Check size={12} strokeWidth={2.5} />
        </button>
        <button onClick={cancelar} style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
          <X size={12} strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      <span style={{ fontFamily: 'monospace', color: linha.sem_ficha && !linha.custo_manual ? 'var(--txt-faint)' : 'var(--txt)' }}>
        {linha.custo_unit > 0 ? brl(linha.custo_unit) : '—'}
      </span>
      {linha.custo_manual && (
        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>manual</span>
      )}
      <button onClick={abrir} title="Editar custo"
        style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'rgba(255,255,255,0.04)', color: 'var(--accent)', flexShrink: 0 }}>
        <Pencil size={11} strokeWidth={2} />
      </button>
    </div>
  );
}

export default function CmvProdutos() {
  const [mes, setMes] = useState(mesAtual());
  const qc = useQueryClient();
  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ['cmv-produtos', mes],
    queryFn: () => api.get(`/relatorios/cmv-produtos?mes=${mes}`),
  });

  const comFicha = linhas.filter(l => !l.sem_ficha || l.custo_manual);
  const semFicha = linhas.filter(l => l.sem_ficha && !l.custo_manual);
  const totReceita = linhas.reduce((s, l) => s + l.receita, 0);
  const totCusto = comFicha.reduce((s, l) => s + l.custo_total, 0);
  const cmvMedio = totReceita > 0 ? (totCusto / totReceita) * 100 : 0;
  const margemTotal = comFicha.reduce((s, l) => s + l.margem, 0);

  const invalidar = () => qc.invalidateQueries(['cmv-produtos', mes]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Toaster position="top-right" />
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
                <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>{semFicha.length} item(ns) vendido(s) sem custo definido</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--txt-dim)' }}>
                  Clique na coluna <b>Custo/un</b> de qualquer item para inserir o custo manualmente, ou cadastre a ficha técnica no Cardápio. Itens: {semFicha.slice(0, 6).map(l => l.nome).join(', ')}{semFicha.length > 6 ? '…' : ''}
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
                    <th className="text-right">
                      <span className="flex items-center gap-1 justify-end">
                        Custo/un
                        <Pencil size={10} style={{ color: 'var(--accent)', opacity: 0.7 }} />
                      </span>
                    </th>
                    <th className="text-center">CMV</th>
                    <th className="text-right">Margem</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l => (
                    <tr key={l.nome}>
                      <td className="font-semibold">
                        {l.nome}
                        {l.sem_ficha && !l.custo_manual && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>sem ficha</span>
                        )}
                      </td>
                      <td className="text-center font-mono">{l.qtd}</td>
                      <td className="text-right font-mono" style={{ color: 'var(--txt-dim)' }}>{brl(l.preco_medio)}</td>
                      <td className="text-right">
                        <CustoEditavel linha={l} onSalvo={invalidar} />
                      </td>
                      <td className="text-center">
                        <span className="font-black" style={{ color: corCmv(l.cmv, l.sem_ficha && !l.custo_manual) }}>
                          {(l.sem_ficha && !l.custo_manual) ? '—' : `${l.cmv}%`}
                        </span>
                      </td>
                      <td className="text-right font-mono font-semibold" style={{ color: l.margem >= 0 ? '#10b981' : '#ef4444' }}>{brl(l.margem)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--txt-faint)' }}>
            <TrendingUp size={12} /> CMV ideal pra sushi costuma ficar entre 30% e 40%. Verde ≤30% · amarelo ≤45% · vermelho acima. Clique em Custo/un para editar diretamente.
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
