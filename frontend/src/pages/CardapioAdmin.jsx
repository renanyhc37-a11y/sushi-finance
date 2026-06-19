import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { getToken } from '../hooks/useAuth';
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor,
  useSensor, useSensors, closestCenter, closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable,
  verticalListSortingStrategy, rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Pencil, X, Camera, Trash2, Save, Check, FileText, ClipboardList,
  Target, Tag, Clock, Bot, UtensilsCrossed, Image as ImageIcon, Eye, Settings,
  RefreshCw, Upload, Truck, Star, Link2, Hand, Loader2, ImagePlus, GripVertical,
  Zap, Circle, Undo2, Sparkles, Lightbulb, Inbox,
  Fish, Soup, Salad, GlassWater, CupSoda, IceCreamCone, Cookie, Coffee, Beef,
  Leaf, Flame, Boxes, Croissant, Cake, Citrus,
} from 'lucide-react';

// Seletor de ícones de prato (substitui o emoji). O valor salvo no campo
// "emoji" passa a ser uma chave (ex.: 'fish'); itens antigos com emoji caem
// no ícone padrão até serem reeditados.
const ICONES_PRATO = [
  { k: 'utensils', I: UtensilsCrossed }, { k: 'fish', I: Fish }, { k: 'flame', I: Flame },
  { k: 'soup', I: Soup }, { k: 'salad', I: Salad }, { k: 'leaf', I: Leaf },
  { k: 'cup', I: CupSoda }, { k: 'water', I: GlassWater }, { k: 'coffee', I: Coffee },
  { k: 'icecream', I: IceCreamCone }, { k: 'cookie', I: Cookie }, { k: 'cake', I: Cake },
  { k: 'croissant', I: Croissant }, { k: 'beef', I: Beef }, { k: 'citrus', I: Citrus },
  { k: 'box', I: Boxes }, { k: 'star', I: Star },
];
const ICONE_MAP = Object.fromEntries(ICONES_PRATO.map(x => [x.k, x.I]));
function IconePrato({ chave, size = 20, strokeWidth = 1.75, ...rest }) {
  const I = ICONE_MAP[chave] || UtensilsCrossed;
  return <I size={size} strokeWidth={strokeWidth} {...rest} />;
}

const BASE = import.meta.env.VITE_API_URL || '/api';
const brl  = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const authJ = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

const EMOJIS_CAT  = ['🍱','🍣','🔥','🥤','🍜','🍛','🥢','🎋','🌊','⭐','🎯','🍡','🍘','🫙'];
const EMOJIS_ITEM = ['🍱','🍣','🔥','🥤','🍜','🍛','🥢','🦐','🐟','🦑','🥑','🧃','💧','🍵','🍙','🍤','🦞','🫙','🧆','🥗'];

