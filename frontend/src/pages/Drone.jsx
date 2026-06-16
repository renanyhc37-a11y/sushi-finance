import React, { useEffect, useRef, useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════════
//  SUSHI DRONE GCS — Ground Control Station · 37 Sushi Paranavaí
//  Simulador de treinamento para operadores de drone delivery
// ═══════════════════════════════════════════════════════════════════

// ── Mapa: Paranavaí fictício ──────────────────────────────────────
const MW = 680, MH = 520; // canvas do mapa

// Grid de ruas (define toda a malha urbana)
const STREET_W = 22;
// Ruas verticais (x)
const VX = [0, 22, 182, 204, 364, 386, 546, 568, 680];
// Ruas horizontais (y)
const HY = [0, 22, 172, 194, 344, 366, 520];

// Blocos entre ruas: [x1, y1, x2, y2, tipo, nome, andares]
// tipo: 'res'|'com'|'park'|'base'|'delivery'
const BLOCKS = [
  // col 0 (x: 22→182)
  { x: 22, y: 22,  w: 160, h: 150, tipo: 'res', andares: 3, nome: 'Residencial Norte' },
  { x: 22, y: 194, w: 160, h: 150, tipo: 'park', nome: 'Praça Central' },
  { x: 22, y: 366, w: 160, h: 154, tipo: 'res', andares: 2, nome: 'Residencial Sul' },
  // col 1 (x: 204→364)
  { x: 204, y: 22,  w: 160, h: 150, tipo: 'com', andares: 5, nome: 'Centro Comercial' },
  { x: 204, y: 194, w: 160, h: 150, tipo: 'base', andares: 1, nome: '37 Sushi — BASE' },
  { x: 204, y: 366, w: 160, h: 154, tipo: 'res', andares: 3, nome: 'Vila Nova' },
  // col 2 (x: 386→546)
  { x: 386, y: 22,  w: 160, h: 150, tipo: 'res', andares: 4, nome: 'Edificio Alto' },
  { x: 386, y: 194, w: 160, h: 150, tipo: 'com', andares: 3, nome: 'Comercial Leste' },
  { x: 386, y: 366, w: 160, h: 154, tipo: 'park', nome: 'Parque Eco' },
  // col 3 (x: 568→680)
  { x: 568, y: 22,  w: 112, h: 150, tipo: 'res', andares: 2 },
  { x: 568, y: 194, w: 112, h: 150, tipo: 'res', andares: 3 },
  { x: 568, y: 366, w: 112, h: 154, tipo: 'com', andares: 4 },
];

// Ponto base (centro do bloco base)
const BASE = { x: 284, y: 269 };

// Pontos de entrega
const DELIVERIES = [
  { id: 'D1', x: 102,  y: 97,  r: 30, nome: 'Rua Norte, 12',    rua: 'Residencial Norte', alt_min: 8,  alt_max: 20 },
  { id: 'D2', x: 284,  y: 97,  r: 30, nome: 'Av. Central, 77',  rua: 'Centro Comercial',  alt_min: 15, alt_max: 30 },
  { id: 'D3', x: 466,  y: 97,  r: 30, nome: 'Rua Leste, 5',     rua: 'Edifício Alto',     alt_min: 20, alt_max: 40 },
  { id: 'D4', x: 102,  y: 440, r: 30, nome: 'Rua Sul, 88',      rua: 'Residencial Sul',   alt_min: 8,  alt_max: 20 },
  { id: 'D5', x: 466,  y: 440, r: 30, nome: 'Parque Eco, 3',    rua: 'Parque Eco',        alt_min: 5,  alt_max: 15 },
  { id: 'D6', x: 624,  y: 280, r: 30, nome: 'Av. Extremo, 44',  rua: 'Comercial Leste',   alt_min: 10, alt_max: 25 },
];

// Zona de restrição (escola/hospital) — não voar abaixo de 50m
const NO_FLY_LOW = { x: 540, y: 150, r: 60, label: 'RESTR.\nALT < 50m' };

// ── Física ────────────────────────────────────────────────────────
const ACCEL       = 0.28;
const DRAG        = 0.84;
const MAX_SPEED   = 7;
const AUTO_SPEED  = 3.2;
const ALT_RATE    = 2.0;
const MAX_ALT     = 150;
const BATT_HOVER  = 0.005;
const BATT_MOVE   = 0.008;
const BATT_CLIMB  = 0.012;
const WINCH_SPEED = 0.8;  // m/s de descida do guincho
const WINCH_DIST  = 12;   // metros de cabo
const SIGNAL_BASE = 98;

// ── Cenários ──────────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 'tutorial', nome: 'Tutorial — Voo Livre',
    desc: 'Aprenda os controles. 1 entrega, vento zero.',
    icon: '🟢', wind: 0, night: false, deliveries: 1,
    checklist: ['GPS', 'Bateria', 'Pacote'],
  },
  {
    id: 'basico', nome: 'Operação Básica',
    desc: 'Vento leve. 3 entregas consecutivas.',
    icon: '🟡', wind: 1.2, night: false, deliveries: 3,
    checklist: ['GPS', 'Bateria', 'Vento', 'Rota', 'Pacote'],
  },
  {
    id: 'avancado', nome: 'Operação Avançada',
    desc: 'Vento forte + zona restrita. 4 entregas.',
    icon: '🔴', wind: 2.8, night: false, deliveries: 4,
    checklist: ['GPS', 'Bateria', 'Vento', 'Rota', 'NOTAM', 'Pacote'],
  },
  {
    id: 'noturno', nome: 'Turno Noturno',
    desc: 'Visibilidade reduzida + vento moderado. 3 entregas.',
    icon: '🌙', wind: 1.6, night: true, deliveries: 3,
    checklist: ['GPS', 'Bateria', 'Luzes', 'Vento', 'Rota', 'Pacote'],
  },
];

