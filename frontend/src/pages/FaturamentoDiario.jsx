import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useOfflineQuery } from '../hooks/useOfflineQuery';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { PageLoading } from '../components/Loading';
import { brl, mesAtual } from '../lib/fmt';
import {
  Plus, ChevronDown, ChevronUp, Trash2, Save,
  CreditCard, Banknote, QrCode, Wallet, ShoppingBag, CheckCircle,
} from 'lucide-react';

const VAZIO = (hoje) => ({
  data: hoje, total_bruto: '', pix: '', dinheiro: '',
  credito: '', debito: '', taxa_cartao: '', observacao: '',
  quantidade_pedidos: '',
});

function calcTaxaAuto(credito, debito) {
  return parseFloat(((Number(credito || 0) * 0.032) + (Number(debito || 0) * 0.015)).toFixed(2));
}

const fmtData = (d) => {
  if (!d) return {};
  const [a, m, dia] = d.split('-');
  const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const diaSemana = nomes[new Date(d + 'T12:00:00').getDay()];
  return { dia, mes: m, ano: a, diaSemana, iso: d };
};

function numericForm(f) {
  return {
    ...f,
    total_bruto: Number(f.total_bruto),
    pix: Number(f.pix || 0),
    dinheiro: Number(f.dinheiro || 0),
    credito: Number(f.credito || 0),
    debito: Number(f.debito || 0),
    taxa_cartao: Number(f.taxa_cartao || 0),
    quantidade_pedidos: Number(f.quantidade_pedidos || 0),
  };
}