// ── Dropdown customizado para itens do cardápio ───────────────
function SelectCardapio({ itens, value, onChange, placeholder = '— texto livre —' }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function fechar(e) { if (ref.current && !ref.current.contains(e.target)) setAberto(false); }
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  const filtrados = itens.filter(i =>
    !busca || `${i._cat} ${i.nome}`.toLowerCase().includes(busca.toLowerCase())
  );
  const selecionado = itens.find(i => i.nome === value);
  const label = selecionado ? `${selecionado._cat} › ${selecionado.nome}` : placeholder;

  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => { setAberto(v => !v); setBusca(''); }}
        className="w-full px-3 py-2.5 rounded-xl text-sm text-left outline-none flex items-center justify-between gap-2"
        style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.08)', color: selecionado ? 'var(--t-strong)' : 'var(--t-dim)' }}>
        <span className="truncate">{label}</span>
        <span style={{ color: 'var(--t-dim)', fontSize: 10 }}>{aberto ? '▲' : '▼'}</span>
      </button>
      {aberto && (
        <div className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden"
          style={{ background: 'var(--space-elev)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', maxHeight: 260 }}>
          <div className="p-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <input autoFocus value={busca} onChange={e => setBusca(e.target.value)}
              placeholder="Buscar item..." className="w-full px-3 py-1.5 rounded-lg text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--t-strong)', border: '1px solid rgba(255,255,255,0.08)' }} />
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
            <button type="button" onClick={() => { onChange(null); setAberto(false); }}
              className="w-full px-3 py-2 text-sm text-left hover:bg-white/5 transition-colors"
              style={{ color: 'var(--t-dim)' }}>{placeholder}</button>
            {filtrados.map(i => (
              <button key={i.id} type="button"
                onClick={() => { onChange(i); setAberto(false); setBusca(''); }}
                className="w-full px-3 py-2 text-sm text-left hover:bg-white/5 transition-colors flex items-center gap-2"
                style={{ background: value === i.nome ? 'rgba(var(--accent-rgb),0.12)' : 'transparent', color: 'var(--t-strong)' }}>
                <span style={{ color: 'var(--t-dim)', fontSize: 11 }}>{i._cat}</span>
                <span>›</span>
                <span>{i.nome}</span>
              </button>
            ))}
            {filtrados.length === 0 && <p className="px-3 py-3 text-xs text-center" style={{ color: 'var(--t-dim)' }}>Nenhum item encontrado</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal de categoria ────────────────────────────────────────
function ModalCategoria({ cat, onClose, onSalvo }) {
  const isNova = !cat?.id;
  const [form, setForm] = useState({ nome: cat?.nome || '', emoji: cat?.emoji || 'fish', descricao: cat?.descricao || '', ativo: cat?.ativo !== 0 });
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!form.nome.trim()) return toast.error('Nome é obrigatório');
    setSalvando(true);
    try {
      const url    = isNova ? `${BASE}/cardapio/categorias` : `${BASE}/cardapio/categorias/${cat.id}`;
      const method = isNova ? 'POST' : 'PATCH';
      const res = await fetch(url, { method, headers: authJ(), body: JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).erro || 'Erro');
      toast.success(isNova ? 'Categoria criada!' : 'Categoria salva!');
      onSalvo();
    } catch (e) { toast.error(e.message); }
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden" style={{ background: 'var(--space-elev)', border: '1px solid var(--space-elev-2)' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--space-elev-2)' }}>
          <h3 className="font-black t-strong text-lg flex items-center gap-2">{isNova ? <><Plus size={18} strokeWidth={2} /> Nova Categoria</> : <><Pencil size={17} strokeWidth={1.75} /> Editar Categoria</>}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl t-dim" style={{ background: 'var(--space-elev-2)' }}><X size={18} strokeWidth={1.75} /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Emoji */}
          <div>
            <label className="text-xs t-dim font-bold mb-2 block">ÍCONE</label>
            <div className="flex flex-wrap gap-1.5">
              {ICONES_PRATO.map(({ k, I }) => (
                <button key={k} type="button" onClick={() => setForm(f => ({ ...f, emoji: k }))}
                  className="w-10 h-10 rounded-xl flex items-center justify-center transition-all"
                  style={{ background: form.emoji === k ? 'rgba(var(--accent-rgb),0.2)' : 'var(--space-elev-2)', border: `2px solid ${form.emoji === k ? 'var(--accent)' : 'transparent'}`, color: form.emoji === k ? 'var(--accent)' : 'var(--txt)' }}>
                  <I size={19} strokeWidth={1.75} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs t-dim font-bold mb-1.5 block">NOME DA CATEGORIA *</label>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Combinados, Hot Roll..."
              className="w-full px-4 py-3 rounded-xl text-sm t-strong outline-none"
              style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }}
              onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--hairline)'} />
          </div>
          <div>
            <label className="text-xs t-dim font-bold mb-1.5 block">DESCRIÇÃO (opcional)</label>
            <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Os clássicos da casa"
              className="w-full px-4 py-3 rounded-xl text-sm t-strong outline-none"
              style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }}
              onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--hairline)'} />
          </div>
          {!isNova && (
            <button onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}
              className="flex items-center gap-3 w-full p-3 rounded-xl"
              style={{ background: form.ativo ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${form.ativo ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
              <div className="w-10 h-6 rounded-full relative" style={{ background: form.ativo ? '#10b981' : '#374151' }}>
                <div className="w-4 h-4 bg-white rounded-full absolute top-1 transition-all" style={{ left: form.ativo ? '22px' : '4px' }} />
              </div>
              <span className="text-sm font-bold" style={{ color: form.ativo ? '#10b981' : '#ef4444' }}>
                {form.ativo ? 'Categoria ativa (visível no cardápio)' : 'Categoria oculta'}
              </span>
            </button>
          )}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-bold t-dim" style={{ background: 'var(--space-elev-2)' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando}
            className="flex-1 py-3 rounded-xl text-sm font-black t-strong disabled:opacity-50 transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))' }}>
            {salvando ? '⏳ Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de item ─────────────────────────────────────────────
function ModalItem({ item, categorias, catIdInicial, onClose, onSalvo }) {
  const isNovo = !item?.id;
  const [form, setForm] = useState({
    nome: item?.nome || '',
    descricao: item?.descricao || '',
    preco: item?.preco ? String(item.preco) : '',
    emoji: item?.emoji || 'fish',
    categoria_id: item?.categoria_id || catIdInicial || categorias[0]?.id || '',
    disponivel: item?.disponivel !== 0,
    is_sugestao: item?.is_sugestao === 1,
    promo_ativa: item?.promo_ativa === 1,
    preco_promo: item?.preco_promo ? String(item.preco_promo) : '',
    promo_tag: item?.promo_tag || '',
  });
  const [foto, setFoto] = useState(item?.foto || null);
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(item?.foto ? `${item.foto}?t=${Date.now()}` : null);
  const [salvando, setSalvando] = useState(false);
  const inputFotoRef = useRef(null);

  function onFotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('Imagem muito grande (máx 5MB)');
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  async function salvar() {
    if (!form.nome.trim()) return toast.error('Nome é obrigatório');
    const preco = parseFloat(String(form.preco).replace(',', '.'));
    if (!preco || preco <= 0) return toast.error('Preço inválido');
    setSalvando(true);
    try {
      // 1. Salva dados do item
      const url    = isNovo ? `${BASE}/cardapio/itens` : `${BASE}/cardapio/itens/${item.id}`;
      const method = isNovo ? 'POST' : 'PATCH';
      const preco_promo = form.preco_promo ? parseFloat(String(form.preco_promo).replace(',', '.')) : null;
      if (preco_promo !== null && (isNaN(preco_promo) || preco_promo <= 0)) return toast.error('Preço promocional inválido');
      const res = await fetch(url, {
        method, headers: authJ(),
        body: JSON.stringify({
          ...form, preco, disponivel: form.disponivel,
          preco_promo: preco_promo || null,
          promo_tag: form.promo_tag || null,
          promo_ativa: form.promo_ativa ? 1 : 0,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).erro || 'Erro');
      const salvo = await res.json();

      // 2. Upload de foto (se tiver nova)
      if (fotoFile) {
        const fd = new FormData();
        fd.append('foto', fotoFile);
        const fRes = await fetch(`${BASE}/cardapio/itens/${salvo.id}/foto`, {
          method: 'POST', headers: authH(), body: fd,
        });
        if (!fRes.ok) {
          let msg = `HTTP ${fRes.status}`;
          try { const j = await fRes.json(); msg = j.erro || `HTTP ${fRes.status}`; } catch {}
          toast.error(`Falha no upload: ${msg}`);
        }
      }

      toast.success(isNovo ? '✅ Item criado!' : '✅ Item salvo!');
      onSalvo();
    } catch (e) { toast.error(e.message); }
    setSalvando(false);
  }

  async function removerFoto() {
    if (!item?.id || !foto) return;
    try {
      await fetch(`${BASE}/cardapio/itens/${item.id}/foto`, { method: 'DELETE', headers: authH() });
      setFoto(null); setFotoPreview(null); setFotoFile(null);
      toast.success('Foto removida');
    } catch { toast.error('Erro ao remover foto'); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[92vh]" style={{ background: 'var(--space-elev)', border: '1px solid var(--space-elev-2)' }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--space-elev-2)' }}>
          <h3 className="font-black t-strong text-lg flex items-center gap-2">{isNovo ? <><Plus size={18} strokeWidth={2} /> Novo Item</> : <><Pencil size={17} strokeWidth={1.75} /> Editar Item</>}</h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl t-dim" style={{ background: 'var(--space-elev-2)' }}><X size={18} strokeWidth={1.75} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* FOTO */}
          <div>
            <label className="text-xs t-dim font-bold mb-2 block">FOTO DO ITEM</label>
            <div className="flex gap-3 items-start">
              {/* Preview */}
              <div className="w-28 h-28 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center relative"
                style={{ background: 'var(--space-elev-2)', border: '2px dashed var(--hairline)' }}>
                {fotoPreview ? (
                  <>
                    <img src={fotoPreview} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => { setFotoFile(null); setFotoPreview(foto || null); }}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                      style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}><X size={11} strokeWidth={2.5} /></button>
                  </>
                ) : (
                  <span className="text-4xl">{form.emoji}</span>
                )}
              </div>
              {/* Botões */}
              <div className="flex-1 space-y-2">
                <button onClick={() => inputFotoRef.current?.click()}
                  className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                  style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.3)' }}>
                  <Camera size={15} strokeWidth={1.75} /> {fotoPreview ? 'Trocar foto' : 'Adicionar foto'}
                </button>
                {(foto || fotoPreview) && (
                  <button onClick={removerFoto}
                    className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <Trash2 size={15} strokeWidth={1.75} /> Remover foto
                  </button>
                )}
                <p className="text-[10px] t-faint">JPG, PNG ou WebP · máx 5MB</p>
                <input ref={inputFotoRef} type="file" accept="image/*" className="hidden" onChange={onFotoChange} />
              </div>
            </div>
          </div>

          {/* Ícone picker */}
          <div>
            <label className="text-xs t-dim font-bold mb-2 block">ÍCONE (aparece quando não há foto)</label>
            <div className="flex flex-wrap gap-1.5">
              {ICONES_PRATO.map(({ k, I }) => (
                <button key={k} type="button" onClick={() => setForm(f => ({ ...f, emoji: k }))}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                  style={{ background: form.emoji === k ? 'rgba(var(--accent-rgb),0.2)' : 'var(--space-elev-2)', border: `2px solid ${form.emoji === k ? 'var(--accent)' : 'transparent'}`, color: form.emoji === k ? 'var(--accent)' : 'var(--txt)' }}>
                  <I size={17} strokeWidth={1.75} />
                </button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="text-xs t-dim font-bold mb-1.5 block">NOME DO ITEM *</label>
            <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              placeholder="Ex: Hot Roll Salmão"
              className="w-full px-4 py-3 rounded-xl text-sm t-strong outline-none"
              style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }}
              onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--hairline)'} />
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs t-dim font-bold mb-1.5 block">DESCRIÇÃO</label>
            <textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: 8 peças empanadas com salmão e cream cheese..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl text-sm t-strong outline-none resize-none"
              style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }}
              onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--hairline)'} />
          </div>

          {/* Preço + Categoria */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs t-dim font-bold mb-1.5 block">PREÇO (R$) *</label>
              <input type="number" step="0.01" min="0" value={form.preco}
                onChange={e => setForm(f => ({ ...f, preco: e.target.value }))}
                placeholder="34.90"
                className="w-full px-4 py-3 rounded-xl text-sm t-strong outline-none"
                style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }}
                onFocus={e => e.target.style.borderColor='var(--accent)'} onBlur={e => e.target.style.borderColor='var(--hairline)'} />
            </div>
            <div>
              <label className="text-xs t-dim font-bold mb-1.5 block">CATEGORIA</label>
              <select value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: Number(e.target.value) }))}
                className="w-full px-3 py-3 rounded-xl text-sm t-strong outline-none"
                style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }}>
                {categorias.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nome}</option>)}
              </select>
            </div>
          </div>

          {/* Disponível toggle */}
          <button onClick={() => setForm(f => ({ ...f, disponivel: !f.disponivel }))}
            className="flex items-center gap-3 w-full p-3 rounded-xl transition-all"
            style={{ background: form.disponivel ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${form.disponivel ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
            <div className="w-10 h-6 rounded-full relative shrink-0" style={{ background: form.disponivel ? '#10b981' : '#374151' }}>
              <div className="w-4 h-4 bg-white rounded-full absolute top-1 transition-all" style={{ left: form.disponivel ? '22px' : '4px' }} />
            </div>
            <span className="text-sm font-bold" style={{ color: form.disponivel ? '#10b981' : '#ef4444' }}>
              {form.disponivel ? 'Disponível — aparece no cardápio' : 'Indisponível — oculto para clientes'}
            </span>
          </button>

          {/* Sugestão toggle */}
          <button onClick={() => setForm(f => ({ ...f, is_sugestao: !f.is_sugestao }))}
            className="flex items-center gap-3 w-full p-3 rounded-xl transition-all"
            style={{ background: form.is_sugestao ? 'rgba(245,158,11,0.08)' : 'rgba(100,116,139,0.06)', border: `1px solid ${form.is_sugestao ? 'rgba(245,158,11,0.35)' : 'var(--hairline)'}` }}>
            <div className="w-10 h-6 rounded-full relative shrink-0" style={{ background: form.is_sugestao ? '#f59e0b' : '#374151' }}>
              <div className="w-4 h-4 bg-white rounded-full absolute top-1 transition-all" style={{ left: form.is_sugestao ? '22px' : '4px' }} />
            </div>
            <div>
              <span className="text-sm font-bold block" style={{ color: form.is_sugestao ? '#f59e0b' : 'var(--txt-dim)' }}>
                {form.is_sugestao ? '⭐ Sugerido como adicional' : 'Não sugerido como adicional'}
              </span>
              <span className="text-xs" style={{ color: 'var(--txt-dim)' }}>Aparece na seção de sugestões ao finalizar pedido</span>
            </div>
          </button>

          {/* ── PROMOÇÃO ──────────────────────────────────────────── */}
          <div className="rounded-xl overflow-hidden" style={{ border: `2px solid ${form.promo_ativa ? 'rgba(239,68,68,0.5)' : 'var(--hairline)'}`, background: form.promo_ativa ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
            {/* Toggle promoção */}
            <button type="button" onClick={() => setForm(f => ({ ...f, promo_ativa: !f.promo_ativa }))}
              className="flex items-center gap-3 w-full p-3 transition-all">
              <div className="w-10 h-6 rounded-full relative shrink-0" style={{ background: form.promo_ativa ? '#ef4444' : '#374151' }}>
                <div className="w-4 h-4 bg-white rounded-full absolute top-1 transition-all" style={{ left: form.promo_ativa ? '22px' : '4px' }} />
              </div>
              <div className="text-left">
                <span className="text-sm font-bold block" style={{ color: form.promo_ativa ? '#ef4444' : 'var(--txt-dim)' }}>
                  {form.promo_ativa ? '🔥 Promoção ATIVA' : 'Ativar promoção'}
                </span>
                <span className="text-xs" style={{ color: 'var(--txt-dim)' }}>Preço riscado + tag de gatilho no cardápio</span>
              </div>
            </button>

            {form.promo_ativa && (
              <div className="px-3 pb-3 space-y-3">
                {/* Preço promocional */}
                <div>
                  <label className="text-xs font-bold mb-1.5 block" style={{ color: 'var(--txt-dim)' }}>PREÇO PROMOCIONAL (R$)</label>
                  <input type="number" step="0.01" min="0"
                    value={form.preco_promo}
                    onChange={e => setForm(f => ({ ...f, preco_promo: e.target.value }))}
                    placeholder={`Ex: ${form.preco ? (parseFloat(form.preco)*0.8).toFixed(2) : '27.90'}`}
                    className="w-full px-4 py-2.5 rounded-xl text-sm t-strong outline-none"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(239,68,68,0.3)' }}
                    onFocus={e => e.target.style.borderColor='#ef4444'} onBlur={e => e.target.style.borderColor='rgba(239,68,68,0.3)'} />
                  {form.preco && form.preco_promo && parseFloat(form.preco_promo) < parseFloat(form.preco) && (
                    <p className="text-xs mt-1" style={{ color: '#10b981' }}>
                      Desconto de {Math.round((1 - parseFloat(form.preco_promo)/parseFloat(form.preco))*100)}% · cliente economiza R$ {(parseFloat(form.preco)-parseFloat(form.preco_promo)).toFixed(2).replace('.',',')}
                    </p>
                  )}
                </div>

                {/* Tag de gatilho */}
                <div>
                  <label className="text-xs font-bold mb-2 block" style={{ color: 'var(--txt-dim)' }}>GATILHO / TAG (aparece na foto)</label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {['🔥 PROMOÇÃO','⏰ HOJE APENAS','💥 OFERTA','🎯 IMPERDÍVEL','💸 ECONOMIA','⚡ LIMITADO','🏆 MAIS VENDIDO','✨ DESTAQUE','🆕 NOVIDADE','🎁 ESPECIAL'].map(t => (
                      <button key={t} type="button"
                        onClick={() => setForm(f => ({ ...f, promo_tag: f.promo_tag === t ? '' : t }))}
                        className="text-xs px-2.5 py-1 rounded-full font-bold transition-all"
                        style={{
                          background: form.promo_tag === t ? 'rgba(239,68,68,0.2)' : 'var(--space-elev-2)',
                          border: `1px solid ${form.promo_tag === t ? '#ef4444' : 'transparent'}`,
                          color: form.promo_tag === t ? '#ef4444' : 'var(--txt-dim)',
                        }}>{t}</button>
                    ))}
                  </div>
                  <input
                    value={form.promo_tag}
                    onChange={e => setForm(f => ({ ...f, promo_tag: e.target.value }))}
                    placeholder="Ou escreva sua tag personalizada..."
                    className="w-full px-3 py-2 rounded-xl text-sm t-strong outline-none"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(239,68,68,0.3)' }}
                    onFocus={e => e.target.style.borderColor='#ef4444'} onBlur={e => e.target.style.borderColor='rgba(239,68,68,0.3)'} />
                </div>

                {/* Preview */}
                {form.preco && (
                  <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <span className="text-xs font-bold" style={{ color: 'var(--txt-dim)' }}>PREVIEW:</span>
                    <div className="flex items-center gap-2">
                      {form.promo_tag && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: '#ef4444', color: '#fff' }}>{form.promo_tag}</span>
                      )}
                      <span className="text-sm line-through" style={{ color: 'var(--txt-dim)' }}>R$ {parseFloat(form.preco).toFixed(2).replace('.',',')}</span>
                      {form.preco_promo && (
                        <span className="text-sm font-black" style={{ color: '#10b981' }}>R$ {parseFloat(form.preco_promo).toFixed(2).replace('.',',')}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 flex gap-2 shrink-0" style={{ borderTop: '1px solid var(--space-elev-2)' }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-bold t-dim" style={{ background: 'var(--space-elev-2)' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando}
            className="flex-2 px-8 py-3 rounded-xl text-sm font-black t-strong disabled:opacity-50 active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', flex: 2 }}>
            {salvando ? <span className="flex items-center justify-center gap-1.5"><Loader2 size={15} strokeWidth={2} className="animate-spin" /> Salvando...</span> : isNovo ? <span className="flex items-center justify-center gap-1.5"><Check size={15} strokeWidth={2.5} /> Criar item</span> : <span className="flex items-center justify-center gap-1.5"><Check size={15} strokeWidth={2.5} /> Salvar alterações</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal Cupom ───────────────────────────────────────────────
function ModalCupom({ onClose, onSalvo }) {
  const [form, setForm] = useState({ codigo: '', descricao: '', tipo: 'percentual', valor: '', minimo: '', usos_maximos: '', validade: '' });
  const [salvando, setSalvando] = useState(false);

  async function salvar(e) {
    e.preventDefault();
    if (!form.codigo.trim()) return toast.error('Código obrigatório');
    if (!form.valor || Number(form.valor) <= 0) return toast.error('Valor inválido');
    setSalvando(true);
    try {
      const r = await fetch(`${BASE}/cardapio/cupons`, {
        method: 'POST', headers: authJ(),
        body: JSON.stringify({ ...form, valor: Number(form.valor), minimo: Number(form.minimo || 0), usos_maximos: Number(form.usos_maximos || 0) }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro || 'Erro');
      toast.success('Cupom criado!');
      onSalvo();
    } catch (e) { toast.error(e.message); }
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={onClose}>
      <form onSubmit={salvar} onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl p-6 space-y-4"
        style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
        <h2 className="font-black t-strong text-lg flex items-center gap-2"><Tag size={18} strokeWidth={1.75} /> Novo cupom</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs t-dim font-bold tracking-wider block mb-1.5">CÓDIGO</label>
            <input value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
              placeholder="EX10, FRETE, NATAL20..."
              className="w-full px-4 py-3 rounded-xl text-sm t-strong outline-none tracking-widest font-bold"
              style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs t-dim font-bold tracking-wider block mb-1.5">TIPO</label>
              <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                className="w-full px-3 py-3 rounded-xl text-sm t-strong outline-none"
                style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }}>
                <option value="percentual">% Percentual</option>
                <option value="fixo">R$ Valor fixo</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs t-dim font-bold tracking-wider block mb-1.5">
                {form.tipo === 'percentual' ? 'PERCENTUAL (%)' : 'VALOR (R$)'}
              </label>
              <input type="number" min="0.01" step="0.01" value={form.valor}
                onChange={e => setForm(p => ({ ...p, valor: e.target.value }))}
                placeholder={form.tipo === 'percentual' ? '10' : '15,00'}
                className="w-full px-3 py-3 rounded-xl text-sm t-strong outline-none"
                style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs t-dim font-bold tracking-wider block mb-1.5">MÍN. PEDIDO (R$)</label>
              <input type="number" min="0" step="0.01" value={form.minimo}
                onChange={e => setForm(p => ({ ...p, minimo: e.target.value }))}
                placeholder="0 = sem mínimo"
                className="w-full px-3 py-2.5 rounded-xl text-sm t-strong outline-none"
                style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
            </div>
            <div className="flex-1">
              <label className="text-xs t-dim font-bold tracking-wider block mb-1.5">USOS MÁX.</label>
              <input type="number" min="0" value={form.usos_maximos}
                onChange={e => setForm(p => ({ ...p, usos_maximos: e.target.value }))}
                placeholder="0 = ilimitado"
                className="w-full px-3 py-2.5 rounded-xl text-sm t-strong outline-none"
                style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
            </div>
          </div>
          <div>
            <label className="text-xs t-dim font-bold tracking-wider block mb-1.5">VALIDADE (opcional)</label>
            <input type="date" value={form.validade} onChange={e => setForm(p => ({ ...p, validade: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl text-sm t-strong outline-none"
              style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
          </div>
          <div>
            <label className="text-xs t-dim font-bold tracking-wider block mb-1.5">DESCRIÇÃO (opcional)</label>
            <input value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
              placeholder="Ex: Desconto de boas-vindas"
              className="w-full px-4 py-2.5 rounded-xl text-sm t-strong outline-none"
              style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-bold t-mut" style={{ background: 'var(--space-elev-2)' }}>Cancelar</button>
          <button type="submit" disabled={salvando}
            className="flex-1 py-3 rounded-xl text-sm font-black t-strong disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
            {salvando ? 'Salvando...' : 'Criar cupom'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Modal de Banner (redesign) ────────────────────────────────
const PALETAS = [
  { nome: 'Chama',    cor1: '#7c2d12', cor2: '#ea580c' },
  { nome: 'Sushi',    cor1: '#14532d', cor2: '#16a34a' },
  { nome: 'Oceano',   cor1: '#0c2a4a', cor2: '#0284c7' },
  { nome: 'Âmbar',    cor1: '#78350f', cor2: '#d97706' },
  { nome: 'Uva',      cor1: '#3b0764', cor2: '#7c3aed' },
  { nome: 'Rubi',     cor1: '#4c0519', cor2: '#e11d48' },
  { nome: 'Ardósia',  cor1: '#0f172a', cor2: '#334155' },
  { nome: 'Aurora',   cor1: '#1e1b4b', cor2: '#db2777' },
];
const TAGS_BANNER = [
  { label: '🔥 Promoção', cor: '#ea580c' },
  { label: '⭐ Destaque',  cor: '#ca8a04' },
  { label: '🚚 Frete Grátis', cor: '#0284c7' },
  { label: '✨ Novidade',  cor: '#7c3aed' },
  { label: '💚 Fidelidade', cor: '#16a34a' },
  { label: '🎉 Especial',  cor: '#db2777' },
];

function ModalBanner({ banner, onClose, onSalvo }) {
  const isNovo = !banner?.id;
  const [abaAtiva, setAbaAtiva] = useState('conteudo'); // conteudo | destaque | aparencia
  const [form, setForm] = useState({
    tag: banner?.tag || '🔥 Promoção',
    titulo: banner?.titulo || '',
    subtitulo: banner?.subtitulo || '',
    destaque: banner?.destaque || '',
    emoji: banner?.emoji || '🍣',
    cor1: banner?.cor1 || '#7c2d12',
    cor2: banner?.cor2 || '#ea580c',
    img: banner?.img || '',
    ordem: banner?.ordem || 0,
    item_id: banner?.item_id ?? null,
    usar_gradiente: banner?.usar_gradiente ? 1 : 0,
    opcoes_escolha: (() => { try { const v = banner?.opcoes_escolha ? (typeof banner.opcoes_escolha === 'string' ? JSON.parse(banner.opcoes_escolha) : banner.opcoes_escolha) : []; return Array.isArray(v) ? v : []; } catch { return []; } })(),
  });
  const [modoDestaque, setModoDestaque] = useState(
    (banner?.opcoes_escolha && (() => { try { const v = typeof banner.opcoes_escolha === 'string' ? JSON.parse(banner.opcoes_escolha) : banner.opcoes_escolha; return Array.isArray(v) && v.length > 0; } catch { return false; } })())
      ? 'multiplo' : 'simples'
  );
  const [fotoFile, setFotoFile] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(banner?.img || null);
  const [usarGradiente, setUsarGradiente] = useState(banner?.usar_gradiente ? true : !banner?.img);
  const [salvando, setSalvando] = useState(false);
  const inputFotoRef = useRef(null);
  const [itensCardapio, setItensCardapio] = useState([]);
  const [categoriasCardapio, setCategoriasCardapio] = useState([]);

  useEffect(() => {
    fetch(`${BASE}/cardapio`)
      .then(r => r.json())
      .then(cats => {
        setCategoriasCardapio(cats);
        setItensCardapio(cats.flatMap(c => (c.itens || []).map(i => ({ ...i, _cat: c.nome }))));
      })
      .catch(() => {});
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function onFotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error('Imagem muito grande (máx 5MB)');
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  }

  async function removerFoto() {
    if (!banner?.id) { setFotoFile(null); setFotoPreview(null); set('img', ''); return; }
    try {
      await fetch(`${BASE}/ia/banners/${banner.id}/foto`, { method: 'DELETE', headers: authH() });
      setFotoPreview(null); setFotoFile(null); set('img', '');
      toast.success('Imagem removida');
    } catch { toast.error('Erro ao remover imagem'); }
  }

  function adicionarOpcao() {
    set('opcoes_escolha', [...(form.opcoes_escolha || []), '']);
  }
  function removerOpcao(idx) {
    set('opcoes_escolha', (form.opcoes_escolha || []).filter((_, i) => i !== idx));
  }
  function setOpcao(idx, val) {
    const arr = [...(form.opcoes_escolha || [])];
    arr[idx] = val;
    set('opcoes_escolha', arr);
  }

  async function salvar() {
    if (!form.titulo.trim()) return toast.error('Título obrigatório');
    setSalvando(true);
    try {
      const payload = {
        ...form,
        opcoes_escolha: modoDestaque === 'multiplo'
          ? (form.opcoes_escolha || []).filter(Boolean)
          : [],
      };
      const url = isNovo ? `${BASE}/ia/banners` : `${BASE}/ia/banners/${banner.id}`;
      const r = await fetch(url, { method: isNovo ? 'POST' : 'PUT', headers: authJ(), body: JSON.stringify(payload) });
      if (!r.ok) { const d = await r.json(); throw new Error(d.erro || `HTTP ${r.status}`); }
      const salvo = await r.json();
      const bannerId = salvo.id || banner?.id;
      if (fotoFile && bannerId) {
        const fd = new FormData();
        fd.append('foto', fotoFile);
        const fRes = await fetch(`${BASE}/ia/banners/${bannerId}/foto`, {
          method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd,
        });
        if (!fRes.ok) toast.error('Banner salvo mas falha no upload da imagem');
      }
      toast.success(isNovo ? 'Banner criado!' : 'Banner salvo!');
      onSalvo();
    } catch (e) { toast.error(e.message); }
    setSalvando(false);
  }

  // Preview fiel ao layout real do carrossel
  const bgPreview = fotoPreview
    ? { backgroundImage: `url(${fotoPreview})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: `linear-gradient(110deg,${form.cor1}ff 0%,${form.cor2}cc 60%,${form.cor2}88 100%)` };

  const opcoesAtivas = (form.opcoes_escolha || []).filter(Boolean);
  const destaqueTexto = modoDestaque === 'multiplo'
    ? (opcoesAtivas.length ? opcoesAtivas[0] : '')
    : form.destaque;

  const ABAS = [
    { k: 'conteudo', label: 'Conteúdo' },
    { k: 'destaque', label: 'Prêmio' },
    { k: 'aparencia', label: 'Visual' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden" style={{ background: 'var(--space-elev)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '95vh', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}>

        {/* Header */}
        <div className="px-5 py-3.5 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(var(--accent-rgb),0.15)' }}>
              {isNovo ? <ImagePlus size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} /> : <Pencil size={14} strokeWidth={2} style={{ color: 'var(--accent)' }} />}
            </div>
            <div>
              <p className="font-black t-strong text-sm">{isNovo ? 'Novo Banner' : 'Editar Banner'}</p>
              <p className="text-[10px] t-faint">Carrossel da página do cliente</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg t-dim transition-colors hover:bg-white/5">
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Preview em tempo real */}
        <div className="mx-4 mt-4 rounded-xl overflow-hidden relative shrink-0" style={{ height: 130, ...bgPreview }}>
          {/* Sombra escura de baixo */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)' }} />
          {/* Gradiente sobre imagem (opcional) */}
          {fotoPreview && usarGradiente && (
            <div className="absolute inset-0" style={{ background: `linear-gradient(110deg,${form.cor1}cc 0%,${form.cor2}88 60%,transparent 100%)` }} />
          )}
          {/* Topo: tag + badge */}
          <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-3.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)' }}>
              {form.tag}
            </span>
            {destaqueTexto && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-black text-white"
                style={{ background: 'rgba(var(--accent-rgb),0.92)', boxShadow: '0 2px 12px rgba(var(--accent-rgb),0.5)' }}>
                {destaqueTexto}
              </span>
            )}
          </div>
          {/* Base: título + subtítulo */}
          <div className="absolute bottom-0 left-0 right-0 p-3.5">
            <p className="text-white font-black text-base leading-tight" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
              {form.titulo || <span style={{ opacity: 0.4 }}>Título do banner</span>}
            </p>
            {form.subtitulo && (
              <p className="text-white/75 text-xs mt-0.5 leading-snug" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>{form.subtitulo}</p>
            )}
            {modoDestaque === 'multiplo' && opcoesAtivas.length > 1 && (
              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                {opcoesAtivas.map((op, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(8px)' }}>{op}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Abas */}
        <div className="flex mx-4 mt-3 gap-1 shrink-0 rounded-xl p-1" style={{ background: 'var(--space-elev-2)' }}>
          {ABAS.map(a => (
            <button key={a.k} onClick={() => setAbaAtiva(a.k)}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={abaAtiva === a.k
                ? { background: 'rgba(var(--accent-rgb),0.18)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.3)' }
                : { color: 'var(--t-dim)', border: '1px solid transparent' }}>
              {a.label}
            </button>
          ))}
        </div>

        {/* Conteúdo scrollável */}
        <div className="overflow-y-auto flex-1 px-4 py-4 space-y-4">

          {/* ── ABA CONTEÚDO ── */}
          {abaAtiva === 'conteudo' && (<>
            {/* Tag */}
            <div>
              <p className="text-[10px] font-black t-dim tracking-widest mb-2">CATEGORIA / TAG</p>
              <div className="flex flex-wrap gap-1.5">
                {TAGS_BANNER.map(t => (
                  <button key={t.label} onClick={() => set('tag', t.label)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={form.tag === t.label
                      ? { background: `${t.cor}22`, color: t.cor, border: `1px solid ${t.cor}55` }
                      : { background: 'var(--space-elev-2)', color: 'var(--t-dim)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Título */}
            <div>
              <p className="text-[10px] font-black t-dim tracking-widest mb-1.5">TÍTULO *</p>
              <input value={form.titulo} onChange={e => set('titulo', e.target.value)}
                placeholder="Ex: Clube Sushi Lover Rumo ao Hexa"
                className="w-full px-3 py-2.5 rounded-xl text-sm font-bold t-strong outline-none"
                style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.06)' }}
                onFocus={e => e.target.style.borderColor = 'rgba(var(--accent-rgb),0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'} />
            </div>

            {/* Subtítulo */}
            <div>
              <p className="text-[10px] font-black t-dim tracking-widest mb-1.5">SUBTÍTULO</p>
              <textarea value={form.subtitulo} onChange={e => set('subtitulo', e.target.value)}
                placeholder="Descrição curta da promoção (aparece abaixo do título)"
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl text-sm t-strong outline-none resize-none"
                style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.06)' }}
                onFocus={e => e.target.style.borderColor = 'rgba(var(--accent-rgb),0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'} />
            </div>
          </>)}

          {/* ── ABA DESTAQUE / PRÊMIO ── */}
          {abaAtiva === 'destaque' && (<>
            {/* Modo: simples vs múltiplos */}
            <div className="rounded-xl p-1 flex gap-1" style={{ background: 'var(--space-elev-2)' }}>
              <button onClick={() => setModoDestaque('simples')}
                className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                style={modoDestaque === 'simples'
                  ? { background: 'rgba(var(--accent-rgb),0.18)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.3)' }
                  : { color: 'var(--t-dim)', border: '1px solid transparent' }}>
                Destaque único
              </button>
              <button onClick={() => setModoDestaque('multiplo')}
                className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                style={modoDestaque === 'multiplo'
                  ? { background: 'rgba(var(--accent-rgb),0.18)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.3)' }
                  : { color: 'var(--t-dim)', border: '1px solid transparent' }}>
                Cliente escolhe
              </button>
            </div>

            {modoDestaque === 'simples' && (
              <div className="space-y-2">
                <p className="text-[10px] font-black t-dim tracking-widest">ITEM DO CARDÁPIO</p>
                <SelectCardapio itens={itensCardapio} value={form.destaque}
                  placeholder="— selecionar item do cardápio —"
                  onChange={item => { set('item_id', item?.id ?? null); set('destaque', item?.nome ?? ''); }} />
                <p className="text-[10px] t-faint text-center">ou</p>
                <input value={form.destaque}
                  onChange={e => { set('destaque', e.target.value); set('item_id', null); }}
                  placeholder="Texto livre: ex. Combo Hot 20 peças"
                  className="w-full px-3 py-2.5 rounded-xl text-sm t-strong outline-none"
                  style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.06)' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(var(--accent-rgb),0.5)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'} />
              </div>
            )}

            {modoDestaque === 'multiplo' && (<>
              <div className="rounded-xl p-3 text-xs" style={{ background: 'rgba(var(--accent-rgb),0.06)', border: '1px solid rgba(var(--accent-rgb),0.15)' }}>
                <p className="font-bold" style={{ color: 'var(--accent)' }}>Como funciona</p>
                <p className="t-dim mt-0.5">O cliente verá as opções no banner e pode escolher ao resgatar. Aparecem como pílulas abaixo do título.</p>
              </div>

              {/* Organizado por categoria */}
              <div className="space-y-2">
                {(form.opcoes_escolha || []).map((op, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1">
                      <SelectCardapio itens={itensCardapio} value={op}
                        placeholder={`Opção ${idx + 1} — selecionar item`}
                        onChange={item => setOpcao(idx, item?.nome ?? '')} />
                      <input value={op} onChange={e => setOpcao(idx, e.target.value)}
                        placeholder="Ou digitar manualmente..."
                        className="w-full px-3 py-2 rounded-xl text-xs t-strong outline-none"
                        style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.05)' }} />
                    </div>
                    <button onClick={() => removerOpcao(idx)}
                      className="mt-1 w-8 h-8 flex items-center justify-center rounded-lg shrink-0"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={adicionarOpcao}
                className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                style={{ background: 'rgba(var(--accent-rgb),0.06)', border: '1px dashed rgba(var(--accent-rgb),0.3)', color: 'var(--accent)' }}>
                <Plus size={13} /> Adicionar opção
              </button>
            </>)}
          </>)}

          {/* ── ABA APARÊNCIA ── */}
          {abaAtiva === 'aparencia' && (<>
            {/* Imagem */}
            <div>
              <p className="text-[10px] font-black t-dim tracking-widest mb-2">IMAGEM DE FUNDO</p>
              {fotoPreview ? (
                <div className="rounded-xl overflow-hidden relative" style={{ height: 80 }}>
                  <img src={fotoPreview} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center gap-2"
                    style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                    <button onClick={() => inputFotoRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                      style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                      <Upload size={12} /> Trocar
                    </button>
                    <button onClick={removerFoto}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
                      style={{ background: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                      <Trash2 size={12} /> Remover
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => inputFotoRef.current?.click()}
                  className="w-full py-4 rounded-xl flex flex-col items-center gap-2 transition-colors"
                  style={{ background: 'var(--space-elev-2)', border: '2px dashed rgba(255,255,255,0.08)', color: 'var(--t-dim)' }}>
                  <ImagePlus size={22} strokeWidth={1.5} />
                  <span className="text-xs font-bold">Adicionar imagem de fundo</span>
                  <span className="text-[10px] t-faint">JPG, PNG ou WebP · máx 5MB</span>
                </button>
              )}
              <input ref={inputFotoRef} type="file" accept="image/*" className="hidden" onChange={onFotoChange} />
            </div>

            {/* Paletas de cor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black t-dim tracking-widest">
                  {fotoPreview ? 'GRADIENTE SOBRE IMAGEM' : 'PALETA DE CORES'}
                </p>
                {fotoPreview && (
                  <button onClick={() => { const v = !usarGradiente; setUsarGradiente(v); set('usar_gradiente', v ? 1 : 0); }}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-all"
                    style={usarGradiente
                      ? { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)' }
                      : { background: 'var(--space-elev-2)', color: 'var(--t-dim)' }}>
                    <div className="w-6 h-3.5 rounded-full relative" style={{ background: usarGradiente ? 'var(--accent)' : '#444' }}>
                      <div className="w-2.5 h-2.5 bg-white rounded-full absolute top-0.5 transition-all" style={{ left: usarGradiente ? '11px' : '1px' }} />
                    </div>
                    {usarGradiente ? 'Ativo' : 'Off'}
                  </button>
                )}
              </div>

              {(!fotoPreview || usarGradiente) && (<>
                {/* Paletas pré-definidas */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {PALETAS.map(p => (
                    <button key={p.nome} onClick={() => { set('cor1', p.cor1); set('cor2', p.cor2); }}
                      className="rounded-xl overflow-hidden transition-all flex flex-col"
                      style={{
                        height: 44,
                        background: `linear-gradient(135deg, ${p.cor1}, ${p.cor2})`,
                        border: form.cor1 === p.cor1 ? '2px solid #fff' : '2px solid transparent',
                        boxShadow: form.cor1 === p.cor1 ? '0 0 0 1px rgba(255,255,255,0.2)' : 'none',
                      }}>
                      <span className="text-[9px] font-bold text-white/80 mt-auto mb-1 mx-auto">{p.nome}</span>
                    </button>
                  ))}
                </div>
                {/* Ajuste fino */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--space-elev-2)' }}>
                    <input type="color" value={form.cor1} onChange={e => set('cor1', e.target.value)}
                      className="w-8 h-7 rounded-lg cursor-pointer border-0 p-0.5 shrink-0" style={{ background: 'transparent' }} />
                    <div>
                      <p className="text-[9px] t-faint">ESQUERDA</p>
                      <p className="text-[10px] t-dim font-mono">{form.cor1}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--space-elev-2)' }}>
                    <input type="color" value={form.cor2} onChange={e => set('cor2', e.target.value)}
                      className="w-8 h-7 rounded-lg cursor-pointer border-0 p-0.5 shrink-0" style={{ background: 'transparent' }} />
                    <div>
                      <p className="text-[9px] t-faint">DIREITA</p>
                      <p className="text-[10px] t-dim font-mono">{form.cor2}</p>
                    </div>
                  </div>
                </div>
              </>)}
            </div>

            {/* Emoji */}
            <div>
              <p className="text-[10px] font-black t-dim tracking-widest mb-2">EMOJI DO BANNER</p>
              <div className="flex flex-wrap gap-1.5">
                {['🍣','🔥','🎉','⭐','🚚','🦐','🐟','🥑','🍱','💚','✨','🎋','🏆','🎯','🌊','🎊','🎁','🤩'].map(e => (
                  <button key={e} onClick={() => set('emoji', e)}
                    className="w-9 h-9 flex items-center justify-center rounded-xl text-lg transition-all"
                    style={form.emoji === e
                      ? { background: 'rgba(var(--accent-rgb),0.2)', border: '1.5px solid rgba(var(--accent-rgb),0.5)' }
                      : { background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </>)}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4 pt-3 flex gap-2 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold t-dim transition-colors hover:bg-white/5"
            style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.05)' }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando}
            className="flex-1 py-2.5 rounded-xl text-sm font-black t-strong disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))' }}>
            {salvando ? <><Loader2 size={15} className="animate-spin" /> Salvando…</> : <><Save size={15} strokeWidth={2} /> Salvar Banner</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal: criar item no cardápio a partir de um banner ───────
function ModalCriarItemDeBanner({ banner, categorias, onClose, onSalvo }) {
  const [nome, setNome] = useState(banner.titulo || '');
  const [descricao, setDescricao] = useState(banner.subtitulo || '');
  const [preco, setPreco] = useState(
    banner.destaque ? banner.destaque.replace(/[^0-9,]/g, '').replace(',', '.') : ''
  );
  const [emoji, setEmoji] = useState(banner.emoji || '🍱');
  const [catId, setCatId] = useState(categorias[0]?.id || '');
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return toast.error('Nome obrigatório');
    if (!preco || isNaN(Number(preco))) return toast.error('Preço inválido');
    if (!catId) return toast.error('Selecione uma categoria');
    setSalvando(true);
    try {
      const r = await fetch(`${BASE}/cardapio/itens`, {
        method: 'POST',
        headers: { ...authH(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), descricao: descricao.trim(), preco: Number(preco), emoji, categoria_id: Number(catId) }),
      });
      if (!r.ok) throw new Error((await r.json()).erro || 'Erro');

      const item = await r.json();

      // Vincula o item criado ao banner
      await fetch(`${BASE}/ia/banners/${banner.id}/item`, {
        method: 'PATCH',
        headers: { ...authH(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: item.id }),
      });

      // Se o banner tem imagem, copia para o item criado
      if (banner.img && item.id) {
        // Busca a imagem do banner e faz upload para o item
        try {
          const imgResp = await fetch(banner.img);
          const blob = await imgResp.blob();
          const fd = new FormData();
          fd.append('foto', blob, 'foto.jpg');
          await fetch(`${BASE}/cardapio/itens/${item.id}/foto`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
        } catch {}
      }

      onSalvo();
    } catch (e) { toast.error(e.message); }
    finally { setSalvando(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--space-elev-2)' }}>
          <div>
            <h3 className="font-black t-strong">Criar no Cardápio</h3>
            <p className="text-xs t-dim mt-0.5">O item ficará visível para os clientes</p>
          </div>
          <button onClick={onClose} className="t-dim hover:t-strong flex items-center"><X size={20} strokeWidth={1.75} /></button>
        </div>

        {/* Preview do banner */}
        <div className="mx-5 mt-4 p-3 rounded-xl flex items-center gap-3" style={{ background: `linear-gradient(135deg,${banner.cor1},${banner.cor2})` }}>
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shrink-0"
            style={{ background: 'rgba(0,0,0,0.2)' }}>
            {banner.img ? <img src={banner.img} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">{banner.emoji}</span>}
          </div>
          <div>
            <p className="t-strong font-black text-sm leading-none">{banner.titulo}</p>
            <p className="t-strong/70 text-xs mt-0.5">{banner.subtitulo}</p>
          </div>
          {banner.destaque && <span className="ml-auto t-strong font-black text-sm">{banner.destaque}</span>}
        </div>

        {/* Formulário */}
        <div className="p-5 space-y-3">
          <div className="flex gap-2">
            <input value={emoji} onChange={e => setEmoji(e.target.value)}
              className="w-14 text-center px-2 py-2.5 rounded-xl text-xl outline-none"
              style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: 'var(--txt-strong)' }} />
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do item"
              className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: 'var(--txt-strong)' }} />
          </div>

          <textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição (opcional)"
            rows={2} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
            style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: 'var(--txt-strong)' }} />

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] t-dim font-bold uppercase tracking-wider block mb-1">Preço (R$)</label>
              <input value={preco} onChange={e => setPreco(e.target.value)} placeholder="0.00" type="number" step="0.01"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none font-black"
                style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: 'var(--accent)' }} />
            </div>
            <div className="flex-1">
              <label className="text-[10px] t-dim font-bold uppercase tracking-wider block mb-1">Categoria</label>
              <select value={catId} onChange={e => setCatId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: 'var(--txt-strong)' }}>
                {categorias.flatMap(c => c.itens !== undefined ? [c] : []).length === 0
                  ? categorias.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nome}</option>)
                  : categorias.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nome}</option>)
                }
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-bold"
              style={{ background: 'var(--space-elev-2)', color: '#555' }}>Cancelar</button>
            <button onClick={salvar} disabled={salvando}
              className="flex-1 py-2.5 rounded-xl text-sm font-black t-strong"
              style={{ background: salvando ? '#333' : 'linear-gradient(135deg,var(--accent),#ea580c)' }}>
              {salvando ? 'Criando...' : <span className="flex items-center justify-center gap-1.5"><Check size={15} strokeWidth={2.5} /> Criar no cardápio</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Modal Ficha Técnica do item do cardápio ───────────────────
function ModalFichaTecnica({ item, onClose }) {
  const [aba, setAba] = useState('ingredientes');

  // Aba Ingredientes
  const [ficha, setFicha] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [novoIngId, setNovoIngId] = useState('');
  const [novoQtd, setNovoQtd] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');

  // Aba Composição
  const [composicao, setComposicao] = useState([]);
  const [todosItens, setTodosItens] = useState([]);
  const [novoFilhoId, setNovoFilhoId] = useState('');
  const [novoFilhoQtd, setNovoFilhoQtd] = useState('1');
  const [salvandoComp, setSalvandoComp] = useState(false);
  const [buscaComp, setBuscaComp] = useState('');

  const recarregarFicha = () =>
    fetch(`${BASE}/dashboard/ficha/${item.id}`, { headers: authH() })
      .then(r => r.json()).then(f => setFicha(Array.isArray(f) ? f : []));

  const recarregarComposicao = () =>
    fetch(`${BASE}/dashboard/composicao/${item.id}`, { headers: authH() })
      .then(r => r.json()).then(c => setComposicao(Array.isArray(c) ? c : []));

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/dashboard/ficha/${item.id}`, { headers: authH() }).then(r => r.json()),
      fetch(`${BASE}/ingredientes`, { headers: authH() }).then(r => r.json()),
      fetch(`${BASE}/dashboard/composicao/${item.id}`, { headers: authH() }).then(r => r.json()),
      fetch(`${BASE}/cardapio/itens`, { headers: authH() }).then(r => r.json()),
    ]).then(([f, i, c, todos]) => {
      setFicha(Array.isArray(f) ? f : []);
      setIngredientes(Array.isArray(i) ? i : []);
      setComposicao(Array.isArray(c) ? c : []);
      setTodosItens(Array.isArray(todos) ? todos.filter(x => x.id !== item.id) : []);
    }).catch(() => toast.error('Erro ao carregar')).finally(() => setLoading(false));
  }, [item.id]);

  // Ingredientes handlers
  const ingFiltrados = ingredientes.filter(i =>
    !busca || i.nome.toLowerCase().includes(busca.toLowerCase())
  ).slice(0, 30);

  async function adicionarIng() {
    if (!novoIngId || !novoQtd) return toast.error('Selecione o ingrediente e quantidade');
    setSalvando(true);
    try {
      const r = await fetch(`${BASE}/dashboard/ficha`, {
        method: 'POST', headers: authJ(),
        body: JSON.stringify({ cardapio_item_id: item.id, ingrediente_id: Number(novoIngId), quantidade: Number(novoQtd) }),
      });
      if (!r.ok) throw new Error((await r.json()).erro || 'Erro');
      await recarregarFicha();
      setNovoIngId(''); setNovoQtd(''); setBusca('');
      toast.success('Ingrediente adicionado!');
    } catch (e) { toast.error(e.message); }
    setSalvando(false);
  }

  async function removerIng(id) {
    await fetch(`${BASE}/dashboard/ficha/${id}`, { method: 'DELETE', headers: authH() });
    setFicha(f => f.filter(x => x.id !== id));
    toast.success('Removido');
  }

  // Composição handlers
  const itensFiltrados = todosItens
    .filter(i => !buscaComp || i.nome.toLowerCase().includes(buscaComp.toLowerCase()))
    .filter(i => !composicao.some(c => c.item_filho_id === i.id));

  async function adicionarFilho() {
    if (!novoFilhoId || !novoFilhoQtd) return toast.error('Selecione o item e a quantidade');
    setSalvandoComp(true);
    try {
      const r = await fetch(`${BASE}/dashboard/composicao`, {
        method: 'POST', headers: authJ(),
        body: JSON.stringify({ item_pai_id: item.id, item_filho_id: Number(novoFilhoId), quantidade: Number(novoFilhoQtd) }),
      });
      if (!r.ok) throw new Error((await r.json()).erro || 'Erro');
      await recarregarComposicao();
      setNovoFilhoId(''); setNovoFilhoQtd('1'); setBuscaComp('');
      toast.success('Item adicionado ao combo!');
    } catch (e) { toast.error(e.message); }
    setSalvandoComp(false);
  }

  async function removerFilho(id) {
    await fetch(`${BASE}/dashboard/composicao/${id}`, { method: 'DELETE', headers: authH() });
    setComposicao(c => c.filter(x => x.id !== id));
    toast.success('Removido do combo');
  }

  // Cálculos
  const custoIngredientes = ficha.reduce((s, f) => s + (f.quantidade * (f.custo_unitario || 0)), 0);
  const custoComposicao = composicao.reduce((s, c) => s + (c.custo_total || 0), 0);
  const custoTotal = custoIngredientes + custoComposicao;
  const cmv = item.preco > 0 ? (custoTotal / item.preco) * 100 : 0;
  const cmvCor = cmv === 0 ? '#555' : cmv <= 30 ? '#10b981' : cmv <= 45 ? 'var(--accent-2)' : '#ef4444';
  const ingSelecionado = ingredientes.find(i => i.id === Number(novoIngId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[90vh]" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--space-elev-2)' }}>
          <div>
            <h3 className="font-black t-strong flex items-center gap-2"><FileText size={17} strokeWidth={1.75} /> Ficha Técnica</h3>
            <p className="text-xs t-dim mt-0.5">{item.nome} · {Number(item.preco).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl t-dim" style={{ background: 'var(--space-elev-2)' }}><X size={18} strokeWidth={1.75} /></button>
        </div>

        {/* KPI custo */}
        <div className="px-5 py-3 flex gap-4 shrink-0" style={{ borderBottom: '1px solid var(--space-elev-2)' }}>
          <div>
            <p className="text-[10px] t-dim uppercase tracking-wider">Custo total</p>
            <p className="font-black t-strong">{custoTotal.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
          </div>
          <div>
            <p className="text-[10px] t-dim uppercase tracking-wider">CMV</p>
            <p className="font-black text-xl" style={{ color: cmvCor }}>{cmv === 0 ? '—' : `${cmv.toFixed(1)}%`}</p>
          </div>
          <div>
            <p className="text-[10px] t-dim uppercase tracking-wider">Margem</p>
            <p className="font-black" style={{ color: item.preco - custoTotal >= 0 ? '#10b981' : '#ef4444' }}>
              {(item.preco - custoTotal).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
            </p>
          </div>
          {cmv > 0 && (
            <div className="flex-1 flex items-end pb-0.5">
              <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--space-elev-2)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(cmv,100)}%`, background: cmvCor }} />
              </div>
            </div>
          )}
        </div>

        {/* Abas */}
        <div className="flex gap-2 px-5 pt-3 shrink-0">
          {[
            { key: 'ingredientes', label: 'Ingredientes', count: ficha.length },
            { key: 'composicao', label: 'Composição / Combo', count: composicao.length },
          ].map(({ key, label, count }) => (
            <button key={key} onClick={() => setAba(key)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={aba === key
                ? { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.35)' }
                : { background: 'var(--space-elev-2)', color: 'var(--txt-dim)', border: '1px solid transparent' }}>
              {label}{count > 0 ? ` (${count})` : ''}
            </button>
          ))}
        </div>

        {/* ABA INGREDIENTES */}
        {aba === 'ingredientes' && (
          <>
            <div className="flex-1 overflow-y-auto mt-2">
              {loading ? (
                <div className="flex items-center justify-center py-8 t-dim text-sm">Carregando...</div>
              ) : ficha.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 t-faint text-sm gap-2">
                  <ClipboardList size={28} strokeWidth={1.5} />
                  <span>Nenhum ingrediente direto</span>
                  <span className="text-xs t-faint text-center px-6">Use a aba "Composição" para referenciar outros itens (ex: Hot Roll, Temaki)</span>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--space-elev-2)' }}>
                  {ficha.map(f => (
                    <div key={f.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold t-strong">{f.ingrediente_nome}</p>
                        <p className="text-xs t-dim">{f.quantidade} {f.unidade_medida} · custo: {(f.quantidade * f.custo_unitario).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</p>
                      </div>
                      <p className="text-xs t-dim shrink-0">{Number(f.custo_unitario).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}/{f.unidade_medida}</p>
                      <button onClick={() => removerIng(f.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
                        style={{ color: '#555' }}
                        onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.15)'; e.currentTarget.style.color='#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#555'; }}>
                        <X size={15} strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-4 space-y-3 shrink-0" style={{ borderTop: '1px solid var(--space-elev-2)' }}>
              <p className="text-xs t-dim font-bold uppercase tracking-wider">+ Adicionar ingrediente direto</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar ingrediente..."
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none mb-1"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: 'var(--txt-strong)' }} />
                  <select value={novoIngId} onChange={e => setNovoIngId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: novoIngId ? '#fff' : '#555' }}>
                    <option value="">Selecionar...</option>
                    {ingFiltrados.map(i => (
                      <option key={i.id} value={i.id}>{i.nome} ({i.unidade_medida}) — {Number(i.custo_unitario).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</option>
                    ))}
                  </select>
                </div>
                <div className="w-24 shrink-0">
                  <p className="text-[10px] t-dim mb-1">{ingSelecionado ? ingSelecionado.unidade_medida : 'Qtd'}</p>
                  <input type="number" value={novoQtd} onChange={e => setNovoQtd(e.target.value)} placeholder="0" step="0.001" min="0"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none font-black"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: '#10b981' }} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-bold"
                  style={{ background: 'var(--space-elev-2)', color: '#555' }}>Fechar</button>
                <button onClick={adicionarIng} disabled={salvando || !novoIngId || !novoQtd}
                  className="flex-1 py-2 rounded-xl text-sm font-black t-strong disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))' }}>
                  {salvando ? 'Salvando...' : '+ Adicionar'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ABA COMPOSIÇÃO */}
        {aba === 'composicao' && (
          <>
            <div className="flex-1 overflow-y-auto mt-2">
              {loading ? (
                <div className="flex items-center justify-center py-8 t-dim text-sm">Carregando...</div>
              ) : composicao.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 t-faint text-sm gap-2">
                  <Link2 size={28} strokeWidth={1.5} />
                  <span className="font-bold">Nenhum item no combo ainda</span>
                  <span className="text-xs t-faint text-center px-6">
                    Adicione itens do cardápio que já têm ficha técnica.<br/>
                    Ex: 1× Hot Roll + 1× Temaki = Combo Duplo.<br/>
                    O custo é calculado automaticamente.
                  </span>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--space-elev-2)' }}>
                  {composicao.map(c => (
                    <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(var(--accent-rgb),0.1)' }}>
                        <IconePrato chave={c.filho_emoji || 'utensils'} size={16} style={{ color: 'var(--accent)' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold t-strong">{c.filho_nome}</p>
                        <p className="text-xs t-dim">
                          {c.quantidade}× · custo/un: {Number(c.custo_unit || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                          {' · '}subtotal: <span className="font-bold" style={{ color: 'var(--accent)' }}>{Number(c.custo_total || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
                        </p>
                      </div>
                      <span className="text-xs shrink-0 font-bold" style={{ color: 'var(--txt-dim)' }}>
                        venda: {Number(c.filho_preco || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                      </span>
                      <button onClick={() => removerFilho(c.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
                        style={{ color: '#555' }}
                        onMouseEnter={e => { e.currentTarget.style.background='rgba(239,68,68,0.15)'; e.currentTarget.style.color='#ef4444'; }}
                        onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#555'; }}>
                        <X size={15} strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                  <div className="px-5 py-3 flex items-center justify-between"
                    style={{ background: 'rgba(var(--accent-rgb),0.04)' }}>
                    <span className="text-xs t-dim font-bold">Custo total da composição</span>
                    <span className="font-black" style={{ color: 'var(--accent)' }}>
                      {custoComposicao.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="px-5 py-4 space-y-3 shrink-0" style={{ borderTop: '1px solid var(--space-elev-2)' }}>
              <p className="text-xs t-dim font-bold uppercase tracking-wider">+ Adicionar item ao combo</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input value={buscaComp} onChange={e => setBuscaComp(e.target.value)} placeholder="Buscar item do cardápio..."
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none mb-1"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: 'var(--txt-strong)' }} />
                  <select value={novoFilhoId} onChange={e => setNovoFilhoId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: novoFilhoId ? '#fff' : '#555' }}>
                    <option value="">Selecionar item...</option>
                    {itensFiltrados.map(i => (
                      <option key={i.id} value={i.id}>{i.nome} — {Number(i.preco).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</option>
                    ))}
                  </select>
                </div>
                <div className="w-20 shrink-0">
                  <p className="text-[10px] t-dim mb-1">Qtd</p>
                  <input type="number" value={novoFilhoQtd} onChange={e => setNovoFilhoQtd(e.target.value)}
                    placeholder="1" step="0.5" min="0.5"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none font-black"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: 'var(--accent)' }} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 py-2 rounded-xl text-sm font-bold"
                  style={{ background: 'var(--space-elev-2)', color: '#555' }}>Fechar</button>
                <button onClick={adicionarFilho} disabled={salvandoComp || !novoFilhoId || !novoFilhoQtd}
                  className="flex-1 py-2 rounded-xl text-sm font-black t-strong disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))' }}>
                  {salvandoComp ? 'Salvando...' : '+ Adicionar ao combo'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Modal Criar Promoção a partir de sugestão IA ──────────────
function ModalCriarPromocao({ sugestao, onClose, onSalvo }) {
  const authJ = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });
  const [form, setForm] = useState({
    nome: sugestao?.titulo || '',
    descricao: sugestao?.descricao || '',
    tipo: 'pedidos',
    meta: 5,
    recompensa: '',
    emoji: sugestao?.emoji || '🎁',
  });
  const [salvando, setSalvando] = useState(false);
  const [itensCardapio, setItensCardapio] = useState([]);
  const [recompensas, setRecompensas] = useState(['']);
  useEffect(() => {
    fetch(`${BASE}/cardapio`)
      .then(r => r.json())
      .then(cats => setItensCardapio(cats.flatMap(c => (c.itens || []).map(i => ({ ...i, _cat: c.nome })))))
      .catch(() => {});
  }, []);

  function atualizarRecompensa(lista) {
    setRecompensas(lista);
    setForm(p => ({ ...p, recompensa: lista.filter(Boolean).join(' + ') }));
  }

  async function salvar() {
    if (!form.nome.trim()) return toast.error('Nome é obrigatório');
    setSalvando(true);
    try {
      const r = await fetch(`${BASE}/promocoes`, {
        method: 'POST', headers: authJ(),
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro');
      toast.success('🎯 Promoção criada com sucesso!');
      onSalvo(d);
    } catch (e) { toast.error(e.message); }
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden" style={{ background: 'var(--space-elev)', border: '1px solid var(--space-elev-2)' }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--space-elev-2)' }}>
          <div>
            <p className="font-black t-strong flex items-center gap-2"><Target size={17} strokeWidth={1.75} /> Criar Promoção de Fidelidade</p>
            <p className="text-xs t-dim mt-0.5">Será rastreada no cadastro de cada cliente</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ background: 'var(--space-elev-2)', color: '#666' }}><X size={18} strokeWidth={1.75} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Preview sugestão */}
          {sugestao && (
            <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <span className="text-2xl">{sugestao.emoji || '🎯'}</span>
              <div className="min-w-0">
                <p className="text-sm font-bold t-strong truncate">{sugestao.titulo}</p>
                <p className="text-xs t-dim truncate">{sugestao.descricao}</p>
              </div>
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="text-[10px] t-dim font-bold tracking-widest mb-1.5 block">NOME DA PROMOÇÃO</label>
            <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
              placeholder="Ex: Clube Sushi Lover"
              className="w-full px-3 py-2.5 rounded-xl text-sm font-bold t-strong outline-none"
              style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.08)' }}
              onFocus={e => e.target.style.borderColor = '#10b981'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
          </div>

          {/* Tipo + Meta */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] t-dim font-bold tracking-widest mb-1.5 block">TIPO</label>
              <select value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-bold t-strong outline-none"
                style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <option value="pedidos">Por pedidos</option>
                <option value="valor">Por valor gasto</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] t-dim font-bold tracking-widest mb-1.5 block">
                META ({form.tipo === 'pedidos' ? 'pedidos' : 'R$'})
              </label>
              <input type="number" value={form.meta} onChange={e => setForm(p => ({ ...p, meta: Number(e.target.value) }))}
                min={1} max={100}
                className="w-full px-3 py-2.5 rounded-xl text-sm font-bold t-strong outline-none"
                style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                onFocus={e => e.target.style.borderColor = '#10b981'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
            </div>
          </div>

          {/* Recompensa multi-item */}
          <div>
            <label className="text-[10px] t-dim font-bold tracking-widest mb-1.5 block">RECOMPENSA / PRÊMIO</label>
            <div className="space-y-2">
              {recompensas.map((rec, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <div className="flex-1">
                    {itensCardapio.length > 0 && (
                      <SelectCardapio itens={itensCardapio} value={rec}
                        placeholder="— escolher do cardápio —"
                        onChange={item => {
                          const lista = [...recompensas];
                          lista[idx] = item ? `1 ${item.nome} grátis` : '';
                          atualizarRecompensa(lista);
                        }} />
                    )}
                    <input value={rec}
                      onChange={e => { const l = [...recompensas]; l[idx] = e.target.value; atualizarRecompensa(l); }}
                      placeholder="Ou digite: 1 Temaki grátis…"
                      className="w-full px-3 py-2 rounded-xl text-sm t-strong outline-none mt-1"
                      style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(16,185,129,0.3)' }} />
                  </div>
                  {recompensas.length > 1 && (
                    <button type="button" onClick={() => atualizarRecompensa(recompensas.filter((_, i) => i !== idx))}
                      className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg"
                      style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={() => atualizarRecompensa([...recompensas, ''])}
              className="mt-2 w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px dashed rgba(16,185,129,0.3)', color: '#10b981' }}>
              <Plus size={13} /> Adicionar outro prêmio
            </button>
            {sugestao?.descricao && (
              <p className="text-xs t-faint mt-1.5 flex items-start gap-1">
                <span className="shrink-0">💡</span>
                <span>Sugestão: <em>"{sugestao.descricao}"</em></span>
              </p>
            )}
          </div>

          {/* Emoji */}
          <div>
            <label className="text-[10px] t-dim font-bold tracking-widest mb-1.5 block">EMOJI</label>
            <input value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))}
              className="w-28 px-3 py-2.5 rounded-xl text-sm t-strong outline-none text-center"
              style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.08)' }} />
          </div>

          {/* Aviso conflito com fidelidade básica */}
          {form.tipo === 'pedidos' && (
            <div className="rounded-xl p-3 flex gap-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <span className="shrink-0 text-base">⚠️</span>
              <p className="text-xs" style={{ color: '#fbbf24' }}>
                <strong>Plano básico pausado automaticamente.</strong> Enquanto esta promoção estiver ativa, o contador de "10 pedidos = recompensa" ficará congelado para não conflitar. Ele volta ao normal quando você desativar esta promoção.
              </p>
            </div>
          )}

          {/* Preview resumo */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)' }}>
            <p className="text-xs t-dim">
              <span className="text-green-400 font-bold">{form.emoji} {form.nome || '...'}</span>
              {' — '}a cada <span className="t-strong font-bold">{form.meta}</span> {form.tipo === 'pedidos' ? 'pedidos' : `R$ gastos`}
              {form.recompensa ? <span>, o cliente ganha: <span className="text-yellow-400 font-bold">{form.recompensa}</span></span> : ''}
            </p>
            <p className="text-[10px] t-faint mt-1">Os clientes serão inscritos automaticamente ao fazerem pedidos. O progresso é atualizado a cada entrega.</p>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: 'var(--space-elev-2)', color: '#666' }}>Cancelar</button>
          <button onClick={salvar} disabled={salvando || !form.nome.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-black t-strong disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}>
            {salvando ? <span className="flex items-center justify-center gap-1.5"><Loader2 size={15} strokeWidth={2} className="animate-spin" /> Criando...</span> : <span className="flex items-center justify-center gap-1.5"><Target size={15} strokeWidth={2} /> Criar promoção</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sortable: item de categoria na sidebar ────────────────────
function SortableCatItem({ cat, isActive, isOver, isDraggingItem, onClick, onEdit, onToggle }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `cat-${cat.id}` });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="group relative">
      {/* Highlight quando item é arrastado por cima */}
      {isOver && isDraggingItem && (
        <div className="absolute inset-0 rounded-xl pointer-events-none z-10"
          style={{ background: 'rgba(var(--accent-rgb),0.15)', border: '2px dashed rgba(var(--accent-rgb),0.6)' }} />
      )}
      <div className="flex items-center gap-1">
        {/* Handle de arrastar */}
        <button {...listeners} {...attributes}
          className="w-5 h-8 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing rounded"
          style={{ color: '#333', touchAction: 'none' }}>
          ⠿
        </button>
        <button onClick={onClick}
          className="flex-1 flex items-center gap-2 px-2 py-2 rounded-xl text-left transition-all"
          style={isActive
            ? { background: 'rgba(var(--accent-rgb),0.12)', border: '1px solid rgba(var(--accent-rgb),0.3)' }
            : { background: 'transparent', border: '1px solid transparent' }}>
          <span className="leading-none shrink-0" style={{ color: isActive ? 'var(--accent)' : 'var(--txt-dim)' }}><IconePrato chave={cat.emoji} size={18} /></span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate leading-none"
              style={{ color: isActive ? 'var(--accent)' : cat.ativo ? '#ccc' : '#555' }}>
              {cat.nome}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: cat.ativo ? '#444' : '#ef4444' }}>
              {cat.itens?.length || 0} itens{!cat.ativo ? ' · oculta' : ''}
            </p>
          </div>
        </button>
        {/* Ações hover */}
        <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
          <button onClick={onEdit} className="w-6 h-6 flex items-center justify-center rounded" style={{ color: '#555' }}><Pencil size={13} strokeWidth={1.75} /></button>
          <button onClick={onToggle} className="w-6 h-6 flex items-center justify-center rounded"
            style={{ color: cat.ativo ? '#10b981' : '#ef4444' }}>{cat.ativo ? <Check size={13} strokeWidth={2.5} /> : <X size={13} strokeWidth={2} />}</button>
        </div>
      </div>
    </div>
  );
}

// ── Sortable: card de item no grid ────────────────────────────
function SortableItemCard({ item, onToggle, onFicha, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `item-${item.id}` });
  const brlLocal = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1, zIndex: isDragging ? 50 : undefined };
  return (
    <div ref={setNodeRef} className="group rounded-2xl overflow-hidden flex flex-col"
      style={{ ...style, background: 'var(--space-elev)', border: `1.5px solid ${!item.disponivel ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.05)'}`, transition: 'border-color 0.2s' }}>
      {/* Foto */}
      <div className="relative w-full overflow-hidden" style={{ background: 'var(--space-elev-2)', aspectRatio: '16/9' }}>
        {item.foto
          ? <img src={`${item.foto}?t=${Date.now()}`} alt={item.nome} className="w-full h-full object-cover" style={{ opacity: item.disponivel ? 1 : 0.45 }} />
          : <div className="w-full h-full flex items-center justify-center" style={{ opacity: item.disponivel ? 0.35 : 0.15 }}><IconePrato chave={item.emoji} size={40} strokeWidth={1.4} /></div>}
        {/* Handle drag */}
        <div {...listeners} {...attributes} className="absolute inset-0 cursor-grab active:cursor-grabbing" style={{ touchAction: 'none' }} />
        {/* Toggle disponível */}
        <button onClick={onToggle} title={item.disponivel ? 'Ocultar do cardápio' : 'Disponibilizar'}
          className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black"
          style={{ background: item.disponivel ? 'rgba(16,185,129,0.9)' : 'rgba(239,68,68,0.9)', color: '#fff', backdropFilter: 'blur(6px)', zIndex: 10 }}>
          {item.disponivel ? <><Check size={11} strokeWidth={3} /> Ativo</> : <><X size={11} strokeWidth={3} /> Oculto</>}
        </button>
        <div className="absolute top-2 left-2 w-6 h-6 flex items-center justify-center rounded-lg pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.55)', color: '#666' }}>
          <GripVertical size={13} strokeWidth={1.75} />
        </div>
      </div>
      {/* Info */}
      <div className="flex flex-col flex-1 p-3">
        <div className="flex items-start justify-between gap-1 mb-1">
          <p className="font-bold t-strong text-sm leading-tight flex-1">{item.nome}</p>
          <p className="font-black text-sm shrink-0 ml-1" style={{ color: 'var(--accent)' }}>{brlLocal(item.preco)}</p>
        </div>
        {item.descricao && <p className="text-[11px] line-clamp-2 flex-1" style={{ color: '#555' }}>{item.descricao}</p>}
        {/* Ações */}
        <div className="flex gap-1.5 mt-2.5 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <button onClick={onFicha} title="Ficha técnica"
            className="flex-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1"
            style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
            <FileText size={12} strokeWidth={1.75} /> Ficha
          </button>
          <button onClick={onEdit} title="Editar item"
            className="flex-1 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1"
            style={{ background: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
            <Pencil size={12} strokeWidth={1.75} /> Editar
          </button>
          <button onClick={onDelete} title="Excluir"
            className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>
            <Trash2 size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Vista lista: linha compacta de item ───────────────────────
function ListItemRow({ item, onToggle, onFicha, onEdit, onDelete, listeners, attributes, setNodeRef, style: dndStyle }) {
  const brlLocal = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const rowStyle = { ...dndStyle, background: 'var(--space-elev)', border: `1px solid ${!item.disponivel ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.04)'}` };
  return (
    <div ref={setNodeRef} style={rowStyle}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl group">
      {/* Drag handle */}
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing shrink-0 text-center" style={{ touchAction: 'none', color: '#333' }}>
        <GripVertical size={15} strokeWidth={1.75} />
      </div>
      {/* Thumb */}
      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center" style={{ background: 'var(--space-elev-2)' }}>
        {item.foto
          ? <img src={`${item.foto}?t=${Date.now()}`} alt={item.nome} className="w-full h-full object-cover" style={{ opacity: item.disponivel ? 1 : 0.4 }} />
          : <IconePrato chave={item.emoji} size={22} strokeWidth={1.5} style={{ opacity: item.disponivel ? 0.5 : 0.2 }} />}
      </div>
      {/* Nome + desc */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold t-strong truncate">{item.nome}</p>
        {item.descricao && <p className="text-[11px] truncate" style={{ color: '#555' }}>{item.descricao}</p>}
      </div>
      {/* Preço */}
      <span className="text-sm font-black shrink-0" style={{ color: 'var(--accent)' }}>{brlLocal(item.preco)}</span>
      {/* Toggle */}
      <button onClick={onToggle} title={item.disponivel ? 'Ocultar' : 'Ativar'}
        className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
        style={item.disponivel
          ? { background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.25)' }
          : { background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
        {item.disponivel ? <><Check size={12} strokeWidth={2.5} /> Ativo</> : <><X size={12} strokeWidth={2} /> Oculto</>}
      </button>
      {/* Ações */}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onFicha} title="Ficha técnica"
          className="w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
          <FileText size={14} strokeWidth={1.75} />
        </button>
        <button onClick={onEdit} title="Editar"
          className="w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ background: 'rgba(251,191,36,0.08)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
          <Pencil size={14} strokeWidth={1.75} />
        </button>
        <button onClick={onDelete} title="Excluir"
          className="w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>
          <Trash2 size={14} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

function SortableListRow({ item, onToggle, onFicha, onEdit, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `item-${item.id}` });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1, zIndex: isDragging ? 50 : undefined };
  return <ListItemRow item={item} onToggle={onToggle} onFicha={onFicha} onEdit={onEdit} onDelete={onDelete} listeners={listeners} attributes={attributes} setNodeRef={setNodeRef} style={style} />;
}

// ── Componente principal ──────────────────────────────────────
export default function CardapioAdmin() {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catAtiva, setCatAtiva] = useState(null);
  const [modalCat, setModalCat] = useState(null);   // null | 'nova' | categoria
  const [modalItem, setModalItem] = useState(null); // null | 'novo' | item
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('cardapio_view') || 'grid');
  const [buscaItem, setBuscaItem] = useState('');
  const abaInicial = new URLSearchParams(window.location.search).get('aba') || localStorage.getItem('cardapio_aba') || 'cardapio';
  const [aba, setAba] = useState(abaInicial);
  const trocarAba = (k) => { setAba(k); localStorage.setItem('cardapio_aba', k); };
  const [cupons, setCupons] = useState([]);
  const [modalCupom, setModalCupom] = useState(null); // null | 'novo' | cupom
  const [horario, setHorario] = useState(null);
  const [mensagemFechado, setMensagemFechado] = useState('');
  const [salvandoHorario, setSalvandoHorario] = useState(false);
  // IA
  const [sugestoesIA, setSugestoesIA] = useState([]);
  const [gerandoIA, setGerandoIA] = useState(false);
  const [pedidoOperador, setPedidoOperador] = useState('');
  const [banners, setBanners] = useState([]);
  const [modalBanner, setModalBanner] = useState(null);
  const [modalCriarItem, setModalCriarItem] = useState(null); // banner a virar item // null | 'novo' | banner
  const [modalFicha, setModalFicha] = useState(null); // item do cardápio para editar ficha técnica
  const [modalPromocao, setModalPromocao] = useState(null); // sugestão IA para criar promoção
  // Logo
  const [logoUrl, setLogoUrl] = useState(null);
  const [logoCarregando, setLogoCarregando] = useState(false);
  const logoInputRef = React.useRef(null);
  const pillsScrollRef = React.useRef(null);
  // Config geral
  const [nomeRestaurante, setNomeRestaurante] = useState('');
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [infoStrip, setInfoStrip] = useState({ entrega: '40–60 min', frete: 'Grátis +R$80', nota: '4.9' });
  const [salvandoInfo, setSalvandoInfo] = useState(false);
  const [googleReviewsUrl, setGoogleReviewsUrl] = useState('');
  const [entrega, setEntrega] = useState({ pedido_minimo: 0, taxa_padrao: 0, aceita_fora: true, bairros: [], retirada_ativa: false, endereco_loja: '' });
  const [pagto, setPagto] = useState({ pix_chave: '', pix_nome: '', pix_cidade: '', cupom_aniversario: '' });
  const [trafego, setTrafego] = useState({ meta_pixel_id: '', ga_id: '' });
  const [comanda, setComanda] = useState({ modo: 'auto', proximo: 1 });
  // Fechamento temporário
  const [fechamentoTemp, setFechamentoTemp] = useState(null); // { ate: ISO }
  const [pausando, setPausando] = useState(false);
  const [abertoForcado, setAbertoForcado] = useState(false);
  const [fechadoForcado, setFechadoForcado] = useState(false);
  const [configAberto, setConfigAberto] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/cardapio/admin`, { headers: authH() });
      if (!res.ok) throw new Error('Erro ao carregar');
      const data = await res.json();
      setCategorias(data);
      setCatAtiva(prev => prev || (data[0]?.id ?? null));
    } catch (e) { toast.error(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); carregarCupons(); carregarHorario(); carregarBanners(); carregarLogo(); carregarConfig(); }, [carregar]);

  async function carregarLogo() {
    try {
      const r = await fetch(`${BASE}/ia/logo`, { headers: authH() });
      if (r.ok) { const d = await r.json(); setLogoUrl(d.url); }
    } catch {}
  }

  async function carregarConfig() {
    try {
      const r = await fetch(`${BASE}/cardapio/config`);
      if (r.ok) {
        const d = await r.json();
        setNomeRestaurante(d.nome_restaurante || '');
        setFechamentoTemp(d.fechamento_temp || null);
        setAbertoForcado(!!d.aberto_forcado);
        setFechadoForcado(!!d.fechado_forcado);
        if (d.info_strip) setInfoStrip(d.info_strip);
        if (d.google_reviews_url) setGoogleReviewsUrl(d.google_reviews_url);
        setEntrega({
          pedido_minimo: Number(d.pedido_minimo) || 0,
          taxa_padrao: Number(d.taxa_entrega_padrao) || 0,
          aceita_fora: d.aceita_fora_area !== false,
          bairros: Array.isArray(d.bairros_entrega) ? d.bairros_entrega : [],
          retirada_ativa: !!d.retirada_ativa,
          endereco_loja: d.endereco_loja || '',
        });
        setPagto({
          pix_chave: d.pix_chave || '', pix_nome: d.pix_nome || '',
          pix_cidade: d.pix_cidade || '', cupom_aniversario: d.cupom_aniversario || '',
        });
        setTrafego({ meta_pixel_id: d.meta_pixel_id || '', ga_id: d.ga_id || '' });
        setComanda({ modo: d.comanda_modo || 'auto', proximo: Number(d.comanda_proximo) || 1 });
      }
    } catch {}
  }

  async function abrirAgora() {
    try {
      await fetch(`${BASE}/cardapio/abrir-agora`, { method: 'POST', headers: authH() });
      setAbertoForcado(true); setFechadoForcado(false); setFechamentoTemp(null);
      toast.success('🟢 Cardápio aberto!');
    } catch { toast.error('Erro'); }
  }

  async function fecharAgora() {
    try {
      await fetch(`${BASE}/cardapio/fechar-agora`, { method: 'POST', headers: authH() });
      setFechadoForcado(true); setAbertoForcado(false); setFechamentoTemp(null);
      toast.success('🔴 Cardápio fechado!');
    } catch { toast.error('Erro'); }
  }

  async function voltarAutomatico() {
    try {
      await fetch(`${BASE}/cardapio/modo-forcado`, { method: 'DELETE', headers: authH() });
      setAbertoForcado(false); setFechadoForcado(false);
      toast.success('↩️ Voltou ao horário automático');
    } catch { toast.error('Erro'); }
  }

  async function salvarInfo() {
    setSalvandoInfo(true);
    try {
      const r = await fetch(`${BASE}/cardapio/config`, { method: 'PUT', headers: authJ(), body: JSON.stringify({
        info_strip: infoStrip, google_reviews_url: googleReviewsUrl,
        pedido_minimo: entrega.pedido_minimo, taxa_entrega_padrao: entrega.taxa_padrao,
        aceita_fora_area: entrega.aceita_fora, bairros_entrega: entrega.bairros,
        retirada_ativa: entrega.retirada_ativa, endereco_loja: entrega.endereco_loja,
        meta_pixel_id: trafego.meta_pixel_id, ga_id: trafego.ga_id,
        comanda_modo: comanda.modo,
        comanda_proximo: comanda.modo === 'manual' ? comanda.proximo : undefined,
        pix_chave: pagto.pix_chave, pix_nome: pagto.pix_nome, pix_cidade: pagto.pix_cidade,
        cupom_aniversario: pagto.cupom_aniversario,
      }) });
      if (r.ok) toast.success('Informações atualizadas!');
      else toast.error('Erro ao salvar');
    } catch { toast.error('Erro ao salvar'); }
    setSalvandoInfo(false);
  }

  async function salvarNome() {
    if (!nomeRestaurante.trim()) return;
    setSalvandoNome(true);
    try {
      const r = await fetch(`${BASE}/cardapio/config`, { method: 'PUT', headers: authJ(), body: JSON.stringify({ nome_restaurante: nomeRestaurante }) });
      if (r.ok) toast.success('Nome atualizado!');
      else toast.error('Erro ao salvar');
    } catch { toast.error('Erro ao salvar'); }
    setSalvandoNome(false);
  }

  async function pausarLoja(minutos) {
    setPausando(true);
    try {
      const r = await fetch(`${BASE}/cardapio/fechar-temp`, { method: 'POST', headers: authJ(), body: JSON.stringify({ minutos }) });
      const d = await r.json();
      if (r.ok) { setFechamentoTemp({ ate: d.ate }); toast.success(`Loja pausada por ${minutos} min`); }
      else toast.error(d.erro);
    } catch { toast.error('Erro'); }
    setPausando(false);
  }

  async function cancelarPausa() {
    try {
      await fetch(`${BASE}/cardapio/fechar-temp`, { method: 'DELETE', headers: authH() });
      setFechamentoTemp(null);
      toast.success('Pausa cancelada — loja aberta!');
    } catch { toast.error('Erro'); }
  }

  async function uploadLogo(file) {
    if (!file) return;
    setLogoCarregando(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const r = await fetch(`${BASE}/ia/logo`, { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro);
      setLogoUrl(d.url + '?t=' + Date.now());
      toast.success('Logo atualizada!');
    } catch (e) { toast.error(e.message); }
    setLogoCarregando(false);
  }

  async function removerLogo() {
    if (!confirm('Remover a logo do cardápio?')) return;
    try {
      await fetch(`${BASE}/ia/logo`, { method: 'DELETE', headers: authH() });
      setLogoUrl(null);
      toast.success('Logo removida');
    } catch { toast.error('Erro ao remover logo'); }
  }

  async function carregarCupons() {
    try {
      const r = await fetch(`${BASE}/cardapio/cupons`, { headers: authH() });
      if (r.ok) setCupons(await r.json());
    } catch {}
  }

  async function carregarHorario() {
    try {
      const r = await fetch(`${BASE}/cardapio/horario`);
      if (r.ok) {
        const data = await r.json();
        setHorario(data.horario || {});
        setMensagemFechado(data.mensagem_fechado || '');
      }
    } catch {}
  }

  async function salvarHorario() {
    setSalvandoHorario(true);
    try {
      const r = await fetch(`${BASE}/cardapio/horario`, {
        method: 'PUT', headers: authJ(),
        body: JSON.stringify({ horario, mensagem_fechado: mensagemFechado }),
      });
      if (r.ok) toast.success('Horário salvo!');
      else toast.error('Erro ao salvar');
    } catch { toast.error('Erro ao salvar'); }
    setSalvandoHorario(false);
  }

  async function toggleCupom(cupom) {
    try {
      await fetch(`${BASE}/cardapio/cupons/${cupom.id}`, {
        method: 'PATCH', headers: authJ(),
        body: JSON.stringify({ ativo: cupom.ativo === 0 }),
      });
      carregarCupons();
    } catch { toast.error('Erro'); }
  }

  async function excluirCupom(cupom) {
    if (!confirm(`Excluir cupom "${cupom.codigo}"?`)) return;
    try {
      await fetch(`${BASE}/cardapio/cupons/${cupom.id}`, { method: 'DELETE', headers: authH() });
      carregarCupons();
      toast.success('Cupom excluído!');
    } catch { toast.error('Erro'); }
  }

  async function carregarBanners() {
    try {
      const r = await fetch(`${BASE}/ia/banners`, { headers: authH() });
      if (r.ok) setBanners(await r.json());
    } catch {}
  }

  async function gerarSugestoesIA() {
    setGerandoIA(true);
    setSugestoesIA([]);
    try {
      const r = await fetch(`${BASE}/ia/sugestoes`, { method: 'POST', headers: authJ(), body: JSON.stringify({ pedido_operador: pedidoOperador }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.erro || 'Erro');
      setSugestoesIA(data.sugestoes || []);
      toast.success(`${data.sugestoes.length} sugestões geradas!`);
    } catch (e) { toast.error(e.message); }
    setGerandoIA(false);
  }

  async function adicionarAoBanner(s) {
    try {
      const r = await fetch(`${BASE}/ia/banners`, {
        method: 'POST', headers: authJ(),
        body: JSON.stringify({
          tag: s.tag_banner || '🔥 Promoção',
          titulo: s.titulo,
          subtitulo: s.descricao,
          destaque: s.destaque_banner || (s.preco_sugerido > 0 ? `R$ ${Number(s.preco_sugerido).toFixed(2).replace('.', ',')}` : ''),
          emoji: s.emoji || '🍣',
          cor1: s.cor1 || '#7c2d12',
          cor2: s.cor2 || '#9a3412',
          ordem: banners.length,
        }),
      });
      if (!r.ok) throw new Error();
      toast.success('Banner adicionado! 🎉');
      carregarBanners();
    } catch { toast.error('Erro ao adicionar banner'); }
  }

  async function adicionarComoItem(s) {
    // Encontra ou usa primeira categoria
    const catId = catAtiva || (categorias[0]?.id) || null;
    try {
      const r = await fetch(`${BASE}/cardapio/itens`, {
        method: 'POST', headers: authJ(),
        body: JSON.stringify({
          categoria_id: catId,
          nome: s.titulo,
          descricao: s.descricao || '',
          preco: s.preco_sugerido || 0,
          disponivel: true,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).erro || 'Erro');
      toast.success('Item adicionado ao cardápio! 🍣');
      carregar();
    } catch (e) { toast.error(e.message); }
  }

  async function excluirBanner(id) {
    if (!confirm('Excluir este banner?')) return;
    await fetch(`${BASE}/ia/banners/${id}`, { method: 'DELETE', headers: authH() });
    carregarBanners();
    toast.success('Banner excluído');
  }

  async function toggleBanner(b) {
    await fetch(`${BASE}/ia/banners/${b.id}`, {
      method: 'PUT', headers: authJ(),
      body: JSON.stringify({ ...b, ativo: b.ativo ? 0 : 1 }),
    });
    carregarBanners();
  }

  async function excluirCategoria(cat) {
    if (!confirm(`Excluir a categoria "${cat.nome}"?\nTodos os itens serão removidos também.`)) return;
    try {
      const res = await fetch(`${BASE}/cardapio/categorias/${cat.id}`, { method: 'DELETE', headers: authH() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro);
      toast.success('Categoria excluída!');
      setCatAtiva(null);
      carregar();
    } catch (e) { toast.error(e.message); }
  }

  async function toggleCategoria(cat) {
    try {
      await fetch(`${BASE}/cardapio/categorias/${cat.id}`, {
        method: 'PATCH', headers: authJ(),
        body: JSON.stringify({ ativo: cat.ativo === 0 }),
      });
      toast.success(cat.ativo === 0 ? 'Categoria ativada!' : 'Categoria ocultada!');
      carregar();
    } catch { toast.error('Erro'); }
  }

  async function toggleItem(item) {
    try {
      await fetch(`${BASE}/cardapio/itens/${item.id}`, {
        method: 'PATCH', headers: authJ(),
        body: JSON.stringify({ disponivel: item.disponivel === 0 }),
      });
      toast.success(item.disponivel === 0 ? '✅ Item ativado!' : '⚪ Item ocultado!');
      carregar();
    } catch { toast.error('Erro'); }
  }

  async function excluirItem(item) {
    if (!confirm(`Excluir "${item.nome}"?`)) return;
    try {
      const res = await fetch(`${BASE}/cardapio/itens/${item.id}`, { method: 'DELETE', headers: authH() });
      if (!res.ok) throw new Error((await res.json()).erro);
      toast.success('Item excluído!');
      carregar();
    } catch (e) { toast.error(e.message); }
  }

  async function reordenarItens(ids) {
    try {
      await fetch(`${BASE}/cardapio/itens/reordenar`, {
        method: 'POST', headers: authJ(),
        body: JSON.stringify({ ids }),
      });
    } catch { toast.error('Erro ao reordenar'); }
  }

  async function reordenarCategorias(ids) {
    try {
      await fetch(`${BASE}/cardapio/categorias/reordenar`, {
        method: 'POST', headers: authJ(),
        body: JSON.stringify({ ids }),
      });
    } catch { toast.error('Erro ao reordenar'); }
  }

  async function moverItemParaCategoria(itemId, novaCatId) {
    try {
      await fetch(`${BASE}/cardapio/itens/${itemId}`, {
        method: 'PATCH', headers: authJ(),
        body: JSON.stringify({ categoria_id: novaCatId }),
      });
    } catch { toast.error('Erro ao mover item'); }
  }

  // dnd-kit sensors — ativa arrasto após 8px de movimento (evita cliques acidentais)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } }),
  );
  const [draggingItem, setDraggingItem] = useState(null); // { type: 'cat'|'item', data }
  const [overCatId, setOverCatId]       = useState(null); // categoria sendo hovered ao arrastar item

  function onDragStart({ active }) {
    const id = active.id;
    if (String(id).startsWith('cat-')) {
      const cat = categorias.find(c => c.id === Number(id.replace('cat-', '')));
      setDraggingItem({ type: 'cat', data: cat });
    } else {
      const item = categorias.flatMap(c => c.itens).find(i => i.id === Number(id.replace('item-', '')));
      setDraggingItem({ type: 'item', data: item });
    }
  }

  function onDragOver({ active, over }) {
    if (!over || !String(active.id).startsWith('item-')) { setOverCatId(null); return; }
    if (String(over.id).startsWith('cat-')) {
      setOverCatId(Number(String(over.id).replace('cat-', '')));
    } else {
      setOverCatId(null);
    }
  }

  async function onDragEnd({ active, over }) {
    setDraggingItem(null);
    setOverCatId(null);
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId   = String(over.id);

    // ── Reordenar categorias ──
    if (activeId.startsWith('cat-') && overId.startsWith('cat-')) {
      const fromId = Number(activeId.replace('cat-', ''));
      const toId   = Number(overId.replace('cat-', ''));
      const oldIdx = categorias.findIndex(c => c.id === fromId);
      const newIdx = categorias.findIndex(c => c.id === toId);
      const novaOrdem = arrayMove(categorias, oldIdx, newIdx);
      setCategorias(novaOrdem);
      await reordenarCategorias(novaOrdem.map(c => c.id));
      return;
    }

    // ── Item arrastado ──
    if (activeId.startsWith('item-')) {
      const itemId = Number(activeId.replace('item-', ''));
      const item   = categorias.flatMap(c => c.itens).find(i => i.id === itemId);
      if (!item) return;

      // Drop em categoria diferente (via sidebar)
      if (overId.startsWith('cat-')) {
        const novaCatId = Number(overId.replace('cat-', ''));
        if (novaCatId === item.categoria_id) return;
        // Atualiza estado local imediatamente
        setCategorias(prev => prev.map(c => {
          if (c.id === item.categoria_id) return { ...c, itens: c.itens.filter(i => i.id !== itemId) };
          if (c.id === novaCatId) return { ...c, itens: [...c.itens, { ...item, categoria_id: novaCatId }] };
          return c;
        }));
        await moverItemParaCategoria(itemId, novaCatId);
        toast.success(`Item movido para ${categorias.find(c => c.id === novaCatId)?.nome}`);
        return;
      }

      // Reordenar dentro da categoria
      if (overId.startsWith('item-')) {
        const overItemId = Number(overId.replace('item-', ''));
        const overItem   = categorias.flatMap(c => c.itens).find(i => i.id === overItemId);
        if (!overItem) return;

        if (item.categoria_id === overItem.categoria_id) {
          // Mesma categoria — reordenar
          const cat    = categorias.find(c => c.id === item.categoria_id);
          const oldIdx = cat.itens.findIndex(i => i.id === itemId);
          const newIdx = cat.itens.findIndex(i => i.id === overItemId);
          const novosItens = arrayMove(cat.itens, oldIdx, newIdx);
          setCategorias(prev => prev.map(c => c.id === cat.id ? { ...c, itens: novosItens } : c));
          await reordenarItens(novosItens.map(i => i.id));
        } else {
          // Categoria diferente — mover para lá, inserir antes do overItem
          const novaCatId = overItem.categoria_id;
          const novaCat   = categorias.find(c => c.id === novaCatId);
          const overIdx   = novaCat.itens.findIndex(i => i.id === overItemId);
          setCategorias(prev => prev.map(c => {
            if (c.id === item.categoria_id) return { ...c, itens: c.itens.filter(i => i.id !== itemId) };
            if (c.id === novaCatId) {
              const novo = [...c.itens];
              novo.splice(overIdx, 0, { ...item, categoria_id: novaCatId });
              return { ...c, itens: novo };
            }
            return c;
          }));
          await moverItemParaCategoria(itemId, novaCatId);
          const novaCatAtualizada = categorias.find(c => c.id === novaCatId);
          const novosItens = [...novaCatAtualizada.itens];
          novosItens.splice(overIdx, 0, { ...item, categoria_id: novaCatId });
          await reordenarItens(novosItens.map(i => i.id));
          toast.success(`Item movido para ${novaCat?.nome}`);
        }
      }
    }
  }

  const catSelecionada = categorias.find(c => c.id === catAtiva);
  const totalItens = categorias.reduce((s, c) => s + (c.itens?.length || 0), 0);

  return (
    <div className="min-h-screen" style={{ background: 'var(--space-base)' }}>
      <Toaster position="top-right" />

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 px-3 py-2.5"
        style={{ background: 'var(--surface-glass)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-black t-strong leading-none">Cardápio Admin <span className="text-[9px] font-normal opacity-40">v2.1</span></h1>
            <p className="text-[10px] t-dim mt-0.5">{categorias.length} cat. · {totalItens} itens</p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {aba === 'cardapio' && (
              <button onClick={() => setConfigAberto(v => !v)}
                className="w-9 h-9 rounded-xl text-sm flex items-center justify-center transition-all"
                title="Configurações"
                style={configAberto
                  ? { background: 'rgba(var(--accent-rgb),0.15)', border: '1px solid rgba(var(--accent-rgb),0.3)' }
                  : { background: 'var(--space-elev)', border: '1px solid var(--space-elev-2)' }}>
                <Settings size={17} strokeWidth={1.75} style={{ color: configAberto ? 'var(--accent)' : '#888' }} />
              </button>
            )}
            <a href="/cardapio" target="_blank"
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              title="Ver cardápio público"
              style={{ background: 'var(--space-elev)', border: '1px solid var(--space-elev-2)', color: '#888' }}>
              <Eye size={17} strokeWidth={1.75} />
            </a>
            {aba === 'cardapio' && <>
              <button onClick={() => setModalCat('nova')}
                className="h-9 px-3 rounded-xl text-xs font-black transition-all flex items-center gap-1"
                style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
                <span>+</span><span className="hidden sm:inline">Categoria</span>
              </button>
              <button onClick={() => setModalItem('novo')}
                className="h-9 px-3 rounded-xl text-xs font-black t-strong transition-all flex items-center gap-1"
                style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', boxShadow: '0 2px 12px rgba(var(--accent-rgb),0.25)' }}>
                <span>+</span><span className="hidden sm:inline">Item</span>
              </button>
            </>}
            {aba === 'cupons' && (
              <button onClick={() => setModalCupom('novo')}
                className="h-9 px-3 rounded-xl text-xs font-black t-strong flex items-center gap-1"
                style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                <span>+</span><span className="hidden sm:inline">Cupom</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── TABS ───────────────────────────────────────────────── */}
      <div className="sticky top-[53px] z-10 px-2 py-1.5"
        style={{ background: 'var(--surface-glass)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--space-elev)' }}>
        <div className="max-w-6xl mx-auto flex gap-0.5">
          {[
            { key: 'cardapio', Icon: UtensilsCrossed, labelFull: 'Cardápio' },
            { key: 'cupons',   Icon: Tag,            labelFull: 'Cupons' },
            { key: 'horario',  Icon: Clock,          labelFull: 'Horário' },
            { key: 'ia',       Icon: Bot,            labelFull: 'IA' },
          ].map(t => (
            <button key={t.key} onClick={() => trocarAba(t.key)}
              className="flex-1 px-2 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              style={aba === t.key
                ? { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.3)' }
                : { background: 'transparent', color: '#555', border: '1px solid transparent' }}>
              <t.Icon size={16} strokeWidth={1.75} />
              <span className="hidden sm:inline">{t.labelFull}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── ABA CARDÁPIO ───────────────────────────────────────── */}
      {aba === 'cardapio' && (
        <div className="max-w-6xl mx-auto">

          {/* Config panel — collapsible */}
          {configAberto && (
            <div className="px-4 pt-4 space-y-3 pb-1">
              {/* Logo + Nome */}
              <div className="rounded-2xl p-4 flex items-center gap-4"
                style={{ background: 'var(--space-elev)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div onClick={() => logoInputRef.current?.click()}
                  className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden cursor-pointer shrink-0 transition-opacity hover:opacity-75"
                  style={{ background: 'var(--space-elev-2)', border: `2px dashed ${logoUrl ? 'rgba(var(--accent-rgb),0.5)' : 'rgba(255,255,255,0.1)'}` }}>
                  {logoCarregando
                    ? <Loader2 size={20} strokeWidth={2} className="animate-spin t-dim" />
                    : logoUrl
                      ? <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1.5" />
                      : <ImageIcon size={22} strokeWidth={1.5} className="t-dim" />}
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <input value={nomeRestaurante} onChange={e => setNomeRestaurante(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && salvarNome()}
                      placeholder="Nome do estabelecimento"
                      className="flex-1 px-3 py-2 rounded-xl text-sm font-bold t-strong outline-none"
                      style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                    <button onClick={salvarNome} disabled={salvandoNome}
                      className="px-3 py-2 rounded-xl text-xs font-bold shrink-0 disabled:opacity-50"
                      style={{ background: 'rgba(var(--accent-rgb),0.15)', border: '1px solid rgba(var(--accent-rgb),0.3)', color: 'var(--accent)' }}>
                      {salvandoNome ? '...' : 'Salvar'}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => logoInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold t-strong"
                      style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))' }}>
                      <span className="flex items-center gap-1.5">{logoUrl ? <><RefreshCw size={13} strokeWidth={2} /> Trocar logo</> : <><Upload size={13} strokeWidth={2} /> Enviar logo</>}</span>
                    </button>
                    {logoUrl && (
                      <button onClick={removerLogo}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-red-400"
                        style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                        <span className="flex items-center gap-1.5"><Trash2 size={13} strokeWidth={1.75} /> Remover</span>
                      </button>
                    )}
                  </div>
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && uploadLogo(e.target.files[0])} />
              </div>

              {/* Info strip — 3 colunas */}
              <div className="rounded-2xl p-4 space-y-4"
                style={{ background: 'var(--space-elev)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] font-black tracking-widest t-dim flex items-center gap-1.5"><Clock size={11} strokeWidth={1.75} /> INFORMAÇÕES DO CARDÁPIO</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] t-dim mb-1.5 flex items-center gap-1"><Clock size={11} strokeWidth={1.75} /> Tempo de entrega</label>
                    <input value={infoStrip.entrega || ''} onChange={e => setInfoStrip(p => ({ ...p, entrega: e.target.value }))}
                      placeholder="Ex: 40–60 min"
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold t-strong outline-none"
                      style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                  </div>
                  <div>
                    <label className="text-[10px] t-dim mb-1.5 flex items-center gap-1"><Star size={11} strokeWidth={1.75} /> Nota / avaliação</label>
                    <input value={infoStrip.nota || ''} onChange={e => setInfoStrip(p => ({ ...p, nota: e.target.value }))}
                      placeholder="Ex: 4.9"
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold t-strong outline-none"
                      style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                  </div>
                  <div>
                    <label className="text-[10px] t-dim mb-1.5 flex items-center gap-1"><Truck size={11} strokeWidth={1.75} /> Frete</label>
                    <input value={infoStrip.frete || ''} onChange={e => setInfoStrip(p => ({ ...p, frete: e.target.value }))}
                      placeholder="Ex: Grátis +R$80"
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold t-strong outline-none mb-1.5"
                      style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                    <div className="flex flex-wrap gap-1">
                      {['Grátis', 'Grátis +R$60', 'Grátis +R$80', 'Grátis +R$100', 'R$ 5,00', 'R$ 8,00', 'R$ 10,00', 'A consultar'].map(s => (
                        <button key={s} type="button" onClick={() => setInfoStrip(p => ({ ...p, frete: s }))}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all"
                          style={{
                            background: infoStrip.frete === s ? 'rgba(var(--accent-rgb),0.2)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${infoStrip.frete === s ? 'rgba(var(--accent-rgb),0.4)' : 'rgba(255,255,255,0.08)'}`,
                            color: infoStrip.frete === s ? 'var(--accent)' : '#666',
                          }}>{s}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] t-dim mb-1.5 flex items-center gap-1"><Link2 size={11} strokeWidth={1.75} /> Link Google Reviews (opcional)</label>
                  <input value={googleReviewsUrl} onChange={e => setGoogleReviewsUrl(e.target.value)}
                    placeholder="https://g.page/r/..."
                    className="w-full px-3 py-2 rounded-xl text-xs t-strong outline-none"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                    onFocus={e => e.target.style.borderColor = '#4285F4'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                </div>
                {/* ── Entrega: frete por bairro + pedido mínimo ── */}
                <div className="pt-3" style={{ borderTop: '1px solid var(--hairline)' }}>
                  <p className="text-[10px] font-black tracking-widest t-dim flex items-center gap-1.5 mb-2"><Truck size={11} strokeWidth={1.75} /> ENTREGA — FRETE E PEDIDO MÍNIMO</p>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div>
                      <label className="text-[10px] t-dim mb-1 block">Pedido mínimo (R$)</label>
                      <input type="number" step="0.01" min="0" value={entrega.pedido_minimo || ''}
                        onChange={e => setEntrega(p => ({ ...p, pedido_minimo: Number(e.target.value) || 0 }))}
                        placeholder="0 = sem mínimo"
                        className="w-full px-3 py-2 rounded-xl text-xs t-strong outline-none"
                        style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
                    </div>
                    <div>
                      <label className="text-[10px] t-dim mb-1 block">Taxa padrão (fora dos bairros)</label>
                      <input type="number" step="0.01" min="0" value={entrega.taxa_padrao || ''}
                        onChange={e => setEntrega(p => ({ ...p, taxa_padrao: Number(e.target.value) || 0 }))}
                        placeholder="R$"
                        className="w-full px-3 py-2 rounded-xl text-xs t-strong outline-none"
                        style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs t-dim mb-2 cursor-pointer select-none">
                    <input type="checkbox" checked={entrega.aceita_fora}
                      onChange={e => setEntrega(p => ({ ...p, aceita_fora: e.target.checked }))}
                      className="w-3.5 h-3.5 accent-orange-500" />
                    Aceitar bairros fora da lista (cobra a taxa padrão). Desmarcado = bloqueia entrega fora da lista.
                  </label>

                  {/* Lista de bairros */}
                  <div className="space-y-1.5">
                    {(entrega.bairros || []).map((b, i) => (
                      <div key={i} className="flex gap-1.5 items-center">
                        <input value={b.nome} onChange={e => setEntrega(p => { const bs = [...p.bairros]; bs[i] = { ...bs[i], nome: e.target.value }; return { ...p, bairros: bs }; })}
                          placeholder="Nome do bairro"
                          className="flex-1 px-3 py-2 rounded-xl text-xs t-strong outline-none"
                          style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
                        <div className="relative w-24">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] t-dim">R$</span>
                          <input type="number" step="0.01" min="0" value={b.taxa ?? ''}
                            onChange={e => setEntrega(p => { const bs = [...p.bairros]; bs[i] = { ...bs[i], taxa: Number(e.target.value) || 0 }; return { ...p, bairros: bs }; })}
                            placeholder="0"
                            className="w-full pl-7 pr-2 py-2 rounded-xl text-xs t-strong outline-none"
                            style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
                        </div>
                        <button type="button" onClick={() => setEntrega(p => ({ ...p, bairros: p.bairros.filter((_, j) => j !== i) }))}
                          className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0" style={{ color: '#f87171', background: 'rgba(239,68,68,0.08)' }}>
                          <Trash2 size={13} strokeWidth={1.75} />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setEntrega(p => ({ ...p, bairros: [...(p.bairros || []), { nome: '', taxa: 0 }] }))}
                      className="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                      style={{ background: 'var(--space-elev-2)', color: 'var(--txt)', border: '1px dashed var(--hairline-strong)' }}>
                      <Plus size={13} strokeWidth={2} /> Adicionar bairro
                    </button>
                  </div>

                  {/* ── Retirada no balcão ── */}
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--hairline)' }}>
                    <label className="flex items-center gap-2 text-xs font-bold t-strong mb-2 cursor-pointer select-none">
                      <input type="checkbox" checked={entrega.retirada_ativa}
                        onChange={e => setEntrega(p => ({ ...p, retirada_ativa: e.target.checked }))}
                        className="w-3.5 h-3.5 accent-orange-500" />
                      Permitir retirada no balcão
                    </label>
                    <p className="text-[10px] t-faint mb-2">Habilitado: o cliente pode escolher retirar (sem frete). Desabilitado: só entrega.</p>
                    {entrega.retirada_ativa && (
                      <input value={entrega.endereco_loja}
                        onChange={e => setEntrega(p => ({ ...p, endereco_loja: e.target.value }))}
                        placeholder="Endereço da loja (mostrado ao cliente para retirar)"
                        className="w-full px-3 py-2 rounded-xl text-xs t-strong outline-none"
                        style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
                    )}
                  </div>
                </div>

                {/* ── Pix (copia-e-cola automático) ── */}
                <div className="pt-3" style={{ borderTop: '1px solid var(--hairline)' }}>
                  <p className="text-[10px] font-black tracking-widest t-dim mb-2">PIX — PAGAMENTO AUTOMÁTICO</p>
                  <input value={pagto.pix_chave} onChange={e => setPagto(p => ({ ...p, pix_chave: e.target.value }))}
                    placeholder="Chave Pix (e-mail, celular, CPF/CNPJ ou aleatória)"
                    className="w-full px-3 py-2 mb-2 rounded-xl text-xs t-strong outline-none"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={pagto.pix_nome} onChange={e => setPagto(p => ({ ...p, pix_nome: e.target.value }))}
                      placeholder="Nome do recebedor"
                      className="w-full px-3 py-2 rounded-xl text-xs t-strong outline-none"
                      style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
                    <input value={pagto.pix_cidade} onChange={e => setPagto(p => ({ ...p, pix_cidade: e.target.value }))}
                      placeholder="Cidade"
                      className="w-full px-3 py-2 rounded-xl text-xs t-strong outline-none"
                      style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
                  </div>
                  <p className="text-[10px] t-faint mt-1">Com a chave preenchida, o cliente recebe o QR + copia-e-cola na hora ao escolher PIX.</p>
                </div>

                {/* ── Tráfego pago (pixels de conversão) ── */}
                <div className="pt-3" style={{ borderTop: '1px solid var(--hairline)' }}>
                  <p className="text-[10px] font-black tracking-widest t-dim mb-2">TRÁFEGO PAGO — PIXELS DE CONVERSÃO</p>
                  <input value={trafego.meta_pixel_id} onChange={e => setTrafego(p => ({ ...p, meta_pixel_id: e.target.value }))}
                    placeholder="ID do Meta Pixel (Facebook/Instagram) — só números"
                    className="w-full px-3 py-2 mb-2 rounded-xl text-xs t-strong outline-none"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
                  <input value={trafego.ga_id} onChange={e => setTrafego(p => ({ ...p, ga_id: e.target.value }))}
                    placeholder="ID do Google (GA4 'G-XXXX' ou Ads 'AW-XXXX')"
                    className="w-full px-3 py-2 rounded-xl text-xs t-strong outline-none"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
                  <p className="text-[10px] t-faint mt-1">Cole os IDs dos seus anúncios. O cardápio passa a registrar visitas e disparar o evento de <b>compra</b> automaticamente, e os pedidos vindos de links com <code>?utm_source=</code> aparecem no relatório de anúncios.</p>
                </div>

                {/* ── Numeração da comanda ── */}
                <div className="pt-3" style={{ borderTop: '1px solid var(--hairline)' }}>
                  <p className="text-[10px] font-black tracking-widest t-dim mb-2">NUMERAÇÃO DA COMANDA</p>
                  <div className="flex gap-2 mb-2">
                    <button type="button" onClick={() => setComanda(c => ({ ...c, modo: 'auto' }))}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                      style={comanda.modo === 'auto'
                        ? { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.4)' }
                        : { background: 'var(--space-elev-2)', color: 'var(--txt-dim)', border: '1px solid var(--hairline)' }}>
                      Automático (reinicia por dia)
                    </button>
                    <button type="button" onClick={() => setComanda(c => ({ ...c, modo: 'manual' }))}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                      style={comanda.modo === 'manual'
                        ? { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.4)' }
                        : { background: 'var(--space-elev-2)', color: 'var(--txt-dim)', border: '1px solid var(--hairline)' }}>
                      Manual (eu escolho)
                    </button>
                  </div>
                  {comanda.modo === 'manual' ? (
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <label className="text-[10px] t-faint block mb-1">Próxima comanda será:</label>
                        <input type="number" min="1" value={comanda.proximo}
                          onChange={e => setComanda(c => ({ ...c, proximo: Math.max(1, Number(e.target.value) || 1) }))}
                          className="w-full px-3 py-2 rounded-xl text-sm font-black t-strong outline-none"
                          style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
                      </div>
                      <button type="button" onClick={() => setComanda(c => ({ ...c, proximo: 1 }))}
                        className="px-4 py-2 mt-4 rounded-xl text-xs font-bold"
                        style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                        Zerar
                      </button>
                    </div>
                  ) : (
                    <p className="text-[10px] t-faint">Os números reiniciam em 1 a cada dia. Próximo número hoje: <b>#{comanda.proximo}</b>.</p>
                  )}
                  <p className="text-[10px] t-faint mt-1.5">No modo manual, você define a partir de qual número as comandas seguem — e pode zerar quando quiser. Não altera comandas já feitas.</p>
                </div>

                {/* ── Cupom de aniversário ── */}
                <div className="pt-3" style={{ borderTop: '1px solid var(--hairline)' }}>
                  <label className="text-[10px] font-black tracking-widest t-dim mb-1.5 block">CUPOM DE ANIVERSÁRIO</label>
                  <input value={pagto.cupom_aniversario} onChange={e => setPagto(p => ({ ...p, cupom_aniversario: e.target.value.toUpperCase() }))}
                    placeholder="Ex: ANIVER (precisa existir na aba Cupons)"
                    className="w-full px-3 py-2 rounded-xl text-xs t-strong outline-none"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
                  <p className="text-[10px] t-faint mt-1">No aniversário do cliente, enviamos esse cupom automaticamente pelo WhatsApp.</p>
                </div>

                <button onClick={salvarInfo} disabled={salvandoInfo}
                  className="w-full py-2 rounded-xl text-xs font-black disabled:opacity-50"
                  style={{ background: 'rgba(var(--accent-rgb),0.12)', border: '1px solid rgba(var(--accent-rgb),0.25)', color: 'var(--accent)' }}>
                  {salvandoInfo ? 'Salvando...' : 'Salvar informações'}
                </button>
              </div>
            </div>
          )}

          {/* ── Sidebar + Cards com DnD ── */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
          >
            {/* Mobile category pills — acima do layout, só no mobile */}
            <div className="md:hidden px-2 pt-2 pb-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <div className="flex gap-2">
                {categorias.map(cat => (
                  <button key={cat.id} onClick={() => setCatAtiva(cat.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition-all"
                    style={catAtiva === cat.id
                      ? { background: 'var(--accent)', color: '#fff' }
                      : { background: 'var(--space-elev)', color: '#666', border: '1px solid var(--space-elev-2)' }}>
                    <span className="flex items-center"><IconePrato chave={cat.emoji} size={14} /></span>
                    <span>{cat.nome}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-h-[calc(100vh-120px)]">

              {/* Sidebar categorias — sortable, só desktop */}
              <div className="hidden md:flex flex-col w-56 shrink-0 border-r overflow-y-auto"
                style={{ borderColor: 'var(--hairline)', position: 'sticky', top: 105, alignSelf: 'flex-start', maxHeight: 'calc(100vh - 105px)' }}>
                <div className="p-3 space-y-0.5 flex-1">
                  <div className="flex items-center justify-between px-2 pb-2">
                    <p className="text-[10px] font-black tracking-widest" style={{ color: '#444' }}>CATEGORIAS</p>
                    <button onClick={() => setModalCat('nova')} title="Nova categoria"
                      className="w-5 h-5 flex items-center justify-center rounded-md text-xs font-black"
                      style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)' }}>+</button>
                  </div>
                  {loading ? (
                    [1,2,3,4,5].map(i => (
                      <div key={i} className="h-10 rounded-xl animate-pulse mx-1 mb-1" style={{ background: 'var(--space-elev)' }} />
                    ))
                  ) : (
                    <SortableContext items={categorias.map(c => `cat-${c.id}`)} strategy={verticalListSortingStrategy}>
                      {categorias.map(cat => (
                        <SortableCatItem
                          key={cat.id}
                          cat={cat}
                          isActive={catAtiva === cat.id}
                          isOver={overCatId === cat.id && draggingItem?.type === 'item'}
                          isDraggingItem={draggingItem?.type === 'item'}
                          onClick={() => setCatAtiva(cat.id)}
                          onEdit={() => setModalCat(cat)}
                          onToggle={() => toggleCategoria(cat)}
                        />
                      ))}
                    </SortableContext>
                  )}
                </div>
              </div>

              {/* Área de itens */}
              <div className="flex-1 p-2 md:p-4 pb-10 min-w-0">
                {!catSelecionada ? (
                  <div className="text-center py-20">
                    <p className="flex justify-center mb-3 t-faint"><Hand size={34} strokeWidth={1.5} /></p>
                    <p className="t-dim text-sm">Selecione uma categoria</p>
                  </div>
                ) : (
                  <>
                    {/* Header da categoria */}
                    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: catSelecionada.ativo ? 'rgba(var(--accent-rgb),0.12)' : 'rgba(239,68,68,0.1)', border: `1px solid ${catSelecionada.ativo ? 'rgba(var(--accent-rgb),0.25)' : 'rgba(239,68,68,0.2)'}` }}>
                          <IconePrato chave={catSelecionada.emoji} size={20} style={{ color: catSelecionada.ativo ? 'var(--accent)' : '#ef4444' }} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-base font-black t-strong">{catSelecionada.nome}</h2>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'var(--space-elev-2)', color: '#555' }}>{catSelecionada.itens.length} itens</span>
                            {!catSelecionada.ativo && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Oculta</span>}
                          </div>
                          {catSelecionada.descricao && <p className="text-xs mt-0.5" style={{ color: '#555' }}>{catSelecionada.descricao}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button onClick={() => toggleCategoria(catSelecionada)}
                          className="h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1"
                          style={catSelecionada.ativo
                            ? { background: 'rgba(16,185,129,0.08)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }
                            : { background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                          {catSelecionada.ativo ? <><Check size={12} strokeWidth={2.5} /> Visível</> : <><X size={12} strokeWidth={2} /> Oculta</>}
                        </button>
                        <button onClick={() => setModalCat(catSelecionada)}
                          className="h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1"
                          style={{ background: 'var(--space-elev)', color: '#777', border: '1px solid var(--space-elev-2)' }}>
                          <Pencil size={12} strokeWidth={1.75} /> Editar cat.
                        </button>
                        <button onClick={() => excluirCategoria(catSelecionada)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg"
                          style={{ background: 'rgba(239,68,68,0.06)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                          <Trash2 size={14} strokeWidth={1.75} />
                        </button>
                        <button onClick={() => setModalItem({ novo: true })}
                          className="h-8 px-3 rounded-xl text-xs font-black t-strong flex items-center gap-1"
                          style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', boxShadow: '0 2px 10px rgba(var(--accent-rgb),0.3)' }}>
                          <Plus size={13} strokeWidth={2.5} /> Item
                        </button>
                      </div>
                    </div>

                    {/* Barra de busca + toggle de view */}
                    {catSelecionada.itens.length > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 t-faint pointer-events-none">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                          </span>
                          <input
                            type="text" placeholder={`Buscar em ${catSelecionada.nome}…`}
                            value={buscaItem} onChange={e => setBuscaItem(e.target.value)}
                            className="w-full pl-8 pr-3 py-2 rounded-xl text-sm outline-none"
                            style={{ background: 'var(--space-elev)', border: '1px solid var(--space-elev-2)', color: 'var(--txt-strong)' }}
                          />
                          {buscaItem && (
                            <button onClick={() => setBuscaItem('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 t-dim"><X size={13} /></button>
                          )}
                        </div>
                        {/* Toggle grid/lista */}
                        <div className="flex rounded-xl overflow-hidden shrink-0" style={{ border: '1px solid var(--space-elev-2)' }}>
                          {[{ v: 'grid', icon: '⊞' }, { v: 'list', icon: '☰' }].map(({ v, icon }) => (
                            <button key={v} onClick={() => { setViewMode(v); localStorage.setItem('cardapio_view', v); }}
                              className="w-9 h-9 flex items-center justify-center text-base transition-all"
                              style={viewMode === v
                                ? { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)' }
                                : { background: 'var(--space-elev)', color: '#555' }}>
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Itens */}
                    {catSelecionada.itens.length === 0 ? (
                      <div className="text-center py-16">
                        <p className="flex justify-center mb-3 t-faint"><UtensilsCrossed size={34} strokeWidth={1.5} /></p>
                        <p className="t-dim text-sm mb-4">Nenhum item nesta categoria</p>
                        <button onClick={() => setModalItem({ novo: true })}
                          className="px-5 py-2.5 rounded-xl text-sm font-black t-strong"
                          style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))' }}>
                          + Adicionar primeiro item
                        </button>
                      </div>
                    ) : (() => {
                      const itensFiltrados = buscaItem
                        ? catSelecionada.itens.filter(i => i.nome.toLowerCase().includes(buscaItem.toLowerCase()))
                        : catSelecionada.itens;
                      if (itensFiltrados.length === 0) return (
                        <div className="text-center py-12">
                          <p className="t-dim text-sm">Nenhum item encontrado para "{buscaItem}"</p>
                        </div>
                      );
                      return viewMode === 'list' ? (
                        <SortableContext items={catSelecionada.itens.map(i => `item-${i.id}`)} strategy={verticalListSortingStrategy}>
                          <div className="space-y-1.5">
                            {itensFiltrados.map(item => (
                              <SortableListRow key={item.id} item={item}
                                onToggle={() => toggleItem(item)}
                                onFicha={() => setModalFicha(item)}
                                onEdit={() => setModalItem(item)}
                                onDelete={() => excluirItem(item)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      ) : (
                        <SortableContext items={catSelecionada.itens.map(i => `item-${i.id}`)} strategy={rectSortingStrategy}>
                          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))' }}>
                            {itensFiltrados.map(item => (
                              <SortableItemCard key={item.id} item={item}
                                onToggle={() => toggleItem(item)}
                                onFicha={() => setModalFicha(item)}
                                onEdit={() => setModalItem(item)}
                                onDelete={() => excluirItem(item)}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      );
                    })()}
                  </>
                )}
              </div>
            </div>

            {/* Drag overlay — preview flutuante */}
            <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>
              {draggingItem?.type === 'cat' && (
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl w-48 shadow-2xl"
                  style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(var(--accent-rgb),0.4)', opacity: 0.95 }}>
                  <span className="text-lg">{draggingItem.data?.emoji}</span>
                  <span className="text-xs font-bold t-strong truncate">{draggingItem.data?.nome}</span>
                </div>
              )}
              {draggingItem?.type === 'item' && (
                <div className="rounded-2xl overflow-hidden shadow-2xl w-48"
                  style={{ background: 'var(--space-elev)', border: '1px solid rgba(var(--accent-rgb),0.4)', opacity: 0.9 }}>
                  <div className="flex items-center justify-center" style={{ background: 'var(--space-elev-2)', aspectRatio: '4/3' }}>
                    {draggingItem.data?.foto
                      ? <img src={draggingItem.data.foto} alt="" className="w-full h-full object-cover" />
                      : <span className="text-4xl">{draggingItem.data?.emoji}</span>}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-bold t-strong truncate">{draggingItem.data?.nome}</p>
                    <p className="text-xs font-black" style={{ color: 'var(--accent)' }}>{brl(draggingItem.data?.preco || 0)}</p>
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {/* ── ABA CUPONS ──────────────────────────────────────────── */}
      {aba === 'cupons' && (
        <div className="max-w-3xl mx-auto p-4">
          {cupons.length === 0 ? (
            <div className="text-center py-20">
              <div className="flex justify-center mb-3 t-faint"><Tag size={42} strokeWidth={1.5} /></div>
              <p className="t-dim">Nenhum cupom cadastrado</p>
              <button onClick={() => setModalCupom('novo')} className="mt-4 px-6 py-2 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                Criar primeiro cupom
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {cupons.map(c => (
                <div key={c.id} className="rounded-2xl p-4 flex items-center gap-4"
                  style={{ background: 'var(--space-elev)', border: `1px solid ${c.ativo ? '#1e3a28' : 'var(--space-elev-2)'}` }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-black t-strong tracking-widest">{c.codigo}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ background: c.tipo === 'percentual' ? 'rgba(139,92,246,0.2)' : 'rgba(16,185,129,0.2)', color: c.tipo === 'percentual' ? '#a78bfa' : '#10b981' }}>
                        {c.tipo === 'percentual' ? `-${c.valor}%` : `-R$ ${Number(c.valor).toFixed(2).replace('.',',')}`}
                      </span>
                      {!c.ativo && <span className="text-xs t-dim bg-zinc-900 px-2 py-0.5 rounded-full">desativado</span>}
                    </div>
                    {c.descricao && <p className="text-xs t-dim mt-1">{c.descricao}</p>}
                    <div className="flex gap-3 mt-1 text-[11px] t-dim">
                      {c.minimo > 0 && <span>mínimo R$ {Number(c.minimo).toFixed(2).replace('.',',')}</span>}
                      {c.usos_maximos > 0 && <span>{c.usos_atuais}/{c.usos_maximos} usos</span>}
                      {c.validade && <span>válido até {c.validade}</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => toggleCupom(c)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold"
                      style={c.ativo ? { background: 'rgba(239,68,68,0.1)', color: '#f87171' } : { background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                      {c.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                    <button onClick={() => excluirCupom(c)} className="w-8 h-8 flex items-center justify-center rounded-lg t-dim hover:text-red-400" style={{ background: 'var(--space-elev-2)' }}><Trash2 size={15} strokeWidth={1.75} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ABA HORÁRIO ──────────────────────────────────────────── */}
      {aba === 'horario' && horario && (
        <div className="max-w-xl mx-auto p-4 space-y-4">

          {/* ── Abrir / Fechar agora ── */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--space-elev)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-amber-400 flex items-center"><Zap size={17} strokeWidth={1.75} /></span>
              <div>
                <p className="text-sm font-black t-strong leading-none">Controle imediato</p>
                <p className="text-xs t-dim mt-0.5">Abre ou fecha o cardápio agora, independente do horário.</p>
              </div>
            </div>

            {/* Status atual */}
            {(abertoForcado || fechadoForcado) && (
              <div className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-3"
                style={{
                  background: abertoForcado ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${abertoForcado ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                }}>
                <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: abertoForcado ? '#22c55e' : '#f87171' }}>
                  <Circle size={11} strokeWidth={3} fill="currentColor" /> {abertoForcado ? 'Aberto manualmente — ignorando horário' : 'Fechado manualmente — ignorando horário'}
                </span>
                <button onClick={voltarAutomatico}
                  className="text-xs font-bold px-2.5 py-1.5 rounded-lg shrink-0 flex items-center gap-1.5"
                  style={{ background: 'rgba(255,255,255,0.06)', color: '#999', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Undo2 size={13} strokeWidth={2} /> Automático
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button onClick={abrirAgora}
                disabled={abertoForcado}
                className="py-3 rounded-xl text-sm font-black transition-all active:scale-95 disabled:opacity-40"
                style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>
                <span className="flex items-center justify-center gap-1.5"><Circle size={13} strokeWidth={3} fill="currentColor" /> Abrir agora</span>
              </button>
              <button onClick={fecharAgora}
                disabled={fechadoForcado}
                className="py-3 rounded-xl text-sm font-black transition-all active:scale-95 disabled:opacity-40"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                <span className="flex items-center justify-center gap-1.5"><Circle size={13} strokeWidth={3} fill="currentColor" /> Fechar agora</span>
              </button>
            </div>
          </div>

          {/* ── Pausa rápida ── */}
          <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--space-elev)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              <span className="text-amber-400 flex items-center"><Clock size={17} strokeWidth={1.75} /></span>
              <div>
                <p className="text-sm font-black t-strong leading-none">Fechar temporariamente</p>
                <p className="text-xs t-dim mt-0.5">Saíram muitos pedidos? Pause o cardápio por alguns minutos.</p>
              </div>
            </div>

            {fechamentoTemp && new Date(fechamentoTemp.ate) > new Date() ? (
              /* Pausa ativa */
              <div className="rounded-xl p-3 flex items-center justify-between gap-3"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <div>
                  <p className="text-sm font-bold text-amber-400 flex items-center gap-1.5"><Circle size={12} strokeWidth={3} fill="currentColor" /> Cardápio pausado</p>
                  <p className="text-xs t-dim mt-0.5">
                    Reabre às <strong className="text-amber-300">
                      {new Date(fechamentoTemp.ate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </strong>
                  </p>
                </div>
                <button onClick={cancelarPausa}
                  className="px-3 py-2 rounded-xl text-xs font-black t-strong shrink-0"
                  style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
                  <span className="flex items-center gap-1.5"><Check size={14} strokeWidth={2.5} /> Reabrir agora</span>
                </button>
              </div>
            ) : (
              /* Botões de pausa */
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: '15 min', min: 15 },
                  { label: '30 min', min: 30 },
                  { label: '1 hora', min: 60 },
                  { label: '2 horas', min: 120 },
                ].map(({ label, min }) => (
                  <button key={min} onClick={() => pausarLoja(min)} disabled={pausando}
                    className="py-2.5 rounded-xl text-xs font-black t-strong transition-all active:scale-95 disabled:opacity-50"
                    style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--space-elev)', border: '1px solid var(--space-elev-2)' }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--space-elev-2)' }}>
              <p className="text-xs font-bold tracking-widest t-dim">HORÁRIOS POR DIA</p>
            </div>
            <div className="p-4 space-y-3">
              {[
                { key: 'seg', label: 'Segunda' },
                { key: 'ter', label: 'Terça' },
                { key: 'qua', label: 'Quarta' },
                { key: 'qui', label: 'Quinta' },
                { key: 'sex', label: 'Sexta' },
                { key: 'sab', label: 'Sábado' },
                { key: 'dom', label: 'Domingo' },
              ].map(({ key, label }) => {
                const dia = horario[key] || { aberto: false, abre: '18:00', fecha: '23:00' };
                return (
                  <div key={key} className="flex items-center gap-3 flex-wrap">
                    <div className="w-20 shrink-0">
                      <span className="text-sm font-medium t-mut">{label}</span>
                    </div>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={!!dia.aberto}
                        onChange={e => setHorario(h => ({ ...h, [key]: { ...dia, aberto: e.target.checked } }))}
                        className="w-4 h-4 accent-orange-500" />
                      <span className="text-xs t-dim">{dia.aberto ? 'Aberto' : 'Fechado'}</span>
                    </label>
                    {dia.aberto && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs t-dim">das</span>
                          <input type="time" value={dia.abre || '18:00'}
                            onChange={e => setHorario(h => ({ ...h, [key]: { ...dia, abre: e.target.value } }))}
                            className="px-2 py-1 rounded-lg text-sm t-strong outline-none"
                            style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs t-dim">às</span>
                          <input type="time" value={dia.fecha || '23:00'}
                            onChange={e => setHorario(h => ({ ...h, [key]: { ...dia, fecha: e.target.value } }))}
                            className="px-2 py-1 rounded-lg text-sm t-strong outline-none"
                            style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl p-4" style={{ background: 'var(--space-elev)', border: '1px solid var(--space-elev-2)' }}>
            <label className="text-xs font-bold tracking-widest t-dim block mb-3">MENSAGEM QUANDO FECHADO</label>
            <input value={mensagemFechado} onChange={e => setMensagemFechado(e.target.value)}
              placeholder="Ex: Voltamos hoje às 18h 🍣"
              className="w-full px-4 py-3 rounded-xl text-sm t-strong outline-none"
              style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }} />
            <p className="text-xs t-faint mt-2">Deixe em branco para usar a mensagem padrão</p>
          </div>

          <button onClick={salvarHorario} disabled={salvandoHorario}
            className="w-full py-3 rounded-xl font-black t-strong disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))' }}>
            {salvandoHorario ? 'Salvando...' : <span className="flex items-center justify-center gap-1.5"><Save size={15} strokeWidth={2} /> Salvar horários</span>}
          </button>
        </div>
      )}

      {/* ── ABA IA ──────────────────────────────────────────────── */}
      {aba === 'ia' && (
        <div className="max-w-4xl mx-auto p-4 space-y-6">

          {/* Botão gerar + info */}
          <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg,rgba(var(--accent-rgb),0.08),rgba(139,92,246,0.08))', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
            <div className="flex items-start gap-3 mb-4">
              <Bot size={18} strokeWidth={1.75} style={{ color: 'var(--accent)', marginTop: 2, flexShrink: 0 }} />
              <div>
                <h2 className="t-strong font-black text-base">Sugestões de IA</h2>
                <p className="t-dim text-sm mt-0.5">
                  A IA analisa o cardápio real da loja e o histórico de vendas para sugerir combos e promoções. Com 1 clique você adiciona ao banner ou cria um novo item.
                </p>
              </div>
            </div>

            {/* Instrução do operador */}
            <div className="mb-3">
              <label className="text-xs font-bold t-dim uppercase tracking-wider block mb-1.5">
                Instrução para a IA <span className="font-normal normal-case opacity-60">(opcional)</span>
              </label>
              <textarea
                value={pedidoOperador}
                onChange={e => setPedidoOperador(e.target.value)}
                placeholder="Ex: quero promover o salmão essa semana, criar um combo família para o fim de semana, frete grátis acima de R$ 60..."
                rows={2}
                disabled={gerandoIA}
                className="input w-full text-sm resize-none"
                style={{ lineHeight: 1.5 }}
              />
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs t-faint flex items-start gap-1.5">
                <Lightbulb size={12} strokeWidth={1.75} className="shrink-0 mt-0.5" />
                <span>Requer <strong className="t-dim">ANTHROPIC_API_KEY</strong> no <code className="text-orange-400">.env</code></span>
              </p>
              <button onClick={gerarSugestoesIA} disabled={gerandoIA}
                className="px-5 py-2.5 rounded-xl font-black t-strong text-sm shrink-0 flex items-center gap-2 disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,var(--accent),#a855f7)' }}>
                {gerandoIA ? (
                  <><Loader2 size={15} strokeWidth={2} className="animate-spin" /> Gerando...</>
                ) : (
                  <><Sparkles size={15} strokeWidth={1.75} /> Gerar sugestões</>
                )}
              </button>
            </div>
          </div>

          {/* Cards de sugestões */}
          {sugestoesIA.length > 0 && (
            <div>
              <p className="text-xs font-bold tracking-widest t-dim mb-3">SUGESTÕES GERADAS</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sugestoesIA.map((s, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden" style={{ background: 'var(--space-elev)', border: '1px solid var(--space-elev-2)' }}>
                    {/* Preview do banner */}
                    <div className="px-4 py-3 flex items-center gap-3"
                      style={{ background: `linear-gradient(110deg, ${s.cor1 || '#7c2d12'}ee, ${s.cor2 || '#9a3412'}aa)` }}>
                      <span className="text-3xl">{s.emoji || '🍣'}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold text-orange-300 tracking-wide">{s.tag_banner || '🔥 Promoção'}</span>
                        <p className="t-strong font-black text-sm leading-tight truncate">{s.titulo}</p>
                        {s.destaque_banner && <span className="text-yellow-300 font-black text-xs">{s.destaque_banner}</span>}
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="t-mut text-xs leading-relaxed">{s.descricao}</p>
                      {s.preco_sugerido > 0 && (
                        <p className="text-orange-400 font-black text-sm mt-1">
                          {Number(s.preco_sugerido).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                      )}
                      {s.justificativa && (
                        <p className="t-dim text-[11px] mt-2 italic flex items-start gap-1"><Lightbulb size={12} strokeWidth={1.75} className="shrink-0 mt-0.5" /> {s.justificativa}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button onClick={() => adicionarAoBanner(s)}
                          className="flex-1 py-2 rounded-xl text-xs font-bold"
                          style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.3)' }}>
                          <span className="flex items-center justify-center gap-1"><ImageIcon size={13} strokeWidth={1.75} /> Banner</span>
                        </button>
                        <button onClick={() => adicionarComoItem(s)}
                          className="flex-1 py-2 rounded-xl text-xs font-bold"
                          style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}>
                          <span className="flex items-center justify-center gap-1"><UtensilsCrossed size={13} strokeWidth={1.75} /> Cardápio</span>
                        </button>
                        <button onClick={() => setModalPromocao(s)}
                          className="flex-1 py-2 rounded-xl text-xs font-bold"
                          style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                          <span className="flex items-center justify-center gap-1"><Target size={13} strokeWidth={1.75} /> Promoção</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Banners ativos */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold tracking-widest t-dim">BANNERS DO CARROSSEL ({banners.length})</p>
              <button onClick={() => setModalBanner('novo')}
                className="px-3 py-1.5 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
                + Banner manual
              </button>
            </div>
            {banners.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--space-elev)', border: '1px dashed var(--space-elev-2)' }}>
                <p className="flex justify-center mb-2 t-faint"><ImageIcon size={34} strokeWidth={1.5} /></p>
                <p className="t-dim text-sm">Nenhum banner ainda. Gere sugestões acima ou adicione manualmente.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {banners.map(b => (
                  <div key={b.id} className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: 'var(--space-elev)', border: `1px solid ${b.ativo ? 'var(--space-elev-2)' : 'var(--space-elev)'}`, opacity: b.ativo ? 1 : 0.5 }}>
                    {/* Thumbnail: imagem ou gradiente */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 flex items-center justify-center relative"
                      style={{ background: `linear-gradient(135deg,${b.cor1},${b.cor2})` }}>
                      {b.img
                        ? <img src={`${b.img}?t=${Date.now()}`} alt="" className="w-full h-full object-cover" />
                        : <span className="text-2xl">{b.emoji}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="t-strong text-sm font-bold truncate">{b.titulo}</p>
                      <p className="t-dim text-xs truncate">{b.subtitulo}</p>
                    </div>
                    {b.destaque && <span className="text-orange-400 font-black text-xs shrink-0">{b.destaque}</span>}
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => setModalCriarItem(b)}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1"
                        style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.25)' }}
                        title="Criar este item no cardápio">
                        + Cardápio
                      </button>
                      <button onClick={() => toggleBanner(b)}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold"
                        style={b.ativo ? { background: 'rgba(239,68,68,0.1)', color: '#f87171' } : { background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
                        {b.ativo ? 'Ocultar' : 'Mostrar'}
                      </button>
                      <button onClick={() => navigate(`/editor-banner/${b.id}`)}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1"
                        style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.25)' }}
                        title="Editor visual (Canva)">
                        🎨 Design
                      </button>
                      <button onClick={() => setModalBanner(b)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg t-dim"
                        style={{ background: 'var(--space-elev-2)' }}><Pencil size={13} strokeWidth={1.75} /></button>
                      <button onClick={() => excluirBanner(b.id)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg t-dim hover:text-red-400"
                        style={{ background: 'var(--space-elev-2)' }}><Trash2 size={13} strokeWidth={1.75} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Cupom */}
      {modalCupom && (
        <ModalCupom onClose={() => setModalCupom(null)} onSalvo={() => { setModalCupom(null); carregarCupons(); }} />
      )}

      {/* Modal Banner */}
      {modalBanner && (
        <ModalBanner
          banner={modalBanner === 'novo' ? null : modalBanner}
          onClose={() => setModalBanner(null)}
          onSalvo={() => { setModalBanner(null); carregarBanners(); }}
        />
      )}

      {/* Modal Criar Item no Cardápio a partir de banner */}
      {modalCriarItem && (
        <ModalCriarItemDeBanner
          banner={modalCriarItem}
          categorias={categorias}
          onClose={() => setModalCriarItem(null)}
          onSalvo={() => { setModalCriarItem(null); carregar(); toast.success('Item criado no cardápio!'); }}
        />
      )}

      {/* Modal Ficha Técnica */}
      {modalFicha && (
        <ModalFichaTecnica
          item={modalFicha}
          onClose={() => setModalFicha(null)}
        />
      )}

      {/* Modal Criar Promoção */}
      {modalPromocao && (
        <ModalCriarPromocao
          sugestao={modalPromocao}
          onClose={() => setModalPromocao(null)}
          onSalvo={() => { setModalPromocao(null); }}
        />
      )}

      {/* Modals */}
      {modalCat && (
        <ModalCategoria
          cat={modalCat === 'nova' ? null : modalCat}
          onClose={() => setModalCat(null)}
          onSalvo={() => { setModalCat(null); carregar(); }}
        />
      )}
      {modalItem && (
        <ModalItem
          item={modalItem === 'novo' || modalItem?.novo ? null : modalItem}
          categorias={categorias}
          catIdInicial={catAtiva}
          onClose={() => setModalItem(null)}
          onSalvo={() => { setModalItem(null); carregar(); }}
        />
      )}
    </div>
  );
}
