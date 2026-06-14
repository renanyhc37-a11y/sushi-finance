import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

const STYLE = {
  vermelho: { bar: 'bg-red-50 border-red-200 text-red-800', dot: '🔴' },
  amarelo:  { bar: 'bg-amber-50 border-amber-200 text-amber-800', dot: '🟡' },
  laranja:  { bar: 'bg-orange-50 border-orange-200 text-orange-800', dot: '🟠' },
};

export default function AlertBanner() {
  const [dismissed, setDismissed] = useState(new Set());

  const { data: alertas = [] } = useQuery({
    queryKey: ['alertas'],
    queryFn: () => api.get('/alertas'),
    refetchInterval: 60_000,
  });

  const visiveis = alertas.filter((_, i) => !dismissed.has(i));
  if (!visiveis.length) return null;

  return (
    <div className="space-y-2 mb-6">
      {alertas.map((a, i) => {
        if (dismissed.has(i)) return null;
        const s = STYLE[a.nivel] || STYLE.laranja;
        return (
          <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-sm font-medium ${s.bar}`}>
            <span>{s.dot}</span>
            <span className="flex-1">{a.mensagem}</span>
            <button
              onClick={() => setDismissed(p => new Set([...p, i]))}
              className="text-xs opacity-60 hover:opacity-100 ml-2 shrink-0"
            >✕</button>
          </div>
        );
      })}
    </div>
  );
}
