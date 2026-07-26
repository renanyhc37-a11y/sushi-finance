import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken } from '../hooks/useAuth';
import toast, { Toaster } from 'react-hot-toast';
import {
  ShoppingBag, Wallet, Receipt, Users, Plus, ArrowUpRight, ArrowDownRight,
  TrendingUp, Trophy, Clock, ChevronRight, Bot, Sparkles, Activity,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });
const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brlK = v => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : brl(v);

// created_at do PDV é UTC ('YYYY-MM-DD HH:MM:SS'); normaliza p/ instante e exibe no fuso local.
const hora = s => {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T') + (String(s).endsWith('Z') ? '' : 'Z'));
  return isNaN(d) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const NOMES_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const ymd = (d = new Date()) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

// Constrói a série diária dos últimos 30 dias, preenchendo com 0 os dias sem venda.
function serie30dias(evolucao30d = []) {
  const map = Object.fromEntries(evolucao30d.map(d => [d.dia, d]));
  const out = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dia = ymd(d);
    const e = map[dia];
    out.push({ dia, dow: d.getDay(), pedidos: e?.pedidos || 0, total: e?.total || 0 });
  }
  return out;
}

// Soma pedidos/faturamento de uma janela de `n` dias terminando em `offsetFim` dias atrás.
function somaJanela(dias, offsetFim, n) {
  const end = dias.length - offsetFim;
  const start = end - n;
  if (start < 0) return null; // janela anterior indisponível → sem variação
  const slice = dias.slice(start, end);
  return {
    pedidos: slice.reduce((s, d) => s + d.pedidos, 0),
    total: slice.reduce((s, d) => s + d.total, 0),
  };
}

const variacao = (cur, prev) => (prev && prev > 0) ? Math.round(((cur - prev) / prev) * 100) : null;

// ── Status dos pedidos (cores próprias) ───────────────────────
const STATUS = {
  novo:       { label: 'Novo',       cor: '#60a5fa' },
  espera:     { label: 'Aguardando', cor: '#60a5fa' },
  preparando: { label: 'Em preparo', cor: 'var(--accent-2)' },
  pronto:     { label: 'Pronto',     cor: '#34d399' },
  entregue:   { label: 'Entregue',   cor: '#10b981' },
  cancelado:  { label: 'Cancelado',  cor: '#ef4444' },
};
const statusInfo = s => STATUS[s] || { label: s || '—', cor: 'var(--txt-dim)' };

// ══════════════════════════════════════════════════════════════
//  Sub-componentes (co-locados; extraíveis p/ components/ depois)
// ══════════════════════════════════════════════════════════════

// ── Card base ─────────────────────────────────────────────────
function Card({ children, className = '', style = {} }) {
  return (
    <div className={`rounded-2xl overflow-hidden relative ${className}`}
      style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)', ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ title, icon: Icon, cor = 'var(--accent)', action }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--hairline)' }}>
      <h2 className="font-black text-sm flex items-center gap-2" style={{ color: 'var(--txt-strong)' }}>
        {Icon && <Icon size={16} strokeWidth={1.75} style={{ color: cor }} />}
        {title}
      </h2>
      {action}
    </div>
  );
}

