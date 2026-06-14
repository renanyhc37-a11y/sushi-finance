import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import StatCard from '../components/Card';
import { PageLoading } from '../components/Loading';
import { brl, mesAtual } from '../lib/fmt';

const ORIGENS = ['manual', 'ifood', 'rappi', 'whatsapp', 'balcao'];
const ORIGEM_BADGE = {
  ifood:    'badge-red',
  rappi:    'badge-orange',
  whatsapp: 'badge-green',
  balcao:   'badge-blue',
  manual:   'badge-gray',
};

const ITEM_VAZIO = { produto_id: '', quantidade: 1, preco_unitario: '' };

export default function Pedidos() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(mesAtual());
  const [modal, setModal] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [form, setForm] = useState({ data: '', origem: 'manual', observacao: '' });
  const [itens, setItens] = useState([ITEM_VAZIO]);
  const [expandido, setExpandido] = useState(null);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos', mes],
    queryFn: () => api.get(`/pedidos?mes=${mes}`),
  });
  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => api.get('/produtos'),
  });

  const totalMes = pedidos.reduce((acc, p) => acc + p.total_bruto, 0);
  const custoMes = pedidos.reduce((acc, p) => acc + p.custo_total, 0);
  const lucroMes = totalMes - custoMes;

  const salvar = useMutation({
    mutationFn: () => {
      const itensFiltrados = itens.filter(i => i.produto_id && Number(i.quantidade) > 0 && Number(i.preco_unitario) > 0);
      if (!itensFiltrados.length) throw new Error('Adicione ao menos um item com produto, quantidade e preço.');
      return api.post('/pedidos', {
        ...form,
        data: form.data || new Date().toISOString().slice(0, 10),
        itens: itensFiltrados.map(i => ({
          produto_id: Number(i.produto_id),
          quantidade: Number(i.quantidade),
          preco_unitario: Number(i.preco_unitario),
        })),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries(['pedidos']);
      qc.invalidateQueries(['dashboard']);
      toast.success('Pedido registrado!');
      setModal(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: (id) => api.del(`/pedidos/${id}`),
    onSuccess: () => {
      qc.invalidateQueries(['pedidos']);
      qc.invalidateQueries(['dashboard']);
      toast.success('Pedido excluído.');
      setConfirmDel(null);
    },
    onError: (e) => { toast.error(e.message); setConfirmDel(null); },
  });

  const abrirNovo = () => {
    setForm({ data: new Date().toISOString().slice(0, 10), origem: 'manual', observacao: '' });
    setItens([{ ...ITEM_VAZIO }]);
    setModal(true);
  };

  const addItem = () => setItens(p => [...p, { ...ITEM_VAZIO }]);
  const removeItem = (idx) => setItens(p => p.filter((_, i) => i !== idx));
  const updateItem = (idx, field, val) => setItens(p => {
    const it = [...p];
    it[idx] = { ...it[idx], [field]: val };
    if (field === 'produto_id' && val) {
      const prod = produtos.find(x => x.id === Number(val));
      if (prod) it[idx].preco_unitario = prod.preco_venda;
    }
    return it;
  });

  const totalPreview = itens.reduce((acc, i) =>
    acc + (Number(i.preco_unitario || 0) * Number(i.quantidade || 0)), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Pedidos</h1>
          <p className="page-subtitle">{pedidos.length} pedido(s) em {mes}</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="input max-w-[160px]" />
          <button onClick={abrirNovo} className="btn-primary">+ Novo Pedido</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard titulo="Pedidos" valor={pedidos.length} icon="🛒" />
        <StatCard titulo="Faturamento" valor={brl(totalMes)} icon="💰" cor="green" />
        <StatCard titulo="Custo (CMV)" valor={brl(custoMes)} icon="📦" cor="yellow" />
        <StatCard titulo="Lucro Bruto" valor={brl(lucroMes)} icon="✅" cor={lucroMes >= 0 ? 'green' : 'red'} />
      </div>

      {isLoading ? <PageLoading /> : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Origem</th>
                <th className="text-right">Total</th>
                <th className="text-right">Custo</th>
                <th className="text-right">Lucro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map(p => (
                <React.Fragment key={p.id}>
                  <tr>
                    <td className="font-medium">{p.data}</td>
                    <td>
                      <span className={ORIGEM_BADGE[p.origem] || 'badge-gray'}>{p.origem}</span>
                    </td>
                    <td className="text-right font-mono font-medium">{brl(p.total_bruto)}</td>
                    <td className="text-right font-mono text-slate-500">{brl(p.custo_total)}</td>
                    <td className={`text-right font-mono font-semibold ${p.total_bruto - p.custo_total >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {brl(p.total_bruto - p.custo_total)}
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => setExpandido(expandido === p.id ? null : p.id)}
                          className="btn-ghost btn-icon btn-sm text-slate-400"
                          title="Ver itens"
                        >
                          {expandido === p.id ? '▲' : '▼'}
                        </button>
                        <button onClick={() => setConfirmDel(p)}
                          className="btn-ghost btn-icon btn-sm text-red-400 hover:text-red-600 hover:bg-red-50">🗑️</button>
                      </div>
                    </td>
                  </tr>
                  {expandido === p.id && p.itens?.length > 0 && (
                    <tr className="bg-slate-50">
                      <td colSpan={6} className="px-8 py-3">
                        <div className="space-y-1">
                          {p.itens.map((it, i) => (
                            <div key={i} className="flex justify-between text-xs text-slate-600">
                              <span>{it.quantidade}x {it.produto_nome}</span>
                              <span>{brl(it.preco_unitario * it.quantidade)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
              {!pedidos.length && (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <span className="empty-icon">🛒</span>
                    <p className="empty-title">Nenhum pedido neste mês</p>
                    <p className="empty-sub">Clique em "+ Novo Pedido" para registrar</p>
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal titulo="Novo Pedido" onClose={() => setModal(false)} size="lg">
          <form onSubmit={e => { e.preventDefault(); salvar.mutate(); }} className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Data</label>
                <input type="date" className="input" value={form.data}
                  onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
              </div>
              <div>
                <label className="label">Origem</label>
                <select className="input" value={form.origem}
                  onChange={e => setForm(p => ({ ...p, origem: e.target.value }))}>
                  {ORIGENS.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Observação</label>
                <input className="input" placeholder="Opcional" value={form.observacao}
                  onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="label mb-0">Itens do Pedido *</label>
                <button type="button" onClick={addItem} className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50">
                  + Item
                </button>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_80px_120px_32px] gap-2 px-1 text-xs font-semibold text-slate-400 uppercase">
                  <span>Produto</span><span>Qtd</span><span>Preço Unit.</span><span></span>
                </div>
                {itens.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_120px_32px] gap-2 items-center">
                    <select className="input" value={item.produto_id}
                      onChange={e => updateItem(idx, 'produto_id', e.target.value)}>
                      <option value="">Produto...</option>
                      {produtos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </select>
                    <input type="number" min="1" className="input" value={item.quantidade}
                      onChange={e => updateItem(idx, 'quantidade', e.target.value)} />
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">R$</span>
                      <input type="number" step="0.01" className="input pl-7" value={item.preco_unitario}
                        onChange={e => updateItem(idx, 'preco_unitario', e.target.value)} />
                    </div>
                    <button type="button" onClick={() => removeItem(idx)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {totalPreview > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-emerald-700 font-medium">Total do pedido</span>
                <span className="text-xl font-bold text-emerald-700">{brl(totalPreview)}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setModal(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary" disabled={salvar.isPending}>
                {salvar.isPending ? 'Salvando...' : 'Registrar Pedido'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDialog
          titulo="Excluir pedido?"
          mensagem={`Pedido de ${brl(confirmDel.total_bruto)} em ${confirmDel.data} será excluído permanentemente.`}
          onConfirm={() => excluir.mutate(confirmDel.id)}
          onCancel={() => setConfirmDel(null)}
          loading={excluir.isPending}
        />
      )}
    </div>
  );
}
