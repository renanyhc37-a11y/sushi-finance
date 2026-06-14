// ═══════════════════════════════════════════════════════════════
// Canvas Export — renderiza templates diretamente na Canvas API
// Sem html2canvas: qualidade nativa, sem artefatos de DOM→Canvas
// ═══════════════════════════════════════════════════════════════

const F = "'Segoe UI', Arial, sans-serif";

// ── helpers ────────────────────────────────────────────────────
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // silencia erro
    img.src = src;
  });
}

function drawCoverImage(ctx, img, W, H) {
  if (!img) return;
  const scale = Math.max(W / img.width, H / img.height);
  const sw = img.width * scale, sh = img.height * scale;
  ctx.drawImage(img, (W - sw) / 2, (H - sh) / 2, sw, sh);
}

function overlay(ctx, W, H, alpha, cfgAlpha) {
  // cfgAlpha overrides template default when set
  const a = (cfgAlpha !== null && cfgAlpha !== undefined) ? cfgAlpha : alpha;
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.fillRect(0, 0, W, H);
}

function radialGrad(ctx, p, W, H) {
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * 0.2, H * 0.2, 0, W * 0.2, H * 0.2, W * 1.2);
  g.addColorStop(0, p.g1 + 'f0');
  g.addColorStop(1, p.bg + '00');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function txt(ctx, text, x, y, size, color, align = 'left', weight = '900', alpha = 1, font = F) {
  if (!text) return;
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
  ctx.globalAlpha = 1;
}

// word-wrap e retorna altura total usada
function txtWrap(ctx, text, x, y, size, color, maxW, lh = 1.2, align = 'left', weight = '900') {
  if (!text) return 0;
  ctx.font = `${weight} ${size}px ${F}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  const words = text.split(' ');
  let line = '', ty = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, ty);
      ty += size * lh;
      line = w;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, ty);
  return ty + size - y;
}

function hline(ctx, x1, x2, y, color, w = 2, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
  ctx.globalAlpha = 1;
}

function gradHline(ctx, x1, x2, y, color, w = 2) {
  const g = ctx.createLinearGradient(x1, 0, x2, 0);
  g.addColorStop(0, 'transparent');
  g.addColorStop(0.5, color);
  g.addColorStop(1, 'transparent');
  ctx.strokeStyle = g;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
}

function pill(ctx, label, cx, cy, color, textColor, padX, padY, fontSize, radius = 100) {
  ctx.font = `900 ${fontSize}px ${F}`;
  const tw = ctx.measureText(label).width;
  const bw = tw + padX * 2, bh = fontSize + padY * 2;
  const bx = cx - bw / 2, by = cy - bh / 2;
  roundRect(ctx, bx, by, bw, bh, radius, color);
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy + 1);
}

function roundRect(ctx, x, y, w, h, r, fill, stroke, sw = 2) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = sw; ctx.stroke(); }
}

function linearGrad(ctx, x0, y0, x1, y1, c0, c1) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  g.addColorStop(0, c0); g.addColorStop(1, c1); return g;
}

function circle(ctx, cx, cy, r, fill, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  ctx.globalAlpha = 1;
}

// emoji on canvas
function emoji(ctx, e, x, y, size) {
  if (!e) return;
  ctx.font = `${size}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(e, x, y);
}