// ── 1. KPI Card ───────────────────────────────────────────────
function KpiCard({ label, value, sub, cor = 'var(--accent)', icon: Icon, trend }) {
  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{ background: `radial-gradient(circle at 82% 15%, ${cor}, transparent 60%)` }} />
      <div className="flex items-center justify-between gap-1 relative">
        <span className="text-[10px] font-bold uppercase tracking-widest truncate" style={{ color: 'var(--txt-dim)' }}>{label}</span>
        {Icon && (
          <span className="w-8 h-8 flex items-center justify-center rounded-xl shrink-0" style={{ background: `${cor}20` }}>
            <Icon size={16} strokeWidth={1.75} style={{ color: cor }} />
          </span>
        )}
      </div>
      <div className="font-black text-2xl leading-none relative" style={{ color: 'var(--txt-strong)' }}>{value}</div>
      <div className="flex items-center justify-between gap-2 relative">
        {sub && <span className="text-[11px] truncate" style={{ color: 'var(--txt-dim)' }}>{sub}</span>}
        {trend != null && (
          <span className="text-[10px] font-black flex items-center gap-0.5 shrink-0"
            style={{ color: trend >= 0 ? '#10b981' : '#ef4444' }}>
            {trend >= 0 ? <ArrowUpRight size={11} strokeWidth={2.5} /> : <ArrowDownRight size={11} strokeWidth={2.5} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
    </Card>
  );
}

// ── 2. Gráfico de performance (2 séries) ──────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const ped = payload.find(p => p.dataKey === 'pedidos')?.value;
  const fat = payload.find(p => p.dataKey === 'faturamento')?.value;
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-2xl"
      style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline-strong)' }}>
      <p className="font-bold mb-1" style={{ color: 'var(--txt-strong)' }}>{label}</p>
      <p style={{ color: 'var(--accent)' }}>Faturamento: <b>{brl(fat)}</b></p>
      <p style={{ color: '#60a5fa' }}>Pedidos: <b>{ped}</b></p>
    </div>
  );
}

