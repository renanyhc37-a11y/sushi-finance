import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, LineChart, Line, CartesianGrid,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, Star,
  Target, Package, ArrowUpRight, ArrowDownRight,
  Search, X, ChevronDown, ChevronUp, Info,
  CheckCircle, Zap, ShoppingCart, DollarSign, Percent,
} from 'lucide-react';
import { api } from '../api/client';
import { PageLoading } from '../components/Loading';
import { brl, mesLabel, mesAtual } from '../lib/fmt';

// ── helpers ────────────────────────────────────────────────────────────────────
const pct = v => `${(+(v ?? 0)).toFixed(1)}%`;
const tend = (a, p) => (!p || p === 0) ? null : ((a - p) / p) * 100;

function abcClassify(itens) {
  const sorted = [...itens].filter(i => i.receita > 0).sort((a, b) => b.receita - a.receita);
  const total = sorted.reduce((s, i) => s + i.receita, 0);
  let acum = 0;
  const map = {};
  for (const it of sorted) {
    acum += it.receita;
    const p = total > 0 ? (acum / total) * 100 : 100;
    map[it.nome] = p <= 70 ? 'A' : p <= 90 ? 'B' : 'C';
  }
  return map;
}

function mesAnterior(mes) {
  const [y, m] = mes.split('-').map(Number);
  return new Date(y, m - 2, 1).toISOString().slice(0, 7);
}

// ── cores ──────────────────────────────────────────────────────────────────────
const C = {
  green: '#22c55e', amber: '#f59e0b', red: '#ef4444',
  blue: '#3b82f6', slate: '#94a3b8',
  abcA: '#22c55e', abcB: '#f59e0b', abcC: '#cbd5e1',
};

