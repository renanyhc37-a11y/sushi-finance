import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Eye, EyeOff, Move, Type, Palette,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic,
  ChevronUp, ChevronDown, RotateCcw, Layers
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL ?? '';

/* ── Defaults de posição/estilo para cada elemento ── */
const DEFAULTS = {
  tag:      { x: 4,  y: 6,  size: 11, cor: '#ffffff', bg: 'rgba(0,0,0,0.45)', negrito: true,  oculto: false, align: 'left' },
  destaque: { x: 60, y: 5,  size: 13, cor: '#ffffff', bg: 'rgba(245,158,11,0.9)', negrito: true, oculto: false, align: 'center' },
  titulo:   { x: 4,  y: 62, size: 24, cor: '#ffffff', bg: '',                negrito: true,  oculto: false, align: 'left' },
  subtitulo:{ x: 4,  y: 79, size: 13, cor: 'rgba(255,255,255,0.8)', bg: '', negrito: false, oculto: false, align: 'left' },
  opcoes:   { x: 4,  y: 91, size: 12, cor: '#ffffff', bg: '',                negrito: false, oculto: false, align: 'left' },
};

function mergeDesign(saved) {
  if (!saved) return structuredClone(DEFAULTS);
  const base = structuredClone(DEFAULTS);
  const src = typeof saved === 'string' ? JSON.parse(saved) : saved;
  const els = src.elementos || {};
  for (const k of Object.keys(base)) {
    if (els[k]) base[k] = { ...base[k], ...els[k] };
  }
  return base;
}

/* ── Mini input numérico ── */
function NumInput({ label, value, onChange, min = 0, max = 100, step = 1 }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-zinc-500 uppercase tracking-wide">{label}</label>
      <input
        type="number" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white text-center"
      />
    </div>
  );
}

/* ── Color picker row ── */
function ColorRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-zinc-400">{label}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={value.startsWith('rgba') ? '#ffffff' : value}
          onChange={e => onChange(e.target.value)}
          className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="w-28 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white font-mono" />
      </div>
    </div>
  );
}

