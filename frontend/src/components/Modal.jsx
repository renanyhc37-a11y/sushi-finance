import React, { useEffect } from 'react';

export default function Modal({ titulo, onClose, children, size = 'md' }) {
  const dark = document.documentElement.classList.contains('dark');

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-3xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} max-h-[90vh] flex flex-col`}
        style={{
          background: dark ? '#141414' : '#ffffff',
          border: dark ? '1px solid #2a2a2a' : '1px solid #e5e5e5',
          borderRadius: '16px',
          boxShadow: dark ? '0 25px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(var(--accent-rgb),0.1)' : '0 25px 60px rgba(0,0,0,0.15)',
        }}>
        {/* Header com linha laranja */}
        <div className="shrink-0">
          <div className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: dark ? '1px solid #222' : '1px solid #f0f0f0' }}>
            <div className="flex items-center gap-3">
              <div className="w-1 h-5 rounded-full" style={{ background: 'linear-gradient(180deg, var(--accent), var(--accent-2))' }} />
              <h2 className="font-bold text-base" style={{ color: dark ? '#f5f5f5' : '#111' }}>{titulo}</h2>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-lg leading-none"
              style={{ color: '#555', background: dark ? '#1e1e1e' : '#f5f5f5' }}>
              ✕
            </button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
