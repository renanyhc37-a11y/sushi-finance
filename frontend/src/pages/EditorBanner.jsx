import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Eye, EyeOff, RotateCcw, Layers,
  Monitor, Smartphone, Bold, AlignLeft, AlignCenter,
  AlignRight, Maximize2, Type, Palette, Image, Sliders,
  ChevronDown, ChevronUp, Trash2
} from 'lucide-react';
import { getToken } from '../hooks/useAuth';

const BASE = import.meta.env.VITE_API_URL || '/api';

const FONT_FAMILIES = [
  { label: 'Padrão', value: 'inherit' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Impact', value: 'Impact, sans-serif' },
  { label: 'Courier', value: 'Courier New, monospace' },
];

const GRADIENT_PRESETS = [
  { label: 'Vermelho', c1: '#7c2d12', c2: '#9a3412' },
  { label: 'Noite', c1: '#0f172a', c2: '#1e293b' },
  { label: 'Âmbar', c1: '#92400e', c2: '#b45309' },
  { label: 'Verde', c1: '#14532d', c2: '#166534' },
  { label: 'Roxo', c1: '#4c1d95', c2: '#6d28d9' },
  { label: 'Rosa', c1: '#881337', c2: '#be123c' },
  { label: 'Azul', c1: '#1e3a5f', c2: '#1d4ed8' },
  { label: 'Preto', c1: '#09090b', c2: '#27272a' },
];

const DEFAULTS = {
  tag:      { x: 4,  y: 8,  w: 22, size: 11, cor: '#ffffff', bg: 'rgba(0,0,0,0.5)', negrito: true,  oculto: false, align: 'left',  opacity: 1, shadow: true,  fontFamily: 'inherit', texto: '', letterSpacing: 0.05 },
  destaque: { x: 62, y: 6,  w: 35, size: 13, cor: '#ffffff', bg: 'rgba(245,158,11,0.9)', negrito: true,  oculto: false, align: 'center', opacity: 1, shadow: false, fontFamily: 'inherit', texto: '', letterSpacing: 0 },
  titulo:   { x: 4,  y: 62, w: 70, size: 24, cor: '#ffffff', bg: '',                     negrito: true,  oculto: false, align: 'left',  opacity: 1, shadow: true,  fontFamily: 'inherit', texto: '', letterSpacing: -0.01, lineHeight: 1.15 },
  subtitulo:{ x: 4,  y: 79, w: 65, size: 13, cor: 'rgba(255,255,255,0.85)', bg: '',      negrito: false, oculto: false, align: 'left',  opacity: 1, shadow: true,  fontFamily: 'inherit', texto: '', letterSpacing: 0, lineHeight: 1.3 },
  opcoes:   { x: 4,  y: 91, w: 90, size: 12, cor: '#ffffff', bg: '',                     negrito: false, oculto: false, align: 'left',  opacity: 1, shadow: false, fontFamily: 'inherit', texto: '', letterSpacing: 0 },
};

const OVERLAY_DEFAULT = 0.55;
const ANGULO_DEFAULT  = 110;

function mergeDesign(saved) {
  const base = { elementos: structuredClone(DEFAULTS), overlay: OVERLAY_DEFAULT, angulo: ANGULO_DEFAULT };
  if (!saved) return base;
  const src = typeof saved === 'string' ? JSON.parse(saved) : saved;
  base.overlay = src.overlay ?? OVERLAY_DEFAULT;
  base.angulo  = src.angulo  ?? ANGULO_DEFAULT;
  const els = src.elementos || {};
  for (const k of Object.keys(base.elementos)) {
    if (els[k]) base.elementos[k] = { ...base.elementos[k], ...els[k] };
  }
  return base;
}

/* ── Seção colapsável no painel ── */
function Section({ title, icon: Icon, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-zinc-800">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-bold text-zinc-400 uppercase tracking-wider hover:text-white transition-colors">
        <span className="flex items-center gap-2"><Icon size={12}/>{title}</span>
        {open ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

/* ── Slider com label ── */
function SliderRow({ label, value, min, max, step = 1, onChange, fmt = v => v }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="text-[10px] text-zinc-500">{label}</span>
        <span className="text-[10px] text-zinc-300 font-mono">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 accent-amber-500 cursor-pointer" />
    </div>
  );
}

/* ── Input numérico compacto ── */
function NumInput({ label, value, onChange, min = 0, max = 100, step = 1 }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] text-zinc-500 uppercase tracking-wide">{label}</span>
      <input type="number" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white text-center" />
    </label>
  );
}

/* ── Seletor de cor ── */
function ColorPicker({ label, value, onChange }) {
  const displayColor = value?.startsWith('rgba') || value?.startsWith('rgb') ? '#ffffff' : (value || '#ffffff');
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-zinc-400 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5">
        <div className="relative w-6 h-6 rounded overflow-hidden border border-zinc-600">
          <div className="absolute inset-0" style={{ background: value }} />
          <input type="color" value={displayColor} onChange={e => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
        </div>
        <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
          className="w-28 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-[11px] text-white font-mono" />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Canvas — preview interativo com drag e resize
══════════════════════════════════════════════════════════════ */
function BannerCanvas({ banner, ds, selected, onSelect, onMove, onResize, editingText, onStartEdit, onEndEdit }) {
  const containerRef = useRef(null);
  const { elementos: els, overlay, angulo } = ds;

  const ops = banner?.opcoes_escolha
    ? (typeof banner.opcoes_escolha === 'string' ? JSON.parse(banner.opcoes_escolha) : banner.opcoes_escolha)
    : [];

  /* Drag para mover */
  function startDrag(e, key) {
    if (editingText === key) return;
    e.preventDefault(); e.stopPropagation();
    onSelect(key);
    const rect = containerRef.current.getBoundingClientRect();
    const sx = e.touches ? e.touches[0].clientX : e.clientX;
    const sy = e.touches ? e.touches[0].clientY : e.clientY;
    const origX = els[key].x, origY = els[key].y;
    function mv(ev) {
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      onMove(key, {
        x: Math.round(Math.max(0, Math.min(95, origX + (cx - sx) / rect.width  * 100)) * 10) / 10,
        y: Math.round(Math.max(0, Math.min(96, origY + (cy - sy) / rect.height * 100)) * 10) / 10,
      });
    }
    function up() {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('touchmove', mv);
      window.removeEventListener('touchend', up);
    }
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', mv, { passive: false });
    window.addEventListener('touchend', up);
  }

  /* Drag da alça direita para resize de largura */
  function startResize(e, key) {
    e.preventDefault(); e.stopPropagation();
    const rect = containerRef.current.getBoundingClientRect();
    const sx = e.clientX;
    const origW = els[key].w ?? 50;
    function mv(ev) {
      const dx = (ev.clientX - sx) / rect.width * 100;
      onResize(key, Math.round(Math.max(10, Math.min(98, origW + dx))));
    }
    function up() {
      window.removeEventListener('mousemove', mv);
      window.removeEventListener('mouseup', up);
    }
    window.addEventListener('mousemove', mv);
    window.addEventListener('mouseup', up);
  }

  function elStyle(key, extra = {}) {
    const e = els[key];
    const isBadge = key === 'tag' || key === 'destaque';
    return {
      position: 'absolute',
      left: `${e.x}%`, top: `${e.y}%`,
      width: `${e.w ?? 50}%`,
      fontSize: e.size,
      color: e.cor,
      fontWeight: e.negrito ? 900 : 400,
      textAlign: e.align || 'left',
      fontFamily: e.fontFamily !== 'inherit' ? e.fontFamily : undefined,
      letterSpacing: e.letterSpacing ? `${e.letterSpacing}em` : undefined,
      lineHeight: e.lineHeight,
      opacity: e.opacity ?? 1,
      background: e.bg || undefined,
      borderRadius: isBadge ? 999 : 4,
      padding: isBadge ? '3px 12px' : '2px 0',
      backdropFilter: key === 'tag' ? 'blur(12px)' : undefined,
      textShadow: e.shadow ? '0 2px 8px rgba(0,0,0,0.8)' : undefined,
      display: e.oculto ? 'none' : (key === 'opcoes' ? 'flex' : 'block'),
      flexWrap: 'wrap', gap: 6,
      cursor: editingText === key ? 'text' : 'grab',
      userSelect: editingText === key ? 'text' : 'none',
      outline: selected === key && editingText !== key ? '1.5px dashed rgba(245,158,11,0.8)' : 'none',
      outlineOffset: 3,
      zIndex: selected === key ? 10 : 5,
      boxSizing: 'border-box',
      ...extra,
    };
  }

  /* Guias de snap (centro) */
  const showGuides = selected !== null;

  return (
    <div ref={containerRef}
      className="relative w-full rounded-2xl overflow-hidden select-none"
      style={{ aspectRatio: '16/7', background: '#111' }}
      onClick={e => { if (e.target === containerRef.current) onSelect(null); }}>

      {/* Fundo */}
      {banner?.img && (
        <img src={banner.img} alt="" draggable={false}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
      )}
      {(!banner?.img || banner?.usar_gradiente) && (
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(${angulo}deg, ${banner?.cor1 || '#7c2d12'}, ${banner?.cor2 || '#9a3412'})` }} />
      )}
      {/* Overlay escuro */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `linear-gradient(to top, rgba(0,0,0,${Math.min(overlay + 0.1, 1)}) 0%, rgba(0,0,0,${overlay * 0.4}) 50%, rgba(0,0,0,${overlay * 0.1}) 100%)` }} />

      {/* Guias de centro */}
      {showGuides && <>
        <div className="absolute inset-y-0 left-1/2 -translate-x-px pointer-events-none" style={{ width: 1, background: 'rgba(245,158,11,0.25)' }} />
        <div className="absolute inset-x-0 top-1/2 -translate-y-px pointer-events-none" style={{ height: 1, background: 'rgba(245,158,11,0.25)' }} />
      </>}

      {/* ── Elementos ── */}
      {['tag', 'destaque', 'titulo', 'subtitulo'].map(key => {
        const e = els[key];
        const texto = e.texto || (key === 'tag' ? banner?.tag : key === 'destaque' ? banner?.destaque : key === 'titulo' ? banner?.titulo : banner?.subtitulo) || '';
        if (!texto && !e.texto) return null;
        return (
          <div key={key} style={elStyle(key)}
            onMouseDown={ev => startDrag(ev, key)}
            onTouchStart={ev => startDrag(ev, key)}
            onDoubleClick={() => onStartEdit(key)}>
            {editingText === key ? (
              <span contentEditable suppressContentEditableWarning
                style={{ outline: 'none', display: 'block', minWidth: 20, whiteSpace: 'pre-wrap' }}
                onBlur={ev => onEndEdit(key, ev.currentTarget.textContent)}
                onKeyDown={ev => { if (ev.key === 'Escape' || ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); onEndEdit(key, ev.currentTarget.textContent); } }}
                ref={el => el && setTimeout(() => { const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }, 0)}>
                {texto}
              </span>
            ) : texto}
            {/* Alça de resize */}
            {selected === key && editingText !== key && (
              <div onMouseDown={ev => startResize(ev, key)}
                style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)', width: 12, height: 24, background: '#f59e0b', borderRadius: 3, cursor: 'ew-resize', zIndex: 20 }} />
            )}
          </div>
        );
      })}

      {/* Opções */}
      {ops.length > 0 && !els.opcoes.oculto && (
        <div style={elStyle('opcoes')}
          onMouseDown={ev => startDrag(ev, 'opcoes')}
          onTouchStart={ev => startDrag(ev, 'opcoes')}>
          {ops.map((op, i) => (
            <span key={i} style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', borderRadius: 999, padding: '2px 9px', fontSize: els.opcoes.size - 1, border: '1px solid rgba(255,255,255,0.3)', userSelect: 'none' }}>
              {op}
            </span>
          ))}
          {selected === 'opcoes' && (
            <div onMouseDown={ev => startResize(ev, 'opcoes')}
              style={{ position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)', width: 12, height: 24, background: '#f59e0b', borderRadius: 3, cursor: 'ew-resize', zIndex: 20 }} />
          )}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Painel de propriedades
══════════════════════════════════════════════════════════════ */
function PropsPanel({ elKey, el, onChange, banner }) {
  if (!el || !elKey) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-2 px-6 text-center">
      <Type size={28} className="text-zinc-700" />
      <p className="text-zinc-600 text-xs">Clique em um elemento no canvas para editar suas propriedades</p>
      <p className="text-zinc-700 text-[10px]">Duplo clique para editar o texto</p>
    </div>
  );

  const labels = { tag: '🏷️ Tag', destaque: '⭐ Destaque', titulo: '📝 Título', subtitulo: '💬 Subtítulo', opcoes: '📋 Opções' };
  const defaultText = { tag: banner?.tag, destaque: banner?.destaque, titulo: banner?.titulo, subtitulo: banner?.subtitulo, opcoes: '' };

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header do elemento */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
        <h3 className="font-bold text-white text-sm">{labels[elKey]}</h3>
        <button onClick={() => onChange({ ...el, oculto: !el.oculto })}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${el.oculto ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-700 text-emerald-400'}`}>
          {el.oculto ? <EyeOff size={12}/> : <Eye size={12}/>}
          {el.oculto ? 'Oculto' : 'Visível'}
        </button>
      </div>

      {/* Texto personalizado */}
      {elKey !== 'opcoes' && (
        <Section title="Texto" icon={Type}>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Conteúdo (vazio = usa texto do banner)</label>
            <textarea value={el.texto || ''} rows={2}
              onChange={e => onChange({ ...el, texto: e.target.value })}
              placeholder={defaultText[elKey] || ''}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white resize-none placeholder:text-zinc-600" />
          </div>
          <div>
            <label className="text-[10px] text-zinc-500 block mb-1">Fonte</label>
            <select value={el.fontFamily || 'inherit'} onChange={e => onChange({ ...el, fontFamily: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white">
              {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
        </Section>
      )}

      {/* Tipografia */}
      <Section title="Tipografia" icon={Bold}>
        <SliderRow label="Tamanho" value={el.size} min={8} max={64} onChange={v => onChange({ ...el, size: v })} fmt={v => `${v}px`} />
        <SliderRow label="Opacidade" value={Math.round((el.opacity ?? 1) * 100)} min={10} max={100} onChange={v => onChange({ ...el, opacity: v / 100 })} fmt={v => `${v}%`} />
        {(elKey === 'titulo' || elKey === 'subtitulo') && (
          <SliderRow label="Line height" value={Math.round((el.lineHeight ?? 1.2) * 10)} min={8} max={20} step={1} onChange={v => onChange({ ...el, lineHeight: v / 10 })} fmt={v => (v/10).toFixed(1)} />
        )}
        <SliderRow label="Espaç. letras" value={Math.round((el.letterSpacing ?? 0) * 100)} min={-5} max={20} onChange={v => onChange({ ...el, letterSpacing: v / 100 })} fmt={v => `${v > 0 ? '+' : ''}${(v/100).toFixed(2)}em`} />
        <div className="flex gap-2">
          <button onClick={() => onChange({ ...el, negrito: !el.negrito })}
            className={`flex-1 py-1.5 rounded text-xs flex items-center justify-center gap-1 font-bold ${el.negrito ? 'bg-amber-600 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
            <Bold size={12}/> Negrito
          </button>
          <button onClick={() => onChange({ ...el, shadow: !el.shadow })}
            className={`flex-1 py-1.5 rounded text-xs font-bold ${el.shadow ? 'bg-amber-600 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
            Sombra
          </button>
        </div>
        <div className="flex gap-1">
          {['left','center','right'].map(a => (
            <button key={a} onClick={() => onChange({ ...el, align: a })}
              className={`flex-1 py-1.5 rounded text-xs flex items-center justify-center ${el.align === a ? 'bg-amber-600 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
              {a === 'left' ? <AlignLeft size={12}/> : a === 'center' ? <AlignCenter size={12}/> : <AlignRight size={12}/>}
            </button>
          ))}
        </div>
      </Section>

      {/* Cores */}
      <Section title="Cores" icon={Palette}>
        <ColorPicker label="Texto" value={el.cor} onChange={v => onChange({ ...el, cor: v })} />
        {(elKey === 'tag' || elKey === 'destaque') && (
          <ColorPicker label="Fundo" value={el.bg || 'rgba(0,0,0,0)'} onChange={v => onChange({ ...el, bg: v })} />
        )}
      </Section>

      {/* Posição */}
      <Section title="Posição & Tamanho" icon={Maximize2}>
        <div className="grid grid-cols-3 gap-2">
          <NumInput label="X (%)" value={el.x} onChange={v => onChange({ ...el, x: v })} />
          <NumInput label="Y (%)" value={el.y} onChange={v => onChange({ ...el, y: v })} />
          <NumInput label="W (%)" value={el.w ?? 50} onChange={v => onChange({ ...el, w: v })} max={100} />
        </div>
        <p className="text-[9px] text-zinc-600">Dica: use as setas do teclado para mover com precisão</p>
      </Section>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Página principal
══════════════════════════════════════════════════════════════ */
export default function EditorBanner() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [banner, setBanner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ds, setDs] = useState(() => mergeDesign(null));  // { elementos, overlay, angulo }
  const [selected, setSelected] = useState(null);
  const [editingText, setEditingText] = useState(null);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewport, setViewport] = useState('desktop');
  const [leftTab, setLeftTab] = useState('camadas');

  /* Carrega banner */
  useEffect(() => {
    const token = getToken();
    fetch(`${BASE}/ia/banners`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.ok ? r.json() : [])
      .then(list => {
        const b = list.find(x => String(x.id) === String(id));
        setBanner(b || false);
        if (b) setDs(mergeDesign(b.design));
      })
      .catch(() => setBanner(false))
      .finally(() => setLoading(false));
  }, [id]);

  /* Atalhos de teclado */
  useEffect(() => {
    function onKey(e) {
      if (editingText) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
      if (!selected) return;
      const step = e.shiftKey ? 2 : 0.5;
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) {
        e.preventDefault();
        push();
        setDs(d => {
          const el = { ...d.elementos[selected] };
          if (e.key === 'ArrowLeft')  el.x = Math.max(0, el.x - step);
          if (e.key === 'ArrowRight') el.x = Math.min(95, el.x + step);
          if (e.key === 'ArrowUp')    el.y = Math.max(0, el.y - step);
          if (e.key === 'ArrowDown')  el.y = Math.min(96, el.y + step);
          return { ...d, elementos: { ...d.elementos, [selected]: el } };
        });
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          push();
          setDs(d => ({ ...d, elementos: { ...d.elementos, [selected]: { ...d.elementos[selected], oculto: true } } }));
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, editingText]);

  function push() {
    setHistory(h => [...h.slice(-29), structuredClone(ds)]);
  }
  function undo() {
    setHistory(h => {
      if (!h.length) return h;
      setDs(h[h.length - 1]);
      return h.slice(0, -1);
    });
  }

  function updateEl(key, newEl) {
    push();
    setDs(d => ({ ...d, elementos: { ...d.elementos, [key]: newEl } }));
  }

  function moveEl(key, pos) {
    setDs(d => ({ ...d, elementos: { ...d.elementos, [key]: { ...d.elementos[key], ...pos } } }));
  }

  function resizeEl(key, w) {
    setDs(d => ({ ...d, elementos: { ...d.elementos, [key]: { ...d.elementos[key], w } } }));
  }

  function startEdit(key) {
    setSelected(key);
    setEditingText(key);
  }

  function endEdit(key, text) {
    setEditingText(null);
    push();
    setDs(d => ({ ...d, elementos: { ...d.elementos, [key]: { ...d.elementos[key], texto: text } } }));
  }

  async function save() {
    if (!banner) return;
    setSaving(true);
    try {
      const payload = {
        ...banner,
        opcoes_escolha: banner.opcoes_escolha
          ? (typeof banner.opcoes_escolha === 'string' ? JSON.parse(banner.opcoes_escolha) : banner.opcoes_escolha)
          : [],
        design: { v: 2, elementos: ds.elementos, overlay: ds.overlay, angulo: ds.angulo },
      };
      const token = getToken();
      const r = await fetch(`${BASE}/ia/banners/${banner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    } finally { setSaving(false); }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-zinc-500 text-sm">Carregando banner…</div>
    </div>
  );
  if (!banner) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'var(--bg)' }}>
      <p className="text-zinc-400">Banner não encontrado (id: {id})</p>
      <button onClick={() => navigate(-1)} className="text-sm text-amber-400 underline">Voltar</button>
    </div>
  );

  const selectedEl = selected ? ds.elementos[selected] : null;
  const layers = [
    { key: 'tag',       label: 'Tag',       show: !!banner.tag },
    { key: 'destaque',  label: 'Destaque',  show: !!banner.destaque },
    { key: 'titulo',    label: 'Título',    show: true },
    { key: 'subtitulo', label: 'Subtítulo', show: !!banner.subtitulo },
    { key: 'opcoes',    label: 'Opções',    show: !!(banner.opcoes_escolha && JSON.parse(typeof banner.opcoes_escolha === 'string' ? banner.opcoes_escolha : '[]').length) },
  ].filter(l => l.show);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── Top bar ── */}
      <header className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/90 backdrop-blur sticky top-0 z-20 shrink-0">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-sm mr-1">
          <ArrowLeft size={15}/> Voltar
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-zinc-600 leading-none">Editor de Banner</p>
          <p className="text-sm font-bold text-white truncate leading-tight">{banner.titulo}</p>
        </div>

        {/* Viewport toggle */}
        <div className="flex rounded-lg overflow-hidden border border-zinc-700">
          <button onClick={() => setViewport('desktop')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors ${viewport === 'desktop' ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
            <Monitor size={12}/> Desktop
          </button>
          <button onClick={() => setViewport('mobile')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-colors ${viewport === 'mobile' ? 'bg-zinc-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
            <Smartphone size={12}/> Mobile
          </button>
        </div>

        <button onClick={undo} disabled={history.length === 0} title="Desfazer (Ctrl+Z)"
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-30 transition-colors">
          <RotateCcw size={15}/>
        </button>
        <button onClick={save} disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${saved ? 'bg-emerald-600 text-white' : 'text-white'}`}
          style={!saved ? { background: 'var(--accent)' } : {}}>
          <Save size={14}/>
          {saving ? 'Salvando…' : saved ? '✓ Salvo!' : 'Salvar'}
        </button>
      </header>

      {/* ── Layout 3 colunas ── */}
      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>

        {/* ── Coluna esquerda ── */}
        <aside className="w-52 shrink-0 border-r border-zinc-800 bg-zinc-900 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-zinc-800">
            {[['camadas', <Layers size={12}/>,'Camadas'], ['fundo', <Image size={12}/>,'Fundo']].map(([tab, icon, label]) => (
              <button key={tab} onClick={() => setLeftTab(tab)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold transition-colors ${leftTab === tab ? 'text-amber-400 border-b-2 border-amber-500' : 'text-zinc-500 hover:text-zinc-300'}`}>
                {icon}{label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {leftTab === 'camadas' && (
              <div className="p-3 space-y-1">
                {layers.map(({ key, label }) => {
                  const e = ds.elementos[key];
                  const isSelected = selected === key;
                  return (
                    <button key={key} onClick={() => setSelected(isSelected ? null : key)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-sm transition-all ${isSelected ? 'bg-amber-600/20 text-amber-300 border border-amber-600/30' : 'bg-zinc-800/60 text-zinc-300 border border-transparent hover:bg-zinc-800'}`}>
                      <span className="flex items-center gap-2 text-sm">
                        <Layers size={12} className={isSelected ? 'text-amber-400' : 'text-zinc-600'} />
                        {label}
                      </span>
                      <button onClick={ev => { ev.stopPropagation(); updateEl(key, { ...e, oculto: !e.oculto }); }}
                        className={`transition-colors ${e.oculto ? 'text-zinc-700 hover:text-zinc-400' : 'text-zinc-400 hover:text-white'}`}>
                        {e.oculto ? <EyeOff size={13}/> : <Eye size={13}/>}
                      </button>
                    </button>
                  );
                })}
                <p className="text-[9px] text-zinc-700 px-1 pt-2">
                  ↑↓← → mover selecionado<br/>
                  Shift + seta = passo maior<br/>
                  Delete = ocultar<br/>
                  Duplo clique = editar texto
                </p>
              </div>
            )}

            {leftTab === 'fundo' && (
              <div className="p-3 space-y-4">
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Presets</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {GRADIENT_PRESETS.map(p => (
                      <button key={p.label} title={p.label}
                        onClick={() => setBanner(b => ({ ...b, cor1: p.c1, cor2: p.c2 }))}
                        className="w-full aspect-square rounded-lg border-2 border-transparent hover:border-amber-500 transition-all"
                        style={{ background: `linear-gradient(135deg, ${p.c1}, ${p.c2})` }} />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">Cor 1</span>
                    <div className="flex items-center gap-1.5">
                      <div className="relative w-6 h-6 rounded border border-zinc-600 overflow-hidden">
                        <div className="absolute inset-0" style={{ background: banner.cor1 }} />
                        <input type="color" value={banner.cor1 || '#7c2d12'} onChange={e => setBanner(b => ({ ...b, cor1: e.target.value }))}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                      </div>
                      <input type="text" value={banner.cor1 || '#7c2d12'} onChange={e => setBanner(b => ({ ...b, cor1: e.target.value }))}
                        className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-[11px] text-white font-mono" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-400">Cor 2</span>
                    <div className="flex items-center gap-1.5">
                      <div className="relative w-6 h-6 rounded border border-zinc-600 overflow-hidden">
                        <div className="absolute inset-0" style={{ background: banner.cor2 }} />
                        <input type="color" value={banner.cor2 || '#9a3412'} onChange={e => setBanner(b => ({ ...b, cor2: e.target.value }))}
                          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                      </div>
                      <input type="text" value={banner.cor2 || '#9a3412'} onChange={e => setBanner(b => ({ ...b, cor2: e.target.value }))}
                        className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 text-[11px] text-white font-mono" />
                    </div>
                  </div>
                </div>
                <SliderRow label="Ângulo do gradiente" value={ds.angulo} min={0} max={360}
                  onChange={v => setDs(d => ({ ...d, angulo: v }))} fmt={v => `${v}°`} />
                <SliderRow label="Escurecimento" value={Math.round(ds.overlay * 100)} min={0} max={90}
                  onChange={v => setDs(d => ({ ...d, overlay: v / 100 }))} fmt={v => `${v}%`} />
              </div>
            )}
          </div>
        </aside>

        {/* ── Centro: canvas ── */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto gap-3" style={{ minHeight: 0 }}>
          {viewport === 'mobile' ? (
            <div className="flex flex-col items-center gap-2">
              <div style={{ width: 320, background: '#18181b', borderRadius: 36, border: '3px solid #3f3f46', padding: '10px 6px', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
                <div className="flex justify-center mb-1.5">
                  <div style={{ width: 48, height: 5, background: '#3f3f46', borderRadius: 99 }} />
                </div>
                <div style={{ borderRadius: 14, overflow: 'hidden' }}>
                  <BannerCanvas banner={banner} ds={ds} selected={selected} onSelect={setSelected}
                    onMove={moveEl} onResize={resizeEl} editingText={editingText}
                    onStartEdit={startEdit} onEndEdit={endEdit} />
                </div>
                <div className="flex justify-center mt-1.5">
                  <div style={{ width: 32, height: 5, background: '#3f3f46', borderRadius: 99 }} />
                </div>
              </div>
              <p className="text-[10px] text-zinc-600">Visualização mobile · 375px</p>
            </div>
          ) : (
            <div className="w-full max-w-3xl">
              <BannerCanvas banner={banner} ds={ds} selected={selected} onSelect={setSelected}
                onMove={moveEl} onResize={resizeEl} editingText={editingText}
                onStartEdit={startEdit} onEndEdit={endEdit} />
            </div>
          )}
          <p className="text-[10px] text-zinc-700">
            {selected ? `"${selected}" selecionado — setas para mover, duplo clique para editar texto` : 'Clique em um elemento para selecionar'}
          </p>
        </main>

        {/* ── Coluna direita: propriedades ── */}
        <aside className="w-64 shrink-0 border-l border-zinc-800 bg-zinc-900 flex flex-col overflow-hidden">
          <div className="px-4 py-2.5 border-b border-zinc-800 shrink-0">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders size={11}/> Propriedades
            </p>
          </div>
          <PropsPanel
            elKey={selected}
            el={selectedEl}
            onChange={el => updateEl(selected, el)}
            banner={banner}
          />
        </aside>
      </div>
    </div>
  );
}