// ── Checklist ─────────────────────────────────────────────────────
const CHECKLIST_INFO = {
  GPS:    { label: 'Sinal GPS (≥8 satélites)',    sim: () => ({ sats: 10 + Math.floor(Math.random() * 4) }) },
  Bateria:{ label: 'Bateria 100% carregada',       sim: () => ({ pct: 100 }) },
  Vento:  { label: 'Verificar boletim de vento',   sim: () => ({ ok: true }) },
  Rota:   { label: 'Aprovar rota de voo',          sim: () => ({ ok: true }) },
  NOTAM:  { label: 'Verificar NOTAMs ativos',      sim: () => ({ notams: 1 }) },
  Pacote: { label: 'Pacote seguro no compartimento',sim: () => ({ ok: true }) },
  Luzes:  { label: 'LEDs de navegação ativos',     sim: () => ({ ok: true }) },
};

// ── Init ──────────────────────────────────────────────────────────
function initGame(scen) {
  const spots = [...DELIVERIES].sort(() => Math.random() - 0.5).slice(0, scen.deliveries);
  return {
    scen,
    drone: { x: BASE.x, y: BASE.y, vx: 0, vy: 0, alt: 0, heading: -Math.PI / 2 },
    battery: 100,
    signal: SIGNAL_BASE,
    wind: { angle: Math.random() * Math.PI * 2, speed: scen.wind },
    windActual: { angle: Math.random() * Math.PI * 2, speed: scen.wind * (0.7 + Math.random() * 0.6) },
    windTimer: 0,
    queue: spots,
    currentSpot: null,
    mode: 'manual',   // 'manual' | 'auto'
    phase: 'idle',    // 'idle'|'flying'|'approaching'|'hovering'|'delivering'|'rth'|'done'
    winch: 0,         // metros de cabo baixados (0..WINCH_DIST)
    winching: false,
    packageDropped: false,
    deliveryCount: 0,
    totalScore: 0,
    log: [],
    frame: 0,
    missionStart: Date.now(),
    statusMsg: '',
    statusTimer: 0,
    flash: '',        // '' | 'green' | 'red'
    flashTimer: 0,
    particles: [],
    over: false,
    trails: [],
  };
}