// divider with dot
function divider(ctx, W, y, accent, lineAlpha = 0.3) {
  const half = W * 0.3;
  const cx = W / 2;
  ctx.globalAlpha = lineAlpha;
  gradHline(ctx, cx - half, cx - 8, y, accent, 1.5);
  gradHline(ctx, cx + 8, cx + half, y, accent, 1.5);
  ctx.globalAlpha = 1;
  circle(ctx, cx, y, 4, accent, 0.8);
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE DRAWERS
// ═══════════════════════════════════════════════════════════════

async function drawLuxo(ctx, d, p, restaurante, bgImg, W, H, fscale = 1, cfgAlpha = null) {
  const S = H > W;
  const pad = S ? 90 : 70;
  const f = fscale;
  if (bgImg) { drawCoverImage(ctx, bgImg, W, H); overlay(ctx, W, H, 0.72, cfgAlpha); }
  else radialGrad(ctx, p, W, H);

  // Frame lines
  const fi = S ? 36 : 28;
  ctx.strokeStyle = p.accent + '44'; ctx.lineWidth = 1.5;
  ctx.strokeRect(fi, fi, W - fi * 2, H - fi * 2);
  ctx.strokeStyle = p.accent + '18'; ctx.lineWidth = 1;
  ctx.strokeRect(fi + 12, fi + 12, W - (fi + 12) * 2, H - (fi + 12) * 2);

  // Top
  txt(ctx, restaurante.toUpperCase(), W / 2, pad, S ? 22 : 18, p.accent, 'center', '700');
  gradHline(ctx, W * 0.3, W * 0.7, pad + (S ? 34 : 28), p.accent, 1);
  if (d.tag) txt(ctx, d.tag, W / 2, pad + (S ? 50 : 42), S ? 20 : 16, p.accent + '99', 'center', '400');

  // Emoji
  const ey = S ? H * 0.42 : H * 0.38;
  if (!bgImg) emoji(ctx, d.emoji_principal || '🍣', W / 2, ey - (S ? 130 : 100), S ? 160 : 120);

  // Headline
  const hy = bgImg ? H * 0.38 : ey + (S ? 40 : 30);
  const hl = (d.headline || 'SUSHI PREMIUM').toUpperCase();
  ctx.font = `900 ${S ? 110 : 82}px ${F}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(hl, W / 2, hy);
  const hlH = S ? 110 : 82;

  // Divider
  divider(ctx, W, hy + hlH + (S ? 30 : 22), p.accent);

  // Subheadline
  txt(ctx, d.subheadline, W / 2, hy + hlH + (S ? 68 : 50), S ? 34 : 26, p.sub + 'cc', 'center', '400');

  // Destaque
  if (d.destaque) txt(ctx, d.destaque, W / 2, hy + hlH + (S ? 130 : 94), S ? 64 : 48, p.accent, 'center', '900');

  // Bottom CTA
  const cy = H - pad - (S ? 20 : 16);
  pill(ctx, d.cta || 'Pedir agora', W / 2, cy, p.accent, '#000', S ? 44 : 34, S ? 18 : 14, S ? 26 : 20);
  txt(ctx, 'DELIVERY PREMIUM', pad + 10, cy - 10, S ? 16 : 12, p.accent + '55', 'left', '400');
}

async function drawNeon(ctx, d, p, restaurante, bgImg, W, H, fscale = 1, cfgAlpha = null) {
  const S = H > W;
  const pad = S ? 80 : 58;
  if (bgImg) { drawCoverImage(ctx, bgImg, W, H); overlay(ctx, W, H, 0.82, cfgAlpha); }
  else { ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H); }

  // Grid
  if (!bgImg) {
    ctx.strokeStyle = p.accent + '18'; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  }

  // Tag top
  txt(ctx, (d.tag || '⚡ ESPECIAL').toUpperCase(), pad, pad, S ? 22 : 18, p.accent, 'left', '900');
  txt(ctx, restaurante, W - pad, pad, S ? 20 : 16, p.accent + '88', 'right', '400');

  // Emoji with glow
  if (!bgImg) {
    ctx.shadowColor = p.accent; ctx.shadowBlur = 60;
    emoji(ctx, d.emoji_principal || '🍣', W / 2, S ? H * 0.38 : H * 0.36, S ? 180 : 140);
    ctx.shadowBlur = 0;
  }

  // Headline with glow
  ctx.shadowColor = p.accent; ctx.shadowBlur = 40;
  const hy = bgImg ? H * 0.38 : (S ? H * 0.55 : H * 0.53);
  ctx.font = `900 ${S ? 116 : 88}px ${F}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((d.headline || 'SUSHI').toUpperCase(), W / 2, hy);
  ctx.shadowBlur = 0;

  // Neon line
  ctx.shadowColor = p.accent; ctx.shadowBlur = 20;
  hline(ctx, W * 0.2, W * 0.8, hy + (S ? 80 : 62), p.accent, 3);
  ctx.shadowBlur = 0;

  txt(ctx, d.subheadline, W / 2, hy + (S ? 102 : 78), S ? 32 : 26, p.accent + 'cc', 'center', '400');

  // Destaque box
  if (d.destaque) {
    const dy = hy + (S ? 175 : 135);
    ctx.shadowColor = p.accent; ctx.shadowBlur = 24;
    roundRect(ctx, W / 2 - (S ? 160 : 120), dy, S ? 320 : 240, S ? 80 : 60, S ? 20 : 14, 'transparent', p.accent, 2);
    ctx.shadowBlur = 0;
    ctx.shadowColor = p.accent; ctx.shadowBlur = 16;
    txt(ctx, d.destaque, W / 2, dy + (S ? 14 : 8), S ? 52 : 40, p.accent, 'center', '900');
    ctx.shadowBlur = 0;
  }

  // CTA
  const cy = H - pad - (S ? 10 : 8);
  const ctaGrad = linearGrad(ctx, W / 2 - 100, 0, W / 2 + 100, 0, p.accent, p.sub);
  ctx.shadowColor = p.accent; ctx.shadowBlur = 30;
  pill(ctx, d.cta || 'Pedir agora ⚡', W / 2, cy, ctaGrad, '#000', S ? 50 : 38, S ? 18 : 14, S ? 26 : 20);
  ctx.shadowBlur = 0;
}

async function drawBold(ctx, d, p, restaurante, bgImg, W, H, fscale = 1, cfgAlpha = null) {
  const S = H > W;
  const pad = S ? 72 : 52;
  if (bgImg) { drawCoverImage(ctx, bgImg, W, H); overlay(ctx, W, H, 0.75, cfgAlpha); }
  else radialGrad(ctx, p, W, H);

  const hl = (d.headline || 'SUSHI PREMIUM').toUpperCase();
  const words = hl.split(' ');
  const w1 = words[0] || 'SUSHI';
  const w2 = words.slice(1).join(' ') || 'PREMIUM';

  const fy = S ? H * 0.38 : H * 0.35;
  const fs = S ? 200 : 148;

  // linha 1 — texto branco
  ctx.font = `900 ${fs}px ${F}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(w1, pad, fy);

  // linha 2 — com fundo colorido
  const w2m = ctx.measureText(w2).width;
  const bh = fs * 1.05;
  const g = linearGrad(ctx, pad, 0, pad + w2m + 20, 0, p.accent, p.sub);
  ctx.fillStyle = g;
  ctx.fillRect(pad - 8, fy + fs + 8, w2m + 24, bh);
  ctx.fillStyle = '#000';
  ctx.fillText(w2, pad, fy + fs + 8);

  // Top label
  txt(ctx, restaurante.toUpperCase(), pad, pad, S ? 20 : 16, p.accent + '99', 'left', '400');
  if (d.tag) txt(ctx, d.tag, W - pad, pad, S ? 20 : 16, p.accent, 'right', '900');

  // Sub + destaque
  const sy = fy + fs * 2 + (S ? 50 : 36);
  txt(ctx, d.subheadline, pad, sy, S ? 32 : 26, 'rgba(255,255,255,0.55)', 'left', '400');
  if (d.destaque) txt(ctx, d.destaque, pad, sy + (S ? 54 : 42), S ? 60 : 44, p.accent, 'left', '900');

  // CTA bottom-right
  pill(ctx, d.cta || 'Peça agora', W - pad, H - pad - (S ? 10 : 8), p.accent, '#000', S ? 44 : 34, S ? 18 : 14, S ? 26 : 20);
}

async function drawMagazine(ctx, d, p, restaurante, bgImg, W, H, fscale = 1, cfgAlpha = null) {
  const S = H > W;
  const pad = S ? 60 : 44;
  if (bgImg) { drawCoverImage(ctx, bgImg, W, H); overlay(ctx, W, H, 0.78, cfgAlpha); }
  else radialGrad(ctx, p, W, H);

  // Header bar
  const hbh = S ? 70 : 52;
  ctx.fillStyle = p.accent;
  ctx.fillRect(0, 0, W, hbh);
  txt(ctx, restaurante.toUpperCase(), pad, hbh / 2 - (S ? 14 : 10), S ? 32 : 24, '#000', 'left', '900');
  const hoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  txt(ctx, `EDIÇÃO ESPECIAL  •  ${hoje}`, W - pad, hbh / 2 - (S ? 14 : 10), S ? 18 : 14, '#000', 'right', '700');

  // Tag
  if (d.tag) {
    const ty = hbh + (S ? 54 : 40);
    txt(ctx, d.tag.toUpperCase(), pad, ty, S ? 22 : 17, p.accent, 'left', '900');
    hline(ctx, pad, pad + (S ? 160 : 120), ty + (S ? 28 : 22), p.accent, 2.5);
  }

  // Emoji
  if (!bgImg) emoji(ctx, d.emoji_principal || '🍣', pad + (S ? 70 : 52), H * (S ? 0.38 : 0.42), S ? 120 : 90);

  // Headline
  const hy = S ? H * 0.44 : H * 0.38;
  ctx.font = `900 ${S ? 100 : 76}px ${F}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const lines = (d.headline || 'SUSHI PREMIUM').toUpperCase().split(' ');
  let yy = hy;
  for (const l of lines) {
    ctx.fillText(l, pad, yy);
    yy += S ? 100 : 76;
  }

  // Accent bar
  ctx.fillStyle = p.accent;
  ctx.fillRect(pad, yy + (S ? 20 : 14), S ? 60 : 44, S ? 6 : 4);

  txt(ctx, d.subheadline, pad, yy + (S ? 46 : 34), S ? 30 : 24, 'rgba(255,255,255,0.65)', 'left', '400');
  if (d.destaque) txt(ctx, d.destaque, pad, yy + (S ? 106 : 78), S ? 60 : 44, p.accent, 'left', '900');

  // Footer bar
  const fbh = S ? 68 : 52;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, H - fbh, W, fbh);
  ctx.strokeStyle = p.accent + '33'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, H - fbh); ctx.lineTo(W, H - fbh); ctx.stroke();

  const emojis = d.emojis_extras || ['📍', '🕐', '🛵'];
  let ex = pad;
  for (const e of emojis.slice(0, 3)) {
    ctx.font = `${S ? 32 : 24}px serif`; ctx.textBaseline = 'middle'; ctx.fillText(e, ex, H - fbh / 2);
    ex += S ? 52 : 40;
  }
  pill(ctx, d.cta || 'Pedir agora', W - pad, H - fbh / 2, p.accent, '#000', S ? 44 : 34, S ? 18 : 12, S ? 24 : 18);
}

