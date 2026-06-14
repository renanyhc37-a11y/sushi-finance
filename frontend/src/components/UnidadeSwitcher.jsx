import React, { useState } from 'react';
import { useUnidade } from '../hooks/useUnidade';

export default function UnidadeSwitcher() {
  const { unidades, unidadeId, unidadeAtual, setUnidadeId } = useUnidade();
  const [aberto, setAberto] = useState(false);

  if (unidades.length <= 1) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setAberto(v => !v)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all"
        style={{
          background: '#1a0800',
          border: '1px solid rgba(var(--accent-rgb),0.3)',
          color: 'var(--accent)',
        }}
        title="Trocar unidade"
      >
        <span>🏪</span>
        <span className="hidden sm:block max-w-[100px] truncate">
          {unidadeAtual ? unidadeAtual.nome.replace('37 Sushi ', '') : 'Unidade'}
        </span>
        <span style={{ fontSize: 8 }}>▾</span>
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAberto(false)} />
          <div className="absolute right-0 top-10 z-50 w-56 rounded-xl overflow-hidden shadow-2xl"
            style={{ background: '#111', border: '1px solid #2a2a2a' }}>
            <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #1a1a1a' }}>
              <p className="text-[10px] font-bold tracking-widest" style={{ color: '#555' }}>SELECIONAR UNIDADE</p>
            </div>
            {unidades.map(u => (
              <button key={u.id}
                onClick={() => { setUnidadeId(u.id); setAberto(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                style={{ borderBottom: '1px solid #141414' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: u.id === unidadeId ? 'var(--accent)' : '#333' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: u.id === unidadeId ? 'var(--accent)' : '#ccc' }}>
                    {u.nome}
                  </p>
                  {u.cidade && <p className="text-xs" style={{ color: '#555' }}>{u.cidade}</p>}
                </div>
                {u.id === unidadeId && <span className="text-xs font-black shrink-0" style={{ color: 'var(--accent)' }}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
