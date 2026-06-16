import React, { useEffect, useRef, useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════
//  SUSHI DRONE OPERATOR v2.0 — Simulador Profissional
//  37 Sushi Paranavaí
// ═══════════════════════════════════════════════════════════

// ── MAPAS ─────────────────────────────────────────────────
const MAP_CENTRO = {
  id:'centro', nome:'Centro Paranavaí', skyTint:[13,31,60],
  base:{ x:450, y:350 },
  bldgs:[
    { x:100, y:30,  w:130, d:100, h:48, col:[38,60,98]  },
    { x:260, y:50,  w:80,  d:70,  h:22, col:[28,48,78]  },
    { x:360, y:35,  w:110, d:90,  h:35, col:[36,56,90]  },
    { x:500, y:30,  w:100, d:95,  h:44, col:[42,66,104] },
    { x:630, y:40,  w:120, d:85,  h:28, col:[32,52,84]  },
    { x:770, y:28,  w:110, d:105, h:56, col:[48,72,112] },
    { x:60,  y:140, w:110, d:90,  h:34, col:[38,60,96]  },
    { x:60,  y:270, w:100, d:90,  h:20, col:[26,44,70]  },
    { x:60,  y:390, w:115, d:90,  h:46, col:[46,70,108] },
    { x:160, y:180, w:75,  d:65,  h:14, col:[24,40,64]  },
    { x:200, y:300, w:85,  d:75,  h:30, col:[34,54,88]  },
    { x:310, y:190, w:95,  d:80,  h:18, col:[28,48,76]  },
    { x:560, y:200, w:90,  d:80,  h:24, col:[32,52,84]  },
    { x:650, y:180, w:80,  d:70,  h:38, col:[42,64,100] },
    { x:760, y:160, w:110, d:85,  h:40, col:[44,68,106] },
    { x:760, y:270, w:100, d:85,  h:26, col:[34,56,86]  },
    { x:760, y:380, w:110, d:85,  h:52, col:[50,76,116] },
    { x:660, y:290, w:95,  d:80,  h:36, col:[40,62,100] },
    { x:80,  y:460, w:105, d:85,  h:22, col:[30,50,78]  },
    { x:220, y:450, w:125, d:95,  h:38, col:[40,64,98]  },
    { x:380, y:470, w:85,  d:75,  h:16, col:[26,44,68]  },
    { x:510, y:445, w:105, d:100, h:42, col:[44,68,106] },
    { x:650, y:455, w:95,  d:85,  h:30, col:[36,58,90]  },
    { x:770, y:462, w:105, d:85,  h:24, col:[32,52,80]  },
  ],
  parks:[
    { x:155, y:145, w:180, h:120, col:[12,44,22] },
    { x:500, y:138, w:220, h:120, col:[10,40,20] },
    { x:295, y:365, w:190, h:135, col:[12,42,22] },
    { x:118, y:362, w:155, h:115, col:[10,40,20] },
    { x:555, y:332, w:185, h:140, col:[12,44,22] },
  ],
  roads:[
    { x:0,   y:185, w:900, h:18 },
    { x:0,   y:315, w:900, h:18 },
    { x:0,   y:430, w:900, h:18 },
    { x:185, y:0,   w:18,  h:700 },
    { x:405, y:0,   w:18,  h:700 },
    { x:615, y:0,   w:18,  h:700 },
  ],
  spots:[
    { id:'D1', x:155, y:100, r:28, nome:'Rua Norte 12',    alt_min:8,  alt_max:24 },
    { id:'D2', x:700, y:85,  r:28, nome:'Av. Central 88',  alt_min:15, alt_max:38 },
    { id:'D3', x:155, y:520, r:28, nome:'Rua Sul 3',       alt_min:6,  alt_max:20 },
    { id:'D4', x:720, y:520, r:28, nome:'Eco Park 44',     alt_min:5,  alt_max:18 },
    { id:'D5', x:55,  y:305, r:28, nome:'Av. Oeste 22',    alt_min:8,  alt_max:28 },
    { id:'D6', x:848, y:330, r:28, nome:'Extremo Leste 5', alt_min:10, alt_max:30 },
    { id:'D7', x:450, y:130, r:28, nome:'Praça Central',   alt_min:5,  alt_max:15 },
    { id:'D8', x:350, y:590, r:28, nome:'Terminal Sul',    alt_min:5,  alt_max:18 },
  ],
};

const MAP_INDUSTRIAL = {
  id:'industrial', nome:'Zona Industrial', skyTint:[18,18,22],
  base:{ x:500, y:420 },
  bldgs:[
    { x:50,  y:30,  w:220, d:120, h:18, col:[55,50,45] },
    { x:310, y:30,  w:180, d:120, h:22, col:[60,55,48] },
    { x:530, y:30,  w:200, d:120, h:16, col:[52,48,42] },
    { x:780, y:30,  w:100, d:130, h:28, col:[65,58,50] },
    { x:50,  y:190, w:200, d:120, h:20, col:[58,52,46] },
    { x:300, y:200, w:160, d:110, h:14, col:[54,50,44] },
    { x:510, y:190, w:180, d:120, h:24, col:[62,56,48] },
    { x:740, y:180, w:140, d:130, h:18, col:[56,50,44] },
    { x:50,  y:350, w:240, d:100, h:22, col:[60,54,46] },
    { x:340, y:340, w:200, d:110, h:30, col:[50,46,40] },
    { x:590, y:330, w:200, d:120, h:18, col:[58,52,45] },
    { x:160, y:158, w:30,  d:30,  h:58, col:[70,65,58] },
    { x:470, y:155, w:30,  d:30,  h:50, col:[68,62,55] },
    { x:720, y:145, w:35,  d:35,  h:62, col:[72,66,58] },
  ],
  parks:[
    { x:200, y:295, w:90,  h:75, col:[10,35,15] },
    { x:680, y:275, w:70,  h:65, col:[10,35,15] },
  ],
  roads:[
    { x:0,   y:170, w:900, h:24 },
    { x:0,   y:325, w:900, h:24 },
    { x:275, y:0,   w:24,  h:700 },
    { x:575, y:0,   w:24,  h:700 },
  ],
  spots:[
    { id:'I1', x:170, y:88,  r:30, nome:'Galpão Alpha',   alt_min:8,  alt_max:22 },
    { id:'I2', x:690, y:85,  r:30, nome:'Galpão Beta',    alt_min:8,  alt_max:22 },
    { id:'I3', x:170, y:262, r:30, nome:'Dock Central',   alt_min:6,  alt_max:18 },
    { id:'I4', x:730, y:252, r:30, nome:'Dock Norte',     alt_min:6,  alt_max:18 },
    { id:'I5', x:440, y:228, r:30, nome:'Hub Logístico',  alt_min:10, alt_max:28 },
    { id:'I6', x:450, y:475, r:30, nome:'Base Sul',       alt_min:5,  alt_max:15 },
  ],
};

const MAP_RESIDENCIAL = {
  id:'residencial', nome:'Bairro Nobre', skyTint:[8,22,14],
  base:{ x:450, y:360 },
  bldgs:[
    { x:60,  y:35,  w:60, d:50, h:8,  col:[90,60,40] },
    { x:140, y:35,  w:55, d:48, h:9,  col:[80,55,38] },
    { x:220, y:35,  w:60, d:50, h:8,  col:[88,58,40] },
    { x:310, y:35,  w:55, d:45, h:10, col:[75,52,36] },
    { x:400, y:35,  w:65, d:52, h:8,  col:[92,62,42] },
    { x:500, y:35,  w:58, d:48, h:9,  col:[82,56,38] },
    { x:590, y:35,  w:60, d:50, h:10, col:[78,54,36] },
    { x:680, y:35,  w:65, d:52, h:8,  col:[90,60,40] },
    { x:780, y:35,  w:60, d:50, h:9,  col:[85,57,39] },
    { x:60,  y:135, w:58, d:48, h:8,  col:[82,56,38] },
    { x:140, y:135, w:55, d:45, h:11, col:[88,60,42] },
    { x:260, y:135, w:65, d:52, h:8,  col:[76,52,36] },
    { x:600, y:135, w:58, d:48, h:9,  col:[84,58,40] },
    { x:700, y:135, w:62, d:50, h:10, col:[80,55,38] },
    { x:800, y:135, w:58, d:48, h:8,  col:[86,58,40] },
    { x:60,  y:265, w:60, d:50, h:9,  col:[88,60,42] },
    { x:140, y:265, w:55, d:45, h:8,  col:[78,54,36] },
    { x:600, y:265, w:60, d:50, h:10, col:[82,56,38] },
    { x:700, y:265, w:58, d:48, h:8,  col:[90,62,42] },
    { x:800, y:265, w:62, d:50, h:9,  col:[84,57,39] },
    { x:60,  y:395, w:60, d:50, h:8,  col:[80,55,38] },
    { x:140, y:395, w:55, d:45, h:10, col:[86,58,40] },
    { x:260, y:395, w:65, d:52, h:8,  col:[78,54,36] },
    { x:380, y:395, w:58, d:48, h:9,  col:[92,62,42] },
    { x:600, y:395, w:60, d:50, h:10, col:[84,58,40] },
    { x:700, y:395, w:58, d:48, h:8,  col:[80,55,38] },
    { x:800, y:395, w:62, d:50, h:9,  col:[88,60,42] },
    { x:60,  y:505, w:60, d:50, h:8,  col:[82,56,38] },
    { x:150, y:505, w:55, d:45, h:9,  col:[88,60,42] },
    { x:260, y:505, w:65, d:52, h:10, col:[76,52,36] },
    { x:700, y:505, w:62, d:50, h:8,  col:[84,58,40] },
    { x:800, y:505, w:60, d:50, h:9,  col:[90,62,42] },
    { x:360, y:195, w:80, d:70, h:22, col:[70,90,110] },
    { x:460, y:195, w:80, d:70, h:26, col:[65,85,105] },
    { x:360, y:285, w:80, d:70, h:18, col:[72,92,112] },
    { x:460, y:285, w:80, d:70, h:22, col:[68,88,108] },
  ],
  parks:[
    { x:220, y:195, w:120, h:185, col:[10,50,20] },
    { x:560, y:195, w:30,  h:185, col:[10,48,18] },
    { x:595, y:335, w:95,  h:45,  col:[12,50,22] },
    { x:350, y:465, w:230, h:50,  col:[10,48,18] },
  ],
  roads:[
    { x:0,   y:105, w:900, h:14 },
    { x:0,   y:235, w:900, h:14 },
    { x:0,   y:365, w:900, h:14 },
    { x:0,   y:475, w:900, h:14 },
    { x:335, y:0,   w:14,  h:700 },
    { x:575, y:0,   w:14,  h:700 },
    { x:108, y:0,   w:14,  h:700 },
  ],
  spots:[
    { id:'R1', x:100, y:75,  r:25, nome:'Rua das Flores 5',  alt_min:5, alt_max:14 },
    { id:'R2', x:450, y:75,  r:25, nome:'Alameda dos Sonhos', alt_min:5, alt_max:14 },
    { id:'R3', x:750, y:75,  r:25, nome:'Rua das Palmeiras',  alt_min:5, alt_max:14 },
    { id:'R4', x:100, y:305, r:25, nome:'Vila Verde 22',      alt_min:5, alt_max:14 },
    { id:'R5', x:750, y:305, r:25, nome:'Cond. Exclusivo',    alt_min:5, alt_max:18 },
    { id:'R6', x:100, y:435, r:25, nome:'Jardim Europa',      alt_min:5, alt_max:14 },
    { id:'R7', x:450, y:435, r:25, nome:'Praça da Fonte',     alt_min:5, alt_max:14 },
    { id:'R8', x:750, y:435, r:25, nome:'Alto Bairro 88',     alt_min:5, alt_max:14 },
  ],
};

const ALL_MAPS = { centro: MAP_CENTRO, industrial: MAP_INDUSTRIAL, residencial: MAP_RESIDENCIAL };

// ── MISSÕES ───────────────────────────────────────────────
const MISSIONS = [
  { id:'tutorial',    icon:'🟢', diff:'Fácil',    nome:'Tutorial',             map:'centro',      wind:0,   night:false, n:1, timeLimit:180, bat:100, pts2:300, pts3:600,  desc:'Primeiro voo. Sem vento, sem pressa.',           tip:'W=avançar · E/Space=subir · F=soltar pacote' },
  { id:'express',     icon:'⚡', diff:'Médio',    nome:'Express Delivery',     map:'centro',      wind:0.5, night:false, n:1, timeLimit:60,  bat:100, pts2:400, pts3:750,  desc:'1 entrega em 60s. Cada segundo vale bônus.',     tip:'Suba direto, tome rota reta, desça rápido.' },
  { id:'urbano',      icon:'🟡', diff:'Médio',    nome:'Rota Urbana',          map:'centro',      wind:1.2, night:false, n:3, timeLimit:300, bat:100, pts2:600, pts3:1000, desc:'3 entregas no centro. Vento leve.',               tip:'Planeje a rota entre os pontos no minimapa.' },
  { id:'noite',       icon:'🌙', diff:'Difícil',  nome:'Operação Noturna',     map:'centro',      wind:1.8, night:true,  n:3, timeLimit:360, bat:100, pts2:700, pts3:1200, desc:'Visibilidade reduzida + vento moderado.',         tip:'Use o minimapa. Janelas dos prédios orientam.' },
  { id:'industrial',  icon:'🏭', diff:'Médio',    nome:'Zona Industrial',      map:'industrial',  wind:2.0, night:false, n:4, timeLimit:400, bat:100, pts2:800, pts3:1400, desc:'4 entregas em galpões. Espaços abertos.',         tip:'Galpões são baixos — altitude ideal 10–22m.' },
  { id:'tempestade',  icon:'🔴', diff:'Difícil',  nome:'Operação Tempestade',  map:'centro',      wind:4.5, night:false, n:2, timeLimit:240, bat:100, pts2:500, pts3:900,  desc:'Vento forte 4.5 m/s. Corrija a deriva.',         tip:'Antecipe o vento. Voe em diagonal.' },
  { id:'residencial', icon:'🏘️', diff:'Médio',    nome:'Bairro Nobre',         map:'residencial', wind:0.8, night:false, n:3, timeLimit:300, bat:100, pts2:600, pts3:1000, desc:'Casas residenciais. Janela de altitude estreita.', tip:'Altitude 5–14m. Desça mais que o normal.' },
  { id:'noite_storm', icon:'⛈️', diff:'Expert',   nome:'Noite de Tempestade',  map:'centro',      wind:5.2, night:true,  n:2, timeLimit:300, bat:100, pts2:600, pts3:1100, desc:'Noite + Tempestade 5.2 m/s. Máximo desafio.',    tip:'Confie no minimapa. Corrija desvio constantemente.' },
  { id:'baixa_bat',   icon:'🔋', diff:'Difícil',  nome:'Bateria Baixa',        map:'centro',      wind:1.0, night:false, n:2, timeLimit:300, bat:55,  pts2:450, pts3:800,  desc:'Começa com 55% de bateria. Gerencie bem.',       tip:'Evite subidas desnecessárias. Voe direto.' },
  { id:'hardcore',    icon:'💀', diff:'HARDCORE',  nome:'HARDCORE',             map:'industrial',  wind:5.5, night:true,  n:3, timeLimit:360, bat:70,  pts2:800, pts3:1500, desc:'Noite · Tempestade · Bateria 70% · Industrial.',  tip:'Boa sorte.' },
];

// ── FÍSICA ────────────────────────────────────────────────
const MAX_H_SPEED = 12;
const MAX_V_SPEED = 5;
const H_ACCEL     = 0.45;
const H_DRAG      = 0.87;
const YAW_RATE    = 0.045;
const ALT_ACCEL   = 0.18;
const BATT_IDLE   = 0.004;
const BATT_MOVE   = 0.007;
const BATT_CLIMB  = 0.012;
const WINCH_SPEED = 0.055;
const FOV_DEG     = 72;

// ── CÂMERA MATH ───────────────────────────────────────────
function getVecs(heading, pitch) {
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  const sinH = Math.sin(heading), cosH = Math.cos(heading);
  const fwd  = { x: sinH * cosP, y: cosH * cosP, z: sinP };
  if (Math.abs(cosP) < 0.001) {
    const s = pitch < 0 ? 1 : -1;
    return { fwd, right:{ x:cosH, y:-sinH, z:0 }, up:{ x:sinH*s, y:cosH*s, z:0 } };
  }
  const rLen  = Math.sqrt(fwd.y*fwd.y + fwd.x*fwd.x) || 1;
  const right = { x:fwd.y/rLen, y:-fwd.x/rLen, z:0 };
  const up    = {
    x: right.y*fwd.z - right.z*fwd.y,
    y: right.z*fwd.x - right.x*fwd.z,
    z: right.x*fwd.y - right.y*fwd.x,
  };
  return { fwd, right, up };
}

function proj(wx, wy, wz, d, sw, sh) {
  const { fwd, right, up } = getVecs(d.heading, d.gimbal);
  const dot = (a,b) => a.x*b.x + a.y*b.y + a.z*b.z;
  const v   = { x:wx-d.x, y:wy-d.y, z:wz-d.alt };
  const cz  = dot(v, fwd);
  if (cz < 0.5) return null;
  const f = (sw/2) / Math.tan((FOV_DEG*Math.PI)/360);
  return { x: dot(v,right)/cz*f + sw/2, y: -dot(v,up)/cz*f + sh/2, z: cz, s: f/cz };
}

// ── UTILITÁRIOS ───────────────────────────────────────────
const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
const rgb   = (r,g,b)   => `rgb(${clamp(Math.round(r),0,255)},${clamp(Math.round(g),0,255)},${clamp(Math.round(b),0,255)})`;

function hazedRgb(r, g, b, depth, night) {
  const maxD = night ? 180 : 380;
  const t    = Math.pow(Math.min(1, depth / maxD), 1.5);
  const fr   = night ? 5 : 16;
  const fg   = night ? 10 : 24;
  const fb   = night ? 28 : 58;
  return rgb(r*(1-t)+fr*t, g*(1-t)+fg*t, b*(1-t)+fb*t);
}

function poly(ctx, pts, color, alpha) {
  if (pts.length < 3 || pts.some(p => !p)) return;
  ctx.globalAlpha = alpha ?? 1;
  ctx.fillStyle   = color;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

// ── HIGH SCORES ───────────────────────────────────────────
function loadScores() {
  try { return JSON.parse(localStorage.getItem('drone_scores') || '{}'); } catch { return {}; }
}
function saveScore(id, score) {
  const s = loadScores();
  if (!s[id] || score > s[id]) { s[id] = score; localStorage.setItem('drone_scores', JSON.stringify(s)); }
}

// ── RENDERIZAÇÃO 3D ───────────────────────────────────────
function render3D(ctx, drone, map, activeSpot, frame, night, combo) {
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const [sr, sg, sb] = map.skyTint;

  // ── Céu ─────────────────────────────────────────────────
  const skyTop  = night ? `rgb(1,3,10)`         : `rgb(${sr-4},${sg-8},${sb+10})`;
  const skyBot  = night ? `rgb(4,12,28)`         : `rgb(${sr+8},${sg+14},${sb+22})`;
  const horizonC = night ? `rgb(8,18,40)`        : `rgb(${sr+18},${sg+30},${sb+35})`;
  const grd = ctx.createLinearGradient(0, 0, 0, H*0.45);
  grd.addColorStop(0,    skyTop);
  grd.addColorStop(0.75, skyBot);
  grd.addColorStop(1,    horizonC);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H*0.45);

  // Glow de horizonte diurno
  if (!night) {
    const hgrd = ctx.createLinearGradient(0, H*0.3, 0, H*0.48);
    hgrd.addColorStop(0, 'rgba(255,220,140,0)');
    hgrd.addColorStop(1, 'rgba(255,200,100,0.12)');
    ctx.fillStyle = hgrd;
    ctx.fillRect(0, H*0.3, W, H*0.18);
  }

  // Chão
  const gndCol = night ? '#050d08' : '#0c1a10';
  ctx.fillStyle = gndCol;
  ctx.fillRect(0, H*0.45, W, H*0.55);

  // ── Estrelas ─────────────────────────────────────────────
  if (night) {
    for (let i = 0; i < 220; i++) {
      const sx = (i * 137.508 * 100) % W;
      const sy = (i * 97.3 * 100) % (H * 0.42);
      const twk = (Math.sin(frame * 0.04 + i * 0.65) + 1) * 0.5;
      ctx.globalAlpha = (0.18 + twk * 0.55) * 0.8;
      ctx.fillStyle = i % 7 === 0 ? '#aaccff' : '#ffffff';
      ctx.fillRect(Math.round(sx), Math.round(sy), i % 5 === 0 ? 1.5 : 1, i % 5 === 0 ? 1.5 : 1);
    }
    ctx.globalAlpha = 1;
  }

  // ── Nuvens (projetadas no espaço 3D) ─────────────────────
  if (!night) {
    const CLOUDS = [
      { wx:200, wy:-200, wz:130 }, { wx:600, wy:80,  wz:150 },
      { wx:750, wy:-120, wz:115 }, { wx:300, wy:620,  wz:135 },
      { wx:650, wy:660,  wz:155 }, { wx:-50, wy:200,  wz:125 },
    ];
    CLOUDS.forEach((c,i) => {
      const cp = proj(c.wx, c.wy, c.wz, drone, W, H);
      if (!cp || cp.y > H*0.5) return;
      const sc = clamp(cp.s * 110, 5, 180);
      ctx.globalAlpha = 0.10;
      ctx.fillStyle = '#dce8ff';
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(cp.x + k*sc*0.28, cp.y + k*sc*0.04, sc*(0.5+k*0.18), sc*0.16, 0, 0, Math.PI*2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  // ── Grid do solo ─────────────────────────────────────────
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth   = 0.8;
  const gstep = drone.alt < 40 ? 25 : drone.alt < 100 ? 50 : 100;
  for (let gx = -600; gx <= 1500; gx += gstep) {
    const pa = proj(gx, -600, 0, drone, W, H);
    const pb = proj(gx, 1300, 0, drone, W, H);
    if (pa && pb) { ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.stroke(); }
  }
  for (let gy = -600; gy <= 1300; gy += gstep) {
    const pa = proj(-600, gy, 0, drone, W, H);
    const pb = proj(1500, gy, 0, drone, W, H);
    if (pa && pb) { ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.stroke(); }
  }

  // ── Ruas ─────────────────────────────────────────────────
  map.roads.forEach(r => {
    const cs = [
      proj(r.x,     r.y,     0, drone, W, H),
      proj(r.x+r.w, r.y,     0, drone, W, H),
      proj(r.x+r.w, r.y+r.h, 0, drone, W, H),
      proj(r.x,     r.y+r.h, 0, drone, W, H),
    ];
    const depth = cs.filter(Boolean).reduce((a,p)=>a+p.z,0) / (cs.filter(Boolean).length||1);
    poly(ctx, cs, hazedRgb(16,26,38, depth, night));
    // Marcação central
    const cx1 = proj(r.x+r.w*0.1, r.y+r.h/2, 0.05, drone, W, H);
    const cx2 = proj(r.x+r.w*0.9, r.y+r.h/2, 0.05, drone, W, H);
    if (cx1 && cx2 && r.w > r.h) {
      ctx.strokeStyle = hazedRgb(40,52,60, depth, night);
      ctx.lineWidth   = 0.8;
      ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(cx1.x,cx1.y); ctx.lineTo(cx2.x,cx2.y); ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  // ── Parques ───────────────────────────────────────────────
  map.parks.forEach(p => {
    const cs = [
      proj(p.x,     p.y,     0, drone, W, H),
      proj(p.x+p.w, p.y,     0, drone, W, H),
      proj(p.x+p.w, p.y+p.h, 0, drone, W, H),
      proj(p.x,     p.y+p.h, 0, drone, W, H),
    ];
    const depth = cs.filter(Boolean).reduce((a,v)=>a+v.z,0) / (cs.filter(Boolean).length||1);
    poly(ctx, cs, hazedRgb(p.col[0], p.col[1], p.col[2], depth, night));
  });

  // ── Prédios (painter's) ───────────────────────────────────
  const sorted = [...map.bldgs].sort((a,b) => {
    const da = Math.hypot(a.x+a.w/2-drone.x, a.y+a.d/2-drone.y);
    const db = Math.hypot(b.x+b.w/2-drone.x, b.y+b.d/2-drone.y);
    return db - da;
  });

  sorted.forEach(b => {
    const [br, bg, bb] = b.col;
    const distB = Math.hypot(b.x+b.w/2-drone.x, b.y+b.d/2-drone.y);

    const cs = [
      [b.x,     b.y,     0], [b.x+b.w, b.y,     0],
      [b.x+b.w, b.y+b.d, 0], [b.x,     b.y+b.d, 0],
      [b.x,     b.y,     b.h], [b.x+b.w, b.y,     b.h],
      [b.x+b.w, b.y+b.d, b.h], [b.x,     b.y+b.d, b.h],
    ].map(([x,y,z]) => proj(x, y, z, drone, W, H));

    const [p0,p1,p2,p3,p4,p5,p6,p7] = cs;

    // Top
    poly(ctx, [p4,p5,p6,p7], hazedRgb(br+24, bg+30, bb+38, distB, night));

    const drawS = drone.y <= b.y + b.d/2;
    const drawN = drone.y >= b.y + b.d/2;
    const drawE = drone.x >= b.x + b.w/2;
    const drawW = drone.x <= b.x + b.w/2;

    if (drawS) poly(ctx, [p0,p1,p5,p4], hazedRgb(br+10, bg+14, bb+20, distB, night));
    if (drawN) poly(ctx, [p3,p2,p6,p7], hazedRgb(br-4, bg-2, bb+4, distB, night));
    if (drawE) poly(ctx, [p1,p2,p6,p5], hazedRgb(br+6, bg+10, bb+16, distB, night));
    if (drawW) poly(ctx, [p0,p3,p7,p4], hazedRgb(br-6, bg-4, bb+2, distB, night));

    // Janelas nas faces visíveis
    const drawFaceWindows = (pa, pb, pc, pd, faceW, faceH, isNight) => {
      if (!pa || !pb || !pc || !pd) return;
      const rows = Math.max(1, Math.floor(faceH / 9));
      const cols = Math.max(1, Math.floor(faceW / 12));
      for (let ri = 0; ri < Math.min(rows, 5); ri++) {
        for (let ci = 0; ci < Math.min(cols, 7); ci++) {
          const seed = (b.x + b.y + ri * 13 + ci * 7) % 10;
          if (seed > (isNight ? 5 : 7)) continue;
          const tr = (ri + 0.5) / Math.min(rows, 5);
          const tc = (ci + 0.5) / Math.min(cols, 7);
          const wx = pa.x*(1-tc)*(1-tr) + pb.x*tc*(1-tr) + pc.x*tc*tr + pd.x*(1-tc)*tr;
          const wy = pa.y*(1-tc)*(1-tr) + pb.y*tc*(1-tr) + pc.y*tc*tr + pd.y*(1-tc)*tr;
          const ws = Math.max(1.5, pa.s * 5);
          ctx.globalAlpha = isNight ? (0.5 + (seed % 4)*0.1) : (0.12 + (seed%3)*0.04);
          ctx.fillStyle   = isNight ? `rgba(255,220,100,1)` : `rgba(160,200,240,1)`;
          ctx.fillRect(wx - ws/2, wy - ws*0.3, ws, ws*0.6);
        }
      }
      ctx.globalAlpha = 1;
    };

    if (drawS && b.h > 8) drawFaceWindows(p0, p1, p5, p4, b.w, b.h, night);
    if (drawN && b.h > 8) drawFaceWindows(p3, p2, p6, p7, b.w, b.h, night);
    if (drawE && b.h > 8) drawFaceWindows(p1, p2, p6, p5, b.d, b.h, night);
    if (drawW && b.h > 8) drawFaceWindows(p0, p3, p7, p4, b.d, b.h, night);
  });

  // ── Base helipad ──────────────────────────────────────────
  const base = map.base;
  const bp = proj(base.x, base.y, 0, drone, W, H);
  if (bp) {
    const sc = clamp(bp.s * 30, 4, 80);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth   = 2;
    ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(bp.x, bp.y, sc, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(bp.x, bp.y, sc*0.55, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f97316';
    ctx.font = `bold ${clamp(sc*0.7,8,22)}px monospace`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('H', bp.x, bp.y);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }

  // ── Zonas de entrega ──────────────────────────────────────
  map.spots.forEach(spot => {
    const sp = proj(spot.x, spot.y, 0, drone, W, H);
    if (!sp) return;
    const sc    = clamp(sp.s * spot.r, 5, 60);
    const isAct = activeSpot?.id === spot.id;
    const pulse = Math.abs(Math.sin(frame * 0.07));

    ctx.strokeStyle = isAct ? '#fbbf24' : 'rgba(251,191,36,0.4)';
    ctx.lineWidth   = isAct ? 2.5 : 1;
    ctx.globalAlpha = isAct ? (0.65 + pulse * 0.3) : 0.4;
    ctx.beginPath(); ctx.arc(sp.x, sp.y, sc*(isAct?1+pulse*0.08:1), 0, Math.PI*2); ctx.stroke();
    if (isAct) {
      ctx.fillStyle = 'rgba(251,191,36,0.07)';
      ctx.fill();
      // Barra de altitude se perto
      const dist = Math.hypot(drone.x - spot.x, drone.y - spot.y);
      if (dist < 150) {
        const bx = W - 22, by1 = H*0.2, by2 = H*0.75;
        const bh = by2 - by1;
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(bx - 6, by1, 14, bh);
        const lo = spot.alt_min / 150;
        const hi = spot.alt_max / 150;
        ctx.fillStyle = 'rgba(34,197,94,0.3)';
        ctx.fillRect(bx-6, by2 - hi*bh, 14, (hi-lo)*bh);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(bx-6, by2 - hi*bh, 14, 1);
        ctx.fillRect(bx-6, by2 - lo*bh, 14, 1);
        const droneFrac = drone.alt / 150;
        const inRange = drone.alt >= spot.alt_min && drone.alt <= spot.alt_max;
        ctx.fillStyle = inRange ? '#4ade80' : '#f87171';
        ctx.fillRect(bx - 8, by2 - droneFrac*bh - 2, 18, 4);
        ctx.font = '7px monospace';
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.fillText(`${spot.alt_max}m`, bx+1, by2 - hi*bh - 3);
        ctx.fillText(`${spot.alt_min}m`, bx+1, by2 - lo*bh + 9);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle   = isAct ? '#fbbf24' : 'rgba(251,191,36,0.5)';
    ctx.font        = `bold ${clamp(sp.s*12,7,16)}px monospace`;
    ctx.textAlign   = 'center';
    ctx.fillText(spot.id, sp.x, sp.y - sc - 4);
    ctx.textAlign   = 'left';
  });

  // ── HUD overlays ─────────────────────────────────────────
  // Vignette
  const vig = ctx.createRadialGradient(W/2, H/2, H*0.22, W/2, H/2, H*0.72);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.52)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Grain leve (câmera)
  if (night) {
    ctx.globalAlpha = 0.04;
    for (let i = 0; i < 600; i++) {
      const gx = ((i * 997 + frame * 13) % W);
      const gy = ((i * 1009 + frame * 17) % H);
      ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
      ctx.fillRect(gx, gy, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  // Crosshair
  const cx = W/2, cy = H/2;
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth   = 1;
  [[-22,-6],[6,22]].forEach(([a,b2]) => {
    ctx.beginPath(); ctx.moveTo(cx+a, cy); ctx.lineTo(cx+b2, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy+a); ctx.lineTo(cx, cy+b2); ctx.stroke();
  });
  ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();

  // REC
  if (frame % 60 < 40) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(14, 14, 5, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace';
    ctx.fillText('REC', 22, 18);
  }

  // Timestamp
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font      = '9px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(new Date().toTimeString().slice(0,8), W-4, 14);

  // Gimbal
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font      = '9px monospace';
  ctx.fillText(`G ${Math.round(drone.gimbal*180/Math.PI)}°`, W-4, H-8);
  ctx.textAlign = 'left';

  // Corner brackets (DJI style)
  const gl = 22;
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth   = 1.5;
  [[0,0,gl,0,0,gl],[W,0,W-gl,0,W,gl],[0,H,gl,H,0,H-gl],[W,H,W-gl,H,W,H-gl]]
    .forEach(([x1,y1,x2,y2,x3,y3]) => {
      ctx.beginPath();
      ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
      ctx.moveTo(x1,y1); ctx.lineTo(x3,y3);
      ctx.stroke();
    });

  // COMBO display
  if (combo > 1) {
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.font = `bold ${20 + combo*4}px monospace`;
    ctx.fillStyle = combo >= 4 ? '#fbbf24' : combo >= 3 ? '#fb923c' : '#f472b6';
    ctx.textAlign = 'center';
    ctx.fillText(`${combo}× COMBO!`, W/2, H - 30);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  // Overlay noturno
  if (night) {
    ctx.fillStyle = 'rgba(0,8,18,0.18)';
    ctx.fillRect(0, 0, W, H);
  }
}

// ── MINIMAP ───────────────────────────────────────────────
function renderMinimap(ctx, drone, map, activeSpot, trails, night) {
  const S   = ctx.canvas.width;
  const scl = S / 900;
  const base = map.base;

  ctx.fillStyle = night ? 'rgba(0,6,16,0.93)' : 'rgba(6,14,28,0.90)';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, S, S);

  map.roads.forEach(r => {
    ctx.fillStyle = night ? '#07121e' : '#0f1c2c';
    ctx.fillRect(r.x*scl, r.y*scl, r.w*scl, r.h*scl);
  });
  map.parks.forEach(p => {
    ctx.fillStyle = rgb(...p.col);
    ctx.fillRect(p.x*scl, p.y*scl, p.w*scl, p.h*scl);
  });
  map.bldgs.forEach(b => {
    const sh = Math.round(b.h / 4);
    ctx.fillStyle = rgb(b.col[0]+sh, b.col[1]+sh, b.col[2]+sh+10);
    ctx.fillRect(b.x*scl, b.y*scl, b.w*scl, b.d*scl);
  });

  // Zonas
  map.spots.forEach(spot => {
    const isAct = activeSpot?.id === spot.id;
    ctx.strokeStyle = isAct ? '#fbbf24' : 'rgba(251,191,36,0.4)';
    ctx.lineWidth   = isAct ? 1.5 : 1;
    ctx.beginPath(); ctx.arc(spot.x*scl, spot.y*scl, spot.r*scl, 0, Math.PI*2); ctx.stroke();
    if (isAct) { ctx.fillStyle = 'rgba(251,191,36,0.15)'; ctx.fill(); }
    ctx.fillStyle = isAct ? '#fbbf24' : 'rgba(251,191,36,0.5)';
    ctx.font = `bold ${Math.round(5*scl+3)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(spot.id, spot.x*scl, spot.y*scl - spot.r*scl - 2);
    ctx.textAlign = 'left';
  });

  // Base
  ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(base.x*scl, base.y*scl, 8, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = '#f97316'; ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('H', base.x*scl, base.y*scl+3);
  ctx.textAlign = 'left';

  // Trail
  trails.forEach((t,i) => {
    ctx.globalAlpha = (i/trails.length)*0.55;
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(t.x*scl-1, t.y*scl-1, 2, 2);
  });
  ctx.globalAlpha = 1;

  // Drone icon
  ctx.save();
  ctx.translate(drone.x*scl, drone.y*scl);
  ctx.rotate(drone.heading);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0,-7); ctx.lineTo(4,5); ctx.lineTo(0,3); ctx.lineTo(-4,5); ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '7px monospace';
  ctx.fillText('MAP', 3, 8);
}

// ── INIT ──────────────────────────────────────────────────
function initGame(mission) {
  const map   = ALL_MAPS[mission.map];
  const base  = map.base;
  const queue = [...map.spots].sort(() => Math.random()-0.5).slice(0, mission.n);
  return {
    mission, map,
    drone:{ x:base.x, y:base.y, alt:0, vx:0, vy:0, vz:0, heading:0, gimbal:-1.2 },
    battery: mission.bat,
    signal:  98,
    wind:    { angle: Math.random()*Math.PI*2, speed: mission.wind },
    windT:   0,
    queue,
    spot:    null,
    winch:   0,
    winching:false,
    pkgOk:   false,
    delivered:0,
    score:   0,
    combo:   1,
    comboT:  0,
    frame:   0,
    t0:      Date.now(),
    log:     ['[00:00] Pronto para decolar...'],
    trails:  [],
    over:    false,
    rth:     false,
    timeLeft: mission.timeLimit,
    lastSec:  0,
  };
}

// ── COMPONENTE ────────────────────────────────────────────
export default function Drone() {
  const camRef  = useRef(null);
  const mapRef  = useRef(null);
  const wrapRef = useRef(null);
  const gameRef = useRef(null);
  const rafRef  = useRef(null);
  const keysRef = useRef({});
  const touchRef= useRef({ dx:0, dy:0, up:false, down:false });

  const [screen,    setScreen]   = useState('menu');
  const [selIdx,    setSelIdx]   = useState(0);
  const [tel,       setTel]      = useState(null);
  const [logLines,  setLog]      = useState([]);
  const [results,   setResults]  = useState(null);
  const [scores,    setScores]   = useState(loadScores);

  const onKD = useCallback(e => {
    const keys = ['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','Space',
                  'ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
                  'KeyF','KeyR','BracketLeft','BracketRight'];
    if (keys.includes(e.code)) e.preventDefault();
    keysRef.current[e.code] = true;
  }, []);
  const onKU = useCallback(e => { delete keysRef.current[e.code]; }, []);

  useEffect(() => {
    if (screen === 'game') setTimeout(() => wrapRef.current?.focus(), 80);
  }, [screen]);

  const joyOrig = useRef(null);
  const onJoyS  = e => { const t=e.changedTouches[0]; joyOrig.current={x:t.clientX,y:t.clientY}; };
  const onJoyM  = e => {
    e.preventDefault();
    if (!joyOrig.current) return;
    const t = e.changedTouches[0];
    touchRef.current.dx = Math.max(-1,Math.min(1,(t.clientX-joyOrig.current.x)/55));
    touchRef.current.dy = Math.max(-1,Math.min(1,(t.clientY-joyOrig.current.y)/55));
  };
  const onJoyE  = () => { joyOrig.current=null; touchRef.current.dx=0; touchRef.current.dy=0; };

  useEffect(() => {
    if (screen !== 'game') { cancelAnimationFrame(rafRef.current); return; }
    const camC = camRef.current, mapC = mapRef.current;
    if (!camC || !mapC) return;
    const ctx2d = camC.getContext('2d');
    const mCtx  = mapC.getContext('2d');

    function ts(g) {
      const ms = Date.now()-g.t0;
      return `${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
    }
    function addLog(g, msg) {
      g.log.unshift(`[${ts(g)}] ${msg}`);
      if (g.log.length > 12) g.log.pop();
    }
    function endGame(g, reason) {
      if (g.over) return;
      g.over = true;
      cancelAnimationFrame(rafRef.current);
      const t = Math.floor((Date.now()-g.t0)/1000);
      const finalScore = g.score;
      saveScore(g.mission.id, finalScore);
      setScores(loadScores());
      setResults({ reason, score:finalScore, delivered:g.delivered, total:g.mission.n,
        battery:Math.round(g.battery), time:t, mission:g.mission, log:[...g.log], combo:g.combo });
      setScreen('results');
    }

    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      const g = gameRef.current;
      if (!g || g.over) return;
      g.frame++;

      const keys = keysRef.current;
      const tch  = touchRef.current;
      const d    = g.drone;
      const night = g.mission.night;

      // Tempo
      const secElapsed = Math.floor((Date.now()-g.t0)/1000);
      if (secElapsed !== g.lastSec) {
        g.lastSec = secElapsed;
        g.timeLeft = Math.max(0, g.mission.timeLimit - secElapsed);
        if (g.timeLeft <= 0) { endGame(g, 'timeout'); return; }
      }

      // Vento
      g.windT++;
      if (g.windT > 200) {
        g.windT = 0;
        const b = g.mission.wind;
        g.wind = {
          angle: g.wind.angle + (Math.random()-0.5)*1.1,
          speed: Math.max(0, b + (Math.random()-0.5)*b*0.8),
        };
      }
      // Rajada ocasional
      if (g.frame % 180 === 0 && g.mission.wind > 2) {
        g.wind.speed = Math.min(g.mission.wind * 1.6, g.wind.speed + 1.5);
      }

      // Teclas
      const pW  = keys['KeyW'] || keys['ArrowUp']    || tch.dy < -0.25;
      const pS  = keys['KeyS'] || keys['ArrowDown']  || tch.dy >  0.25;
      const pA  = keys['KeyA'];
      const pD  = keys['KeyD'];
      const pE  = keys['KeyE'] || keys['Space'] || tch.up;
      const pQ  = keys['KeyQ'] || tch.down;
      const pGL = keys['BracketLeft'];
      const pGR = keys['BracketRight'];

      if (pGL) d.gimbal = Math.max(-Math.PI/2, d.gimbal - 0.025);
      if (pGR) d.gimbal = Math.min(-0.12,      d.gimbal + 0.025);

      const yawL = keys['ArrowLeft']  || tch.dx < -0.25;
      const yawR = keys['ArrowRight'] || tch.dx >  0.25;
      if (pA && !yawL) d.heading -= YAW_RATE;
      if (pD && !yawR) d.heading += YAW_RATE;
      if (yawL) d.heading -= YAW_RATE;
      if (yawR) d.heading += YAW_RATE;

      // RTH
      if (keys['KeyR'] && !g.rth) { g.rth = true; addLog(g, '🏠 RTH ativado'); }
      if ((pW || pS) && g.rth)    { g.rth = false; addLog(g, '✋ RTH cancelado'); }

      // Próximo ponto
      if (!g.spot && g.queue.length > 0) {
        g.spot = g.queue.shift();
        g.pkgOk = false; g.winch = 0;
        addLog(g, `📋 Missão: ${g.spot.nome} (${g.spot.alt_min}–${g.spot.alt_max}m)`);
      }

      // Combo timer
      g.comboT++;
      if (g.comboT > 380) { g.combo = 1; }

      // Guincho (F ou botão)
      if (keys['KeyF'] && !g.winching && d.alt > 1 && g.spot && !g.pkgOk) {
        const dist = Math.hypot(d.x-g.spot.x, d.y-g.spot.y);
        const ok   = dist < g.spot.r+15 && d.alt >= g.spot.alt_min && d.alt <= g.spot.alt_max;
        if (ok) { g.winching = true; addLog(g, '📦 Guincho ativado'); }
        else    { addLog(g, `⚠ Altitude: ${g.spot.alt_min}–${g.spot.alt_max}m · Dist: ${Math.round(dist)}m`); }
      }
      if (g.winching) {
        g.winch = Math.min(1, g.winch + WINCH_SPEED);
        if (g.winch >= 1) {
          g.winching = false; g.pkgOk = true; g.winch = 0;
          const battBonus = Math.round(g.battery * 0.6);
          const timeBonus = Math.max(0, Math.round((g.timeLeft / g.mission.timeLimit) * 300));
          const base_pts  = 200;
          const pts = Math.round((base_pts + battBonus + timeBonus) * g.combo);
          // Combo
          if (g.comboT < 380 && g.delivered > 0) g.combo = Math.min(5, g.combo + 1);
          else g.combo = 1;
          g.comboT = 0;
          g.score += pts;
          g.delivered++;
          addLog(g, `✅ Entregue! +${pts} pts${g.combo > 1 ? ` (${g.combo-1<2?'':''}COMBO)` : ''}`);
          g.spot = null;
          if (g.delivered >= g.mission.n) { setTimeout(() => endGame(g, 'success'), 1200); return; }
        }
      }

      // Física
      let ax = 0, ay = 0;
      if (g.rth) {
        const base = g.map.base;
        const tx = base.x - d.x, ty = base.y - d.y;
        const dist = Math.hypot(tx, ty);
        if (dist > 8) {
          const spd = Math.min(dist*0.06, MAX_H_SPEED*0.5);
          ax = (tx/dist)*spd*0.08; ay = (ty/dist)*spd*0.08;
          if (d.alt < 50) d.alt = Math.min(50, d.alt + 0.5);
        } else {
          d.alt = Math.max(0, d.alt - 1.2);
          if (d.alt <= 0) { d.alt=0; d.vx=0; d.vy=0; g.rth=false; addLog(g,'✅ Pousou na base'); }
        }
      } else {
        const cosH = Math.cos(d.heading), sinH = Math.sin(d.heading);
        let fwdF = 0;
        if (pW) fwdF =  1;
        if (pS) fwdF = -1;
        ax += fwdF * sinH * H_ACCEL;
        ay += fwdF * cosH * H_ACCEL;
        if (fwdF !== 0 && d.alt < 5) d.alt = Math.min(8, d.alt + 0.9);
      }

      if (pE && !g.rth) d.vz = Math.min(MAX_V_SPEED,  d.vz + ALT_ACCEL);
      else if (pQ && !g.rth) d.vz = Math.max(-MAX_V_SPEED, d.vz - ALT_ACCEL);
      else d.vz *= 0.82;

      d.alt = Math.max(0, Math.min(150, d.alt + d.vz));

      // Vento
      const wf = 0.3 + (d.alt/150)*0.7;
      ax += Math.cos(g.wind.angle) * g.wind.speed * 0.033 * wf;
      ay += Math.sin(g.wind.angle) * g.wind.speed * 0.033 * wf;

      d.vx = (d.vx + ax) * H_DRAG;
      d.vy = (d.vy + ay) * H_DRAG;
      const spd = Math.sqrt(d.vx*d.vx + d.vy*d.vy);
      if (spd > MAX_H_SPEED) { d.vx = d.vx/spd*MAX_H_SPEED; d.vy = d.vy/spd*MAX_H_SPEED; }

      d.x = Math.max(20, Math.min(880, d.x + d.vx));
      d.y = Math.max(20, Math.min(680, d.y + d.vy));

      // Bateria
      const moving  = spd > 0.2;
      const climbing = d.vz > 0.1;
      let drain = d.alt > 0 ? BATT_IDLE : 0;
      if (moving)  drain += BATT_MOVE;
      if (climbing) drain += BATT_CLIMB;
      g.battery = Math.max(0, g.battery - drain);
      if (g.battery <= 0) { endGame(g, 'battery'); return; }

      g.signal = Math.max(15, 98 - Math.hypot(d.x-g.map.base.x, d.y-g.map.base.y)*0.065);

      if (d.alt > 2 && g.frame % 5 === 0) {
        g.trails.push({ x:d.x, y:d.y });
        if (g.trails.length > 90) g.trails.shift();
      }

      // Render
      render3D(ctx2d, d, g.map, g.spot, g.frame, night, g.combo);
      renderMinimap(mCtx, d, g.map, g.spot, g.trails, night);

      if (g.frame % 3 === 0) {
        const ms = Date.now()-g.t0;
        setTel({
          battery:g.battery, signal:g.signal,
          alt:Math.round(d.alt), spd:Math.round(spd*3.6),
          vspd:d.vz.toFixed(1),
          heading:Math.round(((d.heading*180/Math.PI)%360+360)%360),
          dist:Math.round(Math.hypot(d.x-g.map.base.x, d.y-g.map.base.y)),
          wind:g.wind,
          gimbal:Math.round(d.gimbal*180/Math.PI),
          delivered:g.delivered, total:g.mission.n,
          spot:g.spot, winching:g.winching, winch:g.winch,
          rth:g.rth, timeLeft:g.timeLeft, combo:g.combo,
          battery_warn:g.battery < 25,
        });
        setLog([...g.log]);
      }
    }

    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen]);

  function startGame() {
    gameRef.current = initGame(MISSIONS[selIdx]);
    setTel(null); setLog([]);
    setScreen('game');
  }

  // ── MENU ─────────────────────────────────────────────────
  if (screen === 'menu') {
    const diffColor = { 'Fácil':'#22c55e', 'Médio':'#f59e0b', 'Difícil':'#f97316', 'Expert':'#ef4444', 'HARDCORE':'#a855f7' };
    const mapIcons  = { centro:'🏙️', industrial:'🏭', residencial:'🏘️' };
    const sel = MISSIONS[selIdx];
    return (
      <div className="min-h-screen flex flex-col lg:flex-row" style={{ background:'var(--space-bg)' }}>
        {/* Esquerda: lista de missões */}
        <div className="lg:w-80 shrink-0 overflow-y-auto p-4" style={{ borderRight:'1px solid var(--hairline)' }}>
          <div className="flex items-center gap-3 mb-5">
            <span style={{ fontSize:32 }}>🚁</span>
            <div>
              <h1 className="text-xl font-black" style={{ color:'var(--accent)' }}>SUSHI DRONE</h1>
              <p className="text-[10px]" style={{ color:'var(--txt-dim)' }}>Simulador Profissional v2.0</p>
            </div>
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color:'var(--txt-dim)' }}>Selecione a missão</p>
          <div className="space-y-1.5">
            {MISSIONS.map((m, i) => {
              const hs = scores[m.id] ?? 0;
              const stars = hs >= m.pts3 ? 3 : hs >= m.pts2 ? 2 : hs > 0 ? 1 : 0;
              return (
                <button key={m.id} onClick={() => setSelIdx(i)}
                  className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                  style={{ background: selIdx===i ? 'rgba(var(--accent-rgb),0.1)' : 'var(--space-elev)',
                    border:`1px solid ${selIdx===i ? 'rgba(var(--accent-rgb),0.4)' : 'var(--hairline)'}` }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize:14 }}>{m.icon}</span>
                      <span className="text-xs font-black" style={{ color:'var(--txt)' }}>{m.nome}</span>
                    </div>
                    <div className="flex gap-0.5">
                      {[0,1,2].map(s => <span key={s} style={{ fontSize:9, opacity: s<stars?1:0.15 }}>⭐</span>)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] font-bold px-1.5 rounded" style={{ background:`${diffColor[m.diff]}22`, color:diffColor[m.diff] }}>{m.diff}</span>
                    <span className="text-[9px]" style={{ color:'var(--txt-dim)' }}>{mapIcons[m.map]} {ALL_MAPS[m.map].nome}</span>
                    {hs > 0 && <span className="text-[9px] font-mono ml-auto" style={{ color:'#fbbf24' }}>🏆{hs.toLocaleString()}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Direita: briefing + controles */}
        <div className="flex-1 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start gap-4 mb-6">
              <span style={{ fontSize:48 }}>{sel.icon}</span>
              <div>
                <h2 className="text-2xl font-black" style={{ color:'var(--txt)' }}>{sel.nome}</h2>
                <p className="text-sm mt-1" style={{ color:'var(--txt-dim)' }}>{sel.desc}</p>
                <div className="flex gap-3 mt-2 flex-wrap">
                  <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background:`${diffColor[sel.diff]}18`, color:diffColor[sel.diff] }}>{sel.diff}</span>
                  <span className="text-xs" style={{ color:'var(--txt-dim)' }}>{mapIcons[sel.map]} {ALL_MAPS[sel.map].nome}</span>
                  <span className="text-xs" style={{ color:'var(--txt-dim)' }}>⏱ {Math.floor(sel.timeLimit/60)}:{String(sel.timeLimit%60).padStart(2,'0')}</span>
                  <span className="text-xs" style={{ color:'var(--txt-dim)' }}>🎯 {sel.n} entregas</span>
                  <span className="text-xs" style={{ color:'var(--txt-dim)' }}>💨 {sel.wind} m/s</span>
                  {sel.bat < 100 && <span className="text-xs" style={{ color:'#f59e0b' }}>🔋 {sel.bat}%</span>}
                  {sel.night && <span className="text-xs" style={{ color:'#818cf8' }}>🌙 Noturno</span>}
                </div>
              </div>
            </div>

            <div className="rounded-xl px-4 py-3 mb-4 flex items-start gap-3" style={{ background:'rgba(251,191,36,0.06)', border:'1px solid rgba(251,191,36,0.2)' }}>
              <span>💡</span>
              <p className="text-xs" style={{ color:'#fbbf24' }}>{sel.tip}</p>
            </div>

            {/* Objetivos de pontuação */}
            <div className="rounded-xl px-4 py-3 mb-6" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
              <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color:'var(--txt-dim)' }}>Metas de pontuação</p>
              <div className="grid grid-cols-3 gap-2">
                {[['⭐', sel.pts2/2, '#94a3b8'], ['⭐⭐', sel.pts2, '#fbbf24'], ['⭐⭐⭐', sel.pts3, '#f97316']].map(([s,p,c]) => (
                  <div key={s} className="text-center rounded-lg py-2" style={{ background:'rgba(0,0,0,0.3)' }}>
                    <div style={{ fontSize:14 }}>{s}</div>
                    <div className="text-xs font-black font-mono mt-0.5" style={{ color:c }}>{p.toLocaleString()}</div>
                  </div>
                ))}
              </div>
              {scores[sel.id] > 0 && (
                <p className="text-[10px] text-center mt-2 font-mono" style={{ color:'#fbbf24' }}>
                  Seu recorde: 🏆 {scores[sel.id].toLocaleString()}
                </p>
              )}
            </div>

            {/* Controles */}
            <div className="rounded-xl px-4 py-3" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
              <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color:'var(--txt-dim)' }}>Controles</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" style={{ color:'var(--txt-dim)' }}>
                {[['W / S','Avançar / Recuar'],['A / D','Girar (Yaw)'],['E / Space','Subir'],['Q','Descer'],['F','Soltar pacote'],['R','RTH — Retornar'],['[ / ]','Gimbal câmera']].map(([k,v]) => (
                  <React.Fragment key={k}>
                    <span><kbd className="px-1.5 rounded text-[10px] font-mono" style={{ background:'#1e293b', border:'1px solid #334155', color:'#94a3b8' }}>{k}</kbd></span>
                    <span>{v}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <button onClick={startGame}
            className="mt-6 py-4 rounded-2xl font-black text-white text-lg transition-all active:scale-95 hover:scale-105"
            style={{ background:'var(--accent)', boxShadow:'0 0 30px rgba(var(--accent-rgb),0.35)' }}>
            🚀 Iniciar Missão
          </button>
        </div>
      </div>
    );
  }

  // ── RESULTS ───────────────────────────────────────────────
  if (screen === 'results') {
    const r = results;
    const stars = r.score >= r.mission.pts3 ? 3 : r.score >= r.mission.pts2 ? 2 : r.delivered > 0 ? 1 : 0;
    const mm = String(Math.floor(r.time/60)).padStart(2,'0');
    const ss = String(r.time%60).padStart(2,'0');
    const reasonMsg = { success:'Missão concluída!', battery:'Bateria zerada!', timeout:'Tempo esgotado!' };
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-8" style={{ background:'var(--space-bg)' }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div style={{ fontSize:48 }}>
              {r.reason==='success' ? (stars===3?'🏆':stars===2?'🥈':'✅') : r.reason==='battery'?'🔋':'⏱'}
            </div>
            <h2 className="text-2xl font-black mt-2" style={{ color:'var(--txt)' }}>{reasonMsg[r.reason]}</h2>
            <p className="text-xs mt-0.5" style={{ color:'var(--txt-dim)' }}>{r.mission.nome}</p>
            <div className="flex justify-center gap-1 mt-2">
              {[0,1,2].map(i => <span key={i} style={{ fontSize:28, opacity:i<stars?1:0.12 }}>⭐</span>)}
            </div>
            {r.combo > 1 && <p className="text-sm font-bold mt-1" style={{ color:'#fbbf24' }}>Combo máximo: {r.combo}×</p>}
          </div>

          <div className="rounded-2xl overflow-hidden mb-4" style={{ background:'var(--space-surface)', border:'1px solid var(--hairline)' }}>
            {[
              { label:'Pontuação',        value:r.score.toLocaleString(),      color:'var(--accent)', big:true },
              { label:'Entregas',         value:`${r.delivered} / ${r.total}`, color:r.delivered===r.total?'#22c55e':'#f59e0b' },
              { label:'Bateria restante', value:`${r.battery}%`,               color:r.battery>30?'#22c55e':'#ef4444' },
              { label:'Tempo de voo',     value:`${mm}:${ss}`,                 color:'var(--txt)' },
            ].map((row,i,a) => (
              <div key={i} className="flex justify-between items-center px-5 py-3"
                style={{ borderBottom:i<a.length-1?'1px solid var(--hairline)':'' }}>
                <span className="text-sm" style={{ color:'var(--txt-dim)' }}>{row.label}</span>
                <span className={`font-black ${row.big?'text-2xl':''}`} style={{ color:row.color }}>{row.value}</span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl p-4 mb-4" style={{ background:'var(--space-elev)', border:'1px solid var(--hairline)' }}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color:'var(--txt-dim)' }}>Log de voo</p>
            {(r.log||[]).slice(0,6).map((l,i) => (
              <p key={i} className="text-[9px] font-mono" style={{ color:i===0?'#60a5fa':'#334155' }}>{l}</p>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={startGame} className="flex-1 py-3 rounded-2xl font-black text-sm text-white active:scale-95"
              style={{ background:'var(--accent)' }}>🔄 Repetir</button>
            <button onClick={() => setScreen('menu')} className="flex-1 py-3 rounded-2xl font-black text-sm active:scale-95"
              style={{ background:'var(--space-elev)', color:'var(--txt)', border:'1px solid var(--hairline)' }}>← Menu</button>
          </div>
        </div>
      </div>
    );
  }

  // ── JOGO ─────────────────────────────────────────────────
  const battCol = !tel ? '#22c55e' : tel.battery > 40 ? '#22c55e' : tel.battery > 20 ? '#f59e0b' : '#ef4444';
  const sigCol  = !tel ? '#22c55e' : tel.signal  > 65 ? '#22c55e' : tel.signal  > 35 ? '#f59e0b' : '#ef4444';
  const windMs  = tel?.wind?.speed?.toFixed(1) ?? '0.0';
  const compass = ['N','NE','L','SE','S','SO','O','NO','N'][Math.round(((tel?.heading??0)%360)/45)];
  const timeLeft = tel?.timeLeft ?? MISSIONS[selIdx].timeLimit;
  const timeColor = timeLeft > 60 ? '#94a3b8' : timeLeft > 20 ? '#f59e0b' : '#ef4444';

  return (
    <div ref={wrapRef} tabIndex={0} onKeyDown={onKD} onKeyUp={onKU} className="outline-none select-none"
      style={{ background:'#020810', minHeight:'100vh', display:'flex', flexDirection:'column' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-1.5 shrink-0"
        style={{ background:'rgba(0,0,0,0.88)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-black font-mono" style={{ color:battCol }}>{Math.round(tel?.battery??MISSIONS[selIdx].bat)}%</span>
            <div className="w-8 h-2.5 rounded-sm overflow-hidden" style={{ background:'#1e293b', border:'1px solid #334155' }}>
              <div className="h-full rounded-sm transition-all" style={{ width:`${tel?.battery??MISSIONS[selIdx].bat}%`, background:battCol }} />
            </div>
          </div>
          <div className="flex items-end gap-0.5 h-4">
            {[1,2,3,4].map(b => (
              <div key={b} className="rounded-sm w-1" style={{ height:`${4+b*3}px`, background:(tel?.signal??98)>b*22?sigCol:'#1e293b' }} />
            ))}
          </div>
          <span className="text-[10px] font-mono" style={{ color:'#475569' }}>GPS {Math.round((tel?.signal??98)/10)} sat</span>
        </div>

        <div className="text-center">
          {tel?.rth && <span className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse" style={{ background:'rgba(239,68,68,0.2)', color:'#f87171', border:'1px solid rgba(239,68,68,0.3)' }}>🏠 RTH</span>}
          {!tel?.rth && (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono" style={{ color:'#475569' }}>
                {tel?.delivered??0}/{tel?.total??MISSIONS[selIdx].n} · {tel?.spot ? tel.spot.nome : 'aguardando'}
              </span>
              {tel?.combo > 1 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background:'rgba(251,191,36,0.15)', color:'#fbbf24' }}>{tel.combo}×</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-black font-mono" style={{ color:timeColor }}>
              {String(Math.floor(timeLeft/60)).padStart(2,'0')}:{String(timeLeft%60).padStart(2,'0')}
            </span>
            {timeLeft <= 20 && <span className="text-[9px] animate-pulse" style={{ color:'#ef4444' }}>!</span>}
          </div>
          <button onClick={() => { cancelAnimationFrame(rafRef.current); setScreen('menu'); }}
            className="text-[10px] px-2 py-0.5 rounded font-mono"
            style={{ color:'#475569', border:'1px solid #1e293b' }}>ESC</button>
        </div>
      </div>

      {/* Canvas principal + minimap */}
      <div className="relative flex-1" style={{ minHeight:0 }}>
        <canvas ref={camRef} width={900} height={520}
          style={{ width:'100%', height:'100%', display:'block', objectFit:'fill' }} />

        <div className="absolute bottom-3 right-3" style={{ width:160, height:160 }}>
          <canvas ref={mapRef} width={160} height={160}
            style={{ width:'100%', height:'100%', display:'block', borderRadius:6, border:'1px solid rgba(255,255,255,0.1)' }} />
        </div>

        {/* Winch overlay */}
        {tel?.winching && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <div className="px-4 py-2 rounded-xl" style={{ background:'rgba(0,0,0,0.8)', border:'1px solid rgba(251,191,36,0.5)' }}>
              <p className="text-xs font-black" style={{ color:'#fbbf24' }}>📦 GUINCHO ATIVO</p>
              <div className="mt-1.5 h-2.5 w-36 rounded-full" style={{ background:'#1e293b' }}>
                <div className="h-full rounded-full" style={{ width:`${(tel.winch??0)*100}%`, background:'linear-gradient(90deg,#fbbf24,#f97316)' }} />
              </div>
              <p className="text-[9px] mt-0.5 font-mono" style={{ color:'#94a3b8' }}>{Math.round((tel.winch??0)*100)}%</p>
            </div>
          </div>
        )}

        {/* Log overlay */}
        <div className="absolute top-2 left-2 pointer-events-none">
          {logLines.slice(0,4).map((l,i) => (
            <p key={i} className="text-[8px] font-mono" style={{ color:i===0?'rgba(96,165,250,0.9)':'rgba(51,65,85,0.8)', textShadow:'0 0 4px #000' }}>{l}</p>
          ))}
        </div>
      </div>

      {/* Telemetria inferior */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 flex-wrap gap-2"
        style={{ background:'rgba(0,0,0,0.9)', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        {[
          { label:'ALT (m)',   value:tel?.alt??0,   color:'#60a5fa',  big:true  },
          { label:'H.VEL km/h',value:tel?.spd??0,   color:'#94a3b8',  big:true  },
          { label:'V.VEL m/s', value:`${parseFloat(tel?.vspd??0)>0?'+':''}${tel?.vspd??'0.0'}`, color:parseFloat(tel?.vspd??0)>0?'#22c55e':'#ef4444', big:false },
          { label:'DIST (m)',  value:tel?.dist??0,  color:'#94a3b8',  big:true  },
          { label:'RUMO',      value:`${compass} ${tel?.heading??0}°`, color:'#94a3b8', big:false },
          { label:'VENTO m/s', value:windMs,        color:parseFloat(windMs)>2.5?'#f59e0b':'#22c55e', big:false },
          { label:'GIMBAL',    value:`${tel?.gimbal??-69}°`, color:'#94a3b8', big:false },
        ].map((item, i, a) => (
          <React.Fragment key={item.label}>
            <div className="text-center min-w-[44px]">
              <div className="text-[8px] font-mono mb-0.5" style={{ color:'#475569' }}>{item.label}</div>
              <div className={`font-black font-mono ${item.big?'text-xl':'text-sm'}`} style={{ color:item.color }}>{item.value}</div>
            </div>
            {i < a.length-1 && <div className="w-px h-8" style={{ background:'rgba(255,255,255,0.06)' }} />}
          </React.Fragment>
        ))}

        <div className="flex gap-1.5 ml-auto">
          {tel?.spot && !tel?.winching && (
            <button onMouseDown={() => {
              const g = gameRef.current; if (!g) return;
              const d=g.drone, spot=g.spot; if(!spot) return;
              const dist = Math.hypot(d.x-spot.x, d.y-spot.y);
              if (dist < spot.r+15 && d.alt>=spot.alt_min && d.alt<=spot.alt_max) g.winching=true;
            }}
              className="px-3 py-1 rounded-xl text-[10px] font-black active:scale-95"
              style={{ background:'rgba(251,191,36,0.12)', color:'#fbbf24', border:'1px solid rgba(251,191,36,0.3)' }}>
              📦 F
            </button>
          )}
          <button onMouseDown={() => { const g=gameRef.current; if(g) { g.rth=!g.rth; } }}
            className="px-3 py-1 rounded-xl text-[10px] font-black active:scale-95"
            style={{ background:tel?.rth?'rgba(239,68,68,0.25)':'rgba(239,68,68,0.08)', color:'#f87171', border:'1px solid rgba(239,68,68,0.2)' }}>
            🏠 R
          </button>
        </div>
      </div>

      {/* Joystick mobile */}
      <div className="flex lg:hidden items-center justify-between px-4 py-3 shrink-0"
        style={{ background:'rgba(0,0,0,0.92)', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center touch-none select-none"
          style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)' }}
          onTouchStart={onJoyS} onTouchMove={onJoyM} onTouchEnd={onJoyE}>
          <p className="text-[8px] font-mono" style={{ color:'#334155' }}>MOVER</p>
        </div>
        <div className="flex flex-col gap-2">
          <button className="w-14 h-10 rounded-xl font-black text-base active:scale-90 touch-none select-none"
            style={{ background:'rgba(34,197,94,0.12)', color:'#22c55e', border:'1px solid rgba(34,197,94,0.3)' }}
            onTouchStart={() => { touchRef.current.up=true; }} onTouchEnd={() => { touchRef.current.up=false; }}>▲</button>
          <button className="w-14 h-10 rounded-xl font-black text-base active:scale-90 touch-none select-none"
            style={{ background:'rgba(239,68,68,0.12)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.3)' }}
            onTouchStart={() => { touchRef.current.down=true; }} onTouchEnd={() => { touchRef.current.down=false; }}>▼</button>
        </div>
      </div>
    </div>
  );
}
