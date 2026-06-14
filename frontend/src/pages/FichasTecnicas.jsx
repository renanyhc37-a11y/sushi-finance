import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import CmvBadge from '../components/CmvBadge';
import { PageLoading } from '../components/Loading';
import { brl } from '../lib/fmt';

const SUGESTOES = [
  { nome: 'Hot Philadelphia 10un',  categoria: 'Hot Roll',   preco_venda: 32.90 },
  { nome: 'Hot Skin 10un',          categoria: 'Hot Roll',   preco_venda: 29.90 },
  { nome: 'Hot Camarão 10un',       categoria: 'Hot Roll',   preco_venda: 34.90 },
  { nome: 'Niguiri Salmão 2un',     categoria: 'Niguiri',    preco_venda: 12.90 },
  { nome: 'Niguiri Atum 2un',       categoria: 'Niguiri',    preco_venda: 14.90 },
  { nome: 'Temaki Salmão',          categoria: 'Temaki',     preco_venda: 22.90 },
  { nome: 'Temaki Philadelphia',    categoria: 'Temaki',     preco_venda: 24.90 },
  { nome: 'Uramaki Salmão 8un',     categoria: 'Uramaki',    preco_venda: 26.90 },
  { nome: 'Sashimi Salmão 10un',    categoria: 'Sashimi',    preco_venda: 39.90 },
  { nome: 'Sashimi Atum 10un',      categoria: 'Sashimi',    preco_venda: 44.90 },
  { nome: 'Combinado 20un',         categoria: 'Combinado',  preco_venda: 59.90 },
  { nome: 'Combinado 30un',         categoria: 'Combinado',  preco_venda: 84.90 },
  { nome: 'Missoshiru',             categoria: 'Sopas',      preco_venda: 9.90  },
  { nome: 'Gyoza 6un',              categoria: 'Entradas',   preco_venda: 19.90 },
  { nome: 'Edamame',                categoria: 'Entradas',   preco_venda: 14.90 },
];

const FORM_VAZIO = { nome: '', categoria_id: '', preco_venda: '', ficha_tecnica: [] };

