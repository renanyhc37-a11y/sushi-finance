import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { PageLoading } from '../components/Loading';
import { brl } from '../lib/fmt';

// ── Catálogo de ingredientes de sushi ─────────────────────────
const CATALOGO = [
  // Peixes & Proteínas
  { nome: 'Salmão fresco',         unidade_medida: 'kg',      cat: 'Peixes' },
  { nome: 'Salmão defumado',       unidade_medida: 'kg',      cat: 'Peixes' },
  { nome: 'Atum fresco',           unidade_medida: 'kg',      cat: 'Peixes' },
  { nome: 'Tilápia',               unidade_medida: 'kg',      cat: 'Peixes' },
  { nome: 'Robalo',                unidade_medida: 'kg',      cat: 'Peixes' },
  { nome: 'Linguado',              unidade_medida: 'kg',      cat: 'Peixes' },
  { nome: 'Peixe branco',          unidade_medida: 'kg',      cat: 'Peixes' },
  { nome: 'Camarão limpo',         unidade_medida: 'kg',      cat: 'Peixes' },
  { nome: 'Camarão com casca',     unidade_medida: 'kg',      cat: 'Peixes' },
  { nome: 'Polvo cozido',          unidade_medida: 'kg',      cat: 'Peixes' },
  { nome: 'Lula',                  unidade_medida: 'kg',      cat: 'Peixes' },
  { nome: 'Vieira',                unidade_medida: 'kg',      cat: 'Peixes' },
  // Laticínios
  { nome: 'Cream Cheese',          unidade_medida: 'kg',      cat: 'Laticínios' },
  { nome: 'Cream Cheese Light',    unidade_medida: 'kg',      cat: 'Laticínios' },
  { nome: 'Requeijão cremoso',     unidade_medida: 'kg',      cat: 'Laticínios' },
  { nome: 'Queijo Parmesão ralado',unidade_medida: 'kg',      cat: 'Laticínios' },
  { nome: 'Creme de leite',        unidade_medida: 'litro',   cat: 'Laticínios' },
  // Arroz & Grãos
  { nome: 'Arroz japonês',         unidade_medida: 'kg',      cat: 'Arroz & Grãos' },
  { nome: 'Panko',                 unidade_medida: 'kg',      cat: 'Arroz & Grãos' },
  { nome: 'Gergelim branco',       unidade_medida: 'kg',      cat: 'Arroz & Grãos' },
  { nome: 'Gergelim preto',        unidade_medida: 'kg',      cat: 'Arroz & Grãos' },
  { nome: 'Farinha de trigo',      unidade_medida: 'kg',      cat: 'Arroz & Grãos' },
  { nome: 'Fécula de batata',      unidade_medida: 'kg',      cat: 'Arroz & Grãos' },
  // Algas & Especiais
  { nome: 'Nori (folha alga)',     unidade_medida: 'unidade', cat: 'Algas & Especiais' },
  { nome: 'Tobiko (ovas capelin)', unidade_medida: 'kg',      cat: 'Algas & Especiais' },
  { nome: 'Masago',                unidade_medida: 'kg',      cat: 'Algas & Especiais' },
  { nome: 'Ikura (ovas salmão)',   unidade_medida: 'kg',      cat: 'Algas & Especiais' },
  { nome: 'Furikake',              unidade_medida: 'kg',      cat: 'Algas & Especiais' },
  // Molhos & Temperos
  { nome: 'Shoyu',                 unidade_medida: 'litro',   cat: 'Molhos & Temperos' },
  { nome: 'Vinagre de arroz',      unidade_medida: 'litro',   cat: 'Molhos & Temperos' },
  { nome: 'Azeite de gergelim',    unidade_medida: 'litro',   cat: 'Molhos & Temperos' },
  { nome: 'Molho tarê',            unidade_medida: 'litro',   cat: 'Molhos & Temperos' },
  { nome: 'Sriracha',              unidade_medida: 'litro',   cat: 'Molhos & Temperos' },
  { nome: 'Maionese japonesa',     unidade_medida: 'kg',      cat: 'Molhos & Temperos' },
  { nome: 'Wasabi pasta',          unidade_medida: 'kg',      cat: 'Molhos & Temperos' },
  { nome: 'Gengibre conserva',     unidade_medida: 'kg',      cat: 'Molhos & Temperos' },
  { nome: 'Missô',                 unidade_medida: 'kg',      cat: 'Molhos & Temperos' },
  { nome: 'Dashi',                 unidade_medida: 'litro',   cat: 'Molhos & Temperos' },
  { nome: 'Sake culinário',        unidade_medida: 'litro',   cat: 'Molhos & Temperos' },
  { nome: 'Mirin',                 unidade_medida: 'litro',   cat: 'Molhos & Temperos' },
  { nome: 'Óleo vegetal',          unidade_medida: 'litro',   cat: 'Molhos & Temperos' },
  { nome: 'Sal refinado',          unidade_medida: 'kg',      cat: 'Molhos & Temperos' },
  { nome: 'Açúcar',                unidade_medida: 'kg',      cat: 'Molhos & Temperos' },
  // Vegetais & Frutas
  { nome: 'Pepino japonês',        unidade_medida: 'kg',      cat: 'Vegetais & Frutas' },
  { nome: 'Abacate',               unidade_medida: 'kg',      cat: 'Vegetais & Frutas' },
  { nome: 'Manga',                 unidade_medida: 'kg',      cat: 'Vegetais & Frutas' },
  { nome: 'Cebolinha',             unidade_medida: 'kg',      cat: 'Vegetais & Frutas' },
  { nome: 'Cebola roxa',           unidade_medida: 'kg',      cat: 'Vegetais & Frutas' },
  { nome: 'Alface americana',      unidade_medida: 'kg',      cat: 'Vegetais & Frutas' },
  { nome: 'Aspargo',               unidade_medida: 'kg',      cat: 'Vegetais & Frutas' },
  { nome: 'Limão',                 unidade_medida: 'kg',      cat: 'Vegetais & Frutas' },
  { nome: 'Tomate cereja',         unidade_medida: 'kg',      cat: 'Vegetais & Frutas' },
  // Embalagens
  { nome: 'Bandeja sushi P',       unidade_medida: 'unidade', cat: 'Embalagens' },
  { nome: 'Bandeja sushi M',       unidade_medida: 'unidade', cat: 'Embalagens' },
  { nome: 'Bandeja sushi G',       unidade_medida: 'unidade', cat: 'Embalagens' },
  { nome: 'Caixinha temaki',       unidade_medida: 'unidade', cat: 'Embalagens' },
  { nome: 'Embalagem marmitex P',  unidade_medida: 'unidade', cat: 'Embalagens' },
  { nome: 'Embalagem marmitex M',  unidade_medida: 'unidade', cat: 'Embalagens' },
  { nome: 'Embalagem marmitex G',  unidade_medida: 'unidade', cat: 'Embalagens' },
  { nome: 'Saquinho molho',        unidade_medida: 'unidade', cat: 'Embalagens' },
  { nome: 'Hashi descartável',     unidade_medida: 'unidade', cat: 'Embalagens' },
  { nome: 'Saco plástico',         unidade_medida: 'unidade', cat: 'Embalagens' },
];