// ── componente principal ───────────────────────────────────────────────────────
export default function Relatorios() {
  const [mes, setMes] = useState(mesAtual());
  const [aba, setAba] = useState('ranking');
  const [busca, setBusca] = useState('');
  const [ord, setOrd] = useState({ col: 'receita', dir: 'desc' });
  const [aberto, setAberto] = useState(null); // item com histórico expandido

  const { data: comp, isLoading } = useQuery({
    queryKey: ['itens-comp', mes],
    queryFn: () => api.get(`/relatorios/itens-comp?mes=${mes}`),
  });

  const { data: historico = [] } = useQuery({
    queryKey: ['item-historico', aberto],
    queryFn: () => api.get(`/relatorios/item-historico?nome=${encodeURIComponent(aberto)}`),
    enabled: !!aberto,
  });

  const itens = comp?.itens || [];
  const diasVenda = comp?.dias_com_vendas || 0;
  const totalPedidos = comp?.total_pedidos || 0;

  // projeção
  const fatorProj = useMemo(() => {
    if (!mes || diasVenda === 0) return 1;
    const [y, m] = mes.split('-').map(Number);
    const hoje = new Date();
    if (y !== hoje.getFullYear() || m !== hoje.getMonth() + 1) return 1;
    return new Date(y, m, 0).getDate() / diasVenda;
  }, [mes, diasVenda]);

  const abcMap = useMemo(() => abcClassify(itens), [itens]);

  const kpis = useMemo(() => {
    const ativos = itens.filter(i => i.receita > 0);
    const fat = ativos.reduce((s, i) => s + i.receita, 0);
    const marg = ativos.reduce((s, i) => s + i.margem, 0);
    const qtd = ativos.reduce((s, i) => s + i.qtd, 0);
    const semFicha = ativos.filter(i => i.sem_ficha).length;
    return { n: ativos.length, fat, marg, margPct: fat > 0 ? (marg / fat) * 100 : 0, qtd, semFicha, totalPedidos };
  }, [itens, totalPedidos]);

  // sugestões
  const sugestoes = useMemo(() => {
    const ativos = itens.filter(i => i.receita > 0);
    const list = [];

    const semFicha = ativos.filter(i => i.sem_ficha);
    if (semFicha.length) list.push({
      id: 'sem-ficha', cor: 'amber', icon: AlertTriangle,
      titulo: `${semFicha.length} produto${semFicha.length > 1 ? 's' : ''} sem custo cadastrado`,
      desc: 'Sem a ficha técnica, você não sabe quanto ganha de verdade nesses itens.',
      acao: 'Cadastre a ficha técnica em Cardápio → Fichas Técnicas.',
      itens: semFicha.slice(0, 4),
    });

    const cmvAlto = ativos.filter(i => !i.sem_ficha && i.cmv_pct > 40).sort((a, b) => b.cmv_pct - a.cmv_pct);
    if (cmvAlto.length) list.push({
      id: 'cmv-alto', cor: 'red', icon: TrendingDown,
      titulo: `${cmvAlto.length} produto${cmvAlto.length > 1 ? 's estão' : ' está'} consumindo mais de 40% em custo`,
      desc: 'Para cada R$100 vendidos, mais de R$40 vai embora só em custo de ingredientes.',
      acao: 'Revise o preço de venda ou negocie melhor com fornecedores.',
      itens: cmvAlto.slice(0, 4),
    });

    const estrelas = ativos.filter(i => !i.sem_ficha && abcMap[i.nome] === 'A' && i.margem_pct >= 35);
    if (estrelas.length) list.push({
      id: 'estrelas', cor: 'green', icon: Star,
      titulo: `${estrelas.length} produto${estrelas.length > 1 ? 's são' : ' é'} campeão de vendas e lucro`,
      desc: 'Esses itens vendem muito e ainda têm boa margem. São o coração do seu negócio.',
      acao: 'Destaque esses produtos no cardápio, stories e promoções.',
      itens: estrelas.slice(0, 4),
    });

    const oport = ativos.filter(i => !i.sem_ficha && i.margem_pct < 30 && i.margem_pct >= 0 && i.qtd >= 5);
    if (oport.length) list.push({
      id: 'oport', cor: 'blue', icon: Target,
      titulo: `${oport.length} produto${oport.length > 1 ? 's vendem' : ' vende'} bastante mas a margem é baixa`,
      desc: 'Esses itens têm bom volume de pedidos, mas deixam pouco dinheiro no caixa.',
      acao: 'Um aumento de R$2–5 no preço pode mudar muito o resultado final.',
      itens: oport.slice(0, 4),
    });

    const sumidos = itens.filter(i => i.qtd === 0 && i.prev_qtd > 0);
    if (sumidos.length) list.push({
      id: 'sumidos', cor: 'slate', icon: Package,
      titulo: `${sumidos.length} produto${sumidos.length > 1 ? 's' : ''} vendido${sumidos.length > 1 ? 's' : ''} no mês passado não teve${sumidos.length > 1 ? 'ram' : ''} venda`,
      desc: 'Podem estar indisponíveis, escondidos no cardápio ou simplesmente esquecidos.',
      acao: 'Verifique a disponibilidade e a visibilidade no cardápio online.',
      itens: sumidos.slice(0, 4),
    });

    return list;
  }, [itens, abcMap]);

  function toggleOrd(col) {
    setOrd(o => o.col === col ? { col, dir: o.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' });
  }

  const itensFiltrados = useMemo(() => {
    let l = itens.filter(i => !busca || i.nome.toLowerCase().includes(busca.toLowerCase()));
    return [...l].sort((a, b) => {
      const va = a[ord.col] ?? 0, vb = b[ord.col] ?? 0;
      if (typeof va === 'string') return ord.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return ord.dir === 'asc' ? va - vb : vb - va;
    });
  }, [itens, busca, ord]);

  const abcGrupos = useMemo(() => {
    const g = { A: [], B: [], C: [] };
    for (const it of itens.filter(i => i.receita > 0)) {
      (g[abcMap[it.nome] || 'C'] ??= []).push(it);
    }
    for (const k of 'ABC') g[k].sort((a, b) => b.receita - a.receita);
    return g;
  }, [itens, abcMap]);

  const ABAS = [
    { id: 'ranking', label: 'Produtos' },
    { id: 'abc', label: 'Curva ABC' },
    { id: 'projec', label: 'Projeção' },
    { id: 'sug', label: 'Insights', badge: sugestoes.length },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Relatório de Produtos</h1>
          <p className="text-sm text-slate-500 mt-0.5 capitalize">{mesLabel(mes)}</p>
        </div>
        <input type="month" value={mes} onChange={e => { setMes(e.target.value); setAberto(null); }}
          className="input max-w-[155px]" />
      </div>

      {isLoading ? <div className="py-20"><PageLoading /></div> : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Produtos vendidos" val={kpis.n} sub={`${kpis.qtd} unidades · ${kpis.totalPedidos} pedidos`} icon={ShoppingCart} acor="#3b82f6" />
            <Kpi label="Faturamento" val={brl(kpis.fat)} sub="receita total do período" icon={DollarSign} acor="#22c55e" />
            <Kpi label="Margem de lucro" val={pct(kpis.margPct)} sub={brl(kpis.marg) + ' de lucro bruto'} icon={Percent} acor={kpis.margPct >= 30 ? '#22c55e' : kpis.margPct >= 15 ? '#f59e0b' : '#ef4444'} />
            <Kpi label="Sem custo cadastrado" val={kpis.semFicha} sub="produtos com margem desconhecida" icon={AlertTriangle} acor={kpis.semFicha > 0 ? '#f59e0b' : '#94a3b8'} />
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 bg-slate-100 p-1 rounded-xl w-fit">
            {ABAS.map(a => (
              <button key={a.id} onClick={() => setAba(a.id)}
                className={`relative px-5 py-2 rounded-lg text-sm font-medium transition-all ${aba === a.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}>
                {a.label}
                {a.badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {a.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ───── ABA RANKING ───── */}
          {aba === 'ranking' && (
            <div className="card overflow-hidden">
              {/* barra de busca e ordenação */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
                <div className="relative flex-1 max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input value={busca} onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar produto..." className="input pl-9 pr-8 py-2 text-sm w-full" />
                  {busca && <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={12} /></button>}
                </div>
                <span className="text-xs text-slate-400">{itensFiltrados.length} produtos</span>
              </div>

              {/* tabela */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 py-3 w-6">#</th>
                      <ColH col="nome" label="Produto" ord={ord} toggle={toggleOrd} />
                      <ColH col="qtd" label="Qtd" ord={ord} toggle={toggleOrd} right />
                      <ColH col="receita" label="Receita" ord={ord} toggle={toggleOrd} right />
                      <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">Participação</th>
                      <ColH col="margem_pct" label="Margem" ord={ord} toggle={toggleOrd} right />
                      <th className="text-right text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3">Vs. mês passado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {itensFiltrados.map((item, idx) => {
                      const fatTotal = kpis.fat;
                      const partic = fatTotal > 0 ? (item.receita / fatTotal) * 100 : 0;
                      const t = tend(item.receita, item.prev_receita);
                      const abc = abcMap[item.nome];
                      const isOpen = aberto === item.nome;

                      return (
                        <React.Fragment key={item.nome}>
                          <tr
                            onClick={() => setAberto(isOpen ? null : item.nome)}
                            className={`cursor-pointer hover:bg-slate-50 transition-colors ${isOpen ? 'bg-blue-50/50' : ''}`}
                          >
                            <td className="px-5 py-3.5 text-slate-300 text-xs font-mono">{idx + 1}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                {abc && (
                                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                    style={{ background: C[`abc${abc}`] }}>{abc}</span>
                                )}
                                <span className="font-medium text-slate-800">{item.nome}</span>
                                {item.sem_ficha && (
                                  <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                    sem custo
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-right text-slate-600 font-mono">{item.qtd}</td>
                            <td className="px-4 py-3.5 text-right font-semibold font-mono text-slate-800">{brl(item.receita)}</td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2 justify-end">
                                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.min(100, partic)}%` }} />
                                </div>
                                <span className="text-xs text-slate-500 w-8 text-right">{partic.toFixed(0)}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              {item.sem_ficha
                                ? <span className="text-slate-300 text-xs">—</span>
                                : <MargCell v={item.margem_pct} />
                              }
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              {item.prev_receita === 0
                                ? <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">novo</span>
                                : t === null ? null : <TendCell v={t} />
                              }
                            </td>
                          </tr>

                          {/* painel de histórico */}
                          {isOpen && (
                            <tr>
                              <td colSpan={7} className="bg-slate-50 border-t border-slate-100 px-5 py-4">
                                <div className="flex items-center justify-between mb-3">
                                  <p className="text-sm font-semibold text-slate-700">Histórico de vendas — {item.nome}</p>
                                  <div className="flex gap-4 text-xs text-slate-500">
                                    <span>Preço médio: <strong>{brl(item.preco_medio)}</strong></span>
                                    {!item.sem_ficha && <span>Custo unit.: <strong>{brl(item.custo_unit)}</strong></span>}
                                    {!item.sem_ficha && <span>CMV: <strong>{pct(item.cmv_pct)}</strong></span>}
                                  </div>
                                </div>
                                {historico.length === 0
                                  ? <p className="text-xs text-slate-400 py-2">Carregando...</p>
                                  : <MiniHistorico data={historico} />
                                }
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ───── ABA ABC ───── */}
          {aba === 'abc' && (
            <div className="space-y-4">
              {/* explicação */}
              <div className="card p-5">
                <h2 className="font-bold text-slate-800 text-base mb-1">O que é a Curva ABC?</h2>
                <p className="text-sm text-slate-500">
                  É uma forma de separar seus produtos por importância no faturamento.
                  Os produtos <strong className="text-green-600">Classe A</strong> são os mais valiosos — geram 70% da receita, mas costumam ser poucos.
                  <strong className="text-amber-500"> Classe B</strong> complementam bem.
                  <strong className="text-slate-500"> Classe C</strong> têm pouca representatividade.
                </p>

                <div className="grid grid-cols-3 gap-4 mt-5">
                  {[
                    { cls: 'A', label: 'Foco total', desc: '70% da receita', cor: C.abcA, light: '#f0fdf4', border: '#bbf7d0' },
                    { cls: 'B', label: 'Atenção moderada', desc: '20% da receita', cor: C.abcB, light: '#fffbeb', border: '#fde68a' },
                    { cls: 'C', label: 'Monitorar', desc: '10% da receita', cor: C.abcC, light: '#f8fafc', border: '#e2e8f0' },
                  ].map(g => {
                    const grupo = abcGrupos[g.cls] || [];
                    const fatGrupo = grupo.reduce((s, i) => s + i.receita, 0);
                    const parcGrupo = kpis.fat > 0 ? (fatGrupo / kpis.fat) * 100 : 0;
                    return (
                      <div key={g.cls} className="rounded-2xl p-4 border" style={{ background: g.light, borderColor: g.border }}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: g.cor }}>{g.cls}</span>
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{g.label}</p>
                            <p className="text-xs text-slate-500">{grupo.length} produtos · {parcGrupo.toFixed(0)}% da receita</p>
                          </div>
                        </div>
                        <p className="text-lg font-bold text-slate-900 mb-3">{brl(fatGrupo)}</p>
                        <div className="space-y-1.5">
                          {grupo.slice(0, 6).map((it, i) => (
                            <div key={it.nome} className="flex justify-between text-xs">
                              <span className="text-slate-600 truncate">{i + 1}. {it.nome}</span>
                              <span className="font-mono text-slate-500 ml-2 shrink-0">{brl(it.receita)}</span>
                            </div>
                          ))}
                          {grupo.length > 6 && <p className="text-xs text-slate-400 mt-1">+{grupo.length - 6} produtos</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* gráfico de barras pareto */}
              <div className="card p-5">
                <h3 className="font-semibold text-slate-700 mb-1">Receita por produto (do maior para o menor)</h3>
                <p className="text-xs text-slate-400 mb-4">A linha tracejada mostra o acumulado de receita</p>
                <AbcChart itens={itens} abcMap={abcMap} fatTotal={kpis.fat} />
              </div>
            </div>
          )}

          {/* ───── ABA PROJEÇÃO ───── */}
          {aba === 'projec' && (
            <div className="space-y-4">
              <div className="card p-6">
                {fatorProj === 1 ? (
                  <p className="text-sm text-slate-500">Mês encerrado — exibindo dados realizados.</p>
                ) : (
                  <>
                    <p className="text-slate-500 text-sm mb-2">
                      Você está no dia {diasVenda} de {(() => { const [y, m] = mes.split('-').map(Number); return new Date(y, m, 0).getDate(); })()} com vendas este mês.
                      Se o ritmo continuar...
                    </p>
                    <p className="text-3xl font-bold text-slate-900 mb-1">
                      Você vai faturar <span className="text-emerald-600">{brl(kpis.fat * fatorProj)}</span> este mês
                    </p>
                    <p className="text-sm text-slate-500 mb-6">
                      Já faturou <strong>{brl(kpis.fat)}</strong> · Margem projetada: <strong>{pct(kpis.margPct)}</strong> ({brl(kpis.marg * fatorProj)})
                    </p>

                    {/* barra de progresso do mês */}
                    <div className="mb-6">
                      <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                        <span>Progresso do mês</span>
                        <span>{((diasVenda / (() => { const [y, m] = mes.split('-').map(Number); return new Date(y, m, 0).getDate(); })()) * 100).toFixed(0)}% dos dias passaram</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all"
                          style={{ width: `${(diasVenda / (() => { const [y, m] = mes.split('-').map(Number); return new Date(y, m, 0).getDate(); })()) * 100}%` }} />
                      </div>
                    </div>
                  </>
                )}

                {/* mini cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { l: 'Fat. realizado', v: brl(kpis.fat) },
                    { l: 'Fat. projetado', v: brl(kpis.fat * fatorProj) },
                    { l: 'Unidades projetadas', v: Math.round(kpis.qtd * fatorProj) },
                    { l: 'Média por dia', v: brl(diasVenda > 0 ? kpis.fat / diasVenda : 0) },
                  ].map(c => (
                    <div key={c.l} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-400 mb-1">{c.l}</p>
                      <p className="font-bold text-slate-900">{c.v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* tabela top 10 projetados */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-800">Top 10 produtos — projeção do mês</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Estimativa se o ritmo atual se mantiver até o fim do mês</p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-xs font-semibold text-slate-400 px-5 py-3">#</th>
                      <th className="text-left text-xs font-semibold text-slate-400 px-4 py-3">Produto</th>
                      <th className="text-right text-xs font-semibold text-slate-400 px-4 py-3">Realizado</th>
                      <th className="text-right text-xs font-semibold text-slate-400 px-4 py-3">Projetado</th>
                      <th className="text-right text-xs font-semibold text-slate-400 px-4 py-3">Qtd proj.</th>
                      <th className="text-right text-xs font-semibold text-slate-400 px-4 py-3">Vs. mês ant.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {[...itens].filter(i => i.receita > 0).sort((a, b) => b.receita - a.receita).slice(0, 10).map((it, i) => {
                      const proj = it.receita * fatorProj;
                      const t = tend(proj, it.prev_receita);
                      return (
                        <tr key={it.nome} className="hover:bg-slate-50">
                          <td className="px-5 py-3 text-slate-300 text-xs font-mono">{i + 1}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{it.nome}</td>
                          <td className="px-4 py-3 text-right font-mono text-slate-400">{brl(it.receita)}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{brl(proj)}</td>
                          <td className="px-4 py-3 text-right text-slate-500">{Math.round(it.qtd * fatorProj)}</td>
                          <td className="px-4 py-3 text-right">
                            {it.prev_receita === 0
                              ? <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">novo</span>
                              : <TendCell v={t} />
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ───── ABA SUGESTÕES ───── */}
          {aba === 'sug' && (
            <div className="space-y-3">
              {sugestoes.length === 0 ? (
                <div className="card p-12 text-center">
                  <CheckCircle size={36} className="text-emerald-400 mx-auto mb-3" />
                  <p className="font-semibold text-slate-700">Tudo parece ok por aqui!</p>
                  <p className="text-sm text-slate-400 mt-1">Nenhum alerta encontrado para este mês.</p>
                </div>
              ) : sugestoes.map(s => (
                <SugestaoCard key={s.id} s={s} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── sub-componentes ────────────────────────────────────────────────────────────

function Kpi({ label, val, sub, icon: Icon, acor }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</span>
        <Icon size={15} style={{ color: acor }} />
      </div>
      <p className="text-2xl font-bold" style={{ color: acor }}>{val}</p>
      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{sub}</p>
    </div>
  );
}

function ColH({ col, label, ord, toggle, right }) {
  const ativo = ord.col === col;
  return (
    <th className={`text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-3 cursor-pointer select-none hover:text-slate-600 ${right ? 'text-right' : 'text-left'}`}
      onClick={() => toggle(col)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {ativo
          ? ord.dir === 'desc' ? <ChevronDown size={11} className="text-amber-500" /> : <ChevronUp size={11} className="text-amber-500" />
          : <ChevronDown size={11} className="text-slate-200" />
        }
      </span>
    </th>
  );
}

function MargCell({ v }) {
  const cor = v >= 40 ? C.green : v >= 20 ? C.amber : C.red;
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-14 h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: cor }} />
      </div>
      <span className="text-xs font-semibold font-mono" style={{ color: cor }}>{pct(v)}</span>
    </div>
  );
}

function TendCell({ v }) {
  if (v === null || Math.abs(v) < 5) {
    return <span className="inline-flex items-center gap-0.5 text-xs text-slate-400"><Minus size={10} /> estável</span>;
  }
  if (v > 0) {
    return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-600"><ArrowUpRight size={12} />+{v.toFixed(0)}%</span>;
  }
  return <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-500"><ArrowDownRight size={12} />{v.toFixed(0)}%</span>;
}

function MiniHistorico({ data }) {
  return (
    <div className="flex gap-6">
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data.map(h => ({ mes: h.mes.slice(5) + '/' + h.mes.slice(2, 4), Qtd: h.qtd, Receita: +h.receita.toFixed(2) }))}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#94a3b8' }} />
          <YAxis yAxisId="l" tick={{ fontSize: 10, fill: '#94a3b8' }} width={28} />
          <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: '#94a3b8' }} width={55} tickFormatter={v => brl(v)} />
          <Tooltip formatter={(v, n) => n === 'Receita' ? brl(v) : v} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar yAxisId="l" dataKey="Qtd" fill="#cbd5e1" radius={[2, 2, 0, 0]} />
          <Line yAxisId="r" type="monotone" dataKey="Receita" stroke="#e11d48" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const COR_SUG = {
  red: { bg: '#fff5f5', border: '#fecaca', icon: '#ef4444', badge: 'bg-red-100 text-red-600' },
  amber: { bg: '#fffbeb', border: '#fde68a', icon: '#f59e0b', badge: 'bg-amber-100 text-amber-600' },
  green: { bg: '#f0fdf4', border: '#bbf7d0', icon: '#16a34a', badge: 'bg-green-100 text-green-700' },
  blue: { bg: '#eff6ff', border: '#bfdbfe', icon: '#2563eb', badge: 'bg-blue-100 text-blue-600' },
  slate: { bg: '#f8fafc', border: '#e2e8f0', icon: '#64748b', badge: 'bg-slate-100 text-slate-600' },
};

function SugestaoCard({ s }) {
  const [exp, setExp] = useState(true);
  const c = COR_SUG[s.cor] || COR_SUG.slate;
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: c.bg, borderColor: c.border }}>
      <button className="w-full flex items-start gap-3 p-5 text-left" onClick={() => setExp(e => !e)}>
        <s.icon size={20} style={{ color: c.icon, marginTop: 2, flexShrink: 0 }} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800">{s.titulo}</p>
          <p className="text-sm text-slate-500 mt-0.5">{s.desc}</p>
        </div>
        {exp ? <ChevronUp size={16} className="text-slate-400 mt-1 shrink-0" /> : <ChevronDown size={16} className="text-slate-400 mt-1 shrink-0" />}
      </button>

      {exp && (
        <div className="px-5 pb-5 -mt-1">
          {/* produtos afetados */}
          {s.itens.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {s.itens.map(it => (
                <span key={it.nome} className={`text-xs font-medium px-2.5 py-1 rounded-full ${c.badge}`}>{it.nome}</span>
              ))}
            </div>
          )}
          {/* ação recomendada */}
          <div className="flex items-start gap-2 bg-white/70 rounded-xl px-4 py-3">
            <Zap size={13} style={{ color: c.icon, marginTop: 1, flexShrink: 0 }} />
            <p className="text-xs text-slate-600"><strong>O que fazer:</strong> {s.acao}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function AbcChart({ itens, abcMap, fatTotal }) {
  const dados = [...itens]
    .filter(i => i.receita > 0)
    .sort((a, b) => b.receita - a.receita)
    .map(it => ({
      nome: it.nome.length > 16 ? it.nome.slice(0, 16) + '…' : it.nome,
      receita: parseFloat(it.receita.toFixed(2)),
      abc: abcMap[it.nome] || 'C',
    }));

  // linha de acumulado
  let acum = 0;
  const comAcum = dados.map(d => {
    acum += d.receita;
    return { ...d, acumulado: fatTotal > 0 ? parseFloat(((acum / fatTotal) * 100).toFixed(1)) : 0 };
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={comAcum} margin={{ top: 4, right: 45, bottom: 55, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="nome" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-40} textAnchor="end" interval={0} />
        <YAxis yAxisId="l" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => brl(v)} width={60} />
        <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} width={35} />
        <Tooltip formatter={(v, n) => n === 'Acumulado' ? `${v}%` : brl(v)} />
        <Bar yAxisId="l" dataKey="receita" name="Receita" radius={[3, 3, 0, 0]}>
          {comAcum.map((d, i) => <Cell key={i} fill={C[`abc${d.abc}`]} />)}
        </Bar>
        <Line yAxisId="r" type="monotone" dataKey="acumulado" name="Acumulado" stroke="#6366f1" strokeWidth={2} dot={false} strokeDasharray="4 2" />
      </BarChart>
    </ResponsiveContainer>
  );
}