export default function FaturamentoDiario() {
  const qc = useQueryClient();
  const hoje = new Date().toISOString().slice(0, 10);
  const [mes, setMes] = useState(mesAtual());
  const [aberto, setAberto] = useState(null);
  const [novoDia, setNovoDia] = useState(false);
  const [form, setForm] = useState(VAZIO(hoje));
  const [taxaAuto, setTaxaAuto] = useState(true);
  const [confirmDel, setConfirmDel] = useState(null);

  // registros manuais
  const { data: manuais = [], isLoading, isOffline } = useOfflineQuery(
    ['faturamento', mes],
    () => api.get(`/faturamento?mes=${mes}`),
  );

  // dados automáticos dos pedidos
  const { data: autoPedidos = [] } = useOfflineQuery(
    ['faturamento-auto', mes],
    () => api.get(`/faturamento/pedidos-agrupados?mes=${mes}`),
    { refetchInterval: 60000 },
  );

  // merge: dias com manual + dias só com pedidos automáticos
  const diasMap = new Map();
  // auto primeiro
  for (const a of autoPedidos) diasMap.set(a.data, { auto: a, manual: null });
  // manual sobrescreve (mas mantém o auto para referência)
  for (const m of manuais) {
    const existing = diasMap.get(m.data) || { auto: null };
    diasMap.set(m.data, { ...existing, manual: m });
  }
  // ordena desc
  const diasList = Array.from(diasMap.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([data, v]) => ({ data, ...v }));

  // KPIs — usa manual se existir, senão auto
  const fonte = diasList.map(d => d.manual || { ...d.auto, taxa_cartao: 0 });
  const totalMes     = fonte.reduce((a, r) => a + (r.total_bruto || 0), 0);
  const totalTaxas   = fonte.reduce((a, r) => a + (r.taxa_cartao || 0), 0);
  const totalLiquido = totalMes - totalTaxas;
  const totalPedidos = fonte.reduce((a, r) => a + (r.quantidade_pedidos || 0), 0);
  const ticketMedio  = totalPedidos > 0 ? totalMes / totalPedidos : 0;
  const totalPix     = fonte.reduce((a, r) => a + (r.pix || 0), 0);
  const totalDinheiro= fonte.reduce((a, r) => a + (r.dinheiro || 0), 0);
  const totalCredito = fonte.reduce((a, r) => a + (r.credito || 0), 0);
  const totalDebito  = fonte.reduce((a, r) => a + (r.debito || 0), 0);

  const invalidar = () => {
    qc.invalidateQueries(['faturamento']);
    qc.invalidateQueries(['faturamento-auto']);
    qc.invalidateQueries(['dashboard']);
  };

  const salvarNovo = useMutation({
    mutationFn: (f) => api.post('/faturamento', f),
    onSuccess: () => { invalidar(); toast.success('Dia registrado!'); setNovoDia(false); },
    onError: (e) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: (id) => api.del(`/faturamento/${id}`),
    onSuccess: () => { invalidar(); toast.success('Excluído.'); setConfirmDel(null); setAberto(null); },
    onError: (e) => { toast.error(e.message); setConfirmDel(null); },
  });

  const setF = (field, val) => setForm(p => {
    const next = { ...p, [field]: val };
    if (taxaAuto && (field === 'credito' || field === 'debito'))
      next.taxa_cartao = calcTaxaAuto(next.credito, next.debito);
    return next;
  });

  // pré-preenche form com dados auto de um dia
  const confirmarDia = (autoData) => {
    const taxa = calcTaxaAuto(autoData.credito, autoData.debito);
    setForm({
      data: autoData.data,
      total_bruto: autoData.total_bruto,
      pix: autoData.pix || '',
      dinheiro: autoData.dinheiro || '',
      credito: autoData.credito || '',
      debito: autoData.debito || '',
      taxa_cartao: taxa,
      observacao: '',
      quantidade_pedidos: autoData.quantidade_pedidos || '',
    });
    setTaxaAuto(true);
    setNovoDia(true);
    setAberto(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {isOffline && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold"
          style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid #f59e0b', color: '#92400e' }}>
          📡 Modo offline — exibindo dados salvos
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Faturamento Diário</h1>
          <p className="page-subtitle">Caixa do dia por forma de pagamento</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="input max-w-[160px]" />
          {!isOffline && !novoDia && (
            <button onClick={() => { setForm(VAZIO(hoje)); setTaxaAuto(true); setNovoDia(true); setAberto(null); }}
              className="btn-primary flex items-center gap-2">
              <Plus size={16} /> Registrar dia
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Bruto no mês" valor={brl(totalMes)} cor="var(--accent)" />
        <Kpi label="Taxas de cartão" valor={brl(totalTaxas)} cor="#f59e0b" />
        <Kpi label="Líquido" valor={brl(totalLiquido)} cor="#10b981" destaque />
        <Kpi label="Ticket médio" valor={ticketMedio > 0 ? brl(ticketMedio) : '—'} sub={totalPedidos > 0 ? `${totalPedidos} pedidos` : ''} cor="var(--txt)" />
      </div>

      {/* Barra de pagamentos do mês */}
      {totalMes > 0 && (
        <BarraPagamentos pix={totalPix} dinheiro={totalDinheiro} credito={totalCredito} debito={totalDebito} total={totalMes} />
      )}

      {/* Formulário novo dia */}
      {novoDia && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid var(--accent)', background: 'var(--space-elev)' }}>
          <div className="flex items-center gap-3 px-5 py-4" style={{ background: 'var(--accent-soft)', borderBottom: '1px solid var(--hairline)' }}>
            <span className="font-black text-base" style={{ color: 'var(--accent)' }}>Registrar dia</span>
            <button onClick={() => setNovoDia(false)} className="ml-auto btn-ghost btn-icon btn-sm" style={{ color: 'var(--txt-dim)' }}>✕</button>
          </div>
          <form onSubmit={e => { e.preventDefault(); salvarNovo.mutate(numericForm(form)); }} className="p-5">
            <FormDia form={form} setF={setF} taxaAuto={taxaAuto} setTaxaAuto={setTaxaAuto} />
            <div className="flex justify-end gap-2 mt-5 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
              <button type="button" onClick={() => setNovoDia(false)} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary flex items-center gap-2" disabled={salvarNovo.isPending}>
                <Save size={15} /> {salvarNovo.isPending ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de dias */}
      {isLoading ? <PageLoading /> : (
        <div className="space-y-2">
          {diasList.length === 0 && !novoDia && (
            <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
              <p className="text-3xl mb-3">💰</p>
              <p className="font-bold mb-1" style={{ color: 'var(--txt-strong)' }}>Nenhum movimento neste mês</p>
              <p className="text-sm" style={{ color: 'var(--txt-dim)' }}>Os pedidos aparecerão aqui automaticamente</p>
            </div>
          )}
          {diasList.map(d => (
            d.manual
              ? <CardDia
                  key={d.data}
                  registro={d.manual}
                  autoRef={d.auto}
                  expandido={aberto === d.manual.id}
                  onToggle={() => setAberto(p => p === d.manual.id ? null : d.manual.id)}
                  onExcluir={() => setConfirmDel(d.manual)}
                  onSalvo={invalidar}
                />
              : <CardAutoNaoConfirmado
                  key={d.data}
                  auto={d.auto}
                  onConfirmar={() => confirmarDia(d.auto)}
                />
          ))}
        </div>
      )}

      {/* Rodapé totais */}
      {diasList.length > 1 && (
        <div className="rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3"
          style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
          <TotalCol label="Total PIX" valor={brl(totalPix)} cor="#0ea5e9" icone={<QrCode size={14} />} />
          <TotalCol label="Total Dinheiro" valor={brl(totalDinheiro)} cor="#10b981" icone={<Banknote size={14} />} />
          <TotalCol label="Total Crédito" valor={brl(totalCredito)} cor="#8b5cf6" icone={<CreditCard size={14} />} />
          <TotalCol label="Total Débito" valor={brl(totalDebito)} cor="#6366f1" icone={<Wallet size={14} />} />
        </div>
      )}

      {confirmDel && (
        <ConfirmDialog
          titulo="Excluir registro?"
          mensagem={`Faturamento de ${brl(confirmDel.total_bruto)} do dia ${confirmDel.data} será excluído.`}
          onConfirm={() => excluir.mutate(confirmDel.id)}
          onCancel={() => setConfirmDel(null)}
          loading={excluir.isPending}
        />
      )}
    </div>
  );
}

// ── Card automático (pedidos reais, ainda não confirmado) ─────
function CardAutoNaoConfirmado({ auto, onConfirmar }) {
  const dt = fmtData(auto.data);
  const [expandido, setExpandido] = useState(false);

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ background: 'var(--space-elev)', border: '1px solid rgba(249,115,22,0.2)' }}>
      <button onClick={() => setExpandido(p => !p)} className="w-full text-left px-5 py-4 flex items-center gap-4 hover:opacity-80 transition-opacity">
        {/* Data */}
        <div className="shrink-0 w-12 text-center">
          <p className="text-xl font-black leading-none" style={{ color: 'var(--txt-strong)' }}>{dt.dia}</p>
          <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--txt-dim)' }}>{dt.diaSemana}</p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-base font-black" style={{ color: 'var(--txt-strong)' }}>{brl(auto.total_bruto)}</span>
            <span className="text-xs" style={{ color: 'var(--txt-dim)' }}>pedidos</span>
            {/* badge automático */}
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1"
              style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316' }}>
              🤖 automático
            </span>
          </div>
          <BarraMini pix={auto.pix} dinheiro={auto.dinheiro} credito={auto.credito} debito={auto.debito} total={auto.total_bruto} />
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {auto.quantidade_pedidos > 0 && (
            <div className="hidden sm:flex items-center gap-1" style={{ color: 'var(--txt-dim)' }}>
              <ShoppingBag size={13} />
              <span className="text-sm font-semibold" style={{ color: 'var(--txt)' }}>{auto.quantidade_pedidos}</span>
            </div>
          )}
          <div style={{ color: 'var(--txt-dim)' }}>
            {expandido ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </button>

      {expandido && (
        <div className="px-5 pb-4" style={{ borderTop: '1px solid var(--hairline)' }}>
          <div className="pt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[
              { label:'PIX', val: auto.pix, cor:'#0ea5e9', icon: <QrCode size={12}/> },
              { label:'Dinheiro', val: auto.dinheiro, cor:'#10b981', icon: <Banknote size={12}/> },
              { label:'Crédito', val: auto.credito, cor:'#8b5cf6', icon: <CreditCard size={12}/> },
              { label:'Débito', val: auto.debito, cor:'#6366f1', icon: <Wallet size={12}/> },
            ].map(p => (
              <div key={p.label} className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hairline)' }}>
                <div className="flex items-center gap-1 mb-1" style={{ color: p.cor }}>{p.icon}<span className="text-[10px] font-bold">{p.label}</span></div>
                <p className="text-sm font-black" style={{ color: p.val > 0 ? 'var(--txt-strong)' : 'var(--txt-faint)' }}>{brl(p.val || 0)}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center">
            <p className="text-xs" style={{ color: 'var(--txt-dim)' }}>
              Dados gerados automaticamente dos pedidos. Confirme para fechar o caixa do dia.
            </p>
            <button onClick={onConfirmar}
              className="flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl shrink-0 ml-3"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
              <CheckCircle size={14} /> Confirmar caixa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card manual (já confirmado, editável) ─────────────────────
function CardDia({ registro: r, autoRef, expandido, onToggle, onExcluir, onSalvo }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [taxaAuto, setTaxaAuto] = useState(false);
  const dt = fmtData(r.data);

  useEffect(() => {
    if (expandido && !form) {
      setForm({
        data: r.data, total_bruto: r.total_bruto, pix: r.pix || '',
        dinheiro: r.dinheiro || '', credito: r.credito || '',
        debito: r.debito || '', taxa_cartao: r.taxa_cartao || '',
        observacao: r.observacao || '', quantidade_pedidos: r.quantidade_pedidos || '',
      });
    }
    if (!expandido) setForm(null);
  }, [expandido]);

  const salvar = useMutation({
    mutationFn: (f) => api.put(`/faturamento/${r.id}`, f),
    onSuccess: () => {
      qc.invalidateQueries(['faturamento']);
      qc.invalidateQueries(['dashboard']);
      toast.success('Atualizado!');
      onSalvo();
      onToggle();
    },
    onError: (e) => toast.error(e.message),
  });

  const setF = (field, val) => setForm(p => {
    const next = { ...p, [field]: val };
    if (taxaAuto && (field === 'credito' || field === 'debito'))
      next.taxa_cartao = calcTaxaAuto(next.credito, next.debito);
    return next;
  });

  const liquido = r.total_bruto - (r.taxa_cartao || 0);
  const totalPago = (r.pix || 0) + (r.dinheiro || 0) + (r.credito || 0) + (r.debito || 0);
  const difAutoManual = autoRef ? autoRef.total_bruto - r.total_bruto : null;

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ background: 'var(--space-elev)', border: `1px solid ${expandido ? 'var(--accent)' : 'var(--hairline)'}` }}>

      <button onClick={onToggle} className="w-full text-left px-5 py-4 flex items-center gap-4 hover:opacity-80 transition-opacity">
        <div className="shrink-0 w-12 text-center">
          <p className="text-xl font-black leading-none" style={{ color: 'var(--txt-strong)' }}>{dt.dia}</p>
          <p className="text-[10px] font-semibold uppercase" style={{ color: 'var(--txt-dim)' }}>{dt.diaSemana}</p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1.5">
            <span className="text-base font-black" style={{ color: 'var(--txt-strong)' }}>{brl(r.total_bruto)}</span>
            <span className="text-xs" style={{ color: 'var(--txt-dim)' }}>bruto</span>
            <span className="text-sm font-bold ml-auto" style={{ color: '#10b981' }}>{brl(liquido)}</span>
            <span className="text-[10px]" style={{ color: 'var(--txt-dim)' }}>líquido</span>
            {/* diferença com pedidos reais */}
            {difAutoManual !== null && Math.abs(difAutoManual) > 0.5 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}
                title={`Pedidos no sistema: ${brl(autoRef.total_bruto)}`}>
                {difAutoManual > 0 ? '+' : ''}{brl(difAutoManual)} vs pedidos
              </span>
            )}
          </div>
          {totalPago > 0 && (
            <BarraMini pix={r.pix} dinheiro={r.dinheiro} credito={r.credito} debito={r.debito} total={r.total_bruto} />
          )}
        </div>

        {r.quantidade_pedidos > 0 && (
          <div className="shrink-0 text-right hidden sm:block">
            <div className="flex items-center gap-1" style={{ color: 'var(--txt-dim)' }}>
              <ShoppingBag size={13} />
              <span className="text-sm font-semibold" style={{ color: 'var(--txt)' }}>{r.quantidade_pedidos}</span>
            </div>
            <p className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>pedidos</p>
          </div>
        )}

        <div className="shrink-0" style={{ color: 'var(--txt-dim)' }}>
          {expandido ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {expandido && form && (
        <div className="px-5 pb-5" style={{ borderTop: '1px solid var(--hairline)' }}>
          {/* comparativo com pedidos automáticos */}
          {autoRef && (
            <div className="mt-3 mb-4 px-3 py-2.5 rounded-xl flex justify-between items-center text-xs"
              style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}>
              <span style={{ color: 'var(--txt-dim)' }}>🤖 Pedidos no sistema hoje:</span>
              <span className="font-bold" style={{ color: '#f97316' }}>
                {brl(autoRef.total_bruto)} · {autoRef.quantidade_pedidos} pedidos
              </span>
            </div>
          )}
          <form onSubmit={e => { e.preventDefault(); salvar.mutate(numericForm(form)); }} className="pt-1">
            <FormDia form={form} setF={setF} taxaAuto={taxaAuto} setTaxaAuto={setTaxaAuto} />
            <div className="flex items-center justify-between gap-2 mt-5 pt-4" style={{ borderTop: '1px solid var(--hairline)' }}>
              <button type="button" onClick={onExcluir}
                className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl"
                style={{ color: '#f87171' }}>
                <Trash2 size={14} /> Excluir
              </button>
              <div className="flex gap-2">
                <button type="button" onClick={onToggle} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary flex items-center gap-2" disabled={salvar.isPending}>
                  <Save size={15} /> {salvar.isPending ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Formulário reutilizável ───────────────────────────────────
function FormDia({ form, setF, taxaAuto, setTaxaAuto }) {
  const soma = ['pix', 'dinheiro', 'credito', 'debito'].reduce((a, k) => a + Number(form[k] || 0), 0);
  const diff = Number(form.total_bruto || 0) - soma;
  const fechado = soma > 0 && Math.abs(diff) < 0.01;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--txt-dim)' }}>Data</label>
          <input type="date" className="input" value={form.data} onChange={e => setF('data', e.target.value)} required />
        </div>
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--txt-dim)' }}>Total bruto (R$)</label>
          <input type="number" step="0.01" min="0" className="input text-lg font-bold" placeholder="0,00"
            value={form.total_bruto} onChange={e => setF('total_bruto', e.target.value)} required />
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold mb-2" style={{ color: 'var(--txt-dim)' }}>Formas de pagamento</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <PagInput label="PIX" cor="#0ea5e9" icone={<QrCode size={13} />}
            value={form.pix} onChange={v => setF('pix', v)} />
          <PagInput label="Dinheiro" cor="#10b981" icone={<Banknote size={13} />}
            value={form.dinheiro} onChange={v => setF('dinheiro', v)} />
          <PagInput label="Crédito" cor="#8b5cf6" icone={<CreditCard size={13} />}
            value={form.credito} onChange={v => setF('credito', v)} />
          <PagInput label="Débito" cor="#6366f1" icone={<Wallet size={13} />}
            value={form.debito} onChange={v => setF('debito', v)} />
        </div>
        {soma > 0 && (
          <div className={`mt-2 px-3 py-2 rounded-xl text-xs font-medium flex justify-between ${fechado ? 'text-emerald-600' : 'text-amber-700'}`}
            style={{ background: fechado ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)' }}>
            <span>Soma: {brl(soma)}</span>
            {fechado ? <span>✓ Fechado</span> : <span>Diferença: {brl(Math.abs(diff))}</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold" style={{ color: 'var(--txt-dim)' }}>Taxa cartão (R$)</label>
            <label className="flex items-center gap-1.5 text-[10px] cursor-pointer" style={{ color: 'var(--txt-faint)' }}>
              <input type="checkbox" checked={taxaAuto} onChange={e => {
                setTaxaAuto(e.target.checked);
                if (e.target.checked) setF('taxa_cartao', calcTaxaAuto(form.credito, form.debito));
              }} />
              Auto
            </label>
          </div>
          <input type="number" step="0.01" min="0" className="input" value={form.taxa_cartao}
            readOnly={taxaAuto} onChange={e => setF('taxa_cartao', e.target.value)} />
          {taxaAuto && <p className="text-[10px] mt-1" style={{ color: 'var(--txt-faint)' }}>Créd 3,2% + Déb 1,5%</p>}
        </div>
        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--txt-dim)' }}>Qtd pedidos</label>
          <input type="number" min="0" step="1" className="input" placeholder="0"
            value={form.quantidade_pedidos} onChange={e => setF('quantidade_pedidos', e.target.value)} />
        </div>
      </div>

      <div>
        <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--txt-dim)' }}>Observação</label>
        <input className="input" placeholder="Ex: Feriado, movimento baixo…"
          value={form.observacao} onChange={e => setF('observacao', e.target.value)} />
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────
function Kpi({ label, valor, sub, cor }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
      <p className="text-[11px] font-semibold mb-1" style={{ color: 'var(--txt-dim)' }}>{label}</p>
      <p className="text-xl font-black" style={{ color: cor || 'var(--txt-strong)' }}>{valor}</p>
      {sub && <p className="text-[10px] mt-0.5" style={{ color: 'var(--txt-faint)' }}>{sub}</p>}
    </div>
  );
}

function TotalCol({ label, valor, cor, icone }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5" style={{ color: cor }}>
        {icone}
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-base font-black" style={{ color: cor }}>{valor}</p>
    </div>
  );
}

function PagInput({ label, cor, icone, value, onChange }) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-1" style={{ color: cor }}>
        {icone}
        <span className="text-[10px] font-bold">{label}</span>
      </div>
      <input type="number" step="0.01" min="0" className="input text-sm" placeholder="0,00"
        value={value} onChange={e => onChange(e.target.value)}
        style={{ borderColor: value > 0 ? cor : undefined }} />
    </div>
  );
}

function BarraPagamentos({ pix, dinheiro, credito, debito, total }) {
  const segs = [
    { label: 'PIX', val: pix, cor: '#0ea5e9' },
    { label: 'Dinheiro', val: dinheiro, cor: '#10b981' },
    { label: 'Crédito', val: credito, cor: '#8b5cf6' },
    { label: 'Débito', val: debito, cor: '#6366f1' },
  ].filter(s => s.val > 0);

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
      <p className="text-[11px] font-semibold mb-3" style={{ color: 'var(--txt-dim)' }}>Composição do mês</p>
      <div className="flex rounded-full overflow-hidden h-3 gap-px mb-3">
        {segs.map(s => (
          <div key={s.label} style={{ width: `${(s.val / total) * 100}%`, background: s.cor }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {segs.map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.cor }} />
            <span className="text-xs font-semibold" style={{ color: 'var(--txt)' }}>{s.label}</span>
            <span className="text-xs" style={{ color: 'var(--txt-dim)' }}>{brl(s.val)}</span>
            <span className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>({((s.val / total) * 100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarraMini({ pix, dinheiro, credito, debito, total }) {
  const segs = [
    { val: pix || 0, cor: '#0ea5e9' },
    { val: dinheiro || 0, cor: '#10b981' },
    { val: credito || 0, cor: '#8b5cf6' },
    { val: debito || 0, cor: '#6366f1' },
  ].filter(s => s.val > 0);

  return (
    <div className="flex rounded-full overflow-hidden h-1.5 gap-px">
      {segs.map((s, i) => (
        <div key={i} style={{ width: `${(s.val / total) * 100}%`, background: s.cor }} />
      ))}
    </div>
  );
}
