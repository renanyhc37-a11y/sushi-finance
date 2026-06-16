import React, { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { PageLoading } from '../components/Loading';
import { brl, mesAtual } from '../lib/fmt';
import { useDespesasOffline } from '../hooks/useDespesasOffline';
import {
  Lock, TrendingDown, Wallet, Repeat, Plus, RefreshCw, WifiOff,
  CalendarDays, Pencil, Trash2, Check, ChevronLeft, ChevronRight,
  BarChart3,
} from 'lucide-react';

// ── Metadados por tipo ────────────────────────────────────
const TIPO_META = {
  'Aluguel':      { emoji:'🏠', cor:'#818cf8' },
  'Energia':      { emoji:'⚡', cor:'#fbbf24' },
  'Água':         { emoji:'💧', cor:'#60a5fa' },
  'Internet':     { emoji:'📶', cor:'#34d399' },
  'Funcionários': { emoji:'👥', cor:'#a78bfa' },
  'Contador':     { emoji:'📊', cor:'#f97316' },
  'Mercado':      { emoji:'🛒', cor:'#fb923c' },
  'Fornecedor':   { emoji:'📦', cor:'#94a3b8' },
  'Marketing':    { emoji:'📣', cor:'#e879f9' },
  'Taxa iFood':   { emoji:'🔴', cor:'#ef4444' },
  'Taxa Rappi':   { emoji:'🟧', cor:'#f97316' },
  'Embalagens':   { emoji:'📫', cor:'#84cc16' },
  'Manutenção':   { emoji:'🔧', cor:'#6366f1' },
  'Outros':       { emoji:'📋', cor:'#64748b' },
};
const tipoMeta  = (tipo) => TIPO_META[tipo] || { emoji:'📋', cor:'#64748b' };

const TIPOS_FIXO = ['Aluguel','Energia','Água','Internet','Funcionários','Contador','Outros'];
const TIPOS_VAR  = ['Mercado','Fornecedor','Marketing','Taxa iFood','Taxa Rappi','Embalagens','Manutenção','Outros'];
const FORM_VAZIO = (mes) => ({ descricao:'', categoria:'fixo', tipo:'', valor:'', data_competencia:`${mes}-01`, recorrente:false });

// ── Navegação de mês ─────────────────────────────────────
function navMes(mes, delta) {
  const [y, m] = mes.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
}
function labelMes(mes) {
  const [y, m] = mes.split('-').map(Number);
  return new Date(y, m-1, 1).toLocaleDateString('pt-BR', { month:'long', year:'numeric' });
}

export default function Despesas() {
  const [mes,        setMes]        = useState(mesAtual());
  const [modal,      setModal]      = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [form,       setForm]       = useState(FORM_VAZIO(mesAtual()));
  const [salvando,   setSalvando]   = useState(false);
  const [excluindo,  setExcluindo]  = useState(false);

  const { despesas, online, syncing, loading, qtdFila, criarDespesa, editarDespesa, excluirDespesa } = useDespesasOffline(mes);

  const abrirNovo   = () => { setForm(FORM_VAZIO(mes)); setModal('novo'); };
  const abrirEditar = (d) => {
    setForm({ descricao:d.descricao, categoria:d.categoria, tipo:d.tipo||'', valor:d.valor, data_competencia:d.data_competencia, recorrente:!!d.recorrente });
    setModal(d);
  };

  const handleSalvar = (e) => {
    e.preventDefault(); setSalvando(true);
    try {
      if (modal === 'novo') { criarDespesa(form); toast.success(online?'Despesa criada!':'Salvo offline'); }
      else { editarDespesa(modal.id, form); toast.success(online?'Atualizado!':'Salvo offline'); }
      setModal(null);
    } finally { setSalvando(false); }
  };
  const handleExcluir = () => {
    setExcluindo(true);
    try { excluirDespesa(confirmDel.id); toast.success('Excluído'); setConfirmDel(null); }
    finally { setExcluindo(false); }
  };

  // Cálculos
  const fixas     = despesas.filter(d => d.categoria === 'fixo');
  const variaveis = despesas.filter(d => d.categoria === 'variavel');
  const totalFixo = fixas.reduce((a,d) => a + Number(d.valor), 0);
  const totalVar  = variaveis.reduce((a,d) => a + Number(d.valor), 0);
  const totalGeral = totalFixo + totalVar;

  // Breakdown por tipo
  const porTipo = useMemo(() => {
    const map = {};
    despesas.forEach(d => {
      const t = d.tipo || 'Outros';
      map[t] = (map[t] || 0) + Number(d.valor);
    });
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0, 6);
  }, [despesas]);

  const tiposDisponiveis = form.categoria === 'fixo' ? TIPOS_FIXO : TIPOS_VAR;
  const pctFixo = totalGeral > 0 ? (totalFixo / totalGeral * 100) : 0;
  const hoje = mesAtual();

  return (
    <div className="max-w-5xl mx-auto space-y-5 pb-10">

      {/* ── Banners offline / sync ──────────────────────── */}
      {!online && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.3)' }}>
          <WifiOff size={18} strokeWidth={1.75} style={{ color:'#fbbf24', flexShrink:0 }} />
          <div>
            <p className="text-sm font-bold" style={{ color:'#fbbf24' }}>Modo offline — exibindo dados salvos localmente</p>
            {qtdFila > 0 && <p className="text-xs mt-0.5" style={{ color:'rgba(251,191,36,0.7)' }}>{qtdFila} alteração(ões) pendente(s) de sincronização</p>}
          </div>
        </div>
      )}
      {online && syncing && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
          style={{ background:'rgba(96,165,250,0.08)', border:'1px solid rgba(96,165,250,0.25)' }}>
          <RefreshCw size={16} strokeWidth={1.75} className="animate-spin" style={{ color:'#60a5fa' }} />
          <p className="text-sm" style={{ color:'#60a5fa' }}>Sincronizando alterações offline…</p>
        </div>
      )}

      {/* ── Cabeçalho ──────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2.5" style={{ color:'var(--txt-strong)' }}>
            <TrendingDown size={24} strokeWidth={1.75} style={{ color:'var(--accent)' }} />
            Despesas
          </h1>
          <p className="text-sm mt-0.5" style={{ color:'var(--txt-dim)' }}>
            {despesas.length} lançamento(s) · {brl(totalGeral)} no mês
          </p>
        </div>

        {/* Navegação de mês */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl overflow-hidden" style={{ border:'1px solid var(--hairline)', background:'var(--space-elev)' }}>
            <button onClick={() => setMes(m => navMes(m,-1))}
              className="px-3 py-2 transition-colors hover:opacity-70"
              style={{ color:'var(--txt-dim)' }}>
              <ChevronLeft size={16} strokeWidth={2} />
            </button>
            <div className="px-3 py-2 text-sm font-bold capitalize border-x" style={{ color:'var(--txt-strong)', borderColor:'var(--hairline)', minWidth:150, textAlign:'center' }}>
              {labelMes(mes)}
            </div>
            <button onClick={() => setMes(m => navMes(m,1))}
              disabled={mes >= hoje}
              className="px-3 py-2 transition-colors hover:opacity-70 disabled:opacity-30"
              style={{ color:'var(--txt-dim)' }}>
              <ChevronRight size={16} strokeWidth={2} />
            </button>
          </div>
          <button onClick={abrirNovo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm text-white transition-all active:scale-95"
            style={{ background:'var(--accent)', boxShadow:'0 2px 12px rgba(var(--accent-rgb),0.3)' }}>
            <Plus size={16} strokeWidth={2.5} /> Nova Despesa
          </button>
        </div>
      </div>

      {/* ── Cards de resumo ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label:'Despesas Fixas',    val:totalFixo,   count:fixas.length,    cor:'#818cf8', bg:'rgba(129,140,248,0.08)', Icon:Lock,         desc:'Aluguel, energia, salários…' },
          { label:'Despesas Variáveis',val:totalVar,    count:variaveis.length,cor:'#f97316', bg:'rgba(249,115,22,0.08)',  Icon:TrendingDown, desc:'Fornecedores, taxas, outros…' },
          { label:'Total do Mês',      val:totalGeral,  count:despesas.length, cor:'var(--accent)', bg:'rgba(var(--accent-rgb),0.07)', Icon:Wallet, desc:`${despesas.length} lançamentos` },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-5" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:c.bg }}>
                <c.Icon size={20} strokeWidth={1.75} style={{ color:c.cor }} />
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background:c.bg, color:c.cor }}>
                {c.count} {c.count === 1 ? 'item' : 'itens'}
              </span>
            </div>
            <p className="text-2xl font-black mb-0.5" style={{ color:c.cor }}>{brl(c.val)}</p>
            <p className="text-xs font-semibold" style={{ color:'var(--txt-dim)' }}>{c.label}</p>
            <p className="text-[10px] mt-0.5" style={{ color:'var(--txt-dim)', opacity:0.6 }}>{c.desc}</p>
          </div>
        ))}
      </div>

      {/* ── Barra split fixas vs variáveis ────────────── */}
      {totalGeral > 0 && (
        <div className="rounded-2xl p-4" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold" style={{ color:'var(--txt-dim)' }}>Composição das Despesas</p>
            <div className="flex items-center gap-4">
              <span className="text-[10px] flex items-center gap-1" style={{ color:'#818cf8' }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ background:'#818cf8' }} /> Fixas {Math.round(pctFixo)}%
              </span>
              <span className="text-[10px] flex items-center gap-1" style={{ color:'#f97316' }}>
                <span className="w-2 h-2 rounded-full inline-block" style={{ background:'#f97316' }} /> Variáveis {Math.round(100-pctFixo)}%
              </span>
            </div>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex gap-0.5" style={{ background:'var(--space-elev-2)' }}>
            <div className="h-full rounded-l-full transition-all duration-500" style={{ width:`${pctFixo}%`, background:'#818cf8' }} />
            <div className="h-full rounded-r-full transition-all duration-500" style={{ width:`${100-pctFixo}%`, background:'#f97316' }} />
          </div>
        </div>
      )}

      {/* ── Breakdown por tipo ─────────────────────────── */}
      {porTipo.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} strokeWidth={1.75} style={{ color:'var(--accent)' }} />
            <p className="text-sm font-black" style={{ color:'var(--txt-strong)' }}>Onde está indo o dinheiro</p>
          </div>
          <div className="space-y-3">
            {porTipo.map(([tipo, valor]) => {
              const meta = tipoMeta(tipo);
              const p = totalGeral > 0 ? (valor / totalGeral * 100) : 0;
              return (
                <div key={tipo}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm flex items-center gap-2" style={{ color:'var(--txt)' }}>
                      <span>{meta.emoji}</span> {tipo}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background:`${meta.cor}18`, color:meta.cor }}>{Math.round(p)}%</span>
                      <span className="text-sm font-black" style={{ color:'var(--txt-strong)' }}>{brl(valor)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background:'var(--space-elev-2)' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width:`${p}%`, background:meta.cor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Listas ─────────────────────────────────────── */}
      {loading && !despesas.length ? (
        <PageLoading />
      ) : (
        <div className="space-y-4">
          <SecaoDespesas
            titulo="Despesas Fixas"
            subtitulo="Aluguel, energia, salários e recorrentes"
            icone={<Lock size={16} strokeWidth={1.75} />}
            cor="#818cf8"
            itens={fixas}
            total={totalFixo}
            onEditar={abrirEditar}
            onExcluir={setConfirmDel}
          />
          <SecaoDespesas
            titulo="Despesas Variáveis"
            subtitulo="Fornecedores, taxas, compras do mês"
            icone={<TrendingDown size={16} strokeWidth={1.75} />}
            cor="#f97316"
            itens={variaveis}
            total={totalVar}
            onEditar={abrirEditar}
            onExcluir={setConfirmDel}
          />
        </div>
      )}

      {/* ── Modal cadastro / edição ─────────────────────── */}
      {modal && (
        <Modal
          titulo={modal === 'novo' ? 'Nova Despesa' : 'Editar Despesa'}
          onClose={() => setModal(null)}
          size="sm"
        >
          <form onSubmit={handleSalvar} className="space-y-5">

            {!online && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                style={{ background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.2)', color:'#fbbf24' }}>
                <WifiOff size={13} strokeWidth={1.75} className="shrink-0" />
                Offline — será sincronizado ao reconectar
              </div>
            )}

            {/* Categoria */}
            <div>
              <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color:'var(--txt-dim)' }}>Categoria</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val:'fixo',     Icon:Lock,         label:'Fixa',     desc:'Aluguel, salários…', cor:'#818cf8' },
                  { val:'variavel', Icon:TrendingDown,  label:'Variável', desc:'Mercado, taxas…',    cor:'#f97316' },
                ].map(op => (
                  <button key={op.val} type="button"
                    onClick={() => setForm(p => ({ ...p, categoria:op.val, tipo:'' }))}
                    className="flex flex-col items-start px-4 py-3 rounded-xl transition-all text-left"
                    style={{
                      background: form.categoria===op.val ? `${op.cor}12` : 'var(--space-elev-2)',
                      border: `2px solid ${form.categoria===op.val ? op.cor+'66' : 'var(--hairline)'}`,
                    }}>
                    <span className="text-sm font-black flex items-center gap-1.5" style={{ color: form.categoria===op.val ? op.cor : 'var(--txt)' }}>
                      <op.Icon size={14} strokeWidth={1.75} /> {op.label}
                    </span>
                    <span className="text-xs mt-0.5" style={{ color:'var(--txt-dim)' }}>{op.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tipo — chips com emojis */}
            <div>
              <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color:'var(--txt-dim)' }}>Tipo</p>
              <div className="flex flex-wrap gap-2">
                {tiposDisponiveis.map(t => {
                  const m = tipoMeta(t);
                  const sel = form.tipo === t;
                  return (
                    <button key={t} type="button"
                      onClick={() => setForm(p => ({ ...p, tipo: p.tipo===t?'':t }))}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: sel ? `${m.cor}18` : 'var(--space-elev-2)',
                        border: `1.5px solid ${sel ? m.cor+'66' : 'var(--hairline)'}`,
                        color: sel ? m.cor : 'var(--txt-dim)',
                      }}>
                      <span>{m.emoji}</span> {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Descrição */}
            <div>
              <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color:'var(--txt-dim)' }}>Descrição</p>
              <input
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background:'var(--space-elev-2)', color:'var(--txt-strong)', border:'1px solid var(--hairline)' }}
                required autoFocus
                placeholder={form.tipo ? `Ex: ${form.tipo} de ${labelMes(mes)}` : 'Ex: Aluguel do espaço'}
                value={form.descricao}
                onChange={e => setForm(p => ({ ...p, descricao:e.target.value }))}
              />
            </div>

            {/* Valor + Data */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color:'var(--txt-dim)' }}>Valor</p>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color:'var(--txt-dim)' }}>R$</span>
                  <input type="number" step="0.01" min="0.01" inputMode="decimal"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl text-base font-black outline-none"
                    style={{ background:'var(--space-elev-2)', color:'var(--txt-strong)', border:'1px solid var(--hairline)' }}
                    required placeholder="0,00"
                    value={form.valor} onChange={e => setForm(p => ({ ...p, valor:e.target.value }))} />
                </div>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color:'var(--txt-dim)' }}>Data</p>
                <input type="date"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background:'var(--space-elev-2)', color:'var(--txt-strong)', border:'1px solid var(--hairline)' }}
                  required
                  value={form.data_competencia} onChange={e => setForm(p => ({ ...p, data_competencia:e.target.value }))} />
              </div>
            </div>

            {/* Recorrente */}
            <button type="button"
              onClick={() => setForm(p => ({ ...p, recorrente:!p.recorrente }))}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
              style={{
                background: form.recorrente ? 'rgba(34,197,94,0.08)' : 'var(--space-elev-2)',
                border: `1.5px solid ${form.recorrente ? 'rgba(34,197,94,0.3)' : 'var(--hairline)'}`,
              }}>
              <span style={{ color: form.recorrente ? '#22c55e' : 'var(--txt-dim)' }}>
                {form.recorrente ? <Repeat size={18} strokeWidth={1.75} /> : <Repeat size={18} strokeWidth={1.75} />}
              </span>
              <div className="text-left flex-1">
                <p className="text-sm font-bold" style={{ color: form.recorrente ? '#22c55e' : 'var(--txt)' }}>
                  {form.recorrente ? 'Despesa recorrente ✓' : 'Marcar como recorrente'}
                </p>
                <p className="text-xs" style={{ color:'var(--txt-dim)' }}>Repete automaticamente todo mês</p>
              </div>
              <div className="w-10 h-5 rounded-full relative transition-colors shrink-0"
                style={{ background: form.recorrente ? '#22c55e' : 'var(--hairline)' }}>
                <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                  style={{ transform: `translateX(${form.recorrente ? '20px' : '2px'})` }} />
              </div>
            </button>

            {/* Ações */}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setModal(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background:'var(--space-elev-2)', color:'var(--txt)', border:'1px solid var(--hairline)' }}>
                Cancelar
              </button>
              <button type="submit" disabled={salvando}
                className="flex-1 py-2.5 rounded-xl text-sm font-black text-white flex items-center justify-center gap-1.5"
                style={{ background:'var(--accent)', opacity: salvando ? 0.7 : 1 }}>
                {salvando ? 'Salvando…' : <><Check size={15} strokeWidth={2.5} /> {modal==='novo'?'Criar despesa':'Salvar'}</>}
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

