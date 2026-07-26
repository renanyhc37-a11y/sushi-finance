import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight,
  ShoppingBag, Receipt, Package, Trophy, CalendarDays, AlertTriangle, PiggyBank,
} from 'lucide-react';
import { api } from '../api/client';
import { mesAtual } from '../lib/fmt';

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDia = (d) => { if (!d) return '—'; const [, m, dia] = d.split('-'); return `${dia}/${m}`; };
const nomeMes = (mes) => {
  if (!mes) return '';
  const [a, m] = mes.split('-');
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

// Seta de variação vs mês anterior. bomSubir=true → verde quando sobe.
function Delta({ pct, bomSubir = true }) {
  if (pct == null || !isFinite(pct)) return null;
  const sobe = pct >= 0;
  const bom = bomSubir ? sobe : !sobe;
  const cor = Math.abs(pct) < 0.5 ? 'var(--txt-dim)' : (bom ? '#22c55e' : '#ef4444');
  const Icon = sobe ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold" style={{ color: cor }}>
      <Icon size={13} strokeWidth={2.5} />{Math.abs(pct).toFixed(0)}%
      <span className="font-normal ml-0.5" style={{ color: 'var(--txt-faint)' }}>vs mês ant.</span>
    </span>
  );
}

export default function PainelDono() {
  const [mes, setMes] = useState(mesAtual());
  const { data, isLoading } = useQuery({
    queryKey: ['painel-dono', mes],
    queryFn: () => api.get(`/relatorios/painel-dono?mes=${mes}`),
  });

  const entrou = data?.entrou || {};
  const saiu = data?.saiu || {};
  const sobrou = data?.sobrou || {};
  const cmv = data?.cmv || {};
  const ctx = data?.contexto || {};
  const positivo = (sobrou.total ?? 0) >= 0;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><PiggyBank size={22} style={{ color: 'var(--accent)' }} /> Painel do Dono</h1>
          <p className="page-subtitle">A real do mês, sem enrolação: <b>entrou</b>, <b>saiu</b> e <b>sobrou</b>. Base: pedidos do PDV + faturamento importado/lançado manualmente.</p>
        </div>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="input max-w-[160px]" />
      </div>

      {isLoading ? (
        <div className="card p-10 text-center text-sm" style={{ color: 'var(--txt-dim)' }}>Carregando…</div>
      ) : (
        <>
          {/* ── HERO: Entrou / Saiu / Sobrou ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Entrou */}
            <div className="card p-4" style={{ borderTop: '3px solid #22c55e' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.14)' }}><TrendingUp size={17} style={{ color: '#22c55e' }} /></span>
                <span className="text-[13px] font-bold" style={{ color: 'var(--txt-dim)' }}>ENTROU</span>
              </div>
              <p className="text-2xl font-black" style={{ color: 'var(--txt-strong)' }}>{brl(entrou.total)}</p>
              <div className="mt-1"><Delta pct={ctx.vs_anterior?.entrou} bomSubir /></div>
            </div>
            {/* Saiu */}
            <div className="card p-4" style={{ borderTop: '3px solid #ef4444' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.14)' }}><TrendingDown size={17} style={{ color: '#ef4444' }} /></span>
                <span className="text-[13px] font-bold" style={{ color: 'var(--txt-dim)' }}>SAIU</span>
              </div>
              <p className="text-2xl font-black" style={{ color: 'var(--txt-strong)' }}>{brl(saiu.total)}</p>
              <div className="mt-1"><Delta pct={ctx.vs_anterior?.saiu} bomSubir={false} /></div>
            </div>
            {/* Sobrou */}
            <div className="card p-4" style={{ borderTop: `3px solid ${positivo ? 'var(--accent)' : '#ef4444'}`, background: positivo ? 'var(--accent-soft)' : 'rgba(239,68,68,0.06)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: positivo ? 'rgba(var(--accent-rgb),0.18)' : 'rgba(239,68,68,0.14)' }}><Wallet size={17} style={{ color: positivo ? 'var(--accent)' : '#ef4444' }} /></span>
                <span className="text-[13px] font-bold" style={{ color: positivo ? 'var(--accent)' : '#ef4444' }}>SOBROU</span>
              </div>
              <p className="text-2xl font-black" style={{ color: positivo ? 'var(--accent)' : '#ef4444' }}>{brl(sobrou.total)}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--txt-dim)' }}>
                margem {Number(sobrou.margem_pct || 0).toFixed(1)}% · <Delta pct={ctx.vs_anterior?.sobrou} bomSubir />
              </p>
            </div>
          </div>

          {/* frase-resumo em linguagem de dono */}
          <div className="card p-4" style={{ background: 'var(--space-elev)' }}>
            <p className="text-sm" style={{ color: 'var(--txt)' }}>
              Em <b>{nomeMes(mes)}</b> você vendeu <b style={{ color: '#22c55e' }}>{brl(entrou.total)}</b> em <b>{entrou.pedidos || 0} pedidos</b>,
              gastou <b style={{ color: '#ef4444' }}>{brl(saiu.total)}</b> e {positivo
                ? <>terminou com <b style={{ color: 'var(--accent)' }}>{brl(sobrou.total)}</b> no bolso.</>
                : <>ficou <b style={{ color: '#ef4444' }}>{brl(Math.abs(sobrou.total))}</b> no vermelho.</>}
            </p>
          </div>

          {/* ── Números da operação ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Mini icon={ShoppingBag} label="Pedidos" valor={entrou.pedidos || 0} />
            <Mini icon={Receipt} label="Ticket médio" valor={brl(entrou.ticket_medio)} sub="por pedido" />
            <Mini icon={Trophy} label="Melhor dia" valor={ctx.melhor_dia ? brl(ctx.melhor_dia.total) : '—'} sub={ctx.melhor_dia ? fmtDia(ctx.melhor_dia.dia) : ''} />
            <Mini icon={CalendarDays} label="Dias com venda" valor={ctx.dias_com_venda || 0} />
          </div>

          {/* ── Para onde foi o dinheiro (SAIU detalhado) ── */}
          <div className="card p-4">
            <h2 className="text-sm font-bold mb-3 flex items-center gap-1.5" style={{ color: 'var(--txt-strong)' }}><TrendingDown size={15} style={{ color: '#ef4444' }} /> Para onde foi o dinheiro</h2>
            <div className="space-y-2">
              <LinhaSaiu label="Despesas fixas (aluguel, salários…)" valor={saiu.despesas_fixas} total={saiu.total} cor="#ef4444" />
              <LinhaSaiu label="Despesas variáveis" valor={saiu.despesas_variaveis} total={saiu.total} cor="#f97316" />
              <LinhaSaiu label="Compras de mercadoria (insumos)" valor={saiu.compras_mercadoria} total={saiu.total} cor="#a855f7" />
            </div>
            {saiu.maior_gasto && (
              <p className="text-xs mt-3 pt-3" style={{ color: 'var(--txt-dim)', borderTop: '1px solid var(--hairline)' }}>
                Maior gasto do mês: <b style={{ color: 'var(--txt)' }}>{saiu.maior_gasto.descricao?.trim() || '—'}</b> — {brl(saiu.maior_gasto.valor)}
              </p>
            )}
          </div>

          {/* ── CMV / eficiência (indicador, não caixa) ── */}
          <div className="card p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--txt-strong)' }}><Package size={15} style={{ color: 'var(--accent)' }} /> CMV — quanto do faturamento é ingrediente</h2>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--txt-dim)' }}>
                  Indicador de eficiência (não entra na conta de caixa acima)
                  {cmv.apenas_pedidos_pdv && ' · calculado só sobre pedidos que passaram pelo PDV/cardápio (faturamento importado não traz item vendido)'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black" style={{ color: 'var(--accent)' }}>{Number(cmv.pct || 0).toFixed(1)}%</p>
                <p className="text-[11px]" style={{ color: 'var(--txt-dim)' }}>{brl(cmv.total)} em ingredientes</p>
              </div>
            </div>
            {cmv.itens_sem_ficha > 0 && (
              <div className="flex items-center gap-2 mt-3 px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b' }}>
                <AlertTriangle size={14} /> {cmv.itens_sem_ficha} itens vendidos ainda sem ficha técnica — o CMV real é maior. Preencha em Fichas Técnicas / Insumos.
              </div>
            )}
          </div>

          {/* honestidade: mês pode estar incompleto */}
          {(entrou.pedidos || 0) < 5 && (
            <p className="text-xs text-center" style={{ color: 'var(--txt-faint)' }}>
              Poucos pedidos neste mês pelo PDV — os números ficam fiéis conforme as vendas passam pelo sistema.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Mini({ icon: Icon, label, valor, sub }) {
  return (
    <div className="card p-3.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={14} style={{ color: 'var(--txt-dim)' }} />
        <span className="text-[11px] font-semibold" style={{ color: 'var(--txt-dim)' }}>{label}</span>
      </div>
      <p className="text-lg font-black" style={{ color: 'var(--txt-strong)' }}>{valor}</p>
      {sub && <p className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>{sub}</p>}
    </div>
  );
}

function LinhaSaiu({ label, valor, total, cor }) {
  const pct = total > 0 ? (Number(valor || 0) / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span style={{ color: 'var(--txt)' }}>{label}</span>
        <span className="font-mono font-semibold" style={{ color: 'var(--txt-strong)' }}>{brl(valor)}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--space-elev-2)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: cor }} />
      </div>
    </div>
  );
}