async function drawCinema(ctx, d, p, restaurante, bgImg, W, H, fscale = 1, cfgAlpha = null) {
  const S = H > W;
  const pad = S ? 72 : 52;
  if (bgImg) { drawCoverImage(ctx, bgImg, W, H); overlay(ctx, W, H, 0.7, cfgAlpha); }
  else { radialGrad(ctx, p, W, H); overlay(ctx, W, H, 0.2, cfgAlpha); }

  // Vignette radial
  const vg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.8);
  vg.addColorStop(0, 'transparent');
  vg.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // Studio label
  txt(ctx, `${restaurante.toUpperCase()} APRESENTA`, W / 2, pad, S ? 18 : 14, 'rgba(255,255,255,0.35)', 'center', '400');

  // Emoji
  if (!bgImg) emoji(ctx, d.emoji_principal || '🍣', W / 2, S ? H * 0.36 : H * 0.35, S ? 150 : 110);

  // Tag
  if (d.tag) txt(ctx, d.tag.toUpperCase(), W / 2, S ? H * 0.52 : H * 0.51, S ? 22 : 17, p.accent, 'center', '900');

  // Headline
  const hy = bgImg ? H * 0.4 : (S ? H * 0.57 : H * 0.55);
  ctx.font = `900 ${S ? 108 : 82}px ${F}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText((d.headline || 'SUSHI PREMIUM').toUpperCase(), W / 2, hy);

  // Quoted sub
  const qy = hy + (S ? 80 : 60);
  txt(ctx, `"${d.subheadline || 'Uma experiência além do sabor'}"`, W / 2, qy, S ? 30 : 23, 'rgba(255,255,255,0.55)', 'center', '400 italic');

  // Destaque box
  if (d.destaque) {
    const dy = qy + (S ? 80 : 60);
    roundRect(ctx, W / 2 - (S ? 140 : 100), dy, S ? 280 : 200, S ? 68 : 52, S ? 8 : 6, 'transparent', 'rgba(255,255,255,0.25)', 1.5);
    txt(ctx, d.destaque, W / 2, dy + (S ? 12 : 8), S ? 44 : 34, p.accent, 'center', '900');
  }

  // Credits bar
  const cby = H - (S ? 100 : 76);
  hline(ctx, 0, W, cby, 'rgba(255,255,255,0.12)', 1);
  txt(ctx, 'DELIVERY', pad, cby + (S ? 20 : 14), S ? 18 : 14, 'rgba(255,255,255,0.25)', 'left', '400');
  txt(ctx, restaurante, pad, cby + (S ? 46 : 36), S ? 24 : 18, 'rgba(255,255,255,0.55)', 'left', '700');

  const ctaG = linearGrad(ctx, W / 2, 0, W / 2 + 200, 0, p.accent, p.sub);
  pill(ctx, d.cta || 'Pedir agora', W - pad, cby + (S ? 35 : 26), ctaG, '#000', S ? 44 : 34, S ? 18 : 12, S ? 24 : 18);
}

async function drawUrgente(ctx, d, p, restaurante, bgImg, W, H, fscale = 1, cfgAlpha = null) {
  const S = H > W;
  if (bgImg) { drawCoverImage(ctx, bgImg, W, H); overlay(ctx, W, H, 0.8, cfgAlpha); }
  else { radialGrad(ctx, p, W, H); circle(ctx, W * 0.85, H * 0.15, S ? 260 : 200, p.accent + '18'); }

  // Top strip
  const sh = S ? 80 : 60;
  const sg = linearGrad(ctx, 0, 0, W, 0, p.accent, p.sub);
  ctx.fillStyle = sg; ctx.fillRect(0, 0, W, sh);
  emoji(ctx, '🚨', 50, sh / 2, S ? 38 : 28);
  txt(ctx, (d.tag || 'OFERTA RELÂMPAGO').toUpperCase(), 90, sh / 2 - (S ? 16 : 12), S ? 28 : 22, '#000', 'left', '900');

  // Badge circle
  if (d.destaque) {
    const br = S ? 160 : 120;
    const bx = W / 2, by = H * (S ? 0.42 : 0.42);
    const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    bg.addColorStop(0, p.accent); bg.addColorStop(1, p.sub);
    circle(ctx, bx, by, br, bg);
    ctx.fillStyle = '#000';
    ctx.font = `900 ${S ? 72 : 54}px ${F}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(d.destaque, bx, by - (S ? 14 : 10));
    txt(ctx, 'HOJE', bx, by + (S ? 46 : 34), S ? 22 : 17, '#00000088', 'center', '900');
  } else if (!bgImg) {
    emoji(ctx, d.emoji_principal || '🍣', W / 2, H * 0.38, S ? 160 : 120);
  }

  // Headline
  const hy = H * (S ? 0.6 : 0.59);
  ctx.font = `900 ${S ? 90 : 68}px ${F}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText((d.headline || 'OFERTA INSANE').toUpperCase(), W / 2, hy);

  // Divider
  ctx.fillStyle = p.accent;
  ctx.fillRect(W / 2 - (S ? 40 : 30), hy + (S ? 102 : 78), S ? 80 : 60, S ? 6 : 4);

  txt(ctx, d.subheadline, W / 2, hy + (S ? 126 : 96), S ? 28 : 22, 'rgba(255,255,255,0.65)', 'center', '400');

  // Footer
  const fh = S ? 80 : 60;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(0, H - fh, W, fh);
  const pad = S ? 60 : 44;
  txt(ctx, restaurante.toUpperCase(), pad, H - fh + (S ? 24 : 18), S ? 20 : 16, 'rgba(255,255,255,0.35)', 'left', '400');
  pill(ctx, d.cta || 'QUERO! 🔥', W - pad, H - fh / 2, p.accent, '#000', S ? 44 : 34, S ? 18 : 12, S ? 24 : 18);
}

async function drawZen(ctx, d, p, restaurante, bgImg, W, H, fscale = 1, cfgAlpha = null) {
  const S = H > W;
  const pad = S ? 80 : 60;
  if (bgImg) { drawCoverImage(ctx, bgImg, W, H); overlay(ctx, W, H, 0.78, cfgAlpha); }
  else {
    ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
    // Horizontal lines
    for (let y = 0; y < H; y += S ? 76 : 54) {
      hline(ctx, 0, W, y, p.accent + '0a', 1);
    }
    // Side columns
    const sv = ctx.createLinearGradient(0, 0, 0, H);
    sv.addColorStop(0, 'transparent'); sv.addColorStop(0.5, p.accent + '44'); sv.addColorStop(1, 'transparent');
    ctx.strokeStyle = sv; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(S ? 52 : 38, 0); ctx.lineTo(S ? 52 : 38, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W - (S ? 52 : 38), 0); ctx.lineTo(W - (S ? 52 : 38), H); ctx.stroke();
  }

  // Top
  txt(ctx, `— ${restaurante.toUpperCase()} —`, W / 2, pad, S ? 18 : 14, p.accent + '88', 'center', '400');

  // Emoji
  if (!bgImg) emoji(ctx, d.emoji_principal || '🍣', W / 2, S ? H * 0.34 : H * 0.33, S ? 130 : 96);

  // Tag
  if (d.tag) txt(ctx, d.tag.toUpperCase(), W / 2, S ? H * 0.48 : H * 0.46, S ? 18 : 14, p.accent, 'center', '900');

  // Headline
  const hy = S ? H * 0.52 : H * 0.5;
  ctx.font = `900 ${S ? 90 : 68}px ${F}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText((d.headline || 'SUSHI ZEN').toUpperCase(), W / 2, hy);
  const hlH = S ? 90 : 68;

  // Decorative divider
  const dy = hy + hlH + (S ? 28 : 20);
  const dotx = W / 2;
  hline(ctx, dotx - 60, dotx - 12, dy + 6, p.accent, 1.5, 0.8);
  hline(ctx, dotx + 12, dotx + 60, dy + 6, p.accent, 1.5, 0.8);
  txt(ctx, '✦', dotx, dy, S ? 24 : 18, p.accent, 'center', '900');

  txt(ctx, d.subheadline, W / 2, dy + (S ? 50 : 38), S ? 28 : 22, 'rgba(255,255,255,0.55)', 'center', '400');
  if (d.destaque) txt(ctx, d.destaque, W / 2, dy + (S ? 108 : 82), S ? 56 : 42, p.accent, 'center', '900');

  // Bottom CTA
  txt(ctx, d.cta || 'Peça pelo WhatsApp', W / 2, H - pad - (S ? 10 : 6), S ? 22 : 17, p.accent, 'center', '700');
}