// ── Seção de despesas ─────────────────────────────────────
function SecaoDespesas({ titulo, subtitulo, icone, cor, itens, total, onEditar, onExcluir }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border:'1px solid var(--hairline)' }}>

      {/* Header da seção */}
      <div className="flex items-center justify-between px-5 py-3.5"
        style={{ background:`${cor}08`, borderBottom:'1px solid var(--hairline)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:`${cor}18` }}>
            <span style={{ color:cor }}>{icone}</span>
          </div>
          <div>
            <p className="text-sm font-black" style={{ color:'var(--txt-strong)' }}>{titulo}</p>
            <p className="text-[10px]" style={{ color:'var(--txt-dim)' }}>{subtitulo}</p>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full ml-1"
            style={{ background:`${cor}18`, color:cor }}>{itens.length}</span>
        </div>
        <div className="text-right">
          <p className="text-lg font-black" style={{ color:cor }}>{brl(total)}</p>
        </div>
      </div>

      {/* Itens */}
      {itens.length === 0 ? (
        <div className="py-10 text-center" style={{ background:'var(--space-elev)' }}>
          <p className="text-sm" style={{ color:'var(--txt-dim)' }}>Nenhuma despesa nesta categoria</p>
          <p className="text-xs mt-1" style={{ color:'var(--txt-dim)', opacity:0.5 }}>Use o botão "+ Nova Despesa" para adicionar</p>
        </div>
      ) : (
        <div style={{ background:'var(--space-elev)' }}>
          {itens.map((d, idx) => {
            const meta = tipoMeta(d.tipo || 'Outros');
            return (
              <div key={d.id}
                className="flex items-center gap-3 px-4 py-3.5 transition-colors"
                style={{
                  borderBottom: idx < itens.length-1 ? '1px solid var(--hairline)' : 'none',
                  opacity: d.id < 0 ? 0.6 : 1,
                }}>

                {/* Ícone do tipo */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-lg"
                  style={{ background:`${meta.cor}14` }}>
                  {meta.emoji}
                </div>

                {/* Conteúdo */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold truncate" style={{ color:'var(--txt-strong)' }}>
                      {d.descricao}
                    </span>
                    {d.recorrente && (
                      <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background:'rgba(34,197,94,0.1)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.2)' }}>
                        <Repeat size={9} strokeWidth={2} /> recorrente
                      </span>
                    )}
                    {d.id < 0 && (
                      <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background:'rgba(251,191,36,0.1)', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.2)' }}>
                        ⏳ pendente
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {d.tipo && (
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded"
                        style={{ background:`${meta.cor}12`, color:meta.cor }}>
                        {d.tipo}
                      </span>
                    )}
                    <span className="text-[10px] flex items-center gap-1" style={{ color:'var(--txt-dim)' }}>
                      <CalendarDays size={10} strokeWidth={1.75} /> {formatarData(d.data_competencia)}
                    </span>
                  </div>
                </div>

                {/* Valor */}
                <div className="text-right shrink-0 mr-1">
                  <p className="text-base font-black" style={{ color:'#f87171' }}>
                    {brl(Number(d.valor))}
                  </p>
                </div>

                {/* Botões de ação — sempre visíveis */}
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onEditar(d)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl transition-all active:scale-90"
                    style={{ background:'rgba(var(--accent-rgb),0.08)', color:'var(--accent)', border:'1px solid rgba(var(--accent-rgb),0.15)' }}
                    title="Editar">
                    <Pencil size={14} strokeWidth={1.75} />
                  </button>
                  <button onClick={() => onExcluir(d)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl transition-all active:scale-90"
                    style={{ background:'rgba(248,113,113,0.08)', color:'#f87171', border:'1px solid rgba(248,113,113,0.15)' }}
                    title="Excluir">
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatarData(data) {
  if (!data) return '—';
  const d = data.slice(0,10);
  const [ano, mes, dia] = d.split('-');
  return dia ? `${dia}/${mes}/${ano}` : `${mes}/${ano}`;
}
