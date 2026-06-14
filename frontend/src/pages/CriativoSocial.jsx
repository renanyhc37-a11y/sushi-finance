import React, { useState, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { getToken } from '../hooks/useAuth';
import { renderTemplateToCanvas } from '../utils/canvasExport';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const authJ = () => ({ ...authH(), 'Content-Type': 'application/json' });

// ── Paletas ────────────────────────────────────────────────────
const PALETAS = {
  brand:    { nome: '🟠 Marca',    bg: '#080808', g1: '#6b1500', g2: '#2a0800', accent: 'var(--accent)', sub: 'var(--accent-2)', text: '#fff' },
  vermelho: { nome: '🔴 Paixão',   bg: '#0d0000', g1: '#7f1d1d', g2: '#1a0000', accent: '#ef4444', sub: '#fca5a5', text: '#fff' },
  dourado:  { nome: '🥇 Luxo',     bg: '#080600', g1: '#6b4a00', g2: '#0d0a00', accent: '#d4a017', sub: '#f0c040', text: '#fff' },
  oceano:   { nome: '🔵 Oceano',   bg: '#000d14', g1: '#0c4a6e', g2: '#001a2e', accent: '#0ea5e9', sub: '#7dd3fc', text: '#fff' },
  floresta: { nome: '🌿 Natureza', bg: '#000d05', g1: '#14532d', g2: '#001a0a', accent: '#16a34a', sub: '#86efac', text: '#fff' },
  roxo:     { nome: '🟣 Roxo',     bg: '#06000d', g1: '#4c1d95', g2: '#0d001a', accent: '#9333ea', sub: '#d8b4fe', text: '#fff' },
  sakura:   { nome: '🌸 Sakura',   bg: '#0d0008', g1: '#831843', g2: '#1a0010', accent: '#ec4899', sub: '#fbcfe8', text: '#fff' },
  titanio:  { nome: '⚫ Titânio',  bg: '#050505', g1: '#1a1a1a', g2: '#050505', accent: '#e5e5e5', sub: '#aaa', text: '#fff' },
};

// ── Templates ──────────────────────────────────────────────────
const TEMPLATES = [
  { id: 'luxo',      nome: '👑 Luxo',      desc: 'Elegante, ouro, premium' },
  { id: 'neon',      nome: '⚡ Neon',      desc: 'Electric, glow, impacto' },
  { id: 'bold',      nome: '💥 Bold',      desc: 'Tipografia gigante' },
  { id: 'magazine',  nome: '📰 Magazine',  desc: 'Editorial, editorial' },
  { id: 'cinema',    nome: '🎬 Cinema',    desc: 'Pôster cinematográfico' },
  { id: 'urgente',   nome: '🚨 Urgente',   desc: 'Oferta, conversão máxima' },
  { id: 'zen',       nome: '🪷 Zen',       desc: 'Minimalismo japonês' },
  { id: 'split',     nome: '✂️ Split',     desc: 'Divisão diagonal' },
  { id: 'retro',     nome: '📼 Retro',     desc: 'Vintage, nostalgia, grão' },
  { id: 'gradient',  nome: '🌈 Gradient',  desc: 'Cores vibrantes em gradiente' },
  { id: 'frame',     nome: '🖼 Frame',     desc: 'Moldura decorativa elaborada' },
  { id: 'dark',      nome: '🖤 Dark',      desc: 'Ultra dark, toque de luz' },
  { id: 'sticker',   nome: '🎯 Sticker',   desc: 'Estilo adesivo, divertido' },
  { id: 'duo',       nome: '◼ Duo',       desc: 'Dois painéis, contraste' },
  { id: 'wave',      nome: '〰 Wave',      desc: 'Ondas fluidas, orgânico' },
  { id: 'poster',    nome: '🗓 Poster',    desc: 'Pôster clássico, geométrico' },
];

const ATALHOS = [
  { label: '🔥 Promo do dia',    tema: 'promoção especial do dia, preço imperdível, válido só hoje' },
  { label: '🆕 Lançamento',      tema: 'lançamento de novo item, exclusivo, novidade no cardápio' },
  { label: '🎉 Fim de semana',   tema: 'especial de fim de semana, combo família, reunião com amigos' },
  { label: '❤️ Dia dos Namorados', tema: 'jantar romântico, casal, dia dos namorados, experiência especial' },
  { label: '🌙 Jantar',         tema: 'delivery perfeito para o jantar, noite, sábado' },
  { label: '💪 Fidelidade',     tema: 'programa de fidelidade, cliente vip, volte sempre, benefícios' },
];

// ═══════════════════════════════════════════════════════════════
// TEMPLATES
// ═══════════════════════════════════════════════════════════════

function Bg({ p, img, children, overlay = 0.55 }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: p.bg }}>
      {!img && <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 20% 20%, ${p.g1}f0 0%, ${p.bg} 60%)` }} />}
      {img && <img src={img} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
      {img && <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlay})` }} />}
      <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%' }}>{children}</div>
    </div>
  );
}

// ── 1. LUXO ─────────────────────────────────────────────────────
function TLuxo({ d, p, restaurante, img, S }) {
  const pad = S ? 52 : 38;
  const accent = p.accent;
  return (
    <Bg p={p} img={img} overlay={0.72}>
      {/* Frame dourado interno */}
      <div style={{ position: 'absolute', inset: S ? 20 : 16, border: `1px solid ${accent}44`, borderRadius: 4, pointerEvents: 'none', zIndex: 3 }} />
      <div style={{ position: 'absolute', inset: S ? 24 : 20, border: `1px solid ${accent}18`, borderRadius: 2, pointerEvents: 'none', zIndex: 3 }} />

      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        {/* Top */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: S ? 11 : 9, letterSpacing: 6, color: accent, textTransform: 'uppercase', fontWeight: 700 }}>{restaurante}</div>
          <div style={{ width: 30, height: 1, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, margin: '8px auto' }} />
          {d.tag && <div style={{ fontSize: S ? 11 : 9, color: `${accent}99`, letterSpacing: 2 }}>{d.tag}</div>}
        </div>

        {/* Centro */}
        <div style={{ textAlign: 'center', padding: S ? '0 20px' : '0 10px' }}>
          {!img && <div style={{ fontSize: S ? 100 : 72, marginBottom: S ? 24 : 16, filter: `drop-shadow(0 0 30px ${accent}66)` }}>{d.emoji_principal || '🍣'}</div>}
          <div style={{
            fontSize: S ? 58 : 42, fontWeight: 900, color: p.text, lineHeight: 1,
            letterSpacing: -2, textTransform: 'uppercase',
            textShadow: img ? '0 2px 20px rgba(0,0,0,0.9)' : `0 0 60px ${accent}22`,
          }}>{d.headline || 'SUSHI\nPREMIUM'}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: S ? '20px 0' : '14px 0' }}>
            <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${accent}66)` }} />
            <span style={{ fontSize: S ? 14 : 11, color: accent }}>{d.emojis_extras?.[0] || '✦'}</span>
            <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${accent}66, transparent)` }} />
          </div>
          <div style={{ fontSize: S ? 18 : 14, color: `${p.sub}cc`, letterSpacing: 1, lineHeight: 1.4 }}>{d.subheadline || 'Tradição japonesa com ingredientes selecionados'}</div>
          {d.destaque && (
            <div style={{ marginTop: S ? 24 : 16 }}>
              <span style={{ fontSize: S ? 34 : 24, fontWeight: 900, color: accent, letterSpacing: -0.5 }}>{d.destaque}</span>
            </div>
          )}
        </div>

        {/* Bottom */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: S ? 10 : 8, color: `${accent}55`, letterSpacing: 3, textTransform: 'uppercase' }}>DELIVERY PREMIUM</div>
          <div style={{ background: accent, borderRadius: 100, padding: S ? '8px 22px' : '6px 16px', fontSize: S ? 12 : 10, fontWeight: 900, color: '#000' }}>{d.cta || 'Pedir agora'}</div>
        </div>
      </div>
    </Bg>
  );
}

// ── 2. NEON ─────────────────────────────────────────────────────
function TNeon({ d, p, restaurante, img, S }) {
  const pad = S ? 44 : 32;
  const glow = p.accent;
  const grid = `radial-gradient(circle, ${glow}18 1px, transparent 1px)`;
  return (
    <Bg p={p} img={img} overlay={0.82}>
      {/* Grid pattern */}
      {!img && <div style={{ position: 'absolute', inset: 0, backgroundImage: grid, backgroundSize: '28px 28px', zIndex: 1 }} />}
      {/* Glow orb */}
      {!img && <div style={{ position: 'absolute', left: '50%', top: '40%', transform: 'translate(-50%,-50%)', width: S ? 400 : 300, height: S ? 400 : 300, borderRadius: '50%', background: `radial-gradient(circle, ${glow}22 0%, transparent 70%)`, zIndex: 1 }} />}

      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad, fontFamily: "'Segoe UI', system-ui, sans-serif", zIndex: 3, position: 'relative' }}>
        {/* Tag */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: S ? 11 : 9, fontWeight: 900, letterSpacing: 3, color: glow, textTransform: 'uppercase', textShadow: `0 0 20px ${glow}` }}>{d.tag || '⚡ ESPECIAL'}</div>
          <div style={{ fontSize: S ? 11 : 9, color: `${glow}88` }}>{restaurante}</div>
        </div>

        {/* Centro */}
        <div style={{ textAlign: 'center' }}>
          {!img && <div style={{ fontSize: S ? 110 : 80, textShadow: `0 0 40px ${glow}, 0 0 80px ${glow}66`, marginBottom: S ? 20 : 12, lineHeight: 1 }}>{d.emoji_principal || '🍣'}</div>}
          <div style={{
            fontSize: S ? 64 : 46, fontWeight: 900, color: p.text,
            textTransform: 'uppercase', lineHeight: 1, letterSpacing: -1,
            textShadow: `0 0 30px ${glow}88, 0 0 60px ${glow}44`,
          }}>{d.headline || 'SUSHI'}</div>
          {/* Linha neon */}
          <div style={{ width: S ? '60%' : '50%', height: 2, margin: S ? '18px auto' : '12px auto', background: glow, boxShadow: `0 0 12px ${glow}, 0 0 24px ${glow}66` }} />
          <div style={{ fontSize: S ? 19 : 15, color: `${glow}cc`, lineHeight: 1.4 }}>{d.subheadline || 'Sabor que ilumina'}</div>
        </div>

        {/* Bottom */}
        <div style={{ textAlign: 'center' }}>
          {d.destaque && (
            <div style={{ display: 'inline-block', border: `2px solid ${glow}`, borderRadius: 12, padding: S ? '12px 32px' : '8px 22px', marginBottom: S ? 20 : 14, boxShadow: `0 0 20px ${glow}44, inset 0 0 20px ${glow}08` }}>
              <span style={{ fontSize: S ? 36 : 26, fontWeight: 900, color: glow, textShadow: `0 0 20px ${glow}` }}>{d.destaque}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: `linear-gradient(135deg, ${glow}, ${p.sub})`, borderRadius: 100, padding: S ? '10px 28px' : '7px 18px', fontSize: S ? 14 : 11, fontWeight: 900, color: '#000', boxShadow: `0 0 24px ${glow}88` }}>{d.cta || 'Pedir agora ⚡'}</div>
          </div>
        </div>
      </div>
    </Bg>
  );
}

