import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
  LineChart, Line,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle, Star,
  Target, Zap, Package, ChevronUp, ChevronDown,
  ArrowUpRight, ArrowDownRight, Info, Search, X,
  BarChart2, Award, Lightbulb, ShoppingBag,
} from 'lucide-react';
import { api } from '../api/client';
import { PageLoading } from '../components/Loading';
import { brl, pct, mesLabel, mesAtual } from '../lib/fmt';

const CORES_ABC = { A: '#10b981', B: '#f59e0b', C: '#94a3b8' };

function mesPrevStr(mes) {
  const [ano, m] = mes.split('-').map(Number);
  const d = new Date(ano, m - 2, 1);
  return d.toISOString().slice(0, 7);
}

function classificarABC(itens) {
  const ordenados = [...itens].filter(i => i.receita > 0).sort((a, b) => b.receita - a.receita);
  const total = ordenados.reduce((s, i) => s + i.receita, 0);
  let acum = 0;
  const mapa = {};
  for (const item of ordenados) {
    acum += item.receita;
    const pctAcum = total > 0 ? (acum / total) * 100 : 100;
    mapa[item.nome] = pctAcum <= 70 ? 'A' : pctAcum <= 90 ? 'B' : 'C';
  }
  return mapa;
}

function tendencia(atual, prev) {
  if (!prev || prev === 0) return 0;
  return ((atual - prev) / prev) * 100;
}