const CATS_CATALOGO = [...new Set(CATALOGO.map(i => i.cat))];

const CAT_ICONS = {
  'Peixes': '🐟', 'Laticínios': '🧀', 'Arroz & Grãos': '🌾',
  'Algas & Especiais': '🌿', 'Molhos & Temperos': '🍶',
  'Vegetais & Frutas': '🥑', 'Embalagens': '📦',
};

const UNIDADES = ['g', 'kg', 'ml', 'litro', 'unidade'];

const FORM_VAZIO = { nome: '', unidade_medida: 'kg', fornecedor: '' };
const COMPRA_VAZIA = { data: new Date().toISOString().slice(0,10), quantidade: '', preco_total: '' };

function formatData(data) {
  if (!data) return '';
  const [y, m, d] = data.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

// ── Modal limites de estoque ──────────────────────────────────
function ModalLimites({ ing, onClose, onSalvo }) {
  const [min, setMin] = useState(String(ing.estoque_minimo || 0));
  const [ideal, setIdeal] = useState(String(ing.estoque_ideal || 0));
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    setSalvando(true);
    try {
      const r = await fetch(
        `${(import.meta.env.VITE_API_URL || '/api')}/dashboard/ingredientes/${ing.id}/limites`,
        { method: 'PATCH', headers: { Authorization: `Bearer ${(await import('../hooks/useAuth')).getToken()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ estoque_minimo: Number(min), estoque_ideal: Number(ideal) }) }
      );
      if (!r.ok) throw new Error('Erro');
      toast.success('Limites salvos!');
      onSalvo();
    } catch { toast.error('Erro ao salvar'); }
    finally { setSalvando(false); }
  }

  const pct = Number(ideal) > 0 ? Math.min(100, (ing.estoque_atual / Number(ideal)) * 100) : null;
  const cor = ing.estoque_atual <= Number(min) ? '#ef4444' : pct !== null && pct < 50 ? 'var(--accent-2)' : '#10b981';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: '#0f0f0f', border: '1px solid #1e1e1e' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1a1a1a' }}>
          <div>
            <h2 className="font-black" style={{ color: '#e5e5e5' }}>📊 Limites de Estoque</h2>
            <p className="text-xs mt-0.5" style={{ color: '#555' }}>{ing.nome} · atual: <strong style={{ color: '#fff' }}>{ing.estoque_atual} {ing.unidade_medida}</strong></p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{ color: '#555' }}
            onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>✕</button>
        </div>
        <div className="p-5 space-y-4">
          {/* Barra visual */}
          {pct !== null && (
            <div className="px-3 py-3 rounded-xl" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
              <div className="flex justify-between text-xs mb-1.5" style={{ color: '#555' }}>
                <span>0</span><span style={{ color: '#fff' }}>{ing.estoque_atual} {ing.unidade_medida}</span><span>{ideal}</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: '#1a1a1a' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cor }} />
              </div>
              <p className="text-xs text-center mt-1.5 font-bold" style={{ color: cor }}>
                {pct.toFixed(0)}% do ideal
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold tracking-widest block mb-1.5" style={{ color: '#555' }}>
                MÍN. CRÍTICO ({ing.unidade_medida})
              </label>
              <input type="number" value={min} onChange={e => setMin(e.target.value)} step="0.1" min="0"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none font-black transition-all"
                style={{ background: '#141414', border: '1px solid #252525', color: '#ef4444' }}
                onFocus={e => e.target.style.borderColor = '#ef4444'}
                onBlur={e => e.target.style.borderColor = '#252525'} />
              <p className="text-[10px] mt-1" style={{ color: '#444' }}>Alerta vermelho no dashboard</p>
            </div>
            <div>
              <label className="text-xs font-bold tracking-widest block mb-1.5" style={{ color: '#555' }}>
                IDEAL ({ing.unidade_medida})
              </label>
              <input type="number" value={ideal} onChange={e => setIdeal(e.target.value)} step="0.1" min="0"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none font-black transition-all"
                style={{ background: '#141414', border: '1px solid #252525', color: '#10b981' }}
                onFocus={e => e.target.style.borderColor = '#10b981'}
                onBlur={e => e.target.style.borderColor = '#252525'} />
              <p className="text-[10px] mt-1" style={{ color: '#444' }}>100% na barra de estoque</p>
            </div>
          </div>

          <div className="flex gap-2 pt-1" style={{ borderTop: '1px solid #1a1a1a' }}>
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ color: '#888', background: 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando}
              className="flex-1 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))' }}>
              {salvando ? 'Salvando…' : '✅ Salvar limites'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Card do ingrediente (dark) ────────────────────────────────
function IngCard({ ing, onCompra, onEditar, onExcluir, onHistorico, onLimites }) {
  const temCusto = ing.custo_unitario > 0;
  const temEstoque = ing.estoque_atual > 0;

  return (
    <div className="rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all"
      style={{ background: '#111', border: '1px solid #1a1a1a' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#2a2a2a'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#1a1a1a'}>

      {/* Nome + unidade */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-tight truncate" style={{ color: '#e5e5e5' }}>{ing.nome}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{ background: '#1e1e1e', color: '#555' }}>{ing.unidade_medida}</span>
          {ing.fornecedor && <span className="text-[10px] truncate" style={{ color: '#444' }}>📦 {ing.fornecedor}</span>}
        </div>
      </div>

      {/* Custo */}
      <div className="text-right shrink-0">
        <p style={{ color: '#444', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Custo</p>
        <p className="font-bold text-xs" style={{ color: temCusto ? '#10b981' : '#333' }}>
          {temCusto ? brl(ing.custo_unitario) : '—'}
        </p>
      </div>

      {/* Estoque + limites */}
      <div className="text-right shrink-0 hidden sm:block">
        <p style={{ color: '#444', fontSize: 9, textTransform: 'uppercase', letterSpacing: 1 }}>Estoque</p>
        <p className="font-bold text-xs" style={{ color: temEstoque ? '#60a5fa' : '#333' }}>
          {temEstoque ? `${Number(ing.estoque_atual).toFixed(1)} ${ing.unidade_medida}` : '—'}
        </p>
        {ing.estoque_minimo > 0 && (
          <p style={{ fontSize: 9, color: ing.estoque_atual <= ing.estoque_minimo ? '#ef4444' : '#333' }}>
            mín: {ing.estoque_minimo}
          </p>
        )}
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onLimites} title="Definir limites de estoque"
          className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
          style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.18)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(167,139,250,0.1)'}>
          📊
        </button>
        <button onClick={onCompra} title="Registrar compra"
          className="px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
          style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.18)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}>
          + Compra
        </button>
        {ing.total_compras > 0 && (
          <button onClick={onHistorico} title="Histórico"
            className="w-6 h-6 flex items-center justify-center rounded-lg text-[10px] transition-all"
            style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.1)'}>
            📈
          </button>
        )}
        <button onClick={onEditar} title="Editar"
          className="w-6 h-6 flex items-center justify-center rounded-lg text-[10px] transition-all"
          style={{ color: '#444' }}
          onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>✏️</button>
        <button onClick={onExcluir} title="Excluir"
          className="w-6 h-6 flex items-center justify-center rounded-lg text-[10px] transition-all"
          style={{ color: '#444' }}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.12)'; e.currentTarget.style.color='#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#444'; }}>🗑️</button>
      </div>
    </div>
  );
}

// ── Modal importar catálogo ───────────────────────────────────
function ModalImportar({ existentes, onClose, onImportado }) {
  const [selecionados, setSelecionados] = useState(new Set());
  const [catAtiva, setCatAtiva] = useState('Peixes');
  const [busca, setBusca] = useState('');
  const [importando, setImportando] = useState(false);

  const nomesExistentes = useMemo(() => new Set(existentes.map(e => e.nome.toLowerCase())), [existentes]);

  const disponiveis = useMemo(() =>
    CATALOGO.filter(i => !nomesExistentes.has(i.nome.toLowerCase())),
    [nomesExistentes]
  );

  const filtrados = useMemo(() => {
    const cat = busca ? disponiveis : disponiveis.filter(i => i.cat === catAtiva);
    if (!busca) return cat;
    return disponiveis.filter(i => i.nome.toLowerCase().includes(busca.toLowerCase()));
  }, [disponiveis, catAtiva, busca]);

  const porCategoria = useMemo(() =>
    CATS_CATALOGO.reduce((acc, cat) => {
      acc[cat] = disponiveis.filter(i => i.cat === cat).length;
      return acc;
    }, {}),
    [disponiveis]
  );

  const toggleItem = (nome) => setSelecionados(s => {
    const n = new Set(s);
    n.has(nome) ? n.delete(nome) : n.add(nome);
    return n;
  });

  const toggleTodosVisiveis = () => {
    const nomesFiltrados = filtrados.map(i => i.nome);
    const todosSelecionados = nomesFiltrados.every(n => selecionados.has(n));
    setSelecionados(s => {
      const n = new Set(s);
      if (todosSelecionados) nomesFiltrados.forEach(x => n.delete(x));
      else nomesFiltrados.forEach(x => n.add(x));
      return n;
    });
  };

  const selecionarTodaCategoria = (cat) => {
    const itens = disponiveis.filter(i => i.cat === cat).map(i => i.nome);
    setSelecionados(s => { const n = new Set(s); itens.forEach(x => n.add(x)); return n; });
  };

  async function importar() {
    if (!selecionados.size) return;
    setImportando(true);
    try {
      const itens = CATALOGO.filter(i => selecionados.has(i.nome));
      const r = await api.post('/ingredientes/importar', { itens });
      toast.success(`✅ ${r.criados} ingrediente(s) importado(s)!`);
      onImportado();
    } catch (e) { toast.error(e.message); }
    setImportando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: '#0f0f0f', border: '1px solid #1e1e1e' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 shrink-0" style={{ borderBottom: '1px solid #1a1a1a' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black" style={{ color: '#e5e5e5' }}>🗂️ Catálogo de Ingredientes</h2>
              <p className="text-xs mt-0.5" style={{ color: '#555' }}>{disponiveis.length} disponíveis · {selecionados.size} selecionados</p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-all"
              style={{ color: '#555' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>✕</button>
          </div>
          <div className="relative mt-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#555' }}>🔍</span>
            <input value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar ingrediente no catálogo..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{ background: '#141414', border: '1px solid #252525', color: '#e5e5e5' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = '#252525'} />
          </div>
        </div>

        {/* Tabs categorias */}
        {!busca && (
          <div className="px-4 py-3 flex gap-1.5 flex-wrap shrink-0" style={{ borderBottom: '1px solid #1a1a1a' }}>
            {CATS_CATALOGO.filter(c => porCategoria[c] > 0).map(cat => (
              <button key={cat} onClick={() => setCatAtiva(cat)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
                style={catAtiva === cat
                  ? { background: 'rgba(var(--accent-rgb),0.2)', color: 'var(--accent)', borderColor: 'rgba(var(--accent-rgb),0.4)' }
                  : { background: 'transparent', color: '#555', borderColor: '#252525' }}>
                <span>{CAT_ICONS[cat]}</span>
                <span>{cat}</span>
                <span className="ml-0.5 opacity-60">({porCategoria[cat]})</span>
              </button>
            ))}
          </div>
        )}

        {/* Lista */}
        <div className="flex-1 overflow-y-auto p-4">
          {filtrados.length === 0 ? (
            <div className="text-center py-12" style={{ color: '#555' }}>
              <p className="text-3xl mb-2">🎉</p>
              <p className="font-semibold">Todos já foram importados!</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold tracking-widest" style={{ color: '#555' }}>
                  {busca ? `${filtrados.length} resultado(s)` : `${CAT_ICONS[catAtiva]} ${catAtiva} — ${filtrados.length} itens`}
                </p>
                <button onClick={busca ? toggleTodosVisiveis : () => selecionarTodaCategoria(catAtiva)}
                  className="text-xs font-bold transition-all" style={{ color: 'var(--accent)' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '.7'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                  {busca && filtrados.every(i => selecionados.has(i.nome)) ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filtrados.map(item => {
                  const sel = selecionados.has(item.nome);
                  return (
                    <label key={item.nome}
                      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
                      style={{
                        background: sel ? 'rgba(var(--accent-rgb),0.08)' : '#111',
                        border: `1px solid ${sel ? 'rgba(var(--accent-rgb),0.3)' : '#1a1a1a'}`,
                      }}>
                      <input type="checkbox" checked={sel} onChange={() => toggleItem(item.nome)}
                        className="w-4 h-4 accent-orange-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: sel ? 'var(--accent)' : '#ccc' }}>{item.nome}</p>
                        <p style={{ color: '#555', fontSize: 11 }}>{item.unidade_medida}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-between gap-3 shrink-0"
          style={{ borderTop: '1px solid #1a1a1a', background: '#0a0a0a' }}>
          <p className="text-xs" style={{ color: selecionados.size > 0 ? 'var(--accent)' : '#555' }}>
            {selecionados.size > 0 ? `${selecionados.size} selecionado(s) para importar` : 'Selecione os ingredientes'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{ color: '#888', background: 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Cancelar
            </button>
            <button onClick={importar} disabled={!selecionados.size || importando}
              className="px-5 py-2 rounded-xl text-sm font-black text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', boxShadow: '0 4px 16px rgba(var(--accent-rgb),0.3)' }}>
              {importando ? 'Importando…' : `✅ Importar ${selecionados.size || ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal criar/editar ────────────────────────────────────────
function ModalForm({ modal, onClose, onSalvo }) {
  const isNovo = modal === 'novo';
  const [form, setForm] = useState(
    isNovo ? FORM_VAZIO : { nome: modal.nome, unidade_medida: modal.unidade_medida, fornecedor: modal.fornecedor || '' }
  );
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      if (isNovo) await api.post('/ingredientes', form);
      else await api.put(`/ingredientes/${modal.id}`, form);
      onSalvo(isNovo ? 'Ingrediente criado!' : 'Ingrediente atualizado!');
    } catch (e) { toast.error(e.message); }
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: '#0f0f0f', border: '1px solid #1e1e1e' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1a1a1a' }}>
          <h2 className="font-black" style={{ color: '#e5e5e5' }}>{isNovo ? '✨ Novo Ingrediente' : '✏️ Editar Ingrediente'}</h2>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{ color: '#555' }}
            onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold tracking-widest block mb-1.5" style={{ color: '#555' }}>NOME *</label>
            <input required autoFocus value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: Salmão fresco"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{ background: '#141414', border: '1px solid #252525', color: '#e5e5e5' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = '#252525'} />
          </div>

          <div>
            <label className="text-xs font-bold tracking-widest block mb-2" style={{ color: '#555' }}>UNIDADE DE MEDIDA</label>
            <div className="flex gap-2 flex-wrap">
              {UNIDADES.map(u => (
                <button key={u} type="button" onClick={() => setForm(p => ({ ...p, unidade_medida: u }))}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all"
                  style={form.unidade_medida === u
                    ? { background: 'rgba(var(--accent-rgb),0.2)', color: 'var(--accent)', borderColor: 'rgba(var(--accent-rgb),0.4)' }
                    : { background: 'transparent', color: '#555', borderColor: '#252525' }}>
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold tracking-widest block mb-1.5" style={{ color: '#555' }}>
              FORNECEDOR <span style={{ color: '#333', fontWeight: 400 }}>(opcional)</span>
            </label>
            <input value={form.fornecedor} onChange={e => setForm(p => ({ ...p, fornecedor: e.target.value }))}
              placeholder="Ex: Peixaria Central"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{ background: '#141414', border: '1px solid #252525', color: '#e5e5e5' }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = '#252525'} />
          </div>

          <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #1a1a1a' }}>
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ color: '#888', background: 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando}
              className="flex-1 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))' }}>
              {salvando ? 'Salvando…' : isNovo ? 'Criar' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal compra ──────────────────────────────────────────────
function ModalCompra({ ingrediente, onClose, onSalvo }) {
  const [form, setForm] = useState(COMPRA_VAZIA);
  const [salvando, setSalvando] = useState(false);

  const custoUnit = form.quantidade && form.preco_total
    ? Number(form.preco_total) / Number(form.quantidade) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.post(`/ingredientes/${ingrediente.id}/compras`, form);
      toast.success('Compra registrada! Custo médio atualizado.');
      onSalvo();
    } catch (e) { toast.error(e.message); }
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: '#0f0f0f', border: '1px solid #1e1e1e' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1a1a1a' }}>
          <div>
            <h2 className="font-black" style={{ color: '#e5e5e5' }}>+ Registrar Compra</h2>
            <p className="text-xs mt-0.5" style={{ color: '#555' }}>{ingrediente.nome}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{ color: '#555' }}
            onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold tracking-widest block mb-1.5" style={{ color: '#555' }}>DATA</label>
            <input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: '#141414', border: '1px solid #252525', color: '#e5e5e5' }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold tracking-widest block mb-1.5" style={{ color: '#555' }}>
                QTD ({ingrediente.unidade_medida}) *
              </label>
              <input type="number" step="0.001" min="0.001" required autoFocus
                placeholder="Ex: 5" value={form.quantidade}
                onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{ background: '#141414', border: '1px solid #252525', color: '#e5e5e5' }}
                onFocus={e => e.target.style.borderColor = '#10b981'}
                onBlur={e => e.target.style.borderColor = '#252525'} />
            </div>
            <div>
              <label className="text-xs font-bold tracking-widest block mb-1.5" style={{ color: '#555' }}>TOTAL (R$) *</label>
              <input type="number" step="0.01" min="0.01" required
                placeholder="Ex: 89,90" value={form.preco_total}
                onChange={e => setForm(p => ({ ...p, preco_total: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none transition-all"
                style={{ background: '#141414', border: '1px solid #252525', color: '#e5e5e5' }}
                onFocus={e => e.target.style.borderColor = '#10b981'}
                onBlur={e => e.target.style.borderColor = '#252525'} />
            </div>
          </div>

          {/* Preview custo unitário */}
          <div className="rounded-xl p-3.5 transition-all"
            style={{ background: custoUnit ? 'rgba(16,185,129,0.08)' : '#0d0d0d',
              border: `1px solid ${custoUnit ? 'rgba(16,185,129,0.25)' : '#1a1a1a'}` }}>
            <p style={{ color: '#444', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
              Custo por {ingrediente.unidade_medida}
            </p>
            <p className="text-2xl font-black mt-0.5" style={{ color: custoUnit ? '#10b981' : '#333' }}>
              {custoUnit ? brl(custoUnit) : '—'}
            </p>
            {ingrediente.custo_unitario > 0 && custoUnit && (
              <p className="text-xs mt-1 font-semibold" style={{ color: custoUnit > ingrediente.custo_unitario ? '#ef4444' : '#10b981' }}>
                {custoUnit > ingrediente.custo_unitario ? '▲ subiu' : '▼ caiu'} vs atual {brl(ingrediente.custo_unitario)}
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #1a1a1a' }}>
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ color: '#888', background: 'transparent' }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              Cancelar
            </button>
            <button type="submit" disabled={salvando}
              className="flex-1 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg,#10b981,#34d399)', boxShadow: '0 4px 16px rgba(16,185,129,0.25)' }}>
              {salvando ? 'Registrando…' : '✅ Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function Ingredientes() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [catFiltro, setCatFiltro] = useState('');
  const [modalForm, setModalForm] = useState(null);
  const [modalCompra, setModalCompra] = useState(null);
  const [modalHistorico, setModalHistorico] = useState(null);
  const [modalImportar, setModalImportar] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [modalLimites, setModalLimites] = useState(null);

  const { data: ingredientes = [], isLoading } = useQuery({
    queryKey: ['ingredientes'],
    queryFn: () => api.get('/ingredientes'),
  });

  const excluir = useMutation({
    mutationFn: (id) => api.del(`/ingredientes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredientes'] });
      toast.success('Ingrediente excluído.');
      setConfirmDel(null);
    },
    onError: (e) => { toast.error(e.message); setConfirmDel(null); },
  });

  // Categorias identificadas no estoque atual (por unidade como proxy)
  const FILTROS = [
    { key: '',          label: 'Todos' },
    { key: 'kg',        label: '⚖️ kg' },
    { key: 'litro',     label: '🧴 litro' },
    { key: 'unidade',   label: '📦 unidade' },
    { key: 'g',         label: 'g' },
    { key: 'ml',        label: 'ml' },
  ].filter(f => !f.key || ingredientes.some(i => i.unidade_medida === f.key));

  const lista = useMemo(() =>
    ingredientes.filter(i =>
      (!busca || i.nome.toLowerCase().includes(busca.toLowerCase()) || (i.fornecedor||'').toLowerCase().includes(busca.toLowerCase())) &&
      (!catFiltro || i.unidade_medida === catFiltro)
    ),
    [ingredientes, busca, catFiltro]
  );

  const semCusto = ingredientes.filter(i => i.custo_unitario === 0).length;
  const totalEstoqueValor = ingredientes.reduce((a, i) => a + i.custo_unitario * i.estoque_atual, 0);

  function invalidar() { qc.invalidateQueries({ queryKey: ['ingredientes'] }); }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Ingredientes</h1>
          <p className="page-subtitle">{ingredientes.length} cadastrado(s) · estoque {brl(totalEstoqueValor)}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModalImportar(true)}
            className="px-4 py-2 rounded-xl text-sm font-bold border flex items-center gap-2"
            style={{ background: '#fff', borderColor: '#e2e8f0', color: '#64748b' }}>
            🗂️ Importar catálogo
          </button>
          <button onClick={() => setModalForm('novo')} className="btn-primary">
            + Novo
          </button>
        </div>
      </div>

      {/* KPIs */}
      {ingredientes.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl p-4 border min-w-0" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wide truncate">Ingredientes</p>
            <p className="text-xl font-black text-emerald-700 mt-1">{ingredientes.length}</p>
            <p className="text-xs text-emerald-500 mt-0.5 truncate">{ingredientes.filter(i=>i.total_compras>0).length} com compras</p>
          </div>
          <div className="rounded-xl p-4 border min-w-0" style={{ background: semCusto > 0 ? '#fef2f2' : '#f0fdf4', borderColor: semCusto > 0 ? '#fecaca' : '#bbf7d0' }}>
            <p className="text-xs font-semibold uppercase tracking-wide truncate" style={{ color: semCusto > 0 ? '#dc2626' : '#16a34a' }}>
              Sem custo
            </p>
            <p className="text-xl font-black mt-1" style={{ color: semCusto > 0 ? '#dc2626' : '#16a34a' }}>{semCusto}</p>
            <p className="text-xs mt-0.5 truncate" style={{ color: semCusto > 0 ? '#ef4444' : '#22c55e' }}>
              {semCusto > 0 ? 'registre compras' : 'todos atualizados'}
            </p>
          </div>
          <div className="rounded-xl p-4 border min-w-0" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide truncate">Valor em Estoque</p>
            <p className="text-xl font-black text-blue-700 mt-1 truncate">{brl(totalEstoqueValor)}</p>
            <p className="text-xs text-blue-500 mt-0.5 truncate">custo médio ponderado</p>
          </div>
        </div>
      )}

      {/* Busca + filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input className="input pl-9 w-60" placeholder="Buscar ingrediente..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTROS.map(f => (
            <button key={f.key} onClick={() => setCatFiltro(f.key)}
              className="px-3 py-1.5 rounded-full text-xs font-semibold border transition-all"
              style={catFiltro === f.key
                ? { background: '#e11d48', color: '#fff', borderColor: '#e11d48' }
                : { background: '#fff', color: '#64748b', borderColor: '#e2e8f0' }}>
              {f.label}
            </button>
          ))}
        </div>
        {(busca || catFiltro) && (
          <span className="text-xs text-slate-400">{lista.length} resultado(s)</span>
        )}
      </div>

      {/* Grid de cards */}
      {isLoading ? <PageLoading /> : (
        lista.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border-2 border-dashed border-slate-200">
            <p className="text-4xl mb-3">🧂</p>
            <p className="font-bold text-slate-600">{busca || catFiltro ? 'Nenhum resultado' : 'Nenhum ingrediente cadastrado'}</p>
            <p className="text-sm text-slate-400 mt-1 mb-4">{busca || catFiltro ? 'Tente outro filtro' : 'Importe do catálogo ou crie manualmente'}</p>
            {!busca && !catFiltro && (
              <div className="flex gap-2 justify-center">
                <button onClick={() => setModalImportar(true)}
                  className="px-4 py-2 rounded-xl text-sm font-bold"
                  style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' }}>
                  🗂️ Importar catálogo
                </button>
                <button onClick={() => setModalForm('novo')} className="btn-primary text-sm">
                  + Criar manualmente
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {lista.map(ing => (
              <IngCard
                key={ing.id}
                ing={ing}
                onCompra={() => setModalCompra(ing)}
                onEditar={() => setModalForm(ing)}
                onExcluir={() => setConfirmDel(ing)}
                onHistorico={() => setModalHistorico(ing)}
                onLimites={() => setModalLimites(ing)}
              />
            ))}
          </div>
        )
      )}

      {/* Modals */}
      {modalImportar && (
        <ModalImportar
          existentes={ingredientes}
          onClose={() => setModalImportar(false)}
          onImportado={() => { invalidar(); setModalImportar(false); }}
        />
      )}

      {modalForm && (
        <ModalForm
          modal={modalForm}
          onClose={() => setModalForm(null)}
          onSalvo={(msg) => { toast.success(msg); invalidar(); setModalForm(null); }}
        />
      )}

      {modalCompra && (
        <ModalCompra
          ingrediente={modalCompra}
          onClose={() => setModalCompra(null)}
          onSalvo={() => { invalidar(); setModalCompra(null); }}
        />
      )}

      {modalHistorico && (
        <ModalHistorico
          ingrediente={modalHistorico}
          onClose={() => setModalHistorico(null)}
        />
      )}

      {modalLimites && (
        <ModalLimites
          ing={modalLimites}
          onClose={() => setModalLimites(null)}
          onSalvo={() => { invalidar(); setModalLimites(null); }}
        />
      )}

      {confirmDel && (
        <ConfirmDialog
          titulo="Excluir ingrediente?"
          mensagem={`"${confirmDel.nome}" será removido permanentemente.`}
          onConfirm={() => excluir.mutate(confirmDel.id)}
          onCancel={() => setConfirmDel(null)}
          loading={excluir.isPending}
        />
      )}
    </div>
  );
}

// ── Modal histórico (mantido) ─────────────────────────────────
function ModalHistorico({ ingrediente, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['historico-preco', ingrediente.id],
    queryFn: () => api.get(`/ingredientes/${ingrediente.id}/historico`),
  });

  const chartData = useMemo(() => {
    if (!data?.compras) return [];
    return data.compras.map((c, i) => ({
      idx: i + 1, label: formatData(c.data),
      preco: parseFloat(c.custo_unitario.toFixed(4)),
      total: c.preco_total, qtd: c.quantidade,
    }));
  }, [data]);

  const stats = data?.stats;
  const precoMin = stats?.minimo || 0;
  const precoMax = stats?.maximo || 0;
  const variacaoCor = !stats ? '#6b7280'
    : stats.variacao_pct > 10 ? '#ef4444'
    : stats.variacao_pct > 0 ? 'var(--accent-2)'
    : stats.variacao_pct < 0 ? '#22c55e' : '#6b7280';

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="text-xs rounded-xl p-3 shadow-xl"
        style={{ background: '#111', border: '1px solid #2a2a2a', color: '#e5e5e5' }}>
        <p className="font-semibold mb-1" style={{ color: 'var(--accent)' }}>{d.label}</p>
        <p>Custo/{ingrediente.unidade_medida}: <strong>{brl(d.preco)}</strong></p>
        <p style={{ color: '#888' }}>Qtd: {d.qtd} {ingrediente.unidade_medida}</p>
        <p style={{ color: '#888' }}>Total pago: {brl(d.total)}</p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: '#0f0f0f', border: '1px solid #1e1e1e' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 sticky top-0 z-10"
          style={{ background: '#0f0f0f', borderBottom: '1px solid #1a1a1a' }}>
          <div>
            <h2 className="font-black" style={{ color: '#e5e5e5' }}>📈 Histórico de Preços</h2>
            <p className="text-xs mt-0.5" style={{ color: '#555' }}>{ingrediente.nome}</p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-all"
            style={{ color: '#555' }}
            onMouseEnter={e => e.currentTarget.style.background = '#1e1e1e'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>✕</button>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
            </div>
          ) : !stats ? (
            <p className="text-center py-8 text-slate-400">Nenhuma compra registrada ainda.</p>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Preço Atual', valor: brl(stats.atual), sub: `/${ingrediente.unidade_medida}`, cor: 'var(--accent)' },
                  { label: 'Mínimo', valor: brl(stats.minimo), sub: 'histórico', cor: '#10b981' },
                  { label: 'Máximo', valor: brl(stats.maximo), sub: 'histórico', cor: '#ef4444' },
                  { label: 'Variação Total', valor: `${stats.variacao_pct >= 0 ? '+' : ''}${stats.variacao_pct.toFixed(1)}%`, sub: `${stats.total_compras} compras`, cor: variacaoCor },
                ].map((s, i) => (
                  <div key={i} className="rounded-xl p-3" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                    <p style={{ color: '#444', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</p>
                    <p className="text-lg font-black mt-0.5" style={{ color: s.cor }}>{s.valor}</p>
                    <p style={{ color: '#444', fontSize: 10 }}>{s.sub}</p>
                  </div>
                ))}
              </div>

              {chartData.length >= 2 ? (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                    Evolução do custo por {ingrediente.unidade_medida}
                  </p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v.toFixed(2)}`} domain={['auto','auto']} />
                      <Tooltip content={<CustomTooltip />} />
                      <ReferenceLine y={precoMin} stroke="#22c55e" strokeDasharray="4 2" strokeOpacity={0.5} />
                      <ReferenceLine y={precoMax} stroke="#ef4444" strokeDasharray="4 2" strokeOpacity={0.5} />
                      <Line type="monotone" dataKey="preco" stroke="var(--accent)" strokeWidth={2.5}
                        dot={{ fill: 'var(--accent)', r: 4, strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: 'var(--accent-2)', strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-center text-sm text-slate-400 py-4">Registre ao menos 2 compras para ver o gráfico.</p>
              )}

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Últimas compras</p>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}>
                        {['Data','Qtd','Total',`Custo/${ingrediente.unidade_medida}`,'vs Ant.'].map((h,i) => (
                          <th key={i} className={`px-4 py-2.5 text-xs font-bold ${i>0?'text-right':'text-left'}`}
                            style={{ color: '#444' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...data.compras].reverse().slice(0, 10).map((c, i, arr) => {
                        const ant = arr[i + 1];
                        const diff = ant ? c.custo_unitario - ant.custo_unitario : null;
                        const pct = ant && ant.custo_unitario > 0 ? (diff / ant.custo_unitario) * 100 : null;
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #111' }}>
                            <td className="px-4 py-2.5" style={{ color: '#666' }}>{formatData(c.data)}</td>
                            <td className="px-4 py-2.5 text-right" style={{ color: '#555' }}>{c.quantidade} {ingrediente.unidade_medida}</td>
                            <td className="px-4 py-2.5 text-right font-mono" style={{ color: '#666' }}>{brl(c.preco_total)}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold" style={{ color: '#e5e5e5' }}>{brl(c.custo_unitario)}</td>
                            <td className="px-4 py-2.5 text-right text-xs font-bold">
                              {pct !== null ? (
                                <span style={{ color: pct > 0 ? '#ef4444' : pct < 0 ? '#10b981' : '#555' }}>
                                  {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                                </span>
                              ) : <span style={{ color: '#333' }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end">
                <button onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ color: '#888' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#1a1a1a'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