// ── 3. BOLD ─────────────────────────────────────────────────────
function TBold({ d, p, restaurante, img, S }) {
  const words = (d.headline || 'SUSHI PREMIUM').split(' ');
  const w1 = words[0] || 'SUSHI';
  const w2 = words.slice(1).join(' ') || 'PREMIUM';
  return (
    <Bg p={p} img={img} overlay={0.75}>
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: S ? '0 36px' : '0 28px', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

        {/* Marca top */}
        <div style={{ position: 'absolute', top: S ? 40 : 28, left: S ? 36 : 28, right: S ? 36 : 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: S ? 10 : 8, letterSpacing: 4, color: `${p.accent}99`, textTransform: 'uppercase' }}>{restaurante}</span>
          {d.tag && <span style={{ fontSize: S ? 11 : 9, color: p.accent, fontWeight: 700 }}>{d.tag}</span>}
        </div>

        {/* Tipografia gigante */}
        <div>
          <div style={{
            fontSize: S ? 110 : 80, fontWeight: 900, lineHeight: 0.88,
            letterSpacing: -4, color: p.text, textTransform: 'uppercase',
            textShadow: img ? '0 4px 30px rgba(0,0,0,0.9)' : 'none',
          }}>{w1}</div>
          {/* Linha com fundo colorido */}
          <div style={{ display: 'inline-block', background: `linear-gradient(135deg, ${p.accent}, ${p.sub})`, padding: S ? '4px 12px 8px' : '2px 8px 6px', marginTop: 4 }}>
            <div style={{ fontSize: S ? 110 : 80, fontWeight: 900, lineHeight: 0.88, letterSpacing: -4, color: '#000', textTransform: 'uppercase' }}>{w2 || 'DELIVERY'}</div>
          </div>
        </div>

        {/* Sub + destaque */}
        <div style={{ marginTop: S ? 28 : 18 }}>
          <div style={{ fontSize: S ? 18 : 14, color: `rgba(255,255,255,0.6)`, lineHeight: 1.4, marginBottom: S ? 16 : 12 }}>{d.subheadline || 'Feito para quem aprecia o melhor'}</div>
          {d.destaque && <div style={{ fontSize: S ? 32 : 22, fontWeight: 900, color: p.accent }}>{d.destaque}</div>}
        </div>

        {/* CTA bottom */}
        <div style={{ position: 'absolute', bottom: S ? 44 : 32, left: S ? 36 : 28, right: S ? 36 : 28, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ background: p.accent, borderRadius: 100, padding: S ? '10px 26px' : '7px 18px', fontSize: S ? 13 : 10, fontWeight: 900, color: '#000' }}>{d.cta || 'Peça agora'}</div>
        </div>
      </div>
    </Bg>
  );
}

