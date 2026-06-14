import React, { useState, useRef } from 'react';
import { getToken } from '../hooks/useAuth';
import toast, { Toaster } from 'react-hot-toast';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ImportarCardapio() {
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [modo, setModo] = useState('adicionar'); // adicionar | atualizar | substituir
  const [somentAtivos, setSomentAtivos] = useState(true);
  const [catAberta, setCatAberta] = useState(null);
  const inputRef = useRef();

  async function carregarPreview(file) {
    setPreview(null);
    setResultado(null);
    setLoading(true);
    const fd = new FormData();
    fd.append('arquivo', file);
    try {
      const r = await fetch(`${BASE}/importar/xlsx/preview`, {
        method: 'POST', headers: authH(), body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro');
      setPreview(d);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setArquivo(file);
    carregarPreview(file);
  }

  function onDrop(e) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setArquivo(file);
    carregarPreview(file);
  }

  async function confirmar() {
    if (!arquivo) return;
    setConfirmando(true);
    const fd = new FormData();
    fd.append('arquivo', arquivo);
    fd.append('modo', modo);
    fd.append('somente_ativos', String(somentAtivos));
    try {
      const r = await fetch(`${BASE}/importar/xlsx/confirmar`, {
        method: 'POST', headers: authH(), body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro');
      setResultado(d);
      setPreview(null);
      toast.success(`✅ ${d.itens_criados} itens importados!`);
    } catch (e) { toast.error(e.message); }
    finally { setConfirmando(false); }
  }

  const itensFiltrados = preview
    ? (somentAtivos
        ? preview.resumo.map(c => ({ ...c, itens: c.itens.filter(i => i.disponivel), qtd: c.itens.filter(i => i.disponivel).length })).filter(c => c.qtd > 0)
        : preview.resumo)
    : [];
  const totalImportar = itensFiltrados.reduce((s, c) => s + c.qtd, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6" style={{ color: '#e5e5e5' }}>
      <Toaster position="top-center" />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-white">📥 Importar Cardápio</h1>
        <p className="text-sm text-zinc-600 mt-1">Importe produtos de outro sistema via arquivo Excel (.xlsx)</p>
      </div>

      {/* Resultado final */}
      {resultado && (
        <div className="rounded-2xl p-6 text-center space-y-4" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-black text-white">Importação concluída!</h2>
          <div className="flex justify-center gap-6 flex-wrap">
            {[
              { label: 'Categorias criadas', val: resultado.categorias_criadas, cor: '#a78bfa' },
              { label: 'Itens criados', val: resultado.itens_criados, cor: '#10b981' },
              { label: 'Itens atualizados', val: resultado.itens_atualizados, cor: '#3b82f6' },
              { label: 'Ignorados', val: resultado.itens_ignorados, cor: '#555' },
            ].map(({ label, val, cor }) => (
              <div key={label} className="text-center">
                <p className="text-3xl font-black" style={{ color: cor }}>{val}</p>
                <p className="text-xs text-zinc-600 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <a href="/cardapio-admin"
              className="px-5 py-2.5 rounded-xl text-sm font-black text-white"
              style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))' }}>
              Ver cardápio →
            </a>
            <button onClick={() => { setResultado(null); setArquivo(null); setPreview(null); if(inputRef.current) inputRef.current.value=''; }}
              className="px-5 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: '#1a1a1a', color: '#888' }}>
              Importar outro arquivo
            </button>
          </div>
        </div>
      )}

      {!resultado && (<>

        {/* Drop zone */}
        <div
          onDrop={onDrop} onDragOver={e => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center py-12 cursor-pointer transition-all"
          style={{ borderColor: arquivo ? 'rgba(var(--accent-rgb),0.5)' : '#252525', background: arquivo ? 'rgba(var(--accent-rgb),0.04)' : '#0f0f0f' }}>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onFile} />
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
              <p className="text-zinc-600 text-sm">Lendo arquivo...</p>
            </div>
          ) : arquivo ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">📊</span>
              <p className="font-bold text-white">{arquivo.name}</p>
              <p className="text-xs text-zinc-600">{(arquivo.size / 1024).toFixed(0)} KB · clique para trocar</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <span className="text-5xl">📂</span>
              <p className="font-bold text-white">Arraste o arquivo .xlsx aqui</p>
              <p className="text-sm text-zinc-600">ou clique para selecionar</p>
              <p className="text-xs text-zinc-700 mt-2">Compatível com: iFood, Anotaí, GrandChef, e qualquer exportação com colunas Nome, Categoria e Preço</p>
            </div>
          )}
        </div>

        {/* Preview */}
        {preview && (
          <div className="space-y-4">

            {/* Resumo */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total no arquivo', val: preview.total, cor: '#e5e5e5', icon: '📋' },
                { label: 'Categorias', val: preview.categorias, cor: '#a78bfa', icon: '🗂' },
                { label: 'Para importar', val: totalImportar, cor: '#10b981', icon: '✅' },
              ].map(({ label, val, cor, icon }) => (
                <div key={label} className="rounded-2xl p-4 text-center" style={{ background: '#0f0f0f', border: '1px solid #161616' }}>
                  <p className="text-2xl mb-1">{icon}</p>
                  <p className="text-2xl font-black" style={{ color: cor }}>{val}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Opções de importação */}
            <div className="rounded-2xl p-5 space-y-4" style={{ background: '#0f0f0f', border: '1px solid #161616' }}>
              <h3 className="font-black text-white text-sm">⚙️ Opções de importação</h3>

              {/* Modo */}
              <div className="space-y-2">
                <p className="text-xs text-zinc-600 font-bold uppercase tracking-wider">Modo</p>
                <div className="flex flex-col gap-2">
                  {[
                    { key: 'adicionar', label: 'Adicionar novos', desc: 'Só cria itens que ainda não existem. Não mexe no que já tem.', cor: '#10b981' },
                    { key: 'atualizar', label: 'Adicionar + Atualizar existentes', desc: 'Cria novos e atualiza preço/descrição dos que já existem.', cor: '#3b82f6' },
                    { key: 'substituir', label: 'Substituir tudo', desc: '⚠️ Apaga todo o cardápio atual e importa do zero.', cor: '#ef4444' },
                  ].map(({ key, label, desc, cor }) => (
                    <button key={key} onClick={() => setModo(key)}
                      className="flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                      style={{
                        background: modo === key ? `${cor}10` : '#111',
                        border: `1px solid ${modo === key ? `${cor}40` : '#1a1a1a'}`,
                      }}>
                      <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5"
                        style={{ borderColor: modo === key ? cor : '#333', background: modo === key ? cor : 'transparent' }}>
                        {modo === key && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold" style={{ color: modo === key ? cor : '#aaa' }}>{label}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#555' }}>{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Filtro status */}
              <div>
                <p className="text-xs text-zinc-600 font-bold uppercase tracking-wider mb-2">Filtro</p>
                <button onClick={() => setSomentAtivos(v => !v)}
                  className="flex items-center gap-3 p-3 rounded-xl transition-all"
                  style={{ background: somentAtivos ? 'rgba(16,185,129,0.08)' : '#111', border: `1px solid ${somentAtivos ? 'rgba(16,185,129,0.25)' : '#1a1a1a'}` }}>
                  <div className="w-10 h-6 rounded-full relative shrink-0" style={{ background: somentAtivos ? '#10b981' : '#333' }}>
                    <div className="w-4 h-4 bg-white rounded-full absolute top-1 transition-all" style={{ left: somentAtivos ? '22px' : '4px' }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Somente itens ativos</p>
                    <p className="text-xs" style={{ color: '#555' }}>
                      {somentAtivos
                        ? `Importar ${totalImportar} de ${preview.total} (ignora Inativos e Em falta)`
                        : `Importar todos os ${preview.total} itens`}
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Lista por categoria */}
            <div className="rounded-2xl overflow-hidden" style={{ background: '#0f0f0f', border: '1px solid #161616' }}>
              <div className="px-5 py-4" style={{ borderBottom: '1px solid #141414' }}>
                <h3 className="font-black text-white text-sm">📋 Itens a importar</h3>
                <p className="text-xs text-zinc-600 mt-0.5">{itensFiltrados.length} categorias · {totalImportar} itens</p>
              </div>
              <div className="divide-y" style={{ borderColor: '#141414' }}>
                {itensFiltrados.map(cat => (
                  <div key={cat.categoria}>
                    <button
                      onClick={() => setCatAberta(catAberta === cat.categoria ? null : cat.categoria)}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.02] transition-colors">
                      <span className="font-bold text-white text-sm flex-1 truncate">{cat.categoria}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
                        style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)' }}>{cat.qtd} itens</span>
                      <span className="text-zinc-600 text-xs shrink-0">{catAberta === cat.categoria ? '▲' : '▼'}</span>
                    </button>
                    {catAberta === cat.categoria && (
                      <div className="px-5 pb-3 space-y-1.5">
                        {cat.itens.map((item, i) => (
                          <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl"
                            style={{ background: '#111' }}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-white truncate">{item.nome}</p>
                              {item.descricao && <p className="text-xs text-zinc-600 truncate">{item.descricao.slice(0, 80)}{item.descricao.length > 80 ? '...' : ''}</p>}
                            </div>
                            <div className="flex items-center gap-3 shrink-0 ml-3">
                              <p className="font-black text-orange-400">{brl(item.preco)}</p>
                              <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                                style={{ background: item.disponivel ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', color: item.disponivel ? '#10b981' : '#ef4444' }}>
                                {item.disponivel ? 'Ativo' : item.status}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Botão confirmar */}
            {modo === 'substituir' && (
              <div className="px-4 py-3 rounded-xl flex items-center gap-3"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                <span className="text-xl shrink-0">⚠️</span>
                <p className="text-sm" style={{ color: '#ef4444' }}>
                  O modo <strong>Substituir tudo</strong> vai apagar todo o cardápio atual antes de importar. Essa ação não pode ser desfeita.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setArquivo(null); setPreview(null); if(inputRef.current) inputRef.current.value=''; }}
                className="px-5 py-3 rounded-xl text-sm font-bold"
                style={{ background: '#111', color: '#555', border: '1px solid #1a1a1a' }}>
                Cancelar
              </button>
              <button onClick={confirmar} disabled={confirmando || totalImportar === 0}
                className="flex-1 py-3 rounded-xl text-sm font-black text-white disabled:opacity-40 transition-all"
                style={{ background: confirmando ? '#333' : 'linear-gradient(135deg,var(--accent),var(--accent-2))', boxShadow: '0 4px 20px rgba(var(--accent-rgb),0.3)' }}>
                {confirmando
                  ? '⏳ Importando...'
                  : `✅ Importar ${totalImportar} itens em ${itensFiltrados.length} categorias`}
              </button>
            </div>
          </div>
        )}

      </>)}
    </div>
  );
}