export default function Relatorios() {
  const [mes, setMes] = useState(mesAtual());
  const [aba, setAba] = useState('ranking');
  const [busca, setBusca] = useState('');
  const [ordenar, setOrdenar] = useState({ col: 'receita', dir: 'desc' });
  const [itemDetalhe, setItemDetalhe] = useState(null);

  const { data: comp, isLoading } = useQuery({
    queryKey: ['itens-comp', mes],
    queryFn: () => api.get(`/relatorios/itens-comp?mes=${mes}`),
  });

  const { data: historico = [] } = useQuery({
    queryKey: ['item-historico', itemDetalhe],
    queryFn: () => api.get(`/relatorios/item-historico?nome=${encodeURIComponent(itemDetalhe)}`),
    enabled: !!itemDetalhe,
  });

  const itens = comp?.itens || [];
  const diasComVendas = comp?.dias_com_vendas || 0;
  const totalPedidos = comp?.total_pedidos || 0;

  // Projeção: dias passados no mês vs dias totais
  const projecao = useMemo(() => {
    if (!mes) return 1;
    const [ano, m] = mes.split('-').map(Number);
    const hoje = new Date();
    const isMesAtual = ano === hoje.getFullYear() && m === (hoje.getMonth() + 1);
    const diasNoMes = new Date(ano, m, 0).getDate();
    if (!isMesAtual || diasComVendas === 0) return 1;
    return diasNoMes / diasComVendas;
  }, [mes, diasComVendas]);

  const abcMapa = useMemo(() => classificarABC(itens), [itens]);

  // KPIs
  const kpis = useMemo(() => {
    const ativos = itens.filter(i => i.receita > 0);
    const faturamento = ativos.reduce((s, i) => s + i.receita, 0);
    const margem = ativos.reduce((s, i) => s + i.margem, 0);
    const qtdTotal = ativos.reduce((s, i) => s + i.qtd, 0);
    const margemPct = faturamento > 0 ? (margem / faturamento) * 100 : 0;
    const semFicha = itens.filter(i => i.sem_ficha && i.receita > 0).length;
    return { ativos: ativos.length, faturamento, margem, margemPct, qtdTotal, semFicha };
  }, [itens]);

  // Itens filtrados e ordenados
  const itensFiltrados = useMemo(() => {
    let lista = itens.filter(i =>
      !busca || i.nome.toLowerCase().includes(busca.toLowerCase())
    );
    lista = [...lista].sort((a, b) => {
      let va = a[ordenar.col] ?? 0;
      let vb = b[ordenar.col] ?? 0;
      if (ordenar.col === 'nome') { va = a.nome; vb = b.nome; }
      if (ordenar.col === 'abc') { va = abcMapa[a.nome] || 'C'; vb = abcMapa[b.nome] || 'C'; }
      if (typeof va === 'string') return ordenar.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return ordenar.dir === 'asc' ? va - vb : vb - va;
    });
    return lista;
  }, [itens, busca, ordenar, abcMapa]);

  // ABC agrupado
  const abcGrupos = useMemo(() => {
    const grupos = { A: [], B: [], C: [] };
    for (const item of itens.filter(i => i.receita > 0)) {
      const cls = abcMapa[item.nome] || 'C';
      grupos[cls].push(item);
    }
    for (const k of Object.keys(grupos)) grupos[k].sort((a, b) => b.receita - a.receita);
    return grupos;
  }, [itens, abcMapa]);

  // Sugestões
  const sugestoes = useMemo(() => {
    const lista = [];
    const ativos = itens.filter(i => i.receita > 0);
    const faturamento = ativos.reduce((s, i) => s + i.receita, 0);

    // CMV alto
    const cmvAlto = ativos.filter(i => !i.sem_ficha && i.cmv_pct > 40).sort((a, b) => b.cmv_pct - a.cmv_pct);
    if (cmvAlto.length > 0) lista.push({
      tipo: 'alerta', icon: AlertTriangle, cor: 'text-red-500', bg: 'bg-red-50 border-red-200',
      titulo: 'CMV Alto (acima de 40%)',
      desc: `${cmvAlto.length} ${cmvAlto.length === 1 ? 'item consome' : 'itens consomem'} mais de 40% da receita em custo. Revise preços ou fornecedores.`,
      itens: cmvAlto.slice(0, 5).map(i => ({ nome: i.nome, info: `CMV ${pct(i.cmv_pct)}` })),
    });

    // Sem ficha técnica
    const semFicha = ativos.filter(i => i.sem_ficha);
    if (semFicha.length > 0) lista.push({
      tipo: 'aviso', icon: Info, cor: 'text-amber-500', bg: 'bg-amber-50 border-amber-200',
      titulo: 'Sem Ficha Técnica',
      desc: `${semFicha.length} ${semFicha.length === 1 ? 'item vendido não tem' : 'itens vendidos não têm'} ficha técnica cadastrada. O CMV deles é zero e não reflete a realidade.`,
      itens: semFicha.slice(0, 5).map(i => ({ nome: i.nome, info: brl(i.receita) + ' faturados' })),
    });

    // Estrelas: classe A com margem > 30%
    const estrelas = (abcGrupos.A || []).filter(i => i.margem_pct >= 30 && !i.sem_ficha);
    if (estrelas.length > 0) lista.push({
      tipo: 'destaque', icon: Star, cor: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200',
      titulo: 'Estrelas do Cardápio',
      desc: `${estrelas.length} ${estrelas.length === 1 ? 'item combina' : 'itens combinam'} alto volume de vendas com boa margem. Priorize no marketing.`,
      itens: estrelas.slice(0, 5).map(i => ({ nome: i.nome, info: `Margem ${pct(i.margem_pct)}` })),
    });

    // Oportunidades: alto volume, margem baixa
    const opor = ativos.filter(i => !i.sem_ficha && i.margem_pct < 30 && i.margem_pct >= 0 && i.qtd >= 5);
    if (opor.length > 0) lista.push({
      tipo: 'oportunidade', icon: Target, cor: 'text-sky-600', bg: 'bg-sky-50 border-sky-200',
      titulo: 'Oportunidades de Margem',
      desc: `${opor.length} ${opor.length === 1 ? 'item tem' : 'itens têm'} bom volume mas margem abaixo de 30%. Um pequeno ajuste de preço pode impactar muito o lucro.`,
      itens: opor.slice(0, 5).map(i => ({ nome: i.nome, info: `${i.qtd}x | Margem ${pct(i.margem_pct)}` })),
    });

    // Em queda: qtd caiu mais de 30%
    const emQueda = ativos.filter(i => i.prev_qtd > 0 && tendencia(i.qtd, i.prev_qtd) < -30);
    if (emQueda.length > 0) lista.push({
      tipo: 'queda', icon: TrendingDown, cor: 'text-orange-500', bg: 'bg-orange-50 border-orange-200',
      titulo: 'Em Queda Vs. Mês Anterior',
      desc: `${emQueda.length} ${emQueda.length === 1 ? 'item caiu' : 'itens caíram'} mais de 30% em volume de vendas em relação ao mês passado.`,
      itens: emQueda.slice(0, 5).map(i => ({ nome: i.nome, info: `${tendencia(i.qtd, i.prev_qtd).toFixed(0)}%` })),
    });

    // Em alta: qtd subiu mais de 30%
    const emAlta = ativos.filter(i => i.prev_qtd > 0 && tendencia(i.qtd, i.prev_qtd) > 30);
    if (emAlta.length > 0) lista.push({
      tipo: 'alta', icon: TrendingUp, cor: 'text-teal-600', bg: 'bg-teal-50 border-teal-200',
      titulo: 'Em Alta Vs. Mês Anterior',
      desc: `${emAlta.length} ${emAlta.length === 1 ? 'item cresceu' : 'itens cresceram'} mais de 30% vs. mês passado. Garanta estoque!`,
      itens: emAlta.slice(0, 5).map(i => ({ nome: i.nome, info: `+${tendencia(i.qtd, i.prev_qtd).toFixed(0)}%` })),
    });

    // Sumiram: vendidos no mês anterior, zero neste
    const sumiram = itens.filter(i => i.qtd === 0 && i.prev_qtd > 0);
    if (sumiram.length > 0) lista.push({
      tipo: 'alerta', icon: Package, cor: 'text-slate-500', bg: 'bg-slate-50 border-slate-200',
      titulo: 'Pararam de Ser Vendidos',
      desc: `${sumiram.length} ${sumiram.length === 1 ? 'item tinha' : 'itens tinham'} vendas no mês anterior e zerou neste mês. Verifique disponibilidade e visibilidade no cardápio.`,
      itens: sumiram.slice(0, 5).map(i => ({ nome: i.nome, info: `Era ${i.prev_qtd}x no mês anterior` })),
    });

    return lista;
  }, [itens, abcGrupos]);

  function toggleOrdem(col) {
    setOrdenar(o => o.col === col ? { col, dir: o.dir === 'desc' ? 'asc' : 'desc' } : { col, dir: 'desc' });
  }

  function SortIcon({ col }) {
    if (ordenar.col !== col) return <ChevronDown size={12} className="text-slate-300" />;
    return ordenar.dir === 'desc' ? <ChevronDown size={12} className="text-amber-500" /> : <ChevronUp size={12} className="text-amber-500" />;
  }

  const abas = [
    { id: 'ranking', label: 'Ranking', icon: BarChart2 },
    { id: 'abc', label: 'Análise ABC', icon: Award },
    { id: 'projec', label: 'Projeções', icon: TrendingUp },
    { id: 'sug', label: 'Sugestões', icon: Lightbulb },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatório de Itens</h1>
          <p className="page-subtitle capitalize">{mesLabel(mes)}</p>
        </div>
        <input
          type="month"
          value={mes}
          onChange={e => { setMes(e.target.value); setItemDetalhe(null); }}
          className="input max-w-[160px]"
        />
      </div>

      {isLoading ? <PageLoading /> : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KpiCard icon={ShoppingBag} label="Itens Ativos" valor={kpis.ativos} sub={`${kpis.qtdTotal} unidades vendidas`} cor="text-sky-600" />
            <KpiCard icon={BarChart2} label="Faturamento" valor={brl(kpis.faturamento)} sub={`${totalPedidos} pedidos`} cor="text-emerald-600" />
            <KpiCard icon={TrendingUp} label="Margem Total" valor={brl(kpis.margem)} sub={`${pct(kpis.margemPct)} do faturamento`} cor={kpis.margem >= 0 ? 'text-teal-600' : 'text-red-500'} />
            <KpiCard icon={AlertTriangle} label="Sem Ficha" valor={kpis.semFicha} sub="itens sem custo cadastrado" cor={kpis.semFicha > 0 ? 'text-amber-500' : 'text-slate-400'} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {abas.map(a => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${aba === a.id ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <a.icon size={14} />
                {a.label}
                {a.id === 'sug' && sugestoes.length > 0 && (
                  <span className="bg-amber-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center ml-0.5">
                    {sugestoes.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Ranking ── */}
          {aba === 'ranking' && (
            <div className="card">
              <div className="card-header">
                <h2 className="font-semibold text-slate-800">Ranking de Itens</h2>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    placeholder="Buscar item..."
                    className="input pl-8 pr-8 py-1.5 text-sm w-52"
                  />
                  {busca && <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={12} /></button>}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="w-8">#</th>
                      <Th col="nome" label="Item" ord={ordenar} toggle={toggleOrdem}><SortIcon col="nome" /></Th>
                      <Th col="qtd" label="Qtd" ord={ordenar} toggle={toggleOrdem} right><SortIcon col="qtd" /></Th>
                      <Th col="receita" label="Receita" ord={ordenar} toggle={toggleOrdem} right><SortIcon col="receita" /></Th>
                      <Th col="preco_medio" label="Preço Médio" ord={ordenar} toggle={toggleOrdem} right><SortIcon col="preco_medio" /></Th>
                      <Th col="custo_unit" label="Custo Unit." ord={ordenar} toggle={toggleOrdem} right><SortIcon col="custo_unit" /></Th>
                      <Th col="margem" label="Margem R$" ord={ordenar} toggle={toggleOrdem} right><SortIcon col="margem" /></Th>
                      <Th col="margem_pct" label="Margem %" ord={ordenar} toggle={toggleOrdem} right><SortIcon col="margem_pct" /></Th>
                      <Th col="cmv_pct" label="CMV %" ord={ordenar} toggle={toggleOrdem} right><SortIcon col="cmv_pct" /></Th>
                      <th className="text-right">Tend.</th>
                      <Th col="abc" label="ABC" ord={ordenar} toggle={toggleOrdem}><SortIcon col="abc" /></Th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensFiltrados.map((item, idx) => {
                      const tend = tendencia(item.receita, item.prev_receita);
                      const abc = abcMapa[item.nome] || (item.receita === 0 ? '—' : 'C');
                      return (
                        <tr key={item.nome} className={`cursor-pointer ${itemDetalhe === item.nome ? 'bg-amber-50' : ''}`} onClick={() => setItemDetalhe(item.nome === itemDetalhe ? null : item.nome)}>
                          <td className="text-slate-400 text-xs">{idx + 1}</td>
                          <td className="font-medium">
                            <div className="flex items-center gap-2">
                              {item.nome}
                              {item.sem_ficha && <span className="text-xs text-amber-500 bg-amber-50 px-1 rounded">sem ficha</span>}
                            </div>
                          </td>
                          <td className="text-right">{item.qtd}</td>
                          <td className="text-right font-mono">{brl(item.receita)}</td>
                          <td className="text-right font-mono text-slate-500">{brl(item.preco_medio)}</td>
                          <td className="text-right font-mono text-slate-500">{item.sem_ficha ? '—' : brl(item.custo_unit)}</td>
                          <td className={`text-right font-mono ${item.margem >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{item.sem_ficha ? '—' : brl(item.margem)}</td>
                          <td className="text-right">
                            {item.sem_ficha ? '—' : (
                              <MargBar pct={item.margem_pct} />
                            )}
                          </td>
                          <td className="text-right">
                            {item.sem_ficha ? <span className="text-amber-400 text-xs">?</span> : (
                              <span className={item.cmv_pct > 40 ? 'text-red-500 font-semibold' : item.cmv_pct > 30 ? 'text-amber-500' : 'text-slate-600'}>
                                {pct(item.cmv_pct)}
                              </span>
                            )}
                          </td>
                          <td className="text-right">
                            {item.prev_receita === 0 ? <span className="text-xs text-slate-400">novo</span> : (
                              <TendBadge pct={tend} />
                            )}
                          </td>
                          <td>
                            {abc !== '—' ? (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: CORES_ABC[abc] + '22', color: CORES_ABC[abc] }}>{abc}</span>
                            ) : <span className="text-xs text-slate-300">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Detalhe inline */}
              {itemDetalhe && (
                <ItemDetalhe nome={itemDetalhe} historico={historico} onFechar={() => setItemDetalhe(null)} />
              )}
            </div>
          )}

          {/* ── Análise ABC ── */}
          {aba === 'abc' && (
            <div className="space-y-4">
              <div className="card p-5">
                <h2 className="font-semibold text-slate-800 mb-1">Curva ABC de Produtos</h2>
                <p className="text-sm text-slate-500 mb-5">
                  Classifica os itens pela contribuição no faturamento.
                  <strong className="text-emerald-600"> A</strong>: primeiros 70% da receita &nbsp;·&nbsp;
                  <strong className="text-amber-500"> B</strong>: 70–90% &nbsp;·&nbsp;
                  <strong className="text-slate-500"> C</strong>: últimos 10%
                </p>
                <AbcChart itens={itens} abcMapa={abcMapa} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {(['A', 'B', 'C']).map(cls => (
                  <div key={cls} className="card p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ background: CORES_ABC[cls] }}>{cls}</span>
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">Classe {cls}</p>
                        <p className="text-xs text-slate-400">{abcGrupos[cls]?.length || 0} itens · {brl(abcGrupos[cls]?.reduce((s, i) => s + i.receita, 0) || 0)}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {(abcGrupos[cls] || []).map((item, i) => (
                        <div key={item.nome} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 truncate max-w-[140px]">{i + 1}. {item.nome}</span>
                          <span className="font-mono text-slate-500 ml-2 shrink-0">{brl(item.receita)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Projeções ── */}
          {aba === 'projec' && (
            <div className="space-y-4">
              <div className="card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-slate-800 mb-1">Projeção do Mês</h2>
                    <p className="text-sm text-slate-500">
                      Baseada no ritmo atual ({diasComVendas} dias com vendas) extrapolada para o mês completo.
                      {projecao === 1 && ' (mês já encerrado — exibindo realizado)'}
                    </p>
                  </div>
                  {projecao > 1 && (
                    <span className="text-xs bg-sky-100 text-sky-700 px-3 py-1 rounded-full font-medium">
                      Fator {projecao.toFixed(2)}×
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  {[
                    { label: 'Fat. Projetado', valor: brl(kpis.faturamento * projecao), sub: `Realizado: ${brl(kpis.faturamento)}` },
                    { label: 'Margem Projetada', valor: brl(kpis.margem * projecao), sub: pct(kpis.margemPct) },
                    { label: 'Unid. Projetadas', valor: Math.round(kpis.qtdTotal * projecao), sub: `Realizadas: ${kpis.qtdTotal}` },
                    { label: 'Ticket/Dia Est.', valor: brl(diasComVendas > 0 ? kpis.faturamento / diasComVendas : 0), sub: 'média por dia com vendas' },
                  ].map(c => (
                    <div key={c.label} className="bg-slate-50 rounded-xl p-3">
                      <p className="text-xs text-slate-500 mb-1">{c.label}</p>
                      <p className="font-bold text-slate-900">{c.valor}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
                    </div>
                  ))}
                </div>

                <h3 className="font-medium text-slate-700 text-sm mb-3">Top 10 — Receita Projetada</h3>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Item</th>
                        <th className="text-right">Realizado</th>
                        <th className="text-right">Projetado</th>
                        <th className="text-right">Vs. Mês Ant.</th>
                        <th className="text-right">Qtd Proj.</th>
                        <th className="text-right">Margem Proj.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...itens].filter(i => i.receita > 0).sort((a, b) => b.receita - a.receita).slice(0, 10).map((item, i) => {
                        const proj = item.receita * projecao;
                        const tend = tendencia(proj, item.prev_receita);
                        return (
                          <tr key={item.nome}>
                            <td className="text-slate-400 text-xs">{i + 1}</td>
                            <td className="font-medium">{item.nome}</td>
                            <td className="text-right font-mono text-slate-500">{brl(item.receita)}</td>
                            <td className="text-right font-mono font-semibold">{brl(proj)}</td>
                            <td className="text-right"><TendBadge pct={tend} /></td>
                            <td className="text-right">{Math.round(item.qtd * projecao)}</td>
                            <td className={`text-right font-mono ${item.margem >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {item.sem_ficha ? '—' : brl(item.margem * projecao)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Gráfico top 10 barras */}
              <div className="card p-5">
                <h3 className="font-medium text-slate-700 mb-4">Receita Realizada vs. Projetada — Top 10</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[...itens].filter(i => i.receita > 0).sort((a, b) => b.receita - a.receita).slice(0, 10).map(i => ({
                      nome: i.nome.length > 18 ? i.nome.slice(0, 18) + '…' : i.nome,
                      Realizado: parseFloat(i.receita.toFixed(2)),
                      Projetado: parseFloat((i.receita * projecao).toFixed(2)),
                    }))}
                    margin={{ top: 4, right: 10, bottom: 40, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="nome" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-35} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `R$${(v / 1000).toFixed(1)}k`} />
                    <Tooltip formatter={v => brl(v)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Realizado" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Projetado" fill="#e11d48" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Sugestões ── */}
          {aba === 'sug' && (
            <div className="space-y-4">
              {sugestoes.length === 0 ? (
                <div className="card p-12 text-center text-slate-400">
                  <Zap size={32} className="mx-auto mb-2 opacity-30" />
                  <p>Nenhuma sugestão encontrada para este mês.</p>
                </div>
              ) : sugestoes.map((s, i) => (
                <div key={i} className={`card border ${s.bg} p-5`}>
                  <div className="flex items-start gap-3">
                    <s.icon size={20} className={`${s.cor} mt-0.5 shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold ${s.cor} mb-1`}>{s.titulo}</h3>
                      <p className="text-sm text-slate-600 mb-3">{s.desc}</p>
                      {s.itens.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {s.itens.map(it => (
                            <div key={it.nome} className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs">
                              <span className="font-medium text-slate-700">{it.nome}</span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-500">{it.info}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, valor, sub, cor }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className={cor} />
        <span className="text-xs text-slate-500 font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${cor}`}>{valor}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}

function Th({ col, label, ord, toggle, right, children }) {
  return (
    <th
      className={`cursor-pointer select-none hover:text-slate-700 ${right ? 'text-right' : ''}`}
      onClick={() => toggle(col)}
    >
      <span className="inline-flex items-center gap-1">{label}{children}</span>
    </th>
  );
}

function MargBar({ pct: p }) {
  const clamped = Math.max(-100, Math.min(100, p));
  const cor = p >= 40 ? '#10b981' : p >= 20 ? '#f59e0b' : p >= 0 ? '#ef4444' : '#dc2626';
  return (
    <div className="flex items-center gap-1.5 justify-end">
      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, clamped)}%`, background: cor }} />
      </div>
      <span className="text-xs font-mono" style={{ color: cor }}>{pct(p)}</span>
    </div>
  );
}

function TendBadge({ pct: p }) {
  if (Math.abs(p) < 5) return <span className="text-xs text-slate-400 flex items-center gap-0.5 justify-end"><Minus size={10} /> estável</span>;
  if (p > 0) return <span className="text-xs text-emerald-600 flex items-center gap-0.5 justify-end"><ArrowUpRight size={11} />+{p.toFixed(0)}%</span>;
  return <span className="text-xs text-red-500 flex items-center gap-0.5 justify-end"><ArrowDownRight size={11} />{p.toFixed(0)}%</span>;
}

function AbcChart({ itens, abcMapa }) {
  const ordenados = [...itens].filter(i => i.receita > 0).sort((a, b) => b.receita - a.receita);
  const total = ordenados.reduce((s, i) => s + i.receita, 0);
  let acum = 0;
  const dados = ordenados.map((item, i) => {
    acum += item.receita;
    return {
      nome: item.nome.length > 15 ? item.nome.slice(0, 15) + '…' : item.nome,
      receita: item.receita,
      acumulado: total > 0 ? parseFloat(((acum / total) * 100).toFixed(1)) : 0,
      abc: abcMapa[item.nome] || 'C',
    };
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={dados} margin={{ top: 4, right: 40, bottom: 50, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="nome" tick={{ fontSize: 9, fill: '#94a3b8' }} angle={-40} textAnchor="end" interval={0} />
        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => brl(v)} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => `${v}%`} domain={[0, 100]} />
        <Tooltip formatter={(v, name) => name === 'Acumulado' ? `${v}%` : brl(v)} />
        <Bar yAxisId="left" dataKey="receita" name="Receita" radius={[3, 3, 0, 0]}>
          {dados.map((d, i) => <Cell key={i} fill={CORES_ABC[d.abc]} />)}
        </Bar>
        <Line yAxisId="right" type="monotone" dataKey="acumulado" name="Acumulado" stroke="#6366f1" strokeWidth={2} dot={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ItemDetalhe({ nome, historico, onFechar }) {
  return (
    <div className="border-t border-slate-100 p-5 bg-slate-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">{nome} — Histórico</h3>
        <button onClick={onFechar} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
      </div>
      {historico.length === 0 ? (
        <p className="text-sm text-slate-400">Carregando histórico...</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={historico.map(h => ({
            mes: h.mes.slice(5) + '/' + h.mes.slice(2, 4),
            Qtd: h.qtd,
            Receita: parseFloat(h.receita.toFixed(2)),
          }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#94a3b8' }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} tickFormatter={v => brl(v)} />
            <Tooltip formatter={(v, name) => name === 'Receita' ? brl(v) : v} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="left" dataKey="Qtd" fill="#94a3b8" radius={[2, 2, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="Receita" stroke="#e11d48" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
