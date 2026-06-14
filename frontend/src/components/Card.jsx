import React from 'react';

const COR_MAP = {
  default: { border: 'rgba(42,42,42,1)',   bg: '#161616', accent: '#888' },
  green:   { border: 'rgba(16,185,129,0.3)', bg: 'rgba(16,185,129,0.06)', accent: '#34d399' },
  red:     { border: 'rgba(239,68,68,0.3)',  bg: 'rgba(239,68,68,0.06)',  accent: '#f87171' },
  yellow:  { border: 'rgba(245,158,11,0.3)', bg: 'rgba(245,158,11,0.06)', accent: '#fbbf24' },
  blue:    { border: 'rgba(59,130,246,0.3)', bg: 'rgba(59,130,246,0.06)', accent: '#60a5fa' },
  rose:    { border: 'rgba(var(--accent-rgb),0.4)', bg: 'rgba(var(--accent-rgb),0.08)', accent: 'var(--accent)' },
  orange:  { border: 'rgba(var(--accent-rgb),0.4)', bg: 'rgba(var(--accent-rgb),0.08)', accent: '#fb923c' },
};

const COR_MAP_LIGHT = {
  default: 'bg-white border-slate-200',
  green:   'bg-emerald-50 border-emerald-200',
  red:     'bg-red-50 border-red-200',
  yellow:  'bg-amber-50 border-amber-200',
  blue:    'bg-blue-50 border-blue-200',
  rose:    'bg-orange-50 border-orange-200',
  orange:  'bg-orange-50 border-orange-200',
};

export default function StatCard({ titulo, valor, sub, icon, cor = 'default' }) {
  const dark = document.documentElement.classList.contains('dark');
  const c = COR_MAP[cor] || COR_MAP.default;

  if (dark) {
    return (
      <div className="rounded-xl p-4 relative overflow-hidden transition-all duration-200"
        style={{ background: c.bg, border: `1px solid ${c.border}` }}>
        <div className="absolute top-0 right-0 w-16 h-16 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, ${c.accent}20 0%, transparent 70%)`, transform: 'translate(20%, -20%)' }} />
        {icon && <p className="text-2xl mb-2 relative z-10">{icon}</p>}
        <p className="text-[10px] font-bold uppercase tracking-widest mb-1 relative z-10" style={{ color: c.accent }}>{titulo}</p>
        <p className="font-bold text-white leading-tight text-lg relative z-10 font-mono">{valor}</p>
        {sub && <p className="text-xs mt-0.5 relative z-10" style={{ color: '#555' }}>{sub}</p>}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 shadow-sm relative overflow-hidden ${COR_MAP_LIGHT[cor]}`}>
      {icon && <p className="text-2xl mb-2">{icon}</p>}
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">{titulo}</p>
      <p className="font-bold text-slate-900 leading-tight text-lg font-mono">{valor}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