async function drawSplit(ctx, d, p, restaurante, bgImg, W, H, fscale = 1, cfgAlpha = null) {
  const S = H > W;
  const pad = S ? 72 : 52;
  if (bgImg) { drawCoverImage(ctx, bgImg, W, H); overlay(ctx, W, H, 0.8, cfgAlpha); }
  else {
    ctx.fillStyle = p.bg; ctx.fillRect(0, 0, W, H);
    // Diagonal block
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(W * 0.62, 0); ctx.lineTo(W * 0.42, H); ctx.lineTo(0, H);
    ctx.closePath();
    const dg = linearGrad(ctx, 0, 0, W * 0.6, H, p.g1, p.bg);
    ctx.fillStyle = dg; ctx.fill();
    ctx.restore();
  }

  // Diagonal line
  ctx.strokeStyle = p.accent + '66'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(W * 0.55, 0); ctx.lineTo(W * 0.35, H); ctx.stroke();

  // Top
  txt(ctx, (d.tag || '').toUpperCase(), pad, pad, S ? 22 : 17, p.accent, 'left', '900');
  txt(ctx, restaurante.toUpperCase(), pad, pad + (S ? 34 : 26), S ? 18 : 14, 'rgba(255,255,255,0.35)', 'left', '400');

  // Emoji top-right
  if (!bgImg) emoji(ctx, d.emoji_principal || '🍣', W * 0.82, S ? 160 : 120, S ? 120 : 88);

  // Big headline
  const hy = S ? H * 0.38 : H * 0.35;
  ctx.font = `900 ${S ? 120 : 90}px ${F}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const words = (d.headline || 'SUSHI PREMIUM').toUpperCase().split(' ');
  let yy = hy;
  for (const w of words) {
    ctx.fillText(w, pad, yy);
    yy += S ? 118 : 88;
  }

  // Accent line + sub
  ctx.fillStyle = linearGrad(ctx, pad, 0, pad + (S ? 100 : 72), 0, p.accent, p.sub);
  ctx.fillRect(pad, yy + (S ? 16 : 12), S ? 100 : 72, S ? 6 : 4);
  txt(ctx, d.subheadline, pad + (S ? 120 : 88), yy + (S ? 8 : 4), S ? 28 : 22, 'rgba(255,255,255,0.55)', 'left', '400');
  if (d.destaque) txt(ctx, d.destaque, pad, yy + (S ? 52 : 40), S ? 64 : 50, p.accent, 'left', '900');

  // Bottom
  const emojis = d.emojis_extras || [];
  let ex = pad; const ey = H - pad - (S ? 4 : 2);
  for (const e of emojis.slice(0, 3)) {
    ctx.font = `${S ? 32 : 24}px serif`; ctx.textBaseline = 'middle'; ctx.fillText(e, ex, ey); ex += S ? 48 : 36;
  }
  const ctaG = linearGrad(ctx, W / 2, 0, W, 0, p.accent, p.sub);
  pill(ctx, d.cta || 'Pedir agora', W - pad, ey, ctaG, '#000', S ? 48 : 36, S ? 18 : 14, S ? 26 : 20);
}

async function drawRetro(ctx, d, p, restaurante, bgImg, W, H, fscale = 1, cfgAlpha = null) {
  const S = H > W;
  const pad = S ? 80 : 60;
  if (bgImg) { drawCoverImage(ctx, bgImg, W, H); overlay(ctx, W, H, 0.75, cfgAlpha); }
  else { radialGrad(ctx, p, W, H); overlay(ctx, W, H, 0.1, cfgAlpha); }

  // Vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.85);
  vg.addColorStop(0.4, 'transparent'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // Double border
  const b1 = S ? 28 : 20, b2 = S ? 42 : 32;
  ctx.strokeStyle = p.accent + '88'; ctx.lineWidth = 3;
  ctx.strokeRect(b1, b1, W - b1 * 2, H - b1 * 2);
  ctx.strokeStyle = p.accent + '33'; ctx.lineWidth = 1;
  ctx.strokeRect(b2, b2, W - b2 * 2, H - b2 * 2);

  // Top banner
  const bw = S ? 320 : 240, bh = S ? 52 : 40;
  ctx.fillStyle = p.accent;
  ctx.fillRect((W - bw) / 2, pad - (S ? 20 : 14), bw, bh);
  txt(ctx, restaurante.toUpperCase(), W / 2, pad - (S ? 8 : 6), S ? 24 : 18, '#000', 'center', '900');

  // Emoji
  if (!bgImg) emoji(ctx, d.emoji_principal || '🍣', W / 2, S ? H * 0.37 : H * 0.36, S ? 130 : 96);

  // Tag
  if (d.tag) txt(ctx, `— ${d.tag} —`, W / 2, S ? H * 0.49 : H * 0.49, S ? 20 : 16, p.accent + '99', 'center', '400 italic');

  // Headline serif-style
  ctx.font = `900 ${S ? 92 : 70}px Georgia, serif`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText((d.headline || 'SUSHI TRADIÇÃO').toUpperCase(), W / 2, S ? H * 0.53 : H * 0.52);
  const hlH = S ? 92 : 70;
  const hy = S ? H * 0.53 : H * 0.52;

  // Decorative divider
  divider(ctx, W, hy + hlH + (S ? 28 : 20), p.accent);

  txt(ctx, d.subheadline, W / 2, hy + hlH + (S ? 70 : 52), S ? 28 : 22, 'rgba(255,255,255,0.6)', 'center', '400 italic');
  if (d.destaque) txt(ctx, d.destaque, W / 2, hy + hlH + (S ? 128 : 96), S ? 56 : 42, p.accent, 'center', '900');

  // Footer
  hline(ctx, W * 0.2, W * 0.8, H - (S ? 110 : 82), p.accent + '44', 1);
  txt(ctx, 'EST. 2024', pad, H - (S ? 86 : 64), S ? 16 : 12, 'rgba(255,255,255,0.25)', 'left', '400');
  roundRect(ctx, W / 2 - (S ? 100 : 76), H - (S ? 88 : 66), S ? 200 : 152, S ? 52 : 40, 3, 'transparent', p.accent, 1.5);
  txt(ctx, d.cta || 'Pedir agora', W / 2, H - (S ? 76 : 56), S ? 28 : 22, p.accent, 'center', '700');
  txt(ctx, 'DELIVERY', W - pad, H - (S ? 86 : 64), S ? 16 : 12, 'rgba(255,255,255,0.25)', 'right', '400');
}

async function drawGradient(ctx, d, p, restaurante, bgImg, W, H, fscale = 1, cfgAlpha = null) {
  const S = H > W;
  const pad = S ? 72 : 52;

  if (bgImg) {
    drawCoverImage(ctx, bgImg, W, H);
    const og = linearGrad(ctx, 0, 0, W, H, p.accent + 'cc', p.bg + 'dd');
    ctx.fillStyle = og; ctx.fillRect(0, 0, W, H);
  } else {
    const g = linearGrad(ctx, 0, 0, W, H, p.g1, p.accent + 'cc');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const g2 = linearGrad(ctx, W, H, 0, 0, p.sub + '22', 'transparent');
    ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
    // Deco circles
    circle(ctx, W * 0.88, H * -0.05, S ? 340 : 260, p.sub + '22');
    circle(ctx, W * -0.1, H * 1.05, S ? 300 : 220, p.accent + '18');
  }

  // Top
  txt(ctx, restaurante.toUpperCase(), pad, pad, S ? 20 : 16, 'rgba(255,255,255,0.75)', 'left', '700');
  if (d.tag) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    const tl = d.tag; ctx.font = `700 ${S ? 22 : 17}px ${F}`;
    const tw = ctx.measureText(tl).width;
    roundRect(ctx, W - pad - tw - (S ? 30 : 22), pad - (S ? 10 : 7), tw + (S ? 30 : 22), S ? 40 : 30, 100, 'rgba(0,0,0,0.22)');
    txt(ctx, tl, W - pad, pad, S ? 22 : 17, '#fff', 'right', '700');
  }

  // Emoji
  if (!bgImg) emoji(ctx, d.emoji_principal || '🍣', W / 2, S ? H * 0.35 : H * 0.34, S ? 160 : 120);

  // Headline
  const hy = bgImg ? H * 0.4 : (S ? H * 0.52 : H * 0.5);
  ctx.font = `900 ${S ? 108 : 82}px ${F}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText((d.headline || 'SUSHI PREMIUM').toUpperCase(), W / 2, hy);

  txt(ctx, d.subheadline, W / 2, hy + (S ? 120 : 92), S ? 32 : 25, 'rgba(255,255,255,0.75)', 'center', '400');

  // Destaque glassmorphism
  if (d.destaque) {
    const dy = hy + (S ? 180 : 138);
    const dw = S ? 320 : 240, dh = S ? 80 : 60;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    roundRect(ctx, (W - dw) / 2, dy, dw, dh, S ? 24 : 18, 'rgba(255,255,255,0.15)');
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect((W - dw) / 2, dy, dw, dh, S ? 24 : 18); ctx.stroke(); }
    txt(ctx, d.destaque, W / 2, dy + (S ? 14 : 10), S ? 52 : 40, '#fff', 'center', '900');
  }

  // CTA glass
  pill(ctx, d.cta || 'Pedir agora ✨', W / 2, H - pad - (S ? 14 : 10), 'rgba(255,255,255,0.2)', '#fff', S ? 52 : 40, S ? 20 : 15, S ? 26 : 20);
}

