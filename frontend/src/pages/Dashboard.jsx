import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { LayoutDashboard, Wallet, Package, TrendingDown, Clock } from 'lucide-react';
import { getToken } from '../hooks/useAuth';
import VisaoGeral from './dashboard/VisaoGeral';
import Financeiro from './dashboard/Financeiro';

const BASE = import.meta.env.VITE_API_URL || '/api';

const ABAS = [
  { id: 'geral', label: 'Visão Geral', icon: LayoutDashboard, componente: VisaoGeral },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet, componente: Financeiro },
];

export default function Dashboard() {
  const [aba, setAba] = useState('geral');
  const [nome, setNome] = useState('');

  useEffect(() => {
    fetch(`${BASE}/cardapio/config`).then(r => r.json())
      .then(c => { if (c?.nome_restaurante) setNome(c.nome_restaurante); }).catch(() => {});
  }, []);

  const AbaAtiva = ABAS.find(a => a.id === aba)?.componente || VisaoGeral;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' } }} />

      <div className="max-w-7xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black" style={{ color: 'var(--txt-strong)' }}>
            Bem-vindo de volta{nome ? `, ${nome}` : ''} 👋
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--txt-dim)' }}>Veja o resumo do seu negócio hoje</p>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{ borderBottom: '1px solid var(--hairline)' }}>
          {ABAS.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              className="px-4 py-2.5 text-sm font-bold flex items-center gap-1.5 shrink-0 transition-colors"
              style={aba === a.id
                ? { color: 'var(--accent)', borderBottom: '2px solid var(--accent)' }
                : { color: 'var(--txt-dim)', borderBottom: '2px solid transparent' }}>
              <a.icon size={15} strokeWidth={1.75} />
              {a.label}
            </button>
          ))}
        </div>

        <AbaAtiva />
      </div>
    </div>
  );
}
