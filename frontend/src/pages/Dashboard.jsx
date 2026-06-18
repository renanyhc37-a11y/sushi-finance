import React, { useState, useEffect, useCallback } from 'react';
import { getToken } from '../hooks/useAuth';
import toast, { Toaster } from 'react-hot-toast';
import {
  PackagePlus, RefreshCw, Wallet, Receipt, CalendarDays,
  TrendingDown, BarChart3, Users, TrendingUp, Radio, Bell, ChefHat,
  CheckCircle2, CreditCard, Smartphone, Banknote, Trophy, FileText,
  AlertTriangle, Boxes, ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, X,
  Target, Clock, ShoppingBag, Zap, ArrowUpRight, ArrowDownRight,
  Activity, PieChart, ChevronRight, Flame,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '/api';
const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const authH = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });
const pctFmt = v => `${Number(v || 0).toFixed(1)}%`;

// ── KPI principal ─────────────────────────────────────────────
function KpiHero({ label, value, sub, cor = 'var(--accent)', icon: Icon, trend, trendLabel }) {
  return (
    <div className="rounded-2xl p-4 flex flex-col gap-2 min-w-0 relative overflow-hidden"
      style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
      <div className="absolute inset-0 opacity-[0.04] rounded-2xl"
        style={{ background: `radial-gradient(circle at 80% 20%, ${cor}, transparent 60%)` }} />
      <div className="flex items-center justify-between gap-1 relative">
        <span className="text-[10px] font-bold uppercase tracking-widest truncate" style={{ color: 'var(--txt-dim)' }}>{label}</span>
        {Icon && (
          <span className="w-8 h-8 flex items-center justify-center rounded-xl shrink-0"
            style={{ background: `${cor}20` }}>
            <Icon size={16} strokeWidth={1.75} style={{ color: cor }} />
          </span>
        )}
      </div>
      <div className="font-black text-2xl leading-none relative" style={{ color: cor }}>{value}</div>
      <div className="flex items-center justify-between gap-2 relative">
        {sub && <span className="text-[11px]" style={{ color: 'var(--txt-dim)' }}>{sub}</span>}
        {trend != null && (
          <span className="text-[10px] font-bold flex items-center gap-0.5"
            style={{ color: trend >= 0 ? '#10b981' : '#ef4444' }}>
            {trend >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {trendLabel || `${Math.abs(trend)}%`}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Card genérico ─────────────────────────────────────────────
function Card({ children, className = '', style = {} }) {
  return (
    <div className={`rounded-2xl overflow-hidden ${className}`}
      style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)', ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ title, icon: Icon, cor = 'var(--accent)', action, sub }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-2"
      style={{ borderBottom: '1px solid var(--hairline)' }}>
      <div>
        <h2 className="font-black text-sm flex items-center gap-2" style={{ color: 'var(--txt-strong)' }}>
          {Icon && <Icon size={16} strokeWidth={1.75} style={{ color: cor }} />}
          {title}
        </h2>
        {sub && <p className="text-[11px] mt-0.5" style={{ color: 'var(--txt-dim)' }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Mini barra ────────────────────────────────────────────────
function MiniBar({ label, valor, max, cor = 'var(--accent)', right }) {
  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs truncate flex-1" style={{ color: 'var(--txt-dim)' }}>{label}</span>
        <span className="text-xs font-black shrink-0" style={{ color: 'var(--txt-strong)' }}>{right || brl(valor)}</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: 'var(--space-elev-2)' }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: cor }} />
      </div>
    </div>
  );
}

// ── Chip de status estoque ────────────────────────────────────
function ChipEstoque({ item }) {
  const pct = item.estoque_ideal > 0 ? (item.estoque_atual / item.estoque_ideal) * 100 : 100;
  const critico = item.estoque_atual <= item.estoque_minimo;
  const baixo = !critico && pct < 50;
  const cor = critico ? '#ef4444' : baixo ? '#f59e0b' : '#10b981';
  const label = critico ? 'CRÍTICO' : baixo ? 'BAIXO' : 'OK';
  return (
    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md" style={{ background: `${cor}22`, color: cor }}>
      {label}
    </span>
  );
}

// ── Modal entrada de estoque ──────────────────────────────────
function ModalEntradaEstoque({ ingredientes, onClose, onSalvo }) {
  const [ingId, setIngId] = useState('');
  const [qtd, setQtd] = useState('');
  const [preco, setPreco] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!ingId || !qtd) return toast.error('Selecione o ingrediente e a quantidade');
    setSalvando(true);
    try {
      const r = await fetch(`${BASE}/dashboard/estoque/entrada`, {
        method: 'POST', headers: authH(),
        body: JSON.stringify({ ingrediente_id: Number(ingId), quantidade: Number(qtd), observacao: obs || null, preco_total: preco ? Number(preco) : null }),
      });
      if (!r.ok) throw new Error((await r.json()).erro || 'Erro');
      toast.success('Entrada registrada!');
      onSalvo();
    } catch (e) { toast.error(e.message); }
    finally { setSalvando(false); }
  }

  const ing = ingredientes.find(i => i.id === Number(ingId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <h3 className="font-black flex items-center gap-2" style={{ color: 'var(--txt-strong)' }}>
            <PackagePlus size={18} strokeWidth={1.75} style={{ color: '#10b981' }} /> Entrada de Estoque
          </h3>
          <button onClick={onClose} style={{ color: 'var(--txt-dim)' }}><X size={20} strokeWidth={1.75} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--txt-dim)' }}>Ingrediente</label>
            <select value={ingId} onChange={e => setIngId(e.target.value)} className="input w-full">
              <option value="">Selecione...</option>
              {ingredientes.map(i => (
                <option key={i.id} value={i.id}>{i.nome} — estoque: {i.estoque_atual} {i.unidade_medida}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--txt-dim)' }}>Qtd {ing ? `(${ing.unidade_medida})` : ''}</label>
              <input type="number" value={qtd} onChange={e => setQtd(e.target.value)} placeholder="0" className="input w-full font-black" style={{ color: '#10b981' }} />
            </div>
            <div className="flex-1">
              <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--txt-dim)' }}>Valor pago (R$)</label>
              <input type="number" value={preco} onChange={e => setPreco(e.target.value)} placeholder="0,00" step="0.01" className="input w-full" />
            </div>
          </div>
          <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Observação (fornecedor, nota fiscal...)" className="input w-full" />
          {ing && qtd && (
            <div className="px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <span style={{ color: 'var(--txt-dim)' }}>Estoque: </span>
              <span className="font-black" style={{ color: 'var(--txt-strong)' }}>{ing.estoque_atual}</span>
              <span style={{ color: 'var(--txt-dim)' }}> → </span>
              <span className="font-black text-emerald-400">{(Number(ing.estoque_atual) + Number(qtd)).toFixed(2)} {ing.unidade_medida}</span>
              {preco && qtd && <span className="ml-2" style={{ color: 'var(--txt-dim)' }}>· Custo unit: <strong style={{ color: 'var(--txt-strong)' }}>{brl(Number(preco) / Number(qtd))}</strong></span>}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--space-elev-2)', color: 'var(--txt-dim)' }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando}
              className="flex-1 py-2.5 rounded-xl text-sm font-black text-white"
              style={{ background: salvando ? 'var(--space-elev-2)' : 'linear-gradient(135deg,#10b981,#059669)' }}>
              {salvando ? 'Salvando...' : <span className="flex items-center justify-center gap-1.5"><CheckCircle2 size={15} strokeWidth={2} /> Registrar</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal ajuste de estoque ───────────────────────────────────
function ModalAjuste({ item, onClose, onSalvo }) {
  const [qtdNova, setQtdNova] = useState(String(item.estoque_atual));
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      await fetch(`${BASE}/dashboard/estoque/ajuste`, {
        method: 'POST', headers: authH(),
        body: JSON.stringify({ ingrediente_id: item.id, quantidade_nova: Number(qtdNova), observacao: obs || null }),
      });
      toast.success('Estoque ajustado!');
      onSalvo();
    } catch { toast.error('Erro ao ajustar'); }
    finally { setSalvando(false); }
  }

  const diff = Number(qtdNova) - item.estoque_atual;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <div>
            <h3 className="font-black flex items-center gap-2" style={{ color: 'var(--txt-strong)' }}>
              <ArrowLeftRight size={18} strokeWidth={1.75} style={{ color: 'var(--accent)' }} /> Ajuste de Estoque
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--txt-dim)' }}>{item.nome}</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--txt-dim)' }}><X size={20} strokeWidth={1.75} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider block mb-1" style={{ color: 'var(--txt-dim)' }}>
              Nova quantidade ({item.unidade_medida})
            </label>
            <input type="number" value={qtdNova} onChange={e => setQtdNova(e.target.value)} step="0.1"
              className="input w-full text-lg font-black text-center" style={{ color: 'var(--accent)' }} />
          </div>
          {qtdNova !== String(item.estoque_atual) && (
            <div className="px-3 py-2 rounded-xl text-xs text-center"
              style={{
                background: diff > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                border: `1px solid ${diff > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}>
              <span style={{ color: 'var(--txt-dim)' }}>{item.estoque_atual} → </span>
              <span className="font-black" style={{ color: diff > 0 ? '#10b981' : '#ef4444' }}>{qtdNova} {item.unidade_medida}</span>
              <span className="ml-1" style={{ color: 'var(--txt-dim)' }}>({diff > 0 ? '+' : ''}{diff.toFixed(2)})</span>
            </div>
          )}
          <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Motivo (inventário, perda, ajuste...)" className="input w-full" />
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--space-elev-2)', color: 'var(--txt-dim)' }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando}
              className="flex-1 py-2.5 rounded-xl text-sm font-black text-white"
              style={{ background: salvando ? 'var(--space-elev-2)' : 'linear-gradient(135deg,var(--accent),#ea580c)' }}>
              {salvando ? 'Salvando...' : <span className="flex items-center justify-center gap-1.5"><CheckCircle2 size={15} strokeWidth={2} /> Confirmar</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Gráfico de barras simples ─────────────────────────────────
function BarChart({ data, height = 80, cor = 'var(--accent)' }) {
  const max = Math.max(...data.map(d => d.v), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => {
        const h = Math.max(3, (d.v / max) * height);
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            {d.tooltip && (
              <div className="absolute z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ bottom: h + 8, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap' }}>
                <div className="text-[10px] font-bold px-2 py-1 rounded-lg" style={{ background: 'var(--space-elev-2)', color: 'var(--txt-strong)', border: '1px solid var(--hairline)' }}>
                  {d.tooltip}
                </div>
              </div>
            )}
            <div className="w-full rounded-t-md transition-all duration-500"
              style={{ height: h, background: d.hoje ? `linear-gradient(to top, ${cor}, var(--accent-2))` : `${cor}60` }} />
            {d.label && <span className="text-[9px] font-bold" style={{ color: 'var(--txt-faint)' }}>{d.label}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function Dashboard() {
  const [dados, setDados] = useState(null);
  const [estoque, setEstoque] = useState([]);
  const [loading, setLoading] = useState(true);
  const [opMetrics, setOpMetrics] = useState(null);
  const [modalEntrada, setModalEntrada] = useState(false);
  const [modalAjuste, setModalAjuste] = useState(null);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [metaInput, setMetaInput] = useState('');
  const [verTodoEstoque, setVerTodoEstoque] = useState(false);

  const carregar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [dRes, eRes, mRes] = await Promise.all([
        fetch(`${BASE}/dashboard`, { headers: authH() }),
        fetch(`${BASE}/dashboard/estoque`, { headers: authH() }),
        fetch(`${BASE}/pdv/metricas-operacionais?dias=7`, { headers: authH() }),
      ]);
      if (dRes.ok) setDados(await dRes.json());
      if (eRes.ok) setEstoque(await eRes.json());
      if (mRes.ok) setOpMetrics(await mRes.json());
    } catch { if (!silent) toast.error('Erro ao carregar dashboard'); }
    finally { setLoading(false); }
  }, []);

  async function salvarMeta() {
    const v = Number(metaInput) || 0;
    await fetch(`${BASE}/cardapio/config`, { method: 'PUT', headers: authH(), body: JSON.stringify({ meta_faturamento_mes: v }) });
    setEditandoMeta(false);
    setDados(d => d ? { ...d, meta_faturamento: v } : d);
  }

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const iv = setInterval(() => carregar(true), 60_000);
    return () => clearInterval(iv);
  }, [carregar]);

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-sm flex items-center gap-2" style={{ color: 'var(--txt-dim)' }}>
        <Activity size={18} strokeWidth={1.75} style={{ color: 'var(--accent)' }} className="animate-pulse" />
        Carregando dashboard...
      </div>
    </div>
  );

  if (!dados) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-sm" style={{ color: 'var(--txt-dim)' }}>
        Erro ao carregar.{' '}
        <button onClick={() => carregar()} style={{ color: 'var(--accent)' }} className="underline">Tentar novamente</button>
      </div>
    </div>
  );

  const {
    vendas_hoje, pedidos_ativos, ultimos7dias = [], faturamento_mes, top_itens = [],
    despesas_mes, boletos, estoque: est, cmv_estimado_mes, lucro_estimado_mes,
    margem_estimada, clientes, movimentacoes_recentes = [], projecao, ticket_medio_mes,
    horario_pico = [], evolucao30d = [],
  } = dados;

  const ativos = (pedidos_ativos || []).reduce((s, p) => s + p.qtd, 0);
  const meta = dados.meta_faturamento || 0;
  const metaPct = meta > 0 ? Math.min(100, Math.round(((faturamento_mes?.total || 0) / meta) * 100)) : 0;
  const qtdAlerta = estoque.filter(i =>
    i.estoque_atual <= i.estoque_minimo ||
    (i.estoque_ideal > 0 && i.estoque_atual < i.estoque_ideal * 0.5)
  ).length;
  const estoqueAlerta = estoque.filter(i =>
    i.estoque_atual <= i.estoque_minimo ||
    (i.estoque_ideal > 0 && i.estoque_atual < i.estoque_ideal * 0.5)
  );

  // Prepara dados do gráfico 7 dias
  const localDate = (d = new Date()) => { const y = d.getFullYear(); const m = String(d.getMonth()+1).padStart(2,'0'); const day = String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; };
  const hoje = localDate();
  const nomes = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const grafico7d = ultimos7dias.map(d => ({
    v: d.total,
    label: nomes[new Date(d.dia + 'T12:00:00').getDay()],
    hoje: d.dia === hoje,
    tooltip: `${brl(d.total)} · ${d.pedidos} ped.`,
  }));

  // Preenche dias sem vendas com 0 (últimos 7)
  if (grafico7d.length < 7) {
    const filled = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dia = localDate(d);
      const existing = ultimos7dias.find(x => x.dia === dia);
      filled.push({
        v: existing?.total || 0,
        label: nomes[d.getDay()],
        hoje: dia === hoje,
        tooltip: existing ? `${brl(existing.total)} · ${existing.pedidos} ped.` : 'Sem vendas',
      });
    }
    grafico7d.length = 0;
    grafico7d.push(...filled);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <Toaster position="top-center" />

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black" style={{ color: 'var(--txt-strong)' }}>Dashboard</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--txt-faint)' }}>
            {dados.gerado_em && `Atualizado às ${new Date(dados.gerado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
            {ativos > 0 && <span className="ml-2 font-bold" style={{ color: 'var(--accent)' }}>· {ativos} pedido{ativos > 1 ? 's' : ''} ao vivo</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModalEntrada(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }}>
            <PackagePlus size={14} strokeWidth={1.75} /> Entrada de estoque
          </button>
          <button onClick={() => carregar()}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--space-elev)', color: 'var(--txt-dim)', border: '1px solid var(--hairline)' }}>
            <RefreshCw size={15} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* ── KPIs Hoje (faixa de destaque) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiHero label="Faturamento hoje" value={brl(vendas_hoje?.faturamento)}
          sub={`${vendas_hoje?.total_pedidos || 0} pedidos`} cor="var(--accent)" icon={Wallet} />
        <KpiHero label="Ticket médio hoje" value={brl(vendas_hoje?.ticket_medio)}
          sub={`mês: ${brl(ticket_medio_mes)}`} cor="var(--accent-2)" icon={Receipt} />
        <KpiHero label="Pedidos ao vivo" value={ativos || '0'}
          sub={ativos > 0 ? 'em andamento agora' : 'nenhum no momento'}
          cor={ativos > 0 ? '#f59e0b' : 'var(--txt-dim)'} icon={Radio} />
        <KpiHero label="Clientes" value={clientes?.total_clientes || 0}
          sub={`${clientes?.novos_mes || 0} novos · ${clientes?.recorrentes || 0} fiéis`}
          cor="#a78bfa" icon={Users} />
      </div>

      {/* ── Faturamento do mês + Projeção + Meta ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* Faturamento do mês */}
        <Card>
          <CardHeader title="Faturamento do mês" icon={CalendarDays} cor="#3b82f6" />
          <div className="p-5 space-y-4">
            <div>
              <div className="text-3xl font-black" style={{ color: '#3b82f6' }}>{brl(faturamento_mes?.total)}</div>
              <p className="text-xs mt-1" style={{ color: 'var(--txt-dim)' }}>{faturamento_mes?.pedidos || 0} pedidos · média {brl(projecao?.media_diaria)}/dia</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'PIX', val: vendas_hoje?.pix || 0, icon: Smartphone, cor: '#38bdf8' },
                { label: 'Dinheiro', val: vendas_hoje?.dinheiro || 0, icon: Banknote, cor: '#10b981' },
                { label: 'Cartão', val: vendas_hoje?.cartao || 0, icon: CreditCard, cor: '#a78bfa' },
              ].map(({ label, val, icon: Icon, cor }) => (
                <div key={label} className="rounded-xl p-2 text-center" style={{ background: 'var(--space-elev-2)' }}>
                  <Icon size={13} strokeWidth={1.75} style={{ color: cor, margin: '0 auto 4px' }} />
                  <p className="text-[10px] font-bold" style={{ color: 'var(--txt-dim)' }}>{label}</p>
                  <p className="font-black text-xs" style={{ color: cor }}>{brl(val)}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>
              Pagamentos de hoje · {projecao?.dia_atual || 0}° dia do mês
            </p>
          </div>
        </Card>

        {/* Projeção */}
        <Card>
          <CardHeader title="Projeção mensal" icon={TrendingUp} cor="#10b981"
            sub={`${projecao?.dias_restantes || 0} dias restantes`} />
          <div className="p-5 space-y-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--txt-dim)' }}>Projeção se mantiver ritmo</p>
              <div className="text-3xl font-black" style={{ color: '#10b981' }}>{brl(projecao?.projecao_mes)}</div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--txt-dim)' }}>Realizado até hoje</span>
                <span className="font-bold" style={{ color: 'var(--txt-strong)' }}>{brl(faturamento_mes?.total)}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--space-elev-2)' }}>
                <div className="h-full rounded-full" style={{
                  width: `${projecao?.dia_atual && projecao?.dias_no_mes ? Math.round((projecao.dia_atual / projecao.dias_no_mes) * 100) : 0}%`,
                  background: 'linear-gradient(90deg, #10b981, #34d399)',
                }} />
              </div>
              <div className="flex justify-between text-[10px]" style={{ color: 'var(--txt-faint)' }}>
                <span>Dia {projecao?.dia_atual}</span>
                <span>Dia {projecao?.dias_no_mes}</span>
              </div>
            </div>
            {projecao?.projecao_mes > 0 && meta > 0 && (
              <div className="rounded-xl px-3 py-2 text-xs" style={{
                background: projecao.projecao_mes >= meta ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                border: `1px solid ${projecao.projecao_mes >= meta ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
              }}>
                {projecao.projecao_mes >= meta
                  ? <span style={{ color: '#10b981' }}>✓ No ritmo para bater a meta!</span>
                  : <span style={{ color: '#f59e0b' }}>Projeção abaixo da meta ({brl(meta - projecao.projecao_mes)} de diferença)</span>}
              </div>
            )}
          </div>
        </Card>

        {/* Meta */}
        <Card>
          <CardHeader title="Meta do mês" icon={Target} cor="var(--accent-2)"
            action={
              editandoMeta ? (
                <div className="flex gap-1.5">
                  <input type="number" value={metaInput} onChange={e => setMetaInput(e.target.value)} placeholder="R$"
                    className="input w-24 text-xs py-1 px-2" />
                  <button onClick={salvarMeta} className="px-2 py-1 rounded-lg text-xs font-bold"
                    style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)' }}>OK</button>
                  <button onClick={() => setEditandoMeta(false)} className="px-2 py-1 rounded-lg text-xs" style={{ color: 'var(--txt-dim)' }}>×</button>
                </div>
              ) : (
                <button onClick={() => { setMetaInput(String(meta || '')); setEditandoMeta(true); }}
                  className="text-[11px] font-bold" style={{ color: 'var(--accent)' }}>
                  {meta > 0 ? 'editar' : 'definir'}
                </button>
              )
            }
          />
          <div className="p-5 space-y-4">
            {meta > 0 ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-4xl font-black" style={{ color: metaPct >= 100 ? '#10b981' : 'var(--accent-2)' }}>{metaPct}%</span>
                  <span className="text-xs" style={{ color: 'var(--txt-dim)' }}>{brl(faturamento_mes?.total)} de {brl(meta)}</span>
                </div>
                <div className="space-y-1">
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--space-elev-2)' }}>
                    <div className="h-full rounded-full transition-all duration-700" style={{
                      width: `${metaPct}%`,
                      background: metaPct >= 100 ? 'linear-gradient(90deg,#10b981,#34d399)' : 'linear-gradient(90deg,var(--accent),var(--accent-2))',
                    }} />
                  </div>
                  <p className="text-[11px]" style={{ color: 'var(--txt-dim)' }}>
                    {metaPct >= 100
                      ? '🎉 Meta atingida!'
                      : `Faltam ${brl(Math.max(0, meta - (faturamento_mes?.total || 0)))} para a meta`}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--space-elev-2)' }}>
                    <p className="text-[10px]" style={{ color: 'var(--txt-dim)' }}>Necessário/dia</p>
                    <p className="font-black text-sm" style={{ color: 'var(--accent-2)' }}>
                      {projecao?.dias_restantes > 0
                        ? brl((meta - (faturamento_mes?.total || 0)) / projecao.dias_restantes)
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl p-2.5 text-center" style={{ background: 'var(--space-elev-2)' }}>
                    <p className="text-[10px]" style={{ color: 'var(--txt-dim)' }}>Atual/dia</p>
                    <p className="font-black text-sm" style={{ color: '#10b981' }}>{brl(projecao?.media_diaria)}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                <Target size={32} strokeWidth={1} style={{ color: 'var(--txt-faint)' }} />
                <p className="text-sm text-center" style={{ color: 'var(--txt-dim)' }}>Defina uma meta mensal para acompanhar o progresso</p>
                <button onClick={() => { setMetaInput(''); setEditandoMeta(true); }}
                  className="px-4 py-2 rounded-xl text-xs font-bold"
                  style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.25)' }}>
                  Definir meta
                </button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* ── Resultado financeiro + Gráfico 7d ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* Resultado financeiro DRE simplificado */}
        <Card>
          <CardHeader title="Resultado do mês" icon={BarChart3} cor="#3b82f6" />
          <div className="p-5 space-y-2">
            {[
              { label: 'Faturamento bruto', val: faturamento_mes?.total || 0, cor: '#3b82f6', negativo: false },
              { label: 'CMV estimado', val: cmv_estimado_mes || 0, cor: 'var(--accent-2)', negativo: true },
              { label: 'Despesas fixas', val: despesas_mes?.fixas || 0, cor: '#ef4444', negativo: true },
              { label: 'Despesas variáveis', val: despesas_mes?.variaveis || 0, cor: '#f87171', negativo: true },
            ].map(({ label, val, cor, negativo }) => (
              <div key={label} className="flex items-center justify-between py-2 px-3 rounded-xl"
                style={{ background: 'var(--space-elev-2)' }}>
                <span className="text-xs" style={{ color: 'var(--txt-dim)' }}>{negativo ? '(−) ' : '(+) '}{label}</span>
                <span className="font-black text-sm" style={{ color: cor }}>{brl(val)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2.5 px-3 rounded-xl mt-1"
              style={{
                background: lucro_estimado_mes >= 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${lucro_estimado_mes >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
              <span className="text-xs font-black" style={{ color: lucro_estimado_mes >= 0 ? '#10b981' : '#ef4444' }}>
                = Lucro estimado
              </span>
              <span className="font-black text-base" style={{ color: lucro_estimado_mes >= 0 ? '#10b981' : '#ef4444' }}>
                {brl(lucro_estimado_mes)}
              </span>
            </div>
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px]" style={{ color: 'var(--txt-faint)' }}>Margem líquida</span>
              <span className="text-[11px] font-black" style={{ color: lucro_estimado_mes >= 0 ? '#10b981' : '#ef4444' }}>
                {margem_estimada}%
              </span>
            </div>
            {(!cmv_estimado_mes || cmv_estimado_mes === 0) && (
              <p className="text-[10px] text-center py-1" style={{ color: 'var(--txt-faint)' }}>
                * Cadastre fichas técnicas para CMV preciso
              </p>
            )}
          </div>
        </Card>

        {/* Gráfico 7 dias */}
        <Card className="md:col-span-2">
          <CardHeader title="Faturamento — últimos 7 dias" icon={TrendingUp} cor="var(--accent-2)"
            action={<span className="text-xs font-bold" style={{ color: 'var(--txt-dim)' }}>
              Total: {brl(ultimos7dias.reduce((s, d) => s + d.total, 0))}
            </span>} />
          <div className="p-5">
            {grafico7d.length > 0
              ? <BarChart data={grafico7d} height={100} cor="var(--accent)" />
              : <div className="flex items-center justify-center h-24 text-sm" style={{ color: 'var(--txt-faint)' }}>Sem dados ainda</div>}
            {/* Métricas operacionais abaixo */}
            <div className="mt-4 pt-4 grid grid-cols-3 gap-3" style={{ borderTop: '1px solid var(--hairline)' }}>
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--txt-faint)' }}>Preparo médio</p>
                <p className="font-black text-lg mt-0.5" style={{ color: 'var(--accent-2)' }}>
                  {opMetrics?.prep_medio != null ? opMetrics.prep_medio : '—'}
                  <span className="text-xs font-normal" style={{ color: 'var(--txt-dim)' }}> min</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--txt-faint)' }}>Entrega média</p>
                <p className="font-black text-lg mt-0.5" style={{ color: '#34d399' }}>
                  {opMetrics?.entrega_media != null ? opMetrics.entrega_media : '—'}
                  <span className="text-xs font-normal" style={{ color: 'var(--txt-dim)' }}> min</span>
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--txt-faint)' }}>Entregues (7d)</p>
                <p className="font-black text-lg mt-0.5" style={{ color: '#60a5fa' }}>
                  {opMetrics?.entregues || 0}
                  {opMetrics?.atrasados > 0 && (
                    <span className="text-xs font-normal ml-1" style={{ color: '#f87171' }}>({opMetrics.atrasados} atr.)</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Pedidos ao vivo + Top itens + Contas a pagar ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

        {/* Pedidos ao vivo */}
        <Card>
          <CardHeader title="Pedidos ao vivo" icon={Radio} cor="#ef4444" />
          <div className="p-4 space-y-2.5">
            {[
              { key: 'novo', label: 'Aguardando', sub: 'novos pedidos', cor: '#3b82f6', Icon: Bell },
              { key: 'preparando', label: 'Na cozinha', sub: 'em preparo', cor: 'var(--accent-2)', Icon: ChefHat },
              { key: 'pronto', label: 'Prontos', sub: 'aguardando saída', cor: '#10b981', Icon: CheckCircle2 },
            ].map(({ key, label, sub, cor, Icon }) => {
              const qtd = (pedidos_ativos || []).find(p => p.status === key)?.qtd || 0;
              return (
                <div key={key} className="flex items-center justify-between px-4 py-3 rounded-xl transition-all"
                  style={{
                    background: qtd > 0 ? `${cor}12` : 'var(--space-elev-2)',
                    border: `1px solid ${qtd > 0 ? cor + '35' : 'transparent'}`,
                  }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: qtd > 0 ? `${cor}20` : 'var(--space-elev)' }}>
                      <Icon size={16} strokeWidth={1.75} style={{ color: qtd > 0 ? cor : 'var(--txt-faint)' }} />
                    </div>
                    <div>
                      <p className="text-xs font-bold" style={{ color: qtd > 0 ? 'var(--txt-strong)' : 'var(--txt-dim)' }}>{label}</p>
                      <p className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>{sub}</p>
                    </div>
                  </div>
                  <span className="text-2xl font-black" style={{ color: qtd > 0 ? cor : 'var(--txt-faint)' }}>{qtd}</span>
                </div>
              );
            })}

            {/* Horário de pico */}
            {horario_pico.length > 0 && (
              <div className="pt-2 mt-1" style={{ borderTop: '1px solid var(--hairline)' }}>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--txt-faint)' }}>
                  <Flame size={10} className="inline mr-1" style={{ color: 'var(--accent)' }} />
                  Horário de pico (7 dias)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {horario_pico.slice(0, 4).map((h, i) => (
                    <span key={h.hora} className="text-[11px] font-bold px-2 py-1 rounded-lg"
                      style={{
                        background: i === 0 ? 'rgba(var(--accent-rgb),0.15)' : 'var(--space-elev-2)',
                        color: i === 0 ? 'var(--accent)' : 'var(--txt-dim)',
                      }}>
                      {h.hora}h · {h.pedidos}ped
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Top itens */}
        <Card>
          <CardHeader title="Top itens (30 dias)" icon={Trophy} cor="var(--accent-2)" />
          <div className="p-4 space-y-2.5">
            {top_itens.length === 0 ? (
              <p className="text-xs text-center py-6" style={{ color: 'var(--txt-faint)' }}>Sem dados ainda</p>
            ) : top_itens.slice(0, 7).map((item, i) => {
              const medalCor = i === 0 ? 'var(--accent-2)' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--txt-faint)';
              return (
                <div key={item.item_nome} className="flex items-center gap-2">
                  <span className="text-xs font-black w-5 shrink-0 text-center" style={{ color: medalCor }}>
                    {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
                  </span>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold truncate" style={{ color: 'var(--txt-strong)' }}>{item.item_nome}</span>
                      <span className="text-[10px] font-black shrink-0" style={{ color: medalCor }}>{item.qtd_vendida}×</span>
                    </div>
                    <div className="h-1 rounded-full" style={{ background: 'var(--space-elev-2)' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${(item.qtd_vendida / (top_itens[0]?.qtd_vendida || 1)) * 100}%`, background: medalCor }} />
                    </div>
                  </div>
                  <span className="text-[10px] shrink-0 w-16 text-right" style={{ color: 'var(--txt-dim)' }}>{brl(item.receita)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Contas a pagar */}
        <Card>
          <CardHeader title="Contas a pagar" icon={FileText} cor="#ef4444"
            action={(boletos?.pendentes?.qtd || 0) > 0 && (
              <span className="text-xs font-black px-2 py-1 rounded-lg"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                {boletos.pendentes.qtd} pendente{boletos.pendentes.qtd > 1 ? 's' : ''}
              </span>
            )} />
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between px-3 py-3 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <span className="text-xs" style={{ color: 'var(--txt-dim)' }}>Total pendente</span>
              <span className="font-black" style={{ color: '#ef4444' }}>{brl(boletos?.pendentes?.total)}</span>
            </div>

            {(boletos?.vencendo || []).length > 0 ? (
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                  style={{ color: 'var(--txt-faint)' }}>
                  <AlertTriangle size={10} strokeWidth={2} style={{ color: '#f59e0b' }} /> Vencendo em 7 dias
                </p>
                {boletos.vencendo.map(b => (
                  <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-xl"
                    style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate" style={{ color: 'var(--txt-strong)' }}>{b.fornecedor || b.descricao || '—'}</p>
                      <p className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>{b.data_vencimento}</p>
                    </div>
                    <span className="font-black text-xs shrink-0 ml-2" style={{ color: '#fbbf24' }}>{brl(b.valor_total)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 gap-2">
                <CheckCircle2 size={24} strokeWidth={1.5} style={{ color: '#10b981' }} />
                <p className="text-xs" style={{ color: 'var(--txt-dim)' }}>Nenhum vencendo em breve</p>
              </div>
            )}

            {/* Resumo despesas */}
            <div className="pt-2 mt-1 space-y-1.5" style={{ borderTop: '1px solid var(--hairline)' }}>
              <MiniBar label="Despesas fixas" valor={despesas_mes?.fixas || 0}
                max={despesas_mes?.total || 1} cor="#ef4444"
                right={brl(despesas_mes?.fixas)} />
              <MiniBar label="Despesas variáveis" valor={despesas_mes?.variaveis || 0}
                max={despesas_mes?.total || 1} cor="#f59e0b"
                right={brl(despesas_mes?.variaveis)} />
            </div>
          </div>
        </Card>
      </div>

      {/* ── Alertas de estoque ── */}
      {(qtdAlerta > 0 || verTodoEstoque) && (
        <Card>
          <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-2"
            style={{ borderBottom: '1px solid var(--hairline)' }}>
            <h2 className="font-black text-sm flex items-center gap-2" style={{ color: 'var(--txt-strong)' }}>
              {qtdAlerta > 0
                ? <><AlertTriangle size={16} strokeWidth={1.75} style={{ color: '#f59e0b' }} /> {qtdAlerta} item{qtdAlerta > 1 ? 'ns' : ''} com estoque baixo</>
                : <><Boxes size={16} strokeWidth={1.75} style={{ color: 'var(--accent)' }} /> Estoque</>}
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-xs" style={{ color: 'var(--txt-faint)' }}>
                Valor em estoque: <strong style={{ color: 'var(--txt-strong)' }}>{brl(est?.valor_total_estoque)}</strong>
              </span>
              <button onClick={() => setVerTodoEstoque(v => !v)}
                className="text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                style={{ background: 'var(--space-elev-2)', color: 'var(--txt-dim)' }}>
                {verTodoEstoque ? 'Só alertas' : 'Ver todos'} <ChevronRight size={12} />
              </button>
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--hairline)' }}>
            {(verTodoEstoque ? estoque : estoqueAlerta).map(ing => {
              const pctAtual = ing.estoque_ideal > 0
                ? Math.min(100, (ing.estoque_atual / ing.estoque_ideal) * 100)
                : null;
              const critico = ing.estoque_atual <= ing.estoque_minimo;
              const barCor = critico ? '#ef4444'
                : pctAtual !== null && pctAtual < 50 ? '#f59e0b' : '#10b981';

              return (
                <div key={ing.id} className="px-5 py-3 flex items-center gap-4 hover:bg-white/[0.015] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-sm truncate" style={{ color: 'var(--txt-strong)' }}>{ing.nome}</p>
                      <ChipEstoque item={ing} />
                    </div>
                    {pctAtual !== null && (
                      <div className="h-1 rounded-full" style={{ background: 'var(--space-elev-2)', width: 120 }}>
                        <div className="h-full rounded-full" style={{ width: `${pctAtual}%`, background: barCor }} />
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black" style={{ color: 'var(--txt-strong)' }}>
                      {Number(ing.estoque_atual).toFixed(2)}{' '}
                      <span className="text-xs font-normal" style={{ color: 'var(--txt-faint)' }}>{ing.unidade_medida}</span>
                    </p>
                    {ing.estoque_minimo > 0 && (
                      <p className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>mín: {ing.estoque_minimo} · ideal: {ing.estoque_ideal}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 hidden md:block">
                    <p className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>Custo unit.</p>
                    <p className="font-bold text-sm" style={{ color: 'var(--txt-dim)' }}>{brl(ing.custo_unitario)}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => setModalEntrada(true)} title="Registrar entrada"
                      className="w-8 h-8 flex items-center justify-center rounded-xl text-sm font-black"
                      style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>+</button>
                    <button onClick={() => setModalAjuste(ing)} title="Ajustar estoque"
                      className="w-8 h-8 flex items-center justify-center rounded-xl"
                      style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
                      <ArrowLeftRight size={13} strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Botão para mostrar estoque quando não há alertas */}
      {qtdAlerta === 0 && !verTodoEstoque && (
        <button onClick={() => setVerTodoEstoque(true)}
          className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
          style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)', color: 'var(--txt-dim)' }}>
          <CheckCircle2 size={16} strokeWidth={1.75} style={{ color: '#10b981' }} />
          Estoque em dia · ver todos os ingredientes
        </button>
      )}

      {/* ── Movimentações recentes ── */}
      {movimentacoes_recentes.length > 0 && (
        <Card>
          <CardHeader title="Movimentações de estoque" icon={ArrowLeftRight} cor="var(--accent)" />
          <div className="divide-y" style={{ borderColor: 'var(--hairline)' }}>
            {movimentacoes_recentes.slice(0, 10).map(m => (
              <div key={m.id} className="px-5 py-2.5 flex items-center gap-3">
                <span className="shrink-0" style={{ color: m.tipo === 'entrada' ? '#10b981' : m.tipo === 'saida' ? '#ef4444' : 'var(--accent)' }}>
                  {m.tipo === 'entrada' ? <ArrowDownToLine size={16} strokeWidth={1.75} /> : m.tipo === 'saida' ? <ArrowUpFromLine size={16} strokeWidth={1.75} /> : <ArrowLeftRight size={16} strokeWidth={1.75} />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--txt-strong)' }}>{m.ingrediente_nome}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--txt-faint)' }}>{m.observacao || m.tipo}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-sm" style={{ color: m.tipo === 'entrada' ? '#10b981' : m.tipo === 'saida' ? '#ef4444' : 'var(--accent)' }}>
                    {m.tipo === 'entrada' ? '+' : m.tipo === 'saida' ? '-' : ''}
                    {Math.abs(m.quantidade).toFixed(2)} {m.unidade_medida}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>
                    {new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modais */}
      {modalEntrada && (
        <ModalEntradaEstoque ingredientes={estoque}
          onClose={() => setModalEntrada(false)}
          onSalvo={() => { setModalEntrada(false); carregar(true); }} />
      )}
      {modalAjuste && (
        <ModalAjuste item={modalAjuste}
          onClose={() => setModalAjuste(null)}
          onSalvo={() => { setModalAjuste(null); carregar(true); }} />
      )}
    </div>
  );
}