async function drawFrame(ctx, d, p, restaurante, bgImg, W, H, fscale = 1, cfgAlpha = null) {
  const S = H > W;
  const pad = S ? 90 : 68;
  if (bgImg) { drawCoverImage(ctx, bgImg, W, H); overlay(ctx, W, H, 0.78, cfgAlpha); }
  else radialGrad(ctx, p, W, H);

  // Outer frame
  ctx.strokeStyle = p.accent; ctx.lineWidth = 2.5;
  ctx.strokeRect(S ? 26 : 18, S ? 26 : 18, W - (S ? 52 : 36), H - (S ? 52 : 36));
  ctx.strokeStyle = p.accent + '44'; ctx.lineWidth = 1;
  ctx.strokeRect(S ? 40 : 28, S ? 40 : 28, W - (S ? 80 : 56), H - (S ? 80 : 56));

  // Corner ornaments
  const cs = S ? 28 : 20, co = S ? 10 : 7;
  const corners = [[co, co], [W - co, co], [co, H - co], [W - co, H - co]];
  ctx.strokeStyle = p.accent; ctx.lineWidth = 3;
  for (const [cx, cy] of corners) {
    const sx = cx === co ? 1 : -1, sy = cy === co ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(cx + sx * cs, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * cs);
    ctx.stroke();
  }

  // Top
  txt(ctx, `✦  ${restaurante.toUpperCase()}  ✦`, W / 2, pad, S ? 18 : 14, p.accent, 'center', '700');
  gradHline(ctx, W * 0.25, W * 0.75, pad + (S ? 32 : 24), p.accent, 1);
  if (d.tag) txt(ctx, d.tag, W / 2, pad + (S ? 52 : 40), S ? 20 : 16, p.accent + '99', 'center', '400 italic');

  // Emoji
  if (!bgImg) emoji(ctx, d.emoji_principal || '🍣', W / 2, S ? H * 0.38 : H * 0.37, S ? 130 : 96);

  // Headline
  const hy = S ? H * 0.49 : H * 0.47;
  ctx.font = `900 ${S ? 94 : 72}px ${F}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText((d.headline || 'SUSHI PREMIUM').toUpperCase(), W / 2, hy);
  const hlH = S ? 94 : 72;

  // Divider ❖
  const divy = hy + hlH + (S ? 24 : 18);
  hline(ctx, W * 0.3, W * 0.44, divy + 10, p.accent, 1.5, 0.6);
  hline(ctx, W * 0.56, W * 0.7, divy + 10, p.accent, 1.5, 0.6);
  txt(ctx, '❖', W / 2, divy, S ? 28 : 22, p.accent, 'center', '400');

  txt(ctx, d.subheadline, W / 2, divy + (S ? 52 : 40), S ? 28 : 22, 'rgba(255,255,255,0.55)', 'center', '400');
  if (d.destaque) txt(ctx, d.destaque, W / 2, divy + (S ? 110 : 84), S ? 56 : 42, p.accent, 'center', '900');

  // Bottom
  gradHline(ctx, W * 0.25, W * 0.75, H - (S ? 116 : 88), p.accent, 1);
  roundRect(ctx, (W - (S ? 240 : 180)) / 2, H - (S ? 104 : 78), S ? 240 : 180, S ? 52 : 40, 3, 'transparent', p.accent, 1.5);
  txt(ctx, (d.cta || 'Pedir agora').toUpperCase(), W / 2, H - (S ? 92 : 68), S ? 26 : 20, p.accent, 'center', '700');
}

async function drawDark(ctx, d, p, restaurante, bgImg, W, H, fscale = 1, cfgAlpha = null) {
  const S = H > W;
  const pad = S ? 72 : 52;
  ctx.fillStyle = '#030303'; ctx.fillRect(0, 0, W, H);
  if (bgImg) { drawCoverImage(ctx, bgImg, W, H); overlay(ctx, W, H, 0.78, cfgAlpha); }
  else {
    // Focal glow
    const fg = ctx.createRadialGradient(W / 2, H * 0.45, 0, W / 2, H * 0.45, W * 0.7);
    fg.addColorStop(0, p.accent + '12'); fg.addColorStop(1, 'transparent');
    ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
  }

  // Top/bottom lines
  gradHline(ctx, 0, W, 0, p.accent + '88', 1.5);
  gradHline(ctx, 0, W, H - 1, p.accent + '88', 1.5);

  // Top
  txt(ctx, restaurante.toUpperCase(), pad, pad, S ? 18 : 14, '#333', 'left', '400');
  if (d.tag) txt(ctx, d.tag, W - pad, pad, S ? 18 : 14, p.accent, 'right', '700');

  // Emoji
  if (!bgImg) emoji(ctx, d.emoji_principal || '🍣', W / 2, S ? H * 0.35 : H * 0.34, S ? 150 : 112);

  // Headline
  const hy = bgImg ? H * 0.38 : (S ? H * 0.52 : H * 0.5);
  ctx.font = `900 ${S ? 106 : 80}px ${F}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText((d.headline || 'SUSHI PREMIUM').toUpperCase(), W / 2, hy);
  const hlH = S ? 106 : 80;

  // Glow dot divider
  const divy = hy + hlH + (S ? 24 : 18);
  hline(ctx, W * 0.1, W * 0.43, divy + 6, p.accent + '44', 1.5);
  hline(ctx, W * 0.57, W * 0.9, divy + 6, p.accent + '44', 1.5);
  ctx.shadowColor = p.accent; ctx.shadowBlur = 16;
  circle(ctx, W / 2, divy + 6, 5, p.accent);
  ctx.shadowBlur = 0;

  txt(ctx, d.subheadline, W / 2, divy + (S ? 46 : 34), S ? 30 : 24, '#555', 'center', '400');

  if (d.destaque) {
    ctx.shadowColor = p.accent; ctx.shadowBlur = 30;
    txt(ctx, d.destaque, W / 2, divy + (S ? 106 : 80), S ? 66 : 50, p.accent, 'center', '900');
    ctx.shadowBlur = 0;
  }

  // Bottom
  const by = H - pad;
  const emojis = d.emojis_extras || [];
  let ex = pad;
  for (const e of emojis.slice(0, 2)) {
    ctx.font = `${S ? 30 : 22}px serif`; ctx.textBaseline = 'middle'; ctx.globalAlpha = 0.4; ctx.fillText(e, ex, by - (S ? 8 : 6)); ex += S ? 44 : 32; ctx.globalAlpha = 1;
  }
  roundRect(ctx, W - pad - (S ? 200 : 152), by - (S ? 28 : 22), S ? 200 : 152, S ? 52 : 40, 100, 'transparent', p.accent + '55', 1.5);
  txt(ctx, d.cta || 'Pedir agora', W - pad / 2 - (S ? 44 : 32), by - (S ? 16 : 10), S ? 24 : 18, p.accent, 'center', '900');
}

