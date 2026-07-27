import React, { useState, useEffect, useMemo } from 'react';
import { getToken } from '../../hooks/useAuth';
import { Package, AlertTriangle, ChevronDown, ChevronUp, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardHeader, brl } from './_shared';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const mesAtual = () => new Date().toISOString().slice(0, 7);

function VariacaoBadge({ atual, anterior }) {
  if (!anterior) return <span className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>novo</span>;
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (Math.abs(pct) < 1) return <span className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>estável</span>;
  const Icon = pct >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="text-[10px] font-black flex items-center gap-0.5" style={{ color: pct >= 0 ? '#10b981' : '#ef4444' }}>
      <Icon size={10} strokeWidth={2.5} />{Math.abs(pct)}%
    </span>
  );
}

export default function Produtos() {
  const [mes, setMes] = useState(mesAtual());
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ordem, setOrdem] = useState({ campo: 'receita', dir: 'desc' });
  const [expandido, setExpandido] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/relatorios/itens-comp?mes=${mes}`, { headers: authH() })
      .then(r => r.json()).then(setDados).catch(() => {}).finally(() => setLoading(false));
  }, [mes]);

  const itensOrdenados = useMemo(() => {
    const itens = dados?.itens || [];
    const copia = [...itens];
    copia.sort((a, b) => {
      const va = a[ordem.campo] ?? 0, vb = b[ordem.campo] ?? 0;
      if (typeof va === 'string' || typeof vb === 'string') {
        return ordem.dir === 'desc'
          ? String(vb).localeCompare(String(va), 'pt-BR')
          : String(va).localeCompare(String(vb), 'pt-BR');
      }
      return ordem.dir === 'desc' ? vb - va : va - vb;
    });
    return copia;
  }, [dados, ordem]);

  const semFicha = (dados?.itens || []).filter(i => i.sem_ficha);
  const ranking = useMemo(() => {
    const vendidos = (dados?.itens || []).filter(i => i.qtd > 0);
    const porMargem = [...vendidos].sort((a, b) => b.margem_pct - a.margem_pct);
    return { melhores: porMargem.slice(0, 5), piores: porMargem.slice(-5).reverse() };
  }, [dados]);

  function ordenarPor(campo) {
    setOrdem(o => ({ campo, dir: o.campo === campo && o.dir === 'desc' ? 'asc' : 'desc' }));
  }

  const COLUNAS = [
    { campo: 'nome', label: 'Produto', num: false },
    { campo: 'qtd', label: 'Qtd', num: true },
    { campo: 'receita', label: 'Receita', num: true, fmt: brl },
    { campo: 'custo_total', label: 'Custo', num: true, fmt: brl },
    { campo: 'margem', label: 'Margem R$', num: true, fmt: brl },
    { campo: 'margem_pct', label: 'Margem %', num: true, fmt: v => `${v}%` },
    { campo: 'cmv_pct', label: 'CMV %', num: true, fmt: v => `${v}%` },
  ];

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="text-sm flex items-center gap-2" style={{ color: 'var(--txt-dim)' }}>
        <Activity size={18} strokeWidth={1.75} style={{ color: 'var(--accent)' }} className="animate-pulse" /> Carregando…
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--txt-strong)' }}>
          <Package size={16} strokeWidth={1.75} style={{ color: 'var(--accent)' }} /> Lucratividade por produto
        </h2>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="input max-w-[160px]" />
      </div>

      {semFicha.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b' }}>
          <AlertTriangle size={14} /> {semFicha.length} produtos vendidos sem ficha técnica — custo desconhecido, margem real pode ser menor. Preencha em Fichas Técnicas.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <CardHeader title="Melhores margens" cor="#10b981" />
          <div className="p-3 space-y-2">
            {ranking.melhores.map(it => (
              <div key={it.nome} className="flex items-center justify-between text-xs">
                <span className="truncate flex-1" style={{ color: 'var(--txt)' }}>{it.nome}</span>
                <span className="font-black shrink-0 ml-2" style={{ color: '#10b981' }}>{it.margem_pct}%</span>
              </div>
            ))}
            {ranking.melhores.length === 0 && <p className="text-xs text-center py-4" style={{ color: 'var(--txt-faint)' }}>Sem vendas no mês</p>}
          </div>
        </Card>
        <Card className="p-4">
          <CardHeader title="Piores margens" cor="#ef4444" />
          <div className="p-3 space-y-2">
            {ranking.piores.map(it => (
              <div key={it.nome} className="flex items-center justify-between text-xs">
                <span className="truncate flex-1" style={{ color: 'var(--txt)' }}>{it.nome}</span>
                <span className="font-black shrink-0 ml-2" style={{ color: '#ef4444' }}>{it.margem_pct}%</span>
              </div>
            ))}
            {ranking.piores.length === 0 && <p className="text-xs text-center py-4" style={{ color: 'var(--txt-faint)' }}>Sem vendas no mês</p>}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Todos os produtos vendidos no mês" cor="var(--accent)" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                {COLUNAS.map(c => (
                  <th key={c.campo} onClick={() => ordenarPor(c.campo)}
                    className={`px-3 py-2 font-bold cursor-pointer select-none whitespace-nowrap ${c.num ? 'text-right' : 'text-left'}`}
                    style={{ color: 'var(--txt-dim)' }}>
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {ordem.campo === c.campo && (ordem.dir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-bold" style={{ color: 'var(--txt-dim)' }}>vs mês ant.</th>
              </tr>
            </thead>
            <tbody>
              {itensOrdenados.map(it => (
                <React.Fragment key={it.nome}>
                  <tr className="cursor-pointer hover:bg-white/[0.02]" style={{ borderBottom: '1px solid var(--hairline)' }}
                    onClick={() => setExpandido(expandido === it.nome ? null : it.nome)}>
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--txt-strong)' }}>
                      {it.nome} {it.sem_ficha && <AlertTriangle size={11} className="inline ml-1" style={{ color: '#f59e0b' }} />}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: 'var(--txt)' }}>{it.qtd}</td>
                    <td className="px-3 py-2 text-right" style={{ color: 'var(--txt)' }}>{brl(it.receita)}</td>
                    <td className="px-3 py-2 text-right" style={{ color: 'var(--txt)' }}>{brl(it.custo_total)}</td>
                    <td className="px-3 py-2 text-right font-bold" style={{ color: it.margem >= 0 ? '#10b981' : '#ef4444' }}>{brl(it.margem)}</td>
                    <td className="px-3 py-2 text-right" style={{ color: 'var(--txt)' }}>{it.margem_pct}%</td>
                    <td className="px-3 py-2 text-right" style={{ color: 'var(--txt)' }}>{it.cmv_pct}%</td>
                    <td className="px-3 py-2 text-right"><VariacaoBadge atual={it.receita} anterior={it.prev_receita} /></td>
                  </tr>
                  {expandido === it.nome && <DetalheProduto nome={it.nome} />}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {itensOrdenados.length === 0 && <p className="text-xs text-center py-8" style={{ color: 'var(--txt-faint)' }}>Sem produtos vendidos nesse mês</p>}
        </div>
      </Card>
    </div>
  );
}

function DetalheProduto({ nome }) {
  const [detalhe, setDetalhe] = useState(null);
  useEffect(() => {
    fetch(`${BASE}/relatorios/produto?nome=${encodeURIComponent(nome)}&dias=90`, { headers: authH() })
      .then(r => r.json()).then(setDetalhe).catch(() => {});
  }, [nome]);

  if (!detalhe) return (
    <tr><td colSpan={8} className="px-3 py-3 text-xs text-center" style={{ color: 'var(--txt-faint)' }}>Carregando…</td></tr>
  );

  return (
    <tr>
      <td colSpan={8} className="px-3 py-3" style={{ background: 'var(--space-elev-2)' }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div><span style={{ color: 'var(--txt-faint)' }}>Participação (90d)</span><p className="font-black" style={{ color: 'var(--txt-strong)' }}>{detalhe.participacao}%</p></div>
          <div><span style={{ color: 'var(--txt-faint)' }}>Média/dia</span><p className="font-black" style={{ color: 'var(--txt-strong)' }}>{detalhe.media_dia}</p></div>
          <div><span style={{ color: 'var(--txt-faint)' }}>Lucro por unidade</span><p className="font-black" style={{ color: 'var(--txt-strong)' }}>{brl(detalhe.lucro_unit)}</p></div>
          <div><span style={{ color: 'var(--txt-faint)' }}>Pedidos (90d)</span><p className="font-black" style={{ color: 'var(--txt-strong)' }}>{detalhe.pedidos}</p></div>
        </div>
        {detalhe.insumos?.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-bold uppercase mb-1.5" style={{ color: 'var(--txt-faint)' }}>Insumos (custo total no período)</p>
            <div className="flex flex-wrap gap-2">
              {detalhe.insumos.slice(0, 8).map(ins => (
                <span key={ins.nome} className="px-2 py-1 rounded-lg text-[10px]" style={{ background: 'var(--space-elev)', color: 'var(--txt)' }}>
                  {ins.nome}: {brl(ins.custo_total)}
                </span>
              ))}
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}
