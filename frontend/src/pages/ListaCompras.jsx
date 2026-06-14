import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { PageLoading } from '../components/Loading';
import { useListaOffline } from '../hooks/useListaOffline';
import {
  ShoppingCart, Star, Trash2, WifiOff, RefreshCw, AlertTriangle, CheckCircle2,
  Banknote, Plus, Pencil, Check, X, Package, ListChecks, Coins,
} from 'lucide-react';

const UNIDADES = ['unidade', 'kg', 'g', 'litro', 'ml', 'caixa', 'pacote', 'dúzia'];
const FORM_VAZIO = { nome: '', quantidade: '1', unidade: 'unidade', observacao: '' };
const brl = (v) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ListaCompras() {
  const [aba, setAba] = useState('lista'); // 'lista' | 'catalogo'

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        <button
          onClick={() => setAba('lista')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            aba === 'lista'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-1.5"><ShoppingCart size={15} strokeWidth={1.75} /> Lista Ativa</span>
        </button>
        <button
          onClick={() => setAba('catalogo')}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            aba === 'catalogo'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-1.5"><Star size={15} strokeWidth={1.75} /> Meus Itens</span>
        </button>
      </div>

      {aba === 'lista' ? <AbaLista onVerCatalogo={() => setAba('catalogo')} /> : <AbaCatalogo />}
    </div>
  );
}