async function drawSticker(ctx, d, p, restaurante, bgImg, W, H, fscale = 1, cfgAlpha = null) {
  const S = H > W;
  if (bgImg) { drawCoverImage(ctx, bgImg, W, H); overlay(ctx, W, H, 0.7, cfgAlpha); }
  else {
    radialGrad(ctx, p, W, H);
    // Dot pattern
    for (let x = 0; x < W; x += 48)
      for (let y = 0; y < H; y += 48)
        circle(ctx, x, y, 2, p.accent + '22');
  }

  const cy = H / 2;
  const padX = S ? 80 : 60;

  // Main sticker — rotated
  ctx.save();
  ctx.translate(W / 2, cy - (S ? 200 : 150));
  ctx.rotate(-0.026);
  const sw = W - padX * 2, sh = S ? 340 : 260;
  const sg = linearGrad(ctx, -sw / 2, 0, sw / 2, 0, p.accent, p.sub);
  roundRect(ctx, -sw / 2, -sh / 2, sw, sh, S ? 50 : 36, sg);
  // Shadow offset
  ctx.shadowOffsetX = 10; ctx.shadowOffsetY = 10; ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 0;
  roundRect(ctx, -sw / 2, -sh / 2, sw, sh, S ? 50 : 36, sg);
  ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  if (!bgImg) emoji(ctx, d.emoji_principal || '🍣', 0, -sh / 2 + (S ? 80 : 60), S ? 100 : 76);
  ctx.fillStyle = '#000'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${S ? 76 : 58}px ${F}`;
  ctx.fillText((d.headline || 'SUSHI INSANE').toUpperCase(), 0, sh / 2 - (S ? 80 : 60));
  ctx.restore();

  // Sub sticker
  ctx.save();
  ctx.translate(W / 2, cy + (S ? 100 : 76));
  ctx.rotate(0.017);
  const sw2 = W * 0.75, sh2 = S ? 80 : 62;
  ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 6; ctx.shadowColor = 'rgba(0,0,0,0.35)';
  roundRect(ctx, -sw2 / 2, -sh2 / 2, sw2, sh2, S ? 22 : 16, 'rgba(255,255,255,0.95)');
  ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${S ? 28 : 22}px ${F}`;
  ctx.fillText(d.subheadline || 'Feito pra você 🎉', 0, 0);
  ctx.restore();

  // Destaque pill
  if (d.destaque) {
    ctx.save();
    ctx.translate(W / 2, cy + (S ? 220 : 170));
    ctx.rotate(-0.009);
    ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 4; ctx.shadowColor = p.accent + '88';
    pill(ctx, d.destaque, 0, 0, '#fff', p.accent, S ? 52 : 40, S ? 18 : 14, S ? 42 : 32, 100);
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.restore();
  }

  // CTA
  ctx.save();
  ctx.translate(W / 2, H - (S ? 90 : 68));
  ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 5; ctx.shadowColor = 'rgba(0,0,0,0.5)';
  pill(ctx, d.cta || '👉 Pedir agora!', 0, 0, '#111', '#fff', S ? 52 : 40, S ? 18 : 14, S ? 26 : 20, 100);
  ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  ctx.restore();

  txt(ctx, restaurante.toUpperCase(), W / 2, H - (S ? 38 : 28), S ? 16 : 12, 'rgba(255,255,255,0.25)', 'center', '400');
}

async function drawDuo(ctx, d, p, restaurante, bgImg, W, H, fscale = 1, cfgAlpha = null) {
  const S = H > W;
  const split = S ? H * 0.52 : W * 0.5;

  // Painel 1 — escuro
  ctx.fillStyle = '#060606';
  if (S) ctx.fillRect(0, 0, W, split);
  else ctx.fillRect(0, 0, split, H);
  if (bgImg) {
    ctx.save();
    if (S) ctx.rect(0, 0, W, split);
    else ctx.rect(0, 0, split, H);
    ctx.clip();
    drawCoverImage(ctx, bgImg, S ? W : split, S ? split : H);
    overlay(ctx, W, H, 0.32, cfgAlpha);
    ctx.restore();
  }

  // Painel 2 — colorido
  const g2 = S ? linearGrad(ctx, 0, split, 0, H, p.g1, p.accent + 'cc') : linearGrad(ctx, split, 0, W, 0, p.g1, p.accent + 'cc');
  ctx.fillStyle = g2;
  if (S) ctx.fillRect(0, split, W, H - split);
  else ctx.fillRect(split, 0, W - split, H);

  // Deco circle in panel 2
  if (S) circle(ctx, W * 0.85, split + (H - split) * 0.15, S ? 160 : 120, 'rgba(255,255,255,0.08)');
  else circle(ctx, split + (W - split) * 0.85, H * 0.15, 160, 'rgba(255,255,255,0.08)');

  // Divider glow line
  if (S) { gradHline(ctx, 0, W, split, p.accent, 2); }
  else {
    ctx.strokeStyle = p.accent; ctx.lineWidth = 2;
    const dg = ctx.createLinearGradient(0, 0, 0, H);
    dg.addColorStop(0, 'transparent'); dg.addColorStop(0.5, p.accent); dg.addColorStop(1, 'transparent');
    ctx.strokeStyle = dg; ctx.beginPath(); ctx.moveTo(split, 0); ctx.lineTo(split, H); ctx.stroke();
  }

  const pad = S ? 60 : 44;
  const p1h = S ? split : H;
  const p1w = S ? W : split;

  // Panel 1 content
  if (!bgImg) emoji(ctx, d.emoji_principal || '🍣', p1w * (S ? 0.5 : 0.5), p1h * (S ? 0.32 : 0.35), S ? 110 : 80);
  if (d.tag) txt(ctx, (d.tag || '').toUpperCase(), pad, pad, S ? 20 : 15, p.accent, 'left', '900');

  const hl = (d.headline || 'SUSHI PREMIUM').toUpperCase().split(' ');
  ctx.font = `900 ${S ? 88 : 62}px ${F}`;
  ctx.textBaseline = 'top';
  let yy = S ? split * 0.52 : H * 0.45;
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  ctx.fillText(hl[0] || 'SUSHI', pad, yy);
  ctx.fillStyle = p.accent;
  ctx.fillText(hl.slice(1).join(' ') || 'PREMIUM', pad, yy + (S ? 88 : 62));

  // Panel 2 content
  const p2x = S ? pad : split + pad;
  const p2y = S ? split + pad * 0.8 : pad;
  txt(ctx, d.subheadline, p2x, p2y, S ? 28 : 22, 'rgba(255,255,255,0.65)', 'left', '400');
  if (d.destaque) txt(ctx, d.destaque, p2x, p2y + (S ? 54 : 42), S ? 60 : 44, '#fff', 'left', '900');

  // Footer in panel 2
  const fp2y = S ? H - pad * 0.9 : H - pad;
  const fp2x = S ? pad : split + pad;
  txt(ctx, restaurante.toUpperCase(), fp2x, fp2y - (S ? 12 : 8), S ? 18 : 14, 'rgba(255,255,255,0.35)', 'left', '400');
  pill(ctx, d.cta || 'Pedir agora', S ? W - pad : W - pad, fp2y - (S ? 4 : 2), 'rgba(0,0,0,0.3)', '#fff', S ? 44 : 32, S ? 16 : 12, S ? 24 : 18);
}

