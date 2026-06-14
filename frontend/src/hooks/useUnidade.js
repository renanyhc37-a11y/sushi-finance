import { useState, useEffect } from 'react';

const KEY = 'unidade_selecionada';

export function getUnidadeId() {
  try { return Number(localStorage.getItem(KEY) || 1); } catch { return 1; }
}

export function useUnidade() {
  const [unidades, setUnidades] = useState([]);
  const [unidadeId, setUnidadeIdState] = useState(getUnidadeId);

  useEffect(() => {
    const BASE = import.meta.env.VITE_API_URL || '/api';
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch(`${BASE}/unidades`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setUnidades(d); })
      .catch(() => {});
  }, []);

  function setUnidadeId(id) {
    localStorage.setItem(KEY, String(id));
    setUnidadeIdState(Number(id));
    window.dispatchEvent(new CustomEvent('unidade:changed', { detail: { id: Number(id) } }));
  }

  const unidadeAtual = unidades.find(u => u.id === unidadeId) || null;

  return { unidades, unidadeId, unidadeAtual, setUnidadeId };
}
