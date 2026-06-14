import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../api/client';

const CORES = {
  amarelo: { bg: '#2a2500', borda: '#5a4d00', texto: '#fde68a', badge: 'var(--accent-2)' },
  laranja: { bg: '#2a1500', borda: '#5a2d00', texto: '#fed7aa', badge: 'var(--accent)' },
  verde:   { bg: '#002a14', borda: '#005a28', texto: '#bbf7d0', badge: '#22c55e' },
  azul:    { bg: '#001a2a', borda: '#003a5a', texto: '#bae6fd', badge: '#3b82f6' },
  roxo:    { bg: '#1a002a', borda: '#3a005a', texto: '#e9d5ff', badge: '#a855f7' },
  vermelho:{ bg: '#2a0000', borda: '#5a0000', texto: '#fecaca', badge: '#ef4444' },
};

function fmtData(dt) {
  const d = new Date(dt);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function NotasRapidas() {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [corSel, setCorSel] = useState('amarelo');
  const textareaRef = useRef(null);
  const qc = useQueryClient();

  const { data: notas = [] } = useQuery({
    queryKey: ['notas'],
    queryFn: () => api.get('/notas'),
    refetchInterval: aberto ? 30000 : false,
  });

  const total = notas.length;
  const fixadas = notas.filter(n => n.fixada).length;

  useEffect(() => {
    if (aberto) setTimeout(() => textareaRef.current?.focus(), 300);
  }, [aberto]);

  // Fechar com Escape / abrir pelo botão do topbar
  useEffect(() => {
    const fnKey = (e) => { if (e.key === 'Escape') setAberto(false); };
    const fnToggle = () => setAberto(v => !v);
    window.addEventListener('keydown', fnKey);
    window.addEventListener('notas:toggle', fnToggle);
    return () => {
      window.removeEventListener('keydown', fnKey);
      window.removeEventListener('notas:toggle', fnToggle);
    };
  }, []);

  const adicionar = useMutation({
    mutationFn: () => api.post('/notas', { texto, cor: corSel }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas'] });
      setTexto('');
    },
    onError: (e) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: (id) => api.del(`/notas/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notas'] }),
    onError: (e) => toast.error(e.message),
  });

  const fixar = useMutation({
    mutationFn: ({ id, fixada }) => api.patch(`/notas/${id}/fixar`, { fixada }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notas'] }),
  });

  const mudarCor = useMutation({
    mutationFn: ({ id, cor }) => api.patch(`/notas/${id}/cor`, { cor }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notas'] }),
  });

  function handleAdd(e) {
    e.preventDefault();
    if (!texto.trim()) return;
    adicionar.mutate();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleAdd(e);
  }

  return (
    <>
      {/* Overlay ao abrir */}
      {aberto && (
        <div
          className="fixed inset-0 z-40"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setAberto(false)}
        />
      )}

      {/* Painel — abre abaixo do topbar, alinhado à direita */}
      <div
        className="fixed top-14 right-4 z-50 flex flex-col rounded-2xl overflow-hidden"
        style={{
          width: 320,
          maxHeight: 'calc(100vh - 80px)',
          background: '#0d0d0d',
          border: '1px solid #1e1e1e',
          transform: aberto ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.97)',
          opacity: aberto ? 1 : 0,
          pointerEvents: aberto ? 'auto' : 'none',
          transition: 'transform 0.2s ease, opacity 0.2s ease',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header do painel */}
        <div className="flex items-center justify-between px-4 py-4 shrink-0"
          style={{ borderBottom: '1px solid #1e1e1e' }}>
          <div className="flex items-center gap-2">
            <span className="text-lg">📝</span>
            <div>
              <p className="font-bold text-sm text-white">Anotações</p>
              <p className="text-[10px]" style={{ color: '#444' }}>
                {total} nota{total !== 1 ? 's' : ''}
                {fixadas > 0 ? ` · ${fixadas} fixada${fixadas !== 1 ? 's' : ''}` : ''}
              </p>
            </div>
          </div>
          <button onClick={() => setAberto(false)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-xs transition-all"
            style={{ color: '#555', background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
            ✕
          </button>
        </div>

        {/* Formulário */}
        <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid #1e1e1e' }}>
          <form onSubmit={handleAdd} className="space-y-2">
            <textarea
              ref={textareaRef}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nova anotação... (Ctrl+Enter para salvar)"
              rows={3}
              className="w-full text-sm px-3 py-2 rounded-xl resize-none outline-none transition-all"
              style={{
                background: '#1a1a1a',
                border: '1px solid #2a2a2a',
                color: '#e5e5e5',
                caretColor: 'var(--accent)',
                lineHeight: 1.5,
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = '#2a2a2a'}
            />

            {/* Seletor de cor */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold" style={{ color: '#444' }}>COR:</span>
              <div className="flex gap-1 flex-1">
                {Object.entries(CORES).map(([nome, c]) => (
                  <button
                    key={nome}
                    type="button"
                    onClick={() => setCorSel(nome)}
                    title={nome}
                    className="w-5 h-5 rounded-full transition-all"
                    style={{
                      background: c.badge,
                      transform: corSel === nome ? 'scale(1.3)' : 'scale(1)',
                      boxShadow: corSel === nome ? `0 0 6px ${c.badge}` : 'none',
                      border: corSel === nome ? `2px solid #fff` : 'none',
                    }}
                  />
                ))}
              </div>
              <button
                type="submit"
                disabled={!texto.trim() || adicionar.isPending}
                className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all shrink-0"
                style={{
                  background: texto.trim() ? 'linear-gradient(135deg,var(--accent),var(--accent-2))' : '#1a1a1a',
                  color: texto.trim() ? '#000' : '#444',
                  cursor: texto.trim() ? 'pointer' : 'not-allowed',
                }}>
                {adicionar.isPending ? '...' : '+ Salvar'}
              </button>
            </div>
          </form>
        </div>

        {/* Lista de notas */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {notas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <span className="text-3xl opacity-20">📝</span>
              <p className="text-xs text-center" style={{ color: '#333' }}>
                Nenhuma anotação ainda.<br />Escreva algo acima!
              </p>
            </div>
          ) : (
            notas.map(nota => {
              const c = CORES[nota.cor] || CORES.amarelo;
              return (
                <div key={nota.id}
                  className="rounded-xl p-3 group relative transition-all"
                  style={{
                    background: c.bg,
                    border: `1px solid ${nota.fixada ? c.badge : c.borda}`,
                    boxShadow: nota.fixada ? `0 0 8px ${c.badge}22` : 'none',
                  }}>

                  {/* Indicador fixada */}
                  {nota.fixada && (
                    <div className="absolute -top-1.5 left-3 text-xs"
                      style={{ color: c.badge }}>📌</div>
                  )}

                  {/* Texto */}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words pr-1"
                    style={{ color: c.texto }}>
                    {nota.texto}
                  </p>

                  {/* Footer da nota */}
                  <div className="flex items-center justify-between mt-2 pt-2"
                    style={{ borderTop: `1px solid ${c.borda}` }}>
                    <span className="text-[10px]" style={{ color: `${c.badge}88` }}>
                      {fmtData(nota.created_at)}
                    </span>

                    {/* Ações — aparecem no hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Seletor de cor rápido */}
                      <div className="flex gap-0.5">
                        {Object.entries(CORES).map(([nome, cc]) => (
                          <button key={nome}
                            onClick={() => mudarCor.mutate({ id: nota.id, cor: nome })}
                            className="w-3.5 h-3.5 rounded-full transition-transform hover:scale-125"
                            style={{ background: cc.badge }}
                            title={nome}
                          />
                        ))}
                      </div>

                      {/* Fixar */}
                      <button
                        onClick={() => fixar.mutate({ id: nota.id, fixada: !nota.fixada })}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-xs transition-all"
                        style={{
                          background: nota.fixada ? `${c.badge}22` : '#1a1a1a',
                          color: nota.fixada ? c.badge : '#555',
                        }}
                        title={nota.fixada ? 'Desafixar' : 'Fixar no topo'}>
                        📌
                      </button>

                      {/* Excluir */}
                      <button
                        onClick={() => excluir.mutate(nota.id)}
                        className="w-6 h-6 flex items-center justify-center rounded-lg text-xs transition-all"
                        style={{ color: '#555' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={e => e.currentTarget.style.color = '#555'}
                        title="Excluir">
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 shrink-0 text-center"
          style={{ borderTop: '1px solid #1e1e1e' }}>
          <p className="text-[10px]" style={{ color: '#2a2a2a' }}>
            Ctrl+Enter para salvar · Esc para fechar
          </p>
        </div>
      </div>

    </>
  );
}