async function drawWave(ctx, d, p, restaurante, bgImg, W, H, fscale = 1, cfgAlpha = null) {
  const S = H > W;
  const pad = S ? 72 : 52;
  if (bgImg) { drawCoverImage(ctx, bgImg, W, H); overlay(ctx, W, H, 0.8, cfgAlpha); }
  else radialGrad(ctx, p, W, H);

  // Draw wave shapes
  if (!bgImg) {
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = p.accent;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.65);
    for (let x = 0; x <= W; x += 10) {
      const y = H * 0.65 + Math.sin((x / W) * Math.PI * 3) * (S ? 60 : 44);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

    ctx.fillStyle = p.sub;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.74);
    for (let x = 0; x <= W; x += 10) {
      const y = H * 0.74 + Math.sin((x / W) * Math.PI * 3 + 1) * (S ? 44 : 32);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Top
  txt(ctx, restaurante.toUpperCase(), pad, pad, S ? 18 : 14, p.accent + '99', 'left', '400');
  if (d.tag) {
    roundRect(ctx, W - pad - (S ? 180 : 140), pad - (S ? 10 : 7), S ? 180 : 140, S ? 38 : 28, 100, p.accent + '22');
    txt(ctx, d.tag, W - pad / 2 - (S ? 44 : 34), pad, S ? 20 : 15, p.accent, 'center', '700');
  }

  // Emoji
  if (!bgImg) emoji(ctx, d.emoji_principal || '🍣', W / 2, S ? H * 0.33 : H * 0.32, S ? 150 : 112);

  // Headline
  const hy = bgImg ? H * 0.38 : (S ? H * 0.5 : H * 0.48);
  ctx.font = `900 ${S ? 100 : 76}px ${F}`;
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText((d.headline || 'SUSHI PREMIUM').toUpperCase(), W / 2, hy);
  const hlH = S ? 100 : 76;

  // Wave decoration
  const wy = hy + hlH + (S ? 24 : 18);
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = p.accent; ctx.lineWidth = S ? 3 : 2;
  ctx.beginPath();
  const ww = S ? 200 : 150;
  for (let i = 0; i <= ww; i++) {
    const wx = W / 2 - ww / 2 + i;
    const wvy = wy + Math.sin((i / ww) * Math.PI * 3) * (S ? 10 : 7);
    i === 0 ? ctx.moveTo(wx, wvy) : ctx.lineTo(wx, wvy);
  }
  ctx.stroke(); ctx.globalAlpha = 1;

  txt(ctx, d.subheadline, W / 2, wy + (S ? 38 : 28), S ? 30 : 24, 'rgba(255,255,255,0.6)', 'center', '400');
  if (d.destaque) txt(ctx, d.destaque, W / 2, wy + (S ? 94 : 72), S ? 58 : 44, p.accent, 'center', '900');

  // CTA
  const ctaG = linearGrad(ctx, W / 2 - 120, 0, W / 2 + 120, 0, p.accent + 'cc', p.sub + 'cc');
  pill(ctx, d.cta || 'Pedir agora 〰', W / 2, H - pad - (S ? 14 : 10), ctaG, '#000', S ? 54 : 42, S ? 20 : 15, S ? 28 : 22);
}

async function drawPoster(ctx, d, p, restaurante, bgImg, W, H, fscale = 1, cfgAlpha = null) {
  const S = H > W;
  const split = S ? H * 0.48 : H * 0.5;
  const pad = S ? 66 : 50;

  if (bgImg) {
    drawCoverImage(ctx, bgImg, W, H);
    // Color wash top half
    ctx.fillStyle = p.accent + '88';
    ctx.fillRect(0, 0, W, split + (S ? 40 : 30));
  } else {
    // Top panel — accent
    const tg = linearGrad(ctx, 0, 0, W, split, p.accent, p.sub + 'cc');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, W, split + (S ? 40 : 30));
    const tg2 = linearGrad(ctx, 0, 0, W, 0, p.sub + '44', 'transparent');
    ctx.fillStyle = tg2; ctx.fillRect(0, 0, W, split + 40);

    // Bottom panel — dark
    ctx.fillStyle = p.bg; ctx.fillRect(0, split, W, H - split);
    const bg2 = ctx.createRadialGradient(W * 0.2, H * 0.85, 0, W * 0.2, H * 0.85, W * 0.6);
    bg2.addColorStop(0, p.g1 + '44'); bg2.addColorStop(1, 'transparent');
    ctx.fillStyle = bg2; ctx.fillRect(0, split, W, H - split);
  }

  // Diagonal cut line
  if (!bgImg) {
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, split); ctx.lineTo(W, split - (S ? 60 : 40)); ctx.stroke();
  }

  // Top content
  txt(ctx, restaurante.toUpperCase(), pad, pad, S ? 20 : 15, bgImg ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.4)', 'left', '900');
  if (d.tag) {
    const tc = bgImg ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.35)';
    txt(ctx, (d.tag || '').toUpperCase(), W - pad, pad, S ? 20 : 15, tc, 'right', '700');
  }

  if (!bgImg) emoji(ctx, d.emoji_principal || '🍣', pad + (S ? 80 : 60), split * (S ? 0.45 : 0.42), S ? 110 : 82);

  ctx.font = `900 ${S ? 108 : 82}px ${F}`;
  ctx.fillStyle = bgImg ? '#fff' : '#000';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  const hl = (d.headline || 'SUSHI PREMIUM').toUpperCase().split(' ');
  let yy = split * (S ? 0.54 : 0.5);
  for (const w of hl) {
    ctx.fillText(w, pad, yy);
    yy += S ? 108 : 82;
  }

  // Bottom content
  const by = bgImg ? split + pad : split + pad * 0.8;
  txt(ctx, d.subheadline, pad, by, S ? 30 : 24, 'rgba(255,255,255,0.6)', 'left', '400');
  if (d.destaque) txt(ctx, d.destaque, pad, by + (S ? 54 : 42), S ? 62 : 48, p.accent, 'left', '900');

  const emojis = d.emojis_extras || [];
  let ex = pad; const ey = H - pad;
  for (const e of emojis.slice(0, 3)) {
    ctx.font = `${S ? 36 : 28}px serif`; ctx.textBaseline = 'middle'; ctx.globalAlpha = 0.55; ctx.fillText(e, ex, ey - (S ? 10 : 8)); ex += S ? 52 : 40; ctx.globalAlpha = 1;
  }
  pill(ctx, d.cta || 'Pedir agora', W - pad, ey - (S ? 8 : 6), p.accent, '#000', S ? 48 : 36, S ? 18 : 14, S ? 26 : 20);
}

