import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const brlK = v => Math.abs(v || 0) >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : brl(v);

export const CORES = { azul: '#60a5fa', verde: '#34d399', roxo: '#a78bfa', vermelho: '#ef4444', cinza: '#5b6678' };

export function Card({ children, className = '', style = {} }) {
  return (
    <div className={`rounded-2xl overflow-hidden relative ${className}`}
      style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)', ...style }}>
      {children}
    </div>
  );
}

export function CardHeader({ title, icon: Icon, cor = 'var(--accent)', action }) {
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

export function KpiCard({ label, value, sub, cor = 'var(--accent)', icon: Icon, trend }) {
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

export function ChartTooltip({ active, payload, label, series }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-2xl"
      style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline-strong)' }}>
      <p className="font-bold mb-1" style={{ color: 'var(--txt-strong)' }}>{label}</p>
      {(series || []).map(s => {
        const p = payload.find(x => x.dataKey === s.key);
        if (!p) return null;
        return <p key={s.key} style={{ color: s.cor }}>{s.label}: <b>{s.fmt ? s.fmt(p.value) : p.value}</b></p>;
      })}
    </div>
  );
}
