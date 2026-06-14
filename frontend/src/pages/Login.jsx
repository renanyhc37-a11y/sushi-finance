import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';
import Logo from '../components/Logo';

const BASE = import.meta.env.VITE_API_URL || '/api';

export default function Login({ onLogin }) {
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [mostrar, setMostrar] = useState(false);
  const [logoDelivery, setLogoDelivery] = useState(null);

  // Busca a logo do delivery (pública). Se existir, usamos no lugar do ícone.
  useEffect(() => {
    fetch(`${BASE}/ia/logo`).then(r => r.json()).then(d => { if (d?.url) setLogoDelivery(d.url); }).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!senha) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Erro ao entrar');
      onLogin(data.token);
      toast.success('Bem-vindo!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'radial-gradient(130% 110% at 50% -10%, #0d1320 0%, #06080f 70%)' }}>

      {/* Fundo espacial — estrelas + brilhos */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-[-50px]" style={{
          backgroundImage:
            'radial-gradient(1.5px 1.5px at 20% 30%, rgba(255,255,255,0.7), transparent), radial-gradient(1px 1px at 70% 20%, rgba(255,255,255,0.5), transparent), radial-gradient(1px 1px at 45% 65%, rgba(255,255,255,0.6), transparent), radial-gradient(1px 1px at 85% 55%, rgba(255,255,255,0.4), transparent), radial-gradient(1.5px 1.5px at 33% 85%, rgba(255,255,255,0.5), transparent)',
          backgroundSize: '300px 300px',
        }} />
        <div className="absolute top-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(var(--accent-rgb),0.35) 0%, transparent 65%)', filter: 'blur(70px)' }} />
        <div className="absolute bottom-[-15%] left-[-8%] w-[40vw] h-[40vw] rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.35) 0%, transparent 65%)', filter: 'blur(70px)' }} />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="rounded-2xl p-8 space-y-8"
          style={{ background: 'rgba(13,17,26,0.78)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid var(--hairline-strong, rgba(148,163,184,0.16))', boxShadow: '0 25px 70px rgba(0,0,0,0.7)' }}>

          {/* Logo + título */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full"
                style={{ background: 'radial-gradient(circle, rgba(var(--accent-rgb),0.4) 0%, transparent 70%)', transform: 'scale(2)', filter: 'blur(8px)' }} />
              {logoDelivery ? (
                <img src={logoDelivery} alt="Logo" className="relative w-14 h-14 rounded-full object-cover"
                  style={{ border: '1px solid rgba(var(--accent-rgb),0.4)' }} />
              ) : (
                <Logo size={60} />
              )}
            </div>
            <div className="text-center">
              <div className="flex items-baseline justify-center">
                <span className="font-black text-2xl text-white">Sushi</span>
                <span className="font-black text-2xl"
                  style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Contrlol
                </span>
              </div>
              <p className="text-[11px] tracking-[0.25em] mt-1.5 font-medium" style={{ color: '#5b6678' }}>
                LUZ NAS SOMBRAS
              </p>
            </div>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold tracking-widest" style={{ color: '#5b6678' }}>
                SENHA DE ACESSO
              </label>
              <div className="relative">
                <input
                  type={mostrar ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="Digite sua senha"
                  autoFocus
                  className="w-full px-4 py-3 pr-11 rounded-xl text-sm font-medium outline-none transition-all"
                  style={{ background: 'rgba(5,8,14,0.6)', border: '1px solid #2a3344', color: '#e8edf6', caretColor: 'var(--accent)' }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = '#2a3344'}
                />
                <button type="button" onClick={() => setMostrar(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center"
                  style={{ color: '#5b6678' }} tabIndex={-1}>
                  {mostrar ? <EyeOff size={17} strokeWidth={1.75} /> : <Eye size={17} strokeWidth={1.75} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading || !senha}
              className="w-full py-3 rounded-xl text-sm font-bold tracking-wide transition-all duration-200"
              style={{
                background: loading || !senha ? '#161d2e' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                color: loading || !senha ? '#3a4252' : '#000',
                cursor: loading || !senha ? 'not-allowed' : 'pointer',
              }}>
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="text-center text-xs" style={{ color: '#3a4252' }}>
            Senha padrão: <span style={{ color: '#5b6678', fontFamily: 'monospace' }}>sushi123</span>
          </p>
        </div>
      </div>
    </div>
  );
}
