import React, { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import StatCard from '../components/Card';
import FormField from '../components/FormField';
import { PageLoading } from '../components/Loading';
import { brl, mesAtual } from '../lib/fmt';
import { useDespesasOffline } from '../hooks/useDespesasOffline';
import {
  Lock, TrendingDown, Wallet, Repeat, Plus, RefreshCw, WifiOff, Clock,
  CalendarDays, Pencil, Trash2, Check,
} from 'lucide-react';

const TIPOS_FIXO = ['Aluguel', 'Energia', 'Água', 'Internet', 'Funcionários', 'Contador', 'Outros'];
const TIPOS_VAR  = ['Mercado', 'Fornecedor', 'Marketing', 'Taxa iFood', 'Taxa Rappi', 'Embalagens', 'Manutenção', 'Outros'];

const FORM_VAZIO = (mes) => ({
  descricao: '',
  categoria: 'fixo',
  tipo: '',
  valor: '',
  data_competencia: `${mes}-01`,
  recorrente: false,
});

export default function Despesas() {
  const [mes, setMes] = useState(mesAtual());
  const [modal, setModal] = useState(null); // null | 'novo' | {id, ...}
  const [confirmDel, setConfirmDel] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO(mesAtual()));
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const {
    despesas, online, syncing, loading, qtdFila,
    criarDespesa, editarDespesa, excluirDespesa,
  } = useDespesasOffline(mes);

  const abrirNovo = () => { setForm(FORM_VAZIO(mes)); setModal('novo'); };
  const abrirEditar = (d) => {
    setForm({
      descricao: d.descricao,
      categoria: d.categoria,
      tipo: d.tipo || '',
      valor: d.valor,
      data_competencia: d.data_competencia,
      recorrente: !!d.recorrente,
    });
    setModal(d);
  };

  const handleSalvar = (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      if (modal === 'novo') {
        criarDespesa(form);
        toast.success(online ? 'Despesa criada!' : 'Despesa salva offline — sincroniza ao reconectar');
      } else {
        editarDespesa(modal.id, form);
        toast.success(online ? 'Despesa atualizada!' : 'Atualização salva offline — sincroniza ao reconectar');
      }
      setModal(null);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = () => {
    setExcluindo(true);
    try {
      excluirDespesa(confirmDel.id);
      toast.success(online ? 'Despesa excluída.' : 'Exclusão salva offline — sincroniza ao reconectar');
      setConfirmDel(null);
    } finally {
      setExcluindo(false);
    }
  };

  const fixas     = despesas.filter(d => d.categoria === 'fixo');
  const variaveis = despesas.filter(d => d.categoria === 'variavel');
  const totalFixo = fixas.reduce((a, d) => a + Number(d.valor), 0);
  const totalVar  = variaveis.reduce((a, d) => a + Number(d.valor), 0);
  const tiposDisponiveis = form.categoria === 'fixo' ? TIPOS_FIXO : TIPOS_VAR;

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* ── Banner offline / sincronizando ── */}
      {!online && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200">
          <WifiOff size={18} strokeWidth={1.75} className="shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Modo offline — exibindo dados salvos</p>
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

      <div className="page-header">
        <div>
          <h1 className="page-title">Despesas</h1>
          <p className="page-subtitle">
            {despesas.length} lançamento(s) em {mes}
            {!online && <span className="ml-2 text-amber-600 dark:text-amber-400 font-semibold">· offline</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="input max-w-[160px]" />
          <button onClick={abrirNovo} className="btn-primary">+ Nova Despesa</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard titulo="Despesas Fixas" valor={brl(totalFixo)} icon={<Lock size={22} strokeWidth={1.75} />} cor="red" />
        <StatCard titulo="Despesas Variáveis" valor={brl(totalVar)} icon={<TrendingDown size={22} strokeWidth={1.75} />} cor="yellow" />
        <StatCard titulo="Total" valor={brl(totalFixo + totalVar)} icon={<Wallet size={22} strokeWidth={1.75} />} />
      </div>

      {loading && !despesas.length ? (
        <PageLoading />
      ) : (
        <div className="space-y-5">
          <TabelaDespesas
            titulo="Despesas Fixas"
            icon={<Lock size={16} strokeWidth={1.75} />}
            cor="blue"
            itens={fixas}
            total={totalFixo}
            onEditar={abrirEditar}
            onExcluir={setConfirmDel}
          />
          <TabelaDespesas
            titulo="Despesas Variáveis"
            icon={<TrendingDown size={16} strokeWidth={1.75} />}
            cor="orange"
            itens={variaveis}
            total={totalVar}
            onEditar={abrirEditar}
            onExcluir={setConfirmDel}
          />
        </div>
      )}

      {modal && (
        <Modal
          titulo={modal === 'novo' ? '+ Nova Despesa' : 'Editar Despesa'}
          onClose={() => setModal(null)}
          size="sm"
        >
          <form onSubmit={handleSalvar} className="space-y-5">

            {!online && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 text-xs">
                <WifiOff size={14} strokeWidth={1.75} className="shrink-0" />
                <span>Offline — salvo localmente e sincronizado ao reconectar.</span>
              </div>
            )}

            {/* ── Categoria: toggle visual ── */}
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Categoria</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: 'fixo',    Icon: Lock,         label: 'Fixa',    desc: 'Aluguel, salários…' },
                  { val: 'variavel', Icon: TrendingDown, label: 'Variável', desc: 'Mercado, fornecedor…' },
                ].map(op => (
                  <button
                    key={op.val}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, categoria: op.val, tipo: '' }))}
                    className={`flex flex-col items-start px-4 py-3 rounded-xl border-2 transition-all text-left ${
                      form.categoria === op.val
                        ? op.val === 'fixo'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                          : 'border-orange-400 bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <span className="text-sm font-bold flex items-center gap-1.5"><op.Icon size={14} strokeWidth={1.75} /> {op.label}</span>
                    <span className="text-xs opacity-70 mt-0.5">{op.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Tipo: chips clicáveis ── */}
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Tipo</p>
              <div className="flex flex-wrap gap-2">
                {tiposDisponiveis.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, tipo: p.tipo === t ? '' : t }))}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      form.tipo === t
                        ? 'border-orange-400 bg-orange-500 text-white shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Descrição ── */}
            <div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Descrição</p>
              <input
                className="input w-full" required autoFocus
                placeholder={form.tipo ? `Ex: ${form.tipo} de junho` : 'Ex: Aluguel do espaço'}
                value={form.descricao}
                onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
              />
            </div>

            {/* ── Valor + Data ── */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Valor</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">R$</span>
                  <input
                    type="number" step="0.01" min="0.01"
                    className="input pl-9 text-base font-bold" required placeholder="0,00"
                    value={form.valor}
                    onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Data</p>
                <input
                  type="date" className="input" required
                  value={form.data_competencia}
                  onChange={e => setForm(p => ({ ...p, data_competencia: e.target.value }))}
                />
              </div>
            </div>

            {/* ── Recorrente: toggle grande ── */}
            <button
              type="button"
              onClick={() => setForm(p => ({ ...p, recorrente: !p.recorrente }))}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                form.recorrente
                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <span className={form.recorrente ? 'text-emerald-500' : 'text-slate-400'}>{form.recorrente ? <Repeat size={20} strokeWidth={1.75} /> : <Plus size={20} strokeWidth={1.75} />}</span>
              <div className="text-left">
                <p className={`text-sm font-semibold ${form.recorrente ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'}`}>
                  {form.recorrente ? 'Despesa recorrente ativada' : 'Marcar como recorrente'}
                </p>
                <p className="text-xs text-slate-400">Repete automaticamente todo mês</p>
              </div>
              {/* Indicador visual */}
              <div className={`ml-auto w-10 h-5 rounded-full transition-colors relative ${form.recorrente ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.recorrente ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </button>

            {/* ── Ações ── */}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">
                Cancelar
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={salvando}>
                {salvando ? 'Salvando…' : <span className="flex items-center justify-center gap-1.5"><Check size={15} strokeWidth={2.5} /> {modal === 'novo' ? 'Criar despesa' : 'Salvar alterações'}</span>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDialog
          titulo="Excluir despesa?"
          mensagem={`"${confirmDel.descricao}" (${brl(confirmDel.valor)}) será removida permanentemente.`}
          onConfirm={handleExcluir}
          onCancel={() => setConfirmDel(null)}
          loading={excluindo}
        />
      )}

    </div>
  );
}

function TabelaDespesas({ titulo, icon, cor, itens, total, onEditar, onExcluir }) {
  const isFixo = cor === 'blue';

  const headerBg  = isFixo
    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-800'
    : 'bg-orange-50 dark:bg-orange-950/40 border-orange-100 dark:border-orange-800';
  const totalCor  = isFixo ? 'text-blue-700 dark:text-blue-300' : 'text-orange-600 dark:text-orange-300';
  const accentBar = isFixo ? 'bg-blue-400 dark:bg-blue-500' : 'bg-orange-400 dark:bg-orange-500';

  return (
    <div className="card overflow-hidden">
      {/* Cabeçalho */}
      <div className={`flex items-center justify-between px-5 py-3.5 border-b ${headerBg}`}>
        <div className="flex items-center gap-2">
          <span className={isFixo ? 'text-blue-500' : 'text-orange-500'}>{icon}</span>
          <span className="font-semibold text-sm text-slate-700 dark:text-slate-200">{titulo}</span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            {itens.length}
          </span>
        </div>
        <span className={`font-bold font-mono text-base ${totalCor}`}>{brl(total)}</span>
      </div>

      {/* Lista de itens */}
      {itens.length === 0 ? (
        <div className="empty-state py-10">
          <p className="empty-title text-sm">Nenhuma despesa {isFixo ? 'fixa' : 'variável'} neste mês</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
          {itens.map(d => (
            <li key={d.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group ${d.id < 0 ? 'opacity-60' : ''}`}>

              {/* Barra colorida lateral */}
              <div className={`w-1 h-9 rounded-full shrink-0 ${accentBar}`} />

              {/* Conteúdo principal */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {d.descricao}
                  </span>
                  {d.recorrente ? (
                    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-medium">
                      <Repeat size={11} strokeWidth={1.75} /> recorrente
                    </span>
                  ) : null}
                  {d.id < 0 && (
                    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                      <Clock size={11} strokeWidth={1.75} /> pendente
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  {d.tipo && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">{d.tipo}</span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                    <CalendarDays size={11} strokeWidth={1.75} /> {formatarData(d.data_competencia)}
                  </span>
                </div>
              </div>

              {/* Valor */}
              <span className="font-mono font-bold text-sm text-red-500 dark:text-red-400 shrink-0">
                {brl(Number(d.valor))}
              </span>

              {/* Ações — aparecem no hover */}
              <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onEditar(d)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  title="Editar"
                ><Pencil size={15} strokeWidth={1.75} /></button>
                <button
                  onClick={() => onExcluir(d)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  title="Excluir"
                ><Trash2 size={15} strokeWidth={1.75} /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatarData(data) {
  if (!data) return '—';
  const d = data.slice(0, 10);
  const [ano, mes, dia] = d.split('-');
  return dia ? `${dia}/${mes}/${ano}` : `${mes}/${ano}`;
}