// ── 4. MAGAZINE ─────────────────────────────────────────────────
function TMagazine({ d, p, restaurante, img, S }) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  return (
    <Bg p={p} img={img} overlay={0.78}>
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

        {/* Header editorial */}
        <div style={{ background: p.accent, padding: S ? '14px 32px' : '10px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: S ? 18 : 13, fontWeight: 900, color: '#000', textTransform: 'uppercase', letterSpacing: 1 }}>{restaurante}</div>
          <div style={{ fontSize: S ? 10 : 8, color: '#000', opacity: 0.7, textAlign: 'right' }}>
            <div style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>EDIÇÃO ESPECIAL</div>
            <div>{hoje}</div>
          </div>
        </div>

        {/* Feature area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: S ? '36px 32px' : '24px 22px' }}>
          {d.tag && (
            <div style={{ display: 'inline-flex', marginBottom: S ? 16 : 12 }}>
              <span style={{ fontSize: S ? 11 : 9, fontWeight: 900, letterSpacing: 2, color: p.accent, textTransform: 'uppercase', borderBottom: `2px solid ${p.accent}`, paddingBottom: 2 }}>{d.tag}</span>
            </div>
          )}
          {!img && <div style={{ fontSize: S ? 80 : 60, marginBottom: S ? 16 : 12 }}>{d.emoji_principal || '🍣'}</div>}
          <div style={{ fontSize: S ? 54 : 38, fontWeight: 900, lineHeight: 1.0, letterSpacing: -1.5, color: p.text, textTransform: 'uppercase', textShadow: img ? '0 2px 20px rgba(0,0,0,0.9)' : 'none' }}>
            {d.headline || 'SUSHI\nPREMIUM'}
          </div>
          <div style={{ width: 40, height: 3, background: p.accent, margin: S ? '18px 0' : '12px 0' }} />
          <div style={{ fontSize: S ? 17 : 13, color: `rgba(255,255,255,0.7)`, lineHeight: 1.5, maxWidth: '80%' }}>{d.subheadline || 'Uma experiência gastronômica única'}</div>
          {d.destaque && (
            <div style={{ marginTop: S ? 20 : 14 }}>
              <span style={{ fontSize: S ? 38 : 26, fontWeight: 900, color: p.accent }}>{d.destaque}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ background: 'rgba(0,0,0,0.5)', padding: S ? '14px 32px' : '10px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${p.accent}33` }}>
          <div style={{ display: 'flex', gap: S ? 16 : 10 }}>
            {(d.emojis_extras || ['📍', '🕐', '🛵']).slice(0, 3).map((e, i) => (
              <span key={i} style={{ fontSize: S ? 20 : 14 }}>{e}</span>
            ))}
          </div>
          <div style={{ background: p.accent, borderRadius: 100, padding: S ? '8px 20px' : '5px 14px', fontSize: S ? 12 : 9, fontWeight: 900, color: '#000' }}>{d.cta || 'Pedir agora'}</div>
        </div>
      </div>
    </Bg>
  );
}

// ── 5. CINEMA ─────────────────────────────────────────────────
function TCinema({ d, p, restaurante, img, S }) {
  return (
    <Bg p={p} img={img} overlay={0.7}>
      {/* Vinheta escura nas bordas */}
      {!img && <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)', zIndex: 1 }} />}

      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: S ? '44px 36px' : '32px 28px', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

        {/* Top — título do "estúdio" */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: S ? 10 : 8, letterSpacing: 8, color: `rgba(255,255,255,0.4)`, textTransform: 'uppercase' }}>{restaurante} APRESENTA</div>
        </div>

        {/* Centro dramático */}
        <div style={{ textAlign: 'center' }}>
          {!img && <div style={{ fontSize: S ? 90 : 66, marginBottom: S ? 18 : 14, filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.8))' }}>{d.emoji_principal || '🍣'}</div>}
          {d.tag && <div style={{ fontSize: S ? 12 : 10, letterSpacing: 4, color: p.accent, fontWeight: 900, textTransform: 'uppercase', marginBottom: S ? 14 : 10 }}>{d.tag}</div>}
          <div style={{ fontSize: S ? 62 : 44, fontWeight: 900, lineHeight: 1.0, letterSpacing: -1.5, color: '#fff', textTransform: 'uppercase', textShadow: '0 4px 40px rgba(0,0,0,0.9)' }}>
            {d.headline || 'SUSHI PREMIUM'}
          </div>
          <div style={{ fontSize: S ? 17 : 13, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic', marginTop: S ? 14 : 10, letterSpacing: 0.5 }}>
            "{d.subheadline || 'Uma experiência além do sabor'}"
          </div>
          {d.destaque && (
            <div style={{ marginTop: S ? 24 : 16, display: 'inline-block', border: `1px solid rgba(255,255,255,0.3)`, borderRadius: 4, padding: S ? '8px 24px' : '6px 18px' }}>
              <span style={{ fontSize: S ? 28 : 20, fontWeight: 900, color: p.accent }}>{d.destaque}</span>
            </div>
          )}
        </div>

        {/* Rodapé tipo créditos */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: S ? 16 : 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: S ? 10 : 8, letterSpacing: 4, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>DELIVERY</div>
              <div style={{ fontSize: S ? 13 : 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>{restaurante}</div>
            </div>
            <div style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.sub})`, borderRadius: 100, padding: S ? '9px 22px' : '6px 16px', fontSize: S ? 12 : 10, fontWeight: 900, color: '#000' }}>{d.cta || 'Pedir agora'}</div>
          </div>
        </div>
      </div>
    </Bg>
  );
}

// ── 6. URGENTE ─────────────────────────────────────────────────
function TUrgente({ d, p, restaurante, img, S }) {
  return (
    <Bg p={p} img={img} overlay={0.8}>
      {/* Faixa diagonal decorativa */}
      {!img && <div style={{ position: 'absolute', top: -80, right: -80, width: S ? 340 : 260, height: S ? 340 : 260, background: `${p.accent}18`, borderRadius: '50%', zIndex: 1 }} />}

      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

        {/* Faixa topo */}
        <div style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.sub})`, padding: S ? '16px 32px' : '12px 22px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: S ? 22 : 16 }}>🚨</span>
          <div style={{ fontSize: S ? 14 : 11, fontWeight: 900, color: '#000', textTransform: 'uppercase', letterSpacing: 2 }}>{d.tag || 'OFERTA RELÂMPAGO'}</div>
        </div>

        {/* Corpo central */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: S ? '28px 32px' : '20px 22px', textAlign: 'center' }}>
          {/* Badge de destaque */}
          {d.destaque && (
            <div style={{
              width: S ? 160 : 120, height: S ? 160 : 120, borderRadius: '50%',
              background: `linear-gradient(135deg, ${p.accent}, ${p.sub})`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 40px ${p.accent}66`, marginBottom: S ? 24 : 16,
            }}>
              <div style={{ fontSize: S ? 38 : 28, fontWeight: 900, color: '#000', lineHeight: 1, letterSpacing: -1 }}>{d.destaque}</div>
              <div style={{ fontSize: S ? 11 : 9, fontWeight: 700, color: '#00000088', textTransform: 'uppercase', letterSpacing: 1 }}>HOJE</div>
            </div>
          )}

          {!img && !d.destaque && <div style={{ fontSize: S ? 90 : 66, marginBottom: S ? 20 : 14 }}>{d.emoji_principal || '🍣'}</div>}

          <div style={{ fontSize: S ? 48 : 34, fontWeight: 900, color: '#fff', textTransform: 'uppercase', lineHeight: 1.05, letterSpacing: -1, textShadow: img ? '0 2px 20px rgba(0,0,0,0.9)' : 'none' }}>
            {d.headline || 'OFERTA\nINSANE'}
          </div>
          <div style={{ width: 40, height: 3, background: p.accent, borderRadius: 2, margin: S ? '14px auto' : '10px auto' }} />
          <div style={{ fontSize: S ? 16 : 13, color: `rgba(255,255,255,0.7)`, maxWidth: 280 }}>{d.subheadline || 'Aproveite antes que acabe!'}</div>
        </div>

        {/* Footer */}
        <div style={{ background: 'rgba(0,0,0,0.4)', padding: S ? '16px 32px' : '12px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: S ? 13 : 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 2 }}>{restaurante}</span>
          <div style={{ background: `${p.accent}`, borderRadius: 100, padding: S ? '10px 26px' : '7px 18px', fontSize: S ? 13 : 10, fontWeight: 900, color: '#000' }}>{d.cta || 'QUERO! 🔥'}</div>
        </div>
      </div>
    </Bg>
  );
}

// ── 7. ZEN ─────────────────────────────────────────────────────
function TZen({ d, p, restaurante, img, S }) {
  const lines = !img ? `repeating-linear-gradient(0deg, transparent, transparent 39px, ${p.accent}0a 39px, ${p.accent}0a 40px)` : 'none';
  return (
    <Bg p={p} img={img} overlay={0.78}>
      {!img && <div style={{ position: 'absolute', inset: 0, backgroundImage: lines, zIndex: 1 }} />}
      {/* Faixas decorativas laterais */}
      {!img && <>
        <div style={{ position: 'absolute', left: S ? 28 : 20, top: 0, bottom: 0, width: 1, background: `linear-gradient(180deg, transparent, ${p.accent}44, transparent)`, zIndex: 1 }} />
        <div style={{ position: 'absolute', right: S ? 28 : 20, top: 0, bottom: 0, width: 1, background: `linear-gradient(180deg, transparent, ${p.accent}44, transparent)`, zIndex: 1 }} />
      </>}

      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: S ? '56px 52px' : '40px 38px', textAlign: 'center', fontFamily: "'Segoe UI', system-ui, sans-serif' " }}>

        {/* Topo */}
        <div style={{ position: 'absolute', top: S ? 36 : 26, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ fontSize: S ? 9 : 7, letterSpacing: 6, color: `${p.accent}88`, textTransform: 'uppercase' }}>— {restaurante} —</div>
        </div>

        {!img && <div style={{ fontSize: S ? 80 : 60, marginBottom: S ? 24 : 18, opacity: 0.92, filter: `drop-shadow(0 4px 12px ${p.accent}44)` }}>{d.emoji_principal || '🍣'}</div>}

        <div style={{ fontSize: S ? 9 : 7, letterSpacing: 6, color: p.accent, textTransform: 'uppercase', marginBottom: S ? 12 : 8 }}>{d.tag || 'ESPECIAL'}</div>
        <div style={{ fontSize: S ? 48 : 34, fontWeight: 900, color: p.text, lineHeight: 1.1, letterSpacing: -1, textTransform: 'uppercase', textShadow: img ? '0 2px 20px rgba(0,0,0,0.9)' : 'none' }}>
          {d.headline || 'SUSHI\nZEN'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: S ? '18px 0' : '14px 0' }}>
          <div style={{ width: 20, height: 1, background: p.accent }} />
          <span style={{ fontSize: S ? 12 : 9, color: p.accent }}>✦</span>
          <div style={{ width: 20, height: 1, background: p.accent }} />
        </div>
        <div style={{ fontSize: S ? 16 : 12, color: `rgba(255,255,255,0.6)`, lineHeight: 1.6, maxWidth: 260 }}>{d.subheadline || 'Equilíbrio perfeito de sabores'}</div>
        {d.destaque && <div style={{ marginTop: S ? 22 : 16, fontSize: S ? 30 : 22, fontWeight: 900, color: p.accent }}>{d.destaque}</div>}

        {/* Bottom */}
        <div style={{ position: 'absolute', bottom: S ? 36 : 26, left: 0, right: 0, textAlign: 'center' }}>
          <div style={{ fontSize: S ? 11 : 9, color: p.accent, fontWeight: 700 }}>{d.cta || 'Peça pelo WhatsApp'}</div>
        </div>
      </div>
    </Bg>
  );
}

// ── 8. SPLIT ─────────────────────────────────────────────────────
function TSplit({ d, p, restaurante, img, S }) {
  return (
    <Bg p={p} img={img} overlay={0.8}>
      {/* Diagonal split */}
      {!img && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: `linear-gradient(135deg, ${p.g1}ff 0%, ${p.g1}ff 45%, transparent 45%)`,
        }} />
      )}
      {!img && (
        <div style={{
          position: 'absolute', top: 0, left: 0, bottom: 0,
          width: '55%',
          clipPath: 'polygon(0 0, 100% 0, 75% 100%, 0 100%)',
          background: `linear-gradient(160deg, ${p.g1}, ${p.bg})`,
          zIndex: 1,
        }} />
      )}

      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: S ? '44px 36px' : '32px 28px', fontFamily: "'Segoe UI', system-ui, sans-serif", zIndex: 3, position: 'relative' }}>

        {/* Top */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {d.tag && <div style={{ fontSize: S ? 11 : 9, fontWeight: 900, color: p.accent, letterSpacing: 2, textTransform: 'uppercase' }}>{d.tag}</div>}
            <div style={{ fontSize: S ? 9 : 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 3, textTransform: 'uppercase', marginTop: 4 }}>{restaurante}</div>
          </div>
          {!img && <div style={{ fontSize: S ? 72 : 54 }}>{d.emoji_principal || '🍣'}</div>}
        </div>

        {/* Centro */}
        <div>
          <div style={{ fontSize: S ? 66 : 48, fontWeight: 900, lineHeight: 0.95, letterSpacing: -2, color: '#fff', textTransform: 'uppercase', textShadow: img ? '0 2px 30px rgba(0,0,0,0.9)' : 'none' }}>
            {d.headline || 'SUSHI\nPREMIUM'}
          </div>
          {/* Linha colorida */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: S ? '18px 0' : '14px 0' }}>
            <div style={{ width: S ? 60 : 44, height: 3, background: `linear-gradient(90deg, ${p.accent}, ${p.sub})`, borderRadius: 2 }} />
            <div style={{ fontSize: S ? 14 : 11, color: 'rgba(255,255,255,0.6)' }}>{d.subheadline || 'Sabor incomparável'}</div>
          </div>
          {d.destaque && <div style={{ fontSize: S ? 40 : 28, fontWeight: 900, color: p.accent, letterSpacing: -1 }}>{d.destaque}</div>}
        </div>

        {/* Bottom */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(d.emojis_extras || []).slice(0, 3).map((e, i) => <span key={i} style={{ fontSize: S ? 18 : 14 }}>{e}</span>)}
          </div>
          <div style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.sub})`, borderRadius: 100, padding: S ? '10px 26px' : '7px 18px', fontSize: S ? 12 : 10, fontWeight: 900, color: '#000' }}>{d.cta || 'Pedir agora'}</div>
        </div>
      </div>
    </Bg>
  );
}

// ── 9. RETRO ─────────────────────────────────────────────────────
function TRetro({ d, p, restaurante, img, S }) {
  const pad = S ? 44 : 32;
  // grain via repeating pattern
  const grain = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.08'/%3E%3C/svg%3E")`;
  return (
    <Bg p={p} img={img} overlay={0.75}>
      {/* Grain overlay */}
      <div style={{ position: 'absolute', inset: 0, backgroundImage: grain, backgroundSize: '200px 200px', zIndex: 1, opacity: 0.6, mixBlendMode: 'overlay' }} />
      {/* Vignette */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)', zIndex: 1 }} />
      {/* Borda externa estilo vintage */}
      <div style={{ position: 'absolute', inset: S ? 18 : 14, border: `3px solid ${p.accent}88`, zIndex: 3, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: S ? 26 : 20, border: `1px solid ${p.accent}33`, zIndex: 3, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 4, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad, fontFamily: "'Georgia', serif" }}>
        {/* Top banner */}
        <div style={{ textAlign: 'center', background: p.accent, padding: S ? '8px 16px' : '5px 12px', margin: '0 auto', display: 'inline-block', alignSelf: 'center' }}>
          <div style={{ fontSize: S ? 10 : 8, fontWeight: 900, color: '#000', letterSpacing: 4, textTransform: 'uppercase' }}>{restaurante}</div>
        </div>

        {/* Centro */}
        <div style={{ textAlign: 'center' }}>
          {!img && <div style={{ fontSize: S ? 90 : 66, marginBottom: S ? 16 : 12, filter: 'sepia(0.4) saturate(1.5)', lineHeight: 1 }}>{d.emoji_principal || '🍣'}</div>}
          {d.tag && <div style={{ fontSize: S ? 11 : 9, letterSpacing: 4, color: p.accent, textTransform: 'uppercase', marginBottom: S ? 12 : 8, fontStyle: 'italic' }}>— {d.tag} —</div>}
          <div style={{ fontSize: S ? 56 : 40, fontWeight: 900, color: p.text, lineHeight: 1.0, letterSpacing: 2, textTransform: 'uppercase', textShadow: img ? '2px 2px 20px rgba(0,0,0,0.9)' : `2px 2px 0 ${p.accent}44` }}>
            {d.headline || 'SUSHI\nTRADIÇÃO'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: S ? '16px 0' : '10px 0', justifyContent: 'center' }}>
            <div style={{ width: 30, height: 1, background: p.accent }} />
            <span style={{ fontSize: S ? 14 : 11, color: p.accent }}>✦</span>
            <div style={{ width: 30, height: 1, background: p.accent }} />
          </div>
          <div style={{ fontSize: S ? 17 : 13, color: `rgba(255,255,255,0.65)`, fontStyle: 'italic', lineHeight: 1.5 }}>{d.subheadline || 'Sabor autêntico desde sempre'}</div>
          {d.destaque && <div style={{ marginTop: S ? 18 : 12, fontSize: S ? 32 : 22, fontWeight: 900, color: p.accent, letterSpacing: 1 }}>{d.destaque}</div>}
        </div>

        {/* Rodapé */}
        <div style={{ textAlign: 'center', borderTop: `1px solid ${p.accent}44`, paddingTop: S ? 16 : 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: S ? 9 : 7, color: `rgba(255,255,255,0.3)`, letterSpacing: 3, textTransform: 'uppercase' }}>EST. 2024</div>
          <div style={{ background: 'transparent', border: `1px solid ${p.accent}`, borderRadius: 2, padding: S ? '7px 20px' : '5px 14px', fontSize: S ? 11 : 9, fontWeight: 700, color: p.accent, letterSpacing: 1 }}>{d.cta || 'Pedir agora'}</div>
          <div style={{ fontSize: S ? 9 : 7, color: `rgba(255,255,255,0.3)`, letterSpacing: 3, textTransform: 'uppercase' }}>DELIVERY</div>
        </div>
      </div>
    </Bg>
  );
}

// ── 10. GRADIENT ──────────────────────────────────────────────────
function TGradient({ d, p, restaurante, img, S }) {
  const pad = S ? 44 : 32;
  const grad = img ? 'none' : `linear-gradient(135deg, ${p.g1} 0%, ${p.accent}cc 40%, ${p.sub}88 70%, ${p.bg} 100%)`;
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: grad || p.bg }}>
      {img && <img src={img} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} alt="" />}
      {img && <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(135deg, ${p.accent}cc 0%, ${p.bg}dd 100%)` }} />}
      {/* Círculos decorativos */}
      {!img && <>
        <div style={{ position: 'absolute', top: '-10%', right: '-10%', width: S ? 400 : 300, height: S ? 400 : 300, borderRadius: '50%', background: `${p.sub}22`, zIndex: 1 }} />
        <div style={{ position: 'absolute', bottom: '-5%', left: '-15%', width: S ? 350 : 260, height: S ? 350 : 260, borderRadius: '50%', background: `${p.accent}18`, zIndex: 1 }} />
      </>}

      <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        {/* Top */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: S ? 11 : 9, fontWeight: 900, color: 'rgba(255,255,255,0.8)', letterSpacing: 3, textTransform: 'uppercase' }}>{restaurante}</div>
          {d.tag && <div style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)', borderRadius: 100, padding: S ? '5px 14px' : '3px 10px', fontSize: S ? 11 : 9, color: '#fff', fontWeight: 700 }}>{d.tag}</div>}
        </div>

        {/* Centro */}
        <div style={{ textAlign: 'center' }}>
          {!img && <div style={{ fontSize: S ? 100 : 72, marginBottom: S ? 20 : 14, filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.3))' }}>{d.emoji_principal || '🍣'}</div>}
          <div style={{ fontSize: S ? 60 : 44, fontWeight: 900, color: '#fff', lineHeight: 1.0, letterSpacing: -1.5, textTransform: 'uppercase', textShadow: '0 4px 24px rgba(0,0,0,0.4)' }}>
            {d.headline || 'SUSHI\nPREMIUM'}
          </div>
          <div style={{ fontSize: S ? 17 : 13, color: 'rgba(255,255,255,0.8)', marginTop: S ? 14 : 10, lineHeight: 1.4 }}>{d.subheadline || 'Uma experiência de sabor'}</div>
          {d.destaque && <div style={{ marginTop: S ? 20 : 14, display: 'inline-block', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', borderRadius: 16, padding: S ? '10px 28px' : '7px 20px', fontSize: S ? 32 : 24, fontWeight: 900, color: '#fff', border: '1px solid rgba(255,255,255,0.3)' }}>{d.destaque}</div>}
        </div>

        {/* Bottom */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(16px)', borderRadius: 100, padding: S ? '12px 32px' : '8px 22px', fontSize: S ? 14 : 11, fontWeight: 900, color: '#fff', border: '1px solid rgba(255,255,255,0.35)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>{d.cta || 'Pedir agora ✨'}</div>
        </div>
      </div>
    </div>
  );
}

// ── 11. FRAME ─────────────────────────────────────────────────────
function TFrame({ d, p, restaurante, img, S }) {
  const pad = S ? 52 : 38;
  return (
    <Bg p={p} img={img} overlay={0.78}>
      {/* Moldura ornamental */}
      {/* Outer */}
      <div style={{ position: 'absolute', inset: S ? 14 : 10, border: `2px solid ${p.accent}`, zIndex: 3, pointerEvents: 'none' }} />
      {/* Inner */}
      <div style={{ position: 'absolute', inset: S ? 22 : 17, border: `1px solid ${p.accent}44`, zIndex: 3, pointerEvents: 'none' }} />
      {/* Corner ornaments */}
      {[['0','0'], ['0','auto'], ['auto','0'], ['auto','auto']].map(([t,b], i) => (
        <div key={i} style={{
          position: 'absolute', zIndex: 4, pointerEvents: 'none',
          top: t !== 'auto' ? (S ? 7 : 4) : 'auto', bottom: b !== 'auto' ? (S ? 7 : 4) : 'auto',
          left: i < 2 ? (S ? 7 : 4) : 'auto', right: i >= 2 ? (S ? 7 : 4) : 'auto',
          width: S ? 20 : 14, height: S ? 20 : 14,
          borderTop: i < 2 ? `3px solid ${p.accent}` : 'none',
          borderBottom: i >= 2 ? `3px solid ${p.accent}` : 'none',
          borderLeft: (i === 0 || i === 2) ? `3px solid ${p.accent}` : 'none',
          borderRight: (i === 1 || i === 3) ? `3px solid ${p.accent}` : 'none',
        }} />
      ))}

      <div style={{ position: 'relative', zIndex: 5, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad, textAlign: 'center', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        {/* Top */}
        <div>
          <div style={{ fontSize: S ? 9 : 7, letterSpacing: 6, color: p.accent, textTransform: 'uppercase' }}>✦ {restaurante} ✦</div>
          <div style={{ width: 50, height: 1, background: `linear-gradient(90deg, transparent, ${p.accent}, transparent)`, margin: '8px auto' }} />
          {d.tag && <div style={{ fontSize: S ? 11 : 9, color: `${p.accent}99`, letterSpacing: 2, fontStyle: 'italic' }}>{d.tag}</div>}
        </div>

        {/* Centro */}
        <div>
          {!img && <div style={{ fontSize: S ? 88 : 64, marginBottom: S ? 18 : 12, filter: `drop-shadow(0 4px 20px ${p.accent}44)` }}>{d.emoji_principal || '🍣'}</div>}
          <div style={{ fontSize: S ? 52 : 38, fontWeight: 900, color: p.text, lineHeight: 1.05, letterSpacing: -1, textTransform: 'uppercase', textShadow: img ? '0 2px 20px rgba(0,0,0,0.9)' : 'none' }}>
            {d.headline || 'SUSHI\nPREMIUM'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: S ? '16px auto' : '12px auto', justifyContent: 'center' }}>
            <div style={{ width: 20, height: 1, background: p.accent }} />
            <span style={{ color: p.accent, fontSize: S ? 14 : 10 }}>❖</span>
            <div style={{ width: 20, height: 1, background: p.accent }} />
          </div>
          <div style={{ fontSize: S ? 16 : 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, maxWidth: 260, margin: '0 auto' }}>{d.subheadline || 'Excelência em cada detalhe'}</div>
          {d.destaque && <div style={{ marginTop: S ? 18 : 12, fontSize: S ? 30 : 22, fontWeight: 900, color: p.accent }}>{d.destaque}</div>}
        </div>

        {/* Bottom */}
        <div>
          <div style={{ width: 50, height: 1, background: `linear-gradient(90deg, transparent, ${p.accent}, transparent)`, margin: '0 auto 10px' }} />
          <div style={{ display: 'inline-block', border: `1px solid ${p.accent}`, borderRadius: 2, padding: S ? '7px 22px' : '5px 16px', fontSize: S ? 11 : 9, color: p.accent, letterSpacing: 2, textTransform: 'uppercase' }}>{d.cta || 'Pedir agora'}</div>
        </div>
      </div>
    </Bg>
  );
}

// ── 12. DARK ──────────────────────────────────────────────────────
function TDark({ d, p, restaurante, img, S }) {
  const pad = S ? 48 : 34;
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', background: '#030303' }}>
      {img && <img src={img} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.25 }} alt="" />}
      {/* Luz focal central */}
      {!img && <div style={{ position: 'absolute', left: '50%', top: '45%', transform: 'translate(-50%,-50%)', width: S ? 500 : 380, height: S ? 500 : 380, borderRadius: '50%', background: `radial-gradient(circle, ${p.accent}12 0%, transparent 70%)`, zIndex: 1 }} />}
      {/* Linha superior e inferior */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${p.accent}88, transparent)`, zIndex: 3 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg, transparent, ${p.accent}88, transparent)`, zIndex: 3 }} />

      <div style={{ position: 'relative', zIndex: 4, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        {/* Top */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: S ? 10 : 8, letterSpacing: 4, color: '#333', textTransform: 'uppercase' }}>{restaurante}</div>
          {d.tag && <div style={{ fontSize: S ? 10 : 8, color: p.accent, fontWeight: 700, letterSpacing: 1 }}>{d.tag}</div>}
        </div>

        {/* Centro */}
        <div style={{ textAlign: 'center' }}>
          {!img && <div style={{ fontSize: S ? 96 : 70, marginBottom: S ? 20 : 14, opacity: 0.9 }}>{d.emoji_principal || '🍣'}</div>}
          <div style={{ fontSize: S ? 58 : 42, fontWeight: 900, color: '#fff', lineHeight: 1.0, letterSpacing: -1.5, textTransform: 'uppercase' }}>
            {d.headline || 'SUSHI\nPREMIUM'}
          </div>
          {/* Separador com ponto de luz */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: S ? '18px 0' : '12px 0', justifyContent: 'center' }}>
            <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, transparent, ${p.accent}44)` }} />
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.accent, boxShadow: `0 0 12px ${p.accent}` }} />
            <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${p.accent}44, transparent)` }} />
          </div>
          <div style={{ fontSize: S ? 17 : 13, color: '#555', lineHeight: 1.5 }}>{d.subheadline || 'Onde cada detalhe é perfeito'}</div>
          {d.destaque && (
            <div style={{ marginTop: S ? 22 : 16, fontSize: S ? 36 : 26, fontWeight: 900, color: p.accent, textShadow: `0 0 40px ${p.accent}66` }}>{d.destaque}</div>
          )}
        </div>

        {/* Bottom */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(d.emojis_extras || []).slice(0, 2).map((e, i) => <span key={i} style={{ fontSize: S ? 18 : 13, opacity: 0.5 }}>{e}</span>)}
          </div>
          <div style={{ border: `1px solid ${p.accent}55`, borderRadius: 100, padding: S ? '8px 22px' : '6px 16px', fontSize: S ? 12 : 10, fontWeight: 900, color: p.accent }}>{d.cta || 'Pedir agora'}</div>
        </div>
      </div>
    </div>
  );
}

// ── 13. STICKER ───────────────────────────────────────────────────
function TSticker({ d, p, restaurante, img, S }) {
  const pad = S ? 36 : 26;
  return (
    <Bg p={p} img={img} overlay={0.7}>
      {/* Fundo com padrão de bolinhas */}
      {!img && <div style={{ position: 'absolute', inset: 0, backgroundImage: `radial-gradient(circle, ${p.accent}22 2px, transparent 2px)`, backgroundSize: '24px 24px', zIndex: 1 }} />}

      <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: pad, textAlign: 'center', fontFamily: "'Segoe UI', system-ui, sans-serif", gap: S ? 18 : 12 }}>

        {/* Sticker principal */}
        <div style={{ background: `linear-gradient(135deg, ${p.accent}, ${p.sub})`, borderRadius: S ? 32 : 22, padding: S ? '28px 36px' : '20px 28px', boxShadow: `0 12px 50px ${p.accent}66, 6px 6px 0 rgba(0,0,0,0.3)`, maxWidth: '85%', transform: 'rotate(-1.5deg)' }}>
          {!img && <div style={{ fontSize: S ? 72 : 52, marginBottom: S ? 10 : 6 }}>{d.emoji_principal || '🍣'}</div>}
          <div style={{ fontSize: S ? 46 : 32, fontWeight: 900, color: '#000', lineHeight: 1.05, letterSpacing: -1.5, textTransform: 'uppercase' }}>
            {d.headline || 'SUSHI\nINSANE'}
          </div>
        </div>

        {/* Sub sticker */}
        <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: S ? 18 : 12, padding: S ? '12px 24px' : '8px 18px', boxShadow: '4px 4px 0 rgba(0,0,0,0.3)', transform: 'rotate(1deg)', maxWidth: '80%' }}>
          <div style={{ fontSize: S ? 16 : 12, fontWeight: 900, color: '#111', lineHeight: 1.3 }}>{d.subheadline || 'Feito pra você 🎉'}</div>
        </div>

        {/* Destaque badge */}
        {d.destaque && (
          <div style={{ background: '#fff', borderRadius: 100, padding: S ? '8px 24px' : '5px 16px', boxShadow: `0 4px 20px rgba(0,0,0,0.3), 2px 2px 0 ${p.accent}`, transform: 'rotate(-0.5deg)' }}>
            <span style={{ fontSize: S ? 26 : 18, fontWeight: 900, color: p.accent }}>{d.destaque}</span>
          </div>
        )}

        {/* CTA sticker */}
        <div style={{ background: '#111', borderRadius: 100, padding: S ? '12px 32px' : '8px 22px', boxShadow: '3px 3px 0 rgba(0,0,0,0.5)', transform: 'rotate(0.5deg)' }}>
          <span style={{ fontSize: S ? 14 : 11, fontWeight: 900, color: '#fff' }}>{d.cta || '👉 Pedir agora!'}</span>
        </div>

        {/* Restaurante */}
        <div style={{ position: 'absolute', bottom: S ? 24 : 16, fontSize: S ? 9 : 7, color: 'rgba(255,255,255,0.3)', letterSpacing: 3, textTransform: 'uppercase' }}>{restaurante}</div>
      </div>
    </Bg>
  );
}

// ── 14. DUO ───────────────────────────────────────────────────────
function TDuo({ d, p, restaurante, img, S }) {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', fontFamily: "'Segoe UI', system-ui, sans-serif", display: 'flex', flexDirection: S ? 'column' : 'row' }}>
      {/* Painel esquerdo/superior — escuro */}
      <div style={{ flex: S ? '0 0 55%' : '0 0 50%', background: '#060606', position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: S ? '44px 32px 24px' : '32px 28px', overflow: 'hidden' }}>
        {img && <img src={img} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.3 }} alt="" />}
        <div style={{ position: 'relative', zIndex: 2 }}>
          {!img && <div style={{ fontSize: S ? 80 : 56, marginBottom: S ? 16 : 12 }}>{d.emoji_principal || '🍣'}</div>}
          {d.tag && <div style={{ fontSize: S ? 10 : 8, fontWeight: 900, color: p.accent, letterSpacing: 3, textTransform: 'uppercase', marginBottom: S ? 10 : 6 }}>{d.tag}</div>}
          <div style={{ fontSize: S ? 52 : 36, fontWeight: 900, color: '#fff', lineHeight: 1.0, letterSpacing: -2, textTransform: 'uppercase', textShadow: img ? '0 2px 20px rgba(0,0,0,0.9)' : 'none' }}>
            {(d.headline || 'SUSHI\nPREMIUM').split(' ')[0] || 'SUSHI'}
          </div>
          <div style={{ fontSize: S ? 52 : 36, fontWeight: 900, lineHeight: 1.0, letterSpacing: -2, textTransform: 'uppercase', color: p.accent }}>
            {(d.headline || 'SUSHI PREMIUM').split(' ').slice(1).join(' ') || 'PREMIUM'}
          </div>
        </div>
      </div>

      {/* Divisor */}
      <div style={{ position: 'absolute', [S ? 'top' : 'left']: S ? '55%' : '50%', [S ? 'left' : 'top']: 0, [S ? 'right' : 'bottom']: 0, [S ? 'height' : 'width']: 2, background: `linear-gradient(${S ? '90deg' : '180deg'}, transparent, ${p.accent}, transparent)`, zIndex: 10 }} />

      {/* Painel direito/inferior — colorido */}
      <div style={{ flex: 1, background: `linear-gradient(135deg, ${p.g1}, ${p.accent}cc)`, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: S ? '20px 32px 44px' : '32px 28px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: S ? 180 : 140, height: S ? 180 : 140, borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: S ? 16 : 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, marginBottom: S ? 12 : 8 }}>{d.subheadline || 'Sabor incomparável'}</div>
          {d.destaque && <div style={{ fontSize: S ? 36 : 26, fontWeight: 900, color: '#fff', letterSpacing: -1 }}>{d.destaque}</div>}
        </div>
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: S ? 9 : 7, color: 'rgba(255,255,255,0.4)', letterSpacing: 3, textTransform: 'uppercase' }}>{restaurante}</div>
          <div style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', borderRadius: 100, padding: S ? '8px 20px' : '5px 14px', fontSize: S ? 12 : 9, fontWeight: 900, color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}>{d.cta || 'Pedir agora'}</div>
        </div>
      </div>
    </div>
  );
}

// ── 15. WAVE ──────────────────────────────────────────────────────
function TWave({ d, p, restaurante, img, S }) {
  const pad = S ? 44 : 32;
  const waveSvg = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 ${S ? 320 : 200}'%3E%3Cpath fill='${encodeURIComponent(p.accent)}' fill-opacity='0.12' d='M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,112C672,96,768,96,864,112C960,128,1056,160,1152,165.3C1248,171,1344,149,1392,138.7L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z'%3E%3C/path%3E%3C/svg%3E")`;
  const waveSvg2 = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1440 ${S ? 280 : 180}'%3E%3Cpath fill='${encodeURIComponent(p.sub)}' fill-opacity='0.08' d='M0,160L60,149.3C120,139,240,117,360,128C480,139,600,181,720,186.7C840,192,960,160,1080,138.7C1200,117,1320,107,1380,101.3L1440,96L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z'%3E%3C/path%3E%3C/svg%3E")`;
  return (
    <Bg p={p} img={img} overlay={0.8}>
      {/* Ondas */}
      {!img && <>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: S ? '45%' : '50%', backgroundImage: waveSvg, backgroundSize: 'cover', backgroundPosition: 'top', zIndex: 1 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: S ? '35%' : '40%', backgroundImage: waveSvg2, backgroundSize: 'cover', backgroundPosition: 'top', zIndex: 1 }} />
      </>}

      <div style={{ position: 'relative', zIndex: 2, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: pad, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        {/* Top */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: S ? 9 : 7, letterSpacing: 4, color: `${p.accent}99`, textTransform: 'uppercase' }}>{restaurante}</div>
          {d.tag && <div style={{ background: `${p.accent}22`, border: `1px solid ${p.accent}44`, borderRadius: 100, padding: S ? '4px 12px' : '3px 9px', fontSize: S ? 10 : 8, color: p.accent, fontWeight: 700 }}>{d.tag}</div>}
        </div>

        {/* Centro */}
        <div style={{ textAlign: 'center' }}>
          {!img && <div style={{ fontSize: S ? 100 : 72, marginBottom: S ? 18 : 14, filter: `drop-shadow(0 8px 28px ${p.accent}44)` }}>{d.emoji_principal || '🍣'}</div>}
          <div style={{ fontSize: S ? 56 : 40, fontWeight: 900, color: '#fff', lineHeight: 1.0, letterSpacing: -1.5, textTransform: 'uppercase', textShadow: img ? '0 2px 20px rgba(0,0,0,0.9)' : 'none' }}>
            {d.headline || 'SUSHI\nPREMIUM'}
          </div>
          {/* Onda decorativa SVG inline */}
          <div style={{ margin: S ? '14px 0' : '10px 0', opacity: 0.6 }}>
            <svg width={S ? 120 : 80} height={S ? 16 : 10} viewBox="0 0 120 16">
              <path d={`M0,8 C15,0 30,16 45,8 C60,0 75,16 90,8 C105,0 115,16 120,8`} stroke={p.accent} strokeWidth="2" fill="none" />
            </svg>
          </div>
          <div style={{ fontSize: S ? 16 : 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{d.subheadline || 'Flui como a maré, saboroso como o mar'}</div>
          {d.destaque && <div style={{ marginTop: S ? 18 : 12, fontSize: S ? 32 : 22, fontWeight: 900, color: p.accent }}>{d.destaque}</div>}
        </div>

        {/* Bottom */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: `linear-gradient(90deg, ${p.accent}cc, ${p.sub}cc)`, borderRadius: 100, padding: S ? '11px 30px' : '7px 20px', fontSize: S ? 13 : 10, fontWeight: 900, color: '#000' }}>{d.cta || 'Pedir agora 〰'}</div>
        </div>
      </div>
    </Bg>
  );
}

