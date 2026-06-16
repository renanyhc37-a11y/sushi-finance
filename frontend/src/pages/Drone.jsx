import React, { useEffect, useRef, useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════
//  SUSHI DRONE SIM — DJI Flight Style · 37 Sushi Paranavaí
// ═══════════════════════════════════════════════════════════

// ── Mundo (metros) ────────────────────────────────────────
const BASE = { x: 450, y: 350 };

// Prédios 3D: { x, y (SW corner), w, d (depth N), h (altura), col:[r,g,b] }
const BLDGS = [
  { x:100, y:40,  w:130, d:100, h:48, col:[40,68,105] },
  { x:260, y:60,  w:80,  d:70,  h:22, col:[30,52,80]  },
  { x:360, y:45,  w:110, d:90,  h:35, col:[38,60,94]  },
  { x:500, y:40,  w:100, d:95,  h:44, col:[44,70,108] },
  { x:630, y:50,  w:120, d:85,  h:28, col:[34,56,86]  },
  { x:770, y:38,  w:110, d:105, h:56, col:[50,76,116] },
  { x:60,  y:150, w:110, d:90,  h:34, col:[40,64,98]  },
  { x:60,  y:280, w:100, d:90,  h:20, col:[28,46,72]  },
  { x:60,  y:400, w:115, d:90,  h:46, col:[48,72,110] },
  { x:160, y:190, w:75,  d:65,  h:14, col:[25,42,65]  },
  { x:200, y:310, w:85,  d:75,  h:30, col:[36,58,90]  },
  { x:310, y:200, w:95,  d:80,  h:18, col:[30,50,78]  },
  { x:560, y:210, w:90,  d:80,  h:24, col:[34,56,86]  },
  { x:650, y:190, w:80,  d:70,  h:38, col:[44,68,104] },
  { x:760, y:170, w:110, d:85,  h:40, col:[46,70,108] },
  { x:760, y:280, w:100, d:85,  h:26, col:[36,58,88]  },
  { x:760, y:390, w:110, d:85,  h:52, col:[52,78,118] },
  { x:660, y:300, w:95,  d:80,  h:36, col:[42,66,102] },
  { x:80,  y:470, w:105, d:85,  h:22, col:[32,52,80]  },
  { x:220, y:460, w:125, d:95,  h:38, col:[42,66,100] },
  { x:380, y:480, w:85,  d:75,  h:16, col:[28,46,70]  },
  { x:510, y:455, w:105, d:100, h:42, col:[46,70,108] },
  { x:650, y:465, w:95,  d:85,  h:30, col:[38,60,92]  },
  { x:770, y:472, w:105, d:85,  h:24, col:[34,54,82]  },
];

// Parques (planos verdes em z=0)
const PARKS = [
  { x:155, y:155, w:180, h:120, col:[14,48,26] },
  { x:500, y:148, w:220, h:120, col:[12,44,24] },
  { x:295, y:375, w:190, h:135, col:[14,46,26] },
  { x:118, y:372, w:155, h:115, col:[12,44,24] },
  { x:555, y:342, w:185, h:140, col:[14,48,26] },
];

// Ruas (planos cinzas)
const ROADS = [
  { x:0,   y:195, w:900, h:18 },
  { x:0,   y:325, w:900, h:18 },
  { x:0,   y:440, w:900, h:18 },
  { x:195, y:0,   w:18,  h:700 },
  { x:415, y:0,   w:18,  h:700 },
  { x:625, y:0,   w:18,  h:700 },
];

// Pontos de entrega
const SPOTS = [
  { id:'D1', x:155, y:110, r:28, nome:'Rua Norte, 12',    alt_min:8,  alt_max:22 },
  { id:'D2', x:700, y:95,  r:28, nome:'Av. Central, 88',  alt_min:15, alt_max:35 },
  { id:'D3', x:155, y:530, r:28, nome:'Rua Sul, 3',       alt_min:8,  alt_max:20 },
  { id:'D4', x:720, y:530, r:28, nome:'Bairro Eco, 44',   alt_min:5,  alt_max:18 },
  { id:'D5', x:55,  y:315, r:28, nome:'Av. Oeste, 22',    alt_min:10, alt_max:28 },
  { id:'D6', x:850, y:340, r:28, nome:'Rua Extremo, 5',   alt_min:12, alt_max:30 },
];

const SCENARIOS = [
  { id:'T', nome:'Tutorial',        icon:'🟢', wind:0,   night:false, n:1, desc:'Sem vento · 1 entrega' },
  { id:'B', nome:'Operação Básica', icon:'🟡', wind:1.4, night:false, n:3, desc:'Vento leve · 3 entregas' },
  { id:'A', nome:'Vento Forte',     icon:'🔴', wind:3.0, night:false, n:3, desc:'Condições adversas · 3 entregas' },
  { id:'N', nome:'Turno Noturno',   icon:'🌙', wind:1.8, night:true,  n:3, desc:'Visibilidade reduzida · 3 entregas' },
];

// ── Física ────────────────────────────────────────────────
const MAX_H_SPEED = 12; // m/s
const MAX_V_SPEED = 5;
const H_ACCEL     = 0.45;
const H_DRAG      = 0.87;
const YAW_RATE    = 0.045;
const ALT_ACCEL   = 0.18;
const BATT_IDLE   = 0.004;
const BATT_MOVE   = 0.007;
const BATT_CLIMB  = 0.012;
const WINCH_SPEED = 0.06; // fraction/frame
const FOV_DEG     = 72;

// ── Camera math ───────────────────────────────────────────
function getVecs(heading, pitch) {
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  const sinH = Math.sin(heading), cosH = Math.cos(heading);
  const fwd  = { x: sinH * cosP, y: cosH * cosP, z: sinP };
  // Handle gimbal lock (straight up/down)
  if (Math.abs(cosP) < 0.001) {
    const s = pitch < 0 ? 1 : -1;
    return {
      fwd,
      right: { x: cosH,       y: -sinH,      z: 0 },
      up:    { x: sinH * s,   y: cosH * s,   z: 0 },
    };
  }
  const rLen  = Math.sqrt(fwd.y * fwd.y + fwd.x * fwd.x) || 1;
  const right = { x: fwd.y / rLen, y: -fwd.x / rLen, z: 0 };
  const up    = {
    x: right.y * fwd.z - right.z * fwd.y,
    y: right.z * fwd.x - right.x * fwd.z,
    z: right.x * fwd.y - right.y * fwd.x,
  };
  return { fwd, right, up };
}

function proj(wx, wy, wz, d, sw, sh) {
  const { fwd, right, up } = getVecs(d.heading, d.gimbal);
  const dx = wx - d.x, dy = wy - d.y, dz = wz - d.alt;
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const v   = { x: dx, y: dy, z: dz };
  const cz  = dot(v, fwd);
  if (cz < 0.5) return null;
  const f   = (sw / 2) / Math.tan((FOV_DEG * Math.PI) / 360);
  return {
    x: dot(v, right) / cz * f + sw / 2,
    y: -dot(v, up)   / cz * f + sh / 2,
    z: cz,
    s: f / cz,
  };
}

// ── Render 3D camera ──────────────────────────────────────
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function rgb(r, g, b) { return `rgb(${clamp(r,0,255)},${clamp(g,0,255)},${clamp(b,0,255)})`; }

function polyScreen(ctx, pts, color, alpha) {
  if (pts.length < 3) return;
  if (pts.some(p => !p)) return;
  ctx.globalAlpha = alpha ?? 1;
  ctx.fillStyle   = color;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function render3D(ctx, drone, spots, activeSpot, frame, night) {
  const W = ctx.canvas.width, H = ctx.canvas.height;

  // ── Sky / ground fill ────────────────────────────────
  const skyLo   = night ? '#020812' : '#0d1f3c';
  const skyHi   = night ? '#000508' : '#071528';
  const gndCol  = night ? '#050d0a' : '#0b1a10';
  const gnd     = night ? [6, 18, 10]   : [14, 36, 18];

  const grd = ctx.createLinearGradient(0, 0, 0, H * 0.4);
  grd.addColorStop(0, skyHi);
  grd.addColorStop(1, skyLo);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H * 0.4);
  ctx.fillStyle = gndCol;
  ctx.fillRect(0, H * 0.4, W, H * 0.6);

  // ── Ground plane (projected grid) ────────────────────
  // Sample a grid of ground points around the drone
  const STEP = 40, RANGE = 400;
  const gridPts = [];
  for (let gx = -RANGE; gx <= RANGE; gx += STEP) {
    for (let gy = -RANGE; gy <= RANGE; gy += STEP) {
      const p = proj(drone.x + gx, drone.y + gy, 0, drone, W, H);
      if (p && p.x > -100 && p.x < W + 100 && p.y > -100 && p.y < H + 100) {
        gridPts.push({ wx: gx, wy: gy, sx: p.x, sy: p.y });
      }
    }
  }

  // Draw road patches
  ROADS.forEach(r => {
    const corners = [
      proj(r.x,     r.y,     0, drone, W, H),
      proj(r.x+r.w, r.y,     0, drone, W, H),
      proj(r.x+r.w, r.y+r.h, 0, drone, W, H),
      proj(r.x,     r.y+r.h, 0, drone, W, H),
    ];
    polyScreen(ctx, corners, night ? '#0d1520' : '#111e2c');
  });

  // Draw park patches
  PARKS.forEach(p => {
    const corners = [
      proj(p.x,     p.y,     0, drone, W, H),
      proj(p.x+p.w, p.y,     0, drone, W, H),
      proj(p.x+p.w, p.y+p.h, 0, drone, W, H),
      proj(p.x,     p.y+p.h, 0, drone, W, H),
    ];
    polyScreen(ctx, corners, rgb(...p.col));
  });

  // ── Buildings ─────────────────────────────────────────
  // Sort back to front (painter's algorithm)
  const sorted = [...BLDGS].sort((a, b) => {
    const ca = Math.hypot(a.x + a.w / 2 - drone.x, a.y + a.d / 2 - drone.y);
    const cb = Math.hypot(b.x + b.w / 2 - drone.x, b.y + b.d / 2 - drone.y);
    return cb - ca;
  });

  sorted.forEach(b => {
    const [r, g, bl] = b.col;
    // 8 corners: bottom (z=0) then top (z=h)
    const corners = [
      [b.x,     b.y,     0], [b.x+b.w, b.y,     0],
      [b.x+b.w, b.y+b.d, 0], [b.x,     b.y+b.d, 0],
      [b.x,     b.y,     b.h], [b.x+b.w, b.y,     b.h],
      [b.x+b.w, b.y+b.d, b.h], [b.x,     b.y+b.d, b.h],
    ].map(([x, y, z]) => proj(x, y, z, drone, W, H));

    const [p0,p1,p2,p3,p4,p5,p6,p7] = corners;

    // Top face
    polyScreen(ctx, [p4,p5,p6,p7], rgb(r+22, g+28, bl+35));

    // South face (y = b.y) — visible if drone.y < b.y
    if (drone.y <= b.y + b.d / 2)
      polyScreen(ctx, [p0,p1,p5,p4], rgb(r+8, g+12, bl+18));

    // North face (y = b.y+b.d)
    if (drone.y >= b.y + b.d / 2)
      polyScreen(ctx, [p3,p2,p6,p7], rgb(r-6, g-4, bl+2));

    // East face (x = b.x+b.w)
    if (drone.x >= b.x + b.w / 2)
      polyScreen(ctx, [p1,p2,p6,p5], rgb(r+4, g+8, bl+14));

    // West face (x = b.x)
    if (drone.x <= b.x + b.w / 2)
      polyScreen(ctx, [p0,p3,p7,p4], rgb(r-8, g-5, bl+0));

    // Night windows on top face
    if (night && p4 && p5 && p6 && p7) {
      const cx = (p4.x + p5.x + p6.x + p7.x) / 4;
      const cy = (p4.y + p5.y + p6.y + p7.y) / 4;
      const sc = p4.s * 18;
      const rows = Math.floor(b.h / 10), cols = Math.floor(b.w / 14);
      for (let ri = 0; ri < Math.min(rows, 4); ri++) {
        for (let ci = 0; ci < Math.min(cols, 5); ci++) {
          const seed = (b.x + b.y + ri * 7 + ci * 11) % 10;
          if (seed > 5) continue;
          ctx.fillStyle = `rgba(255,220,100,${0.1 + seed * 0.03})`;
          ctx.fillRect(cx - sc * 0.6 + ci * (sc * 0.28), cy - sc * 0.4 + ri * (sc * 0.22), sc * 0.15, sc * 0.12);
        }
      }
    }
  });

  // ── Base helipad ─────────────────────────────────────
  const bp = proj(BASE.x, BASE.y, 0, drone, W, H);
  if (bp) {
    const sc = clamp(bp.s * 30, 4, 80);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth   = 2;
    ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(bp.x, bp.y, sc, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(bp.x, bp.y, sc * 0.6, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle   = '#f97316';
    ctx.font        = `bold ${clamp(sc * 0.7, 8, 22)}px monospace`;
    ctx.textAlign   = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', bp.x, bp.y);
    ctx.textAlign   = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // ── Delivery zones ────────────────────────────────────
  spots.forEach(spot => {
    const sp = proj(spot.x, spot.y, 0, drone, W, H);
    if (!sp) return;
    const sc    = clamp(sp.s * spot.r, 5, 60);
    const isAct = activeSpot?.id === spot.id;
    const pulse = Math.abs(Math.sin(frame * 0.07));

    ctx.strokeStyle = isAct ? '#fbbf24' : 'rgba(251,191,36,0.4)';
    ctx.lineWidth   = isAct ? 2.5 : 1;
    ctx.globalAlpha = isAct ? (0.6 + pulse * 0.3) : 0.4;
    ctx.beginPath(); ctx.arc(sp.x, sp.y, sc * (isAct ? 1 + pulse * 0.1 : 1), 0, Math.PI * 2); ctx.stroke();
    if (isAct) {
      ctx.fillStyle = 'rgba(251,191,36,0.08)';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ID label
    ctx.fillStyle   = isAct ? '#fbbf24' : 'rgba(251,191,36,0.5)';
    ctx.font        = `bold ${clamp(sp.s * 12, 7, 16)}px monospace`;
    ctx.textAlign   = 'center';
    ctx.fillText(spot.id, sp.x, sp.y - sc - 4);
    ctx.textAlign   = 'left';
  });

  // ── Camera overlays ───────────────────────────────────
  // Vignette
  const vig = ctx.createRadialGradient(W/2, H/2, H*0.25, W/2, H/2, H*0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);

  // Crosshair
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth   = 1;
  const cx2 = W / 2, cy2 = H / 2;
  ctx.beginPath(); ctx.moveTo(cx2 - 20, cy2); ctx.lineTo(cx2 - 6, cy2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx2 + 6,  cy2); ctx.lineTo(cx2 + 20, cy2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx2, cy2 - 20); ctx.lineTo(cx2, cy2 - 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx2, cy2 + 6);  ctx.lineTo(cx2, cy2 + 20); ctx.stroke();

  // REC indicator
  if (frame % 60 < 40) {
    ctx.fillStyle = '#ef4444';
    ctx.beginPath(); ctx.arc(16, 16, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font      = 'bold 10px monospace';
    ctx.fillText('REC', 24, 20);
  }

  // Timestamp
  const now = new Date();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font      = '9px monospace';
  ctx.fillText(now.toTimeString().slice(0, 8), W - 70, 14);

  // Gimbal angle indicator (right side)
  const gimbalDeg = Math.round(drone.gimbal * 180 / Math.PI);
  ctx.fillStyle   = 'rgba(255,255,255,0.4)';
  ctx.font        = '9px monospace';
  ctx.textAlign   = 'right';
  ctx.fillText(`G ${gimbalDeg}°`, W - 4, H - 8);
  ctx.textAlign   = 'left';

  // Grid lines (corner markers — like DJI)
  const gl = 20;
  [
    [0, 0, gl, 0, 0, gl],
    [W, 0, W-gl, 0, W, gl],
    [0, H, gl, H, 0, H-gl],
    [W, H, W-gl, H, W, H-gl],
  ].forEach(([x1,y1,x2,y2,x3,y3]) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.moveTo(x1, y1); ctx.lineTo(x3, y3);
    ctx.stroke();
  });

  // Night overlay
  if (night) {
    ctx.fillStyle = 'rgba(0,10,20,0.22)';
    ctx.fillRect(0, 0, W, H);
  }
}

// ── Minimap ───────────────────────────────────────────────
function renderMinimap(ctx, drone, spots, activeSpot, trails, night) {
  const S   = ctx.canvas.width;
  const scl = S / 900; // world 900px → map S px

  ctx.fillStyle = night ? 'rgba(0,8,18,0.92)' : 'rgba(8,18,32,0.88)';
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth   = 1;
  ctx.strokeRect(0, 0, S, S);

  // Roads
  ROADS.forEach(r => {
    ctx.fillStyle = night ? '#0a1520' : '#111e2e';
    ctx.fillRect(r.x * scl, r.y * scl, r.w * scl, r.h * scl);
  });

  // Parks
  PARKS.forEach(p => {
    ctx.fillStyle = rgb(...p.col);
    ctx.fillRect(p.x * scl, p.y * scl, p.w * scl, p.h * scl);
  });

  // Buildings
  BLDGS.forEach(b => {
    const shade = Math.round(b.h / 4);
    ctx.fillStyle = rgb(b.col[0] + shade, b.col[1] + shade, b.col[2] + shade + 10);
    ctx.fillRect(b.x * scl, b.y * scl, b.w * scl, b.d * scl);
  });

  // Delivery spots
  spots.forEach(spot => {
    const isAct = activeSpot?.id === spot.id;
    ctx.strokeStyle = isAct ? '#fbbf24' : 'rgba(251,191,36,0.4)';
    ctx.lineWidth   = isAct ? 1.5 : 1;
    ctx.beginPath();
    ctx.arc(spot.x * scl, spot.y * scl, spot.r * scl, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(251,191,36,0.15)';
    if (isAct) ctx.fill();
    ctx.fillStyle = isAct ? '#fbbf24' : 'rgba(251,191,36,0.5)';
    ctx.font      = `bold ${Math.round(6 * scl + 4)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(spot.id, spot.x * scl, spot.y * scl - spot.r * scl - 2);
    ctx.textAlign = 'left';
  });

  // Base
  ctx.strokeStyle = '#f97316';
  ctx.lineWidth   = 1.5;
  ctx.beginPath(); ctx.arc(BASE.x * scl, BASE.y * scl, 8, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle   = '#f97316';
  ctx.font        = 'bold 8px monospace';
  ctx.textAlign   = 'center';
  ctx.fillText('H', BASE.x * scl, BASE.y * scl + 3);
  ctx.textAlign   = 'left';

  // Trail
  trails.forEach((t, i) => {
    ctx.globalAlpha = (i / trails.length) * 0.5;
    ctx.fillStyle   = '#60a5fa';
    ctx.fillRect(t.x * scl - 1, t.y * scl - 1, 2, 2);
  });
  ctx.globalAlpha = 1;

  // Drone icon
  const dx2 = drone.x * scl, dy2 = drone.y * scl;
  ctx.save();
  ctx.translate(dx2, dy2);
  ctx.rotate(drone.heading);
  ctx.fillStyle   = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -6); ctx.lineTo(4, 5); ctx.lineTo(0, 3); ctx.lineTo(-4, 5); ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Label "MAPA"
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.font      = '7px monospace';
  ctx.fillText('MAPA', 3, 8);
}

// ── Init ──────────────────────────────────────────────────
function initGame(scen) {
  const queue = [...SPOTS].sort(() => Math.random() - 0.5).slice(0, scen.n);
  return {
    scen,
    drone: { x: BASE.x, y: BASE.y, alt: 0, vx: 0, vy: 0, vz: 0, heading: 0, gimbal: -1.2 },
    battery: 100,
    signal:  98,
    wind:    { angle: Math.random() * Math.PI * 2, speed: scen.wind },
    windT:   0,
    queue,
    spot:    null,
    winch:   0,
    winching: false,
    pkgOk:   false,
    delivered: 0,
    score:   0,
    frame:   0,
    t0:      Date.now(),
    log:     ['[00:00] Aguardando pedido...'],
    trails:  [],
    particles: [],
    over:    false,
    rth:     false,
    statusMsg: '',
    statusT:   0,
  };
}

// ── Main component ────────────────────────────────────────
export default function Drone() {
  const camRef   = useRef(null);
  const mapRef   = useRef(null);
  const wrapRef  = useRef(null);
  const gameRef  = useRef(null);
  const rafRef   = useRef(null);
  const keysRef  = useRef({});
  const touchRef = useRef({ dx: 0, dy: 0, up: false, down: false });

  const [screen,  setScreen]  = useState('menu');
  const [selScen, setSelScen] = useState(0);
  const [tel,     setTel]     = useState(null);
  const [logLines,setLog]     = useState([]);
  const [results, setResults] = useState(null);

  // ── Keyboard ─────────────────────────────────────────
  const onKD = useCallback(e => {
    const g = ['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','Space',
               'ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
               'KeyF','KeyR','BracketLeft','BracketRight'];
    if (g.includes(e.code)) e.preventDefault();
    keysRef.current[e.code] = true;
  }, []);
  const onKU = useCallback(e => { delete keysRef.current[e.code]; }, []);

  useEffect(() => {
    if (screen === 'game') setTimeout(() => wrapRef.current?.focus(), 80);
  }, [screen]);

  // ── Touch joystick ────────────────────────────────────
  const joyOrig = useRef(null);
  const onJoyS  = e => { const t = e.changedTouches[0]; joyOrig.current = { x: t.clientX, y: t.clientY }; };
  const onJoyM  = e => {
    e.preventDefault();
    if (!joyOrig.current) return;
    const t = e.changedTouches[0];
    touchRef.current.dx = Math.max(-1, Math.min(1, (t.clientX - joyOrig.current.x) / 55));
    touchRef.current.dy = Math.max(-1, Math.min(1, (t.clientY - joyOrig.current.y) / 55));
  };
  const onJoyE  = () => { joyOrig.current = null; touchRef.current.dx = 0; touchRef.current.dy = 0; };

  // ── Game loop ─────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'game') { cancelAnimationFrame(rafRef.current); return; }
    const camCanvas = camRef.current;
    const mapCanvas = mapRef.current;
    if (!camCanvas || !mapCanvas) return;
    const ctx2d = camCanvas.getContext('2d');
    const mCtx  = mapCanvas.getContext('2d');

    function addLog(g, msg) {
      const ms = Date.now() - g.t0;
      const ts = `${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
      g.log.unshift(`[${ts}] ${msg}`);
      if (g.log.length > 10) g.log.pop();
    }

    function endGame(g, reason) {
      if (g.over) return;
      g.over = true;
      cancelAnimationFrame(rafRef.current);
      const t = Math.floor((Date.now() - g.t0) / 1000);
      setResults({ reason, score: g.score, delivered: g.delivered, total: g.scen.n,
        battery: Math.round(g.battery), time: t, scen: g.scen, log: [...g.log] });
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

      // Vento oscila
      g.windT++;
      if (g.windT > 220) {
        g.windT = 0;
        const b = g.scen.wind;
        g.wind = { angle: g.wind.angle + (Math.random() - 0.5) * 0.9, speed: Math.max(0, b + (Math.random() - 0.5) * b * 0.7) };
      }

      // Controles
      const pW = keys['KeyW'] || keys['ArrowUp']    || tch.dy < -0.25;
      const pS = keys['KeyS'] || keys['ArrowDown']  || tch.dy >  0.25;
      const pA = keys['KeyA'] || keys['ArrowLeft'];
      const pD = keys['KeyD'] || keys['ArrowRight'];
      const pE = keys['KeyE'] || keys['Space'] || tch.up;
      const pQ = keys['KeyQ'] || tch.down;
      const pF = keys['KeyF'];
      const pR = keys['KeyR'];
      const pGL = keys['BracketLeft'];
      const pGR = keys['BracketRight'];

      // Gimbal
      if (pGL) d.gimbal = Math.max(-Math.PI / 2, d.gimbal - 0.025);
      if (pGR) d.gimbal = Math.min(-0.2, d.gimbal + 0.025);

      // Yaw (A/D ou touch lateral sem joystick)
      const yawL = keys['ArrowLeft']  || tch.dx < -0.25;
      const yawR = keys['ArrowRight'] || tch.dx >  0.25;
      if (pA && !yawL) d.heading -= YAW_RATE;
      if (pD && !yawR) d.heading += YAW_RATE;
      if (yawL) d.heading -= YAW_RATE;
      if (yawR) d.heading += YAW_RATE;

      // RTH
      if (pR && !g.rth) { g.rth = true; addLog(g, '🏠 RTH ativado'); }
      if ((pW || pS) && g.rth) { g.rth = false; addLog(g, '✋ RTH cancelado'); }

      // Próximo pedido
      if (!g.spot && g.queue.length > 0) {
        g.spot = g.queue.shift();
        g.pkgOk = false;
        g.winch = 0;
        addLog(g, `📋 Missão: ${g.spot.nome}`);
      }

      // Guincho
      if (pF && !g.winching && d.alt > 1 && g.spot && !g.pkgOk) {
        const dist = Math.hypot(d.x - g.spot.x, d.y - g.spot.y);
        const ok   = dist < g.spot.r + 15 && d.alt >= g.spot.alt_min && d.alt <= g.spot.alt_max;
        if (ok) { g.winching = true; addLog(g, '📦 Guincho ativado'); }
        else addLog(g, `⚠ Reposicione — alt ideal ${g.spot.alt_min}–${g.spot.alt_max}m`);
      }
      if (g.winching) {
        g.winch = Math.min(1, g.winch + WINCH_SPEED);
        if (g.winch >= 1) {
          g.winching = false; g.pkgOk = true; g.winch = 0;
          const battB = Math.round(g.battery * 0.6);
          const ms    = Date.now() - g.t0;
          const timeB = Math.max(0, Math.round(600 - ms / 1000 * 3));
          const pts   = 200 + battB + timeB;
          g.score += pts;
          g.delivered++;
          addLog(g, `✅ Entregue! +${pts} pts`);
          g.spot = null;
          if (g.delivered >= g.scen.n) { setTimeout(() => endGame(g, 'success'), 1500); return; }
        }
      }

      // Física
      let ax = 0, ay = 0;
      if (g.rth) {
        const tx = BASE.x - d.x, ty = BASE.y - d.y;
        const dist = Math.hypot(tx, ty);
        if (dist > 8) {
          const spd = Math.min(dist * 0.06, MAX_H_SPEED * 0.5);
          ax = (tx / dist) * spd * 0.08;
          ay = (ty / dist) * spd * 0.08;
          if (d.alt < 50) d.alt = Math.min(50, d.alt + 0.5);
        } else {
          d.alt = Math.max(0, d.alt - 1.2);
          if (d.alt <= 0) { d.alt = 0; d.vx = 0; d.vy = 0; g.rth = false; addLog(g, '✅ Pousou na base'); }
        }
      } else {
        // Movimento relativo ao heading do drone
        const cosH = Math.cos(d.heading), sinH = Math.sin(d.heading);
        let fwdF = 0, rgtF = 0;
        if (pW) fwdF =  1;
        if (pS) fwdF = -1;
        // Strafe com setas (já usadas para yaw se A/D)
        ax += (fwdF * sinH) * H_ACCEL;
        ay += (fwdF * cosH) * H_ACCEL;
        if (fwdF !== 0 && d.alt < 5) d.alt = Math.min(MAX_H_SPEED, d.alt + 0.8); // auto-lift
      }

      // Altitude
      if (pE && !g.rth) d.vz = Math.min(MAX_V_SPEED, d.vz + ALT_ACCEL);
      else if (pQ && !g.rth) d.vz = Math.max(-MAX_V_SPEED, d.vz - ALT_ACCEL);
      else d.vz *= 0.82;

      d.alt = Math.max(0, Math.min(150, d.alt + d.vz));

      // Vento
      const wf = 0.3 + (d.alt / 150) * 0.7;
      ax += Math.cos(g.wind.angle) * g.wind.speed * 0.03 * wf;
      ay += Math.sin(g.wind.angle) * g.wind.speed * 0.03 * wf;

      d.vx = (d.vx + ax) * H_DRAG;
      d.vy = (d.vy + ay) * H_DRAG;
      const spd = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
      if (spd > MAX_H_SPEED) { d.vx = d.vx / spd * MAX_H_SPEED; d.vy = d.vy / spd * MAX_H_SPEED; }

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

      // Sinal (distância da base)
      g.signal = Math.max(18, 98 - Math.hypot(d.x - BASE.x, d.y - BASE.y) * 0.06);

      // Trail
      if (d.alt > 2 && g.frame % 5 === 0) {
        g.trails.push({ x: d.x, y: d.y });
        if (g.trails.length > 80) g.trails.shift();
      }

      // ── Render ────────────────────────────────────────
      const CW = camCanvas.width, CH = camCanvas.height;
      render3D(ctx2d, d, SPOTS, g.spot, g.frame, g.scen.night);
      renderMinimap(mCtx, d, SPOTS, g.spot, g.trails, g.scen.night);

      // Sync telemetria
      if (g.frame % 3 === 0) {
        const ms = Date.now() - g.t0;
        setTel({
          battery: g.battery, signal: g.signal,
          alt: Math.round(d.alt), spd: Math.round(spd * 3.6),
          vspd: d.vz.toFixed(1),
          heading: Math.round(((d.heading * 180 / Math.PI) % 360 + 360) % 360),
          dist: Math.round(Math.hypot(d.x - BASE.x, d.y - BASE.y)),
          wind: g.wind, gimbal: Math.round(d.gimbal * 180 / Math.PI),
          delivered: g.delivered, total: g.scen.n,
          spot: g.spot, winching: g.winching, winch: g.winch,
          rth: g.rth, battery_warn: g.battery < 25,
          time: Math.floor(ms / 1000),
        });
        setLog([...g.log]);
      }
    }

    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen]);

  function startGame() {
    gameRef.current = initGame(SCENARIOS[selScen]);
    setTel(null); setLog([]);
    setScreen('game');
  }

  // ── MENU ─────────────────────────────────────────────
  if (screen === 'menu') return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'var(--space-bg)' }}>
      <div style={{ fontSize: 52 }}>🚁</div>
      <h1 className="text-3xl font-black mt-2" style={{ color: 'var(--accent)' }}>SUSHI DRONE SIM</h1>
      <p className="text-sm mt-1 mb-1" style={{ color: 'var(--txt-dim)' }}>Simulador DJI · 37 Sushi Paranavaí</p>
      <div className="mb-7 px-3 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)' }}>
        Vista de câmera 3D · Física real · Modo DJI
      </div>

      <div className="w-full max-w-lg space-y-2 mb-6">
        {SCENARIOS.map((s, i) => (
          <button key={s.id} onClick={() => setSelScen(i)}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-left transition-all"
            style={{ background: selScen === i ? 'rgba(var(--accent-rgb),0.1)' : 'var(--space-elev)', border: `1px solid ${selScen === i ? 'rgba(var(--accent-rgb),0.4)' : 'var(--hairline)'}` }}>
            <span style={{ fontSize: 20 }}>{s.icon}</span>
            <div className="flex-1">
              <p className="font-black text-sm" style={{ color: 'var(--txt)' }}>{s.nome}</p>
              <p className="text-xs" style={{ color: 'var(--txt-dim)' }}>{s.desc}</p>
            </div>
            {selScen === i && <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)' }}>✓</span>}
          </button>
        ))}
      </div>

      <div className="w-full max-w-lg rounded-2xl px-5 py-4 mb-6" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
        <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--txt-dim)' }}>Controles</p>
        <div className="grid grid-cols-2 gap-y-1.5 text-xs" style={{ color: 'var(--txt-dim)' }}>
          {[
            ['W / S', 'Frente / Trás'],
            ['A / D', 'Girar (Yaw)'],
            ['E / Space', 'Subir altitude'],
            ['Q', 'Descer'],
            ['F', 'Soltar pacote (guincho)'],
            ['R', 'RTH — Retornar à base'],
            ['[ / ]', 'Gimbal câmera ↑↓'],
          ].map(([k, v]) => (
            <React.Fragment key={k}>
              <span><kbd className="px-1.5 rounded text-[10px] font-mono" style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8' }}>{k}</kbd></span>
              <span>{v}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <button onClick={startGame}
        className="px-10 py-4 rounded-2xl font-black text-white text-base transition-all active:scale-95 hover:scale-105"
        style={{ background: 'var(--accent)', boxShadow: '0 0 30px rgba(var(--accent-rgb),0.35)' }}>
        🚀 Iniciar Voo
      </button>
    </div>
  );

  // ── RESULTS ───────────────────────────────────────────
  if (screen === 'results') {
    const r = results;
    const pct   = r.total > 0 ? Math.round(r.delivered / r.total * 100) : 0;
    const stars = pct === 100 && r.battery > 20 ? 3 : pct >= 66 ? 2 : pct >= 33 ? 1 : 0;
    const mm    = String(Math.floor(r.time / 60)).padStart(2, '0');
    const ss    = String(r.time % 60).padStart(2, '0');
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ background: 'var(--space-bg)' }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div style={{ fontSize: 44 }}>{r.reason === 'success' ? (stars === 3 ? '🏆' : '✅') : '🔋'}</div>
            <h2 className="text-2xl font-black mt-2" style={{ color: 'var(--txt)' }}>
              {r.reason === 'success' ? 'Missão concluída!' : 'Bateria zerada!'}
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--txt-dim)' }}>{r.scen.nome}</p>
            <div className="flex justify-center gap-1 mt-2">
              {[0,1,2].map(i => <span key={i} style={{ fontSize: 26, opacity: i < stars ? 1 : 0.15 }}>⭐</span>)}
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'var(--space-surface)', border: '1px solid var(--hairline)' }}>
            {[
              { label: 'Pontuação',         value: r.score.toLocaleString(),       color: 'var(--accent)', big: true },
              { label: 'Entregas',          value: `${r.delivered} / ${r.total}`,  color: r.delivered === r.total ? '#22c55e' : '#f59e0b' },
              { label: 'Bateria restante',  value: `${r.battery}%`,                color: r.battery > 30 ? '#22c55e' : '#ef4444' },
              { label: 'Tempo de voo',      value: `${mm}:${ss}`,                  color: 'var(--txt)' },
            ].map((row, i, a) => (
              <div key={i} className="flex justify-between items-center px-5 py-3"
                style={{ borderBottom: i < a.length-1 ? '1px solid var(--hairline)' : 'none' }}>
                <span className="text-sm" style={{ color: 'var(--txt-dim)' }}>{row.label}</span>
                <span className={`font-black ${row.big ? 'text-2xl' : ''}`} style={{ color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
            <p className="text-[9px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--txt-dim)' }}>Log de voo</p>
            {(r.log || []).slice(0,6).map((l,i) => <p key={i} className="text-[9px] font-mono" style={{ color: i===0?'#60a5fa':'#334155' }}>{l}</p>)}
          </div>
          <div className="flex gap-3">
            <button onClick={startGame} className="flex-1 py-3 rounded-2xl font-black text-sm text-white active:scale-95" style={{ background: 'var(--accent)' }}>🔄 Novo voo</button>
            <button onClick={() => setScreen('menu')} className="flex-1 py-3 rounded-2xl font-black text-sm active:scale-95" style={{ background: 'var(--space-elev)', color: 'var(--txt)', border: '1px solid var(--hairline)' }}>← Menu</button>
          </div>
        </div>
      </div>
    );
  }

  // ── JOGO ──────────────────────────────────────────────
  const battCol = !tel ? '#22c55e' : tel.battery > 40 ? '#22c55e' : tel.battery > 20 ? '#f59e0b' : '#ef4444';
  const sigCol  = !tel ? '#22c55e' : tel.signal  > 65 ? '#22c55e' : tel.signal  > 35 ? '#f59e0b' : '#ef4444';
  const windMs  = tel?.wind?.speed?.toFixed(1) ?? '0.0';
  const compass = ['N','NE','L','SE','S','SO','O','NO','N'][Math.round(((tel?.heading??0) % 360) / 45)];

  return (
    <div ref={wrapRef} tabIndex={0} onKeyDown={onKD} onKeyUp={onKU} className="outline-none select-none"
      style={{ background: '#020810', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header DJI ────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-1.5 shrink-0"
        style={{ background: 'rgba(0,0,0,0.85)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Bateria + sinal */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="text-[10px] font-mono" style={{ color: battCol }}>⬛</div>
            <span className="text-xs font-black font-mono" style={{ color: battCol }}>{Math.round(tel?.battery ?? 100)}%</span>
          </div>
          <div className="flex items-center gap-1">
            {[1,2,3,4].map(b => (
              <div key={b} className="rounded-sm" style={{ width: 4, height: 4 + b * 2, background: (tel?.signal ?? 98) > b * 22 ? sigCol : '#1e293b' }} />
            ))}
          </div>
          <span className="text-[10px] font-mono" style={{ color: '#475569' }}>GPS {Math.round((tel?.signal ?? 98) / 10)} sat</span>
        </div>

        {/* Centro: missão */}
        <div className="text-center">
          {tel?.rth && <span className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.35)' }}>🏠 RTH</span>}
          {!tel?.rth && <span className="text-[10px] font-mono" style={{ color: '#475569' }}>{tel?.delivered ?? 0}/{tel?.total ?? SCENARIOS[selScen].n} entregas · {tel?.spot ? tel.spot.nome : 'aguardando'}</span>}
        </div>

        {/* Tempo + sair */}
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono" style={{ color: '#475569' }}>
            {String(Math.floor((tel?.time ?? 0) / 60)).padStart(2,'0')}:{String((tel?.time ?? 0) % 60).padStart(2,'0')}
          </span>
          <button onClick={() => { cancelAnimationFrame(rafRef.current); setScreen('menu'); }}
            className="text-[10px] px-2 py-0.5 rounded font-mono"
            style={{ color: '#475569', border: '1px solid #1e293b' }}>ESC</button>
        </div>
      </div>

      {/* ── Câmera + minimap ──────────────────────────── */}
      <div className="relative flex-1" style={{ minHeight: 0 }}>
        <canvas ref={camRef} width={900} height={520}
          style={{ width: '100%', height: '100%', display: 'block', objectFit: 'fill' }} />

        {/* Minimap overlay */}
        <div className="absolute bottom-3 right-3" style={{ width: 160, height: 160 }}>
          <canvas ref={mapRef} width={160} height={160} style={{ width: '100%', height: '100%', display: 'block', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }} />
        </div>

        {/* Winch progress overlay */}
        {tel?.winching && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <div className="px-4 py-2 rounded-xl" style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(251,191,36,0.4)' }}>
              <p className="text-xs font-black" style={{ color: '#fbbf24' }}>📦 GUINCHO</p>
              <div className="mt-1 h-2 w-32 rounded-full" style={{ background: '#1e293b' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(tel.winch ?? 0) * 100}%`, background: '#fbbf24' }} />
              </div>
              <p className="text-[9px] mt-0.5 font-mono" style={{ color: '#94a3b8' }}>{Math.round((tel.winch ?? 0) * 100)}%</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Telemetria inferior (estilo DJI) ─────────── */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 flex-wrap gap-2"
        style={{ background: 'rgba(0,0,0,0.88)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Coluna: altitude */}
        <div className="text-center min-w-[52px]">
          <div className="text-[9px] font-mono mb-0.5" style={{ color: '#475569' }}>ALT (m)</div>
          <div className="text-xl font-black font-mono" style={{ color: '#60a5fa' }}>{tel?.alt ?? 0}</div>
        </div>
        <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.07)' }} />

        {/* Vel horizontal */}
        <div className="text-center min-w-[52px]">
          <div className="text-[9px] font-mono mb-0.5" style={{ color: '#475569' }}>H.VEL km/h</div>
          <div className="text-xl font-black font-mono" style={{ color: '#94a3b8' }}>{tel?.spd ?? 0}</div>
        </div>
        <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.07)' }} />

        {/* Vel vertical */}
        <div className="text-center min-w-[44px]">
          <div className="text-[9px] font-mono mb-0.5" style={{ color: '#475569' }}>V.VEL m/s</div>
          <div className="text-base font-black font-mono" style={{ color: parseFloat(tel?.vspd ?? 0) > 0 ? '#22c55e' : '#ef4444' }}>
            {parseFloat(tel?.vspd ?? 0) > 0 ? '+' : ''}{tel?.vspd ?? '0.0'}
          </div>
        </div>
        <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.07)' }} />

        {/* Distância base */}
        <div className="text-center min-w-[52px]">
          <div className="text-[9px] font-mono mb-0.5" style={{ color: '#475569' }}>DIST (m)</div>
          <div className="text-xl font-black font-mono" style={{ color: '#94a3b8' }}>{tel?.dist ?? 0}</div>
        </div>
        <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.07)' }} />

        {/* Heading */}
        <div className="text-center min-w-[44px]">
          <div className="text-[9px] font-mono mb-0.5" style={{ color: '#475569' }}>RUMO</div>
          <div className="text-base font-black font-mono" style={{ color: '#94a3b8' }}>{compass}</div>
          <div className="text-[8px] font-mono" style={{ color: '#334155' }}>{tel?.heading ?? 0}°</div>
        </div>
        <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.07)' }} />

        {/* Vento */}
        <div className="text-center min-w-[52px]">
          <div className="text-[9px] font-mono mb-0.5" style={{ color: '#475569' }}>VENTO m/s</div>
          <div className="text-base font-black font-mono" style={{ color: parseFloat(windMs) > 2.5 ? '#f59e0b' : '#22c55e' }}>{windMs}</div>
        </div>
        <div className="w-px h-8" style={{ background: 'rgba(255,255,255,0.07)' }} />

        {/* Gimbal */}
        <div className="text-center min-w-[44px]">
          <div className="text-[9px] font-mono mb-0.5" style={{ color: '#475569' }}>GIMBAL</div>
          <div className="text-base font-black font-mono" style={{ color: '#94a3b8' }}>{tel?.gimbal ?? -69}°</div>
        </div>
        <div className="w-px h-8 hidden sm:block" style={{ background: 'rgba(255,255,255,0.07)' }} />

        {/* Botões de ação */}
        <div className="flex gap-1.5 ml-auto">
          {tel?.spot && !tel?.winching && (
            <button onMouseDown={() => {
              const g = gameRef.current;
              if (!g) return;
              const d = g.drone, spot = g.spot;
              if (!spot) return;
              const dist = Math.hypot(d.x - spot.x, d.y - spot.y);
              if (dist < spot.r + 15 && d.alt >= spot.alt_min && d.alt <= spot.alt_max) {
                g.winching = true;
              }
            }}
              className="px-3 py-1.5 rounded-xl text-[10px] font-black active:scale-95"
              style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}>
              📦 F — Soltar
            </button>
          )}
          <button onMouseDown={() => { const g = gameRef.current; if (g) { g.rth = !g.rth; } }}
            className="px-3 py-1.5 rounded-xl text-[10px] font-black active:scale-95"
            style={{ background: tel?.rth ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
            🏠 R — RTH
          </button>
        </div>
      </div>

      {/* ── Mobile joystick ────────────────────────────── */}
      <div className="flex lg:hidden items-center justify-between px-4 py-3 shrink-0"
        style={{ background: 'rgba(0,0,0,0.9)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="w-24 h-24 rounded-full flex items-center justify-center touch-none"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
          onTouchStart={onJoyS} onTouchMove={onJoyM} onTouchEnd={onJoyE}>
          <p className="text-[8px] font-mono" style={{ color: '#334155' }}>MOVER</p>
        </div>
        <div className="flex flex-col gap-2">
          <button className="w-14 h-10 rounded-xl font-black text-base active:scale-90" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
            onTouchStart={() => { touchRef.current.up = true; }} onTouchEnd={() => { touchRef.current.up = false; }}>▲</button>
          <button className="w-14 h-10 rounded-xl font-black text-base active:scale-90" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
            onTouchStart={() => { touchRef.current.down = true; }} onTouchEnd={() => { touchRef.current.down = false; }}>▼</button>
        </div>
      </div>
    </div>
  );
}