// ── Estilos dark reutilizáveis ────────────────────────────────
const D = {
  overlay:  { background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' },
  modal:    { background: '#0f0f0f', border: '1px solid #1e1e1e' },
  header:   { borderBottom: '1px solid #1a1a1a', background: '#0f0f0f' },
  input:    { background: '#141414', border: '1px solid #252525', color: '#e5e5e5' },
  inputFocus:'var(--accent)',
  section:  { background: '#111', border: '1px solid #1a1a1a' },
  row:      { background: '#141414', border: '1px solid #1e1e1e' },
  label:    { color: '#555' },
  sub:      { color: '#3a3a3a' },
  btn:      { background: '#1a1a1a', border: '1px solid #252525', color: '#888' },
  btnHover: { background: '#222' },
};

// ── Seletor de ingrediente com busca (dark) ───────────────────
function IngredienteSelect({ ingredientes, value, onChange }) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);
  const selecionado = ingredientes.find(i => i.id === Number(value));
  const filtrados = useMemo(() =>
    ingredientes.filter(i => !busca || i.nome.toLowerCase().includes(busca.toLowerCase())).slice(0, 20),
    [ingredientes, busca]
  );
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setAberto(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => { setAberto(a => !a); setBusca(''); }}
        className="w-full text-left px-3 py-2 rounded-lg text-sm truncate transition-all"
        style={{ ...D.input, color: selecionado ? '#e5e5e5' : '#555' }}>
        {selecionado ? `${selecionado.nome} (${selecionado.unidade_medida})` : 'Selecionar ingrediente…'}
      </button>
      {aberto && (
        <div className="absolute z-50 left-0 right-0 mt-1 rounded-xl shadow-2xl overflow-hidden"
          style={{ background: '#111', border: '1px solid #252525' }}>
          <div className="p-2" style={{ borderBottom: '1px solid #1e1e1e' }}>
            <input autoFocus value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar ingrediente…"
              className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
              style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#e5e5e5' }} />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtrados.length === 0
              ? <p className="text-center text-xs py-4" style={{ color: '#555' }}>Nenhum ingrediente encontrado</p>
              : filtrados.map(i => (
                <button key={i.id} type="button"
                  onClick={() => { onChange(i.id); setAberto(false); setBusca(''); }}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors"
                  style={{ background: Number(value) === i.id ? '#1e1005' : 'transparent',
                    borderBottom: '1px solid #141414', color: '#ccc' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                  onMouseLeave={e => e.currentTarget.style.background = Number(value) === i.id ? '#1e1005' : 'transparent'}>
                  <span className="font-medium">{i.nome}</span>
                  <span style={{ color: '#555', fontSize: 11 }}>{i.unidade_medida} · {brl(i.custo_unitario)}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Card do produto (dark) ────────────────────────────────────
function ProdutoCard({ produto, onEditar, onExcluir }) {
  const [expandido, setExpandido] = useState(false);
  const cmv = produto.cmv || 0;
  const margem = produto.preco_venda - produto.custo_total;
  const corCmv = cmv <= 30 ? '#10b981' : cmv <= 40 ? 'var(--accent-2)' : '#ef4444';

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ background: '#111', border: '1px solid #1a1a1a',
        boxShadow: expandido ? '0 0 0 1px #2a2a2a, 0 8px 32px rgba(0,0,0,0.4)' : undefined }}>
      {/* Barra CMV */}
      <div style={{ height: 3, background: '#1a1a1a' }}>
        <div style={{ height: 3, width: `${Math.min(cmv, 100)}%`, background: corCmv, transition: 'width .4s' }} />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-sm leading-tight truncate" style={{ color: '#e5e5e5' }}>{produto.nome}</h3>
              {produto.categoria && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>{produto.categoria}</span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2.5 flex-wrap">
              {[
                { label: 'Venda',  val: brl(produto.preco_venda), color: '#e5e5e5' },
                { label: 'Custo',  val: brl(produto.custo_total), color: '#888' },
                { label: 'Margem', val: brl(margem), color: margem >= 0 ? '#10b981' : '#ef4444' },
              ].map(item => (
                <div key={item.label}>
                  <p style={{ color: '#444', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>{item.label}</p>
                  <p className="font-bold text-sm" style={{ color: item.color }}>{item.val}</p>
                </div>
              ))}
              <div>
                <p style={{ color: '#444', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>CMV</p>
                <CmvBadge cmv={cmv} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setExpandido(e => !e)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all text-xs"
              style={{ color: '#555', background: expandido ? '#1e1e1e' : 'transparent' }}>
              {expandido ? '▲' : '▼'}
            </button>
            <button onClick={onEditar}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{ color: '#555' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>✏️</button>
            <button onClick={onExcluir}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{ color: '#555' }}
              onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.1)'; e.currentTarget.style.color='#ef4444'; }}
              onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#555'; }}>🗑️</button>
          </div>
        </div>

        {expandido && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid #1e1e1e' }}>
            {produto.ingredientes?.length > 0 ? (
              <div className="space-y-1.5">
                <p style={{ color: '#444', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Ingredientes</p>
                {produto.ingredientes.map((ing, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />
                      <span style={{ color: '#aaa' }}>{ing.nome}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span style={{ color: '#666' }}>{ing.quantidade_usada} {ing.unidade_medida}</span>
                      <span style={{ color: '#444', fontSize: 11 }}>{brl(ing.custo_linha)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-center py-2" style={{ color: '#555' }}>Nenhum ingrediente na ficha</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Modal novo/editar produto (dark) ──────────────────────────
function ModalProduto({ modal, ingredientes, categorias, onClose, onSalvo }) {
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (modal === 'novo') { setForm(FORM_VAZIO); }
    else if (modal) {
      api.get(`/produtos/${modal.id}`).then(d => {
        setForm({
          nome: d.nome, categoria_id: d.categoria_id || '', preco_venda: d.preco_venda,
          ficha_tecnica: (d.ficha_tecnica || []).map(i => {
            const ing = ingredientes.find(x => x.nome === i.nome);
            return { ingrediente_id: ing?.id || '', quantidade_usada: i.quantidade_usada };
          }),
        });
      }).catch(e => toast.error(e.message));
    }
  }, [modal]);

  const isNovo = modal === 'novo';
  const sugestoesFiltradas = useMemo(() =>
    SUGESTOES.filter(s => !form.nome || s.nome.toLowerCase().includes(form.nome.toLowerCase()) ||
      s.categoria.toLowerCase().includes(form.nome.toLowerCase())).slice(0, 8),
    [form.nome]
  );
  const aplicarSugestao = (s) => {
    const cat = categorias.find(c => c.nome.toLowerCase() === s.categoria.toLowerCase());
    setForm(p => ({ ...p, nome: s.nome, preco_venda: s.preco_venda, categoria_id: cat?.id || '' }));
  };
  const addIngrediente = () => setForm(p => ({ ...p, ficha_tecnica: [...p.ficha_tecnica, { ingrediente_id: '', quantidade_usada: '' }] }));
  const removeIngrediente = (idx) => setForm(p => ({ ...p, ficha_tecnica: p.ficha_tecnica.filter((_, i) => i !== idx) }));
  const updateFicha = (idx, field, val) => setForm(p => {
    const ft = [...p.ficha_tecnica]; ft[idx] = { ...ft[idx], [field]: val }; return { ...p, ficha_tecnica: ft };
  });

  const custoPreview = form.ficha_tecnica.reduce((acc, item) => {
    const ing = ingredientes.find(i => i.id === Number(item.ingrediente_id));
    return acc + (ing ? ing.custo_unitario * Number(item.quantidade_usada || 0) : 0);
  }, 0);
  const cmvPreview = Number(form.preco_venda) > 0 ? (custoPreview / Number(form.preco_venda)) * 100 : 0;
  const margemPreview = Number(form.preco_venda) - custoPreview;
  const cmvCor = cmvPreview <= 30 ? '#10b981' : cmvPreview <= 40 ? 'var(--accent-2)' : '#ef4444';

  async function handleSubmit(e) {
    e.preventDefault(); setSalvando(true);
    try {
      if (isNovo) await api.post('/produtos', form);
      else await api.put(`/produtos/${modal.id}`, form);
      onSalvo();
    } catch (e) { toast.error(e.message); }
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={D.overlay} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={D.modal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10" style={D.header}>
          <div>
            <h2 className="text-lg font-black" style={{ color: '#e5e5e5' }}>
              {isNovo ? '✨ Novo Produto' : `✏️ ${modal.nome}`}
            </h2>
            {isNovo && <p className="text-xs mt-0.5" style={{ color: '#555' }}>Escolha uma sugestão ou preencha manualmente</p>}
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-all"
            style={{ color: '#555' }}
            onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">

          {/* Sugestões */}
          {isNovo && (
            <div className="rounded-2xl p-4" style={D.section}>
              <p className="text-xs font-bold tracking-widest mb-3" style={{ color: '#555' }}>💡 SUGESTÕES RÁPIDAS</p>
              <div className="flex flex-wrap gap-2">
                {sugestoesFiltradas.map((s, i) => (
                  <button key={i} type="button" onClick={() => aplicarSugestao(s)}
                    className="text-xs px-3 py-1.5 rounded-full font-bold transition-all active:scale-95"
                    style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.25)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.1)'}>
                    {s.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nome + Categoria */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold tracking-widest block mb-1.5" style={D.label}>NOME DO PRODUTO *</label>
              <input required autoFocus={isNovo} value={form.nome}
                onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                placeholder="Ex: Hot Philadelphia 10un"
                className="w-full px-3 py-2.5 rounded-xl text-sm font-medium outline-none transition-all"
                style={D.input}
                onFocus={e => e.target.style.borderColor = D.inputFocus}
                onBlur={e => e.target.style.borderColor = '#252525'} />
            </div>
            <div>
              <label className="text-xs font-bold tracking-widest block mb-1.5" style={D.label}>CATEGORIA</label>
              <select value={form.categoria_id}
                onChange={e => setForm(p => ({ ...p, categoria_id: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={D.input}>
                <option value="">Sem categoria</option>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          </div>

          {/* Preço */}
          <div>
            <label className="text-xs font-bold tracking-widest block mb-1.5" style={D.label}>PREÇO DE VENDA *</label>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: '#555' }}>R$</span>
              <input type="number" step="0.01" min="0.01" required
                placeholder="0,00" value={form.preco_venda}
                onChange={e => setForm(p => ({ ...p, preco_venda: e.target.value }))}
                className="px-3 py-2.5 rounded-xl text-xl font-black outline-none max-w-[180px] transition-all"
                style={D.input}
                onFocus={e => e.target.style.borderColor = D.inputFocus}
                onBlur={e => e.target.style.borderColor = '#252525'} />
            </div>
          </div>

          {/* Ingredientes */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-bold tracking-widest" style={D.label}>🧾 INGREDIENTES DA RECEITA</p>
                <p className="text-xs mt-0.5" style={{ color: '#3a3a3a' }}>{form.ficha_tecnica.length} ingrediente(s)</p>
              </div>
              <button type="button" onClick={addIngrediente}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
                + Adicionar
              </button>
            </div>

            {form.ficha_tecnica.length === 0 ? (
              <button type="button" onClick={addIngrediente}
                className="w-full py-8 rounded-xl border-2 border-dashed text-sm transition-all"
                style={{ borderColor: '#252525', color: '#444' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(var(--accent-rgb),0.4)'; e.currentTarget.style.color='var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='#252525'; e.currentTarget.style.color='#444'; }}>
                <div className="text-2xl mb-1">📋</div>
                Clique para adicionar ingredientes à receita
              </button>
            ) : (
              <div className="space-y-2">
                {form.ficha_tecnica.map((item, idx) => {
                  const ing = ingredientes.find(i => i.id === Number(item.ingrediente_id));
                  const custoLinha = ing ? ing.custo_unitario * Number(item.quantidade_usada || 0) : 0;
                  return (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-xl" style={D.row}>
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                        style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)' }}>{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <IngredienteSelect ingredientes={ingredientes} value={item.ingrediente_id} onChange={v => updateFicha(idx, 'ingrediente_id', v)} />
                      </div>
                      <div className="relative w-28 shrink-0">
                        <input type="number" step="0.001" min="0"
                          placeholder="Qtd" value={item.quantidade_usada}
                          onChange={e => updateFicha(idx, 'quantidade_usada', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg text-sm text-right outline-none transition-all"
                          style={D.input}
                          onFocus={e => e.target.style.borderColor = D.inputFocus}
                          onBlur={e => e.target.style.borderColor = '#252525'} />
                        {ing && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none" style={{ color: '#555' }}>{ing.unidade_medida}</span>}
                      </div>
                      <span className="text-xs font-medium w-16 text-right shrink-0" style={{ color: custoLinha > 0 ? '#888' : '#333' }}>
                        {custoLinha > 0 ? brl(custoLinha) : '—'}
                      </span>
                      <button type="button" onClick={() => removeIngrediente(idx)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0 text-sm transition-all"
                        style={{ color: '#555' }}
                        onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.15)'; e.currentTarget.style.color='#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#555'; }}>✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview análise */}
          {Number(form.preco_venda) > 0 && (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
              <div className="px-4 py-2.5" style={{ borderBottom: '1px solid #1a1a1a' }}>
                <p className="text-xs font-bold tracking-widest" style={D.label}>📊 ANÁLISE EM TEMPO REAL</p>
              </div>
              <div className="grid grid-cols-3 divide-x" style={{ '--tw-divide-opacity': 1, borderColor: '#1a1a1a' }}>
                {[
                  { label: 'Custo Total', val: brl(custoPreview), color: '#e5e5e5' },
                  { label: 'CMV',         val: `${cmvPreview.toFixed(1)}%`, color: cmvCor,
                    sub: cmvPreview <= 30 ? '✅ Excelente' : cmvPreview <= 40 ? '⚠️ Aceitável' : '🔴 Alto' },
                  { label: 'Margem',      val: brl(margemPreview), color: margemPreview >= 0 ? '#10b981' : '#ef4444' },
                ].map((item, i) => (
                  <div key={i} className="px-4 py-4 text-center" style={{ borderRight: i < 2 ? '1px solid #1a1a1a' : 'none' }}>
                    <p style={{ color: '#444', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{item.label}</p>
                    <p className="font-black text-base" style={{ color: item.color }}>{item.val}</p>
                    {item.sub && <p style={{ color: '#555', fontSize: 10, marginTop: 2 }}>{item.sub}</p>}
                  </div>
                ))}
              </div>
              <div className="px-4 pb-3 pt-1">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(cmvPreview, 100)}%`, background: cmvCor }} />
                  </div>
                  <span style={{ color: '#444', fontSize: 10 }}>meta ≤30%</span>
                </div>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-2" style={{ borderTop: '1px solid #1a1a1a' }}>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ color: '#888', background: 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando}
              className="px-6 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', boxShadow: '0 4px 16px rgba(var(--accent-rgb),0.3)' }}>
              {salvando ? 'Salvando…' : isNovo ? '✅ Criar Produto' : '💾 Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function FichasTecnicas() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [catFiltro, setCatFiltro] = useState('');
  const [modal, setModal] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const { data: produtos = [], isLoading } = useQuery({ queryKey: ['produtos'], queryFn: () => api.get('/produtos') });
  const { data: ingredientes = [] } = useQuery({ queryKey: ['ingredientes'], queryFn: () => api.get('/ingredientes') });
  const { data: categorias = [] } = useQuery({ queryKey: ['categorias'], queryFn: () => api.get('/produtos/categorias') });

  const excluir = useMutation({
    mutationFn: (id) => api.del(`/produtos/${id}`),
    onSuccess: () => { qc.invalidateQueries(['produtos']); toast.success('Produto removido.'); setConfirmDel(null); },
    onError: (e) => { toast.error(e.message); setConfirmDel(null); },
  });

  const lista = useMemo(() =>
    produtos.filter(p =>
      (!busca || p.nome.toLowerCase().includes(busca.toLowerCase())) &&
      (!catFiltro || String(p.categoria_id) === catFiltro)
    ), [produtos, busca, catFiltro]
  );

  const cmvMedio = produtos.length > 0 ? produtos.reduce((a, p) => a + (p.cmv || 0), 0) / produtos.length : 0;
  const alertaCmv = produtos.filter(p => p.cmv > 40).length;

  const abrirEditar = (p) => {
    api.get(`/produtos/${p.id}`).then(d => setModal({ ...p, ...d })).catch(e => toast.error(e.message));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fichas Técnicas</h1>
          <p className="page-subtitle">{produtos.length} produto(s) · CMV médio {cmvMedio.toFixed(1)}%</p>
        </div>
        <button onClick={() => setModal('novo')} className="btn-primary">+ Novo Produto</button>
      </div>

      {produtos.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { bg: '#f0fdf4', border: '#bbf7d0', tc: '#16a34a', label: 'CMV Médio', val: `${cmvMedio.toFixed(1)}%`, sub: 'meta ≤ 30%' },
            { bg: alertaCmv > 0 ? '#fef2f2' : '#f0fdf4', border: alertaCmv > 0 ? '#fecaca' : '#bbf7d0',
              tc: alertaCmv > 0 ? '#dc2626' : '#16a34a', label: 'CMV Alto (>40%)', val: String(alertaCmv),
              sub: alertaCmv > 0 ? 'produtos p/ revisar' : 'todos OK' },
            { bg: '#eff6ff', border: '#bfdbfe', tc: '#2563eb', label: 'Produtos', val: String(produtos.length), sub: `${ingredientes.length} ingredientes` },
          ].map((k, i) => (
            <div key={i} className="rounded-xl p-4 border" style={{ background: k.bg, borderColor: k.border }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: k.tc }}>{k.label}</p>
              <p className="text-2xl font-black mt-1" style={{ color: k.tc }}>{k.val}</p>
              <p className="text-xs mt-0.5" style={{ color: k.tc, opacity: .7 }}>{k.sub}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input className="input pl-9 w-56" placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setCatFiltro('')}
            className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
            style={!catFiltro ? { background:'var(--accent)', color:'#fff', borderColor:'var(--accent)' } : { background:'#fff', color:'#64748b', borderColor:'#e2e8f0' }}>
            Todos
          </button>
          {categorias.map(c => (
            <button key={c.id} onClick={() => setCatFiltro(catFiltro === String(c.id) ? '' : String(c.id))}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
              style={catFiltro === String(c.id) ? { background:'#3b82f6', color:'#fff', borderColor:'#3b82f6' } : { background:'#fff', color:'#64748b', borderColor:'#e2e8f0' }}>
              {c.nome}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? <PageLoading /> : lista.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border-2 border-dashed border-slate-200">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-bold text-slate-600">{busca || catFiltro ? 'Nenhum resultado' : 'Nenhum produto cadastrado'}</p>
          <p className="text-sm text-slate-400 mt-1">{busca || catFiltro ? 'Tente outro filtro' : 'Clique em "+ Novo Produto" para começar'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lista.map(p => (
            <ProdutoCard key={p.id} produto={p} onEditar={() => abrirEditar(p)} onExcluir={() => setConfirmDel(p)} />
          ))}
        </div>
      )}

      {modal && (
        <ModalProduto modal={modal} ingredientes={ingredientes} categorias={categorias}
          onClose={() => setModal(null)}
          onSalvo={() => { qc.invalidateQueries(['produtos']); toast.success(modal === 'novo' ? 'Produto criado!' : 'Atualizado!'); setModal(null); }} />
      )}
      {confirmDel && (
        <ConfirmDialog titulo="Excluir produto?" mensagem={`"${confirmDel.nome}" será removido permanentemente.`}
          onConfirm={() => excluir.mutate(confirmDel.id)} onCancel={() => setConfirmDel(null)} loading={excluir.isPending} />
      )}
    </div>
  );
}