// ── 16. POSTER ────────────────────────────────────────────────────
function TPoster({ d, p, restaurante, img, S }) {
  return (
    <Bg p={p} img={img} overlay={0.82}>
      {/* Geometria de fundo */}
      {!img && <>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: S ? '50%' : '52%', background: p.accent, zIndex: 1, clipPath: 'polygon(0 0, 100% 0, 100% 85%, 0 100%)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: S ? '50%' : '52%', background: `linear-gradient(135deg, ${p.sub}44 0%, transparent 60%)`, zIndex: 2, clipPath: 'polygon(0 0, 100% 0, 100% 85%, 0 100%)' }} />
      </>}
      {img && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: S ? '50%' : '52%', background: `${p.accent}88`, zIndex: 2, clipPath: 'polygon(0 0, 100% 0, 100% 85%, 0 100%)' }} />}

      <div style={{ position: 'relative', zIndex: 5, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        {/* Seção superior (colorida) */}
        <div style={{ flex: S ? '0 0 50%' : '0 0 52%', padding: S ? '44px 36px 20px' : '32px 28px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: S ? 10 : 8, fontWeight: 900, color: 'rgba(0,0,0,0.5)', letterSpacing: 3, textTransform: 'uppercase' }}>{restaurante}</div>
            {d.tag && <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: 4, padding: S ? '4px 10px' : '3px 8px', fontSize: S ? 10 : 8, fontWeight: 900, color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase' }}>{d.tag}</div>}
          </div>
          <div>
            {!img && <div style={{ fontSize: S ? 80 : 58, marginBottom: S ? 10 : 6, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}>{d.emoji_principal || '🍣'}</div>}
            <div style={{ fontSize: S ? 62 : 44, fontWeight: 900, color: img ? '#fff' : '#000', lineHeight: 0.95, letterSpacing: -2, textTransform: 'uppercase', textShadow: img ? '0 2px 20px rgba(0,0,0,0.8)' : 'none' }}>
              {d.headline || 'SUSHI\nPREMIUM'}
            </div>
          </div>
        </div>

        {/* Seção inferior (escura) */}
        <div style={{ flex: 1, padding: S ? '24px 36px 44px' : '18px 28px 32px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: S ? 17 : 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, marginBottom: S ? 12 : 8 }}>{d.subheadline || 'Uma experiência gastronômica única'}</div>
            {d.destaque && <div style={{ fontSize: S ? 38 : 28, fontWeight: 900, color: p.accent, letterSpacing: -1 }}>{d.destaque}</div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {(d.emojis_extras || []).slice(0, 3).map((e, i) => <span key={i} style={{ fontSize: S ? 20 : 14, opacity: 0.6 }}>{e}</span>)}
            </div>
            <div style={{ background: p.accent, borderRadius: 100, padding: S ? '10px 26px' : '7px 18px', fontSize: S ? 13 : 10, fontWeight: 900, color: '#000' }}>{d.cta || 'Pedir agora'}</div>
          </div>
        </div>
      </div>
    </Bg>
  );
}

const TMAP = { luxo: TLuxo, neon: TNeon, bold: TBold, magazine: TMagazine, cinema: TCinema, urgente: TUrgente, zen: TZen, split: TSplit, retro: TRetro, gradient: TGradient, frame: TFrame, dark: TDark, sticker: TSticker, duo: TDuo, wave: TWave, poster: TPoster };

// ── IGStoriesFrame ──────────────────────────────────────────────
function IGStoriesFrame({ restaurante, acc, width, height, children }) {
  return (
    <div style={{ width, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ background: '#0a0a0a', borderRadius: 24, overflow: 'hidden', boxShadow: '0 28px 80px rgba(0,0,0,0.95)', border: '1px solid #1a1a1a' }}>
        {/* Status bar */}
        <div style={{ background: '#000', padding: '9px 18px 5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>9:41</span>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: 11, color: '#fff' }}>
            <span>●●●</span><span>WiFi</span><span>🔋</span>
          </div>
        </div>
        {/* Content */}
        <div style={{ position: 'relative' }}>
          <div style={{ width: '100%', height }}>{children}</div>
          {/* Progress + profile overlay */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '10px 10px 0', zIndex: 10 }}>
            <div style={{ display: 'flex', gap: 3, marginBottom: 8 }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ flex: 1, height: 2.5, borderRadius: 2, background: 'rgba(255,255,255,0.3)', overflow: 'hidden' }}>
                  {i === 1 && <div style={{ width: '65%', height: '100%', background: '#fff' }} />}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: `linear-gradient(135deg, ${acc}, var(--accent-2))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff', border: '2px solid rgba(255,255,255,0.6)', flexShrink: 0 }}>
                {restaurante.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>{restaurante.toLowerCase().replace(/\s/g,'_')}</span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>Agora</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 14, alignItems: 'center' }}>
                <span style={{ fontSize: 17, color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>···</span>
                <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>✕</span>
              </div>
            </div>
          </div>
          {/* Reply bar */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 12px 12px', background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)', display: 'flex', alignItems: 'center', gap: 10, zIndex: 10 }}>
            <div style={{ flex: 1, height: 34, borderRadius: 17, border: '1px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', paddingLeft: 14 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>Enviar mensagem</span>
            </div>
            <span style={{ fontSize: 22 }}>❤️</span><span style={{ fontSize: 18, color: '#fff' }}>↗</span>
          </div>
        </div>
        {/* Home bar */}
        <div style={{ background: '#000', padding: '7px 0 11px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 100, height: 4, background: '#333', borderRadius: 2 }} />
        </div>
      </div>
    </div>
  );
}

// ── IGFeedFrame ─────────────────────────────────────────────────
function IGFeedFrame({ restaurante, acc, width, height, headline, children }) {
  return (
    <div style={{ width, background: '#111', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.9)', border: '1px solid #1a1a1a', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #1a1a1a' }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${acc}, var(--accent-2))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: '#fff', flexShrink: 0, outline: `2px solid ${acc}`, outlineOffset: 2 }}>
          {restaurante.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{restaurante.toLowerCase().replace(/\s/g,'_')}</div>
          <div style={{ fontSize: 10, color: '#555' }}>Patrocinado</div>
        </div>
        <span style={{ fontSize: 18, color: '#888' }}>···</span>
      </div>
      <div style={{ width: '100%', height }}>{children}</div>
      <div style={{ padding: '10px 14px 6px' }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
          <span style={{ fontSize: 22 }}>🤍</span><span style={{ fontSize: 20, color: '#888' }}>💬</span><span style={{ fontSize: 20, color: '#888' }}>↗</span>
          <span style={{ fontSize: 20, color: '#888', marginLeft: 'auto' }}>🔖</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 3 }}>1.284 curtidas</div>
        <div style={{ fontSize: 11, color: '#888' }}>
          <span style={{ color: '#fff', fontWeight: 700 }}>{restaurante.toLowerCase().replace(/\s/g,'_')} </span>
          {(headline || '').toLowerCase() || 'Venha conferir! 🍣'}
        </div>
        <div style={{ fontSize: 10, color: '#444', marginTop: 4 }}>há 2 minutos</div>
      </div>
    </div>
  );
}

// ── ModalZoom ───────────────────────────────────────────────────
function ModalZoom({ template, paleta, paletaAtiva, dados, restaurante, formato, bgImage, frameIG, onClose, cfg }) {
  const Comp = TMAP[template] || TLuxo;
  const S = formato === 'stories';
  const p = paletaAtiva || PALETAS[paleta] || PALETAS['brand'];
  const EXPORT_W = 1080;
  const EXPORT_H = S ? 1920 : 1080;
  const maxH = window.innerHeight * 0.88;
  const maxW = Math.min(window.innerWidth * 0.92, S ? 440 : 600);
  const scale = Math.min(maxH / EXPORT_H, maxW / EXPORT_W);
  const W = Math.round(EXPORT_W * scale);
  const H = Math.round(EXPORT_H * scale);
  const fsc = cfg?.fontScale || 1;

  const templateEl = (
    <div style={{ width: EXPORT_W, height: EXPORT_H, transformOrigin: 'top left', transform: `scale(${scale})`, position: 'absolute', top: 0, left: 0 }}>
      <div style={{ width: '100%', height: '100%', transformOrigin: 'center center', transform: `scale(${fsc})` }}>
        <Comp d={dados} p={p} restaurante={restaurante} img={bgImage} S={S} />
      </div>
      {/* Logo overlay */}
      {cfg?.logo && <LogoOverlay logo={cfg.logo} pos={cfg.logoPos} size={cfg.logoSize} W={EXPORT_W} H={EXPORT_H} />}
    </div>
  );

  const criativo = (
    <div style={{ position: 'relative', width: W, height: H, overflow: 'hidden', borderRadius: frameIG ? 0 : 16 }}>
      {templateEl}
      {/* Badge */}
      {cfg?.badge && <BadgeOverlay badge={cfg.badge} pos={cfg.badgePos} shape={cfg.badgeShape} color={cfg.badgeColor} W={W} H={H} scale={1} />}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', color: '#fff', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>✕</button>
      <div onClick={e => e.stopPropagation()}>
        {frameIG && S
          ? <IGStoriesFrame restaurante={restaurante} acc={p.accent} width={W} height={H}><div style={{ position: 'relative', width: '100%', height: H, overflow: 'hidden' }}>{templateEl}</div></IGStoriesFrame>
          : frameIG && !S
          ? <IGFeedFrame restaurante={restaurante} acc={p.accent} width={W} height={H} headline={dados.headline}><div style={{ position: 'relative', width: '100%', height: H, overflow: 'hidden' }}>{templateEl}</div></IGFeedFrame>
          : criativo}
      </div>
      <p style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Clique fora para fechar</p>
    </div>
  );
}

// ── LogoOverlay (preview + zoom) ─────────────────────────────────
function LogoOverlay({ logo, pos, size = 120, W, H }) {
  if (!logo) return null;
  const pad = Math.round(W * 0.052);
  const s = Math.round(W * (size / 1080));
  const posMap = {
    'top-left':     { top: pad, left: pad },
    'top-right':    { top: pad, right: pad },
    'bottom-left':  { bottom: pad, left: pad },
    'bottom-right': { bottom: pad, right: pad },
    'center':       { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' },
  };
  return (
    <img src={logo} alt="logo" style={{
      position: 'absolute', zIndex: 15,
      maxWidth: s, maxHeight: s, objectFit: 'contain',
      filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))',
      ...(posMap[pos || 'bottom-right'] || posMap['bottom-right']),
    }} />
  );
}

// ── BadgeOverlay (preview + zoom) ────────────────────────────────
function BadgeOverlay({ badge, pos, shape, color, W, H, scale = 1 }) {
  if (!badge) return null;
  const pad = Math.round(W * 0.045);
  const fs = Math.round(W * 0.038);
  const posMap = {
    'top-left':    { top: pad, left: pad },
    'top-right':   { top: pad, right: pad },
    'top-center':  { top: pad, left: '50%', transform: 'translateX(-50%)' },
    'bottom-left': { bottom: pad, left: pad },
    'bottom-right':{ bottom: pad, right: pad },
  };
  const shapeStyle = {
    circle:  { width: fs*2.4, height: fs*2.4, borderRadius: '50%', display:'flex', alignItems:'center', justifyContent:'center', padding: 0 },
    pill:    { borderRadius: 100, padding: `${fs*0.4}px ${fs*0.8}px` },
    ribbon:  { borderRadius: 4, padding: `${fs*0.35}px ${fs*0.8}px`, transform: (posMap[pos||'top-right'].transform||'') + ' rotate(-3deg)' },
    tag:     { borderRadius: 6, padding: `${fs*0.35}px ${fs*0.7}px`, borderLeft: `4px solid rgba(0,0,0,0.3)` },
  }[shape || 'circle'] || {};
  return (
    <div style={{
      position: 'absolute', zIndex: 20,
      background: color || '#ef4444', color: '#fff',
      fontSize: fs, fontWeight: 900, textAlign: 'center', whiteSpace: 'nowrap',
      boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
      ...(posMap[pos || 'top-right'] || posMap['top-right']),
      ...shapeStyle,
    }}>{badge}</div>
  );
}

// ── Preview ─────────────────────────────────────────────────────
function Preview({ template, paleta, paletaAtiva, dados, restaurante, bgImage, formato, frameIG, previewRef, onZoom, cfg }) {
  const Comp = TMAP[template] || TLuxo;
  const p = paletaAtiva || PALETAS[paleta] || PALETAS['brand'];
  const S = formato === 'stories';
  const EXPORT_W = 1080;
  const EXPORT_H = S ? 1920 : 1080;
  const PW = S ? 230 : 310;
  const PH = S ? 408 : 310;
  const scale = PW / EXPORT_W;
  const fsc = cfg?.fontScale || 1;

  const templateEl = (
    <div ref={previewRef} style={{ width: EXPORT_W, height: EXPORT_H, transformOrigin: 'top left', transform: `scale(${scale})`, position: 'absolute', top: 0, left: 0 }}>
      <div style={{ width: '100%', height: '100%', transformOrigin: 'center center', transform: `scale(${fsc})` }}>
        <Comp d={dados} p={p} restaurante={restaurante} img={bgImage} S={S} />
      </div>
      {cfg?.logo && <LogoOverlay logo={cfg.logo} pos={cfg.logoPos} size={cfg.logoSize} W={EXPORT_W} H={EXPORT_H} />}
    </div>
  );

  const inner = (
    <div style={{ position: 'relative', width: PW, height: PH, overflow: 'hidden', borderRadius: frameIG ? 0 : 12 }}>
      {templateEl}
      {cfg?.badge && <BadgeOverlay badge={cfg.badge} pos={cfg.badgePos} shape={cfg.badgeShape} color={cfg.badgeColor} W={PW} H={PH} />}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div onClick={onZoom} style={{ cursor: 'zoom-in', position: 'relative' }}>
        {frameIG && S
          ? <IGStoriesFrame restaurante={restaurante} acc={p.accent} width={PW} height={PH}><div style={{ position: 'relative', width: '100%', height: PH, overflow: 'hidden' }}>{templateEl}</div></IGStoriesFrame>
          : frameIG && !S
          ? <IGFeedFrame restaurante={restaurante} acc={p.accent} width={PW} height={PH} headline={dados.headline}><div style={{ position: 'relative', width: '100%', height: PH, overflow: 'hidden' }}>{templateEl}</div></IGFeedFrame>
          : <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.8)' }}>{inner}</div>}
        <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', borderRadius: 7, padding: '3px 8px', fontSize: 10, color: 'rgba(255,255,255,0.65)', pointerEvents: 'none', zIndex: 30 }}>🔍 ampliar</div>
      </div>
      <div style={{ fontSize: 10, color: '#3a3a3a' }}>{EXPORT_W}×{EXPORT_H} · {S ? 'Stories' : 'Post'}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PÁGINA
// ═══════════════════════════════════════════════════════════════
export default function CriativoSocial() {
  const [template, setTemplate] = useState('luxo');
  const [paleta, setPaleta] = useState('brand');
  const [formato, setFormato] = useState('post');
  const [restaurante, setRestaurante] = useState('Sushi Control');
  const [bgImage, setBgImage] = useState(null);
  const [tema, setTema] = useState('');
  const [itemSelecionado, setItemSelecionado] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [legendaCopied, setLegendaCopied] = useState(false);
  const [frameIG, setFrameIG] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [itens, setItens] = useState([]);
  const [aba, setAba] = useState('gerar');
  const [dados, setDados] = useState({ headline: 'SUSHI PREMIUM', subheadline: 'Tradição japonesa com ingredientes frescos', destaque: 'R$ 49,90', tag: '🔥 Especial', legenda: '', hashtags: [], cta: 'Peça agora! 🛵', emoji_principal: '🍣', emojis_extras: ['✨','🌊','🎌'], sugestao_horario: '' });
  const [cfg, setCfg] = useState({
    showTag: true, showEmoji: true, showDestaque: true, showSub: true, showCta: true,
    overlayAlpha: null, fontScale: 1.0, accentOverride: '',
    badge: '', badgePos: 'top-right', badgeColor: '#ef4444', badgeShape: 'circle',
    logo: null, logoPos: 'bottom-right', logoSize: 120,
    bgPattern: 'none', exportRatio: '1:1',
  });
  const setCf = (k, v) => setCfg(p => ({ ...p, [k]: v }));
  const [history, setHistory] = useState([]);
  const pushHistory = () => setHistory(h => [...h.slice(-19), { dados: { ...dados }, cfg: { ...cfg }, template, paleta, formato }]);
  const undo = () => { if (!history.length) return; const last = history[history.length - 1]; setDados(last.dados); setCfg(last.cfg); setTemplate(last.template); setPaleta(last.paleta); setHistory(h => h.slice(0, -1)); toast('↩ Desfeito'); };

  const previewRef = useRef(null);
  const fotoRef = useRef(null);
  const logoRef = useRef(null);

  useEffect(() => {
    fetch(`${BASE}/cardapio`, { headers: authH() }).then(r => r.json()).then(cats => {
      if (Array.isArray(cats)) setItens(cats.flatMap(c => (c.itens || []).map(i => ({ ...i, cat: c.nome }))));
    }).catch(() => {});
    fetch(`${BASE}/cardapio/config`, { headers: authH() }).then(r => r.json()).then(d => { if (d.nome_restaurante) setRestaurante(d.nome_restaurante); }).catch(() => {});
  }, []);

  function onFoto(e) {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error('Máx 10MB'); return; }
    const reader = new FileReader();
    reader.onload = ev => setBgImage(ev.target.result);
    reader.readAsDataURL(f);
  }

  function onLogo(e) {
    const f = e.target.files[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => setCf('logo', ev.target.result);
    reader.readAsDataURL(f);
  }

  async function gerar(temaExtra) {
    const temaFinal = temaExtra || tema;
    if (!temaFinal && !itemSelecionado) { toast.error('Escolha um item ou tema'); return; }
    setGerando(true);
    try {
      const r = await fetch(`${BASE}/ia/criativo-social`, {
        method: 'POST', headers: authJ(),
        body: JSON.stringify({ formato, restaurante, tema: temaFinal, item_nome: itemSelecionado?.nome || '', preco: itemSelecionado?.preco || '' }),
      });
      if (!r.ok) throw new Error((await r.json()).erro || 'Erro');
      const d = await r.json();
      setDados(prev => ({ ...prev, ...d }));
      // Auto-seleciona template e paleta sugeridos pela IA
      const tplIds = ['luxo','neon','bold','magazine','cinema','urgente','zen','split','retro','gradient','frame','dark','sticker','duo','wave','poster'];
      if (d.template_sugerido) {
        const tpl = tplIds.find(k => d.template_sugerido.toLowerCase().includes(k));
        if (tpl) setTemplate(tpl);
      }
      const corMap = { vermelho:'vermelho', laranja:'brand', dourado:'dourado', oceano:'oceano', floresta:'floresta', roxo:'roxo', sakura:'sakura' };
      if (d.cor_tema && corMap[d.cor_tema]) setPaleta(corMap[d.cor_tema]);
      toast.success('Criativo gerado! ✨');
      setAba('legenda');
    } catch (e) { toast.error(e.message); }
    setGerando(false);
  }

  function copiar() {
    const h = (dados.hashtags || []).map(h => `#${h}`).join(' ');
    navigator.clipboard.writeText(`${dados.legenda || ''}\n\n${h}`).then(() => { setLegendaCopied(true); toast.success('Copiado!'); setTimeout(() => setLegendaCopied(false), 2500); });
  }

  async function exportar(ratio) {
    setExportando(true);
    try {
      const r = ratio || cfg.exportRatio || '1:1';
      const ratioMap = { '1:1': [1080,1080], '4:5': [1080,1350], '9:16': [1080,1920], '16:9': [1920,1080] };
      const [W, H] = ratioMap[r] || [1080,1080];
      const fmtOverride = H > W ? 'stories' : 'post';
      const canvas = document.createElement('canvas');
      await renderTemplateToCanvas(canvas, {
        template, paleta: paletaAtiva, dados: dadosVisiveis,
        restaurante, bgImage, formato: fmtOverride, cfg,
      });
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `criativo_${template}_${r.replace(':','x')}_${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(`PNG ${W}×${H} — qualidade máxima! 🎉`);
      }, 'image/png', 1.0);
    } catch (e) { toast.error('Erro: ' + e.message); console.error(e); }
    setExportando(false);
  }

  // Dados com visibilidade aplicada (para preview e export)
  const dadosVisiveis = {
    ...dados,
    tag:             cfg.showTag     !== false ? dados.tag             : '',
    emoji_principal: cfg.showEmoji   !== false ? dados.emoji_principal : '',
    destaque:        cfg.showDestaque!== false ? dados.destaque        : '',
    subheadline:     cfg.showSub     !== false ? dados.subheadline     : '',
    cta:             cfg.showCta     !== false ? dados.cta             : '',
  };

  // Paleta com cor customizada aplicada
  const paletaAtiva = cfg.accentOverride
    ? { ...PALETAS[paleta], accent: cfg.accentOverride }
    : PALETAS[paleta];

  const IS = { background: '#1a1a1a', border: '1px solid #252525', color: '#fff' };
  const IC = 'w-full px-3 py-2 rounded-xl text-sm outline-none';

  return (
    <div className="max-w-6xl mx-auto">
      <Toaster position="top-right" />

      <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-white">📸 Criativo Social</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Posts e Stories profissionais gerados com IA</p>
        </div>
        {/* Formato toggle */}
        <div className="flex gap-1.5 p-1 rounded-xl" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
          {[{ id: 'post', label: '⬛ Post' }, { id: 'stories', label: '📱 Stories' }].map(f => (
            <button key={f.id} onClick={() => setFormato(f.id)}
              className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={formato === f.id ? { background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', color: '#000' } : { color: '#555' }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">

        {/* ── Esquerdo ── */}
        <div className="lg:w-[300px] shrink-0 space-y-3">

          {/* Tabs */}
          <div className="flex rounded-xl overflow-hidden" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
            {[{ id: 'gerar', l: '🤖 IA' }, { id: 'design', l: '🎨 Design' }, { id: 'editar', l: '✏️ Editar' }, { id: 'legenda', l: '📝 Legenda' }].map(t => (
              <button key={t.id} onClick={() => setAba(t.id)} className="flex-1 py-2 text-xs font-bold transition-all"
                style={aba === t.id ? { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)' } : { color: '#555' }}>
                {t.l}
              </button>
            ))}
          </div>

          {/* ── ABA IA ── */}
          {aba === 'gerar' && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: '#111', border: '1px solid #1e1e1e' }}>

              {/* Atalhos rápidos */}
              <div>
                <label className="text-[10px] text-zinc-600 font-bold mb-2 block tracking-widest">ATALHOS RÁPIDOS</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ATALHOS.map(a => (
                    <button key={a.label} onClick={() => { setTema(a.tema); gerar(a.tema); }}
                      disabled={gerando}
                      className="px-2 py-2 rounded-xl text-[11px] font-bold transition-all text-left leading-tight"
                      style={{ background: '#1a1a1a', border: '1px solid #252525', color: '#888' }}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ height: 1, background: '#1e1e1e' }} />

              {/* Item */}
              <div>
                <label className="text-[10px] text-zinc-600 font-bold mb-1.5 block tracking-widest">ITEM DO CARDÁPIO</label>
                <select className={IC} style={IS} value={itemSelecionado?.id || ''}
                  onChange={e => setItemSelecionado(itens.find(i => i.id === Number(e.target.value)) || null)}>
                  <option value="">— Sem item específico —</option>
                  {itens.map(i => <option key={i.id} value={i.id}>{i.nome} — R${Number(i.preco).toFixed(2)}</option>)}
                </select>
              </div>

              {/* Tema */}
              <div>
                <label className="text-[10px] text-zinc-600 font-bold mb-1.5 block tracking-widest">CONTEXTO / IDEIA</label>
                <textarea className={IC} style={{ ...IS, minHeight: 62, resize: 'vertical' }}
                  placeholder="Ex: promoção relâmpago, lançamento, especial de sexta..."
                  value={tema} onChange={e => setTema(e.target.value)} />
              </div>

              <button onClick={() => gerar()} disabled={gerando}
                className="w-full py-3 rounded-xl font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                style={{ background: gerando ? '#1a1a1a' : 'linear-gradient(135deg,var(--accent),var(--accent-2))', color: gerando ? '#555' : '#000', opacity: gerando ? 0.7 : 1 }}>
                {gerando ? <><span className="animate-spin inline-block">⟳</span> Gerando...</> : '✨ Gerar criativo com IA'}
              </button>

              {dados.sugestao_horario && (
                <div className="rounded-xl px-3 py-2 text-xs flex items-center gap-2" style={{ background: 'rgba(var(--accent-rgb),0.08)', border: '1px solid rgba(var(--accent-rgb),0.15)', color: 'var(--accent)' }}>
                  ⏰ <span><strong>Melhor horário:</strong> {dados.sugestao_horario}</span>
                </div>
              )}
            </div>
          )}

          {/* ── ABA DESIGN ── */}
          {aba === 'design' && (
            <div className="rounded-2xl p-4 space-y-4" style={{ background: '#111', border: '1px solid #1e1e1e' }}>

              {/* Foto */}
              <div>
                <label className="text-[10px] text-zinc-600 font-bold mb-1.5 block tracking-widest">📷 FOTO DE FUNDO</label>
                <input ref={fotoRef} type="file" accept="image/*" onChange={onFoto} className="hidden" />
                <div className="flex gap-2">
                  <button onClick={() => fotoRef.current?.click()}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold transition-all"
                    style={bgImage ? { background: 'rgba(var(--accent-rgb),0.12)', border: '1px solid rgba(var(--accent-rgb),0.3)', color: 'var(--accent)' } : { background: '#1a1a1a', border: '1px solid #252525', color: '#888' }}>
                    {bgImage ? '✓ Foto carregada' : '📁 Carregar foto'}
                  </button>
                  {bgImage && <button onClick={() => setBgImage(null)} className="w-10 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>✕</button>}
                </div>
                {bgImage && <div className="mt-2 rounded-xl overflow-hidden" style={{ height: 70 }}><img src={bgImage} alt="" className="w-full h-full object-cover" /></div>}
              </div>

              {/* Templates */}
              <div>
                <label className="text-[10px] text-zinc-600 font-bold mb-1.5 block tracking-widest">TEMPLATE</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => setTemplate(t.id)}
                      className="px-2 py-2.5 rounded-xl text-left text-[11px] transition-all"
                      style={template === t.id ? { background: 'rgba(var(--accent-rgb),0.12)', border: '1px solid rgba(var(--accent-rgb),0.3)', color: 'var(--accent)' } : { background: '#1a1a1a', border: '1px solid #252525', color: '#777' }}>
                      <div className="font-bold leading-tight">{t.nome}</div>
                      <div className="opacity-50 mt-0.5 leading-tight" style={{ fontSize: 9 }}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Paletas */}
              <div>
                <label className="text-[10px] text-zinc-600 font-bold mb-1.5 block tracking-widest">PALETA</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(PALETAS).map(([key, pal]) => (
                    <button key={key} onClick={() => setPaleta(key)}
                      className="px-2 py-2 rounded-xl text-[11px] font-bold transition-all text-left"
                      style={paleta === key ? { background: `${pal.accent}20`, border: `1px solid ${pal.accent}50`, color: pal.accent } : { background: '#1a1a1a', border: '1px solid #252525', color: '#666' }}>
                      {pal.nome}
                    </button>
                  ))}
                </div>
              </div>

              {/* Edição rápida */}
              <div>
                <label className="text-[10px] text-zinc-600 font-bold mb-1.5 block tracking-widest">EDITAR TEXTOS</label>
                <div className="space-y-2">
                  {[['headline','Headline'], ['subheadline','Subheadline'], ['destaque','Destaque'], ['tag','Tag'], ['cta','CTA'], ['emoji_principal','Emoji']].map(([k, l]) => (
                    <div key={k}>
                      <div className="text-[9px] text-zinc-700 mb-0.5 tracking-widest">{l.toUpperCase()}</div>
                      <input className={IC} style={IS} value={dados[k] || ''} onChange={e => setDados(p => ({ ...p, [k]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ABA EDITAR ── */}
          {aba === 'editar' && (
            <div className="rounded-2xl p-4 space-y-4" style={{ background: '#111', border: '1px solid #1e1e1e' }}>

              {/* Visibilidade dos elementos */}
              <div>
                <label className="text-[10px] text-zinc-600 font-bold mb-2 block tracking-widest">👁 VISIBILIDADE</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[['showTag','Tag'],['showEmoji','Emoji'],['showDestaque','Destaque'],['showSub','Subtitle'],['showCta','CTA'],['showRestaurante','Logo']].map(([k,l]) => (
                    <button key={k} onClick={() => { pushHistory(); setCf(k, !cfg[k]); }}
                      className="py-2 rounded-xl text-[11px] font-bold transition-all"
                      style={cfg[k] !== false ? { background:'rgba(var(--accent-rgb),0.1)', border:'1px solid rgba(var(--accent-rgb),0.25)', color:'var(--accent)' } : { background:'#1a1a1a', border:'1px solid #252525', color:'#444' }}>
                      {cfg[k] !== false ? '●' : '○'} {l}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ height:1, background:'#1e1e1e' }} />

              {/* Cor customizada */}
              <div>
                <label className="text-[10px] text-zinc-600 font-bold mb-2 block tracking-widest">🎨 COR DE DESTAQUE</label>
                <div className="flex gap-2 items-center">
                  <input type="color" value={cfg.accentOverride || PALETAS[paleta].accent}
                    onChange={e => { pushHistory(); setCf('accentOverride', e.target.value); }}
                    className="w-10 h-10 rounded-xl cursor-pointer border-0 bg-transparent"
                    style={{ padding:2 }} />
                  <div className="flex-1 grid grid-cols-4 gap-1">
                    {['var(--accent)','#ef4444','#d4a017','#0ea5e9','#16a34a','#9333ea','#ec4899','#e5e5e5'].map(c => (
                      <button key={c} onClick={() => { pushHistory(); setCf('accentOverride', c); }}
                        className="w-full h-7 rounded-lg transition-all"
                        style={{ background:c, outline: cfg.accentOverride===c ? `2px solid #fff` : 'none', outlineOffset:1 }} />
                    ))}
                  </div>
                  {cfg.accentOverride && <button onClick={() => setCf('accentOverride','')} className="text-xs text-zinc-600 hover:text-white px-1">✕</button>}
                </div>
              </div>

              <div style={{ height:1, background:'#1e1e1e' }} />

              {/* Escala da fonte */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] text-zinc-600 font-bold tracking-widest">🔡 TAMANHO DA FONTE</label>
                  <span className="text-[11px] font-bold text-orange-400">{Math.round(cfg.fontScale*100)}%</span>
                </div>
                <input type="range" min="60" max="150" step="5" value={Math.round(cfg.fontScale*100)}
                  onChange={e => setCf('fontScale', e.target.value/100)}
                  className="w-full accent-orange-500" style={{ accentColor:'var(--accent)' }} />
                <div className="flex justify-between text-[9px] text-zinc-700 mt-1">
                  <span>60%</span><span>100%</span><span>150%</span>
                </div>
              </div>

              {/* Overlay foto */}
              {bgImage && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] text-zinc-600 font-bold tracking-widest">🌑 ESCURECIMENTO DA FOTO</label>
                    <span className="text-[11px] font-bold text-orange-400">{Math.round((cfg.overlayAlpha??0.75)*100)}%</span>
                  </div>
                  <input type="range" min="0" max="95" step="5" value={Math.round((cfg.overlayAlpha??0.75)*100)}
                    onChange={e => setCf('overlayAlpha', e.target.value/100)}
                    className="w-full" style={{ accentColor:'var(--accent)' }} />
                </div>
              )}

              <div style={{ height:1, background:'#1e1e1e' }} />

              {/* Padrão de fundo */}
              <div>
                <label className="text-[10px] text-zinc-600 font-bold mb-2 block tracking-widest">✦ PADRÃO DE FUNDO</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[['none','Nenhum'],['dots','Pontos'],['grid','Grade'],['lines','Linhas'],['diagonal','Diagonal'],['circles','Círculos']].map(([v,l]) => (
                    <button key={v} onClick={() => setCf('bgPattern', v)}
                      className="py-2 rounded-xl text-[11px] font-bold transition-all"
                      style={cfg.bgPattern===v ? { background:'rgba(var(--accent-rgb),0.1)', border:'1px solid rgba(var(--accent-rgb),0.25)', color:'var(--accent)' } : { background:'#1a1a1a', border:'1px solid #252525', color:'#666' }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ height:1, background:'#1e1e1e' }} />

              {/* Badge overlay */}
              <div>
                <label className="text-[10px] text-zinc-600 font-bold mb-2 block tracking-widest">🏷 BADGE / ETIQUETA</label>
                <div className="grid grid-cols-3 gap-1 mb-2">
                  {['NOVO','PROMO','50% OFF','EXCLUSIVO','LIMITED','GRÁTIS','HOT 🔥','⭐ TOP','VIP'].map(b => (
                    <button key={b} onClick={() => setCf('badge', cfg.badge===b ? '' : b)}
                      className="py-1.5 rounded-lg text-[10px] font-bold transition-all"
                      style={cfg.badge===b ? { background:'rgba(var(--accent-rgb),0.15)', border:'1px solid rgba(var(--accent-rgb),0.3)', color:'var(--accent)' } : { background:'#1a1a1a', border:'1px solid #1e1e1e', color:'#555' }}>
                      {b}
                    </button>
                  ))}
                </div>
                <input className="w-full px-3 py-2 rounded-xl text-xs outline-none mb-2" style={{ background:'#1a1a1a', border:'1px solid #252525', color:'#fff' }}
                  placeholder="Texto customizado do badge..." value={cfg.badge} onChange={e => setCf('badge', e.target.value)} />
                {cfg.badge && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[9px] text-zinc-700 mb-1 tracking-widest">POSIÇÃO</div>
                      <select className="w-full px-2 py-1.5 rounded-xl text-xs outline-none" style={{ background:'#1a1a1a', border:'1px solid #252525', color:'#fff' }}
                        value={cfg.badgePos} onChange={e => setCf('badgePos', e.target.value)}>
                        <option value="top-left">↖ Topo esq.</option>
                        <option value="top-right">↗ Topo dir.</option>
                        <option value="top-center">⬆ Topo centro</option>
                        <option value="bottom-left">↙ Baixo esq.</option>
                        <option value="bottom-right">↘ Baixo dir.</option>
                      </select>
                    </div>
                    <div>
                      <div className="text-[9px] text-zinc-700 mb-1 tracking-widest">FORMA</div>
                      <select className="w-full px-2 py-1.5 rounded-xl text-xs outline-none" style={{ background:'#1a1a1a', border:'1px solid #252525', color:'#fff' }}
                        value={cfg.badgeShape} onChange={e => setCf('badgeShape', e.target.value)}>
                        <option value="circle">Círculo</option>
                        <option value="pill">Pílula</option>
                        <option value="ribbon">Faixa</option>
                        <option value="tag">Tag</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[9px] text-zinc-700 mb-1 tracking-widest">COR</div>
                      <div className="flex gap-1.5">
                        {['#ef4444','var(--accent)','#eab308','#22c55e','#3b82f6','#9333ea','#ec4899','#000'].map(c => (
                          <button key={c} onClick={() => setCf('badgeColor', c)}
                            className="flex-1 h-6 rounded-lg"
                            style={{ background:c, outline:cfg.badgeColor===c?'2px solid #fff':'none', outlineOffset:1 }} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ height:1, background:'#1e1e1e' }} />

              {/* Logo */}
              <div>
                <label className="text-[10px] text-zinc-600 font-bold mb-2 block tracking-widest">🏢 LOGO DO RESTAURANTE</label>
                <input ref={logoRef} type="file" accept="image/*" onChange={onLogo} className="hidden" />
                <div className="flex gap-2">
                  <button onClick={() => logoRef.current?.click()}
                    className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                    style={cfg.logo ? { background:'rgba(var(--accent-rgb),0.12)', border:'1px solid rgba(var(--accent-rgb),0.3)', color:'var(--accent)' } : { background:'#1a1a1a', border:'1px solid #252525', color:'#888' }}>
                    {cfg.logo ? '✓ Logo carregado' : '📁 Carregar logo'}
                  </button>
                  {cfg.logo && <button onClick={() => setCf('logo',null)} className="w-9 rounded-xl text-sm" style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'#ef4444' }}>✕</button>}
                </div>
                {cfg.logo && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div>
                      <div className="text-[9px] text-zinc-700 mb-1 tracking-widest">POSIÇÃO</div>
                      <select className="w-full px-2 py-1.5 rounded-xl text-xs outline-none" style={{ background:'#1a1a1a', border:'1px solid #252525', color:'#fff' }}
                        value={cfg.logoPos} onChange={e => setCf('logoPos', e.target.value)}>
                        <option value="top-left">↖ Topo esq.</option>
                        <option value="top-right">↗ Topo dir.</option>
                        <option value="bottom-left">↙ Baixo esq.</option>
                        <option value="bottom-right">↘ Baixo dir.</option>
                        <option value="center">⊙ Centro</option>
                      </select>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1"><span className="text-[9px] text-zinc-700 tracking-widest">TAMANHO</span><span className="text-[10px] text-orange-400">{cfg.logoSize}px</span></div>
                      <input type="range" min="60" max="300" step="20" value={cfg.logoSize}
                        onChange={e => setCf('logoSize', Number(e.target.value))}
                        className="w-full" style={{ accentColor:'var(--accent)' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Undo */}
              {history.length > 0 && (
                <button onClick={undo} className="w-full py-2 rounded-xl text-xs font-bold transition-all"
                  style={{ background:'rgba(255,255,255,0.04)', border:'1px solid #1e1e1e', color:'#555' }}>
                  ↩ Desfazer ({history.length})
                </button>
              )}
            </div>
          )}

          {/* ── ABA LEGENDA ── */}
          {aba === 'legenda' && (
            <div className="rounded-2xl p-4 space-y-3" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
              {!dados.legenda
                ? <div className="text-center py-10"><div className="text-4xl mb-2">📝</div><p className="text-zinc-600 text-sm">Gere com IA primeiro</p></div>
                : <>
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-[10px] text-zinc-600 font-bold tracking-widest">LEGENDA</label>
                      <button onClick={() => setDados(p => ({ ...p, legenda: '' }))} className="text-[10px] text-zinc-700">limpar</button>
                    </div>
                    <textarea className={IC} style={{ ...IS, minHeight: 140, resize: 'vertical', lineHeight: 1.55, fontSize: 12 }}
                      value={dados.legenda} onChange={e => setDados(p => ({ ...p, legenda: e.target.value }))} />
                  </div>
                  {dados.hashtags?.length > 0 && (
                    <div>
                      <label className="text-[10px] text-zinc-600 font-bold mb-1.5 block tracking-widest">HASHTAGS ({dados.hashtags.length})</label>
                      <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                        {dados.hashtags.map((h, i) => (
                          <span key={i} className="text-[10px] px-2 py-0.5 rounded-lg" style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>#{h}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={copiar}
                    className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                    style={{ background: legendaCopied ? 'rgba(34,197,94,0.12)' : 'rgba(var(--accent-rgb),0.1)', border: legendaCopied ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(var(--accent-rgb),0.2)', color: legendaCopied ? '#22c55e' : 'var(--accent)' }}>
                    {legendaCopied ? '✓ Copiado!' : '📋 Copiar legenda + hashtags'}
                  </button>
                </>
              }
            </div>
          )}
        </div>

        {/* ── Direito: Preview ── */}
        <div className="flex-1 flex flex-col items-center gap-4">

          {/* Visualização toggle */}
          <div className="flex gap-2">
            {[{ v: false, l: '🖼 Criativo' }, { v: true, l: '📱 No Instagram' }].map(({ v, l }) => (
              <button key={String(v)} onClick={() => setFrameIG(v)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
                style={frameIG === v ? { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.3)' } : { background: '#111', color: '#555', border: '1px solid #1e1e1e' }}>
                {l}
              </button>
            ))}
          </div>

          {/* Preview */}
          <Preview template={template} paleta={paleta} paletaAtiva={paletaAtiva} dados={dadosVisiveis}
            restaurante={restaurante} bgImage={bgImage} formato={formato} frameIG={frameIG}
            previewRef={previewRef} onZoom={() => setZoom(true)} cfg={cfg} />

          {zoom && (
            <ModalZoom template={template} paleta={paleta} paletaAtiva={paletaAtiva} dados={dadosVisiveis}
              restaurante={restaurante} bgImage={bgImage} formato={formato} frameIG={frameIG}
              onClose={() => setZoom(false)} cfg={cfg} />
          )}

          {/* Ações */}
          <div className="flex flex-col gap-2 w-full max-w-[340px]">

            {/* Export principal */}
            <button onClick={() => exportar()} disabled={exportando}
              className="w-full py-4 rounded-2xl font-black text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
              style={{ background: exportando ? '#1a1a1a' : 'linear-gradient(135deg,var(--accent),var(--accent-2))', color: exportando ? '#555' : '#000', boxShadow: exportando ? 'none' : '0 8px 30px rgba(var(--accent-rgb),0.4)', opacity: exportando ? 0.7 : 1 }}>
              {exportando ? <><span className="animate-spin inline-block">⟳</span> Exportando...</> : `⬇️ Baixar PNG — ${cfg.exportRatio}`}
            </button>

            {/* Export formatos */}
            <div className="rounded-xl p-2" style={{ background:'#111', border:'1px solid #1e1e1e' }}>
              <div className="text-[9px] text-zinc-700 font-bold tracking-widest text-center mb-1.5">EXPORTAR EM OUTRO FORMATO</div>
              <div className="grid grid-cols-4 gap-1">
                {[['1:1','Post','1080×1080'],['4:5','Feed','1080×1350'],['9:16','Story','1080×1920'],['16:9','Wide','1920×1080']].map(([r,l,dim]) => (
                  <button key={r} onClick={() => { setCf('exportRatio',r); exportar(r); }} disabled={exportando}
                    className="py-2 rounded-lg text-center transition-all"
                    style={cfg.exportRatio===r ? { background:'rgba(var(--accent-rgb),0.12)', border:'1px solid rgba(var(--accent-rgb),0.25)' } : { background:'#1a1a1a', border:'1px solid #1e1e1e' }}>
                    <div className="text-[11px] font-black" style={{ color: cfg.exportRatio===r ? 'var(--accent)' : '#888' }}>{l}</div>
                    <div className="text-[9px]" style={{ color:'#444' }}>{r}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => gerar()} disabled={gerando}
                className="py-2.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: '#111', border: '1px solid #1e1e1e', color: '#888' }}>
                {gerando ? '⟳' : '🤖'} IA
              </button>
              <button onClick={() => { const k = TEMPLATES.map(t => t.id); setTemplate(k[(k.indexOf(template)+1)%k.length]); }}
                className="py-2.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: '#111', border: '1px solid #1e1e1e', color: '#888' }}>
                🔀 Template
              </button>
              <button onClick={() => { const k = Object.keys(PALETAS); setPaleta(k[(k.indexOf(paleta)+1)%k.length]); }}
                className="py-2.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: '#111', border: '1px solid #1e1e1e', color: '#888' }}>
                🎨 Paleta
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
