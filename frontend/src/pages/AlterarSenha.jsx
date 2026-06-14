import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api/client';

export default function AlterarSenha() {
  const [form, setForm] = useState({ senha_atual: '', nova_senha: '', confirma: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function set(k) {
    return e => setForm(f => ({ ...f, [k]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.nova_senha !== form.confirma) {
      toast.error('As senhas não coincidem');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        senha_atual: form.senha_atual,
        nova_senha: form.nova_senha,
      });
      toast.success('Senha alterada com sucesso!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: '#0a0a0a',
    border: '1px solid #2a2a2a',
    color: '#e5e5e5',
    caretColor: 'var(--accent)',
  };

  return (
    <div className="max-w-sm mx-auto pt-8">
      <h1 className="text-lg font-bold text-white mb-6">Alterar Senha</h1>

      <form onSubmit={handleSubmit} className="space-y-4"
        style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 16, padding: 24 }}>

        {[
          { label: 'Senha Atual', key: 'senha_atual' },
          { label: 'Nova Senha', key: 'nova_senha' },
          { label: 'Confirmar Nova Senha', key: 'confirma' },
        ].map(({ label, key }) => (
          <div key={key} className="space-y-1">
            <label className="text-xs font-semibold tracking-wider" style={{ color: '#555' }}>
              {label.toUpperCase()}
            </label>
            <input
              type="password"
              value={form[key]}
              onChange={set(key)}
              required
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = '#2a2a2a'}
            />
          </div>
        ))}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: '#1a1a1a', color: '#888', border: '1px solid #2a2a2a' }}>
            Cancelar
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{
              background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
              color: '#000',
              opacity: loading ? 0.6 : 1,
            }}>
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