function PerformanceChart({ data, accent, titulo }) {
  const totalFat = data.reduce((s, d) => s + d.faturamento, 0);
  const totalPed = data.reduce((s, d) => s + d.pedidos, 0);
  return (
    <Card>
      <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <h2 className="font-black text-sm flex items-center gap-2" style={{ color: 'var(--txt-strong)' }}>
          <TrendingUp size={16} strokeWidth={1.75} style={{ color: accent }} /> {titulo}
        </h2>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--txt-dim)' }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} /> {brlK(totalFat)}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--txt-dim)' }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#60a5fa' }} /> {totalPed} ped.
          </span>
        </div>
      </div>
      <div className="p-3 pt-4">
        <ResponsiveContainer width="100%" height={264}>
          <LineChart data={data} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.10)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis yAxisId="fat" tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} width={38}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <YAxis yAxisId="ped" orientation="right" tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(148,163,184,0.25)' }} />
            <Line yAxisId="fat" type="monotone" dataKey="faturamento" stroke={accent} strokeWidth={2.5}
              dot={false} activeDot={{ r: 4, fill: accent }} />
            <Line yAxisId="ped" type="monotone" dataKey="pedidos" stroke="#60a5fa" strokeWidth={2.5}
              dot={false} activeDot={{ r: 4, fill: '#60a5fa' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// ── 3. Top produtos ───────────────────────────────────────────
function TopProdutos({ itens, faturamento }) {
  return (
    <Card>
      <CardHeader title="Top produtos" icon={Trophy} cor="var(--accent-2)" />
      <div className="px-4 pt-3">
        <p className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>
          Baseado em pedidos do cardápio/PDV — faturamento importado de outro sistema não entra aqui (sem item por item).
        </p>
      </div>
      <div className="p-4 pt-2 space-y-3">
        {itens.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--txt-faint)' }}>Sem vendas no período</p>
        ) : itens.slice(0, 5).map((it, i) => {
          const pct = faturamento > 0 ? (it.receita / faturamento) * 100 : 0;
          const medal = i === 0 ? 'var(--accent-2)' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--txt-faint)';
          return (
            <div key={it.item_nome} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0"
                style={{ background: `color-mix(in srgb, ${medal} 16%, transparent)`, color: medal }}>{i + 1}</span>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold truncate" style={{ color: 'var(--txt-strong)' }}>{it.item_nome}</span>
                  <span className="text-[10px] font-black shrink-0" style={{ color: medal }}>{it.qtd_vendida}×</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'var(--space-elev-2)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: medal }} />
                </div>
              </div>
              <span className="text-[11px] font-black shrink-0 w-12 text-right" style={{ color: 'var(--txt-dim)' }}>
                {pct.toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── 4. Pedidos recentes ───────────────────────────────────────
function PedidosRecentes({ pedidos, onVerTodos }) {
  return (
    <Card>
      <CardHeader title="Pedidos recentes" icon={Clock} cor="#60a5fa"
        action={
          <button onClick={onVerTodos} className="text-[11px] font-bold flex items-center gap-0.5" style={{ color: 'var(--accent)' }}>
            Ver todos <ChevronRight size={13} strokeWidth={2.5} />
          </button>
        } />
      {pedidos.length === 0 ? (
        <p className="text-xs text-center py-10" style={{ color: 'var(--txt-faint)' }}>Nenhum pedido hoje ainda</p>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--hairline)' }}>
          {pedidos.map(p => {
            const si = statusInfo(p.status);
            const qtdItens = (p.itens || []).reduce((s, it) => s + (it.quantidade || 0), 0);
            return (
              <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--txt-strong)' }}>
                    {p.cliente_nome || 'Cliente'} <span className="font-normal" style={{ color: 'var(--txt-faint)' }}>#{p.numero}</span>
                  </p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--txt-faint)' }}>
                    {qtdItens} {qtdItens === 1 ? 'item' : 'itens'} · {brl(p.total)}
                  </p>
                </div>
                <span className="text-[10px] font-black px-2 py-1 rounded-lg shrink-0"
                  style={{ background: `color-mix(in srgb, ${si.cor} 15%, transparent)`, color: si.cor }}>
                  {si.label}
                </span>
                <span className="text-[11px] shrink-0 w-10 text-right tabular-nums" style={{ color: 'var(--txt-dim)' }}>{hora(p.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── 5. Distribuição de clientes (donut) ───────────────────────
function ClientesDonut({ segmentos, total }) {
  const dados = segmentos.filter(s => s.value > 0);
  return (
    <Card>
      <CardHeader title="Distribuição de clientes" icon={Users} cor="#a78bfa" />
      <div className="p-5 flex items-center gap-4 flex-wrap sm:flex-nowrap">
        <div className="relative shrink-0 mx-auto sm:mx-0" style={{ width: 168, height: 168 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={dados.length ? dados : [{ label: '—', value: 1, cor: 'var(--space-elev-2)' }]}
                dataKey="value" nameKey="label" innerRadius={56} outerRadius={80} paddingAngle={dados.length > 1 ? 3 : 0} stroke="none">
                {(dados.length ? dados : [{ cor: 'var(--space-elev-2)' }]).map((s, i) => <Cell key={i} fill={s.cor} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-black text-2xl leading-none" style={{ color: 'var(--txt-strong)' }}>{total}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--txt-dim)' }}>clientes</span>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2.5 w-full">
          {segmentos.map(s => {
            const pct = total > 0 ? (s.value / total) * 100 : 0;
            return (
              <div key={s.label} className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.cor }} />
                <span className="text-xs flex-1 min-w-0 truncate" style={{ color: 'var(--txt)' }}>{s.label}</span>
                <span className="text-xs font-black shrink-0" style={{ color: 'var(--txt-strong)' }}>{s.value}</span>
                <span className="text-[10px] shrink-0 w-9 text-right" style={{ color: 'var(--txt-dim)' }}>{pct.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

// ── 6. Banner de CTA ──────────────────────────────────────────
function CTABanner({ onConfigurar }) {
  return (
    <div className="rounded-2xl overflow-hidden relative p-5 sm:p-6 flex items-center gap-5 flex-wrap"
      style={{ background: 'linear-gradient(120deg, color-mix(in srgb, var(--accent) 16%, var(--space-elev)), var(--space-elev) 70%)', border: '1px solid rgba(var(--accent-rgb),0.30)' }}>
      <div className="absolute -top-16 -right-10 w-72 h-72 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(var(--accent-rgb),0.25), transparent 65%)', filter: 'blur(30px)' }} />
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative"
        style={{ background: 'rgba(var(--accent-rgb),0.18)', border: '1px solid rgba(var(--accent-rgb),0.35)' }}>
        <Bot size={24} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
      </div>
      <div className="flex-1 min-w-[200px] relative">
        <h3 className="font-black text-base flex items-center gap-2" style={{ color: 'var(--txt-strong)' }}>
          Automatize seu atendimento <Sparkles size={15} strokeWidth={1.75} style={{ color: 'var(--accent-2)' }} />
        </h3>
        <p className="text-xs mt-1" style={{ color: 'var(--txt-dim)' }}>
          Deixe o assistente de WhatsApp cuidar dos pedidos e do relacionamento com o cliente.
        </p>
      </div>
      <button onClick={onConfigurar}
        className="px-5 py-2.5 rounded-xl font-black text-sm text-white shrink-0 active:scale-95 transition-transform relative"
        style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 6px 20px rgba(var(--accent-rgb),0.35)' }}>
        Configurar Bot
      </button>
    </div>
  );
}

// ── Header da tela ────────────────────────────────────────────
const PERIODOS = [{ id: 'hoje', label: 'Hoje' }, { id: '7d', label: '7 dias' }, { id: '30d', label: '30 dias' }];

function HeaderDash({ nome, periodo, setPeriodo, onNovoPedido }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-xl sm:text-2xl font-black" style={{ color: 'var(--txt-strong)' }}>
          Bem-vindo de volta{nome ? `, ${nome}` : ''} 👋
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--txt-dim)' }}>Veja o resumo do seu negócio hoje</p>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-0.5 p-0.5 rounded-xl" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
          {PERIODOS.map(p => (
            <button key={p.id} onClick={() => setPeriodo(p.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={periodo === p.id
                ? { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.3)' }
                : { color: 'var(--txt-dim)', border: '1px solid transparent' }}>
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={onNovoPedido}
          className="px-4 py-2 rounded-xl font-black text-sm text-white flex items-center gap-1.5 active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 6px 20px rgba(var(--accent-rgb),0.35)' }}>
          <Plus size={16} strokeWidth={2.5} /> Novo Pedido
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  Componente principal
// ══════════════════════════════════════════════════════════════
export default function DashboardCentral() {
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('hoje');
  // cor de destaque resolvida do tema (personalizável pelo cliente)
  const [accent, setAccent] = useState('#f97316');

  useEffect(() => {
    try {
      const c = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      if (c) setAccent(c);
    } catch {}
  }, []);

  const carregar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [dRes, pRes] = await Promise.all([
        fetch(`${BASE}/dashboard`, { headers: authH() }),
        fetch(`${BASE}/pdv/pedidos`, { headers: authH() }),
      ]);
      if (dRes.ok) setDados(await dRes.json());
      if (pRes.ok) setPedidos(await pRes.json());
    } catch { if (!silent) toast.error('Erro ao carregar o painel'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const iv = setInterval(() => carregar(true), 60_000);
    return () => clearInterval(iv);
  }, [carregar]);

  // Nome do restaurante para a saudação (config pública)
  useEffect(() => {
    fetch(`${BASE}/cardapio/config`).then(r => r.json())
      .then(c => { if (c?.nome_restaurante) setNome(c.nome_restaurante); }).catch(() => {});
  }, []);

  // ── Derivações (KPIs por período, gráfico, segmentos) ──
  const derivado = useMemo(() => {
    if (!dados) return null;
    const dias30 = serie30dias(dados.evolucao30d);
    const n = periodo === 'hoje' ? 1 : periodo === '7d' ? 7 : 30;
    const cur = somaJanela(dias30, 0, n) || { pedidos: 0, total: 0 };
    const prev = somaJanela(dias30, n, n); // janela anterior (null se indisponível)

    const ticketCur = cur.pedidos > 0 ? cur.total / cur.pedidos : 0;
    const ticketPrev = prev && prev.pedidos > 0 ? prev.total / prev.pedidos : null;

    // Série do gráfico: 7 pontos (hoje/7d) ou 30 pontos (30d)
    const janela = periodo === '30d' ? dias30 : dias30.slice(-7);
    const chart = janela.map(d => ({
      label: periodo === '30d'
        ? d.dia.slice(8, 10) + '/' + d.dia.slice(5, 7)
        : NOMES_DIA[d.dow],
      pedidos: d.pedidos,
      faturamento: d.total,
    }));

    const fat30 = dias30.reduce((s, d) => s + d.total, 0);

    const cli = dados.clientes || {};
    const totalCli = cli.total_clientes || 0;
    const novos = cli.novos_mes || 0;
    const recorrentes = cli.recorrentes || 0;
    const outros = Math.max(0, totalCli - novos - recorrentes);
    const segmentos = [
      { label: 'Recorrentes', value: recorrentes, cor: '#a78bfa' },
      { label: 'Novos (30d)', value: novos, cor: '#34d399' },
      { label: 'Inativos', value: outros, cor: '#5b6678' },
    ];

    return {
      kpis: {
        pedidos: cur.pedidos,
        faturamento: cur.total,
        ticket: ticketCur,
        clientes: totalCli,
        // "Hoje" compara um dia ainda em andamento com um dia inteiro anterior —
        // a variação sempre parece "queda" enquanto o dia não termina. Só faz
        // sentido mostrar a comparação em janelas fechadas (7d/30d).
        varPedidos: (prev && periodo !== 'hoje') ? variacao(cur.pedidos, prev.pedidos) : null,
        varFat: (prev && periodo !== 'hoje') ? variacao(cur.total, prev.total) : null,
        varTicket: (ticketPrev && periodo !== 'hoje') ? variacao(ticketCur, ticketPrev) : null,
        novos, recorrentes,
      },
      chart, fat30, segmentos, totalCli,
    };
  }, [dados, periodo]);

  const pedidosRecentes = useMemo(
    () => [...pedidos].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 6),
    [pedidos]
  );

  const tituloGrafico = periodo === '30d'
    ? 'Pedidos vs Faturamento — Últimos 30 dias'
    : 'Pedidos vs Faturamento — Últimos 7 dias';

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-sm flex items-center gap-2" style={{ color: 'var(--txt-dim)' }}>
        <Activity size={18} strokeWidth={1.75} style={{ color: 'var(--accent)' }} className="animate-pulse" /> Carregando painel...
      </div>
    </div>
  );

  if (!derivado) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-sm" style={{ color: 'var(--txt-dim)' }}>
        Erro ao carregar.{' '}
        <button onClick={() => carregar()} style={{ color: 'var(--accent)' }} className="underline">Tentar novamente</button>
      </div>
    </div>
  );

  const k = derivado.kpis;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <Toaster position="top-center" />

      <HeaderDash nome={nome} periodo={periodo} setPeriodo={setPeriodo} onNovoPedido={() => navigate('/pdv')} />

      {periodo === 'hoje' && k.pedidos === 0 && k.faturamento === 0 && (
        <div className="rounded-xl px-4 py-2.5 text-xs flex items-center gap-2"
          style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)', color: 'var(--txt-dim)' }}>
          <Activity size={14} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
          Nenhum pedido registrado hoje ainda — os números abaixo aparecem conforme chegam. Veja <b>7 dias</b> ou <b>30 dias</b> pro histórico.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Pedidos" value={k.pedidos} sub="no período" cor="#60a5fa" icon={ShoppingBag} trend={k.varPedidos} />
        <KpiCard label="Faturamento" value={brlK(k.faturamento)} sub="no período" cor="var(--accent)" icon={Wallet} trend={k.varFat} />
        <KpiCard label="Ticket médio" value={brl(k.ticket)} sub="por pedido" cor="var(--accent-2)" icon={Receipt} trend={k.varTicket} />
        <KpiCard label="Clientes" value={k.clientes} sub={`${k.novos} novos · ${k.recorrentes} fiéis`} cor="#a78bfa" icon={Users} />
      </div>

      {/* Gráfico + Top produtos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PerformanceChart data={derivado.chart} accent={accent} titulo={tituloGrafico} />
        </div>
        <TopProdutos itens={dados.top_itens || []} faturamento={derivado.fat30} />
      </div>

      {/* Pedidos recentes + Donut clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <PedidosRecentes pedidos={pedidosRecentes} onVerTodos={() => navigate('/relatorio-pedidos')} />
        </div>
        <ClientesDonut segmentos={derivado.segmentos} total={derivado.totalCli} />
      </div>

      {/* CTA */}
      <CTABanner onConfigurar={() => navigate('/whatsapp')} />
    </div>
  );
}
