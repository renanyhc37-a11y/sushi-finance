import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { getToken } from '../hooks/useAuth';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });

// Um Story tem 1080×1920. Abaixo disso a foto não serve como imagem
// principal — só em composição menor. O aviso evita a descoberta tardia,
// olhando um post borrado.
const MIN_LARGURA_HERO = 1080;

export default function BancoFotos() {
  const [fotos, setFotos] = useState([]);
  const [itens, setItens] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef(null);

  const carregar = useCallback(async () => {
    try {
      const [rf, ri] = await Promise.all([
        fetch(`${BASE}/fotos`, { headers: authH() }),
        fetch(`${BASE}/cardapio/itens`, { headers: authH() }),
      ]);
      if (rf.ok) setFotos(await rf.json());
      if (ri.ok) setItens(await ri.json());
    } catch { toast.error('Erro ao carregar'); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function enviarArquivos(lista) {
    if (!lista?.length) return;
    setEnviando(true);
    const fd = new FormData();
    [...lista].forEach(f => fd.append('fotos', f));
    try {
      const r = await fetch(`${BASE}/fotos/upload`, { method: 'POST', headers: authH(), body: fd });
      const d = await r.json();
      if (!r.ok) { toast.error(d.erro || 'Erro no upload'); return; }
      const baixas = (d.fotos || []).filter(f => f.largura < MIN_LARGURA_HERO).length;
      if (d.salvas > 0) toast.success(`${d.salvas} foto(s) enviada(s)`);
      if (d.falhas > 0) {
        toast.error(`${d.falhas} arquivo(s) não puderam ser processados.`);
      }
      if (baixas > 0) {
        toast(`${baixas} chegaram com resolução baixa — servem em composição pequena, mas não como foto principal.`, { duration: 7000 });
      }
      carregar();
    } catch { toast.error('Erro no upload'); }
    finally { setEnviando(false); if (inputRef.current) inputRef.current.value = ''; }
  }

  async function atualizar(id, campos) {
    try {
      const r = await fetch(`${BASE}/fotos/${id}`, {
        method: 'PATCH', headers: { ...authH(), 'Content-Type': 'application/json' },
        body: JSON.stringify(campos),
      });
      if (!r.ok) { toast.error('Erro ao salvar'); return; }
      carregar();
    } catch { toast.error('Erro ao salvar'); }
  }

  async function excluir(id) {
    if (!confirm('Excluir esta foto do banco?')) return;
    try {
      await fetch(`${BASE}/fotos/${id}`, { method: 'DELETE', headers: authH() });
      carregar();
    } catch { toast.error('Erro ao excluir'); }
  }

  return (
    <div className="p-4 md:p-6">
      <Toaster position="top-right" />
      <h1 className="text-2xl font-black t-strong mb-1">Banco de Fotos</h1>
      <p className="text-sm t-dim mb-5">
        Suba as fotos em alta. As melhores viram imagem principal do item e alimentam os posts.
      </p>

      <label className="inline-flex items-center gap-2 px-4 py-3 rounded-xl font-black cursor-pointer mb-6"
        style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#2563eb' }}>
        {enviando ? 'Enviando...' : '📷 Adicionar fotos'}
        <input ref={inputRef} type="file" accept="image/*" multiple hidden disabled={enviando}
          onChange={e => enviarArquivos(e.target.files)} />
      </label>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
        {fotos.map(f => {
          const baixa = f.largura < MIN_LARGURA_HERO;
          return (
            <div key={f.id} className="rounded-2xl overflow-hidden"
              style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
              <img src={`${BASE}/fotos/arquivo/${f.arquivo}`} alt="" loading="lazy"
                className="w-full object-cover" style={{ aspectRatio: '1/1' }} />
              <div className="p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold" style={{ color: baixa ? '#b45309' : 'var(--txt-dim)' }}>
                    {f.largura}×{f.altura}{baixa ? ' · baixa' : ''}
                  </span>
                  {f.hero === 1 && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                      style={{ background: 'rgba(22,163,74,0.15)', color: '#15803d' }}>PRINCIPAL</span>
                  )}
                </div>

                <select value={f.item_id || ''} onChange={e => atualizar(f.id, { item_id: e.target.value ? Number(e.target.value) : null })}
                  className="w-full text-[11px] rounded-lg px-2 py-1.5 outline-none"
                  style={{ background: 'var(--space-elev-2)', color: 'var(--txt)', border: '1px solid var(--hairline)' }}>
                  <option value="">— sem item —</option>
                  {itens.map(i => <option key={i.id} value={i.id}>{i.nome}</option>)}
                </select>

                <div className="flex gap-1.5">
                  <button onClick={() => atualizar(f.id, { hero: f.hero ? 0 : 1 })} disabled={!f.item_id}
                    className="flex-1 text-[10px] font-black py-1.5 rounded-lg disabled:opacity-40"
                    style={{ background: 'rgba(245,158,11,0.12)', color: '#b45309' }}>
                    {f.hero ? 'Remover principal' : 'Tornar principal'}
                  </button>
                  <button onClick={() => excluir(f.id)}
                    className="px-2 text-[10px] font-black py-1.5 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>✕</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {fotos.length === 0 && (
        <p className="text-sm t-dim mt-8">Nenhuma foto ainda. Comece adicionando as dos seus carros-chefe.</p>
      )}
    </div>
  );
}