/* ─────────────────── ABA LISTA ATIVA ─────────────────── */
function AbaLista({ onVerCatalogo }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(FORM_VAZIO);
  const [editando, setEditando] = useState(null);

  // Hook offline-first — substitui useQuery + mutations para a lista
  const {
    lista: itens, online, syncing, loading: isLoading, qtdFila,
    buscar, adicionarItem, marcarItem, removerItem, editarItem,
  } = useListaOffline();

  // Sugestões e catálogo continuam via react-query (apenas leitura, não críticos offline)
  const { data: sugestoes = [] } = useQuery({
    queryKey: ['lista-compras-sugestoes'],
    queryFn: () => api.get('/lista-compras/sugestoes'),
    enabled: online,
  });
  const { data: catalogo = [] } = useQuery({
    queryKey: ['catalogo-compras'],
    queryFn: () => api.get('/lista-compras/catalogo'),
    enabled: online,
  });

  // Limpar comprados — online only (bulk delete)
  const limparComprados = useMutation({
    mutationFn: () => api.del('/lista-compras/comprados/limpar'),
    onSuccess: () => {
      buscar();
      toast.success('Itens comprados removidos!');
    },
  });

  // Lançar nas despesas — online only
  const lancarDespesa = useMutation({
    mutationFn: (body) => api.post('/despesas', body),
    onSuccess: (_, vars) => {
      toast.success(`R$ ${vars.valor.toFixed(2).replace('.', ',')} lançado nas despesas!`);
    },
    onError: (e) => toast.error(e.message),
  });

  const salvarCatalogo = (item) => {
    if (!online) { toast.error('Sem conexão — não é possível salvar no catálogo agora'); return; }
    api.post('/lista-compras/catalogo', {
      nome: item.nome, quantidade: item.quantidade,
      unidade: item.unidade, observacao: item.observacao,
    }).then(() => {
      qc.invalidateQueries(['catalogo-compras']);
      toast.success(`"${item.nome}" salvo no catálogo!`);
    }).catch(e => toast.error(e.message === 'Item já está no catálogo' ? `"${item.nome}" já está no catálogo` : e.message));
  };

  const adicionarSugestao = (s) => {
    adicionarItem({ nome: s.nome, quantidade: 1, unidade: s.unidade_medida, ingrediente_id: s.id });
  };

  const pendentes = itens.filter(i => !i.comprado);
  const comprados = itens.filter(i => i.comprado);
  const nomesNoCatalogo = new Set(catalogo.map(c => c.nome.toLowerCase()));

  const enviarWhatsApp = () => {
    if (!pendentes.length) { toast.error('Nenhum item pendente!'); return; }
    const texto = [
      '🛒 *Lista de Compras — Sushi Finance*', '',
      ...pendentes.map(i => `▫️ ${i.nome}${i.observacao ? ` (${i.observacao})` : ''}`),
      '', `_${pendentes.length} item(s) · ${new Date().toLocaleDateString('pt-BR')}_`,
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  return (
    <div className="space-y-4">

      {/* ── Banner offline / sincronizando ── */}
      {!online && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200">
          <WifiOff size={18} strokeWidth={1.75} className="shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Modo offline — exibindo lista salva</p>
            {qtdFila > 0 && (
              <p className="text-xs opacity-75 mt-0.5">
                {qtdFila} alteração(ões) pendente(s) para sincronizar quando reconectar
              </p>
            )}
          </div>
        </div>
      )}
      {online && syncing && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-200">
          <RefreshCw size={18} strokeWidth={1.75} className="animate-spin shrink-0" />
          <p className="text-sm font-medium">Sincronizando alterações offline…</p>
        </div>
      )}
      {online && !syncing && qtdFila === 0 && (
        /* Pill verde discreto quando tudo online e sem fila */
        null
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Lista de Compras</h1>
          <p className="page-subtitle">
            {pendentes.length} pendente(s){comprados.length > 0 ? ` · ${comprados.length} comprado(s)` : ''}
            {!online && <span className="ml-2 text-amber-600 dark:text-amber-400 font-semibold">· offline</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={onVerCatalogo} className="btn-secondary text-sm flex items-center gap-1.5" disabled={!online}>
            <Star size={14} strokeWidth={1.75} /> Usar catálogo
          </button>
          {comprados.length > 0 && (
            <button
              onClick={() => limparComprados.mutate()}
              className="btn-secondary text-sm flex items-center gap-1.5"
              disabled={!online || limparComprados.isPending}
              title={!online ? 'Não disponível offline' : ''}
            >
              <Trash2 size={14} strokeWidth={1.75} /> Limpar comprados
            </button>
          )}
          <button onClick={enviarWhatsApp}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition-colors shadow-sm">
            <WhatsAppIcon /> Enviar no WhatsApp
          </button>
        </div>
      </div>

      {/* Barra de progresso da compra */}
      {(pendentes.length + comprados.length) > 0 && (() => {
        const total = pendentes.length + comprados.length;
        const pct = Math.round((comprados.length / total) * 100);
        const gasto = comprados.reduce((a, d) => a + (d.valor_pago ?? 0), 0);
        return (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2.5">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <ListChecks size={16} strokeWidth={1.75} className="text-orange-500" />
                {comprados.length} de {total} comprados
              </span>
              {gasto > 0 && (
                <span className="flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  <Coins size={15} strokeWidth={1.75} /> {brl(gasto)}
                </span>
              )}
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
            </div>
          </div>
        );
      })()}

      {/* Sugestões de estoque zerado (online only) */}
      {online && sugestoes.length > 0 && (
        <div className="card p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">
            <AlertTriangle size={15} strokeWidth={1.75} className="text-amber-500" /> Estoque zerado — adicionar à lista?
          </p>
          <div className="flex flex-wrap gap-2">
            {sugestoes.map(s => (
              <button key={s.id} onClick={() => adicionarSugestao(s)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700 hover:bg-amber-100 transition-colors">
                + {s.nome} <span className="text-amber-500">({s.unidade_medida})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Formulário de adicionar */}
      <div className="card p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3"><Plus size={15} strokeWidth={2} /> Adicionar item</p>
        <form onSubmit={e => { e.preventDefault(); adicionarItem(form); setForm(FORM_VAZIO); }}
          className="flex flex-col sm:flex-row gap-2">
          <input className="input flex-1" placeholder="Nome do item..." value={form.nome}
            onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} required />
          <input type="number" className="input w-24" placeholder="Qtd" min="0.01" step="0.01"
            value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} />
          <select className="input w-32" value={form.unidade}
            onChange={e => setForm(p => ({ ...p, unidade: e.target.value }))}>
            {UNIDADES.map(u => <option key={u}>{u}</option>)}
          </select>
          <input className="input flex-1" placeholder="Obs. (opcional)" value={form.observacao}
            onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))} />
          <button type="submit" className="btn-primary whitespace-nowrap">
            Adicionar
          </button>
        </form>
        {!online && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-2">
            <WifiOff size={12} strokeWidth={1.75} /> Offline — o item será adicionado localmente e sincronizado ao reconectar.
          </p>
        )}
      </div>

      {isLoading && !itens.length ? <PageLoading /> : (
        <div className="space-y-2">
          {!itens.length && (
            <div className="card">
              <div className="empty-state py-16">
                <span className="empty-icon flex justify-center"><ShoppingCart size={44} strokeWidth={1.4} /></span>
                <p className="empty-title">Lista vazia</p>
                <p className="empty-sub">Adicione itens ou use o catálogo de itens salvos</p>
              </div>
            </div>
          )}

          {pendentes.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300"><ShoppingCart size={15} strokeWidth={1.75} /> Pendentes ({pendentes.length})</span>
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {pendentes.map(item => (
                  <ItemLinha key={item.id} item={item} editando={editando} setEditando={setEditando}
                    noCatalogo={nomesNoCatalogo.has(item.nome.toLowerCase())}
                    online={online}
                    onMarcar={(c, vp, qtd, un) => marcarItem(item.id, c, { valor_pago: vp, qtd_comprada: qtd, unidade_comprada: un })}
                    onRemover={() => removerItem(item.id)}
                    onSalvar={(f) => { editarItem(item.id, f); setEditando(null); }}
                    onSalvarCatalogo={() => salvarCatalogo(item)}
                  />
                ))}
              </ul>
            </div>
          )}

          {comprados.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400"><CheckCircle2 size={15} strokeWidth={1.75} /> Comprados ({comprados.length})</span>
                  <span className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-300">
                    {brl(comprados.reduce((a, d) => a + (d.valor_pago ?? 0), 0))}
                  </span>
                </div>
                {online && comprados.some(d => d.valor_pago > 0) && (
                  <button
                    onClick={() => {
                      const total = comprados.reduce((a, d) => a + (d.valor_pago ?? 0), 0);
                      const qtd = comprados.filter(d => d.valor_pago > 0).length;
                      const hoje = new Date().toISOString().slice(0, 10);
                      lancarDespesa.mutate({
                        descricao: `Compras do mercado — ${qtd} item(s)`,
                        categoria: 'variavel',
                        tipo: 'Mercado',
                        valor: total,
                        data_competencia: hoje,
                        recorrente: false,
                      });
                    }}
                    disabled={lancarDespesa.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-700 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                  >
                    <Banknote size={14} strokeWidth={1.75} /> Lançar nas Despesas
                  </button>
                )}
              </div>
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {comprados.map(item => (
                  <ItemLinha key={item.id} item={item} editando={editando} setEditando={setEditando}
                    noCatalogo={nomesNoCatalogo.has(item.nome.toLowerCase())}
                    online={online}
                    onMarcar={(c, vp, qtd, un) => marcarItem(item.id, c, { valor_pago: vp, qtd_comprada: qtd, unidade_comprada: un })}
                    onRemover={() => removerItem(item.id)}
                    onSalvar={(f) => { editarItem(item.id, f); setEditando(null); }}
                    onSalvarCatalogo={() => salvarCatalogo(item)}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── ABA CATÁLOGO ─────────────────── */
function AbaCatalogo() {
  const qc = useQueryClient();
  const [selecionados, setSelecionados] = useState(new Set());
  const [form, setForm] = useState(FORM_VAZIO);
  const [editando, setEditando] = useState(null);
  const [formEdit, setFormEdit] = useState(FORM_VAZIO);

  const { data: catalogo = [], isLoading } = useQuery({
    queryKey: ['catalogo-compras'],
    queryFn: () => api.get('/lista-compras/catalogo'),
  });

  const adicionar = useMutation({
    mutationFn: (f) => api.post('/lista-compras/catalogo', f),
    onSuccess: () => { qc.invalidateQueries(['catalogo-compras']); setForm(FORM_VAZIO); toast.success('Salvo no catálogo!'); },
    onError: (e) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: ({ id, ...f }) => api.put(`/lista-compras/catalogo/${id}`, f),
    onSuccess: () => { qc.invalidateQueries(['catalogo-compras']); setEditando(null); toast.success('Atualizado!'); },
  });

  const remover = useMutation({
    mutationFn: (id) => api.del(`/lista-compras/catalogo/${id}`),
    onSuccess: () => { qc.invalidateQueries(['catalogo-compras']); setSelecionados(new Set()); },
  });

  const adicionarNaLista = useMutation({
    mutationFn: (ids) => api.post('/lista-compras/catalogo/adicionar-lista', { ids }),
    onSuccess: () => {
      qc.invalidateQueries(['lista-compras']);
      setSelecionados(new Set());
      toast.success(`${selecionados.size} item(s) adicionado(s) à lista!`);
    },
    onError: (e) => toast.error(e.message),
  });

  const enviarWhatsAppDireto = () => {
    const itens = catalogo.filter(c => selecionados.has(c.id));
    if (!itens.length) { toast.error('Selecione pelo menos um item!'); return; }
    const texto = [
      '🛒 *Lista de Compras — Sushi Finance*', '',
      ...itens.map(i => `▫️ ${i.nome}${i.observacao ? ` (${i.observacao})` : ''}`),
      '', `_${itens.length} item(s) · ${new Date().toLocaleDateString('pt-BR')}_`,
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const toggleItem = (id) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (selecionados.size === catalogo.length) setSelecionados(new Set());
    else setSelecionados(new Set(catalogo.map(c => c.id)));
  };

  const abrirEditar = (item) => {
    setFormEdit({ nome: item.nome, quantidade: item.quantidade, unidade: item.unidade, observacao: item.observacao || '' });
    setEditando(item.id);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="page-title">Meus Itens</h1>
          <p className="page-subtitle">{catalogo.length} item(s) salvos · {selecionados.size} selecionado(s)</p>
        </div>
        {selecionados.size > 0 && (
          <div className="flex gap-2">
            <button onClick={() => adicionarNaLista.mutate([...selecionados])} className="btn-secondary text-sm flex items-center gap-1.5">
              <ShoppingCart size={14} strokeWidth={1.75} /> Adicionar à lista ({selecionados.size})
            </button>
            <button onClick={enviarWhatsAppDireto}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-500 hover:bg-green-600 text-white transition-colors shadow-sm">
              <WhatsAppIcon /> Enviar no WhatsApp
            </button>
          </div>
        )}
      </div>

      {/* Novo item no catálogo */}
      <div className="card p-4">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">+ Novo item no catálogo</p>
        <form onSubmit={e => { e.preventDefault(); adicionar.mutate(form); }}
          className="flex flex-col sm:flex-row gap-2">
          <input className="input flex-1" placeholder="Nome do item..." value={form.nome}
            onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} required />
          <input type="number" className="input w-24" placeholder="Qtd" min="0.01" step="0.01"
            value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} />
          <select className="input w-32" value={form.unidade}
            onChange={e => setForm(p => ({ ...p, unidade: e.target.value }))}>
            {UNIDADES.map(u => <option key={u}>{u}</option>)}
          </select>
          <input className="input flex-1" placeholder="Obs. (opcional)" value={form.observacao}
            onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))} />
          <button type="submit" className="btn-primary whitespace-nowrap">Salvar</button>
        </form>
      </div>

      {isLoading ? <PageLoading /> : catalogo.length === 0 ? (
        <div className="card">
          <div className="empty-state py-16">
            <span className="empty-icon flex justify-center"><Star size={44} strokeWidth={1.4} /></span>
            <p className="empty-title">Catálogo vazio</p>
            <p className="empty-sub flex items-center justify-center gap-1 flex-wrap">Salve itens da lista clicando em <Star size={12} strokeWidth={1.75} className="inline" /> ou adicione acima</p>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Header com selecionar todos */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3">
            <input type="checkbox" className="w-4 h-4 rounded accent-rose-600 cursor-pointer"
              checked={selecionados.size === catalogo.length && catalogo.length > 0}
              onChange={toggleTodos} />
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {selecionados.size === catalogo.length && catalogo.length > 0 ? 'Desselecionar todos' : 'Selecionar todos'}
            </span>
          </div>

          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {catalogo.map(item => (
              <li key={item.id}>
                {editando === item.id ? (
                  <div className="px-4 py-3">
                    <form onSubmit={e => { e.preventDefault(); atualizar.mutate({ id: item.id, ...formEdit }); }}
                      className="flex flex-col sm:flex-row gap-2">
                      <input className="input flex-1" value={formEdit.nome}
                        onChange={e => setFormEdit(p => ({ ...p, nome: e.target.value }))} required />
                      <input type="number" className="input w-20" value={formEdit.quantidade}
                        onChange={e => setFormEdit(p => ({ ...p, quantidade: e.target.value }))} />
                      <select className="input w-28" value={formEdit.unidade}
                        onChange={e => setFormEdit(p => ({ ...p, unidade: e.target.value }))}>
                        {UNIDADES.map(u => <option key={u}>{u}</option>)}
                      </select>
                      <input className="input flex-1" placeholder="Obs." value={formEdit.observacao}
                        onChange={e => setFormEdit(p => ({ ...p, observacao: e.target.value }))} />
                      <div className="flex gap-1">
                        <button type="submit" className="btn-primary btn-sm">Salvar</button>
                        <button type="button" onClick={() => setEditando(null)} className="btn-secondary btn-sm"><X size={15} strokeWidth={2} /></button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div
                    onClick={() => toggleItem(item.id)}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors select-none
                      ${selecionados.has(item.id)
                        ? 'bg-rose-50 dark:bg-rose-900/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}
                  >
                    <input type="checkbox" checked={selecionados.has(item.id)} onChange={() => toggleItem(item.id)}
                      onClick={e => e.stopPropagation()}
                      className="w-5 h-5 rounded accent-rose-600 cursor-pointer shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.nome}</span>
                      {item.observacao && <span className="ml-2 text-xs text-slate-400 italic">· {item.observacao}</span>}
                      {item.ultimo_preco != null && (
                        <span className="ml-2 text-xs text-slate-400">
                          · último: <span className="font-medium text-emerald-600 dark:text-emerald-400">{brl(item.ultimo_preco)}</span>
                          {item.ultimo_preco_em && <span className="text-slate-400"> em {new Date(item.ultimo_preco_em).toLocaleDateString('pt-BR')}</span>}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      <button onClick={() => abrirEditar(item)} className="btn-ghost btn-icon btn-sm" title="Editar"><Pencil size={14} strokeWidth={1.75} /></button>
                      <button onClick={() => remover.mutate(item.id)}
                        className="btn-ghost btn-icon btn-sm text-red-400 hover:text-red-600 hover:bg-red-50" title="Remover"><Trash2 size={14} strokeWidth={1.75} /></button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── ITEM DA LISTA ─────────────────── */
function ItemLinha({ item, editando, setEditando, noCatalogo, online, onMarcar, onRemover, onSalvar, onSalvarCatalogo }) {
  const [formEdit, setFormEdit] = useState({
    nome: item.nome, quantidade: item.quantidade,
    unidade: item.unidade, observacao: item.observacao || '',
  });
  const [modalPreco, setModalPreco] = useState(false);
  const [valorPago, setValorPago] = useState('');
  const [qtdComprada, setQtdComprada] = useState(String(item.quantidade));
  const [unidadeComprada, setUnidadeComprada] = useState(item.unidade);
  const inputRef = useRef(null);

  useEffect(() => {
    if (modalPreco && inputRef.current) inputRef.current.focus();
  }, [modalPreco]);

  const confirmarCompra = (comValor) => {
    onMarcar(true, comValor ? Number(valorPago) : null, Number(qtdComprada), unidadeComprada);
    setModalPreco(false);
    setValorPago('');
  };

  if (editando === item.id) {
    return (
      <li className="px-4 py-3">
        <form onSubmit={e => { e.preventDefault(); onSalvar(formEdit); }}
          className="flex flex-col sm:flex-row gap-2">
          <input className="input flex-1" value={formEdit.nome}
            onChange={e => setFormEdit(p => ({ ...p, nome: e.target.value }))} required />
          <input type="number" className="input w-20" value={formEdit.quantidade}
            onChange={e => setFormEdit(p => ({ ...p, quantidade: e.target.value }))} />
          <select className="input w-28" value={formEdit.unidade}
            onChange={e => setFormEdit(p => ({ ...p, unidade: e.target.value }))}>
            {UNIDADES.map(u => <option key={u}>{u}</option>)}
          </select>
          <input className="input flex-1" placeholder="Obs." value={formEdit.observacao}
            onChange={e => setFormEdit(p => ({ ...p, observacao: e.target.value }))} />
          <div className="flex gap-1">
            <button type="submit" className="btn-primary btn-sm">Salvar</button>
            <button type="button" onClick={() => setEditando(null)} className="btn-secondary btn-sm"><X size={15} strokeWidth={2} /></button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="relative">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
        {/* Checkbox — se pendente, abre modal de preço; se comprado, desmarca direto */}
        <input
          type="checkbox"
          checked={!!item.comprado}
          onChange={e => {
            if (e.target.checked) setModalPreco(true);
            else onMarcar(false, null);
          }}
          className="w-5 h-5 rounded accent-green-500 cursor-pointer shrink-0"
        />
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium ${item.comprado
            ? 'line-through text-slate-400 dark:text-slate-500'
            : 'text-slate-800 dark:text-slate-100'}`}>
            {item.nome}
            {/* Badge para item criado offline ainda não sincronizado */}
            {item.id < 0 && (
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-normal not-italic">
                pendente
              </span>
            )}
          </span>
          {item.observacao && <span className="ml-2 text-xs text-slate-400 italic">· {item.observacao}</span>}
          {!!item.comprado && item.valor_pago != null && (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300">
<Coins size={12} strokeWidth={1.75} /> {brl(item.valor_pago)}
              {item.qtd_comprada > 0 && (
                <span className="font-normal opacity-75">
                  · {item.qtd_comprada} {item.unidade_comprada}
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {!item.comprado && (
            <>
              <button onClick={() => setEditando(item.id)} className="btn-ghost btn-icon btn-sm" title="Editar"><Pencil size={14} strokeWidth={1.75} /></button>
              <button
                onClick={onSalvarCatalogo}
                className={`btn-ghost btn-icon btn-sm ${noCatalogo ? 'text-amber-400' : 'text-slate-400 hover:text-amber-500'}`}
                title={noCatalogo ? 'Já está no catálogo' : 'Salvar no catálogo'}
              >
                <Star size={14} strokeWidth={1.75} fill={noCatalogo ? 'currentColor' : 'none'} />
              </button>
            </>
          )}
          <button onClick={onRemover} title="Remover"
            className="btn-ghost btn-icon btn-sm text-red-400 hover:text-red-600 hover:bg-red-50"><Trash2 size={14} strokeWidth={1.75} /></button>
        </div>
      </div>

      {/* Mini modal de preço */}
      {modalPreco && (
        <div className="mx-4 mb-3 p-3 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-3">
            <ShoppingCart size={15} strokeWidth={1.75} /> Registrar compra de <span className="font-bold">{item.nome}</span>
            {!online && <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">(offline — sincroniza depois)</span>}
          </p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {/* Quantidade comprada */}
            <div>
              <label className="text-xs text-emerald-700 dark:text-emerald-300 font-medium mb-1 block">Quantidade comprada</label>
              <div className="flex gap-1">
                <input
                  type="number" step="0.01" min="0" placeholder="1"
                  value={qtdComprada}
                  onChange={e => setQtdComprada(e.target.value)}
                  className="input w-20 text-sm"
                />
                <select
                  value={unidadeComprada}
                  onChange={e => setUnidadeComprada(e.target.value)}
                  className="input flex-1 text-sm"
                >
                  {UNIDADES.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            {/* Valor pago */}
            <div>
              <label className="text-xs text-emerald-700 dark:text-emerald-300 font-medium mb-1 block">Valor pago (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">R$</span>
                <input
                  ref={inputRef}
                  type="number" step="0.01" min="0" placeholder="0,00"
                  value={valorPago}
                  onChange={e => setValorPago(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmarCompra(true); if (e.key === 'Escape') setModalPreco(false); }}
                  className="input pl-9 text-sm"
                />
              </div>
            </div>
          </div>
          {/* Preço por unidade calculado */}
          {valorPago && qtdComprada && Number(qtdComprada) > 0 && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">
              ≈ <span className="font-semibold">{brl(Number(valorPago) / Number(qtdComprada))}</span> por {unidadeComprada}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => confirmarCompra(true)}
              className="btn-sm px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
            >
              <span className="flex items-center gap-1.5"><Check size={14} strokeWidth={2.5} /> Confirmar</span>
            </button>
            <button onClick={() => confirmarCompra(false)} className="btn-ghost btn-sm text-slate-500 text-xs">
              Pular
            </button>
            <button onClick={() => setModalPreco(false)} className="btn-ghost btn-icon btn-sm text-slate-400 ml-auto"><X size={15} strokeWidth={2} /></button>
          </div>
        </div>
      )}
    </li>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
