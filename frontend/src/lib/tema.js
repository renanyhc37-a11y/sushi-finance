// ──────────────────────────────────────────────────────────────
//  Cor de destaque personalizável (identidade visual por restaurante)
//  Aplica a cor escolhida nas variáveis CSS que o painel e o cardápio
//  consomem (--accent / --accent-2 / --accent-soft / --brand-*).
//  A cor vem do banco (GET /api/cardapio/config → cor_destaque) e é
//  cacheada no localStorage para aplicar instantâneo no próximo load
//  (sem "piscar" o laranja antes de buscar do servidor).
// ──────────────────────────────────────────────────────────────

export const COR_PADRAO = '#f97316';

function hexToRgb(hex) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec((hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  const h = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

// Clareia/escurece uma cor (amt: -1..1). Usado para gerar a escala brand-*.
function ajustar(hex, amt) {
  const c = hexToRgb(hex);
  if (!c) return hex;
  const f = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  return rgbToHex(c.r + (f - c.r) * p, c.g + (f - c.g) * p, c.b + (f - c.b) * p);
}

export function corValida(hex) {
  return !!hexToRgb(hex);
}

// Aplica a cor de destaque nas variáveis CSS do documento.
export function aplicarCorDestaque(hex) {
  const c = hexToRgb(hex);
  if (!c) return;
  const el = document.documentElement;
  el.style.setProperty('--accent', hex);
  el.style.setProperty('--accent-2', ajustar(hex, 0.12)); // tom levemente mais claro p/ gradientes
  el.style.setProperty('--accent-soft', `rgba(${c.r},${c.g},${c.b},0.12)`);
  el.style.setProperty('--accent-rgb', `${c.r}, ${c.g}, ${c.b}`);
  // Escala "brand-*" (caso algum componente use as classes Tailwind brand)
  const escala = { 50: 0.92, 100: 0.84, 200: 0.66, 300: 0.46, 400: 0.24, 500: 0, 600: -0.12, 700: -0.26, 800: -0.4, 900: -0.52 };
  for (const [k, amt] of Object.entries(escala)) el.style.setProperty(`--brand-${k}`, ajustar(hex, amt));
}

// Lê do cache (instantâneo) e aplica. Chamado bem cedo no boot.
export function aplicarCorCacheada() {
  try {
    const c = localStorage.getItem('cor_destaque');
    if (c && corValida(c)) aplicarCorDestaque(c);
  } catch {}
}

// Salva no cache local (p/ aplicar instantâneo no próximo load).
export function cachearCor(hex) {
  try { if (corValida(hex)) localStorage.setItem('cor_destaque', hex); } catch {}
}