// ── Canvas drawing ────────────────────────────────────────────────
function hexA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g2 = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g2},${b},${a})`;
}

function drawMap(ctx, g) {
  const night = g.scen.night;
  const bg    = night ? '#050d1c' : '#0a1628';

  // Fundo
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, MW, MH);

  // Ruas
  const streetColor = night ? '#0d1c30' : '#111e33';
  ctx.fillStyle = streetColor;
  VX.forEach((x, i) => {
    if (i < VX.length - 1 && VX[i + 1] - x <= STREET_W + 2) {
      ctx.fillRect(x, 0, VX[i + 1] - x, MH);
    }
  });
  HY.forEach((y, i) => {
    if (i < HY.length - 1 && HY[i + 1] - y <= STREET_W + 2) {
      ctx.fillRect(0, y, MW, HY[i + 1] - y);
    }
  });

  // Linhas tracejadas nas ruas
  ctx.strokeStyle = night ? '#131f33' : '#162035';
  ctx.lineWidth = 1;
  ctx.setLineDash([14, 18]);
  // horizontais
  [97, 269, 440].forEach(y => {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(MW, y); ctx.stroke();
  });
  // verticais
  [102, 284, 466, 624].forEach(x => {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MH); ctx.stroke();
  });
  ctx.setLineDash([]);

  // Blocos
  BLOCKS.forEach(b => {
    let fill, topFill, label;
    if (b.tipo === 'park') {
      fill    = night ? '#0b2217' : '#0d2e1c';
      topFill = night ? '#0e2d1e' : '#113d26';
      // Árvores estilizadas
      ctx.fillStyle = fill;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = topFill;
      const seedR = (b.x * 7 + b.y * 3) % 10;
      for (let i = 0; i < 8; i++) {
        const tx = b.x + 16 + ((seedR * 17 + i * 23) % (b.w - 32));
        const ty = b.y + 14 + ((seedR * 11 + i * 31) % (b.h - 28));
        ctx.beginPath(); ctx.arc(tx, ty, 10 + (i % 3) * 4, 0, Math.PI * 2); ctx.fill();
      }
    } else if (b.tipo === 'base') {
      fill = night ? '#1a0e04' : '#160c02';
      ctx.fillStyle = fill;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // Heliponto
      ctx.fillStyle = night ? '#3b1a06' : '#2d1405';
      ctx.fillRect(b.x + 20, b.y + 20, b.w - 40, b.h - 40);
      // Círculo H
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 38, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = hexA('#f97316', 0.4);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 52, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#f97316';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('H', b.x + b.w / 2, b.y + b.h / 2 - 8);
      ctx.font = 'bold 8px monospace';
      ctx.fillText('37 SUSHI', b.x + b.w / 2, b.y + b.h / 2 + 10);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    } else {
      // Residencial / comercial
      const isComm = b.tipo === 'com';
      fill    = night ? (isComm ? '#0c1929' : '#0d1829') : (isComm ? '#0f2040' : '#0e1c32');
      topFill = night ? (isComm ? '#152a42' : '#142035') : (isComm ? '#1a3358' : '#182d4a');
      ctx.fillStyle = fill;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // Topo
      const hv = Math.min((b.andares || 2) * 20, b.h - 10);
      ctx.fillStyle = topFill;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, hv);
      // Janelas
      const wc = Math.floor((b.w - 20) / 18), wr = Math.floor(hv / 18);
      for (let row = 0; row < wr; row++) {
        for (let col = 0; col < wc; col++) {
          const seed = ((b.x + b.y) * 3 + row * 7 + col * 11) % 10;
          const lit  = night ? seed < 6 : true;
          if (!lit) continue;
          ctx.fillStyle = night ? `rgba(255,220,100,${0.1 + seed * 0.025})` : 'rgba(120,180,255,0.06)';
          ctx.fillRect(b.x + 12 + col * 18, b.y + 8 + row * 18, 10, 11);
        }
      }
    }
    // Borda
    ctx.strokeStyle = night ? '#0e1e35' : '#13233d';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  });

  // Zona de restrição
  const nfz = NO_FLY_LOW;
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.arc(nfz.x, nfz.y, nfz.r, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#ef4444';
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  ctx.fillStyle = '#ef4444';
  ctx.font = 'bold 7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('RESTR.', nfz.x, nfz.y - 4);
  ctx.fillText('<50m', nfz.x, nfz.y + 6);
  ctx.textAlign = 'left';
}

function drawDeliveryZone(ctx, spot, frame, active, night) {
  const pulse = Math.sin(frame * 0.07);
  const r     = spot.r + (active ? pulse * 6 : 0);

  ctx.strokeStyle = active ? '#fbbf24' : hexA('#fbbf24', 0.35);
  ctx.lineWidth   = active ? 2 : 1;
  ctx.globalAlpha = active ? (0.7 + pulse * 0.25) : 0.4;
  ctx.beginPath(); ctx.arc(spot.x, spot.y, r, 0, Math.PI * 2); ctx.stroke();
  if (active) {
    ctx.globalAlpha = 0.06 + Math.abs(pulse) * 0.04;
    ctx.fillStyle = '#fbbf24';
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ícone de entrega
  ctx.font = active ? '14px serif' : '10px serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('📦', spot.x, spot.y);

  // Label
  if (active) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(spot.id, spot.x, spot.y - spot.r - 8);
    ctx.fillStyle = hexA('#fbbf24', 0.8);
    ctx.font = '8px monospace';
    ctx.fillText(spot.nome, spot.x, spot.y + spot.r + 10);
  } else {
    ctx.fillStyle = hexA('#94a3b8', 0.6);
    ctx.font = '8px monospace';
    ctx.fillText(spot.id, spot.x, spot.y - spot.r - 5);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

function drawTrails(ctx, trails) {
  trails.forEach((t, i) => {
    ctx.globalAlpha = (i / trails.length) * 0.3;
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(t.x - 1, t.y - 1, 2, 2);
  });
  ctx.globalAlpha = 1;
}

function drawDrone(ctx, d, frame, winch, winching, packageDropped, night) {
  const { x, y, alt, heading } = d;

  // Sombra no chão (proporcional à altitude)
  if (alt > 1) {
    const off = alt * 0.25;
    const sr  = 16 + alt * 0.06;
    ctx.fillStyle = `rgba(0,0,0,${Math.max(0.05, 0.28 - alt * 0.002)})`;
    ctx.beginPath();
    ctx.ellipse(x + off, y + off, sr, sr * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);

  const ARM = 14;
  const spin = frame * 0.5;

  // Braços
  [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sy]) => {
    ctx.strokeStyle = night ? '#2d3f5a' : '#374151';
    ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sx * ARM, sy * ARM); ctx.stroke();
  });

  // Rotores
  [[-ARM,-ARM],[ARM,-ARM],[-ARM,ARM],[ARM,ARM]].forEach(([rx, ry], i) => {
    ctx.save();
    ctx.translate(rx, ry);
    // Motor base
    ctx.fillStyle = '#1e293b';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
    // Hélices (2 pás, giradas por alternância de frame)
    ctx.strokeStyle = night ? '#93c5fd' : '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.7;
    ctx.save();
    ctx.rotate(spin + i * Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.rotate(spin + i * Math.PI / 2 + Math.PI / 2);
    ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(9, 0); ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.restore();
  });

  // Corpo central
  ctx.fillStyle = night ? '#1e3a5f' : '#1e293b';
  ctx.fillRect(-7, -7, 14, 14);
  ctx.fillStyle = night ? '#3b82f6' : '#475569';
  ctx.fillRect(-5, -5, 10, 10);

  // LED frontal (verde)
  ctx.fillStyle = night ? '#22c55e' : '#4ade80';
  ctx.fillRect(3, -6, 3, 3);
  // LED traseiro (vermelho)
  if (night) {
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-5, 3, 3, 3);
  }

  ctx.restore();

  // Guincho / pacote
  if (winching || (winch > 0 && !packageDropped)) {
    const cableLen = (winch / WINCH_DIST) * 28;
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 6);
    ctx.lineTo(x, y + 6 + cableLen);
    ctx.stroke();
    // Pacote
    ctx.fillStyle = '#f97316';
    ctx.fillRect(x - 5, y + 6 + cableLen, 10, 8);
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x - 5, y + 6 + cableLen, 10, 8);
  }

  // Label altitude
  if (alt > 3) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x + 16, y - 20, 48, 14);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px monospace';
    ctx.fillText(`${Math.round(alt)}m`, x + 19, y - 9);
  }
}

function drawParticles(ctx, particles) {
  particles.forEach(p => {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 2, 0, Math.PI * 2); ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawOverlayFlash(ctx, flash) {
  if (!flash) return;
  const color = flash === 'green' ? '34,197,94' : '239,68,68';
  ctx.fillStyle = `rgba(${color},0.12)`;
  ctx.fillRect(0, 0, MW, MH);
}

function spawnParticles(g, x, y, color) {
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const s = 1 + Math.random() * 2.5;
    g.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      color, life: 50, maxLife: 50, r: 2 + Math.random() * 2,
    });
  }
}

// ── Componente ────────────────────────────────────────────────────
export default function Drone() {
  const canvasRef  = useRef(null);
  const wrapRef    = useRef(null); // div focusável
  const gameRef    = useRef(null);
  const rafRef     = useRef(null);
  const keysRef    = useRef({});
  const touchRef   = useRef({ dx: 0, dy: 0, up: false, down: false });

  const [screen,   setScreen]   = useState('menu');  // 'menu'|'preflight'|'game'|'results'
  const [selScen,  setSelScen]  = useState(0);
  const [clDone,   setClDone]   = useState({});      // checklist items concluídos
  const [tel,      setTel]      = useState({});       // telemetria (sync do gameRef)
  const [results,  setResults]  = useState(null);
  const [logLines, setLogLines] = useState([]);

  // ── Focus wrapper para capturar teclado ──────────────────────
  useEffect(() => {
    if (screen === 'game') {
      setTimeout(() => wrapRef.current?.focus(), 100);
    }
  }, [screen]);

  const onKeyDown = useCallback(e => {
    const game = ['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyF','KeyR'];
    if (game.includes(e.code)) e.preventDefault();
    keysRef.current[e.code] = true;
  }, []);

  const onKeyUp = useCallback(e => {
    delete keysRef.current[e.code];
  }, []);

  // ── Touch joystick ───────────────────────────────────────────
  const joyOrigin = useRef(null);
  const onJoyStart = e => {
    const t = e.changedTouches[0];
    joyOrigin.current = { x: t.clientX, y: t.clientY };
  };
  const onJoyMove = e => {
    e.preventDefault();
    if (!joyOrigin.current) return;
    const t = e.changedTouches[0];
    touchRef.current.dx = Math.max(-1, Math.min(1, (t.clientX - joyOrigin.current.x) / 55));
    touchRef.current.dy = Math.max(-1, Math.min(1, (t.clientY - joyOrigin.current.y) / 55));
  };
  const onJoyEnd = () => {
    joyOrigin.current = null;
    touchRef.current.dx = 0;
    touchRef.current.dy = 0;
  };

  // ── Game loop ─────────────────────────────────────────────────
  useEffect(() => {
    if (screen !== 'game') { cancelAnimationFrame(rafRef.current); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function addLog(g, msg) {
      const t = new Date(Date.now() - g.missionStart);
      const ts = `${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
      g.log.unshift(`[${ts}] ${msg}`);
      if (g.log.length > 8) g.log.pop();
    }

    function setStatus(g, msg, flashColor) {
      g.statusMsg = msg;
      g.statusTimer = 120;
      if (flashColor) { g.flash = flashColor; g.flashTimer = 40; }
      addLog(g, msg);
    }

    function endGame(g, reason) {
      if (g.over) return;
      g.over = true;
      cancelAnimationFrame(rafRef.current);
      const elapsed = Math.floor((Date.now() - g.missionStart) / 1000);
      const efficiency = g.deliveryCount > 0
        ? Math.round((g.totalScore / g.deliveryCount))
        : 0;
      setResults({
        reason, score: g.totalScore, efficiency,
        deliveries: g.deliveryCount, total: g.scen.deliveries,
        battery: Math.round(g.battery),
        time: elapsed, scen: g.scen, log: [...g.log],
      });
      setScreen('results');
    }

    function handleDelivery(g) {
      const spot = g.currentSpot;
      const d    = g.drone;
      if (!spot) return;
      const dist = Math.hypot(d.x - spot.x, d.y - spot.y);
      const inZone = dist < spot.r + 10;
      const goodAlt = d.alt >= spot.alt_min && d.alt <= spot.alt_max;

      if (!inZone) { setStatus(g, '⚠ Fora da zona de entrega — reposicione'); return; }
      if (!goodAlt) {
        const hint = d.alt < spot.alt_min ? `Suba para ${spot.alt_min}m+` : `Desça para max ${spot.alt_max}m`;
        setStatus(g, `⚠ Altitude incorreta — ${hint}`);
        return;
      }
      // Iniciar guincho
      g.winching = true;
      g.phase = 'delivering';
      setStatus(g, '📦 Guincho ativado — baixando pacote...');
    }

    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      const g = gameRef.current;
      if (!g || g.over) return;

      g.frame++;
      const keys  = keysRef.current;
      const touch = touchRef.current;
      const d     = g.drone;

      // ── Vento oscila ──────────────────────────────────────────
      g.windTimer++;
      if (g.windTimer > 200) {
        g.windTimer = 0;
        const base = g.scen.wind;
        g.windActual = {
          angle: g.windActual.angle + (Math.random() - 0.5) * 1.0,
          speed: Math.max(0, base + (Math.random() - 0.5) * base * 0.8),
        };
      }

      // ── Guincho ───────────────────────────────────────────────
      if (g.winching) {
        g.winch = Math.min(WINCH_DIST, g.winch + WINCH_SPEED * 0.1);
        if (g.winch >= WINCH_DIST) {
          g.winching  = false;
          g.packageDropped = true;
          g.winch = 0;

          // Calcular pontuação
          const timeSec   = (Date.now() - g.missionStart) / 1000;
          const battBonus = Math.round(g.battery * 0.8);
          const timeBonus = Math.max(0, Math.round(500 - timeSec * 3));
          const pts = 200 + battBonus + timeBonus;
          g.totalScore += pts;
          g.deliveryCount++;
          g.phase = 'idle';
          g.currentSpot = null;

          spawnParticles(g, d.x, d.y, '#fbbf24');
          setStatus(g, `✅ Entregue em ${g.currentSpot?.nome || '?'}! +${pts} pts`, 'green');

          if (g.deliveryCount >= g.scen.deliveries) {
            setTimeout(() => endGame(g, 'success'), 1800);
            return;
          }
        }
      }

      // ── Controles ─────────────────────────────────────────────
      const pressW = keys['KeyW'] || keys['ArrowUp']    || touch.dy < -0.25;
      const pressS = keys['KeyS'] || keys['ArrowDown']  || touch.dy >  0.25;
      const pressA = keys['KeyA'] || keys['ArrowLeft']  || touch.dx < -0.25;
      const pressD = keys['KeyD'] || keys['ArrowRight'] || touch.dx >  0.25;
      const pressUp   = keys['KeyE'] || keys['Space'] || touch.up;
      const pressDown = keys['KeyQ'] || touch.down;
      const pressF    = keys['KeyF'];
      const pressR    = keys['KeyR'];

      // RTH
      if (pressR && !g.rth) {
        g.rth = true;
        g.mode = 'auto';
        g.rthTarget = { x: BASE.x, y: BASE.y };
        setStatus(g, '🏠 RTH ativado — retornando à base');
      }
      // Drop pacote (F)
      if (pressF && !g.winching && d.alt > 1 && g.currentSpot && !g.packageDropped) {
        handleDelivery(g);
      }
      // Cancelar RTH com qualquer tecla de movimento
      if ((pressW || pressS || pressA || pressD) && g.rth) {
        g.rth   = false;
        g.mode  = 'manual';
        setStatus(g, '✋ RTH cancelado — controle manual');
      }

      // Próximo pedido (se idle e há fila)
      if (g.phase === 'idle' && g.queue.length > 0 && !g.currentSpot) {
        g.currentSpot    = g.queue.shift();
        g.packageDropped = false;
        g.winch          = 0;
        setStatus(g, `📋 Nova missão: ${g.currentSpot.nome}`);
      }

      // ── Física ────────────────────────────────────────────────
      let ax = 0, ay = 0;

      if (g.rth) {
        // Auto-piloto RTH
        const tx = g.rthTarget.x, ty = g.rthTarget.y;
        const dx2 = tx - d.x, dy2 = ty - d.y;
        const dist = Math.hypot(dx2, dy2);
        if (dist > 5) {
          ax = (dx2 / dist) * AUTO_SPEED * 0.15;
          ay = (dy2 / dist) * AUTO_SPEED * 0.15;
          if (d.alt < 40) d.alt = Math.min(40, d.alt + ALT_RATE);
        } else {
          // Pouso na base
          d.alt = Math.max(0, d.alt - ALT_RATE * 1.5);
          if (d.alt <= 0) {
            d.alt = 0; d.vx = 0; d.vy = 0;
            g.rth = false;
            setStatus(g, '✅ Pousou na base!', 'green');
            spawnParticles(g, d.x, d.y, '#22c55e');
          }
        }
      } else {
        // Controle manual
        if (pressW) ay = -ACCEL;
        if (pressS) ay =  ACCEL;
        if (pressA) ax = -ACCEL;
        if (pressD) ax =  ACCEL;

        // Decolar automaticamente ao mover se no chão
        if ((pressW || pressS || pressA || pressD) && d.alt < 5 && !g.winching) {
          d.alt = Math.min(MAX_ALT, d.alt + ALT_RATE * 2);
        }
      }

      // Altitude manual
      if (pressUp   && !g.rth) d.alt = Math.min(MAX_ALT, d.alt + ALT_RATE);
      if (pressDown && !g.rth) d.alt = Math.max(0, d.alt - ALT_RATE);

      // Vento
      const wf = 0.3 + (d.alt / MAX_ALT) * 0.7;
      const wdrift = g.windActual;
      ax += Math.cos(wdrift.angle) * wdrift.speed * 0.035 * wf;
      ay += Math.sin(wdrift.angle) * wdrift.speed * 0.035 * wf;

      d.vx = (d.vx + ax) * DRAG;
      d.vy = (d.vy + ay) * DRAG;
      const sp = Math.sqrt(d.vx ** 2 + d.vy ** 2);
      if (sp > MAX_SPEED) { d.vx = d.vx / sp * MAX_SPEED; d.vy = d.vy / sp * MAX_SPEED; }

      // Heading visual
      if (Math.abs(ax) > 0.01 || Math.abs(ay) > 0.01) {
        const tH = Math.atan2(ay, ax) + Math.PI / 2;
        const diff = ((tH - d.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        d.heading += diff * 0.1;
      }

      d.x = Math.max(10, Math.min(MW - 10, d.x + d.vx));
      d.y = Math.max(10, Math.min(MH - 10, d.y + d.vy));

      // Pouso automático ao chegar a altitude 0
      if (d.alt <= 0 && pressDown) {
        d.alt = 0; d.vx *= 0.7; d.vy *= 0.7;
      }

      // Bateria
      const moving  = Math.abs(ax) > 0.01 || Math.abs(ay) > 0.01;
      const climbing = pressUp || (g.rth && d.alt < 40);
      let drain = d.alt > 0 ? BATT_HOVER : 0;
      if (moving)  drain += BATT_MOVE;
      if (climbing) drain += BATT_CLIMB;
      g.battery = Math.max(0, g.battery - drain);

      if (g.battery <= 0) {
        d.alt = 0; d.vx = 0; d.vy = 0;
        endGame(g, 'battery');
        return;
      }

      // Sinal (diminui com distância da base)
      const distBase = Math.hypot(d.x - BASE.x, d.y - BASE.y);
      g.signal = Math.max(20, SIGNAL_BASE - distBase * 0.05);

      // Partículas
      g.particles = g.particles
        .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.06, life: p.life - 1 }))
        .filter(p => p.life > 0);

      // Rastro
      if (d.alt > 2 && g.frame % 4 === 0) {
        g.trails.push({ x: d.x, y: d.y });
        if (g.trails.length > 60) g.trails.shift();
      }

      // Flash e status
      if (g.flashTimer > 0) g.flashTimer--;
      else g.flash = '';
      if (g.statusTimer > 0) g.statusTimer--;

      // ── Render ────────────────────────────────────────────────
      drawMap(ctx, g);
      drawTrails(ctx, g.trails);

      // Zonas de entrega
      DELIVERIES.forEach(spot => {
        const isActive = g.currentSpot?.id === spot.id;
        const isDone   = g.log.some(l => l.includes(spot.nome));
        if (!isDone) drawDeliveryZone(ctx, spot, g.frame, isActive, g.scen.night);
      });

      drawParticles(ctx, g.particles);
      drawDrone(ctx, d, g.frame, g.winch, g.winching, g.packageDropped, g.scen.night);
      drawOverlayFlash(ctx, g.flash);

      // Status message no mapa
      if (g.statusTimer > 0) {
        const alpha = Math.min(1, g.statusTimer / 20);
        ctx.fillStyle = `rgba(0,0,0,${0.65 * alpha})`;
        ctx.fillRect(MW / 2 - 190, MH - 42, 380, 28);
        ctx.fillStyle = g.flash === 'green' ? '#4ade80' : g.flash === 'red' ? '#f87171' : '#f1f5f9';
        ctx.globalAlpha = alpha;
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(g.statusMsg, MW / 2, MH - 23);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      }

      // Sync telemetria a cada 4 frames
      if (g.frame % 4 === 0) {
        setTel({
          battery: g.battery,
          alt: Math.round(d.alt),
          speed: Math.round(sp * 3.6),
          wind: g.windActual,
          signal: Math.round(g.signal),
          heading: d.heading,
          deliveries: g.deliveryCount,
          total: g.scen.deliveries,
          spot: g.currentSpot,
          phase: g.phase,
          winching: g.winching,
          winch: g.winch,
          rth: !!g.rth,
          battery_warn: g.battery < 25,
        });
        setLogLines([...g.log]);
      }
    }

    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen]);

  // ── Checklist ─────────────────────────────────────────────────
  const scen = SCENARIOS[selScen];
  const allChecked = scen.checklist.every(k => clDone[k]);

  function startGame() {
    const g = initGame(scen);
    // Log inicial
    g.log.push('[00:00] Missão iniciada — aguardando pedido');
    gameRef.current = g;
    setTel({});
    setLogLines(g.log);
    setScreen('game');
  }

  // ── TELA: MENU ────────────────────────────────────────────────
  if (screen === 'menu') return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'var(--space-bg)' }}>
      <div style={{ fontSize: 52 }}>🚁</div>
      <h1 className="text-3xl font-black mt-3" style={{ color: 'var(--accent)' }}>SUSHI DRONE GCS</h1>
      <p className="text-sm mt-1 mb-1" style={{ color: 'var(--txt-dim)' }}>Ground Control Station · 37 Sushi Paranavaí</p>
      <div className="mb-8 px-3 py-1 rounded-full text-xs font-bold"
        style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)' }}>
        Simulador de Treinamento Operacional
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
            {selScen === i && <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)' }}>Selecionado</span>}
          </button>
        ))}
      </div>

      <div className="w-full max-w-lg rounded-2xl px-5 py-4 mb-6"
        style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
        <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--txt-dim)' }}>Controles</p>
        <div className="grid grid-cols-2 gap-y-1.5 text-xs" style={{ color: 'var(--txt-dim)' }}>
          {[
            ['W A S D / ← ↑ → ↓', 'Mover drone'],
            ['E / Space', 'Subir altitude'],
            ['Q', 'Descer / Pousar'],
            ['F', 'Soltar pacote (guincho)'],
            ['R', 'RTH — Retornar à base'],
          ].map(([k, v]) => (
            <React.Fragment key={k}>
              <span><kbd className="px-1.5 rounded text-[10px] font-mono" style={{ background: '#1e293b', border: '1px solid #334155', color: '#94a3b8' }}>{k}</kbd></span>
              <span>{v}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      <button onClick={() => { setClDone({}); setScreen('preflight'); }}
        className="px-10 py-4 rounded-2xl font-black text-white text-base transition-all active:scale-95 hover:scale-105"
        style={{ background: 'var(--accent)', boxShadow: '0 0 30px rgba(var(--accent-rgb),0.35)' }}>
        Iniciar Pré-Voo →
      </button>
    </div>
  );

  // ── TELA: PRÉ-VOO ────────────────────────────────────────────
  if (screen === 'preflight') return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
      style={{ background: 'var(--space-bg)' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setScreen('menu')} style={{ color: 'var(--txt-dim)' }}>←</button>
          <div>
            <h2 className="font-black text-lg" style={{ color: 'var(--txt)' }}>Checklist Pré-Voo</h2>
            <p className="text-xs" style={{ color: 'var(--txt-dim)' }}>{scen.nome} · {scen.deliveries} entrega{scen.deliveries > 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          {scen.checklist.map(key => {
            const info = CHECKLIST_INFO[key];
            const done = !!clDone[key];
            return (
              <div key={key}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer transition-all"
                style={{ background: done ? 'rgba(34,197,94,0.08)' : 'var(--space-elev)', border: `1px solid ${done ? 'rgba(34,197,94,0.3)' : 'var(--hairline)'}` }}
                onClick={() => setClDone(prev => ({ ...prev, [key]: !prev[key] }))}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: done ? '#22c55e' : 'var(--space-elev-2)', border: `1px solid ${done ? '#22c55e' : 'var(--hairline)'}` }}>
                  {done && <span style={{ color: '#fff', fontSize: 13 }}>✓</span>}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: done ? '#4ade80' : 'var(--txt)' }}>{key}</p>
                  <p className="text-xs" style={{ color: 'var(--txt-dim)' }}>{info?.label}</p>
                </div>
                {done && (() => {
                  const sim = info?.sim?.();
                  if (!sim) return null;
                  const val = sim.sats ? `${sim.sats} satélites` : sim.pct ? `${sim.pct}%` : sim.notams ? `${sim.notams} NOTAM(s)` : 'OK';
                  return <span className="text-xs font-bold" style={{ color: '#4ade80' }}>{val}</span>;
                })()}
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 rounded-2xl mb-6 text-xs"
          style={{ background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.2)', color: '#fdba74' }}>
          <strong>Procedimento real:</strong> Operadores certificados pela ANAC devem completar o checklist de pré-voo antes de cada missão. Ignorar itens pode resultar em falha de missão ou acidente.
        </div>

        <button onClick={startGame} disabled={!allChecked}
          className="w-full py-4 rounded-2xl font-black text-white text-base transition-all active:scale-95 disabled:opacity-40"
          style={{ background: allChecked ? 'var(--accent)' : 'var(--space-elev-2)' }}>
          {allChecked ? '🚀 Autorizar Decolagem' : `Complete o checklist (${scen.checklist.filter(k => clDone[k]).length}/${scen.checklist.length})`}
        </button>
      </div>
    </div>
  );

  // ── TELA: RESULTADOS ─────────────────────────────────────────
  if (screen === 'results') {
    const r = results;
    const pct = r.total > 0 ? Math.round((r.deliveries / r.total) * 100) : 0;
    const stars = pct === 100 && r.battery > 20 ? 3 : pct >= 66 ? 2 : pct >= 33 ? 1 : 0;
    const mm = String(Math.floor(r.time / 60)).padStart(2,'0');
    const ss = String(r.time % 60).padStart(2,'0');
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10"
        style={{ background: 'var(--space-bg)' }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div style={{ fontSize: 44 }}>{r.reason === 'success' ? (stars === 3 ? '🏆' : '✅') : '🔋'}</div>
            <h2 className="text-2xl font-black mt-2" style={{ color: 'var(--txt)' }}>
              {r.reason === 'success' ? 'Missão concluída!' : 'Bateria zerada!'}
            </h2>
            <p className="text-xs mt-1" style={{ color: 'var(--txt-dim)' }}>{r.scen.nome}</p>
            <div className="flex justify-center gap-1 mt-3">
              {[0,1,2].map(i => <span key={i} style={{ fontSize: 26, opacity: i < stars ? 1 : 0.15 }}>⭐</span>)}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'var(--space-surface)', border: '1px solid var(--hairline)' }}>
            {[
              { label: 'Pontuação', value: r.score.toLocaleString(), color: 'var(--accent)', big: true },
              { label: 'Entregas', value: `${r.deliveries} / ${r.total}`, color: r.deliveries === r.total ? '#22c55e' : '#f59e0b' },
              { label: 'Bateria restante', value: `${r.battery}%`, color: r.battery > 30 ? '#22c55e' : '#ef4444' },
              { label: 'Tempo total', value: `${mm}:${ss}`, color: 'var(--txt)' },
              { label: 'Eficiência média', value: `${r.efficiency} pts/entrega`, color: '#60a5fa' },
            ].map((row, i, arr) => (
              <div key={i} className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--hairline)' : 'none' }}>
                <span className="text-sm" style={{ color: 'var(--txt-dim)' }}>{row.label}</span>
                <span className={`font-black ${row.big ? 'text-2xl' : ''}`} style={{ color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Log de missão */}
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
            <p className="text-[10px] font-black uppercase tracking-wider mb-2" style={{ color: 'var(--txt-dim)' }}>Log de missão</p>
            <div className="space-y-1">
              {(r.log || []).slice(0, 6).map((l, i) => (
                <p key={i} className="text-[10px] font-mono" style={{ color: 'var(--txt-dim)' }}>{l}</p>
              ))}
            </div>
          </div>

          {r.battery < 15 && (
            <div className="rounded-xl px-4 py-3 mb-4 text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
              💡 Reserve sempre 20%+ de bateria para o retorno. Use RTH (<kbd style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4, padding: '0 4px', color: '#94a3b8' }}>R</kbd>) antes de chegar a 25%.
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setClDone({}); setScreen('preflight'); }}
              className="flex-1 py-3 rounded-2xl font-black text-sm transition-all active:scale-95"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              🔄 Nova missão
            </button>
            <button onClick={() => setScreen('menu')}
              className="flex-1 py-3 rounded-2xl font-black text-sm transition-all active:scale-95"
              style={{ background: 'var(--space-elev)', color: 'var(--txt)', border: '1px solid var(--hairline)' }}>
              ← Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── TELA: JOGO ────────────────────────────────────────────────
  const battColor = !tel.battery ? '#22c55e' : tel.battery > 40 ? '#22c55e' : tel.battery > 20 ? '#f59e0b' : '#ef4444';
  const sigColor  = !tel.signal  ? '#22c55e' : tel.signal  > 70 ? '#22c55e' : tel.signal  > 40 ? '#f59e0b' : '#ef4444';
  const windMs = tel.wind?.speed?.toFixed(1) || '0.0';
  const windDeg = tel.wind ? Math.round(tel.wind.angle * 180 / Math.PI) : 0;

  return (
    <div
      ref={wrapRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      className="outline-none"
      style={{ background: 'var(--space-bg)', minHeight: '100vh' }}>

      {/* ── Header GCS ─────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2"
        style={{ background: 'rgba(0,0,0,0.6)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <span className="text-sm font-black" style={{ color: 'var(--accent)' }}>🚁 GCS</span>
          <span className="text-xs font-mono" style={{ color: '#475569' }}>37 SUSHI — {scen.nome.toUpperCase()}</span>
        </div>
        <div className="flex items-center gap-4">
          {tel.rth && <span className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.4)' }}>🏠 RTH ATIVO</span>}
          <span className="text-xs font-mono" style={{ color: tel.battery_warn ? '#f87171' : '#475569' }}>
            {tel.deliveries || 0}/{tel.total || scen.deliveries} entregas
          </span>
          <button onClick={() => { cancelAnimationFrame(rafRef.current); setScreen('menu'); }}
            className="text-xs px-2 py-1 rounded-lg"
            style={{ color: '#475569', border: '1px solid #1e293b' }}>
            Sair
          </button>
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row">

        {/* Mapa principal */}
        <div className="relative flex-1">
          <canvas ref={canvasRef} width={MW} height={MH}
            style={{ width: '100%', display: 'block' }} />
        </div>

        {/* Painel de telemetria */}
        <div className="lg:w-60 shrink-0 flex flex-col"
          style={{ background: 'rgba(0,0,0,0.5)', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>

          {/* Seção: Aeronave */}
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#475569' }}>Aeronave</p>
            {/* Bateria */}
            <div className="mb-2">
              <div className="flex justify-between mb-1">
                <span className="text-[9px] font-mono" style={{ color: '#475569' }}>BATERIA</span>
                <span className="text-[9px] font-black font-mono" style={{ color: battColor }}>{Math.round(tel.battery || 100)}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#0f172a' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${tel.battery || 100}%`, background: battColor }} />
              </div>
            </div>
            {/* Sinal */}
            <div className="mb-3">
              <div className="flex justify-between mb-1">
                <span className="text-[9px] font-mono" style={{ color: '#475569' }}>SINAL</span>
                <span className="text-[9px] font-black font-mono" style={{ color: sigColor }}>{tel.signal || 98}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#0f172a' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${tel.signal || 98}%`, background: sigColor }} />
              </div>
            </div>
            {/* Métricas */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'ALT', value: `${tel.alt || 0}m`, color: tel.alt > 0 ? '#60a5fa' : '#475569' },
                { label: 'VEL', value: `${tel.speed || 0}km/h`, color: '#94a3b8' },
                { label: 'VENTO', value: `${windMs}m/s`, color: parseFloat(windMs) > 2 ? '#f59e0b' : '#22c55e' },
                { label: 'DIR.V', value: `${windDeg}°`, color: '#475569' },
              ].map(m => (
                <div key={m.label} className="rounded-lg px-2 py-1.5 text-center" style={{ background: '#060d1a' }}>
                  <p className="text-[8px] font-mono mb-0.5" style={{ color: '#334155' }}>{m.label}</p>
                  <p className="text-xs font-black font-mono" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Seção: Missão */}
          <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#475569' }}>Missão</p>
            {tel.spot ? (
              <div>
                <div className="text-xs font-bold mb-1" style={{ color: '#fbbf24' }}>▶ {tel.spot.nome}</div>
                <div className="text-[9px] mb-2" style={{ color: '#475569' }}>{tel.spot.rua}</div>
                <div className="text-[9px] rounded-lg px-2 py-1.5" style={{ background: '#060d1a', color: '#94a3b8' }}>
                  Altitude ideal: {tel.spot.alt_min}–{tel.spot.alt_max}m
                </div>
                {tel.winching && (
                  <div className="mt-2">
                    <div className="text-[9px] mb-1" style={{ color: '#60a5fa' }}>📦 Guincho: {((tel.winch || 0) / WINCH_DIST * 100).toFixed(0)}%</div>
                    <div className="h-1.5 rounded-full" style={{ background: '#0f172a' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${(tel.winch || 0) / WINCH_DIST * 100}%`, background: '#60a5fa' }} />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[10px]" style={{ color: '#334155' }}>
                {(tel.deliveries || 0) >= scen.deliveries ? '✅ Todas entregas concluídas' : 'Aguardando pedido...'}
              </p>
            )}
          </div>

          {/* Log */}
          <div className="px-4 py-3 flex-1 overflow-hidden">
            <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: '#475569' }}>Log</p>
            <div className="space-y-1">
              {logLines.slice(0, 6).map((l, i) => (
                <p key={i} className="text-[9px] font-mono leading-tight" style={{ color: i === 0 ? '#60a5fa' : '#334155' }}>{l}</p>
              ))}
            </div>
          </div>

          {/* Controles RTH */}
          <div className="px-3 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="flex gap-2">
              <button
                onMouseDown={() => { if (gameRef.current && !gameRef.current.rth) { gameRef.current.rth = true; gameRef.current.mode = 'auto'; gameRef.current.rthTarget = { x: BASE.x, y: BASE.y }; } }}
                className="flex-1 py-2 rounded-xl text-[10px] font-black transition-all active:scale-95"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                🏠 RTH
              </button>
              {tel.spot && !tel.winching && (
                <button
                  onMouseDown={() => {
                    if (gameRef.current) {
                      const g = gameRef.current;
                      const d = g.drone;
                      const spot = g.currentSpot;
                      if (!spot) return;
                      const dist = Math.hypot(d.x - spot.x, d.y - spot.y);
                      if (dist < spot.r + 10 && d.alt >= spot.alt_min && d.alt <= spot.alt_max) {
                        g.winching = true;
                        g.phase = 'delivering';
                      }
                    }
                  }}
                  className="flex-1 py-2 rounded-xl text-[10px] font-black transition-all active:scale-95"
                  style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.25)' }}>
                  📦 Soltar
                </button>
              )}
            </div>
            <p className="text-[8px] text-center mt-2" style={{ color: '#1e293b' }}>
              R = RTH · F = Soltar pacote · E/Q = Alt
            </p>
          </div>
        </div>
      </div>

      {/* ── Mobile: joystick ─────────────────────────────── */}
      <div className="flex lg:hidden items-center justify-between px-6 py-4">
        <div className="w-28 h-28 rounded-full flex items-center justify-center select-none touch-none cursor-pointer"
          style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid #1e293b' }}
          onTouchStart={onJoyStart}
          onTouchMove={onJoyMove}
          onTouchEnd={onJoyEnd}>
          <p className="text-[10px] font-bold" style={{ color: '#334155' }}>MOVER</p>
        </div>
        <div className="flex flex-col gap-2">
          <button className="w-16 h-12 rounded-xl font-black text-base active:scale-90"
            style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}
            onTouchStart={() => { touchRef.current.up = true; }}
            onTouchEnd={() => { touchRef.current.up = false; }}>▲</button>
          <button className="w-16 h-12 rounded-xl font-black text-base active:scale-90"
            style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
            onTouchStart={() => { touchRef.current.down = true; }}
            onTouchEnd={() => { touchRef.current.down = false; }}>▼</button>
        </div>
        <button className="w-16 h-12 rounded-xl font-black text-xs active:scale-90"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
          onTouchStart={() => { if (gameRef.current) { gameRef.current.rth = true; } }}>
          🏠 RTH
        </button>
      </div>
    </div>
  );
}
