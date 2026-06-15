import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { getToken } from '../hooks/useAuth';
import {
  GlassWater, Boxes, IceCreamCone, Flame, Fish, CircleDot, Soup, Salad,
  Star, UtensilsCrossed, ShoppingCart, Settings, Pause, Circle, Leaf,
  Pencil, X, MessageSquare, Trash2, Check, CheckCircle2, Bike, Tag, MapPin,
  PartyPopper, Lightbulb, Smartphone, Banknote, CreditCard, User, ArrowLeft,
  ArrowRight, Gift, Hand, ShoppingBag, Phone, Truck, Loader2, AlertTriangle, Clock,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '/api';
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ── Tráfego pago: pixels de conversão + UTM ──────────────────
// Captura os parâmetros de campanha (?utm_source=...) da URL e guarda no
// dispositivo, pra atribuir o pedido à origem do anúncio mesmo depois de o
// cliente navegar pelo cardápio. Validade: 30 dias.
function capturarUTM() {
  try {
    const p = new URLSearchParams(window.location.search);
    const src = p.get('utm_source');
    if (src) {
      const utm = { source: src, medium: p.get('utm_medium') || '', campaign: p.get('utm_campaign') || '', ts: Date.now() };
      localStorage.setItem('sushi_utm', JSON.stringify(utm));
    }
  } catch {}
}
function getUTM() {
  try {
    const u = JSON.parse(localStorage.getItem('sushi_utm') || 'null');
    if (u && Date.now() - (u.ts || 0) < 30 * 864e5) return { source: u.source, medium: u.medium, campaign: u.campaign };
  } catch {}
  return null;
}
// Injeta o Meta Pixel (Facebook/Instagram) uma única vez
function injetarMetaPixel(id) {
  if (!id || window.fbq) return;
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  window.fbq('init', id);
  window.fbq('track', 'PageView');
}
// Injeta o Google Analytics 4 / Google Ads (gtag) uma única vez
function injetarGA(id) {
  if (!id || window.gtag) return;
  const s = document.createElement('script');
  s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){ window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', id);
}
// Dispara o evento de COMPRA nos pixels (para a plataforma otimizar e medir)
function dispararCompra(valor, pedidoId) {
  try { if (window.fbq) window.fbq('track', 'Purchase', { value: Number(valor) || 0, currency: 'BRL' }); } catch {}
  try { if (window.gtag) window.gtag('event', 'purchase', { transaction_id: String(pedidoId || ''), value: Number(valor) || 0, currency: 'BRL' }); } catch {}
}

// Mapeia o nome da categoria para um ícone relacionado (fallback: pratos)
function iconeCategoria(nome) {
  const n = (nome || '').toLowerCase();
  if (/bebida|suco|refri|água|agua|drink|cerveja|saqu|coca|guaran|chá|cha\b|água/.test(n)) return GlassWater;
  if (/combo|combinad|fam[íi]lia|festival|kit/.test(n)) return Boxes;
  if (/temaki|cone/.test(n)) return IceCreamCone;
  if (/hot|quente|frit|empan|tempura|yaki|grelhad|crocante/.test(n)) return Flame;
  if (/sashimi/.test(n)) return Fish;
  if (/sushi|niguir|nigiri|sake|uramaki|maki|roll|enrolad|joy|filad|califórnia|california/.test(n)) return CircleDot;
  if (/sopa|misso|caldo|ramen|lamen|guioza|gyoza/.test(n)) return Soup;
  if (/poke|salad|bowl/.test(n)) return Salad;
  if (/veg|verde|legume/.test(n)) return Leaf;
  if (/sobremesa|doce|dessert|mochi|sorvete/.test(n)) return IceCreamCone;
  if (/promo|destaq|especial|premium|chef|novidad/.test(n)) return Star;
  return UtensilsCrossed;
}

// ── Banners do carrossel ──────────────────────────────────────
// Edite aqui para personalizar as promoções
const BANNERS = [
  {
    id: 1,
    tag: '🔥 Promoção',
    titulo: 'Combo Família',
    subtitulo: '4 temakis + 2 missoshiru por apenas R$ 89,90',
    cor1: '#7c2d12', cor2: '#9a3412',
    destaque: 'R$ 89,90',
    emoji: '🍣',
    img: 'https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=800&q=80',
  },
  {
    id: 2,
    tag: '🚚 Frete',
    titulo: 'Entrega Grátis',
    subtitulo: 'Em pedidos acima de R$ 80,00 no raio de 5km',
    cor1: '#064e3b', cor2: '#065f46',
    destaque: 'Grátis',
    emoji: '🛵',
    img: 'https://images.unsplash.com/photo-1559410545-0bdcd187e0a6?w=800&q=80',
  },
  {
    id: 3,
    tag: '✨ Novidade',
    titulo: 'Hot Roll Especial',
    subtitulo: 'Salmão grelhado, cream cheese e cebolinha crocante',
    cor1: '#1e1b4b', cor2: '#312e81',
    destaque: 'Novo!',
    emoji: '🔥',
    img: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=800&q=80',
  },
  {
    id: 4,
    tag: '⭐ Destaque',
    titulo: 'Sashimi Premium',
    subtitulo: 'Salmão, atum e robalo fresquinhos toda sexta e sábado',
    cor1: '#1a1a2e', cor2: '#16213e',
    destaque: 'Sab & Dom',
    emoji: '🐟',
    img: 'https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&q=80',
  },
];

// ── BannerModal — detalhe do banner ao clicar ─────────────────
function BannerModal({ banner, onClose, onVerCardapio, onAbrirItem }) {
  const [closing, setClosing] = useState(false);
  function close() { setClosing(true); setTimeout(onClose, 260); }
  function onOverlay(e) { if (e.target === e.currentTarget) close(); }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: closing ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)', transition: 'background 0.26s' }}
      onClick={onOverlay}>
      <div className="w-full max-w-lg rounded-t-3xl overflow-hidden"
        style={{
          background: '#111',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          transform: closing ? 'translateY(100%)' : 'translateY(0)',
          transition: 'transform 0.26s cubic-bezier(0.32,0.72,0,1)',
        }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-0 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Imagem do banner */}
        <div className="relative" style={{ height: 200 }}>
          {banner.img ? (
            <img src={banner.img} alt={banner.titulo} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-7xl"
              style={{ background: `linear-gradient(135deg, ${banner.cor1 || '#7c2d12'}, ${banner.cor2 || '#9a3412'})` }}>
              {banner.emoji}
            </div>
          )}
          {/* Overlay gradiente */}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(17,17,17,1) 0%, rgba(17,17,17,0.2) 60%, transparent 100%)' }} />
          {/* Tag */}
          <div className="absolute top-3 left-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(0,0,0,0.5)', color: '#fff', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)' }}>
              {banner.tag}
            </span>
          </div>
          {/* Botão fechar */}
          <button onClick={close}
            className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center font-bold text-white"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}><X size={17} strokeWidth={2} /></button>
        </div>

        {/* Conteúdo */}
        <div className="px-5 pt-2 pb-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <h2 className="font-black text-white text-2xl leading-tight">{banner.titulo}</h2>
              {banner.subtitulo && <p className="text-zinc-400 text-sm mt-1 leading-relaxed">{banner.subtitulo}</p>}
            </div>
            {banner.destaque && (
              <div className="shrink-0 px-3 py-2 rounded-xl text-center"
                style={{ background: 'rgba(var(--accent-rgb),0.15)', border: '1px solid rgba(var(--accent-rgb),0.3)' }}>
                <span className="font-black text-orange-400 text-sm">{banner.destaque}</span>
              </div>
            )}
          </div>

          {/* CTA — se passou _todosItens, tenta abrir item direto */}
          {(() => {
            const item = banner._todosItens?.find(i =>
              i.id === Number(banner.item_id) ||
              i.nome.trim().toLowerCase() === banner.titulo?.trim().toLowerCase()
            );
            if (item && onAbrirItem) {
              return (
                <button onClick={() => { close(); setTimeout(() => onAbrirItem(item), 280); }}
                  className="w-full py-4 rounded-2xl font-black text-white text-base active:scale-[0.97] transition-transform"
                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 8px 24px rgba(var(--accent-rgb),0.35)' }}>
                  <span className="flex items-center justify-center gap-2"><ShoppingCart size={18} strokeWidth={1.85} /> Adicionar ao carrinho</span>
                </button>
              );
            }
            return (
              <button onClick={() => { close(); setTimeout(onVerCardapio, 280); }}
                className="w-full py-4 rounded-2xl font-black text-white text-base active:scale-[0.97] transition-transform"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 8px 24px rgba(var(--accent-rgb),0.35)' }}>
                <span className="flex items-center justify-center gap-2"><UtensilsCrossed size={18} strokeWidth={1.75} /> Ver cardápio</span>
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ── Carrossel ─────────────────────────────────────────────────
function Carrossel({ onBannerClick }) {
  const [atual, setAtual] = useState(0);
  const [arrastando, setArrastando] = useState(false);
  const [bannersDB, setBannersDB] = useState([]);
  const xInicioRef = useRef(null);
  const timerRef = useRef(null);

  // Carrega banners do banco; usa BANNERS hardcoded como fallback
  useEffect(() => {
    fetch(`${BASE}/cardapio/banners`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (data.length > 0) setBannersDB(data); })
      .catch(() => {});
  }, []);

  const lista = bannersDB.length > 0 ? bannersDB : BANNERS;

  const irPara = useCallback((idx) => {
    setAtual((idx + lista.length) % lista.length);
  }, [lista.length]);

  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setAtual(a => (a + 1) % lista.length), 4500);
  }, [lista.length]);

  useEffect(() => { resetTimer(); return () => clearInterval(timerRef.current); }, [resetTimer]);

  const onTouchStart = (e) => { xInicioRef.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (xInicioRef.current === null) return;
    const dx = xInicioRef.current - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 40) { irPara(atual + (dx > 0 ? 1 : -1)); resetTimer(); }
    xInicioRef.current = null;
  };
  const onMouseDown = (e) => { setArrastando(true); xInicioRef.current = e.clientX; };
  const onMouseUp = (e) => {
    if (!arrastando) return;
    const dx = xInicioRef.current - e.clientX;
    if (Math.abs(dx) > 40) { irPara(atual + (dx > 0 ? 1 : -1)); resetTimer(); }
    setArrastando(false); xInicioRef.current = null;
  };

  if (lista.length === 0) return null;

  return (
    <div className="relative overflow-hidden select-none"
      style={{ borderRadius: 24, height: 220 }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown} onMouseUp={onMouseUp} onMouseLeave={() => setArrastando(false)}>

      {/* Slides */}
      {lista.map((banner, i) => (
        <div key={banner.id || i}
          className="absolute inset-0 transition-all duration-500 cursor-pointer"
          onClick={() => { if (!arrastando) onBannerClick?.(banner); }}
          style={{
            opacity: i === atual ? 1 : 0,
            transform: i === atual ? 'translateX(0)' : i < atual ? 'translateX(-8%)' : 'translateX(8%)',
            pointerEvents: i === atual ? 'auto' : 'none',
          }}>

          {/* Foto de fundo (se houver) */}
          {banner.img && (
            <img src={banner.img} alt="" draggable={false}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ userSelect: 'none' }} />
          )}

          {/* Gradiente de cor — só quando não há imagem */}
          {!banner.img && (
            <div className="absolute inset-0"
              style={{ background: `linear-gradient(110deg, ${banner.cor1}f0 0%, ${banner.cor2}cc 60%, ${banner.cor2}88 100%)` }} />
          )}

          {/* Sombra inferior para legibilidade do texto */}
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)' }} />

          {/* Conteúdo */}
          <div className="absolute inset-0 flex flex-col justify-between p-5">
            {/* Tag pill top-left */}
            <div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-wider px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(0,0,0,0.45)', color: '#fff', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                {banner.tag}
              </span>
            </div>

            {/* Bottom row: title left, badge right */}
            <div className="flex items-end justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-2xl font-black text-white leading-none"
                  style={{ textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}>
                  {banner.titulo}
                </h2>
                <p className="text-sm text-white/75 mt-1 leading-snug"
                  style={{ textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>
                  {banner.subtitulo}
                </p>
              </div>
              {banner.destaque && (
                <div className="shrink-0 px-3 py-2 rounded-xl text-center"
                  style={{ background: 'rgba(var(--accent-rgb),0.9)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 16px rgba(var(--accent-rgb),0.4)' }}>
                  <span className="font-black text-white text-sm leading-none whitespace-nowrap">{banner.destaque}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Dots — bottom center, pill style */}
      {lista.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 items-center">
          {lista.map((_, i) => (
            <button key={i} onClick={(e) => { e.stopPropagation(); irPara(i); resetTimer(); }}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === atual ? 24 : 6,
                height: 6,
                background: i === atual ? '#fff' : 'rgba(255,255,255,0.3)',
              }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── CupomInput ────────────────────────────────────────────────
function CupomInput({ cupomCodigo, setCupomCodigo, cupomAplicado, setCupomAplicado, cupomBuscando, aplicarCupom }) {
  return (
    <div className="rounded-3xl p-4" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
      <p className="text-xs font-bold text-zinc-600 tracking-widest mb-3 flex items-center gap-1.5"><Tag size={12} strokeWidth={1.75} /> CUPOM DE DESCONTO</p>
      {cupomAplicado ? (
        <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <div>
            <span className="font-bold text-green-400 text-sm">{cupomAplicado.codigo}</span>
            <span className="text-xs text-green-600 ml-2">
              {cupomAplicado.tipo === 'percentual' ? `-${cupomAplicado.valor}%` : `-R$ ${Number(cupomAplicado.valor).toFixed(2).replace('.',',')}`}
            </span>
            {cupomAplicado.descricao && <p className="text-xs text-zinc-600 mt-0.5">{cupomAplicado.descricao}</p>}
          </div>
          <button onClick={() => { setCupomAplicado(null); setCupomCodigo(''); }} className="text-xs text-zinc-500 hover:text-red-400"><X size={17} strokeWidth={2} /></button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={cupomCodigo}
            onChange={e => setCupomCodigo(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), aplicarCupom())}
            placeholder="EX10, FRETE..."
            className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white outline-none"
            style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', letterSpacing: 1 }}
            onFocus={e => e.target.style.borderColor = '#10b981'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
          />
          <button onClick={aplicarCupom} disabled={cupomBuscando || !cupomCodigo.trim()}
            className="px-4 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
            {cupomBuscando ? '...' : 'Aplicar'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── ResumoValores ─────────────────────────────────────────────
function ResumoValores({ totalValor, desconto, cupomAplicado, frete = 0 }) {
  if (!cupomAplicado && !frete) return null;
  const total = Math.max(0, totalValor - desconto) + frete;
  return (
    <div className="rounded-2xl p-4 space-y-2" style={{ background: '#0d1a12', border: '1px solid rgba(16,185,129,0.2)' }}>
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">Subtotal</span>
        <span className="text-zinc-300">R$ {Number(totalValor).toFixed(2).replace('.',',')}</span>
      </div>
      {cupomAplicado && (
        <div className="flex justify-between text-sm">
          <span className="text-green-500">Desconto ({cupomAplicado.codigo})</span>
          <span className="text-green-400 font-bold">- R$ {Number(desconto).toFixed(2).replace('.',',')}</span>
        </div>
      )}
      <div className="flex justify-between text-sm">
        <span className="text-zinc-500">Frete</span>
        <span className="text-zinc-300">{frete > 0 ? `R$ ${Number(frete).toFixed(2).replace('.',',')}` : 'Grátis'}</span>
      </div>
      <div className="flex justify-between font-black" style={{ borderTop: '1px solid rgba(16,185,129,0.2)', paddingTop: 8 }}>
        <span className="text-white">Total</span>
        <span className="text-green-400 text-lg">R$ {total.toFixed(2).replace('.',',')}</span>
      </div>
    </div>
  );
}

// ── ItemModal — bottom sheet de detalhe do item ───────────────
function ItemModal({ item, onClose, carrinho, onConfirm }) {
  const existing = carrinho.find(c => c.id === item.id);
  const [qty, setQty] = useState(existing ? existing.qty : 1);
  const [obs, setObs] = useState(existing ? (existing.obs || '') : '');
  const [closing, setClosing] = useState(false);

  // Fecha com animação
  function close() {
    setClosing(true);
    setTimeout(onClose, 260);
  }

  // Fecha ao clicar fora
  function onOverlayClick(e) {
    if (e.target === e.currentTarget) close();
  }

  function handleConfirm() {
    onConfirm(item, qty, obs);
    setClosing(true);
    setTimeout(onClose, 260);
  }

  const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const total = qty * item.preco;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: closing ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', transition: 'background 0.26s, backdrop-filter 0.26s' }}
      onClick={onOverlayClick}>

      <div
        className="w-full max-w-lg flex flex-col rounded-t-3xl overflow-hidden"
        style={{
          background: '#111',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          maxHeight: '92vh',
          transform: closing ? 'translateY(100%)' : 'translateY(0)',
          transition: 'transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)',
        }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1">

          {/* Foto ou emoji hero */}
          {item.foto ? (
            <div className="relative w-full shrink-0" style={{ height: 220 }}>
              <img src={item.foto} alt={item.nome} className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(17,17,17,0.9) 0%, transparent 60%)' }} />
              <button onClick={close}
                className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white font-bold"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}><X size={17} strokeWidth={2} /></button>
            </div>
          ) : (
            <div className="relative flex items-center justify-center shrink-0" style={{ height: 160, background: '#181818' }}>
              <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(var(--accent-rgb),0.1), transparent 70%)' }} />
              <span style={{ color: 'rgba(251,146,60,0.85)' }}><UtensilsCrossed size={64} strokeWidth={1.4} /></span>
              <button onClick={close}
                className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white font-bold"
                style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}><X size={17} strokeWidth={2} /></button>
            </div>
          )}

          <div className="px-5 pt-4 pb-6 space-y-5">

            {/* Nome e preço */}
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-black text-white text-2xl leading-tight flex-1">{item.nome}</h2>
              <span className="font-black text-2xl shrink-0 mt-0.5" style={{ color: 'var(--accent)' }}>{brl(item.preco)}</span>
            </div>

            {/* Descrição completa */}
            {item.descricao && (
              <p className="text-sm leading-relaxed" style={{ color: '#a1a1aa' }}>{item.descricao}</p>
            )}

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

            {/* Observação */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold tracking-wider mb-2" style={{ color: '#71717a' }}>
                <MessageSquare size={13} strokeWidth={1.75} /> ALGUMA OBSERVAÇÃO?
              </label>
              <textarea
                value={obs}
                onChange={e => setObs(e.target.value)}
                placeholder="Ex: sem cebola, bem passado, molho à parte..."
                rows={3}
                className="w-full px-4 py-3 rounded-2xl text-sm text-white outline-none resize-none"
                style={{
                  background: '#1a1a1a',
                  border: '1px solid rgba(255,255,255,0.08)',
                  lineHeight: 1.6,
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
              />
            </div>

          </div>
        </div>

        {/* Barra de ação sticky no fundo */}
        <div className="shrink-0 px-5 py-4 flex items-center gap-3"
          style={{ background: '#111', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

          {/* Seletor de quantidade */}
          <div className="flex items-center gap-2 rounded-2xl px-2 py-2 shrink-0"
            style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}>
            <button
              onClick={() => setQty(q => Math.max(0, q - 1))}
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg transition-all active:scale-90"
              style={{ background: qty > 1 ? '#2a2a2a' : 'transparent', color: qty > 0 ? '#fff' : '#444' }}>
              {qty <= 1 ? <Trash2 size={16} strokeWidth={1.75} /> : '−'}
            </button>
            <span className="w-7 text-center font-black text-white text-lg">{qty}</span>
            <button
              onClick={() => setQty(q => q + 1)}
              className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg text-white transition-all active:scale-90"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
              +
            </button>
          </div>

          {/* Botão adicionar */}
          <button
            onClick={qty === 0 ? handleConfirm : handleConfirm}
            disabled={qty === 0 && !existing}
            className="flex-1 py-3.5 rounded-2xl font-black text-white text-base transition-all active:scale-[0.97] disabled:opacity-40"
            style={{
              background: qty === 0
                ? 'rgba(239,68,68,0.8)'
                : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
              boxShadow: qty === 0 ? 'none' : '0 6px 24px rgba(var(--accent-rgb),0.35)',
            }}>
            {qty === 0 ? 'Remover do carrinho' : existing
              ? `Atualizar · ${brl(total)}`
              : `Adicionar · ${brl(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function Cardapio() {
  const [categorias, setCategorias] = useState([]);
  const [catAtiva, setCatAtiva] = useState(null);
  const [carrinho, setCarrinho] = useState([]);
  const [tela, setTela] = useState('menu');
  const [pedidoFeito, setPedidoFeito] = useState(null);
  const [whatsappLoja, setWhatsappLoja] = useState('');
  // Pedidos recentes salvos no dispositivo (pra acompanhar após fechar a aba)
  const [meusPedidos, setMeusPedidos] = useState(() => {
    try {
      const lista = JSON.parse(localStorage.getItem('sushi_meus_pedidos') || '[]');
      // mantém só os das últimas 24h
      const recentes = lista.filter(p => Date.now() - (p.ts || 0) < 24 * 3600 * 1000);
      if (recentes.length !== lista.length) localStorage.setItem('sushi_meus_pedidos', JSON.stringify(recentes));
      return recentes;
    } catch { return []; }
  });
  const [form, setForm] = useState({ nome: '', telefone: '', endereco: '', observacao: '', pagamento: '', troco_para: '', bairro: '', aniversario: '', agendar: false, agendado_para: '', tipo_entrega: 'entrega' });
  const [retiradaAtiva, setRetiradaAtiva] = useState(false);
  const [enderecoLoja, setEnderecoLoja] = useState('');
  const [pixData, setPixData] = useState(null); // { codigo, qr }
  const [enviando, setEnviando] = useState(false);
  const [animItem, setAnimItem] = useState(null);
  const [itemModal, setItemModal] = useState(null);   // item selecionado para detalhe
  const [bannerModal, setBannerModal] = useState(null); // banner selecionado
  const menuRef = useRef(null);
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [etapaCheckout, setEtapaCheckout] = useState('telefone'); // 'telefone' | 'confirmar' | 'novo_cliente'
  const [cupomCodigo, setCupomCodigo] = useState('');
  const [cupomAplicado, setCupomAplicado] = useState(null); // { codigo, tipo, valor, descricao }
  const [cupomBuscando, setCupomBuscando] = useState(false);
  const [horarioStatus, setHorarioStatus] = useState(null); // { aberta, fecha, mensagem_fechado }
  const [nomeRestaurante, setNomeRestaurante] = useState('Sushi Control');
  const [fechamentoTemp, setFechamentoTemp] = useState(null);
  const [infoStrip, setInfoStrip] = useState({ entrega: '40–60 min', frete: 'Grátis +R$80', nota: '4.9' });
  const [googleReviewsUrl, setGoogleReviewsUrl] = useState(null);
  const [entrega, setEntrega] = useState({ pedido_minimo: 0, taxa_padrao: 0, aceita_fora: true, bairros: [] });
  const catRefs = useRef({});
  const tabsRef = useRef(null);
  const telTimerRef = useRef(null);
  const telInputRef = useRef(null);

  useEffect(() => { capturarUTM(); }, []);

  // Remove dos pedidos salvos os que já foram entregues ou cancelados, pra o
  // banner/pílula de "acompanhar pedido" sumir sozinho quando não há mais o que
  // acompanhar. Consulta o status real de cada pedido recente ao abrir a tela.
  useEffect(() => {
    if (meusPedidos.length === 0) return;
    let cancelado = false;
    (async () => {
      const ativos = [];
      for (const p of meusPedidos) {
        try {
          const r = await fetch(`${BASE}/cardapio/pedido/${p.id}/rastreio`);
          if (r.status === 404) continue; // pedido sumiu do banco
          if (!r.ok) { ativos.push(p); continue; } // erro de rede: mantém
          const data = await r.json();
          if (data.status !== 'entregue' && data.status !== 'cancelado') ativos.push(p);
        } catch { ativos.push(p); } // offline: mantém pra tentar de novo depois
      }
      if (cancelado) return;
      if (ativos.length !== meusPedidos.length) {
        localStorage.setItem('sushi_meus_pedidos', JSON.stringify(ativos));
        setMeusPedidos(ativos);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  useEffect(() => {
    fetch(`${BASE}/cardapio`)
      .then(r => r.json())
      .then(data => { setCategorias(data); if (data.length) setCatAtiva(data[0].id); })
      .catch(() => toast.error('Erro ao carregar o cardápio'));
    fetch(`${BASE}/cardapio/horario`)
      .then(r => r.json())
      .then(data => setHorarioStatus(data))
      .catch(() => {});
    fetch(`${BASE}/cardapio/config`)
      .then(r => r.json())
      .then(data => {
        if (data.nome_restaurante) setNomeRestaurante(data.nome_restaurante);
        if (data.whatsapp) setWhatsappLoja(data.whatsapp);
        setRetiradaAtiva(!!data.retirada_ativa);
        setEnderecoLoja(data.endereco_loja || '');
        if (data.fechamento_temp) setFechamentoTemp(data.fechamento_temp);
        if (data.info_strip) setInfoStrip(data.info_strip);
        if (data.google_reviews_url) setGoogleReviewsUrl(data.google_reviews_url);
        // Tráfego pago: injeta pixels de conversão (se configurados)
        if (data.meta_pixel_id) injetarMetaPixel(data.meta_pixel_id);
        if (data.ga_id) injetarGA(data.ga_id);
        setEntrega({
          pedido_minimo: Number(data.pedido_minimo) || 0,
          taxa_padrao: Number(data.taxa_entrega_padrao) || 0,
          aceita_fora: data.aceita_fora_area !== false,
          bairros: Array.isArray(data.bairros_entrega) ? data.bairros_entrega : [],
        });
      })
      .catch(() => {});
  }, []);

  const totalItens = carrinho.reduce((s, i) => s + i.qty, 0);
  const totalValor = carrinho.reduce((s, i) => s + i.preco * i.qty, 0);

  const [upsellNudge, setUpsellNudge] = useState(false);
  const nudgeTimerRef = useRef(null);

  // Sugestões de upsell: prioriza bebidas/sobremesas/molhos, exclui itens já no carrinho
  function getSugestoes(carr) {
    const ids = new Set(carr.map(c => c.id));
    const PRIO = /bebida|suco|refri|água|agua|drink|cerveja|saquê|sake|chá|cha\b|sobremesa|doce|mochi|sorvete|extra|adicional|molho|tarê|tare|teriy|acompan|sobrem/i;
    const PRIO_ITEM = /tarê|tare|molho|sobremesa|mochi|sorvete|refri|suco|bebida|cerveja/i;
    const prio = [], outros = [];
    for (const cat of categorias) {
      for (const item of (cat.itens || [])) {
        if (!item.disponivel || ids.has(item.id)) continue;
        if (PRIO.test(cat.nome) || PRIO_ITEM.test(item.nome)) prio.push({ ...item, _catNome: cat.nome });
        else outros.push({ ...item, _catNome: cat.nome });
      }
    }
    const outrosBaratos = outros.sort((a, b) => a.preco - b.preco).slice(0, 2);
    return [...prio.slice(0, 5), ...outrosBaratos].slice(0, 6);
  }

  // Adiciona 1 unidade (usado nos botões rápidos + dos cards)
  function addItem(item) {
    setAnimItem(item.id);
    setTimeout(() => setAnimItem(null), 400);
    setCarrinho(prev => {
      const isFirst = prev.length === 0;
      const next = prev.find(c => c.id === item.id)
        ? prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
        : [...prev, { ...item, qty: 1, obs: '' }];
      // Mostra nudge de bebida após 1º item adicionado
      if (isFirst) {
        clearTimeout(nudgeTimerRef.current);
        setUpsellNudge(true);
        nudgeTimerRef.current = setTimeout(() => setUpsellNudge(false), 6000);
      }
      return next;
    });
  }

  // Confirma do modal (substitui ou remove item no carrinho)
  function confirmItemModal(item, qty, obs) {
    setAnimItem(item.id);
    setTimeout(() => setAnimItem(null), 400);
    if (qty === 0) {
      setCarrinho(prev => prev.filter(c => c.id !== item.id));
      return;
    }
    setCarrinho(prev => {
      const e = prev.find(c => c.id === item.id);
      if (e) return prev.map(c => c.id === item.id ? { ...c, qty, obs } : c);
      return [...prev, { ...item, qty, obs }];
    });
  }

  function removeItem(id) {
    setCarrinho(prev => {
      const item = prev.find(c => c.id === id);
      if (!item || item.qty <= 1) return prev.filter(c => c.id !== id);
      return prev.map(c => c.id === id ? { ...c, qty: c.qty - 1 } : c);
    });
  }

  function getQty(id) { return carrinho.find(c => c.id === id)?.qty || 0; }

  function scrollToCat(id) {
    setCatAtiva(id);
    catRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const tab = tabsRef.current?.querySelector(`[data-cat="${id}"]`);
    tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  // Busca cliente pelo telefone
  async function buscarCliente(telefone) {
    const digits = telefone.replace(/\D/g, '');
    if (digits.length < 8) return;
    setBuscandoCliente(true);
    try {
      const res = await fetch(`${BASE}/cardapio/cliente/${digits}`);
      if (res.ok) {
        const data = await res.json();
        setClienteEncontrado(data);
        setForm(p => ({ ...p, nome: data.nome, endereco: data.endereco || '' }));
        setEtapaCheckout('confirmar');
      } else {
        setClienteEncontrado(null);
        setEtapaCheckout('novo_cliente');
      }
    } catch {
      setEtapaCheckout('novo_cliente');
    }
    setBuscandoCliente(false);
  }

  function onTelefoneChange(val) {
    setForm(p => ({ ...p, telefone: val }));
    setClienteEncontrado(null);
    setEtapaCheckout('telefone');
    clearTimeout(telTimerRef.current);
  }

  async function aplicarCupom() {
    const cod = cupomCodigo.trim().toUpperCase();
    if (!cod) return;
    setCupomBuscando(true);
    try {
      const r = await fetch(`${BASE}/cardapio/cupom/${cod}`);
      const data = await r.json();
      if (!r.ok) { toast.error(data.erro || 'Cupom inválido'); setCupomAplicado(null); }
      else { setCupomAplicado(data); toast.success(`🎉 Cupom ${data.codigo} aplicado!`); }
    } catch { toast.error('Erro ao validar cupom'); }
    setCupomBuscando(false);
  }

  function calcDesconto() {
    if (!cupomAplicado) return 0;
    if (cupomAplicado.tipo === 'percentual') return totalValor * (cupomAplicado.valor / 100);
    return Math.min(cupomAplicado.valor, totalValor);
  }

  const ehRetirada = form.tipo_entrega === 'retirada';
  // Frete por bairro (ou taxa padrão se aceitar fora da área). Retirada = sem frete.
  const temBairros = entrega.bairros.length > 0;
  const bairroSel = temBairros ? entrega.bairros.find(b => b.nome.toLowerCase() === (form.bairro || '').trim().toLowerCase()) : null;
  const foraDeArea = !ehRetirada && temBairros && form.bairro && !bairroSel && !entrega.aceita_fora;
  function calcFrete() {
    if (ehRetirada || !temBairros) return 0;
    if (bairroSel) return Number(bairroSel.taxa) || 0;
    return entrega.aceita_fora ? (Number(entrega.taxa_padrao) || 0) : 0;
  }
  const abaixoMinimo = entrega.pedido_minimo > 0 && totalValor < entrega.pedido_minimo;

  async function finalizarPedido(e) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error('Informe seu nome');
    if (!ehRetirada && !form.endereco.trim()) return toast.error('Informe o endereço de entrega');
    if (!form.pagamento) return toast.error('Selecione a forma de pagamento');
    setEnviando(true);
    try {
      const res = await fetch(`${BASE}/cardapio/pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_nome: form.nome,
          cliente_telefone: form.telefone,
          cliente_endereco: ehRetirada ? '' : form.endereco,
          tipo_entrega: form.tipo_entrega,
          observacao: form.observacao,
          forma_pagamento: form.pagamento,
          troco_para: form.pagamento === 'dinheiro' && form.troco_para ? Number(String(form.troco_para).replace(',', '.')) : null,
          bairro: ehRetirada ? null : (form.bairro || null),
          aniversario: form.aniversario || null,
          agendado_para: form.agendar && form.agendado_para ? new Date(form.agendado_para).toISOString() : null,
          cupom_codigo: cupomAplicado?.codigo || null,
          utm: getUTM(),
          itens: carrinho.map(c => ({ item_id: c.id, quantidade: c.qty, observacao: c.obs || null })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Erro');
      // Tráfego pago: dispara o evento de compra nos pixels (Meta/Google)
      dispararCompra(data.total, data.id);
      setPedidoFeito({ id: data.id, numero: data.numero, total: data.total, desconto: calcDesconto(), telefone: form.telefone, pagamento: form.pagamento, fidelidade: data.fidelidade, ganhou_recompensa: data.ganhou_recompensa, recompensa_descricao: data.recompensa_descricao });
      // Salva o pedido no dispositivo pra o cliente conseguir voltar e
      // acompanhar mesmo depois de fechar a aba.
      try {
        const prev = JSON.parse(localStorage.getItem('sushi_meus_pedidos') || '[]');
        const atualizado = [{ id: data.id, numero: data.numero, total: data.total, ts: Date.now() },
          ...prev.filter(p => p.id !== data.id)].slice(0, 5);
        localStorage.setItem('sushi_meus_pedidos', JSON.stringify(atualizado));
        setMeusPedidos(atualizado);
      } catch {}
      // Se for PIX, gera o copia-e-cola para pagamento imediato
      if (form.pagamento === 'pix') {
        fetch(`${BASE}/cardapio/pix?valor=${data.total}&txid=PED${data.numero}`)
          .then(r => r.json()).then(p => { if (p.disponivel) setPixData(p); }).catch(() => {});
      }
      setClienteEncontrado(null);
      setCarrinho([]);
      setCupomAplicado(null);
      setCupomCodigo('');
      setTela('sucesso');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setEnviando(false);
    }
  }

  // ── SUCESSO ──────────────────────────────────────────────────
  if (tela === 'sucesso' && pedidoFeito) {
    const temTelefone = !!pedidoFeito.telefone?.trim();
    const fid = pedidoFeito.fidelidade;
    const TOTAL_SELOS = 10;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6"
        style={{ background: 'radial-gradient(130% 110% at 50% -10%, #0d1320 0%, #05070d 72%)' }}>
        <Toaster />
        <div className="w-full max-w-sm">

          {/* Hero checkmark */}
          <div className="flex flex-col items-center text-center mb-8">
            {/* Confetti decoration */}
            <div className="flex items-center gap-3 mb-2 select-none" style={{ color: '#fbbf24' }}>
              <PartyPopper size={20} strokeWidth={1.75} /><PartyPopper size={26} strokeWidth={1.75} /><PartyPopper size={20} strokeWidth={1.75} />
            </div>
            <div className="relative mb-5">
              <div className="w-28 h-28 rounded-full flex items-center justify-center text-emerald-400"
                style={{
                  background: 'radial-gradient(circle at 35% 35%, rgba(16,185,129,0.3), rgba(16,185,129,0.05))',
                  border: '2px solid rgba(16,185,129,0.4)',
                  boxShadow: '0 0 60px rgba(16,185,129,0.2), 0 0 120px rgba(16,185,129,0.08)',
                }}>
                <CheckCircle2 size={56} strokeWidth={1.5} />
              </div>
              {/* Pulse ring */}
              <div className="absolute inset-0 rounded-full animate-ping"
                style={{ border: '2px solid rgba(16,185,129,0.2)', animationDuration: '2s' }} />
            </div>
            <h1 className="text-3xl font-black text-white mb-2 leading-none">Pedido confirmado!</h1>
            <p className="text-zinc-500 text-sm">Recebemos seu pedido e já estamos preparando 🍣</p>
          </div>

          {/* Order number card */}
          <div className="rounded-3xl p-6 mb-4 text-center" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-bold tracking-widest text-zinc-600 mb-1">NÚMERO DO PEDIDO</p>
            <p className="font-black leading-none mb-1"
              style={{ fontSize: 72, background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              #{pedidoFeito.numero}
            </p>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', marginTop: 16, marginBottom: 16 }} />
            <div className="flex justify-between items-center">
              <span className="text-zinc-500 text-sm">Total pago</span>
              <span className="text-2xl font-black text-white">{brl(pedidoFeito.total)}</span>
            </div>
          </div>

          {/* Delivery ETA */}
          <div className="rounded-2xl p-4 mb-3 flex items-center gap-3"
            style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <span className="text-amber-400"><Bike size={24} strokeWidth={1.75} /></span>
            <div>
              <p className="text-sm font-bold text-amber-400">Tempo estimado de entrega</p>
              <p className="text-xs text-zinc-500 mt-0.5">40 a 60 minutos</p>
            </div>
          </div>

          {/* Desconto aplicado */}
          {pedidoFeito.desconto > 0 && (
            <div className="rounded-2xl p-4 mb-3 flex items-center gap-3"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <span className="text-green-400"><Tag size={24} strokeWidth={1.75} /></span>
              <div>
                <p className="text-sm font-bold text-green-400">Desconto aplicado!</p>
                <p className="text-xs text-zinc-500 mt-0.5">Você economizou R$ {Number(pedidoFeito.desconto).toFixed(2).replace('.',',')}</p>
              </div>
            </div>
          )}

          {/* Link rastreio */}
          {pedidoFeito.id && (
            <a href={`/pedido/${pedidoFeito.id}`} target="_blank" rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-sm mb-3"
              style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', color: '#60a5fa', textDecoration: 'none' }}>
              <MapPin size={16} strokeWidth={1.75} /> Acompanhar status do pedido
            </a>
          )}

          {/* Card recompensa ganha */}
          {pedidoFeito.ganhou_recompensa && (
            <div className="rounded-2xl p-4 mb-3 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.08))', border: '2px solid rgba(251,191,36,0.4)', boxShadow: '0 0 24px rgba(251,191,36,0.15)' }}>
              <div className="flex justify-center mb-2 text-yellow-400"><Gift size={34} strokeWidth={1.6} /></div>
              <p className="font-black text-yellow-400 text-base">Parabéns! Você ganhou um brinde!</p>
              <p className="text-xs text-yellow-300/70 mt-1">{pedidoFeito.recompensa_descricao}</p>
              <p className="text-[10px] text-zinc-500 mt-2">Informe ao atendente ao receber o pedido</p>
            </div>
          )}

          {/* Card fidelidade */}
          {fid && !pedidoFeito.ganhou_recompensa && (
            <div className="rounded-2xl p-4 mb-3"
              style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-violet-400"><Star size={19} strokeWidth={1.75} /></span>
                  <div>
                    <p className="text-sm font-black text-white leading-none">Fidelidade</p>
                    <p className="text-[10px] text-violet-400 mt-0.5">A cada 10 pedidos, ganhe um brinde!</p>
                  </div>
                </div>
                <span className="text-xs font-black text-violet-400">{fid.pedidos_no_ciclo}/{TOTAL_SELOS}</span>
              </div>
              {/* Selos */}
              <div className="flex gap-1.5 flex-wrap">
                {Array.from({ length: TOTAL_SELOS }).map((_, i) => (
                  <div key={i} className="w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-all"
                    style={{
                      background: i < fid.pedidos_no_ciclo ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.05)',
                      border: `1.5px solid ${i < fid.pedidos_no_ciclo ? 'rgba(139,92,246,0.8)' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    {i < fid.pedidos_no_ciclo ? <Fish size={14} strokeWidth={1.75} className="text-violet-200" /> : '·'}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-zinc-600 mt-2">
                Faltam <span className="text-violet-400 font-bold">{fid.proximo_em} pedido{fid.proximo_em !== 1 ? 's' : ''}</span> para o próximo brinde
                {fid.recompensas_disponiveis > 0 && <span className="text-yellow-400 font-bold ml-1">· {fid.recompensas_disponiveis} brinde{fid.recompensas_disponiveis > 1 ? 's' : ''} disponível!</span>}
              </p>
            </div>
          )}

          {pedidoFeito.pagamento && (
            <div className="rounded-2xl p-4 mb-4 flex items-center gap-3"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <span className="text-indigo-400">
                {(() => { const I = { pix: Smartphone, dinheiro: Banknote, cartao_cred: CreditCard, cartao_deb: CreditCard }[pedidoFeito.pagamento] || CreditCard; return <I size={22} strokeWidth={1.75} />; })()}
              </span>
              <div>
                <p className="text-sm font-bold text-indigo-400">Forma de pagamento</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {{ pix: 'PIX', dinheiro: 'Dinheiro', cartao_cred: 'Cartão de Crédito', cartao_deb: 'Cartão de Débito' }[pedidoFeito.pagamento]}
                </p>
              </div>
            </div>
          )}

          {/* Pix copia-e-cola + QR */}
          {pedidoFeito.pagamento === 'pix' && pixData && (
            <div className="rounded-2xl p-4 mb-4 text-center" style={{ background: '#0d1a12', border: '1px solid rgba(16,185,129,0.3)' }}>
              <p className="text-sm font-black text-green-400 mb-1">Pague agora com Pix</p>
              <p className="text-[11px] text-zinc-500 mb-3">Escaneie o QR ou use o código copia-e-cola</p>
              {pixData.qr && <img src={pixData.qr} alt="QR Pix" className="w-44 h-44 mx-auto rounded-xl bg-white p-1.5 mb-3" />}
              <button onClick={() => { navigator.clipboard?.writeText(pixData.codigo); toast.success('Código Pix copiado!'); }}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                <Check size={15} strokeWidth={2} /> Copiar código Pix
              </button>
              <p className="text-[10px] text-zinc-700 mt-2 break-all px-2">{pixData.codigo}</p>
            </div>
          )}

          {temTelefone ? (
            <div className="rounded-2xl overflow-hidden mb-6"
              style={{ background: 'rgba(37,211,102,0.07)', border: '1px solid rgba(37,211,102,0.25)' }}>
              <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(37,211,102,0.15)', color: '#25d366' }}><Phone size={19} strokeWidth={1.75} /></div>
                <div>
                  <p className="text-sm font-black text-white leading-none">Atualizações pelo WhatsApp</p>
                  <p className="text-xs mt-0.5" style={{ color: '#4ade80' }}>Você receberá mensagens automáticas</p>
                </div>
              </div>
              <div className="px-4 pb-3 space-y-1.5">
                {[[CheckCircle2,'Pedido confirmado'],[UtensilsCrossed,'Em preparo'],[Bike,'Saindo para entrega'],[PartyPopper,'Pedido entregue']].map(([Ic, txt]) => (
                  <div key={txt} className="flex items-center gap-2">
                    <span className="text-green-400/80"><Ic size={14} strokeWidth={1.75} /></span>
                    <span className="text-xs text-zinc-400">{txt}</span>
                  </div>
                ))}
              </div>
              {whatsappLoja && (
              <div className="px-4 pb-4">
                <a href={`https://wa.me/${whatsappLoja.startsWith('55') ? whatsappLoja : '55' + whatsappLoja}?text=${encodeURIComponent(`Olá! Gostaria de acompanhar meu pedido #${pedidoFeito.numero}.`)}`}
                  target="_blank" rel="noreferrer"
                  className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  style={{ display: 'flex', background: 'linear-gradient(135deg, #25d366, #128c5e)', color: '#fff', boxShadow: '0 4px 16px rgba(37,211,102,0.3)', textDecoration: 'none' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Acompanhar pelo WhatsApp
                </a>
              </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl p-4 mb-6 flex items-start gap-3"
              style={{ background: 'rgba(37,211,102,0.05)', border: '1px solid rgba(37,211,102,0.15)' }}>
              <span className="text-amber-400 mt-0.5 shrink-0"><Lightbulb size={18} strokeWidth={1.75} /></span>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Para receber <span className="text-green-400 font-semibold">atualizações automáticas</span> do seu pedido pelo WhatsApp, informe seu número no próximo pedido.
              </p>
            </div>
          )}

          <button onClick={() => { setPedidoFeito(null); setClienteEncontrado(null); setPixData(null); setForm({ nome:'', telefone:'', endereco:'', observacao:'', pagamento:'', troco_para:'', bairro:'', aniversario:'', agendar:false, agendado_para:'' }); setTela('menu'); }}
            className="w-full py-4 rounded-2xl font-bold text-white text-base active:scale-95 transition-transform"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 8px 24px rgba(var(--accent-rgb),0.3)' }}>
            Fazer novo pedido
          </button>
        </div>
      </div>
    );
  }

  // ── CHECKOUT ─────────────────────────────────────────────────
  if (tela === 'checkout') {
    const fid = clienteEncontrado?.fidelidade;

    // Step indicator data
    const steps = [
      { Icon: Smartphone, label: 'Telefone' },
      { Icon: User,       label: 'Dados'    },
      { Icon: CheckCircle2, label: 'Confirmar'},
    ];
    const stepAtual = etapaCheckout === 'telefone' ? 0 : etapaCheckout === 'confirmar' ? 1 : 2;

    const PagamentoSelector = () => (
      <div>
        <label className="text-xs text-zinc-600 font-medium flex items-center gap-1.5 mb-2">
          <CreditCard size={13} strokeWidth={1.75} />Forma de pagamento *
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'pix',         Icon: Smartphone, label: 'PIX'     },
            { value: 'dinheiro',    Icon: Banknote,   label: 'Dinheiro'},
            { value: 'cartao_cred', Icon: CreditCard, label: 'Crédito' },
            { value: 'cartao_deb',  Icon: CreditCard, label: 'Débito'  },
          ].map(op => {
            const sel = form.pagamento === op.value;
            return (
              <button key={op.value} type="button"
                onClick={() => setForm(p => ({ ...p, pagamento: op.value }))}
                className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
                style={{ background: sel ? 'rgba(var(--accent-rgb),0.15)' : '#1a1a1a', border: `1.5px solid ${sel ? 'var(--accent)' : 'rgba(255,255,255,0.08)'}`, color: sel ? 'var(--accent)' : '#666' }}>
                <op.Icon size={17} strokeWidth={1.75} />
                <span>{op.label}</span>
                {sel && <span className="ml-auto"><Check size={15} strokeWidth={2.5} /></span>}
              </button>
            );
          })}
        </div>

        {/* Troco — só para dinheiro */}
        {form.pagamento === 'dinheiro' && (() => {
          const aPagar = totalValor - calcDesconto();
          const trocoNum = form.troco_para ? Number(String(form.troco_para).replace(',', '.')) : 0;
          const trocoOk = trocoNum >= aPagar;
          return (
            <div className="mt-2.5 rounded-xl p-3" style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}>
              <label className="text-xs text-zinc-500 font-medium flex items-center gap-1.5 mb-2">
                <Banknote size={13} strokeWidth={1.75} /> Precisa de troco? Pague com quanto?
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">R$</span>
                <input
                  type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*"
                  placeholder={`Deixe em branco se tiver o valor exato (${brl(aPagar)})`}
                  value={form.troco_para}
                  onChange={e => setForm(p => ({ ...p, troco_para: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white outline-none"
                  style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
              {form.troco_para && trocoOk && (
                <p className="text-xs text-green-400 font-bold mt-1.5">Troco: {brl(trocoNum - aPagar)}</p>
              )}
              {form.troco_para && !trocoOk && (
                <p className="text-xs text-amber-400 mt-1.5">O valor precisa ser ≥ {brl(aPagar)}</p>
              )}
            </div>
          );
        })()}
      </div>
    );

    // Seletor de bairro / frete (só aparece se a loja configurou bairros)
    // Seletor Entrega x Retirada (só aparece se a loja habilitou retirada)
    const TipoEntregaSelector = () => {
      if (!retiradaAtiva) return null;
      const Opcao = ({ val, Icon, titulo, sub }) => (
        <button type="button" onClick={() => setForm(p => ({ ...p, tipo_entrega: val }))}
          className="flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl transition-all active:scale-95"
          style={{ background: form.tipo_entrega === val ? 'rgba(var(--accent-rgb),0.14)' : '#1a1a1a', border: `1px solid ${form.tipo_entrega === val ? 'var(--accent)' : 'rgba(255,255,255,0.08)'}` }}>
          <Icon size={20} strokeWidth={1.75} style={{ color: form.tipo_entrega === val ? 'var(--accent)' : '#888' }} />
          <span className="text-xs font-black" style={{ color: form.tipo_entrega === val ? 'var(--accent)' : '#aaa' }}>{titulo}</span>
          <span className="text-[10px]" style={{ color: '#666' }}>{sub}</span>
        </button>
      );
      return (
        <div className="rounded-3xl p-4" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
          <label className="text-xs text-zinc-600 font-medium flex items-center gap-1.5 mb-2.5">Como você quer receber?</label>
          <div className="flex gap-2.5">
            <Opcao val="entrega" Icon={Truck} titulo="Entrega" sub="No seu endereço" />
            <Opcao val="retirada" Icon={ShoppingBag} titulo="Retirada" sub="Buscar no balcão" />
          </div>
          {ehRetirada && (
            <div className="mt-3 px-3 py-2.5 rounded-xl flex items-start gap-2" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <MapPin size={14} strokeWidth={1.75} className="text-green-400 shrink-0 mt-0.5" />
              <p className="text-xs text-green-300/90 leading-snug">
                Retirada no balcão — sem frete.{enderecoLoja ? <> Endereço: <span className="font-bold">{enderecoLoja}</span></> : ''}
              </p>
            </div>
          )}
        </div>
      );
    };

    const BairroSelector = () => {
      if (ehRetirada || !temBairros) return null;
      const frete = calcFrete();
      return (
        <div>
          <label className="text-xs text-zinc-600 font-medium flex items-center gap-1.5 mb-2">
            <MapPin size={13} strokeWidth={1.75} /> Bairro de entrega *
          </label>
          <input list="bairros-list" value={form.bairro}
            onChange={e => setForm(p => ({ ...p, bairro: e.target.value }))}
            placeholder="Digite ou selecione seu bairro"
            className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
            style={{ background: '#1a1a1a', border: `1px solid ${foraDeArea ? '#f87171' : 'rgba(255,255,255,0.08)'}` }} />
          <datalist id="bairros-list">
            {entrega.bairros.map(b => <option key={b.nome} value={b.nome} />)}
          </datalist>
          {foraDeArea ? (
            <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertTriangle size={12} strokeWidth={2} /> Não entregamos nesse bairro.</p>
          ) : form.bairro ? (
            <p className="text-xs mt-1.5" style={{ color: frete > 0 ? '#a78bfa' : '#4ade80' }}>
              Frete: {frete > 0 ? brl(frete) : 'Grátis'}{!bairroSel && entrega.aceita_fora && ' (taxa padrão)'}
            </p>
          ) : null}
        </div>
      );
    };

    // Aniversário (mimo) + agendamento do pedido
    const ExtrasPedido = () => (
      <div className="space-y-3">
        {/* Pergunta o aniversário só uma vez: se o cliente já tem data
            cadastrada, não pede de novo. */}
        {!clienteEncontrado?.aniversario && (
        <div>
          <label className="text-xs text-zinc-600 font-medium flex items-center gap-1.5 mb-2">
            <Gift size={13} strokeWidth={1.75} /> Seu aniversário <span className="text-zinc-700 font-normal">(ganhe um mimo!)</span>
          </label>
          <input type="date" value={form.aniversario}
            onChange={e => setForm(p => ({ ...p, aniversario: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
            style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }} />
        </div>
        )}
        <div>
          <button type="button" onClick={() => setForm(p => ({ ...p, agendar: !p.agendar }))}
            className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl transition-all"
            style={{ background: form.agendar ? 'rgba(var(--accent-rgb),0.12)' : '#1a1a1a', border: `1px solid ${form.agendar ? 'rgba(var(--accent-rgb),0.3)' : 'rgba(255,255,255,0.08)'}` }}>
            <Clock size={16} strokeWidth={1.75} style={{ color: form.agendar ? 'var(--accent)' : '#666' }} />
            <span className="text-sm font-semibold flex-1 text-left" style={{ color: form.agendar ? 'var(--accent)' : '#aaa' }}>Agendar para depois</span>
            <span className="w-10 h-5 rounded-full relative" style={{ background: form.agendar ? 'var(--accent)' : '#333' }}>
              <span className="w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all" style={{ left: form.agendar ? 'calc(100% - 18px)' : '2px' }} />
            </span>
          </button>
          {form.agendar && (
            <input type="datetime-local" value={form.agendado_para}
              min={new Date(Date.now() + 30 * 60000).toISOString().slice(0, 16)}
              onChange={e => setForm(p => ({ ...p, agendado_para: e.target.value }))}
              className="w-full mt-2 px-4 py-3 rounded-xl text-sm text-white outline-none"
              style={{ background: '#1a1a1a', border: '1px solid rgba(var(--accent-rgb),0.3)' }} />
          )}
        </div>
      </div>
    );

    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'radial-gradient(130% 110% at 50% -10%, #0d1320 0%, #05070d 72%)' }}>
        <Toaster />

        {/* Header */}
        <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3"
          style={{ background: 'rgba(7,7,7,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={() => {
              if (etapaCheckout !== 'telefone') { setEtapaCheckout('telefone'); setClienteEncontrado(null); }
              else setTela('carrinho');
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-400 transition-all active:scale-90"
            style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}><ArrowLeft size={20} strokeWidth={1.75} /></button>
          <div className="flex-1">
            <h1 className="font-black text-white text-lg leading-none">Finalizar Pedido</h1>
            <p className="text-xs text-zinc-600 mt-0.5">{totalItens} {totalItens === 1 ? 'item' : 'itens'} · {brl(totalValor)}</p>
          </div>

          {/* Step pills */}
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <React.Fragment key={i}>
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-bold transition-all"
                  style={{
                    background: i === stepAtual ? 'rgba(var(--accent-rgb),0.2)' : 'transparent',
                    color: i === stepAtual ? 'var(--accent)' : i < stepAtual ? '#71717a' : '#333',
                    border: `1px solid ${i === stepAtual ? 'rgba(var(--accent-rgb),0.4)' : 'transparent'}`,
                  }}>
                  <s.Icon size={14} strokeWidth={2} />
                </div>
                {i < steps.length - 1 && (
                  <div className="w-3 h-px" style={{ background: i < stepAtual ? 'rgba(var(--accent-rgb),0.4)' : 'rgba(255,255,255,0.1)' }} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="flex-1 px-4 py-5 max-w-lg w-full mx-auto space-y-4">

          {/* Resumo do pedido — sempre visível */}
          <div className="rounded-3xl overflow-hidden" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-xs font-bold tracking-widest text-zinc-600">SEU PEDIDO</p>
              <button onClick={() => setTela('carrinho')} className="text-[10px] text-orange-500 font-bold">Editar</button>
            </div>
            <div className="px-4 py-3 space-y-1.5">
              {carrinho.map(i => (
                <div key={i.id} className="flex justify-between items-center text-sm">
                  <span className="text-zinc-400 flex items-center gap-2"><UtensilsCrossed size={13} strokeWidth={1.75} className="text-zinc-600 shrink-0" /><span>{i.qty}× {i.nome}</span></span>
                  <span className="text-white font-semibold">{brl(i.preco * i.qty)}</span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 flex justify-between items-center" style={{ background: '#161616', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="font-bold text-white">Total</span>
              <span className="text-xl font-black" style={{ color: 'var(--accent)' }}>{brl(totalValor)}</span>
            </div>
          </div>

          {/* ── ETAPA 1: TELEFONE ── */}
          {etapaCheckout === 'telefone' && (
            <div className="rounded-3xl overflow-hidden" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="px-4 pt-6 pb-4 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-orange-400"
                  style={{ background: 'rgba(var(--accent-rgb),0.12)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}><Smartphone size={28} strokeWidth={1.6} /></div>
                <h2 className="text-lg font-black text-white mb-1">Qual é o seu WhatsApp?</h2>
                <p className="text-xs text-zinc-500">Usamos para buscar seu cadastro e enviar atualizações do pedido</p>
              </div>
              <div className="px-4 pb-6">
                <input
                  ref={telInputRef}
                  type="tel"
                  placeholder="(44) 99999-9999"
                  value={form.telefone}
                  onChange={e => onTelefoneChange(e.target.value)}
                  autoFocus
                  className="w-full px-4 py-4 rounded-2xl text-lg font-bold text-white outline-none text-center tracking-widest"
                  style={{ background: '#1a1a1a', border: '1.5px solid var(--accent)', letterSpacing: 2 }}
                />
                {buscandoCliente && (
                  <div className="flex items-center justify-center gap-2 mt-3 text-violet-400 text-sm">
                    <Loader2 size={15} strokeWidth={2} className="animate-spin" /> Buscando cadastro...
                  </div>
                )}
                {!buscandoCliente && form.telefone.replace(/\D/g,'').length >= 10 && (
                  <button
                    onClick={() => buscarCliente(form.telefone)}
                    className="w-full mt-3 py-4 rounded-2xl font-black text-white text-base active:scale-95 transition-transform"
                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 8px 24px rgba(var(--accent-rgb),0.25)' }}>
                    <span className="flex items-center justify-center gap-2">Continuar <ArrowRight size={17} strokeWidth={2} /></span>
                  </button>
                )}
                <button onClick={() => setEtapaCheckout('novo_cliente')}
                  className="w-full mt-2 py-3 rounded-2xl text-sm font-semibold text-zinc-600 active:scale-95 transition-transform"
                  style={{ background: 'transparent' }}>
                  Continuar sem cadastro
                </button>
              </div>
            </div>
          )}

          {/* ── ETAPA 2A: CLIENTE ENCONTRADO ── */}
          {etapaCheckout === 'confirmar' && clienteEncontrado && (
            <form onSubmit={finalizarPedido} className="space-y-4">

              {/* Card boas-vindas + fidelidade */}
              <div className="rounded-3xl overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #0f1a0a, #111)', border: '1px solid rgba(34,197,94,0.3)' }}>
                <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-green-400"
                    style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.25)' }}><Hand size={26} strokeWidth={1.6} /></div>
                  <div className="flex-1">
                    <p className="font-black text-white text-xl leading-none">Olá, {clienteEncontrado.nome.split(' ')[0]}!</p>
                    <p className="text-xs text-green-400 mt-1 flex items-center gap-1"><Check size={12} strokeWidth={2.5} /> Cadastro encontrado</p>
                    {clienteEncontrado.endereco && <p className="text-xs text-zinc-600 mt-0.5 truncate flex items-center gap-1"><MapPin size={11} strokeWidth={1.75} className="shrink-0" /> {clienteEncontrado.endereco}</p>}
                  </div>
                  <button type="button" onClick={() => { setForm(p => ({ ...p, telefone: '' })); setEtapaCheckout('telefone'); setClienteEncontrado(null); }}
                    className="text-xs text-zinc-700 shrink-0 p-2"><X size={17} strokeWidth={2} /></button>
                </div>

                {/* Fidelidade */}
                {fid && (
                  <div className="mx-4 mb-4 rounded-2xl p-3" style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-violet-300"><Star size={14} strokeWidth={1.75} /></span>
                        <span className="text-xs font-black text-violet-300">Cartão Fidelidade</span>
                      </div>
                      <span className="text-xs text-zinc-500">{fid.total_pedidos} pedido{fid.total_pedidos !== 1 ? 's' : ''} no total</span>
                    </div>
                    {/* Selos */}
                    <div className="flex gap-1.5 mb-2">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="flex-1 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
                          style={{
                            background: i < fid.pedidos_no_ciclo ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.04)',
                            border: `1.5px solid ${i < fid.pedidos_no_ciclo ? 'rgba(139,92,246,0.8)' : 'rgba(255,255,255,0.07)'}`,
                          }}>
                          {i < fid.pedidos_no_ciclo ? <Fish size={15} strokeWidth={1.75} className="text-violet-200" /> : ''}
                        </div>
                      ))}
                    </div>
                    {fid.recompensas_disponiveis > 0
                      ? <p className="text-xs text-yellow-400 font-bold flex items-center gap-1.5"><Gift size={13} strokeWidth={1.75} /> Você tem {fid.recompensas_disponiveis} brinde disponível! Informe ao atendente.</p>
                      : <p className="text-[11px] text-zinc-600">Faltam <span className="text-violet-400 font-bold">{fid.proximo_em}</span> pedido{fid.proximo_em !== 1 ? 's' : ''} para ganhar um brinde</p>
                    }
                  </div>
                )}
              </div>

              {/* Como receber: entrega ou retirada */}
              <TipoEntregaSelector />

              {/* Endereço — só aparece se cliente não tem endereço salvo e é entrega */}
              {!ehRetirada && !clienteEncontrado.endereco && (
                <div className="rounded-3xl p-4" style={{ background: '#111', border: '1px solid rgba(var(--accent-rgb),0.3)' }}>
                  <label className="text-xs text-orange-400 font-bold flex items-center gap-1.5 mb-2">
                    <MapPin size={13} strokeWidth={1.75} />Endereço de entrega *
                    <span className="text-zinc-600 font-normal">(primeira vez)</span>
                  </label>
                  <input type="text" placeholder="Rua, número, bairro..."
                    value={form.endereco} onChange={e => setForm(p => ({ ...p, endereco: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                    style={{ background: '#1a1a1a', border: '1px solid var(--accent)' }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent-2)'}
                    onBlur={e => e.target.style.borderColor = 'var(--accent)'} />
                </div>
              )}

              {/* Observações */}
              <div className="rounded-3xl p-4" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
                <label className="text-xs text-zinc-600 font-medium flex items-center gap-1.5 mb-2">
                  <MessageSquare size={13} strokeWidth={1.75} />Alguma observação?
                </label>
                <input type="text" placeholder="Sem cebola, porta da frente..."
                  value={form.observacao} onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                  style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
              </div>

              {/* Bairro / Pagamento */}
              <div className="rounded-3xl p-4 space-y-4" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
                <BairroSelector />
                <PagamentoSelector />
                <ExtrasPedido />
              </div>

              {/* Cupom */}
              <CupomInput cupomCodigo={cupomCodigo} setCupomCodigo={setCupomCodigo} cupomAplicado={cupomAplicado} setCupomAplicado={setCupomAplicado} cupomBuscando={cupomBuscando} aplicarCupom={aplicarCupom} />

              {/* Resumo */}
              <ResumoValores totalValor={totalValor} desconto={calcDesconto()} cupomAplicado={cupomAplicado} frete={calcFrete()} />

              {abaixoMinimo && <p className="text-xs text-amber-400 text-center flex items-center justify-center gap-1.5"><AlertTriangle size={13} strokeWidth={2} /> Pedido mínimo de {brl(entrega.pedido_minimo)} (sem frete)</p>}
              <button type="submit" disabled={enviando || foraDeArea || abaixoMinimo}
                className="w-full py-4 rounded-2xl font-black text-white text-lg disabled:opacity-50 active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 8px 32px rgba(var(--accent-rgb),0.3)' }}>
                {enviando ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} strokeWidth={2} className="animate-spin" /> Enviando...</span> : <span className="flex items-center justify-center gap-2"><UtensilsCrossed size={18} strokeWidth={1.75} /> Confirmar pedido · {brl(Math.max(0, totalValor - calcDesconto()) + calcFrete())}</span>}
              </button>
            </form>
          )}

          {/* ── ETAPA 2B: NOVO CLIENTE ── */}
          {etapaCheckout === 'novo_cliente' && (
            <form onSubmit={finalizarPedido} className="space-y-4">
              {/* Como receber: entrega ou retirada */}
              <TipoEntregaSelector />

              <div className="rounded-3xl overflow-hidden" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-xs font-bold tracking-widest text-zinc-600">SEUS DADOS</p>
                  {form.telefone && <p className="text-xs text-zinc-700 mt-0.5 flex items-center gap-1"><Smartphone size={11} strokeWidth={1.75} /> {form.telefone} · novo cadastro</p>}
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { key: 'nome',     Icon: User,          label: 'Nome completo *',       placeholder: 'Ex: João Silva',          type: 'text' },
                    ...(ehRetirada ? [] : [{ key: 'endereco', Icon: MapPin, label: 'Endereço de entrega *', placeholder: 'Rua, número, bairro...', type: 'text' }]),
                    { key: 'observacao',Icon: MessageSquare, label: 'Observações',           placeholder: 'Sem cebola...',           type: 'text' },
                  ].map(({ key, Icon, label, placeholder, type }) => (
                    <div key={key}>
                      <label className="text-xs text-zinc-600 font-medium flex items-center gap-1.5 mb-1.5"><Icon size={13} strokeWidth={1.75} />{label}</label>
                      <input type={type} placeholder={placeholder}
                        value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                        className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none"
                        style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}
                        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                    </div>
                  ))}
                  <BairroSelector />
                  <PagamentoSelector />
                  <ExtrasPedido />
                </div>
              </div>

              {/* Cupom */}
              <CupomInput cupomCodigo={cupomCodigo} setCupomCodigo={setCupomCodigo} cupomAplicado={cupomAplicado} setCupomAplicado={setCupomAplicado} cupomBuscando={cupomBuscando} aplicarCupom={aplicarCupom} />

              {/* Resumo */}
              <ResumoValores totalValor={totalValor} desconto={calcDesconto()} cupomAplicado={cupomAplicado} frete={calcFrete()} />

              {abaixoMinimo && <p className="text-xs text-amber-400 text-center flex items-center justify-center gap-1.5"><AlertTriangle size={13} strokeWidth={2} /> Pedido mínimo de {brl(entrega.pedido_minimo)} (sem frete)</p>}
              <button type="submit" disabled={enviando || foraDeArea || abaixoMinimo}
                className="w-full py-4 rounded-2xl font-black text-white text-lg disabled:opacity-50 active:scale-95 transition-transform"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 8px 32px rgba(var(--accent-rgb),0.3)' }}>
                {enviando ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} strokeWidth={2} className="animate-spin" /> Enviando...</span> : <span className="flex items-center justify-center gap-2"><UtensilsCrossed size={18} strokeWidth={1.75} /> Confirmar pedido · {brl(Math.max(0, totalValor - calcDesconto()) + calcFrete())}</span>}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ── CARRINHO ─────────────────────────────────────────────────
  if (tela === 'carrinho') return (
    <div className="min-h-screen flex flex-col" style={{ background: 'radial-gradient(130% 110% at 50% -10%, #0d1320 0%, #05070d 72%)' }}>
      <Toaster />

      {/* Header */}
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3"
        style={{ background: 'rgba(7,7,7,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={() => setTela('menu')}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-zinc-400 transition-all active:scale-90"
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}><ArrowLeft size={20} strokeWidth={1.75} /></button>
        <div className="flex-1">
          <h1 className="font-black text-white text-lg leading-none">Meu Carrinho</h1>
          <p className="text-xs text-zinc-600 mt-0.5">{totalItens} {totalItens === 1 ? 'item' : 'itens'}</p>
        </div>
        {totalItens > 0 && (
          <span className="text-sm font-black" style={{ color: 'var(--accent)' }}>{brl(totalValor)}</span>
        )}
      </div>

      <div className="flex-1 px-4 py-4 space-y-2.5 max-w-lg w-full mx-auto">
        {carrinho.length === 0 && (
          <div className="text-center py-24">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 text-zinc-600"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}><ShoppingCart size={36} strokeWidth={1.5} /></div>
            <p className="text-zinc-500 mb-2 font-semibold">Seu carrinho está vazio</p>
            <p className="text-xs text-zinc-700 mb-5">Adicione itens do cardápio para continuar</p>
            <button onClick={() => setTela('menu')} className="text-sm font-bold px-6 py-2.5 rounded-xl"
              style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.25)' }}>
              Ver cardápio
            </button>
          </div>
        )}

        {carrinho.map(item => (
          <div key={item.id}
            className="flex items-center gap-3 p-3.5 rounded-2xl transition-all"
            style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>

            {/* Thumbnail */}
            <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden shrink-0 flex items-center justify-center relative"
              style={{ background: '#1a1a1a' }}>
              {item.foto ? (
                <img src={item.foto} alt={item.nome} className="w-full h-full object-cover" />
              ) : (
                <span style={{ color: 'rgba(251,146,60,0.85)' }}><UtensilsCrossed size={28} strokeWidth={1.5} /></span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm leading-tight">{item.nome}</p>
              {item.obs && (
                <p className="text-[11px] mt-0.5 truncate flex items-center gap-1" style={{ color: 'var(--accent)' }}><Pencil size={10} strokeWidth={1.75} /> {item.obs}</p>
              )}
              <p className="text-sm font-black mt-1" style={{ color: 'var(--accent)' }}>{brl(item.preco)}</p>
            </div>

            {/* Qty controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => removeItem(item.id)}
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-lg active:scale-90 transition-transform"
                style={{ background: '#1e1e1e', border: '1px solid rgba(255,255,255,0.06)' }}>−</button>
              <span className="w-6 text-center font-black text-white text-sm">{item.qty}</span>
              <button onClick={() => addItem(item)}
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-lg active:scale-90 transition-transform"
                style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 4px 12px rgba(var(--accent-rgb),0.3)' }}>+</button>
            </div>
          </div>
        ))}
      </div>

      {carrinho.length > 0 && (() => {
        const sugestoes = getSugestoes(carrinho);
        const pedidoMin = entrega.pedido_minimo || 0;

        return (
          <div className="max-w-lg w-full mx-auto">
            {/* ── Upsell: complete seu pedido ── */}
            {sugestoes.length > 0 && (
              <div className="px-4 pb-2">
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="text-base">🎯</span>
                  <div>
                    <p className="text-sm font-black text-white leading-none">Complete seu pedido</p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">Clientes que pediram isso também levaram</p>
                  </div>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
                  {sugestoes.map((item, idx) => {
                    const badges = [
                      idx === 0 && { txt: '🔥 Mais pedido', bg: 'rgba(239,68,68,0.85)' },
                      idx === 1 && { txt: '⭐ Recomendado', bg: 'rgba(245,158,11,0.85)' },
                      /molho|teriy|shoyu/i.test(item.nome) && { txt: '✨ Combina muito', bg: 'rgba(139,92,246,0.85)' },
                      /bebida|refri|suco|água/i.test(item._catNome || '') && { txt: '🥤 Refrescante', bg: 'rgba(14,165,233,0.85)' },
                      /sobremesa|doce|mochi|sorvete/i.test(item._catNome || '') && { txt: '🍡 Sobremesa', bg: 'rgba(236,72,153,0.85)' },
                    ].find(Boolean);
                    return (
                      <div key={item.id} className="shrink-0 rounded-2xl overflow-hidden flex flex-col"
                        style={{ width: 130, background: '#111', border: '1px solid rgba(255,255,255,0.07)' }}>
                        {/* Foto */}
                        <div className="relative w-full flex items-center justify-center" style={{ aspectRatio: '4/3', background: '#1a1a1a' }}>
                          {item.foto
                            ? <img src={item.foto} alt={item.nome} className="w-full h-full object-cover" />
                            : <span className="text-3xl">{item.emoji || '🍱'}</span>}
                          {badges && (
                            <span className="absolute top-1.5 left-1.5 text-[9px] font-black text-white px-1.5 py-0.5 rounded-md"
                              style={{ background: badges.bg, backdropFilter: 'blur(6px)' }}>
                              {badges.txt}
                            </span>
                          )}
                        </div>
                        {/* Info + add */}
                        <div className="p-2 flex flex-col flex-1">
                          <p className="text-xs font-bold text-white leading-tight line-clamp-2 flex-1 mb-1.5">{item.nome}</p>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-black" style={{ color: 'var(--accent)' }}>{brl(item.preco)}</span>
                            <button onClick={() => addItem(item)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-lg active:scale-90 transition-transform"
                              style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', boxShadow: '0 2px 8px rgba(var(--accent-rgb),0.4)' }}>+</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}


            <div className="sticky bottom-0 p-4"
              style={{ background: 'rgba(7,7,7,0.97)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {/* Total */}
              <div className="rounded-2xl p-4 mb-3 flex justify-between items-center"
                style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div>
                  <p className="text-xs text-zinc-600">Total do pedido</p>
                  <p className="text-2xl font-black text-white mt-0.5">{brl(totalValor)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-zinc-600">{totalItens} {totalItens === 1 ? 'item' : 'itens'}</p>
                  <p className="text-xs text-zinc-700 mt-0.5">Frete calculado no checkout</p>
                </div>
              </div>
              {horarioStatus && !horarioStatus.aberta ? (
                <button disabled className="w-full py-4 rounded-2xl font-black text-lg cursor-not-allowed" style={{ background: '#2a2a2a', color: '#888' }}>
                  <span className="flex items-center justify-center gap-2">🔒 Estamos fechados no momento</span>
                </button>
              ) : (
                <button onClick={() => setTela('checkout')}
                  className="w-full py-4 rounded-2xl font-black text-white text-lg active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 8px 32px rgba(var(--accent-rgb),0.35)' }}>
                  <span className="flex items-center justify-center gap-2">Ir para entrega <ArrowRight size={18} strokeWidth={2} /></span>
                </button>
              )}
            </div>
          </div>
        );
      })()}
      )}
    </div>
  );

  // ── MENU PRINCIPAL ────────────────────────────────────────────
  return (
    <div className="min-h-screen relative" style={{ background: 'radial-gradient(130% 110% at 50% -10%, #0d1320 0%, #05070d 72%)' }}>
      <div className="cardapio-estrelas" />
      <div className="relative" style={{ zIndex: 1 }}>
      <Toaster position="top-center" />

      {/* Acompanhar pedido recente — aparece se houver pedido salvo no
          dispositivo (cliente consegue voltar a rastrear após fechar a aba) */}
      {meusPedidos.length > 0 && (
        <a href={`/pedido/${meusPedidos[0].id}`}
          className="fixed z-30 left-1/2 -translate-x-1/2 bottom-24 flex items-center gap-2.5 px-4 py-2.5 rounded-full active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 8px 28px rgba(var(--accent-rgb),0.5)', textDecoration: 'none' }}>
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex w-full h-full rounded-full bg-white/70 animate-ping" />
            <span className="relative inline-flex rounded-full w-2 h-2 bg-white" />
          </span>
          <span className="text-white font-black text-xs">Acompanhar meu pedido #{meusPedidos[0].numero}</span>
        </a>
      )}

      {/* Modal detalhe do item */}
      {itemModal && (
        <ItemModal
          item={itemModal}
          carrinho={carrinho}
          onClose={() => setItemModal(null)}
          onConfirm={confirmItemModal}
        />
      )}

      {/* Modal detalhe do banner */}
      {bannerModal && (
        <BannerModal
          banner={bannerModal}
          onClose={() => setBannerModal(null)}
          onVerCardapio={() => menuRef.current?.scrollIntoView({ behavior: 'smooth' })}
          onAbrirItem={item => { setBannerModal(null); setItemModal(item); }}
        />
      )}

      {/* ── Header ── */}
      <header className="sticky top-0 z-20"
        style={{ background: 'rgba(7,7,7,0.93)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between py-3.5 gap-3">

            {/* Logo with open/closed badge */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src="/logo.png" alt="Logo" className="h-12 w-12 object-contain rounded-xl"
                  style={{ display: 'block' }}
                  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                <div className="w-12 h-12 rounded-xl items-center justify-center shrink-0 text-white"
                  style={{ display: 'none', background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
                  <UtensilsCrossed size={24} strokeWidth={1.75} />
                </div>
              </div>
              <div>
                <p className="font-black text-white text-base leading-none">{nomeRestaurante}</p>
                {/* Open/closed badge */}
                {horarioStatus ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: horarioStatus.aberta ? '#22c55e' : '#ef4444', boxShadow: `0 0 6px ${horarioStatus.aberta ? '#22c55e' : '#ef4444'}` }} />
                    <span className="text-[10px] font-semibold" style={{ color: horarioStatus.aberta ? '#22c55e' : '#ef4444' }}>
                      {horarioStatus.aberta ? 'Aberto' : 'Fechado'}
                    </span>
                  </div>
                ) : (
                  <p className="text-[10px] text-zinc-700 mt-0.5">Delivery</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {/* Botão admin — só aparece se estiver logado */}
              {getToken() && (
                <a href="/cardapio-admin"
                  className="w-9 h-9 flex items-center justify-center rounded-xl text-sm transition-all active:scale-90"
                  title="Gerenciar cardápio"
                  style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)', color: '#888' }}>
                  <Settings size={17} strokeWidth={1.75} />
                </a>
              )}

              {/* Botão carrinho — pill com glassmorphism */}
              <button onClick={() => setTela('carrinho')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95"
                style={{
                  background: totalItens > 0
                    ? 'linear-gradient(135deg, var(--accent), var(--accent-2))'
                    : 'rgba(255,255,255,0.05)',
                  color: totalItens > 0 ? '#fff' : '#555',
                  border: totalItens > 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  backdropFilter: totalItens > 0 ? 'none' : 'blur(12px)',
                  boxShadow: totalItens > 0 ? '0 4px 20px rgba(var(--accent-rgb),0.4)' : 'none',
                }}>
                <ShoppingCart size={16} strokeWidth={1.85} />
                {totalItens > 0 ? (
                  <><span className="font-black">{totalItens}</span><span className="hidden sm:inline font-semibold">· {brl(totalValor)}</span></>
                ) : (
                  <span className="text-zinc-600 text-xs">Carrinho</span>
                )}
              </button>
            </div>
          </div>

          {/* Category tabs — pill style */}
          <div ref={tabsRef} className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
            {categorias.map(cat => {
              const CatI = iconeCategoria(cat.nome);
              return (
              <button key={cat.id} data-cat={cat.id} onClick={() => scrollToCat(cat.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all shrink-0 active:scale-95"
                style={{
                  background: catAtiva === cat.id ? 'linear-gradient(135deg, var(--accent), var(--accent-2))' : 'transparent',
                  color: catAtiva === cat.id ? '#fff' : '#71717a',
                  border: catAtiva === cat.id ? 'none' : '1px solid rgba(255,255,255,0.06)',
                  boxShadow: catAtiva === cat.id ? '0 4px 12px rgba(var(--accent-rgb),0.3)' : 'none',
                }}>
                <CatI size={15} strokeWidth={1.75} /> {cat.nome}
              </button>
            );})}
          </div>
        </div>
      </header>

      {/* ── Conteúdo ── */}
      <div className="pb-36">

        {/* Banner pedido em andamento — destaque no topo pra o cliente
            voltar a acompanhar o pedido mesmo depois de fechar/reabrir a aba */}
        {meusPedidos.length > 0 && (
          <div className="max-w-2xl mx-auto px-4 pt-4">
            <a href={`/pedido/${meusPedidos[0].id}`}
              className="flex items-center gap-3 rounded-2xl p-4 active:scale-[0.98] transition-transform"
              style={{ background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.14), rgba(245,158,11,0.08))', border: '1px solid rgba(var(--accent-rgb),0.35)', textDecoration: 'none' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-orange-400"
                style={{ background: 'rgba(var(--accent-rgb),0.18)' }}>
                <Bike size={22} strokeWidth={1.75} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="relative flex w-2 h-2">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-orange-400/70 animate-ping" />
                    <span className="relative inline-flex rounded-full w-2 h-2 bg-orange-400" />
                  </span>
                  <p className="font-black text-orange-400 text-sm">Pedido em andamento</p>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Toque para acompanhar o status do pedido <strong className="text-zinc-200">#{meusPedidos[0].numero}</strong>
                </p>
              </div>
              <ArrowRight size={18} strokeWidth={2} className="text-orange-400 shrink-0" />
            </a>
          </div>
        )}

        {/* Banner fechamento temporário */}
        {fechamentoTemp && (() => {
          const ate = new Date(fechamentoTemp.ate);
          const hhmm = ate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const diffMs = ate - Date.now();
          const diffMin = Math.max(0, Math.ceil(diffMs / 60000));
          return (
            <div className="max-w-2xl mx-auto px-4 pt-4">
              <div className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-amber-400"
                  style={{ background: 'rgba(245,158,11,0.15)' }}><Pause size={19} strokeWidth={1.75} /></div>
                <div>
                  <p className="font-bold text-amber-400 text-sm">Estamos em uma pausa rápida</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Voltamos em aproximadamente <strong className="text-amber-300">{diffMin} {diffMin === 1 ? 'minuto' : 'minutos'}</strong> — às <strong className="text-amber-300">{hhmm}</strong> 🍣
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Banner horário fechado (não é fechamento temp) */}
        {!fechamentoTemp && horarioStatus && !horarioStatus.aberta && (
          <div className="max-w-2xl mx-auto px-4 pt-4">
            <div className="rounded-2xl p-4 flex items-center gap-3"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-red-400"
                style={{ background: 'rgba(239,68,68,0.15)' }}><Circle size={15} strokeWidth={3} fill="currentColor" /></div>
              <div>
                <p className="font-bold text-red-400 text-sm">Estamos fechados no momento</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {horarioStatus.mensagem_fechado || (
                    horarioStatus.motivo === 'ainda_nao_abriu'
                      ? `Abrimos às ${horarioStatus.abre?.replace(':','h')}`
                      : horarioStatus.motivo === 'ja_fechou'
                        ? `Voltamos amanhã`
                        : 'Fechado hoje'
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Carrossel */}
        <div className="max-w-2xl mx-auto pt-5 pb-6 px-4">
          <Carrossel onBannerClick={banner => {
            const todos = categorias.flatMap(c => c.itens || []);
            // 1. Vínculo direto por item_id
            if (banner.item_id) {
              const item = todos.find(i => i.id === Number(banner.item_id));
              if (item) { setItemModal(item); return; }
            }
            // 2. Fallback: busca por nome igual (case-insensitive)
            const porNome = todos.find(i => i.nome.trim().toLowerCase() === banner.titulo?.trim().toLowerCase());
            if (porNome) { setItemModal(porNome); return; }
            // 3. Fallback: exibe BannerModal com CTA que abre pelo nome se encontrar
            setBannerModal({ ...banner, _todosItens: todos });
          }} />
        </div>

        {/* Âncora para scroll "Ver cardápio" */}
        <div ref={menuRef} />

        {/* Info strip — glass cards */}
        <div className="max-w-2xl mx-auto px-4 mb-8">
          <div className="grid grid-cols-3 gap-2.5">
            {/* Entrega */}
            <div className="flex flex-col items-center py-3 rounded-2xl gap-0.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className="text-xs font-black text-white mt-0.5">{infoStrip.entrega}</span>
              <span className="text-[10px] text-zinc-600">Entrega</span>
            </div>

            {/* Frete */}
            <div className="flex flex-col items-center py-3 rounded-2xl gap-0.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}>
              <span className="text-white"><Bike size={18} strokeWidth={1.75} /></span>
              <span className="text-xs font-black text-white mt-0.5">{infoStrip.frete}</span>
              <span className="text-[10px] text-zinc-600">Frete</span>
            </div>

            {/* Nota — clicável se tiver URL do Google */}
            {googleReviewsUrl ? (
              <a href={googleReviewsUrl} target="_blank" rel="noreferrer"
                className="flex flex-col items-center py-3 rounded-2xl gap-0.5 no-underline transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)', textDecoration: 'none' }}>
                <span className="text-amber-400"><Star size={18} strokeWidth={1.75} fill="currentColor" /></span>
                <span className="text-xs font-black text-white mt-0.5">{infoStrip.nota}</span>
                <span className="text-[10px]" style={{ color: '#4285F4' }}>Google</span>
              </a>
            ) : (
              <div className="flex flex-col items-center py-3 rounded-2xl gap-0.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}>
                <span className="text-amber-400"><Star size={18} strokeWidth={1.75} fill="currentColor" /></span>
                <span className="text-xs font-black text-white mt-0.5">{infoStrip.nota}</span>
                <span className="text-[10px] text-zinc-600">Nota</span>
              </div>
            )}
          </div>
        </div>

        {/* Seções do cardápio */}
        <div className="max-w-2xl mx-auto px-4 space-y-12">
          {categorias.map(cat => {
            const temFoto = cat.itens.some(item => !!item.foto);
            const CatI = iconeCategoria(cat.nome);

            return (
              <section key={cat.id} ref={el => catRefs.current[cat.id] = el}>

                {/* Section header — accent bar + icon circle */}
                <div className="flex items-center gap-3 mb-5">
                  {/* Orange accent bar */}
                  <div className="w-1 h-8 rounded-full shrink-0"
                    style={{ background: 'linear-gradient(180deg, var(--accent), var(--accent-2))' }} />
                  {/* Icon circle */}
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(var(--accent-rgb),0.1)', border: '1px solid rgba(var(--accent-rgb),0.15)', color: '#fb923c' }}>
                    <CatI size={19} strokeWidth={1.75} />
                  </div>
                  <div>
                    <h2 className="font-black text-white text-xl leading-none">{cat.nome}</h2>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      {cat.itens.length} {cat.itens.length === 1 ? 'opção' : 'opções'}
                    </p>
                  </div>
                </div>

                {/* Grid — 2 cols when category has photos, list when not */}
                {temFoto ? (
                  <div className="grid grid-cols-2 gap-3">
                    {cat.itens.map(item => {
                      const qty = getQty(item.id);
                      const isAnim = animItem === item.id;
                      const itemCart = carrinho.find(c => c.id === item.id);
                      return (
                        <div key={item.id}
                          onClick={() => setItemModal(item)}
                          className="rounded-2xl overflow-hidden transition-all duration-200 flex flex-col cursor-pointer"
                          style={{
                            background: '#111',
                            border: `1px solid ${qty > 0 ? 'rgba(var(--accent-rgb),0.5)' : 'rgba(255,255,255,0.06)'}`,
                            boxShadow: qty > 0 ? '0 0 20px rgba(var(--accent-rgb),0.12)' : 'none',
                          }}>

                          {/* Photo area — 130px */}
                          <div className="relative overflow-hidden shrink-0"
                            style={{ height: 130, borderRadius: '16px 16px 0 0', background: '#1a1a1a' }}>
                            {item.foto ? (
                              <img src={item.foto} alt={item.nome}
                                className="w-full h-full object-cover"
                                style={{ transform: isAnim ? 'scale(1.05)' : 'scale(1)', transition: 'transform 0.3s' }} />
                            ) : (
                              <>
                                <div className="absolute inset-0"
                                  style={{ background: 'radial-gradient(circle at 50% 50%, rgba(var(--accent-rgb),0.08), transparent)' }} />
                                <div className="w-full h-full flex items-center justify-center" style={{ color: 'rgba(251,146,60,0.85)' }}>
                                  <span className="transition-transform duration-300"
                                    style={{ transform: isAnim ? 'scale(1.3) rotate(-8deg)' : 'scale(1)' }}>
                                    <CatI size={44} strokeWidth={1.5} />
                                  </span>
                                </div>
                              </>
                            )}
                            {/* Badge de qty no canto */}
                            {qty > 0 && (
                              <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center font-black text-xs text-white"
                                style={{ background: 'var(--accent)', boxShadow: '0 2px 8px rgba(var(--accent-rgb),0.5)' }}>
                                {qty}
                              </div>
                            )}
                          </div>

                          {/* Info below photo */}
                          <div className="p-3 flex flex-col flex-1 justify-between">
                            <div>
                              <p className="font-bold text-white text-sm leading-tight">{item.nome}</p>
                              {item.descricao && (
                                <p className="text-xs text-zinc-500 mt-0.5 leading-snug line-clamp-1">{item.descricao}</p>
                              )}
                              {/* Obs adicionada */}
                              {itemCart?.obs && (
                                <p className="text-[10px] mt-1 truncate" style={{ color: 'var(--accent)' }}><Pencil size={10} strokeWidth={1.75} className="inline mr-0.5 align-middle" />{itemCart.obs}</p>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-3">
                              <p className="font-black text-base" style={{ color: 'var(--accent)' }}>{brl(item.preco)}</p>
                              {qty === 0 ? (
                                <button
                                  onClick={e => { e.stopPropagation(); setItemModal(item); }}
                                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-black text-white text-xs active:scale-90 transition-transform"
                                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 4px 12px rgba(var(--accent-rgb),0.3)' }}>
                                  +
                                </button>
                              ) : (
                                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => removeItem(item.id)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white active:scale-90 transition-transform"
                                    style={{ background: '#1e1e1e' }}>−</button>
                                  <span className="w-5 text-center font-black text-white text-sm">{qty}</span>
                                  <button onClick={() => addItem(item)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white active:scale-90 transition-transform"
                                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>+</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Enhanced horizontal list for categories without photos */
                  <div className="space-y-2.5">
                    {cat.itens.map(item => {
                      const qty = getQty(item.id);
                      const isAnim = animItem === item.id;
                      const itemCart = carrinho.find(c => c.id === item.id);

                      return (
                        <div key={item.id}
                          onClick={() => setItemModal(item)}
                          className="flex rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer"
                          style={{
                            background: qty > 0 ? '#131313' : '#0f0f0f',
                            border: `1px solid ${qty > 0 ? 'rgba(var(--accent-rgb),0.3)' : 'rgba(255,255,255,0.05)'}`,
                            boxShadow: qty > 0 ? '0 0 20px rgba(var(--accent-rgb),0.08)' : 'none',
                          }}>

                          {/* Emoji area */}
                          <div
                            className="shrink-0 flex items-center justify-center relative overflow-hidden"
                            style={{ width: 76, minHeight: 80 }}>
                            <div className="absolute inset-0"
                              style={{
                                background: qty > 0
                                  ? 'radial-gradient(circle at 40% 40%, rgba(var(--accent-rgb),0.12), transparent)'
                                  : 'radial-gradient(circle at 40% 40%, rgba(255,255,255,0.02), transparent)',
                              }} />
                            <span
                              className="relative z-10 transition-transform duration-300"
                              style={{ color: 'rgba(251,146,60,0.85)', transform: isAnim ? 'scale(1.3) rotate(-8deg)' : 'scale(1) rotate(0deg)' }}>
                              <CatI size={32} strokeWidth={1.5} />
                            </span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 px-3 py-3.5 flex flex-col justify-between min-w-0">
                            <div>
                              <p className="font-bold text-white text-sm leading-tight">{item.nome}</p>
                              {item.descricao && (
                                <p className="text-xs text-zinc-600 mt-0.5 leading-snug line-clamp-1">{item.descricao}</p>
                              )}
                              {/* Obs adicionada */}
                              {itemCart?.obs && (
                                <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--accent)' }}><Pencil size={10} strokeWidth={1.75} className="inline mr-0.5 align-middle" />{itemCart.obs}</p>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <p className="font-black text-base" style={{ color: 'var(--accent)' }}>{brl(item.preco)}</p>

                              {qty === 0 ? (
                                <button
                                  onClick={e => { e.stopPropagation(); setItemModal(item); }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-white text-xs active:scale-90 transition-transform"
                                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 4px 12px rgba(var(--accent-rgb),0.35)' }}>
                                  + Adicionar
                                </button>
                              ) : (
                                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => removeItem(item.id)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white active:scale-90 transition-transform"
                                    style={{ background: '#1e1e1e' }}>−</button>
                                  <span className="w-5 text-center font-black text-white text-sm">{qty}</span>
                                  <button onClick={() => addItem(item)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white active:scale-90 transition-transform"
                                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>+</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* Nudge de upsell — aparece 6s após 1º item */}
      {upsellNudge && totalItens > 0 && (
        <div className="fixed z-40 flex justify-center"
          style={{ bottom: 96, left: '50%', transform: 'translateX(-50%)', animation: 'fadeSlideUp 0.35s ease' }}>
          <style>{`@keyframes fadeSlideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
          <button onClick={() => { setUpsellNudge(false); setTela('carrinho'); }}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl font-bold text-white text-sm active:scale-95 transition-transform"
            style={{ background: 'rgba(14,165,233,0.95)', backdropFilter: 'blur(16px)', boxShadow: '0 4px 24px rgba(14,165,233,0.5)' }}>
            <span className="text-lg">🥤</span>
            <span>Vai uma bebida? Toque para ver →</span>
            <button onClick={e => { e.stopPropagation(); setUpsellNudge(false); }} className="ml-1 opacity-70"><X size={14} /></button>
          </button>
        </div>
      )}

      {/* FAB carrinho — glassmorphism */}
      {totalItens > 0 && (
        <div className="fixed bottom-6 z-30"
          style={{ left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: 672 }}>
          <button onClick={() => setTela('carrinho')}
            className="w-full py-3.5 px-5 rounded-2xl flex items-center justify-between active:scale-[0.98] transition-transform"
            style={{
              background: 'rgba(var(--accent-rgb),0.95)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 -2px 40px rgba(var(--accent-rgb),0.4), 0 8px 40px rgba(var(--accent-rgb),0.5)',
            }}>
            {/* Left: bag icon with count badge */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
                  style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <ShoppingBag size={18} strokeWidth={1.75} />
                </div>
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center font-black text-xs"
                  style={{ background: '#fff', color: 'var(--accent)' }}>
                  {totalItens}
                </div>
              </div>
              {/* Item summary */}
              <span className="text-white font-bold text-sm">
                {totalItens === 1 ? '1 item' : `${totalItens} itens`} · Ver carrinho
              </span>
            </div>
            {/* Right: total */}
            <span className="text-white font-black text-base">{brl(totalValor)}</span>
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