/* ── Painel de propriedades do elemento selecionado ── */
function PropsPanel({ el, elKey, onChange }) {
  if (!el) return (
    <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm p-4 text-center">
      Clique em um elemento no canvas para editar suas propriedades
    </div>
  );

  const labels = { tag: 'Tag', destaque: 'Destaque', titulo: 'Título', subtitulo: 'Subtítulo', opcoes: 'Opções' };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-white text-sm">{labels[elKey]}</h3>
        <button
          onClick={() => onChange({ ...el, oculto: !el.oculto })}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${el.oculto ? 'bg-zinc-700 text-zinc-400' : 'bg-zinc-700 text-white'}`}>
          {el.oculto ? <EyeOff size={12}/> : <Eye size={12}/>}
          {el.oculto ? 'Oculto' : 'Visível'}
        </button>
      </div>

      {/* Posição */}
      <div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Posição (%)</p>
        <div className="grid grid-cols-2 gap-2">
          <NumInput label="X" value={el.x} onChange={v => onChange({ ...el, x: v })} />
          <NumInput label="Y" value={el.y} onChange={v => onChange({ ...el, y: v })} />
        </div>
      </div>

      {/* Tipografia */}
      <div>
        <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Tipografia</p>
        <NumInput label="Tamanho (px)" value={el.size} onChange={v => onChange({ ...el, size: v })} min={8} max={72} />
        <div className="flex gap-2 mt-2">
          <button onClick={() => onChange({ ...el, negrito: !el.negrito })}
            className={`flex-1 py-1.5 rounded text-xs flex items-center justify-center gap-1 ${el.negrito ? 'bg-amber-600 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
            <Bold size={12}/> Negrito
          </button>
          {['left', 'center', 'right'].map(a => (
            <button key={a} onClick={() => onChange({ ...el, align: a })}
              className={`flex-1 py-1.5 rounded text-xs flex items-center justify-center ${el.align === a ? 'bg-amber-600 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
              {a === 'left' ? <AlignLeft size={12}/> : a === 'center' ? <AlignCenter size={12}/> : <AlignRight size={12}/>}
            </button>
          ))}
        </div>
      </div>

      {/* Cores */}
      <div className="space-y-2">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Cores</p>
        <ColorRow label="Texto" value={el.cor} onChange={v => onChange({ ...el, cor: v })} />
        {(elKey === 'tag' || elKey === 'destaque') && (
          <ColorRow label="Fundo" value={el.bg || 'rgba(0,0,0,0)'} onChange={v => onChange({ ...el, bg: v })} />
        )}
      </div>
    </div>
  );
}

/* ── Canvas: preview do banner com elementos arrastáveis ── */
function BannerCanvas({ banner, design, selected, onSelect, onMove }) {
  const containerRef = useRef(null);
  const dragRef = useRef(null);

  const startDrag = useCallback((e, key) => {
    e.preventDefault();
    onSelect(key);
    const rect = containerRef.current.getBoundingClientRect();
    const startX = (e.touches ? e.touches[0].clientX : e.clientX);
    const startY = (e.touches ? e.touches[0].clientY : e.clientY);
    const startEl = { ...design[key] };

    function onMove2(ev) {
      const cx = ev.touches ? ev.touches[0].clientX : ev.clientX;
      const cy = ev.touches ? ev.touches[0].clientY : ev.clientY;
      const dx = ((cx - startX) / rect.width) * 100;
      const dy = ((cy - startY) / rect.height) * 100;
      onMove(key, {
        x: Math.round(Math.max(0, Math.min(95, startEl.x + dx))),
        y: Math.round(Math.max(0, Math.min(96, startEl.y + dy))),
      });
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove2);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove2);
      window.removeEventListener('touchend', onUp);
    }
    window.addEventListener('mousemove', onMove2);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove2, { passive: false });
    window.addEventListener('touchend', onUp);
    dragRef.current = onUp;
  }, [design, onMove, onSelect]);

  const ops = banner?.opcoes_escolha
    ? (typeof banner.opcoes_escolha === 'string' ? JSON.parse(banner.opcoes_escolha) : banner.opcoes_escolha)
    : [];

  const el = (key) => design[key];
  const style = (key, extra = {}) => ({
    position: 'absolute',
    left: `${el(key).x}%`,
    top: `${el(key).y}%`,
    fontSize: el(key).size,
    color: el(key).cor,
    fontWeight: el(key).negrito ? 900 : 400,
    textAlign: el(key).align || 'left',
    background: el(key).bg || undefined,
    cursor: 'grab',
    userSelect: 'none',
    outline: selected === key ? '2px dashed #f59e0b' : '2px dashed transparent',
    outlineOffset: 3,
    borderRadius: (key === 'tag' || key === 'destaque') ? 999 : 4,
    padding: (key === 'tag' || key === 'destaque') ? '3px 10px' : '2px 4px',
    backdropFilter: (key === 'tag') ? 'blur(12px)' : undefined,
    display: el(key).oculto ? 'none' : undefined,
    zIndex: selected === key ? 10 : 5,
    maxWidth: '90%',
    ...extra,
  });

  return (
    <div ref={containerRef}
      className="relative w-full rounded-2xl overflow-hidden select-none"
      style={{ aspectRatio: '16/7', background: '#111' }}
      onClick={e => { if (e.target === containerRef.current) onSelect(null); }}>

      {/* Fundo */}
      {banner?.img && (
        <img src={banner.img} alt="" draggable={false}
          className="absolute inset-0 w-full h-full object-cover" />
      )}
      {(!banner?.img || banner?.usar_gradiente) && (
        <div className="absolute inset-0"
          style={{ background: `linear-gradient(${design._angulo || 110}deg, ${banner?.cor1 || '#7c2d12'}, ${banner?.cor2 || '#9a3412'})` }} />
      )}
      {/* Sombra */}
      <div className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.0) 100%)' }} />

      {/* Tag */}
      {banner?.tag && (
        <span style={style('tag')}
          onMouseDown={e => startDrag(e, 'tag')}
          onTouchStart={e => startDrag(e, 'tag')}>
          {banner.tag}
        </span>
      )}

      {/* Destaque */}
      {banner?.destaque && (
        <div style={style('destaque')}
          onMouseDown={e => startDrag(e, 'destaque')}
          onTouchStart={e => startDrag(e, 'destaque')}>
          {banner.destaque}
        </div>
      )}

      {/* Título */}
      <h2 style={{ ...style('titulo'), textShadow: '0 2px 12px rgba(0,0,0,0.7)', lineHeight: 1.15 }}
        onMouseDown={e => startDrag(e, 'titulo')}
        onTouchStart={e => startDrag(e, 'titulo')}>
        {banner?.titulo || 'Título'}
      </h2>

      {/* Subtítulo */}
      {banner?.subtitulo && (
        <p style={{ ...style('subtitulo'), textShadow: '0 1px 6px rgba(0,0,0,0.7)', lineHeight: 1.3 }}
          onMouseDown={e => startDrag(e, 'subtitulo')}
          onTouchStart={e => startDrag(e, 'subtitulo')}>
          {banner.subtitulo}
        </p>
      )}

      {/* Opções */}
      {ops.length > 0 && (
        <div style={{ ...style('opcoes'), display: el('opcoes').oculto ? 'none' : 'flex', gap: 6, flexWrap: 'wrap' }}
          onMouseDown={e => startDrag(e, 'opcoes')}
          onTouchStart={e => startDrag(e, 'opcoes')}>
          {ops.map((op, i) => (
            <span key={i} style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: el('opcoes').size - 1, border: '1px solid rgba(255,255,255,0.3)' }}>
              {op}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Lista de layers (elementos) ── */
function LayerList({ banner, design, selected, onSelect, onChange }) {
  const layers = [
    { key: 'tag', label: 'Tag', show: !!banner?.tag },
    { key: 'destaque', label: 'Destaque', show: !!banner?.destaque },
    { key: 'titulo', label: 'Título', show: true },
    { key: 'subtitulo', label: 'Subtítulo', show: !!banner?.subtitulo },
    { key: 'opcoes', label: 'Opções', show: !!banner?.opcoes_escolha },
  ].filter(l => l.show);

  return (
    <div className="space-y-1 p-3">
      <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2 px-1">Camadas</p>
      {layers.map(({ key, label }) => {
        const el = design[key];
        return (
          <button key={key}
            onClick={() => onSelect(key)}
            className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${selected === key ? 'bg-amber-600/20 text-amber-400 border border-amber-600/40' : 'bg-zinc-800 text-zinc-300 border border-transparent hover:bg-zinc-700'}`}>
            <span className="flex items-center gap-2">
              <Layers size={13} />
              {label}
            </span>
            <button
              onClick={e => { e.stopPropagation(); onChange(key, { ...el, oculto: !el.oculto }); }}
              className="text-zinc-500 hover:text-white">
              {el?.oculto ? <EyeOff size={13}/> : <Eye size={13}/>}
            </button>
          </button>
        );
      })}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Página principal: EditorBanner
══════════════════════════════════════════════════════════════ */
export default function EditorBanner() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [banner, setBanner] = useState(null);
  const [design, setDesign] = useState(structuredClone(DEFAULTS));
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  /* Carrega banner */
  useEffect(() => {
    fetch(`${BASE}/ia/banners`)
      .then(r => r.json())
      .then(list => {
        const b = list.find(x => String(x.id) === String(id));
        if (!b) return;
        setBanner(b);
        setDesign(mergeDesign(b.design));
      });
  }, [id]);

  /* Empurra snapshot no histórico antes de cada mudança */
  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(-19), structuredClone(design)]);
  }, [design]);

  const updateEl = useCallback((key, newEl) => {
    pushHistory();
    setDesign(d => ({ ...d, [key]: newEl }));
  }, [pushHistory]);

  const moveEl = useCallback((key, pos) => {
    setDesign(d => ({ ...d, [key]: { ...d[key], ...pos } }));
  }, []);

  const undo = useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setDesign(prev);
      return h.slice(0, -1);
    });
  }, []);

  const resetEl = useCallback((key) => {
    pushHistory();
    setDesign(d => ({ ...d, [key]: { ...DEFAULTS[key] } }));
  }, [pushHistory]);

  const save = async () => {
    if (!banner) return;
    setSaving(true);
    try {
      const payload = {
        ...banner,
        opcoes_escolha: banner.opcoes_escolha
          ? (typeof banner.opcoes_escolha === 'string' ? JSON.parse(banner.opcoes_escolha) : banner.opcoes_escolha)
          : [],
        design: { v: 1, elementos: design },
      };
      const token = localStorage.getItem('token');
      const r = await fetch(`${BASE}/ia/banners/${banner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    } finally {
      setSaving(false);
    }
  };

  if (!banner) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-zinc-500">Carregando banner…</div>
    </div>
  );

  const selectedEl = selected ? design[selected] : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* ── Top bar ── */}
      <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-20">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-sm">
          <ArrowLeft size={16}/> Voltar
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-zinc-500 truncate">Editor de Banner</p>
          <p className="text-sm font-bold text-white truncate">{banner.titulo}</p>
        </div>
        <button onClick={undo} disabled={history.length === 0}
          title="Desfazer (Ctrl+Z)"
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-30 transition-colors">
          <RotateCcw size={16}/>
        </button>
        <button onClick={save} disabled={saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${saved ? 'bg-green-600 text-white' : 'text-white'}`}
          style={!saved ? { background: 'var(--accent)' } : {}}>
          <Save size={15}/>
          {saving ? 'Salvando…' : saved ? 'Salvo!' : 'Salvar'}
        </button>
      </header>

      {/* ── Layout 3 colunas ── */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 57px)' }}>

        {/* Coluna esquerda: layers */}
        <aside className="w-52 shrink-0 border-r border-zinc-800 bg-zinc-900 overflow-y-auto">
          <LayerList
            banner={banner}
            design={design}
            selected={selected}
            onSelect={setSelected}
            onChange={updateEl}
          />

          {/* Gradiente de fundo */}
          <div className="px-3 pb-3 border-t border-zinc-800 mt-2 pt-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-2">Fundo</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-zinc-400">Cor 1</span>
                <input type="color" value={banner.cor1 || '#7c2d12'}
                  onChange={e => setBanner(b => ({ ...b, cor1: e.target.value }))}
                  className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-zinc-400">Cor 2</span>
                <input type="color" value={banner.cor2 || '#9a3412'}
                  onChange={e => setBanner(b => ({ ...b, cor2: e.target.value }))}
                  className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0" />
              </div>
            </div>
          </div>
        </aside>

        {/* Centro: canvas */}
        <main className="flex-1 flex flex-col items-center justify-center p-6 overflow-auto gap-4">
          <div className="w-full max-w-2xl">
            <BannerCanvas
              banner={banner}
              design={design}
              selected={selected}
              onSelect={setSelected}
              onMove={moveEl}
            />
          </div>
          <p className="text-xs text-zinc-600 text-center">
            Arraste os elementos para reposicioná-los • Clique para selecionar e editar propriedades
          </p>

          {/* Botão de reset do elemento selecionado */}
          {selected && (
            <button onClick={() => resetEl(selected)}
              className="text-xs text-zinc-500 hover:text-amber-400 transition-colors flex items-center gap-1">
              <RotateCcw size={11}/> Resetar posição de "{selected}"
            </button>
          )}
        </main>

        {/* Coluna direita: propriedades */}
        <aside className="w-64 shrink-0 border-l border-zinc-800 bg-zinc-900 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
              <Palette size={13}/> Propriedades
            </h2>
          </div>
          <PropsPanel
            el={selectedEl}
            elKey={selected}
            onChange={el => updateEl(selected, el)}
          />
        </aside>
      </div>
    </div>
  );
}
