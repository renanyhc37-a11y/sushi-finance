import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { getToken } from '../hooks/useAuth';
import { BANNER_ASPECT, elStyleBase, BannerBg, parseDesign } from '../components/bannerStyle';
import {
  GlassWater, Boxes, IceCreamCone, Flame, Fish, CircleDot, Soup, Salad,
  Star, UtensilsCrossed, ShoppingCart, Settings, Pause, Circle, Leaf,
  Pencil, X, MessageSquare, Trash2, Check, CheckCircle2, Bike, Tag, MapPin,
  PartyPopper, Lightbulb, Smartphone, Banknote, CreditCard, User, ArrowLeft,
  ArrowRight, Gift, Hand, ShoppingBag, Phone, Truck, Loader2, AlertTriangle, Clock, Hash, Wallet,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '/api';
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Endereço de entrega precisa ter número da casa (rejeita "s/n" e endereços sem dígito).
function temNumeroCasa(endereco) {
  const e = (endereco || '').toLowerCase();
  if (/\bs\/?n[°º]?\b|\bsem\s*n[uú]mero\b|\bsn\b/.test(e)) return false;
  return /\d/.test(e);
}

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
// Os banners vêm SEMPRE do banco (/api/cardapio/banners), gerenciados no admin.
// Não existe fallback hardcoded: um array de demonstração aqui piscava
// promoções falsas ("Combo Família R$ 89,90") para o cliente real no instante
// entre o primeiro render e a resposta da API. Enquanto carrega, mostramos um
// skeleton neutro — sem texto e sem preço.

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
  const [carregando, setCarregando] = useState(true);
  const xInicioRef = useRef(null);
  const timerRef = useRef(null);

  // Carrega banners do banco (única fonte — sem fallback hardcoded).
  // Polling a cada 90s para refletir alterações sem o cliente precisar atualizar
  useEffect(() => {
    const carregar = () =>
      fetch(`${BASE}/cardapio/banners`)
        .then(r => r.ok ? r.json() : [])
        .then(data => { if (Array.isArray(data)) setBannersDB(data); })
        .catch(() => {})
        .finally(() => setCarregando(false));
    carregar();
    const t = setInterval(carregar, 90_000);
    return () => clearInterval(t);
  }, []);

  const lista = bannersDB;

  const irPara = useCallback((idx) => {
    // Guarda contra lista vazia: `% 0` daria NaN e nenhum slide renderizaria
    setAtual(lista.length ? (idx + lista.length) % lista.length : 0);
  }, [lista.length]);

  const resetTimer = useCallback(() => {
    clearInterval(timerRef.current);
    if (lista.length < 2) return; // 0 slides: `% 0` = NaN · 1 slide: nada a girar
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

  // Placeholder neutro enquanto a API responde: reserva o espaço (sem pulo de
  // layout) sem inventar promoção nenhuma. Sem banners ativos, some de vez.
  if (lista.length === 0) {
    if (!carregando) return null;
    return (
      <div className="relative overflow-hidden animate-pulse"
        style={{ borderRadius: 24, aspectRatio: BANNER_ASPECT, background: 'rgba(255,255,255,0.04)' }} />
    );
  }

  return (
    <div className="relative overflow-hidden select-none"
      style={{ borderRadius: 24, aspectRatio: BANNER_ASPECT, containerType: 'inline-size' }}
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

          {/* Fundo — renderização compartilhada com o editor (WYSIWYG) */}
          <BannerBg banner={banner} ds={parseDesign(banner.design)} />

          {/* Conteúdo — layout livre se design salvo, senão layout padrão */}
          {(() => {
            const d = parseDesign(banner.design);
            const els = d?.elementos;
            const _rawOps = banner.opcoes_escolha
              ? (() => { try { return typeof banner.opcoes_escolha === 'string' ? JSON.parse(banner.opcoes_escolha) : banner.opcoes_escolha; } catch { return []; } })()
              : [];
            const ops = Array.isArray(_rawOps) ? _rawOps : [];

            if (els) {
              // ── Layout customizado pelo editor visual ──
              // Mesmo estilo do editor (WYSIWYG) — fonte escala com o tamanho.
              const elStyle = (key) => {
                const e = els[key];
                if (!e || e.oculto) return null;
                return { ...elStyleBase(e, key), pointerEvents: 'none', maxWidth: '92%' };
              };
              return (
                <div className="absolute inset-0">
                  {banner.tag && elStyle('tag') && (
                    <span style={elStyle('tag')} className="font-black tracking-wider text-[11px]">{banner.tag}</span>
                  )}
                  {banner.destaque && elStyle('destaque') && (
                    <span style={elStyle('destaque')} className="font-black leading-none whitespace-nowrap">{banner.destaque}</span>
                  )}
                  {elStyle('titulo') && (
                    <h2 style={{ ...elStyle('titulo'), lineHeight: 1.15 }}>{banner.titulo}</h2>
                  )}
                  {banner.subtitulo && elStyle('subtitulo') && (
                    <p style={{ ...elStyle('subtitulo'), lineHeight: 1.3 }}>{banner.subtitulo}</p>
                  )}
                  {ops.length > 0 && elStyle('opcoes') && (
                    <div style={{ ...elStyle('opcoes'), display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {ops.map((op, i) => (
                        <span key={i} style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', borderRadius: 999, padding: '2px 9px', fontSize: (els.opcoes?.size || 12) - 1 }}>
                          {op}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            // ── Layout padrão ──
            return (
              <div className="absolute inset-0 flex flex-col justify-between p-5">
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-black tracking-wider px-3 py-1.5 rounded-full"
                    style={{ background: 'rgba(0,0,0,0.45)', color: '#fff', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.15)', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                    {banner.tag}
                  </span>
                  {banner.destaque && (
                    <div className="shrink-0 px-3 py-2 rounded-xl text-center"
                      style={{ background: 'rgba(var(--accent-rgb),0.9)', backdropFilter: 'blur(8px)', boxShadow: '0 4px 16px rgba(var(--accent-rgb),0.4)' }}>
                      <span className="font-black text-white text-sm leading-none whitespace-nowrap">{banner.destaque}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-end">
                  <h2 className="text-2xl font-black text-white leading-tight"
                    style={{ textShadow: '0 2px 12px rgba(0,0,0,0.7)' }}>
                    {banner.titulo}
                  </h2>
                  {banner.subtitulo && (
                    <p className="text-sm text-white/80 mt-1.5 leading-snug"
                      style={{ textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>
                      {banner.subtitulo}
                    </p>
                  )}
                  {ops.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-[10px] text-white/60 self-center">Escolha:</span>
                      {ops.map((op, i) => (
                        <span key={i} className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', backdropFilter: 'blur(8px)' }}>
                          {op}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
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
function ResumoValores({ totalValor, desconto, cupomAplicado, descontoCashback = 0, frete = 0 }) {
  if (!cupomAplicado && !frete && !descontoCashback) return null;
  const total = Math.max(0, totalValor - desconto - descontoCashback) + frete;
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
      {descontoCashback > 0 && (
        <div className="flex justify-between text-sm">
          <span className="text-green-500">Cashback usado</span>
          <span className="text-green-400 font-bold">- R$ {Number(descontoCashback).toFixed(2).replace('.',',')}</span>
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

// ── CashbackToggle ────────────────────────────────────────────
function CashbackToggle({ clienteEncontrado, usarCashback, setUsarCashback }) {
  if (!clienteEncontrado?.cashback_ativo) return null;
  return (
    <div className="rounded-3xl p-4 flex items-center justify-between gap-3" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="min-w-0">
        <p className="text-xs font-bold text-zinc-600 tracking-widest mb-1 flex items-center gap-1.5"><Wallet size={12} strokeWidth={1.75} /> CASHBACK</p>
        <p className="text-sm text-zinc-300">Você tem <span className="font-bold text-green-400">R$ {Number(clienteEncontrado.cashback_saldo).toFixed(2).replace('.',',')}</span> disponível</p>
      </div>
      <button type="button" onClick={() => setUsarCashback(v => !v)} aria-pressed={usarCashback}
        className="w-12 h-7 rounded-full relative transition-colors shrink-0"
        style={{ background: usarCashback ? '#10b981' : 'rgba(255,255,255,0.12)' }}>
        <span className="absolute top-1 w-5 h-5 rounded-full bg-white transition-all duration-200" style={{ left: usarCashback ? 26 : 4 }} />
      </button>
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
  const precoEfetivo = item.promo_ativa && item.preco_promo ? item.preco_promo : item.preco;
  const total = qty * precoEfetivo;

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
              <img src={item.foto} alt={item.nome} decoding="async" className="w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(17,17,17,0.9) 0%, transparent 60%)' }} />
              {item.promo_ativa === 1 && item.promo_tag && (
                <div className="absolute top-3 left-3">
                  <span className="inline-flex items-center text-[11px] font-black px-3 py-1.5 rounded-full text-white animate-pulse"
                    style={{ background: '#ef4444', boxShadow: '0 4px 14px rgba(239,68,68,0.55)', letterSpacing: '0.04em' }}>
                    {item.promo_tag}
                  </span>
                </div>
              )}
              <button onClick={close}
                className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white font-bold"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}><X size={17} strokeWidth={2} /></button>
            </div>
          ) : (
            <div className="relative flex items-center justify-center shrink-0" style={{ height: 160, background: '#181818' }}>
              <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(var(--accent-rgb),0.1), transparent 70%)' }} />
              <span style={{ color: 'rgba(251,146,60,0.85)' }}><UtensilsCrossed size={64} strokeWidth={1.4} /></span>
              {item.promo_ativa === 1 && item.promo_tag && (
                <div className="absolute top-3 left-3">
                  <span className="inline-flex items-center text-[11px] font-black px-3 py-1.5 rounded-full text-white animate-pulse"
                    style={{ background: '#ef4444', boxShadow: '0 4px 14px rgba(239,68,68,0.55)', letterSpacing: '0.04em' }}>
                    {item.promo_tag}
                  </span>
                </div>
              )}
              <button onClick={close}
                className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-white font-bold"
                style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}><X size={17} strokeWidth={2} /></button>
            </div>
          )}

          <div className="px-5 pt-4 pb-6 space-y-5">

            {/* Nome e preço */}
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-black text-white text-2xl leading-tight flex-1">{item.nome}</h2>
              <div className="shrink-0 mt-0.5 text-right">
                {item.promo_ativa === 1 && item.preco_promo ? (
                  <>
                    <span className="block text-sm line-through" style={{ color: '#71717a' }}>{brl(item.preco)}</span>
                    <span className="font-black text-2xl" style={{ color: '#10b981' }}>{brl(item.preco_promo)}</span>
                  </>
                ) : (
                  <span className="font-black text-2xl" style={{ color: 'var(--accent)' }}>{brl(item.preco)}</span>
                )}
              </div>
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

// ── TrocoInput: input não-controlado para não fechar teclado mobile ──
const TrocoInput = React.memo(function TrocoInput({ aPagar, onBlurChange }) {
  const ref = useRef(null);
  const feedbackRef = useRef(null);
  const brlLocal = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  function handleInput(e) {
    const raw = e.target.value;
    const num = raw ? Number(String(raw).replace(',', '.')) : 0;
    if (!feedbackRef.current) return;
    if (raw && num >= aPagar) {
      feedbackRef.current.textContent = 'Troco: ' + brlLocal(num - aPagar);
      feedbackRef.current.style.color = '#4ade80';
    } else if (raw && num < aPagar) {
      feedbackRef.current.textContent = 'O valor precisa ser ≥ ' + brlLocal(aPagar);
      feedbackRef.current.style.color = '#fbbf24';
    } else {
      feedbackRef.current.textContent = '';
    }
  }

  return (
    <div className="mt-2.5 rounded-xl p-3" style={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)' }}>
      <label className="text-xs text-zinc-500 font-medium flex items-center gap-1.5 mb-2">
        💵 Precisa de troco? Pague com quanto?
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">R$</span>
        <input
          ref={ref}
          type="text" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*"
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
          placeholder={`Deixe em branco se tiver o valor exato`}
          onInput={handleInput}
          onBlur={e => onBlurChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm text-white outline-none"
          style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)' }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        />
      </div>
      <div ref={feedbackRef} className="text-xs mt-1.5" style={{ minHeight: '1.25rem' }} />
    </div>
  );
});

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
  const [form, setForm] = useState({ nome: '', telefone: '', endereco: '', numero: '', complemento: '', observacao: '', pagamento: '', troco_para: '', bairro: '', aniversario: '', agendar: false, agendado_para: '', tipo_entrega: 'entrega' });
  const [retiradaAtiva, setRetiradaAtiva] = useState(false);
  const [enderecoLoja, setEnderecoLoja] = useState('');
  const [pixData, setPixData] = useState(null); // { codigo, qr }
  const [enviando, setEnviando] = useState(false);
  const [animItem, setAnimItem] = useState(null);
  const [itemModal, setItemModal] = useState(null);   // item selecionado para detalhe
  const [bannerModal, setBannerModal] = useState(null); // banner selecionado
  const menuRef = useRef(null);
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [usarEnderecoSalvo, setUsarEnderecoSalvo] = useState(true);
  const [editandoEndereco, setEditandoEndereco] = useState(false);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [etapaCheckout, setEtapaCheckout] = useState('telefone'); // 'telefone' | 'confirmar' | 'novo_cliente'
  const [cupomCodigo, setCupomCodigo] = useState('');
  const [cupomAplicado, setCupomAplicado] = useState(null); // { codigo, tipo, valor, descricao }
  const [cupomBuscando, setCupomBuscando] = useState(false);
  const [cupomAtivo, setCupomAtivo] = useState(null); // cupom ativo para exibição pública
  const [usarCashback, setUsarCashback] = useState(false);
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
    const carregarCardapio = () =>
      fetch(`${BASE}/cardapio`)
        .then(r => r.json())
        .then(data => { setCategorias(data); if (data.length) setCatAtiva(id => id || data[0].id); })
        .catch(() => {});
    carregarCardapio();
    const t = setInterval(carregarCardapio, 30_000); // atualiza a cada 30s
    // Atualiza ao voltar para a aba (operador salva no admin e muda de aba)
    const onFocus = () => { if (document.visibilityState === 'visible') carregarCardapio(); };
    document.addEventListener('visibilitychange', onFocus);

    fetch(`${BASE}/cardapio/horario`)
      .then(r => r.json())
      .then(data => setHorarioStatus(data))
      .catch(() => {});
    fetch(`${BASE}/cardapio/cupom-ativo`)
      .then(r => r.json())
      .then(data => setCupomAtivo(data || null))
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
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onFocus); };
  }, []);

  const totalItens = carrinho.reduce((s, i) => s + i.qty, 0);
  const totalValor = carrinho.reduce((s, i) => s + i.preco * i.qty, 0);

  const [upsellNudge, setUpsellNudge] = useState(false);
  const nudgeTimerRef = useRef(null);
  const onTrocoBlur = useCallback(v => setForm(p => ({ ...p, troco_para: v })), []);

  // Sugestões de upsell: itens marcados como is_sugestao têm prioridade absoluta
  function getSugestoes(carr) {
    const ids = new Set(carr.map(c => c.id));
    const PRIO = /bebida|suco|refri|água|agua|drink|cerveja|saquê|sake|chá|cha\b|sobremesa|doce|mochi|sorvete|extra|adicional|molho|tarê|tare|teriy|acompan|sobrem/i;
    const PRIO_ITEM = /tarê|tare|molho|sobremesa|mochi|sorvete|refri|suco|bebida|cerveja/i;
    const marcados = [], prio = [], outros = [];
    for (const cat of categorias) {
      for (const item of (cat.itens || [])) {
        if (!item.disponivel || ids.has(item.id)) continue;
        const enriched = { ...item, _catNome: cat.nome };
        if (item.is_sugestao) marcados.push(enriched);
        else if (PRIO.test(cat.nome) || PRIO_ITEM.test(item.nome)) prio.push(enriched);
        else outros.push(enriched);
      }
    }
    // Se há itens marcados manualmente, usa só eles (até 6)
    if (marcados.length > 0) return marcados.slice(0, 6);
    // Fallback: comportamento automático por regex
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
        setUsarEnderecoSalvo(!!(data.endereco));
        setEditandoEndereco(!data.endereco);
        setForm(p => ({ ...p, nome: data.nome, endereco: data.endereco || '', bairro: data.bairro || '' }));
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

  async function salvarEnderecoCliente(telefone, endereco, bairro) {
    const digits = telefone.replace(/\D/g, '');
    if (digits.length < 8) return;
    try {
      await fetch(`${BASE}/cardapio/cliente/${digits}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endereco, bairro }),
      });
    } catch {}
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

  function calcDescontoCashback() {
    if (!usarCashback || !clienteEncontrado?.cashback_ativo) return 0;
    return Math.min(clienteEncontrado.cashback_saldo, Math.max(0, totalValor - calcDesconto()));
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
    const usandoEnderecoSalvo = !editandoEndereco && clienteEncontrado?.endereco;
    if (!ehRetirada && !usandoEnderecoSalvo && !form.endereco.trim()) return toast.error('Informe a rua de entrega');
    if (!ehRetirada && !usandoEnderecoSalvo && !form.numero.trim()) return toast.error('Informe o número da residência');
    // Endereço salvo antigo pode estar sem número → obriga completar antes de seguir
    if (!ehRetirada && usandoEnderecoSalvo && !temNumeroCasa(clienteEncontrado.endereco)) {
      setEditandoEndereco(true);
      setForm(p => ({ ...p, endereco: clienteEncontrado.endereco }));
      return toast.error('Seu endereço salvo está sem o número da casa. Informe o número para a entrega chegar certinho.');
    }
    if (!form.pagamento) return toast.error('Selecione a forma de pagamento');
    // Endereço final: salvo do cadastro ou digitado agora
    const enderecoFinal = ehRetirada ? '' : (
      usandoEnderecoSalvo
        ? clienteEncontrado.endereco
        : [form.endereco, form.numero, form.complemento].filter(Boolean).join(', ')
    );
    const bairroFinal = ehRetirada ? null : (
      usandoEnderecoSalvo && clienteEncontrado?.bairro && !form.bairro
        ? clienteEncontrado.bairro
        : (form.bairro || null)
    );
    // Salva endereço novo no cadastro do cliente (sem esperar)
    if (!ehRetirada && clienteEncontrado && editandoEndereco && form.endereco.trim()) {
      salvarEnderecoCliente(form.telefone, [form.endereco, form.numero, form.complemento].filter(Boolean).join(', '), form.bairro);
    }
    setEnviando(true);
    try {
      const res = await fetch(`${BASE}/cardapio/pedido`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_nome: form.nome,
          cliente_telefone: form.telefone,
          cliente_endereco: enderecoFinal,
          tipo_entrega: form.tipo_entrega,
          observacao: form.observacao,
          forma_pagamento: form.pagamento,
          troco_para: form.pagamento === 'dinheiro' && form.troco_para ? Number(String(form.troco_para).replace(',', '.')) : null,
          bairro: bairroFinal,
          aniversario: form.aniversario || null,
          agendado_para: form.agendar && form.agendado_para ? new Date(form.agendado_para).toISOString() : null,
          cupom_codigo: cupomAplicado?.codigo || null,
          usar_cashback: usarCashback,
          utm: getUTM(),
          itens: carrinho.map(c => ({ item_id: c.id, quantidade: c.qty, observacao: c.obs || null })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Erro');
      // Tráfego pago: dispara o evento de compra nos pixels (Meta/Google)
      dispararCompra(data.total, data.id);
      setPedidoFeito({ id: data.id, numero: data.numero, total: data.total, desconto: calcDesconto(), descontoCashback: data.desconto_cashback || 0, telefone: form.telefone, pagamento: form.pagamento, fidelidade: data.fidelidade, ganhou_recompensa: data.ganhou_recompensa, brinde_resgatado: data.brinde_resgatado });
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
      setUsarCashback(false);
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

          {/* Cashback usado */}
          {pedidoFeito.descontoCashback > 0 && (
            <div className="rounded-2xl p-4 mb-3 flex items-center gap-3"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <span className="text-green-400"><Wallet size={24} strokeWidth={1.75} /></span>
              <div>
                <p className="text-sm font-bold text-green-400">Cashback usado!</p>
                <p className="text-xs text-zinc-500 mt-0.5">Você economizou R$ {Number(pedidoFeito.descontoCashback).toFixed(2).replace('.',',')} do seu saldo</p>
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

          {/* Card brinde resgatado automaticamente */}
          {pedidoFeito.brinde_resgatado && (
            <div className="rounded-2xl p-4 mb-3 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.08))', border: '2px solid rgba(251,191,36,0.4)', boxShadow: '0 0 24px rgba(251,191,36,0.15)' }}>
              <div className="flex justify-center mb-2 text-yellow-400"><Gift size={34} strokeWidth={1.6} /></div>
              <p className="font-black text-yellow-400 text-base">
                {pedidoFeito.ganhou_recompensa ? 'Parabéns! Você completou o ciclo e ganhou um brinde!' : 'Você tinha um brinde disponível!'}
              </p>
              <p className="text-xs text-yellow-300/70 mt-1">{pedidoFeito.brinde_resgatado.nome} grátis — já incluso no seu pedido 🎁</p>
            </div>
          )}

          {/* Card fidelidade */}
          {fid && !pedidoFeito.brinde_resgatado && (
            <div className="rounded-2xl mb-3 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #1a1033 0%, #110d20 100%)', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 4px 24px rgba(139,92,246,0.12)' }}>
              {/* Cabeçalho */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3"
                style={{ borderBottom: '1px solid rgba(139,92,246,0.15)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: '0 2px 8px rgba(124,58,237,0.4)' }}>
                    <Star size={15} strokeWidth={2} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white leading-none">Cartão Fidelidade</p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#a78bfa' }}>A cada 10 pedidos, ganhe um brinde</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black leading-none" style={{ color: '#c4b5fd' }}>{fid.pedidos_no_ciclo}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(167,139,250,0.5)' }}>de 10</p>
                </div>
              </div>
              {/* Selos */}
              <div className="px-4 py-3">
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: TOTAL_SELOS }).map((_, i) => {
                    const preenchido = i < fid.pedidos_no_ciclo;
                    const esteAtual = i === fid.pedidos_no_ciclo - 1;
                    return (
                      <div key={i} className="flex flex-col items-center gap-1">
                        <div className="w-full aspect-square rounded-xl flex items-center justify-center relative transition-all"
                          style={{
                            background: preenchido
                              ? 'linear-gradient(135deg, rgba(124,58,237,0.7), rgba(91,33,182,0.5))'
                              : 'rgba(255,255,255,0.04)',
                            border: preenchido
                              ? '1.5px solid rgba(167,139,250,0.6)'
                              : '1.5px solid rgba(255,255,255,0.07)',
                            boxShadow: esteAtual ? '0 0 12px rgba(139,92,246,0.6)' : 'none',
                          }}>
                          {preenchido
                            ? <span style={{ fontSize: 16, lineHeight: 1 }}>🍣</span>
                            : <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }} />
                          }
                        </div>
                        <p className="text-[9px] font-bold" style={{ color: preenchido ? '#a78bfa' : 'rgba(255,255,255,0.15)' }}>
                          {i + 1}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Rodapé progresso */}
              <div className="px-4 pb-4">
                <div className="h-1.5 rounded-full w-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <div className="h-1.5 rounded-full transition-all duration-700"
                    style={{ width: `${(fid.pedidos_no_ciclo / TOTAL_SELOS) * 100}%`, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }} />
                </div>
                <p className="text-[10px] mt-2 text-center" style={{ color: 'rgba(167,139,250,0.6)' }}>
                  {fid.recompensas_disponiveis > 0
                    ? <span style={{ color: '#fbbf24', fontWeight: 700 }}>🎁 Brinde disponível!</span>
                    : <><span style={{ color: '#c4b5fd', fontWeight: 700 }}>{fid.proximo_em} pedido{fid.proximo_em !== 1 ? 's' : ''}</span> para ganhar um brinde</>
                  }
                </p>
              </div>
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

          <button onClick={() => { setPedidoFeito(null); setClienteEncontrado(null); setPixData(null); setForm({ nome:'', telefone:'', endereco:'', numero:'', complemento:'', observacao:'', pagamento:'', troco_para:'', bairro:'', aniversario:'', agendar:false, agendado_para:'' }); setTela('menu'); }}
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

    const pagamentoSelectorJsx = (
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
        {form.pagamento === 'dinheiro' && (
          <TrocoInput aPagar={totalValor - calcDesconto() - calcDescontoCashback()} onBlurChange={onTrocoBlur} />
        )}
      </div>
    );

    // Seletor de bairro / frete (só aparece se a loja configurou bairros)
    // Seletor Entrega x Retirada (só aparece se a loja habilitou retirada)
    const tipoEntregaJsx = retiradaAtiva ? (
      <div className="rounded-3xl p-4" style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
        <label className="text-xs text-zinc-600 font-medium flex items-center gap-1.5 mb-2.5">Como você quer receber?</label>
        <div className="flex gap-2.5">
          {[
            { val: 'entrega',  Icon: Truck,        titulo: 'Entrega',  sub: 'No seu endereço' },
            { val: 'retirada', Icon: ShoppingBag,  titulo: 'Retirada', sub: 'Buscar no balcão' },
          ].map(op => (
            <button key={op.val} type="button" onClick={() => setForm(p => ({ ...p, tipo_entrega: op.val }))}
              className="flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl transition-all active:scale-95"
              style={{ background: form.tipo_entrega === op.val ? 'rgba(var(--accent-rgb),0.14)' : '#1a1a1a', border: `1px solid ${form.tipo_entrega === op.val ? 'var(--accent)' : 'rgba(255,255,255,0.08)'}` }}>
              <op.Icon size={20} strokeWidth={1.75} style={{ color: form.tipo_entrega === op.val ? 'var(--accent)' : '#888' }} />
              <span className="text-xs font-black" style={{ color: form.tipo_entrega === op.val ? 'var(--accent)' : '#aaa' }}>{op.titulo}</span>
              <span className="text-[10px]" style={{ color: '#666' }}>{op.sub}</span>
            </button>
          ))}
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
    ) : null;

    // BairroSelector como JSX inline para evitar re-mount a cada keystroke
    const bairroSelectorJsx = (!ehRetirada && temBairros) ? (() => {
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
    })() : null;

    // Aniversário (mimo) + agendamento do pedido
    const extrasPedidoJsx = (
      <div className="space-y-3">
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

    // ── helpers visuais do checkout ──────────────────────────────
    const inputCls = "w-full px-4 py-3 rounded-2xl text-sm text-white outline-none transition-all";
    const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' };
    const onFocusInput = e => e.target.style.borderColor = 'var(--accent)';
    const onBlurInput  = e => e.target.style.borderColor = 'rgba(255,255,255,0.08)';

    const SecaoLabel = ({ icon: Icon, label, sub }) => (
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(var(--accent-rgb),0.1)', border: '1px solid rgba(var(--accent-rgb),0.18)' }}>
          <Icon size={14} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <p className="text-sm font-black text-white leading-none">{label}</p>
          {sub && <p className="text-[11px] text-zinc-600 mt-0.5">{sub}</p>}
        </div>
      </div>
    );

    const mkField = (fieldKey, Icon, label, placeholder, type = 'text', list, inputMode) => (
      <div>
        <label className="text-[11px] text-zinc-500 font-semibold flex items-center gap-1.5 mb-1.5 uppercase tracking-wider">
          <Icon size={11} strokeWidth={2} />{label}
        </label>
        <input type={type} placeholder={placeholder} list={list} inputMode={inputMode}
          value={form[fieldKey]} onChange={e => setForm(p => ({ ...p, [fieldKey]: e.target.value }))}
          className={inputCls} style={{ ...inputStyle }}
          onFocus={onFocusInput} onBlur={onBlurInput} />
      </div>
    );

    const BotaoConfirmar = ({ label }) => (
      <button type="submit" disabled={enviando || foraDeArea || abaixoMinimo}
        className="w-full py-4 rounded-2xl font-black text-white text-base disabled:opacity-40 active:scale-[0.98] transition-all"
        style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)', boxShadow: '0 8px 32px rgba(var(--accent-rgb),0.35)' }}>
        {enviando
          ? <span className="flex items-center justify-center gap-2"><Loader2 size={18} strokeWidth={2} className="animate-spin" /> Enviando...</span>
          : <span className="flex items-center justify-center gap-2"><CheckCircle2 size={18} strokeWidth={2} /> {label || 'Confirmar pedido'} · {brl(Math.max(0, totalValor - calcDesconto() - calcDescontoCashback()) + calcFrete())}</span>}
      </button>
    );

    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#07080f' }}>
        <Toaster />

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 px-4 pt-4 pb-3"
          style={{ background: 'rgba(5,5,12,0.97)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-3 max-w-lg mx-auto">
            <button onClick={() => {
                if (etapaCheckout !== 'telefone') { setEtapaCheckout('telefone'); setClienteEncontrado(null); }
                else setTela('carrinho');
              }}
              className="w-10 h-10 flex items-center justify-center rounded-2xl text-zinc-400 active:scale-90 transition-transform shrink-0"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <ArrowLeft size={19} strokeWidth={1.75} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-white text-base leading-none">Finalizar Pedido</h1>
              <p className="text-[11px] text-zinc-600 mt-0.5">{totalItens} {totalItens === 1 ? 'item' : 'itens'} · {brl(totalValor)}</p>
            </div>
            {/* Step tracker */}
            <div className="flex items-center gap-1.5 shrink-0">
              {steps.map((s, i) => (
                <React.Fragment key={i}>
                  <div className="relative flex items-center justify-center transition-all"
                    style={{
                      width: i === stepAtual ? 28 : 22, height: i === stepAtual ? 28 : 22,
                      borderRadius: 10,
                      background: i < stepAtual ? 'rgba(34,197,94,0.2)' : i === stepAtual ? 'rgba(var(--accent-rgb),0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1.5px solid ${i < stepAtual ? 'rgba(34,197,94,0.5)' : i === stepAtual ? 'rgba(var(--accent-rgb),0.5)' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    {i < stepAtual
                      ? <Check size={11} strokeWidth={2.5} className="text-green-400" />
                      : <s.Icon size={i === stepAtual ? 13 : 11} strokeWidth={2}
                          style={{ color: i === stepAtual ? 'var(--accent)' : '#444' }} />}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-4 h-px rounded-full transition-all"
                      style={{ background: i < stepAtual ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.07)' }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
          {/* Barra de progresso linear */}
          <div className="mt-3 max-w-lg mx-auto rounded-full overflow-hidden" style={{ height: 2, background: 'rgba(255,255,255,0.05)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${((stepAtual + 1) / steps.length) * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />
          </div>
        </div>

        <div className="flex-1 px-4 py-5 max-w-lg w-full mx-auto space-y-3 pb-10">

          {/* ── Resumo do pedido ─────────────────────────────────── */}
          <div className="rounded-3xl overflow-hidden" style={{ background: '#0f0f14', border: '1px solid rgba(255,255,255,0.07)' }}>
            {/* Cabeçalho */}
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex items-center gap-2">
                <ShoppingBag size={13} strokeWidth={1.75} className="text-zinc-600" />
                <p className="text-[11px] font-bold tracking-widest text-zinc-600">SEU PEDIDO</p>
              </div>
              <button onClick={() => setTela('carrinho')}
                className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all active:scale-95"
                style={{ color: 'var(--accent)', background: 'rgba(var(--accent-rgb),0.1)', border: '1px solid rgba(var(--accent-rgb),0.15)' }}>
                Editar
              </button>
            </div>
            {/* Itens */}
            <div className="px-4 py-3 space-y-2">
              {carrinho.map(i => (
                <div key={i.id} className="flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-black text-zinc-600 w-5 text-center">{i.qty}×</span>
                    <span className="text-sm text-zinc-300">{i.nome}</span>
                  </div>
                  <span className="text-sm font-bold text-white">{brl(i.preco * i.qty)}</span>
                </div>
              ))}
            </div>
            {/* Total */}
            <div className="mx-3 mb-3 px-4 py-3 rounded-2xl flex items-center justify-between"
              style={{ background: 'rgba(var(--accent-rgb),0.08)', border: '1px solid rgba(var(--accent-rgb),0.14)' }}>
              <span className="text-sm font-bold text-zinc-400">Total do pedido</span>
              <span className="text-xl font-black" style={{ color: 'var(--accent)' }}>{brl(totalValor)}</span>
            </div>
          </div>

          {/* ── ETAPA 1: TELEFONE ─────────────────────────────────── */}
          {etapaCheckout === 'telefone' && (
            <div className="rounded-3xl overflow-hidden" style={{ background: '#0f0f14', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="px-5 pt-8 pb-5 text-center">
                {/* Ícone */}
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5 relative"
                  style={{ background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.15), rgba(var(--accent-rgb),0.06))', border: '1.5px solid rgba(var(--accent-rgb),0.25)' }}>
                  <Smartphone size={32} strokeWidth={1.5} style={{ color: 'var(--accent)' }} />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ background: '#22c55e', border: '2px solid #07080f' }}>
                    <Check size={11} strokeWidth={3} className="text-white" />
                  </div>
                </div>
                <h2 className="text-xl font-black text-white mb-1.5 leading-tight">Qual é o seu WhatsApp?</h2>
                <p className="text-xs text-zinc-500 leading-relaxed">Buscamos seu cadastro e enviamos<br/>atualizações do pedido por lá</p>
              </div>
              <div className="px-5 pb-7">
                <input
                  ref={telInputRef}
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={form.telefone}
                  onChange={e => onTelefoneChange(e.target.value)}
                  autoFocus
                  className="w-full px-5 py-4 rounded-2xl text-xl font-black text-white outline-none text-center"
                  style={{ background: 'rgba(var(--accent-rgb),0.07)', border: '2px solid rgba(var(--accent-rgb),0.35)', letterSpacing: 3 }}
                />
                {buscandoCliente && (
                  <div className="flex items-center justify-center gap-2 mt-4 text-zinc-500 text-xs">
                    <Loader2 size={13} strokeWidth={2} className="animate-spin" /> Buscando cadastro...
                  </div>
                )}
                {!buscandoCliente && form.telefone.replace(/\D/g,'').length >= 10 && (
                  <button
                    onClick={() => buscarCliente(form.telefone)}
                    className="w-full mt-3 py-4 rounded-2xl font-black text-white text-base active:scale-95 transition-transform"
                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 8px 28px rgba(var(--accent-rgb),0.3)' }}>
                    <span className="flex items-center justify-center gap-2">Continuar <ArrowRight size={17} strokeWidth={2.5} /></span>
                  </button>
                )}
                <div className="flex items-center gap-3 mt-4">
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                  <span className="text-[11px] text-zinc-700">ou</span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
                </div>
                <button onClick={() => setEtapaCheckout('novo_cliente')}
                  className="w-full mt-3 py-3 rounded-2xl text-xs font-bold text-zinc-600 active:scale-95 transition-transform"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  Continuar sem cadastro
                </button>
              </div>
            </div>
          )}

          {/* ── ETAPA 2A: CLIENTE ENCONTRADO ──────────────────────── */}
          {etapaCheckout === 'confirmar' && clienteEncontrado && (
            <form onSubmit={finalizarPedido} className="space-y-3">

              {/* Boas-vindas */}
              <div className="rounded-3xl overflow-hidden"
                style={{ background: 'linear-gradient(145deg, #0b180e, #0f0f14)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <div className="px-4 pt-4 pb-3 flex items-center gap-3">
                  {/* Avatar com inicial */}
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 font-black text-xl text-green-300"
                    style={{ background: 'rgba(34,197,94,0.12)', border: '1.5px solid rgba(34,197,94,0.2)' }}>
                    {clienteEncontrado.nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-white text-[22px] leading-none">Olá, {clienteEncontrado.nome.split(' ')[0]}!</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.2)' }}>
                        <Check size={10} strokeWidth={2.5} className="text-green-400" />
                        <span className="text-[10px] font-bold text-green-400">Cadastro encontrado</span>
                      </div>
                    </div>
                    {clienteEncontrado.endereco && (
                      <p className="text-[11px] text-zinc-600 mt-1 truncate flex items-center gap-1">
                        <MapPin size={10} strokeWidth={1.75} className="shrink-0" /> {clienteEncontrado.endereco}
                      </p>
                    )}
                  </div>
                  <button type="button"
                    onClick={() => { setForm(p => ({ ...p, telefone: '' })); setEtapaCheckout('telefone'); setClienteEncontrado(null); }}
                    className="w-8 h-8 flex items-center justify-center rounded-xl shrink-0 text-zinc-700 active:scale-90 transition-transform"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <X size={15} strokeWidth={2} />
                  </button>
                </div>

                {/* Fidelidade */}
                {fid && (
                  <div className="mx-3 mb-3 rounded-2xl overflow-hidden relative"
                    style={{ background: 'linear-gradient(160deg, #1a1430 0%, #14101f 60%, #0f0d18 100%)', border: '1px solid rgba(167,139,250,0.18)' }}>
                    {/* Brilho sutil no topo */}
                    <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(167,139,250,0.5), transparent)' }} />

                    {/* Header */}
                    <div className="px-4 pt-3.5 pb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star size={13} strokeWidth={2} style={{ color: '#a78bfa' }} fill="rgba(167,139,250,0.25)" />
                        <span className="text-[13px] font-semibold tracking-wide" style={{ color: '#ddd6fe' }}>Cartão Fidelidade</span>
                      </div>
                      {fid.recompensas_disponiveis > 0 ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}>
                          <Gift size={10} strokeWidth={2} style={{ color: '#fbbf24' }} />
                          <span className="text-[10px] font-bold tracking-wide" style={{ color: '#fbbf24' }}>Brinde liberado</span>
                        </div>
                      ) : (
                        <span className="text-[13px] font-light" style={{ color: 'rgba(221,214,254,0.55)' }}>
                          <span className="font-bold" style={{ color: '#c4b5fd' }}>{fid.pedidos_no_ciclo}</span> / 10
                        </span>
                      )}
                    </div>

                    {/* Selos circulares 5+5 */}
                    <div className="px-4 pb-3.5">
                      <div className="grid grid-cols-5 gap-y-2.5 gap-x-2 justify-items-center">
                        {Array.from({ length: 10 }).map((_, i) => {
                          const marcado = i < fid.pedidos_no_ciclo;
                          const ehProximo = i === fid.pedidos_no_ciclo;
                          const ehBrinde = i === 9;
                          return (
                            <div key={i} className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300"
                              style={{
                                background: marcado
                                  ? 'linear-gradient(145deg, #8b5cf6, #6d28d9)'
                                  : ehBrinde
                                    ? 'rgba(251,191,36,0.06)'
                                    : 'rgba(255,255,255,0.025)',
                                border: marcado
                                  ? '1px solid rgba(196,181,253,0.5)'
                                  : ehProximo
                                    ? '1.5px solid rgba(167,139,250,0.5)'
                                    : ehBrinde
                                      ? '1px dashed rgba(251,191,36,0.4)'
                                      : '1px solid rgba(255,255,255,0.07)',
                                boxShadow: marcado
                                  ? '0 2px 10px rgba(124,58,237,0.35), inset 0 1px 1px rgba(255,255,255,0.2)'
                                  : ehProximo ? '0 0 0 3px rgba(167,139,250,0.1)' : 'none',
                              }}>
                              {marcado
                                ? <Fish size={15} strokeWidth={2} className="text-white" />
                                : ehBrinde
                                  ? <Gift size={13} strokeWidth={1.75} style={{ color: 'rgba(251,191,36,0.6)' }} />
                                  : <span className="text-[11px] font-medium" style={{ color: ehProximo ? '#a78bfa' : 'rgba(255,255,255,0.18)' }}>{i + 1}</span>
                              }
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="px-4 pb-4">
                      {fid.recompensas_disponiveis > 0 ? (
                        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                          style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.06))', border: '1px solid rgba(251,191,36,0.25)' }}>
                          <Gift size={14} strokeWidth={1.75} style={{ color: '#fbbf24' }} className="shrink-0" />
                          <p className="text-[11px] font-medium leading-snug" style={{ color: '#fde68a' }}>
                            {clienteEncontrado?.brinde_item_nome
                              ? <>Seu brinde <strong>{clienteEncontrado.brinde_item_nome}</strong> entra automático no seu pedido! 🎁</>
                              : 'Você tem um brinde disponível! Ele será resgatado automaticamente assim que a loja configurar o item.'}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${(fid.pedidos_no_ciclo / 10) * 100}%`, background: 'linear-gradient(90deg, #6d28d9, #a78bfa)' }} />
                          </div>
                          <span className="text-[10px] font-light shrink-0 tracking-wide" style={{ color: 'rgba(196,181,253,0.6)' }}>
                            falta{fid.proximo_em !== 1 ? 'm' : ''} <span className="font-semibold" style={{ color: '#c4b5fd' }}>{fid.proximo_em}</span> p/ brinde
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Tipo de entrega */}
              {tipoEntregaJsx}

              {/* Endereço */}
              {!ehRetirada && (
                <div className="rounded-3xl overflow-hidden" style={{ background: '#0f0f14', border: `1px solid ${!editandoEndereco && clienteEncontrado.endereco ? 'rgba(34,197,94,0.25)' : 'rgba(var(--accent-rgb),0.25)'}` }}>
                  {/* Header */}
                  <div className="px-4 pt-4 pb-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: !editandoEndereco && clienteEncontrado.endereco ? 'rgba(34,197,94,0.12)' : 'rgba(var(--accent-rgb),0.1)', border: `1px solid ${!editandoEndereco && clienteEncontrado.endereco ? 'rgba(34,197,94,0.2)' : 'rgba(var(--accent-rgb),0.18)'}` }}>
                        <MapPin size={14} strokeWidth={1.75} style={{ color: !editandoEndereco && clienteEncontrado.endereco ? '#4ade80' : 'var(--accent)' }} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white leading-none">Endereço de entrega</p>
                        <p className="text-[11px] mt-0.5" style={{ color: !editandoEndereco && clienteEncontrado.endereco ? '#4ade80' : '#666' }}>
                          {!editandoEndereco && clienteEncontrado.endereco ? '✓ Salvo no seu cadastro' : clienteEncontrado.endereco ? 'Informar novo endereço' : 'Primeiro pedido — informe seu endereço'}
                        </p>
                      </div>
                    </div>
                    {clienteEncontrado.endereco && (
                      <button type="button"
                        onClick={() => setEditandoEndereco(v => !v)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all"
                        style={{ color: editandoEndereco ? '#4ade80' : '#f97316', background: editandoEndereco ? 'rgba(74,222,128,0.1)' : 'rgba(249,115,22,0.1)', border: `1px solid ${editandoEndereco ? 'rgba(74,222,128,0.2)' : 'rgba(249,115,22,0.15)'}` }}>
                        {editandoEndereco ? '← Usar salvo' : 'Trocar'}
                      </button>
                    )}
                  </div>

                  <div className="px-4 py-3 space-y-3">
                    {/* Endereço salvo */}
                    {!editandoEndereco && clienteEncontrado.endereco ? (
                      <div className="flex items-start gap-3 px-3 py-3 rounded-2xl"
                        style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(34,197,94,0.12)' }}>
                          <MapPin size={14} strokeWidth={1.75} className="text-green-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-green-300 font-bold leading-snug">{clienteEncontrado.endereco}</p>
                          {(clienteEncontrado.bairro || form.bairro) && (
                            <p className="text-[11px] text-green-400/60 mt-0.5">{clienteEncontrado.bairro || form.bairro}</p>
                          )}
                        </div>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: '#22c55e' }}>
                          <Check size={11} strokeWidth={3} className="text-white" />
                        </div>
                      </div>
                    ) : (
                      /* Formulário de novo endereço */
                      <>
                        {mkField('endereco', MapPin, 'Rua *', 'Nome da rua ou avenida')}
                        <div className="grid grid-cols-2 gap-3">
                          {mkField('numero', Hash, 'Número *', 'Ex: 123', 'text', undefined, 'numeric')}
                          {mkField('complemento', MessageSquare, 'Complemento', 'Apto, casa...')}
                        </div>
                        {bairroSelectorJsx}
                        {clienteEncontrado.endereco && form.endereco.trim() && (
                          <p className="text-[11px] text-zinc-500 flex items-center gap-1.5 pt-1">
                            <Check size={10} strokeWidth={2.5} className="text-green-400" />
                            Este endereço será salvo no seu cadastro
                          </p>
                        )}
                      </>
                    )}

                    {/* Bairro: seletor quando usando endereço salvo sem bairro */}
                    {!editandoEndereco && clienteEncontrado.endereco && !clienteEncontrado.bairro && bairroSelectorJsx}
                  </div>
                </div>
              )}

              {/* Observação + Pagamento + Extras num card */}
              <div className="rounded-3xl p-4 space-y-4" style={{ background: '#0f0f14', border: '1px solid rgba(255,255,255,0.07)' }}>


                {/* Observação */}
                <div>
                  <label className="text-[11px] text-zinc-500 font-semibold flex items-center gap-1.5 mb-1.5 uppercase tracking-wider">
                    <MessageSquare size={11} strokeWidth={2} />Observações
                  </label>
                  <input type="text" placeholder="Sem cebola, porta da frente..."
                    value={form.observacao} onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))}
                    className={inputCls} style={inputStyle} onFocus={onFocusInput} onBlur={onBlurInput} />
                </div>

                {pagamentoSelectorJsx}
                {extrasPedidoJsx}
              </div>

              {/* Cupom */}
              <CupomInput cupomCodigo={cupomCodigo} setCupomCodigo={setCupomCodigo} cupomAplicado={cupomAplicado} setCupomAplicado={setCupomAplicado} cupomBuscando={cupomBuscando} aplicarCupom={aplicarCupom} />

              {/* Cashback */}
              <CashbackToggle clienteEncontrado={clienteEncontrado} usarCashback={usarCashback} setUsarCashback={setUsarCashback} />

              {/* Resumo de valores */}
              <ResumoValores totalValor={totalValor} desconto={calcDesconto()} cupomAplicado={cupomAplicado} descontoCashback={calcDescontoCashback()} frete={calcFrete()} />

              {abaixoMinimo && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl"
                  style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.15)' }}>
                  <AlertTriangle size={13} strokeWidth={2} className="text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-400">Pedido mínimo de {brl(entrega.pedido_minimo)} (sem frete)</p>
                </div>
              )}
              <BotaoConfirmar />
            </form>
          )}

          {/* ── ETAPA 2B: NOVO CLIENTE ────────────────────────────── */}
          {etapaCheckout === 'novo_cliente' && (
            <form onSubmit={finalizarPedido} className="space-y-3">

              {tipoEntregaJsx}

              {/* Dados pessoais */}
              <div className="rounded-3xl p-4 space-y-3" style={{ background: '#0f0f14', border: '1px solid rgba(255,255,255,0.07)' }}>
                <SecaoLabel icon={User} label="Seus dados"
                  sub={form.telefone ? `WhatsApp: ${form.telefone}` : 'Novo cadastro'} />
                {mkField('nome', User, 'Nome completo *', 'Ex: João Silva')}
                {!ehRetirada && <>
                  {mkField('endereco', MapPin, 'Rua *', 'Nome da rua ou avenida')}
                  <div className="grid grid-cols-2 gap-3">
                    {mkField('numero', Hash, 'Número *', 'Ex: 123', 'text', undefined, 'numeric')}
                    {mkField('complemento', MessageSquare, 'Complemento', 'Apto, casa...')}
                  </div>
                </>}

                {/* Bairro inline */}
                {!ehRetirada && temBairros && (
                  <div>
                    <label className="text-[11px] text-zinc-500 font-semibold flex items-center gap-1.5 mb-1.5 uppercase tracking-wider">
                      <MapPin size={11} strokeWidth={2} />Bairro *
                    </label>
                    <input list="bairros-list" value={form.bairro}
                      onChange={e => setForm(p => ({ ...p, bairro: e.target.value }))}
                      placeholder="Digite ou selecione seu bairro"
                      className={inputCls}
                      style={{ ...inputStyle, borderColor: foraDeArea ? '#f87171' : 'rgba(255,255,255,0.08)' }}
                      onFocus={onFocusInput} onBlur={onBlurInput} />
                    <datalist id="bairros-list">
                      {entrega.bairros.map(b => <option key={b.nome} value={b.nome} />)}
                    </datalist>
                    {foraDeArea
                      ? <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1"><AlertTriangle size={11} strokeWidth={2} /> Não entregamos nesse bairro.</p>
                      : form.bairro
                        ? <p className="text-xs mt-1.5" style={{ color: calcFrete() > 0 ? '#a78bfa' : '#4ade80' }}>
                            Frete: {calcFrete() > 0 ? brl(calcFrete()) : 'Grátis'}{!bairroSel && entrega.aceita_fora && ' (taxa padrão)'}
                          </p>
                        : null}
                  </div>
                )}

                {/* Observação */}
                <div>
                  <label className="text-[11px] text-zinc-500 font-semibold flex items-center gap-1.5 mb-1.5 uppercase tracking-wider">
                    <MessageSquare size={11} strokeWidth={2} />Observações
                  </label>
                  <input type="text" placeholder="Sem cebola, porta da frente..."
                    value={form.observacao} onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))}
                    className={inputCls} style={inputStyle} onFocus={onFocusInput} onBlur={onBlurInput} />
                </div>

                {pagamentoSelectorJsx}
                {extrasPedidoJsx}
              </div>

              {/* Cupom */}
              <CupomInput cupomCodigo={cupomCodigo} setCupomCodigo={setCupomCodigo} cupomAplicado={cupomAplicado} setCupomAplicado={setCupomAplicado} cupomBuscando={cupomBuscando} aplicarCupom={aplicarCupom} />

              {/* Cashback */}
              <CashbackToggle clienteEncontrado={clienteEncontrado} usarCashback={usarCashback} setUsarCashback={setUsarCashback} />

              {/* Resumo */}
              <ResumoValores totalValor={totalValor} desconto={calcDesconto()} cupomAplicado={cupomAplicado} descontoCashback={calcDescontoCashback()} frete={calcFrete()} />

              {abaixoMinimo && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl"
                  style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.15)' }}>
                  <AlertTriangle size={13} strokeWidth={2} className="text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-400">Pedido mínimo de {brl(entrega.pedido_minimo)} (sem frete)</p>
                </div>
              )}
              <BotaoConfirmar />
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
                <img src={item.foto} alt={item.nome} loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
                            ? <img src={item.foto} alt={item.nome} loading="lazy" decoding="async" className="w-full h-full object-cover" />
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
                <button onClick={() => {
                    // auto-aplica cupom ativo se o cliente ainda não inseriu um
                    if (cupomAtivo && !cupomAplicado) {
                      setCupomCodigo(cupomAtivo.codigo);
                      setCupomAplicado(cupomAtivo);
                    }
                    setTela('checkout');
                  }}
                  className="w-full py-4 rounded-2xl font-black text-white text-lg active:scale-95 transition-transform"
                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 8px 32px rgba(var(--accent-rgb),0.35)' }}>
                  <span className="flex items-center justify-center gap-2">Ir para entrega <ArrowRight size={18} strokeWidth={2} /></span>
                </button>
              )}
            </div>
          </div>
        );
      })()}
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
        style={{ background: 'rgba(4,4,10,0.97)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex items-center justify-between py-3.5 gap-3">

            {/* Logo + nome + status */}
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <img src="/logo.png" alt="Logo" className="h-11 w-11 object-contain rounded-2xl"
                  style={{ display: 'block' }}
                  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
                <div className="w-11 h-11 rounded-2xl items-center justify-center shrink-0 text-white"
                  style={{ display: 'none', background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
                  <UtensilsCrossed size={22} strokeWidth={1.75} />
                </div>
              </div>
              <div>
                <p className="font-black text-white text-[17px] leading-none tracking-tight">{nomeRestaurante}</p>
                {horarioStatus ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: horarioStatus.aberta ? '#22c55e' : '#ef4444', boxShadow: `0 0 5px ${horarioStatus.aberta ? '#22c55e88' : '#ef444488'}` }} />
                    <span className="text-[11px] font-semibold" style={{ color: horarioStatus.aberta ? '#4ade80' : '#f87171' }}>
                      {horarioStatus.aberta ? 'Aberto agora' : 'Fechado'}
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-700 mt-0.5">Delivery</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {getToken() && (
                <a href="/cardapio-admin"
                  className="w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-90"
                  title="Gerenciar cardápio"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#71717a' }}>
                  <Settings size={16} strokeWidth={1.75} />
                </a>
              )}

              <button onClick={() => setTela('carrinho')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm transition-all active:scale-95"
                style={{
                  background: totalItens > 0
                    ? 'linear-gradient(135deg, var(--accent), var(--accent-2))'
                    : 'rgba(255,255,255,0.06)',
                  color: totalItens > 0 ? '#fff' : '#71717a',
                  border: totalItens > 0 ? 'none' : '1px solid rgba(255,255,255,0.09)',
                  boxShadow: totalItens > 0 ? '0 4px 20px rgba(var(--accent-rgb),0.4)' : 'none',
                }}>
                <ShoppingCart size={16} strokeWidth={1.85} />
                {totalItens > 0 ? (
                  <><span className="font-black">{totalItens}</span><span className="hidden sm:inline font-semibold"> · {brl(totalValor)}</span></>
                ) : (
                  <span className="text-[13px]">Carrinho</span>
                )}
              </button>
            </div>
          </div>

          {/* Category tabs */}
          <div ref={tabsRef} className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-hide">
            {categorias.map(cat => {
              const CatI = iconeCategoria(cat.nome);
              const ativo = catAtiva === cat.id;
              return (
              <button key={cat.id} data-cat={cat.id} onClick={() => scrollToCat(cat.id)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold whitespace-nowrap transition-all shrink-0 active:scale-95"
                style={{
                  background: ativo ? 'linear-gradient(135deg, var(--accent), var(--accent-2))' : 'rgba(255,255,255,0.06)',
                  color: ativo ? '#fff' : '#a1a1aa',
                  border: ativo ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: ativo ? '0 3px 12px rgba(var(--accent-rgb),0.35)' : 'none',
                }}>
                <CatI size={14} strokeWidth={1.75} /> {cat.nome}
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

        {/* Info strip — unified premium card */}
        <div className="max-w-2xl mx-auto px-4 mb-8">
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="grid grid-cols-3 divide-x" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              {/* Entrega */}
              <div className="flex flex-col items-center py-4 gap-1">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span className="text-[13px] font-black text-white">{infoStrip.entrega}</span>
                <span className="text-[10px] font-medium" style={{ color: '#52525b' }}>Entrega</span>
              </div>
              {/* Frete */}
              <div className="flex flex-col items-center py-4 gap-1" style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                <Bike size={17} strokeWidth={1.75} style={{ color: '#a1a1aa' }} />
                <span className="text-[13px] font-black text-white">{infoStrip.frete}</span>
                <span className="text-[10px] font-medium" style={{ color: '#52525b' }}>Frete</span>
              </div>
              {/* Nota */}
              {googleReviewsUrl ? (
                <a href={googleReviewsUrl} target="_blank" rel="noreferrer"
                  className="flex flex-col items-center py-4 gap-1 no-underline active:opacity-70 transition-opacity"
                  style={{ borderLeft: '1px solid rgba(255,255,255,0.05)', textDecoration: 'none' }}>
                  <Star size={17} strokeWidth={1.75} fill="#fbbf24" style={{ color: '#fbbf24' }} />
                  <span className="text-[13px] font-black text-white">{infoStrip.nota}</span>
                  <span className="text-[10px] font-medium" style={{ color: '#4285F4' }}>Google ↗</span>
                </a>
              ) : (
                <div className="flex flex-col items-center py-4 gap-1" style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                  <Star size={17} strokeWidth={1.75} fill="#fbbf24" style={{ color: '#fbbf24' }} />
                  <span className="text-[13px] font-black text-white">{infoStrip.nota}</span>
                  <span className="text-[10px] font-medium" style={{ color: '#52525b' }}>Nota</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Banner de cupom ativo */}
        {cupomAtivo && (
          <div className="max-w-2xl mx-auto px-4 mb-6">
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.10) 0%, rgba(5,150,105,0.04) 100%)', border: '1px solid rgba(16,185,129,0.25)' }}>
              {/* linha de luz no topo */}
              <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.6) 40%, rgba(16,185,129,0.9) 50%, rgba(16,185,129,0.6) 60%, transparent)' }} />
              <div className="flex items-center gap-3 px-4 py-3">
                <Tag size={15} strokeWidth={1.75} style={{ color: '#10b981', flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white leading-snug">
                    <span className="text-green-400 font-black">{cupomAtivo.codigo}</span>
                    {' · '}
                    {cupomAtivo.tipo === 'percentual'
                      ? <span className="font-semibold">{cupomAtivo.valor}% de desconto</span>
                      : <span className="font-semibold">R$ {Number(cupomAtivo.valor).toFixed(2).replace('.',',')} de desconto</span>
                    }
                    {cupomAtivo.minimo > 0 && <span className="text-zinc-500"> · mín. {brl(cupomAtivo.minimo)}</span>}
                  </p>
                  <p className="text-[10px] text-green-600 font-medium mt-0.5">Aplicado automaticamente no checkout</p>
                </div>
                <span className="text-[9px] font-black tracking-widest text-green-500 shrink-0">AUTO</span>
              </div>
            </div>
          </div>
        )}

        {/* Seções do cardápio */}
        <div className="max-w-2xl mx-auto px-4 space-y-12">
          {categorias.map(cat => {
            const temFoto = cat.itens.some(item => !!item.foto);
            const CatI = iconeCategoria(cat.nome);

            return (
              <section key={cat.id} ref={el => catRefs.current[cat.id] = el}>

                {/* Section header — clean premium */}
                <div className="mb-6">
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)' }}>
                        <CatI size={17} strokeWidth={1.75} />
                      </div>
                      <h2 className="font-black text-white text-[22px] leading-none tracking-tight">{cat.nome}</h2>
                    </div>
                    <span className="text-[11px] font-bold mb-0.5 shrink-0"
                      style={{ color: '#52525b' }}>
                      {cat.itens.length} {cat.itens.length === 1 ? 'opção' : 'opções'}
                    </span>
                  </div>
                  <div className="mt-3" style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
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
                          className="rounded-2xl overflow-hidden transition-all duration-200 flex flex-col cursor-pointer active:scale-[0.97]"
                          style={{
                            background: qty > 0 ? '#161616' : '#111',
                            border: `1px solid ${qty > 0 ? 'rgba(var(--accent-rgb),0.4)' : 'rgba(255,255,255,0.07)'}`,
                            boxShadow: qty > 0 ? '0 4px 24px rgba(var(--accent-rgb),0.15)' : '0 2px 8px rgba(0,0,0,0.4)',
                          }}>

                          {/* Photo area — 165px */}
                          <div className="relative overflow-hidden shrink-0"
                            style={{ height: 165, borderRadius: '16px 16px 0 0', background: '#181818' }}>
                            {item.foto ? (
                              <img src={item.foto} alt={item.nome}
                                loading="lazy" decoding="async"
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
                            {/* Badge promocional */}
                            {item.promo_ativa === 1 && item.promo_tag && (
                              <div className="absolute top-2 left-2">
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md text-white"
                                  style={{ background: '#ef4444', boxShadow: '0 2px 8px rgba(239,68,68,0.5)' }}>
                                  {item.promo_tag}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Info below photo */}
                          <div className="p-3.5 flex flex-col flex-1 justify-between">
                            <div>
                              <p className="font-black text-white text-[15px] leading-tight">{item.nome}</p>
                              {item.descricao && (
                                <p className="text-[12px] mt-1 leading-snug line-clamp-2" style={{ color: '#71717a' }}>{item.descricao}</p>
                              )}
                              {itemCart?.obs && (
                                <p className="text-[10px] mt-1 truncate" style={{ color: 'var(--accent)' }}><Pencil size={10} strokeWidth={1.75} className="inline mr-0.5 align-middle" />{itemCart.obs}</p>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-3">
                              {item.promo_ativa === 1 && item.preco_promo ? (
                                <div>
                                  <span className="text-[10px] line-through block" style={{ color: '#52525b' }}>{brl(item.preco)}</span>
                                  <span className="font-black text-[15px]" style={{ color: '#10b981' }}>{brl(item.preco_promo)}</span>
                                </div>
                              ) : (
                                <p className="font-black text-[15px]" style={{ color: 'var(--accent)' }}>{brl(item.preco)}</p>
                              )}
                              {qty === 0 ? (
                                <button
                                  onClick={e => { e.stopPropagation(); setItemModal(item); }}
                                  className="w-9 h-9 rounded-full flex items-center justify-center font-black text-white text-xl active:scale-90 transition-transform shrink-0"
                                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 4px 14px rgba(var(--accent-rgb),0.4)' }}>
                                  +
                                </button>
                              ) : (
                                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => removeItem(item.id)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white active:scale-90 transition-transform"
                                    style={{ background: '#222', border: '1px solid rgba(255,255,255,0.1)' }}>−</button>
                                  <span className="w-5 text-center font-black text-white text-sm">{qty}</span>
                                  <button onClick={() => addItem(item)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white active:scale-90 transition-transform"
                                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 3px 10px rgba(var(--accent-rgb),0.35)' }}>+</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Lista premium — sem foto */
                  <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                    {cat.itens.map((item, idx) => {
                      const qty = getQty(item.id);
                      const isAnim = animItem === item.id;
                      const itemCart = carrinho.find(c => c.id === item.id);
                      const isLast = idx === cat.itens.length - 1;

                      return (
                        <div key={item.id}
                          onClick={() => setItemModal(item)}
                          className="flex items-center cursor-pointer active:opacity-80 transition-all"
                          style={{
                            background: qty > 0 ? 'rgba(var(--accent-rgb),0.06)' : idx % 2 === 0 ? '#111' : '#0e0e0e',
                            borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
                            minHeight: 80,
                          }}>

                          {/* Ícone */}
                          <div className="shrink-0 flex items-center justify-center"
                            style={{ width: 72, minHeight: 80, background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                            <span className="transition-transform duration-300"
                              style={{ color: qty > 0 ? 'var(--accent)' : 'rgba(161,161,170,0.5)', transform: isAnim ? 'scale(1.3) rotate(-8deg)' : 'scale(1)' }}>
                              {item.foto
                                ? <img src={item.foto} alt={item.nome} loading="lazy" decoding="async" className="w-12 h-12 object-cover rounded-xl" />
                                : <CatI size={28} strokeWidth={1.5} />
                              }
                            </span>
                          </div>

                          {/* Info */}
                          <div className="flex-1 px-4 py-3 flex flex-col justify-center min-w-0">
                            <div className="flex items-start gap-2">
                              <p className="font-black text-white text-[15px] leading-tight flex-1">{item.nome}</p>
                              {item.promo_ativa && item.promo_tag && (
                                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md text-white shrink-0 mt-0.5"
                                  style={{ background: '#ef4444' }}>
                                  {item.promo_tag}
                                </span>
                              )}
                            </div>
                            {item.descricao && (
                              <p className="text-[12px] mt-1 leading-snug line-clamp-1" style={{ color: '#71717a' }}>{item.descricao}</p>
                            )}
                            {itemCart?.obs && (
                              <p className="text-[10px] mt-0.5 truncate" style={{ color: 'var(--accent)' }}><Pencil size={10} strokeWidth={1.75} className="inline mr-0.5 align-middle" />{itemCart.obs}</p>
                            )}
                            <div className="flex items-center justify-between mt-2">
                              {item.promo_ativa === 1 && item.preco_promo ? (
                                <div>
                                  <span className="text-[10px] line-through" style={{ color: '#52525b' }}>{brl(item.preco)} </span>
                                  <span className="font-black text-[15px]" style={{ color: '#10b981' }}>{brl(item.preco_promo)}</span>
                                </div>
                              ) : (
                                <p className="font-black text-[15px]" style={{ color: 'var(--accent)' }}>{brl(item.preco)}</p>
                              )}
                              {qty === 0 ? (
                                <button
                                  onClick={e => { e.stopPropagation(); setItemModal(item); }}
                                  className="w-9 h-9 rounded-full flex items-center justify-center font-black text-white text-xl active:scale-90 transition-transform shrink-0"
                                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 4px 14px rgba(var(--accent-rgb),0.4)' }}>
                                  +
                                </button>
                              ) : (
                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => removeItem(item.id)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white active:scale-90 transition-transform"
                                    style={{ background: '#222', border: '1px solid rgba(255,255,255,0.1)' }}>−</button>
                                  <span className="w-5 text-center font-black text-white text-sm">{qty}</span>
                                  <button onClick={() => addItem(item)}
                                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white active:scale-90 transition-transform"
                                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 3px 10px rgba(var(--accent-rgb),0.35)' }}>+</button>
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

      {/* FAB carrinho */}
      {totalItens > 0 && (
        <div className="fixed bottom-5 z-30"
          style={{ left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 24px)', maxWidth: 520 }}>
          <button onClick={() => setTela('carrinho')}
            className="w-full py-4 px-5 rounded-2xl flex items-center justify-between active:scale-[0.98] transition-transform"
            style={{
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)',
              boxShadow: '0 8px 40px rgba(var(--accent-rgb),0.55), 0 2px 12px rgba(0,0,0,0.6)',
            }}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.2)' }}>
                <ShoppingBag size={17} strokeWidth={1.75} color="#fff" />
              </div>
              <span className="text-white font-bold text-[14px]">
                {totalItens === 1 ? '1 item' : `${totalItens} itens`}
              </span>
              <span className="text-white/60 text-[13px]">· Ver carrinho</span>
            </div>
            <span className="text-white font-black text-[16px]">{brl(totalValor)}</span>
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
