import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import FormField from '../components/FormField';
import { PageLoading } from '../components/Loading';
import { mesAtual } from '../lib/fmt';

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => { if (!d) return '—'; const [a,m,dia] = d.split('-'); return `${dia}/${m}/${a}`; };

const FORM_VAZIO = { data: new Date().toISOString().slice(0, 10), produto_id: '', quantidade: '1', preco_venda: '' };

export default function VendasDia() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(mesAtual());
  const [form, setForm] = useState(FORM_VAZIO);
  const [editId, setEditId] = useState(null); // id da venda em edição (null = nova)
  const [aba, setAba] = useState('lancamentos'); // lancamentos | ranking

  const { data: vendas = [], isLoading } = useQuery({
    queryKey: ['vendas', mes],
    queryFn: () => api.get(`/vendas?mes=${mes}`),
  });

  const { data: ranking = [] } = useQuery({
    queryKey: ['vendas-ranking', mes],
    queryFn: () => api.get(`/vendas/ranking?mes=${mes}`),
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => api.get('/produtos'),
  });

  const adicionar = useMutation({
    mutationFn: (f) => api.post('/vendas', f),
    onSuccess: () => {
      qc.invalidateQueries(['vendas']);
      qc.invalidateQueries(['vendas-ranking']);
      setForm(p => ({ ...p, produto_id: '', quantidade: '1' }));
      toast.success('Venda registrada!');
    },
    onError: (e) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: ({ id, ...f }) => api.put(`/vendas/${id}`, f),
    onSuccess: () => {
      qc.invalidateQueries(['vendas']);
      qc.invalidateQueries(['vendas-ranking']);
      cancelarEdicao();
      toast.success('Venda atualizada!');
    },
    onError: (e) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: (id) => api.del(`/vendas/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['vendas']);
      qc.invalidateQueries(['vendas-ranking']);
    },
  });

  function iniciarEdicao(v) {
    setEditId(v.id);
    setForm({ data: v.data, produto_id: String(v.produto_id), quantidade: String(v.quantidade), preco_venda: String(v.preco_venda) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function cancelarEdicao() {
    setEditId(null);
    setForm(FORM_VAZIO);
  }

  const totalMes = vendas.reduce((a, v) => a + v.quantidade * v.preco_venda, 0);
  const totalPecas = vendas.reduce((a, v) => a + v.quantidade, 0);

  // Agrupa por data
  const porData = vendas.reduce((acc, v) => {
    if (!acc[v.data]) acc[v.data] = [];
    acc[v.data].push(v);
    return acc;
  }, {});

  return (
    <div className="max-w-4xl mx-auto space-y-5">

      <div className="page-header">
        <div>
          <h1 className="page-title">Vendas por Produto</h1>
          <p className="page-subtitle">{totalPecas} peça(s) · {brl(totalMes)} no mês</p>
        </div>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="input max-w-[160px]" />
      </div>

      {/* Formulário de lançamento / edição */}
      <div className="card p-4">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--accent)' }}>
          {editId ? '✏️ Editar venda' : '+ Registrar venda'}
        </p>
        <form onSubmit={e => {
          e.preventDefault();
          const payload = {
            ...form,
            quantidade: Number(form.quantidade),
            preco_venda: form.preco_venda !== '' ? Number(form.preco_venda) : undefined,
          };
          if (editId) atualizar.mutate({ id: editId, ...payload });
          else adicionar.mutate(payload);
        }} className="flex flex-col sm:flex-row sm:items-end gap-2 sm:flex-wrap">
          <div className="w-40">
            <input type="date" className="input" value={form.data}
              onChange={e => setForm(p => ({ ...p, data: e.target.value }))} required />
          </div>
          <select className="input flex-1 min-w-[180px]" value={form.produto_id}
            onChange={e => setForm(p => ({ ...p, produto_id: e.target.value }))} required>
            <option value="">Selecionar produto...</option>
            {produtos.map(p => (
              <option key={p.id} value={p.id}>{p.nome} — {brl(p.preco_venda)}</option>
            ))}
          </select>
          <div className="w-24">
            <input type="number" className="input text-center" min="1" placeholder="Qtd"
              value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} required />
          </div>
          {/* Preço unitário — editável (em branco usa o preço atual do produto) */}
          <div className="w-32">
            <input type="number" step="0.01" min="0" className="input text-center" placeholder="Preço un (auto)"
              value={form.preco_venda} onChange={e => setForm(p => ({ ...p, preco_venda: e.target.value }))} />
          </div>
          <button type="submit" className="btn-primary" disabled={adicionar.isPending || atualizar.isPending}>
            {editId ? 'Salvar' : 'Registrar'}
          </button>
          {editId && (
            <button type="button" onClick={cancelarEdicao} className="btn-ghost">Cancelar</button>
          )}
        </form>
      </div>

      {/* Abas */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#1a1a1a' }}>
        {[
          { key: 'lancamentos', label: '📋 Lançamentos' },
          { key: 'ranking',     label: '🏆 Ranking' },
        ].map(a => (
          <button key={a.key} onClick={() => setAba(a.key)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              background: aba === a.key ? 'var(--accent)' : 'transparent',
              color: aba === a.key ? '#fff' : '#666',
            }}>
            {a.label}
          </button>
        ))}
      </div>

      {isLoading ? <PageLoading /> : aba === 'lancamentos' ? (

        /* ── Lançamentos agrupados por data ── */
        <div className="space-y-3">
          {Object.keys(porData).length === 0 && (
            <div className="card">
              <div className="empty-state py-16">
                <span className="empty-icon">📦</span>
                <p className="empty-title">Nenhuma venda registrada neste mês</p>
                <p className="empty-sub">Use o formulário acima para lançar as vendas do dia</p>
              </div>
            </div>
          )}
          {Object.entries(porData).map(([data, itens]) => {
            const totalDia = itens.reduce((a, v) => a + v.quantidade * v.preco_venda, 0);
            return (
              <div key={data} className="card overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: '1px solid #1e1e1e', background: 'rgba(var(--accent-rgb),0.05)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>📅 {fmtData(data)}</span>
                    <span className="text-xs" style={{ color: '#555' }}>{itens.length} item(s)</span>
                  </div>
                  <span className="font-bold font-mono text-sm" style={{ color: 'var(--accent)' }}>{brl(totalDia)}</span>
                </div>
                <table className="table">
                  <tbody>
                    {itens.map(v => (
                      <tr key={v.id}>
                        <td className="font-medium">{v.produto_nome}</td>
                        <td style={{ color: '#666' }}>{v.categoria || '—'}</td>
                        <td className="text-center font-mono">
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)' }}>
                            × {v.quantidade}
                          </span>
                        </td>
                        <td className="text-right font-mono" style={{ color: '#888' }}>{brl(v.preco_venda)} / un</td>
                        <td className="text-right font-mono font-semibold">{brl(v.quantidade * v.preco_venda)}</td>
                        <td className="text-right whitespace-nowrap">
                          <button onClick={() => iniciarEdicao(v)}
                            className="btn-ghost btn-icon btn-sm" title="Editar">✏️</button>
                          <button onClick={() => remover.mutate(v.id)}
                            className="btn-ghost btn-icon btn-sm text-red-400 hover:text-red-600" title="Excluir">🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

      ) : (

        /* ── Ranking ── */
        <div className="card overflow-hidden">
          <div className="px-4 py-3" style={{ borderBottom: '1px solid #1e1e1e' }}>
            <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              🏆 Produtos mais vendidos em {mes}
            </span>
          </div>
          {ranking.length === 0 ? (
            <div className="empty-state py-12">
              <p className="empty-title">Sem dados de vendas</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th className="text-center">Qtd Vendida</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => (
                  <tr key={r.id}>
                    <td>
                      <span className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold"
                        style={{
                          background: i === 0 ? 'var(--accent-2)' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7c2f' : '#1e1e1e',
                          color: i < 3 ? '#000' : '#666',
                        }}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="font-semibold">{r.nome}</td>
                    <td style={{ color: '#666' }}>{r.categoria || '—'}</td>
                    <td className="text-center">
                      <span className="font-bold font-mono" style={{ color: 'var(--accent)' }}>{r.total_qtd}</span>
                      <span style={{ color: '#555' }} className="text-xs"> un</span>
                    </td>
                    <td className="text-right font-mono font-bold">{brl(r.total_valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