// ═══════════════════════════════════════════════════════════════
// DISPATCHER
// ═══════════════════════════════════════════════════════════════
const DRAWERS = {
  luxo: drawLuxo, neon: drawNeon, bold: drawBold, magazine: drawMagazine,
  cinema: drawCinema, urgente: drawUrgente, zen: drawZen, split: drawSplit,
  retro: drawRetro, gradient: drawGradient, frame: drawFrame, dark: drawDark,
  sticker: drawSticker, duo: drawDuo, wave: drawWave, poster: drawPoster,
};

// ── Post-processing overlays ──────────────────────────────────
function drawPattern(ctx, W, H, pattern, accent) {
  ctx.save();
  ctx.globalAlpha = 0.09;
  switch (pattern) {
    case 'dots':
      for (let x = 0; x < W; x += 44) for (let y = 0; y < H; y += 44)
        { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI*2); ctx.fillStyle = accent; ctx.fill(); }
      break;
    case 'grid':
      ctx.strokeStyle = accent; ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 54) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
      for (let y = 0; y < H; y += 54) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      break;
    case 'lines':
      ctx.strokeStyle = accent; ctx.lineWidth = 1;
      for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
      break;
    case 'diagonal':
      ctx.strokeStyle = accent; ctx.lineWidth = 1;
      for (let i = -H; i < W + H; i += 50) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i+H,H); ctx.stroke(); }
      break;
    case 'circles':
      ctx.strokeStyle = accent; ctx.lineWidth = 1;
      for (let r = 80; r < Math.max(W,H); r += 80)
        { ctx.beginPath(); ctx.arc(W/2, H/2, r, 0, Math.PI*2); ctx.stroke(); }
      break;
  }
  ctx.restore();
}

function drawBadge(ctx, text, pos, shape, color, W, H) {
  if (!text) return;
  const pad = 64, fontSize = 36, bpad = 22, bpady = 14;
  ctx.font = `900 ${fontSize}px ${F}`;
  const tw = ctx.measureText(text).width;

  let x, y;
  if (pos === 'top-left')     { x = pad + (shape==='circle'?52:0); y = pad + (shape==='circle'?52:0); }
  else if (pos === 'top-right')  { x = W - pad - (shape==='circle'?52:0); y = pad + (shape==='circle'?52:0); }
  else if (pos === 'top-center') { x = W/2; y = pad + (shape==='circle'?52:0); }
  else if (pos === 'bottom-left'){ x = pad + (shape==='circle'?52:0); y = H - pad - (shape==='circle'?52:0); }
  else                          { x = W - pad - (shape==='circle'?52:0); y = H - pad - (shape==='circle'?52:0); }

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 6;

  if (shape === 'circle') {
    const r = Math.max(tw/2 + bpad, 52);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = color; ctx.fill();
    // Inner highlight
    ctx.shadowBlur = 0;
    const hg = ctx.createRadialGradient(x-r*0.25, y-r*0.25, 0, x, y, r);
    hg.addColorStop(0, 'rgba(255,255,255,0.2)'); hg.addColorStop(1, 'transparent');
    ctx.fillStyle = hg; ctx.fill();
  } else if (shape === 'pill') {
    const bw = tw + bpad*2, bh = fontSize + bpady*2;
    roundRect(ctx, x-bw/2, y-bh/2, bw, bh, 100, color);
  } else if (shape === 'ribbon') {
    const bw = tw + bpad*2, bh = fontSize + bpady*2;
    ctx.save(); ctx.translate(x, y); ctx.rotate(-0.05);
    roundRect(ctx, -bw/2, -bh/2, bw, bh, 6, color);
    // ribbon ends
    ctx.fillStyle = shadeColor(color, -30);
    ctx.fillRect(-bw/2-10, -bh/2+4, 10, bh-8);
    ctx.fillRect(bw/2, -bh/2+4, 10, bh-8);
    ctx.restore();
  } else { // tag
    const bw = tw + bpad*2, bh = fontSize + bpady*2;
    roundRect(ctx, x-bw/2, y-bh/2, bw, bh, 8, color);
    ctx.fillStyle = shadeColor(color, -40);
    ctx.fillRect(x-bw/2, y-bh/2, 6, bh);
  }

  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `900 ${fontSize}px ${F}`;
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

function shadeColor(hex, pct) {
  const n = parseInt(hex.replace('#',''), 16);
  const f = pct/100;
  const R = Math.max(0, Math.min(255, (n>>16)+Math.round(255*f)));
  const G = Math.max(0, Math.min(255, ((n>>8)&0x00FF)+Math.round(255*f)));
  const B = Math.max(0, Math.min(255, (n&0x0000FF)+Math.round(255*f)));
  return `rgb(${R},${G},${B})`;
}

async function drawLogoOverlay(ctx, logoSrc, pos, size, W, H) {
  if (!logoSrc) return;
  const img = await loadImage(logoSrc);
  if (!img) return;
  const pad = 56;
  const s = size || 120;
  const ratio = img.width / img.height;
  const lw = ratio >= 1 ? s : s * ratio;
  const lh = ratio >= 1 ? s / ratio : s;
  let lx, ly;
  if (pos === 'top-left')     { lx = pad; ly = pad; }
  else if (pos === 'top-right')  { lx = W - pad - lw; ly = pad; }
  else if (pos === 'bottom-left'){ lx = pad; ly = H - pad - lh; }
  else if (pos === 'center')     { lx = (W-lw)/2; ly = (H-lh)/2; }
  else                          { lx = W - pad - lw; ly = H - pad - lh; }

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 16;
  ctx.drawImage(img, lx, ly, lw, lh);
  ctx.restore();
}

export async function renderTemplateToCanvas(canvas, { template, paleta, dados, restaurante, bgImage, formato, cfg = {} }) {
  const S = formato === 'stories';
  // Resolve size from exportRatio if set via cfg
  let W = 1080, H = S ? 1920 : 1080;

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Apply font scale globally via a wrapper
  const fs = cfg.fontScale || 1.0;
  if (fs !== 1) {
    // Scale by transforming the canvas
    ctx.scale(fs, fs);
    canvas.width = Math.round(W / fs) * fs; // keep integer
    // We re-use W/H as logical size, then scale transform
    // Actually simpler: just pass fs to drawers and multiply sizes
  }
  ctx.setTransform(1,0,0,1,0,0); // reset

  // Carrega imagens
  let img = null;
  if (bgImage) img = await loadImage(bgImage);
  let logoImg = cfg.logo || null;

  // Apply accent override
  const p = cfg.accentOverride ? { ...paleta, accent: cfg.accentOverride } : paleta;

  // Scale font sizes in dados context
  const scaledDados = { ...dados };

  const drawer = DRAWERS[template] || drawLuxo;
  await drawer(ctx, scaledDados, p, restaurante, img, W, H, cfg.fontScale || 1, cfg.overlayAlpha);

  // Post: draw pattern
  if (cfg.bgPattern && cfg.bgPattern !== 'none') {
    drawPattern(ctx, W, H, cfg.bgPattern, p.accent);
  }

  // Post: draw badge
  if (cfg.badge) {
    drawBadge(ctx, cfg.badge, cfg.badgePos || 'top-right', cfg.badgeShape || 'circle', cfg.badgeColor || '#ef4444', W, H);
  }

  // Post: draw logo
  if (cfg.logo) {
    await drawLogoOverlay(ctx, cfg.logo, cfg.logoPos || 'bottom-right', cfg.logoSize || 120, W, H);
  }
}
