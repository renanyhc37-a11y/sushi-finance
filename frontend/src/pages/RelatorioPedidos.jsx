import React, { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { getToken } from '../hooks/useAuth';

const BASE = import.meta.env.VITE_API_URL || '/api';
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const authH = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

const PAG_LABEL = { pix: 'PIX', dinheiro: 'Dinheiro', cartao_cred: 'Crédito', cartao_deb: 'Débito' };
const STATUS_COR = { entregue: '#10b981', cancelado: '#ef4444', pronto: 'var(--accent-2)', preparando: 'var(--accent-2)', novo: '#3b82f6' };

function localDate(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function hoje() { return localDate(); }
function primeiroDiaMes() { const d = new Date(); d.setDate(1); return localDate(d); }

function exportarCSV(pedidos, inicio, fim) {
  const linhas = [
    ['#', 'Número', 'Cliente', 'Telefone', 'Endereço', 'Itens', 'Pagamento', 'Status', 'Total', 'Data'].join(';'),
    ...pedidos.map((p, i) => [
      i + 1, p.numero, p.cliente_nome, p.cliente_telefone || '', p.cliente_endereco,
      p.itens_resumo || '', PAG_LABEL[p.forma_pagamento] || p.forma_pagamento || '',
      p.status, String(p.total).replace('.', ','),
      new Date(p.created_at).toLocaleString('pt-BR'),
    ].join(';')),
  ];
  const blob = new Blob(['﻿' + linhas.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `pedidos_${inicio}_${fim}.csv`; a.click();
  URL.revokeObjectURL(url);
}

function exportarPDF(pedidos, totais, inicio, fim) {
  const linhasPedido = pedidos.map(p => `
    <tr>
      <td>#${p.numero}</td>
      <td>${p.cliente_nome}</td>
      <td>${p.itens_resumo || '—'}</td>
      <td>${PAG_LABEL[p.forma_pagamento] || p.forma_pagamento || '—'}</td>
      <td class="status" style="color:${STATUS_COR[p.status] || '#333'}">${p.status}</td>
      <td class="valor">${brl(p.total)}</td>
      <td>${new Date(p.created_at).toLocaleDateString('pt-BR')}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"/>
  <title>Relatório de Pedidos</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 20px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .sub { color: #666; font-size: 11px; margin-bottom: 16px; }
    .kpis { display: flex; gap: 16px; margin-bottom: 16px; }
    .kpi { background: #f5f5f5; border-radius: 8px; padding: 10px 16px; }
    .kpi-val { font-size: 18px; font-weight: 900; color: var(--accent); }
    .kpi-label { font-size: 10px; color: #666; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { background: #111; color: #fff; padding: 6px 8px; text-align: left; }
    td { padding: 5px 8px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) td { background: #fafafa; }
    .valor { font-weight: bold; text-align: right; }
    @media print { body { margin: 10px; } }
  </style></head><body>
  <h1>🍣 Relatório de Pedidos</h1>
  <p class="sub">Período: ${new Date(inicio + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(fim + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
  <div class="kpis">
    <div class="kpi"><div class="kpi-val">${totais.total_pedidos}</div><div class="kpi-label">Total de pedidos</div></div>
    <div class="kpi"><div class="kpi-val">${brl(totais.total_faturado)}</div><div class="kpi-label">Faturado</div></div>
    <div class="kpi"><div class="kpi-val">${brl(totais.ticket_medio)}</div><div class="kpi-label">Ticket médio</div></div>
    <div class="kpi"><div class="kpi-val">${totais.cancelados}</div><div class="kpi-label">Cancelados</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Status</th><th>Total</th><th>Data</th></tr></thead>
    <tbody>${linhasPedido}</tbody>
  </table>
  </body></html>`;

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
  document.body.appendChild(iframe);
  iframe.contentDocument.open(); iframe.contentDocument.write(html); iframe.contentDocument.close();
  iframe.onload = () => { setTimeout(() => { iframe.contentWindow.print(); setTimeout(() => iframe.remove(), 2000); }, 300); };
}

function ModalDetalhe({ pedido, onClose }) {
  if (!pedido) return null;
  const itens = pedido.itens_resumo ? pedido.itens_resumo.split(' | ').map(s => s.trim()).filter(Boolean) : [];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: '#111', border: '1px solid #222' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1a1a1a' }}>
          <div>
            <p className="text-lg font-black text-white">Pedido #{pedido.numero}</p>
            <p className="text-xs text-zinc-500">{new Date(pedido.created_at + 'Z').toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold px-2 py-1 rounded-lg capitalize"
              style={{ background: `${STATUS_COR[pedido.status] || '#666'}22`, color: STATUS_COR[pedido.status] || '#666' }}>
              {pedido.status}
            </span>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-zinc-500" style={{ background: '#1a1a1a' }}>✕</button>
          </div>
        </div>
        <div className="overflow-y-auto p-5 space-y-4">
          {/* Cliente */}
          <div className="rounded-xl p-3 space-y-1" style={{ background: '#1a1a1a' }}>
            <p className="text-[10px] font-black tracking-widest text-zinc-600">CLIENTE</p>
            <p className="font-bold text-white">{pedido.cliente_nome}</p>
            {pedido.cliente_telefone && <p className="text-sm text-zinc-400">{pedido.cliente_telefone}</p>}
            {pedido.cliente_endereco && <p className="text-sm text-zinc-400">{pedido.cliente_endereco}{pedido.bairro ? ` — ${pedido.bairro}` : ''}</p>}
          </div>
          {/* Itens */}
          <div className="rounded-xl p-3" style={{ background: '#1a1a1a' }}>
            <p className="text-[10px] font-black tracking-widest text-zinc-600 mb-2">ITENS</p>
            {itens.length > 0 ? itens.map((it, i) => (
              <p key={i} className="text-sm text-zinc-300 py-1" style={{ borderBottom: i < itens.length-1 ? '1px solid #252525' : 'none' }}>{it}</p>
            )) : <p className="text-sm text-zinc-600">—</p>}
          </div>
          {/* Pagamento + Total */}
          <div className="rounded-xl p-3 flex items-center justify-between" style={{ background: '#1a1a1a' }}>
            <div>
              <p className="text-[10px] font-black tracking-widest text-zinc-600">PAGAMENTO</p>
              <p className="text-sm font-semibold text-zinc-300 mt-0.5">{PAG_LABEL[pedido.forma_pagamento] || pedido.forma_pagamento || '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black tracking-widest text-zinc-600">TOTAL</p>
              <p className="text-xl font-black" style={{ color: 'var(--accent)' }}>{brl(pedido.total)}</p>
              {pedido.frete > 0 && <p className="text-xs text-zinc-600">Frete: {brl(pedido.frete)}</p>}
            </div>
          </div>
          {pedido.observacao && (
            <div className="rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <p className="text-[10px] font-black tracking-widest mb-1" style={{ color: '#f59e0b' }}>OBSERVAÇÃO</p>
              <p className="text-sm" style={{ color: '#fbbf24', whiteSpace: 'pre-wrap' }}>{pedido.observacao}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RelatorioPedidos() {
  const [inicio, setInicio] = useState(primeiroDiaMes());
  const [fim, setFim] = useState(hoje());
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState('');
  const [pedidoDetalhe, setPedidoDetalhe] = useState(null);

  async function buscar() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/pdv/relatorio?inicio=${inicio}&fim=${fim}`, { headers: authH() });
      if (!res.ok) throw new Error('Erro ao carregar relatório');
      setDados(await res.json());
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  }

  const pedidosFiltrados = dados?.pedidos?.filter(p =>
    !busca || p.cliente_nome?.toLowerCase().includes(busca.toLowerCase()) ||
    p.cliente_telefone?.includes(busca) || String(p.numero).includes(busca)
  ) || [];

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
      <Toaster />
      <ModalDetalhe pedido={pedidoDetalhe} onClose={() => setPedidoDetalhe(null)} />

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black" style={{ color: 'var(--cor-texto, #fff)' }}>Relatório de Pedidos</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Histórico e exportação por período</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl p-4 flex flex-wrap gap-3 items-end" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
        {[
          { label: 'Data inicial', val: inicio, set: setInicio },
          { label: 'Data final',   val: fim,    set: setFim    },
        ].map(f => (
          <div key={f.label} className="flex flex-col gap-1">
            <label className="text-xs text-zinc-600 font-medium">{f.label}</label>
            <input type="date" value={f.val} max={hoje()} onChange={e => f.set(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm text-white outline-none"
              style={{ background: '#1a1a1a', border: '1px solid #252525' }} />
          </div>
        ))}
        {/* Atalhos */}
        <div className="flex gap-1.5 flex-wrap">
          {[
            { l: 'Hoje',       fn: () => { setInicio(hoje()); setFim(hoje()); } },
            { l: '7 dias',     fn: () => { const d = new Date(); d.setDate(d.getDate()-6); setInicio(localDate(d)); setFim(hoje()); } },
            { l: 'Este mês',   fn: () => { setInicio(primeiroDiaMes()); setFim(hoje()); } },
            { l: 'Mês anterior', fn: () => {
              const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-1);
              const ini = localDate(d);
              d.setMonth(d.getMonth()+1); d.setDate(0);
              setInicio(ini); setFim(localDate(d));
            }},
          ].map(a => (
            <button key={a.l} onClick={a.fn}
              className="px-2.5 py-2 rounded-xl text-xs font-semibold"
              style={{ background: '#1a1a1a', color: '#888', border: '1px solid #252525' }}>
              {a.l}
            </button>
          ))}
        </div>
        <button onClick={buscar} disabled={loading}
          className="px-5 py-2 rounded-xl text-sm font-black text-white disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
          {loading ? '⏳' : '🔍 Buscar'}
        </button>
      </div>

      {/* Resultados */}
      {dados && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Pedidos',      val: dados.totais.total_pedidos,              cor: '#3b82f6' },
              { label: 'Faturado',     val: brl(dados.totais.total_faturado),        cor: '#10b981' },
              { label: 'Ticket Médio', val: brl(dados.totais.ticket_medio),          cor: 'var(--accent)' },
              { label: 'Cancelados',   val: dados.totais.cancelados,                 cor: '#ef4444' },
            ].map(k => (
              <div key={k.label} className="rounded-2xl p-4" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                <p className="text-2xl font-black" style={{ color: k.cor }}>{k.val}</p>
                <p className="text-xs text-zinc-600 mt-1">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Formas de pagamento */}
          <div className="rounded-2xl p-4" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
            <p className="text-[10px] font-black tracking-widest text-zinc-600 mb-3">FORMAS DE PAGAMENTO</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'PIX',      val: dados.totais.total_pix,      cor: '#10b981', icon: '💠' },
                { label: 'Dinheiro', val: dados.totais.total_dinheiro,  cor: '#f59e0b', icon: '💵' },
                { label: 'Crédito',  val: dados.totais.total_credito,   cor: '#6366f1', icon: '💳' },
                { label: 'Débito',   val: dados.totais.total_debito,    cor: '#8b5cf6', icon: '💳' },
              ].map(k => {
                const pct = dados.totais.total_faturado > 0 ? Math.round(k.val / dados.totais.total_faturado * 100) : 0;
                return (
                  <div key={k.label} className="rounded-xl p-3" style={{ background: '#1a1a1a' }}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-bold text-zinc-500">{k.icon} {k.label}</p>
                      <p className="text-[10px] font-black text-zinc-600">{pct}%</p>
                    </div>
                    <p className="text-base font-black" style={{ color: k.val > 0 ? k.cor : '#333' }}>{brl(k.val)}</p>
                    <div className="mt-1.5 h-1 rounded-full bg-zinc-800">
                      <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: k.cor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Exportar */}
          <div className="flex gap-2 justify-end">
            <button onClick={() => exportarCSV(dados.pedidos, inicio, fim)}
              className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
              📊 Exportar Excel (CSV)
            </button>
            <button onClick={() => exportarPDF(dados.pedidos, dados.totais, inicio, fim)}
              className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              📄 Imprimir / PDF
            </button>
          </div>

          {/* Busca */}
          <input type="text" placeholder="🔍 Filtrar por nome, telefone ou número..."
            value={busca} onChange={e => setBusca(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm text-white outline-none"
            style={{ background: '#111', border: '1px solid #1a1a1a' }}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = '#1a1a1a'} />

          {/* Tabela */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
            <div className="hidden md:grid grid-cols-[40px_1fr_1fr_100px_90px_90px] px-4 py-2"
              style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
              {['#', 'Cliente', 'Itens', 'Pagamento', 'Status', 'Total'].map(h => (
                <p key={h} className="text-[10px] font-black tracking-widest text-zinc-600">{h}</p>
              ))}
            </div>
            {pedidosFiltrados.length === 0 ? (
              <p className="text-center py-10 text-zinc-600 text-sm">Nenhum pedido encontrado</p>
            ) : pedidosFiltrados.map(p => (
              <div key={p.id} onClick={() => setPedidoDetalhe(p)}
                className="grid md:grid-cols-[40px_1fr_1fr_100px_90px_90px] px-4 py-3 items-center gap-2 border-b border-[#111] hover:bg-[#0d0d0d] cursor-pointer"
                style={{ opacity: p.status === 'cancelado' ? 0.5 : 1 }}>
                <p className="text-xs font-black text-zinc-600">#{p.numero}</p>
                <div>
                  <p className="text-sm font-bold text-white">{p.cliente_nome}</p>
                  <p className="text-[10px] text-zinc-600">{p.cliente_telefone || '—'} · {new Date(p.created_at + 'Z').toLocaleDateString('pt-BR')}</p>
                </div>
                <p className="text-xs text-zinc-500 truncate">{p.itens_resumo || '—'}</p>
                <p className="text-xs font-semibold text-zinc-400">{PAG_LABEL[p.forma_pagamento] || p.forma_pagamento || '—'}</p>
                <p className="text-xs font-bold capitalize" style={{ color: STATUS_COR[p.status] || '#666' }}>{p.status}</p>
                <p className="text-sm font-black" style={{ color: p.status === 'cancelado' ? '#666' : 'var(--accent)' }}>{brl(p.total)}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-700 text-center">{pedidosFiltrados.length} de {dados.pedidos.length} pedidos</p>
        </>
      )}
    </div>
  );
}
