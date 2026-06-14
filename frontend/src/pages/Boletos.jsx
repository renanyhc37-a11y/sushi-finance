import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineQuery } from '../hooks/useOfflineQuery';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField from '../components/FormField';
import { PageLoading } from '../components/Loading';

const brl = (v) => v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtData = (d) => { if (!d) return '—'; const [a,m,dia] = d.slice(0,10).split('-'); return `${dia}/${m}/${a}`; };
const diasParaVencer = (d) => { if (!d) return null; const diff = new Date(d+'T12:00:00') - new Date(); return Math.ceil(diff / 86400000); };

const ITEM_VAZIO = { descricao: '', quantidade: '1', unidade: 'unidade', valor_unitario: '' };
const UNIDADES = ['unidade', 'kg', 'g', 'litro', 'ml', 'caixa', 'pacote', 'dúzia'];

const FORM_VAZIO = {
  fornecedor: '', descricao: '',
  data_chegada: new Date().toISOString().slice(0, 10),
  data_vencimento: '',
  itens: [{ ...ITEM_VAZIO }],
};

export default function Boletos() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState('todos'); // todos | pendente | vencido | pago
  const [modal, setModal] = useState(null); // null | 'novo' | boleto
  const [confirmPagar, setConfirmPagar] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);

  const { data: boletos = [], isLoading, isOffline } = useOfflineQuery(
    ['boletos'],
    () => api.get('/boletos'),
  );

  const salvar = useMutation({
    mutationFn: (f) => modal === 'novo' ? api.post('/boletos', f) : api.put(`/boletos/${modal.id}`, f),
    onSuccess: () => {
      qc.invalidateQueries(['boletos']);
      toast.success(modal === 'novo' ? 'Boleto cadastrado!' : 'Boleto atualizado!');
      setModal(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const pagar = useMutation({
    mutationFn: ({ id, data_pagamento }) => api.patch(`/boletos/${id}/pagar`, { data_pagamento }),
    onSuccess: () => {
      qc.invalidateQueries(['boletos']);
      qc.invalidateQueries(['despesas']);
      toast.success('Boleto pago! Lançado nas despesas automaticamente.');
      setConfirmPagar(null);
    },
    onError: (e) => { toast.error(e.message); setConfirmPagar(null); },
  });

  const excluir = useMutation({
    mutationFn: (id) => api.del(`/boletos/${id}`),
    onSuccess: () => { qc.invalidateQueries(['boletos']); toast.success('Boleto removido.'); setConfirmDel(null); },
    onError: (e) => { toast.error(e.message); setConfirmDel(null); },
  });

  const abrirNovo = () => { setForm(FORM_VAZIO); setModal('novo'); };
  const abrirEditar = (b) => {
    setForm({
      fornecedor: b.fornecedor,
      descricao: b.descricao || '',
      data_chegada: b.data_chegada,
      data_vencimento: b.data_vencimento,
      itens: b.itens.length ? b.itens.map(i => ({
        descricao: i.descricao, quantidade: String(i.quantidade),
        unidade: i.unidade, valor_unitario: String(i.valor_unitario),
      })) : [{ ...ITEM_VAZIO }],
    });
    setModal(b);
  };

  const addItem = () => setForm(p => ({ ...p, itens: [...p.itens, { ...ITEM_VAZIO }] }));
  const removeItem = (idx) => setForm(p => ({ ...p, itens: p.itens.filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, val) => setForm(p => {
    const itens = [...p.itens];
    itens[idx] = { ...itens[idx], [field]: val };
    return { ...p, itens };
  });

  const totalForm = form.itens.reduce((acc, i) => acc + (Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0), 0);

  const lista = boletos.filter(b => filtro === 'todos' || b.status === filtro);
  const pendentes = boletos.filter(b => b.status === 'pendente');
  const vencidos  = boletos.filter(b => b.status === 'vencido');
  const totalPendente = [...pendentes, ...vencidos].reduce((a, b) => a + b.valor_total, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {isOffline && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200">
          <span className="text-lg">📡</span>
          <p className="text-sm font-semibold">Modo offline — exibindo dados salvos</p>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Boletos</h1>
          <p className="page-subtitle">
            {pendentes.length + vencidos.length} pendente(s) · {brl(totalPendente)} a pagar
          </p>
        </div>
        {!isOffline && <button onClick={abrirNovo} className="btn-primary">+ Novo Boleto</button>}
      </div>

      {/* Alertas de vencidos */}
      {vencidos.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <span className="text-xl">🚨</span>
          <div>
            <p className="font-semibold text-red-700 dark:text-red-400 text-sm">
              {vencidos.length} boleto(s) vencido(s)!
            </p>
            <p className="text-xs text-red-500 dark:text-red-500 mt-0.5">
              {vencidos.map(b => b.fornecedor).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'todos', label: 'Todos', count: boletos.length },
          { key: 'pendente', label: 'Pendentes', count: pendentes.length },
          { key: 'vencido', label: 'Vencidos', count: vencidos.length },
          { key: 'pago', label: 'Pagos', count: boletos.filter(b => b.status === 'pago').length },
        ].map(f => (
          <button key={f.key} onClick={() => setFiltro(f.key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
              filtro === f.key
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-rose-300'
            }`}>
            {f.label} {f.count > 0 && <span className="ml-1 opacity-70">({f.count})</span>}
          </button>
        ))}
      </div>

      {isLoading ? <PageLoading /> : (
        <div className="space-y-3">
          {!lista.length && (
            <div className="card">
              <div className="empty-state py-16">
                <span className="empty-icon">🧾</span>
                <p className="empty-title">Nenhum boleto encontrado</p>
                <p className="empty-sub">Clique em "+ Novo Boleto" para cadastrar</p>
              </div>
            </div>
          )}
          {lista.map(b => <CardBoleto key={b.id} boleto={b} onEditar={abrirEditar} onPagar={setConfirmPagar} onExcluir={setConfirmDel} />)}
        </div>
      )}

      {/* Modal novo/editar */}
      {modal && (
        <Modal
          titulo={modal === 'novo' ? 'Novo Boleto' : `Editar — ${modal.fornecedor}`}
          onClose={() => setModal(null)} size="lg"
        >
          <form onSubmit={e => {
            e.preventDefault();
            salvar.mutate({
              ...form,
              itens: form.itens.map(i => ({
                ...i, quantidade: Number(i.quantidade), valor_unitario: Number(i.valor_unitario),
              })),
            });
          }} className="space-y-5">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Fornecedor" required>
                <input className="input" required autoFocus placeholder="Ex: Peixaria Central"
                  value={form.fornecedor} onChange={e => setForm(p => ({ ...p, fornecedor: e.target.value }))} />
              </FormField>
              <FormField label="Descrição (opcional)">
                <input className="input" placeholder="Ex: Pedido #123"
                  value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Data de chegada" required>
                <input type="date" className="input" required value={form.data_chegada}
                  onChange={e => setForm(p => ({ ...p, data_chegada: e.target.value }))} />
              </FormField>
              <FormField label="Data de vencimento" required>
                <input type="date" className="input" required value={form.data_vencimento}
                  onChange={e => setForm(p => ({ ...p, data_vencimento: e.target.value }))} />
              </FormField>
            </div>

            {/* Itens */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="label mb-0">Produtos / Itens</label>
                <button type="button" onClick={addItem}
                  className="btn-ghost btn-sm text-rose-600 hover:bg-rose-50">+ Adicionar item</button>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_80px_100px_110px_32px] gap-2 px-1 text-xs font-semibold text-slate-400 uppercase">
                  <span>Descrição</span><span>Qtd</span><span>Unidade</span><span className="text-right">Valor unit.</span><span></span>
                </div>
                {form.itens.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_80px_100px_110px_32px] gap-2 items-center">
                    <input className="input" placeholder="Ex: Salmão" value={item.descricao}
                      onChange={e => updateItem(idx, 'descricao', e.target.value)} required />
                    <input type="number" className="input" placeholder="1" min="0.01" step="0.01"
                      value={item.quantidade} onChange={e => updateItem(idx, 'quantidade', e.target.value)} />
                    <select className="input" value={item.unidade}
                      onChange={e => updateItem(idx, 'unidade', e.target.value)}>
                      {UNIDADES.map(u => <option key={u}>{u}</option>)}
                    </select>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">R$</span>
                      <input type="number" className="input pl-8 text-right" placeholder="0,00" min="0" step="0.01"
                        value={item.valor_unitario} onChange={e => updateItem(idx, 'valor_unitario', e.target.value)} />
                    </div>
                    <button type="button" onClick={() => removeItem(idx)}
                      disabled={form.itens.length === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30">✕</button>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="mt-3 flex justify-end">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl px-5 py-3 text-right">
                  <p className="text-xs text-slate-500 mb-0.5">Total do boleto</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{brl(totalForm)}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              <button type="button" onClick={() => setModal(null)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary" disabled={salvar.isPending}>
                {salvar.isPending ? 'Salvando...' : 'Salvar Boleto'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirmar pagamento */}
      {confirmPagar && (
        <ModalPagar
          boleto={confirmPagar}
          onConfirm={(data) => pagar.mutate({ id: confirmPagar.id, data_pagamento: data })}
          onCancel={() => setConfirmPagar(null)}
          loading={pagar.isPending}
        />
      )}

      {confirmDel && (
        <ConfirmDialog
          titulo="Excluir boleto?"
          mensagem={`Boleto de "${confirmDel.fornecedor}" (${brl(confirmDel.valor_total)}) será removido.`}
          onConfirm={() => excluir.mutate(confirmDel.id)}
          onCancel={() => setConfirmDel(null)}
          loading={excluir.isPending}
        />
      )}
    </div>
  );
}

/* ── Card do boleto ── */
function CardBoleto({ boleto, onEditar, onPagar, onExcluir }) {
  const [expandido, setExpandido] = useState(false);
  const dias = diasParaVencer(boleto.data_vencimento);

  const statusInfo = {
    pendente: { cor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700', label: 'Pendente', icon: '⏳' },
    vencido:  { cor: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700', label: 'Vencido', icon: '🚨' },
    pago:     { cor: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700', label: 'Pago', icon: '✅' },
  }[boleto.status];

  const cardBorder = boleto.status === 'vencido'
    ? 'border-red-200 dark:border-red-800'
    : boleto.status === 'pago'
    ? 'border-emerald-200 dark:border-emerald-800'
    : 'border-slate-200 dark:border-slate-700';

  return (
    <div className={`card border ${cardBorder}`}>
      {/* Cabeçalho do card */}
      <div className="p-4 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 dark:text-slate-100">{boleto.fornecedor}</span>
            {boleto.descricao && <span className="text-sm text-slate-500 dark:text-slate-400">· {boleto.descricao}</span>}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.cor}`}>
              {statusInfo.icon} {statusInfo.label}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span>📅 Chegada: <span className="font-medium">{fmtData(boleto.data_chegada)}</span></span>
            <span>⏰ Vencimento: <span className={`font-medium ${boleto.status === 'vencido' ? 'text-red-600 dark:text-red-400' : ''}`}>
              {fmtData(boleto.data_vencimento)}
              {boleto.status === 'pendente' && dias !== null && (
                <span className={`ml-1 ${dias <= 3 ? 'text-red-500' : dias <= 7 ? 'text-amber-500' : 'text-slate-400'}`}>
                  ({dias > 0 ? `${dias}d` : 'hoje'})
                </span>
              )}
              {boleto.status === 'vencido' && <span className="ml-1 text-red-500">({Math.abs(dias)}d atrás)</span>}
            </span></span>
            {boleto.status === 'pago' && boleto.data_pagamento && (
              <span>💰 Pago em: <span className="font-medium text-emerald-600 dark:text-emerald-400">{fmtData(boleto.data_pagamento)}</span></span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{brl(boleto.valor_total)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{boleto.itens.length} item(s)</p>
        </div>
      </div>

      {/* Itens expandidos */}
      {expandido && boleto.itens.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold text-slate-400 uppercase">
                <th className="text-left pb-2">Produto</th>
                <th className="text-right pb-2">Qtd</th>
                <th className="text-right pb-2">Valor unit.</th>
                <th className="text-right pb-2">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {boleto.itens.map(item => (
                <tr key={item.id}>
                  <td className="py-1.5 text-slate-700 dark:text-slate-300">{item.descricao}</td>
                  <td className="py-1.5 text-right text-slate-500">{item.quantidade} {item.unidade}</td>
                  <td className="py-1.5 text-right text-slate-500">{brl(item.valor_unitario)}</td>
                  <td className="py-1.5 text-right font-semibold text-slate-800 dark:text-slate-200">
                    {brl(item.quantidade * item.valor_unitario)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rodapé com ações */}
      <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2.5 flex items-center justify-between gap-2">
        <button onClick={() => setExpandido(!expandido)}
          className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1 transition-colors">
          {expandido ? '▲ Ocultar itens' : '▼ Ver itens'}
        </button>
        <div className="flex gap-2">
          {boleto.status !== 'pago' && (
            <>
              <button onClick={() => onEditar(boleto)} className="btn-secondary btn-sm">✏️ Editar</button>
              <button onClick={() => onPagar(boleto)}
                className="btn-sm px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors">
                💳 Dar baixa
              </button>
            </>
          )}
          <button onClick={() => onExcluir(boleto)}
            className="btn-ghost btn-icon btn-sm text-red-400 hover:text-red-600 hover:bg-red-50">🗑️</button>
        </div>
      </div>
    </div>
  );
}

/* ── Modal dar baixa ── */
function ModalPagar({ boleto, onConfirm, onCancel, loading }) {
  const [dataPag, setDataPag] = useState(new Date().toISOString().slice(0, 10));
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="text-center">
          <span className="text-4xl">💳</span>
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-2">Dar baixa no boleto</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            <span className="font-semibold">{boleto.fornecedor}</span> · {brl(boleto.valor_total)}
          </p>
        </div>
        <div>
          <label className="label">Data do pagamento</label>
          <input type="date" className="input" value={dataPag} onChange={e => setDataPag(e.target.value)} />
        </div>
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-xs text-slate-500 dark:text-slate-400">
          ℹ️ Uma despesa de <span className="font-semibold text-slate-700 dark:text-slate-200">{brl(boleto.valor_total)}</span> será lançada automaticamente em <strong>Despesas Variáveis → Fornecedor</strong>.
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} className="btn-secondary flex-1" disabled={loading}>Cancelar</button>
          <button onClick={() => onConfirm(dataPag)} disabled={loading}
            className="flex-1 btn-sm py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors">
            {loading ? 'Processando...' : '✓ Confirmar pagamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
