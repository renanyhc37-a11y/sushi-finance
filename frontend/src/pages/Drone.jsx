import React, { useEffect, useRef, useState } from 'react';

// ═══════════════════════════════════════════════════════════════════
//  SUSHI DRONE — Simulador de Entregas Aéreas · 37 Sushi Paranavaí
// ═══════════════════════════════════════════════════════════════════

// ── Geometria do mundo ───────────────────────────────────────────
const CW = 900, CH = 540;
const ST = 26;            // largura das ruas
const BW = 196, BH = 162; // dimensões de cada bloco
const CELL_X = BW + ST;   // 222
const CELL_Y = BH + ST;   // 188
// 3 blocos × 222 + 4 ruas × 26 = 666 + 104 = 770 → pad 65 cada lado
// 2 blocos × 188 + 3 ruas × 26 = 376 + 78 = 454 → pad 43 cada lado
// vamos centrar
const COLS = 3, ROWS = 2;
const OX = Math.round((CW - (COLS * CELL_X + ST)) / 2); // 65
const OY = Math.round((CH - (ROWS * CELL_Y + ST)) / 2); // 43

// Helpers de coordenadas
const streetX  = c => OX + c * CELL_X;
const streetY  = r => OY + r * CELL_Y;
const blockX   = c => streetX(c) + ST;
const blockY   = r => streetY(r) + ST;
const blockCx  = c => blockX(c) + BW / 2;
const blockCy  = r => blockY(r) + BH / 2;

// Alturas dos prédios em metros (0 = parque/térreo)
const BLOCK_H = [
  [28, 0, 18],   // row 0
  [12, 0, 24],   // row 1
];
// Bloco do restaurante
const REST_ROW = 0, REST_COL = 1;
// Pontos de entrega (block row, col, nome de rua)
const DELIVERY_SPOTS = [
  { r: 0, c: 0, nome: 'Rua das Flores, 12'     },
  { r: 0, c: 2, nome: 'Av. Central, 88'         },
  { r: 1, c: 2, nome: 'Rua do Parque, 5'        },
  { r: 1, c: 0, nome: 'Rua dos Pinheiros, 44'   },
];

// ── Física ───────────────────────────────────────────────────────
const ACCEL      = 0.22;
const DRAG       = 0.87;
const MAX_SPEED  = 5.8;
const ALT_RATE   = 1.4;   // m/s de subida/descida
const MAX_ALT    = 120;   // metros
const BATT_HOVER = 0.007; // % por frame pairando
const BATT_MOVE  = 0.010; // % extra por frame movendo
const BATT_CLIMB = 0.014; // % extra subindo
const BATT_LOW   = 20;    // limiar de aviso

// ── Cenários ─────────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 'tutorial',
    nome: 'Tutorial',
    desc: 'Dia calmo · 1 entrega · Sem vento',
    icon: '🟢', wind: 0, night: false, entregas: 1,
    dica: 'Decolagem: [E] subir altitude → voar → pousar sobre o destino [Q]',
  },
  {
    id: 'operacao',
    nome: 'Operação Padrão',
    desc: 'Vento leve · 3 entregas consecutivas',
    icon: '🟡', wind: 1.4, night: false, entregas: 3,
    dica: 'Antecipe o vento: compense a deriva antes de chegar ao destino',
  },
  {
    id: 'tempestade',
    nome: 'Vento Forte',
    desc: 'Condições adversas · 3 entregas · Alto risco',
    icon: '🔴', wind: 3.2, night: false, entregas: 3,
    dica: 'Voe alto para reduzir turbulência. Reserve bateria para voltar!',
  },
  {
    id: 'noite',
    nome: 'Turno da Noite',
    desc: 'Visibilidade reduzida · Vento moderado · 4 entregas',
    icon: '🌙', wind: 1.8, night: true, entregas: 4,
    dica: 'Luzes do drone visíveis mas mapa escuro. Use o mini-radar.',
  },
];

// ── Cores ─────────────────────────────────────────────────────────
const C = {
  street:    '#1a2235',
  streetLine:'#232f45',
  block:     '#111827',
  blockEdge: '#1e2d42',
  building:  '#1e293b',
  buildSide: '#0f172a',
  buildTop:  '#2d3f5a',
  rest:      '#f97316',
  restTop:   '#fb923c',
  park:      '#14532d',
  parkLight: '#166534',
  delivery:  '#fbbf24',
  drone:     '#e2e8f0',
  rotor:     '#94a3b8',
  shadow:    'rgba(0,0,0,0.4)',
  hud:       'rgba(0,0,0,0.75)',
  green:     '#22c55e',
  red:       '#ef4444',
  amber:     '#f59e0b',
  blue:      '#60a5fa',
  text:      '#f1f5f9',
  textDim:   '#64748b',
};

// ── Init game state ───────────────────────────────────────────────
function initGame(scenario) {
  const restX = blockCx(REST_COL);
  const restY = blockCy(REST_ROW);
  // baralha pontos de entrega
  const spots = [...DELIVERY_SPOTS].sort(() => Math.random() - 0.5).slice(0, scenario.entregas);
  return {
    scenario,
    drone: { x: restX, y: restY, vx: 0, vy: 0, alt: 0, heading: 0 },
    battery: 100,
    wind: { angle: Math.random() * Math.PI * 2, speed: scenario.wind },
    windDrift: { angle: Math.random() * Math.PI * 2, speed: scenario.wind },
    queue: spots,          // entregas restantes
    currentDelivery: null, // spot atual
    phase: 'idle',         // 'idle'|'carrying'|'descending'|'landing'|'done'
    landed: true,
    score: 0,
    totalScore: 0,
    deliveryCount: 0,
    startTime: Date.now(),
    missionTime: 0,
    frame: 0,
    windChangeTimer: 0,
    status: '',            // mensagem HUD
    flash: 0,             // frames de flash
    particles: [],
    trails: [],
  };
}

// ── Funções de desenho ────────────────────────────────────────────
function drawMap(ctx, g) {
  const night = g.scenario.night;

  // Fundo
  ctx.fillStyle = night ? '#060d1a' : '#0f172a';
  ctx.fillRect(0, 0, CW, CH);

  // Ruas
  for (let r = 0; r <= ROWS; r++) {
    const y = streetY(r);
    ctx.fillStyle = night ? '#0d1629' : C.street;
    ctx.fillRect(OX, y, COLS * CELL_X + ST, ST);
    // linhas centrais
    ctx.setLineDash([12, 18]);
    ctx.strokeStyle = night ? '#1a2a40' : C.streetLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(OX, y + ST / 2);
    ctx.lineTo(OX + COLS * CELL_X + ST, y + ST / 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  for (let c = 0; c <= COLS; c++) {
    const x = streetX(c);
    ctx.fillStyle = night ? '#0d1629' : C.street;
    ctx.fillRect(x, OY, ST, ROWS * CELL_Y + ST);
    ctx.setLineDash([12, 18]);
    ctx.strokeStyle = night ? '#1a2a40' : C.streetLine;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + ST / 2, OY);
    ctx.lineTo(x + ST / 2, OY + ROWS * CELL_Y + ST);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Blocos
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const bx = blockX(c), by = blockY(r);
      const floors = BLOCK_H[r][c];
      const isRest = (r === REST_ROW && c === REST_COL);
      const isPark = floors === 0 && !isRest;

      if (isPark) {
        // Parque / área aberta
        ctx.fillStyle = night ? '#0c2a15' : C.park;
        ctx.fillRect(bx, by, BW, BH);
        ctx.fillStyle = night ? '#0f3318' : C.parkLight;
        for (let i = 0; i < 6; i++) {
          const tx = bx + 20 + (i % 3) * 65, ty = by + 30 + Math.floor(i / 3) * 70;
          ctx.beginPath();
          ctx.arc(tx, ty, 14, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (isRest) {
        // Restaurante
        ctx.fillStyle = night ? '#1a120a' : '#1c1409';
        ctx.fillRect(bx, by, BW, BH);
        // Topo laranja
        ctx.fillStyle = C.rest;
        ctx.fillRect(bx + 20, by + 20, BW - 40, BH - 40);
        ctx.fillStyle = C.restTop;
        ctx.fillRect(bx + 28, by + 28, BW - 56, BH - 56);
        // Logo "37"
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('37', bx + BW / 2, by + BH / 2 - 10);
        ctx.font = 'bold 10px monospace';
        ctx.fillText('SUSHI', bx + BW / 2, by + BH / 2 + 10);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        // Heliponto
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(bx + BW / 2, by + BH / 2, 28, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Prédio comum
        const h = Math.min(floors * 8, BH - 8); // altura visual em px
        ctx.fillStyle = night ? '#0d1729' : C.block;
        ctx.fillRect(bx, by, BW, BH);
        // Sombra/profundidade direita
        ctx.fillStyle = night ? '#09111f' : C.buildSide;
        ctx.fillRect(bx + BW - 6, by + 6, 6, BH - 6);
        // Topo do prédio
        ctx.fillStyle = night ? '#18263a' : C.buildTop;
        ctx.fillRect(bx + 6, by + 6, BW - 12, h);
        // Janelas (seed determinística por bloco para não piscar)
        const wCols = Math.floor((BW - 20) / 20);
        const wRows = Math.floor(h / 20);
        for (let wr = 0; wr < wRows; wr++) {
          for (let wc = 0; wc < wCols; wc++) {
            const seed = (r * 100 + c * 10 + wr * 7 + wc * 3) % 10;
            const acesa = !night || seed < 6;
            if (!acesa) continue;
            ctx.fillStyle = night ? 'rgba(255,220,100,0.18)' : 'rgba(150,200,255,0.07)';
            ctx.fillRect(bx + 12 + wc * 20, by + 10 + wr * 20, 10, 12);
          }
        }
      }
      // Borda do bloco
      ctx.strokeStyle = night ? '#0f1e35' : C.blockEdge;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, BW, BH);
    }
  }
}

function drawDelivery(ctx, spot, pulse, night) {
  const cx = blockCx(spot.c), cy = blockCy(spot.r);
  // Anel pulsante
  const r1 = 22 + Math.sin(pulse) * 5;
  ctx.strokeStyle = C.delivery;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.5 + 0.3 * Math.abs(Math.sin(pulse));
  ctx.beginPath();
  ctx.arc(cx, cy, r1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Marcador
  ctx.fillStyle = C.delivery;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('📦', cx, cy);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  // Label
  ctx.fillStyle = C.delivery;
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(spot.nome, cx, cy + 22);
  ctx.textAlign = 'left';
}

function drawDrone(ctx, d, frame, night) {
  const { x, y, alt, heading } = d;
  const scale = 1 + alt * 0.003; // parece menor no chão

  // Sombra (tamanho e opacidade proporcional à altitude)
  if (alt > 0) {
    const shadowOff = alt * 0.3;
    const shadowR   = 18 * scale;
    const alpha     = Math.max(0.08, 0.35 - alt * 0.003);
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x + shadowOff, y + shadowOff, shadowR, shadowR * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.scale(scale, scale);

  const rr = 12; // rotor radius from center

  // Braços
  ctx.strokeStyle = night ? '#334155' : '#475569';
  ctx.lineWidth = 3;
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(sx * rr, sy * rr);
    ctx.stroke();
  });

  // Rotores (spinning)
  const spin = frame * 0.4;
  ctx.strokeStyle = night ? '#60a5fa' : C.rotor;
  ctx.lineWidth = 2;
  [[-rr, -rr], [rr, -rr], [-rr, rr], [rr, rr]].forEach(([rx, ry], i) => {
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(spin + i * Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(7, 0);
    ctx.stroke();
    ctx.restore();
  });

  // Corpo central
  ctx.fillStyle = night ? '#1e3a5f' : '#334155';
  ctx.fillRect(-6, -6, 12, 12);
  ctx.fillStyle = night ? '#3b82f6' : C.drone;
  ctx.fillRect(-4, -4, 8, 8);

  // LED frontal
  ctx.fillStyle = night ? '#22c55e' : '#4ade80';
  ctx.fillRect(2, -5, 3, 3);

  ctx.restore();

  // Altitude label
  if (alt > 2) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x + 14, y - 22, 44, 16);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(`${Math.round(alt)}m`, x + 17, y - 10);
  }
}

function drawHUD(ctx, g) {
  const { drone, battery, wind, windDrift, scenario, deliveryCount, queue, currentDelivery, flash } = g;
  const night = scenario.night;

  // Flash de entrega
  if (flash > 0) {
    ctx.fillStyle = `rgba(34,197,94,${flash / 20 * 0.3})`;
    ctx.fillRect(0, 0, CW, CH);
  }

  // ── Barra superior ────────────────────────────────────────────
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, CW, 44);

  // Bateria
  const battX = 12, battY = 8;
  const battColor = battery > 40 ? C.green : battery > BATT_LOW ? C.amber : C.red;
  ctx.fillStyle = C.textDim;
  ctx.font = '9px monospace';
  ctx.fillText('BATERIA', battX, battY + 9);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(battX, battY + 13, 100, 12);
  ctx.fillStyle = battColor;
  ctx.fillRect(battX, battY + 13, battery, 12);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(battX, battY + 13, 100, 12);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px monospace';
  ctx.fillText(`${Math.round(battery)}%`, battX + 104, battY + 23);

  // Altitude
  const altX = 200;
  ctx.fillStyle = C.textDim;
  ctx.font = '9px monospace';
  ctx.fillText('ALTITUDE', altX, battY + 9);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`${Math.round(drone.alt)}m`, altX, battY + 28);

  // Velocidade
  const velX = 290;
  const speed = Math.sqrt(drone.vx ** 2 + drone.vy ** 2);
  ctx.fillStyle = C.textDim;
  ctx.font = '9px monospace';
  ctx.fillText('VELOC.', velX, battY + 9);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`${(speed * 3.6).toFixed(1)} km/h`, velX, battY + 28);

  // Vento
  const windX = 410;
  const eff = windDrift.speed;
  const windColor = eff < 1.5 ? C.green : eff < 2.5 ? C.amber : C.red;
  ctx.fillStyle = C.textDim;
  ctx.font = '9px monospace';
  ctx.fillText('VENTO', windX, battY + 9);
  ctx.save();
  ctx.translate(windX + 8, battY + 22);
  ctx.rotate(windDrift.angle);
  ctx.fillStyle = windColor;
  ctx.beginPath();
  ctx.moveTo(0, -8); ctx.lineTo(5, 5); ctx.lineTo(-5, 5); ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = windColor;
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`${eff.toFixed(1)} m/s`, windX + 20, battY + 26);

  // Missão
  const misX = 560;
  ctx.fillStyle = C.textDim;
  ctx.font = '9px monospace';
  ctx.fillText('MISSÃO', misX, battY + 9);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px monospace';
  const total = scenario.entregas;
  ctx.fillText(`${deliveryCount}/${total} entregues`, misX, battY + 22);
  if (currentDelivery) {
    ctx.fillStyle = C.delivery;
    ctx.font = '9px monospace';
    ctx.fillText(`▶ ${currentDelivery.nome}`, misX, battY + 34);
  } else if (queue.length > 0) {
    ctx.fillStyle = C.blue;
    ctx.font = '9px monospace';
    ctx.fillText('Buscar próximo pedido', misX, battY + 34);
  }

  // Tempo
  const elapsed = Math.floor(g.missionTime / 1000);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');
  ctx.fillStyle = C.textDim;
  ctx.font = '9px monospace';
  ctx.fillText('TEMPO', CW - 64, battY + 9);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`${mm}:${ss}`, CW - 64, battY + 26);

  // ── Mini-bússola de vento (canto inferior direito) ────────────
  const cx2 = CW - 36, cy2 = CH - 36;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.arc(cx2, cy2, 28, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#334155'; ctx.lineWidth = 1;
  ctx.stroke();
  // NSEO
  ctx.fillStyle = '#475569'; ctx.font = '8px monospace'; ctx.textAlign = 'center';
  ctx.fillText('N', cx2, cy2 - 16);
  ctx.fillText('S', cx2, cy2 + 22);
  ctx.fillText('L', cx2 + 18, cy2 + 4);
  ctx.fillText('O', cx2 - 18, cy2 + 4);
  // Seta de vento
  ctx.save();
  ctx.translate(cx2, cy2);
  ctx.rotate(windDrift.angle);
  ctx.fillStyle = windColor;
  ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(5, 8); ctx.lineTo(-5, 8); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.textAlign = 'left';

  // ── Aviso de bateria baixa ────────────────────────────────────
  if (battery < 20 && g.frame % 40 < 20) {
    ctx.fillStyle = 'rgba(239,68,68,0.9)';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚠  BATERIA CRÍTICA — RETORNE IMEDIATAMENTE  ⚠', CW / 2, CH - 14);
    ctx.textAlign = 'left';
  }

  // ── Status message ────────────────────────────────────────────
  if (g.status && g.flash > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(CW / 2 - 150, CH / 2 - 20, 300, 36);
    ctx.fillStyle = C.delivery;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(g.status, CW / 2, CH / 2 + 4);
    ctx.textAlign = 'left';
  }
}

function drawParticles(ctx, particles) {
  particles.forEach(p => {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  });
  ctx.globalAlpha = 1;
}

function spawnLandingParticles(g, x, y) {
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const s = 1 + Math.random() * 2;
    g.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      color: C.delivery, life: 40, maxLife: 40,
    });
  }
}

// ── Componente principal ──────────────────────────────────────────
export default function Drone() {
  const canvasRef = useRef(null);
  const gameRef   = useRef(null);
  const rafRef    = useRef(null);
  const keysRef   = useRef({});
  const touchRef  = useRef({ dx: 0, dy: 0, up: false, down: false });

  const [screen, setScreen]     = useState('menu');   // 'menu'|'game'|'results'
  const [selScen, setSelScen]   = useState(0);
  const [hud, setHud]           = useState({});        // espelho React do gameRef
  const [results, setResults]   = useState(null);

  // ── Input ────────────────────────────────────────────────────
  useEffect(() => {
    const onDown = e => { keysRef.current[e.code] = true; };
    const onUp   = e => { delete keysRef.current[e.code]; };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  // ── Game loop ─────────────────────────────────────────────────
  function startGame(scen) {
    gameRef.current = initGame(scen);
    setScreen('game');
  }

  useEffect(() => {
    if (screen !== 'game') { cancelAnimationFrame(rafRef.current); return; }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function loop() {
      rafRef.current = requestAnimationFrame(loop);
      const g = gameRef.current;
      if (!g) return;
      if (g.over) return;
      g.frame++;
      g.missionTime = Date.now() - g.startTime;

      const keys  = keysRef.current;
      const touch = touchRef.current;
      const d     = g.drone;

      // ── Vento oscila suavemente ──
      g.windChangeTimer++;
      if (g.windChangeTimer > 180) {
        g.windChangeTimer = 0;
        g.windDrift = {
          angle: g.windDrift.angle + (Math.random() - 0.5) * 0.8,
          speed: Math.max(0, g.scenario.wind + (Math.random() - 0.5) * 0.6),
        };
      }

      // ── Controles ──────────────────────────────────────────
      const mv = { x: 0, y: 0 };
      if (keys['KeyW'] || keys['ArrowUp']    || touch.dy < -0.2) mv.y = -1;
      if (keys['KeyS'] || keys['ArrowDown']  || touch.dy >  0.2) mv.y =  1;
      if (keys['KeyA'] || keys['ArrowLeft']  || touch.dx < -0.2) mv.x = -1;
      if (keys['KeyD'] || keys['ArrowRight'] || touch.dx >  0.2) mv.x =  1;
      const climbing   = keys['KeyE'] || keys['Space'] || touch.up;
      const descending = keys['KeyQ'] || touch.down;

      // ── Física ─────────────────────────────────────────────
      const moving = mv.x !== 0 || mv.y !== 0;

      if (!g.landed || climbing) {
        // Empuxo
        if (climbing && d.alt < MAX_ALT) d.alt = Math.min(MAX_ALT, d.alt + ALT_RATE);
        if (descending && d.alt > 0)     d.alt = Math.max(0, d.alt - ALT_RATE);

        // Horizontal
        d.vx = (d.vx + mv.x * ACCEL) * DRAG;
        d.vy = (d.vy + mv.y * ACCEL) * DRAG;
        // clamp
        const sp = Math.sqrt(d.vx ** 2 + d.vy ** 2);
        if (sp > MAX_SPEED) { d.vx = d.vx / sp * MAX_SPEED; d.vy = d.vy / sp * MAX_SPEED; }

        // Vento (mais forte em altitude baixa por turbulência)
        const windFactor = 0.4 + d.alt * 0.006;
        d.vx += Math.cos(g.windDrift.angle) * g.windDrift.speed * 0.04 * windFactor;
        d.vy += Math.sin(g.windDrift.angle) * g.windDrift.speed * 0.04 * windFactor;

        // Heading visual (aponta pro movimento)
        if (moving) {
          const targetH = Math.atan2(mv.y, mv.x) + Math.PI / 2;
          const diff = ((targetH - d.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          d.heading += diff * 0.08;
        }

        d.x = Math.max(OX, Math.min(OX + COLS * CELL_X, d.x + d.vx));
        d.y = Math.max(OY, Math.min(OY + ROWS * CELL_Y, d.y + d.vy));

        // Bateria
        let drain = BATT_HOVER;
        if (moving)  drain += BATT_MOVE;
        if (climbing) drain += BATT_CLIMB;
        g.battery = Math.max(0, g.battery - drain);

        // Pouso automático se bateria = 0
        if (g.battery <= 0) {
          d.alt = 0; g.landed = true; d.vx = 0; d.vy = 0;
          if (!g.over) { g.over = true; endGame(g, 'battery'); }
          return;
        }

        // Pousa se altitude chega a 0
        if (d.alt <= 0 && !climbing) {
          d.alt = 0;
          d.vx = 0; d.vy = 0;
          g.landed = true;
          handleLanding(g);
        }
      }

      // Partículas
      g.particles = g.particles
        .map(p => ({ ...p, x: p.x + p.vx, y: p.y + p.vy, vy: p.vy + 0.05, life: p.life - 1 }))
        .filter(p => p.life > 0);

      if (g.flash > 0) g.flash--;

      // ── Desenho ─────────────────────────────────────────────
      drawMap(ctx, g);
      // Entrega alvo
      if (g.currentDelivery) {
        drawDelivery(ctx, g.currentDelivery, g.frame * 0.06, g.scenario.night);
      } else if (g.queue.length > 0 && g.deliveryCount < g.scenario.entregas) {
        // Mostra restaurante como ponto de coleta
        const pulse = g.frame * 0.08;
        const rx = blockCx(REST_COL), ry = blockCy(REST_ROW);
        ctx.strokeStyle = C.rest;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.5 + 0.3 * Math.abs(Math.sin(pulse));
        ctx.beginPath(); ctx.arc(rx, ry, 30 + Math.sin(pulse) * 5, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = C.rest;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BUSCAR PEDIDO', rx, ry + 46);
        ctx.textAlign = 'left';
      }
      drawParticles(ctx, g.particles);
      drawDrone(ctx, d, g.frame, g.scenario.night);
      drawHUD(ctx, g);

      // Sync HUD a cada 6 frames
      if (g.frame % 6 === 0) {
        setHud({
          battery: g.battery,
          alt: Math.round(d.alt),
          landed: g.landed,
          delivery: g.currentDelivery?.nome,
          count: g.deliveryCount,
          total: g.scenario.entregas,
          phase: g.phase,
        });
      }
    }
    loop();
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen]);

  function handleLanding(g) {
    const d = g.drone;
    const restCx = blockCx(REST_COL), restCy = blockCy(REST_ROW);

    // Verifica se está no restaurante para pegar pedido
    if (!g.currentDelivery && g.queue.length > 0) {
      const dist = Math.hypot(d.x - restCx, d.y - restCy);
      if (dist < 60) {
        g.currentDelivery = g.queue.shift();
        g.status = `✓ Pedido retirado! → ${g.currentDelivery.nome}`;
        g.flash = 50;
        spawnLandingParticles(g, d.x, d.y);
      }
    }
    // Verifica se está no ponto de entrega
    else if (g.currentDelivery) {
      const tgt = g.currentDelivery;
      const dist = Math.hypot(d.x - blockCx(tgt.c), d.y - blockCy(tgt.r));
      if (dist < 65) {
        const timeSec = g.missionTime / 1000;
        const battBonus = Math.round(g.battery * 0.5);
        const timeBonus = Math.max(0, Math.round(300 - timeSec * 2));
        const pts = 100 + battBonus + timeBonus;
        g.score = pts;
        g.totalScore += pts;
        g.deliveryCount++;
        g.currentDelivery = null;
        spawnLandingParticles(g, d.x, d.y);
        g.status = `🎉 Entregue! +${pts} pts`;
        g.flash = 60;

        if (g.deliveryCount >= g.scenario.entregas) {
          g.over = true;
          setTimeout(() => endGame(g, 'success'), 1500);
        }
      }
    }
  }

  function endGame(g, reason) {
    cancelAnimationFrame(rafRef.current);
    const elapsed = Math.floor(g.missionTime / 1000);
    setResults({
      reason,
      score: g.totalScore,
      deliveries: g.deliveryCount,
      total: g.scenario.entregas,
      battery: Math.round(g.battery),
      time: elapsed,
      scenario: g.scenario,
    });
    setScreen('results');
  }

  // ── Touch joystick ───────────────────────────────────────────
  const joystickRef = useRef(null);
  const joyOrigin   = useRef(null);

  function onJoyStart(e) {
    const t = e.changedTouches[0];
    joyOrigin.current = { x: t.clientX, y: t.clientY };
  }
  function onJoyMove(e) {
    if (!joyOrigin.current) return;
    const t = e.changedTouches[0];
    const dx = (t.clientX - joyOrigin.current.x) / 50;
    const dy = (t.clientY - joyOrigin.current.y) / 50;
    touchRef.current.dx = Math.max(-1, Math.min(1, dx));
    touchRef.current.dy = Math.max(-1, Math.min(1, dy));
  }
  function onJoyEnd() {
    joyOrigin.current = null;
    touchRef.current.dx = 0;
    touchRef.current.dy = 0;
  }

  // ── Render ───────────────────────────────────────────────────
  if (screen === 'menu') {
    const scen = SCENARIOS[selScen];
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
        style={{ background: 'var(--space-bg)' }}>

        {/* Título */}
        <div className="text-center mb-8">
          <div style={{ fontSize: 52, lineHeight: 1 }}>🚁</div>
          <h1 className="text-3xl font-black mt-3" style={{ color: 'var(--accent)' }}>SUSHI DRONE</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--txt-dim)' }}>
            Simulador de Entregas Aéreas · 37 Sushi Paranavaí
          </p>
          <div className="mt-2 px-3 py-1 rounded-full text-xs font-bold inline-block"
            style={{ background: 'rgba(251,146,60,0.1)', color: '#fb923c', border: '1px solid rgba(251,146,60,0.3)' }}>
            🔬 Protótipo do Futuro — Treinamento Operacional
          </div>
        </div>

        {/* Seleção de cenário */}
        <div className="w-full max-w-lg space-y-2 mb-6">
          <p className="text-xs font-black uppercase tracking-wider mb-3" style={{ color: 'var(--txt-dim)' }}>
            Escolha o cenário
          </p>
          {SCENARIOS.map((s, i) => (
            <button key={s.id} onClick={() => setSelScen(i)}
              className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-left transition-all"
              style={{
                background: selScen === i ? 'rgba(var(--accent-rgb),0.12)' : 'var(--space-elev)',
                border: `1px solid ${selScen === i ? 'rgba(var(--accent-rgb),0.4)' : 'var(--hairline)'}`,
              }}>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
              <div className="flex-1">
                <p className="font-black text-sm" style={{ color: 'var(--txt)' }}>{s.nome}</p>
                <p className="text-xs" style={{ color: 'var(--txt-dim)' }}>{s.desc}</p>
              </div>
              {selScen === i && (
                <span className="text-xs font-bold px-2 py-1 rounded-lg"
                  style={{ background: 'rgba(var(--accent-rgb),0.2)', color: 'var(--accent)' }}>
                  Selecionado
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Dica */}
        <div className="w-full max-w-lg px-4 py-3 rounded-2xl mb-6"
          style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
          <p className="text-xs font-bold" style={{ color: 'var(--accent-2)' }}>💡 Dica: {scen.dica}</p>
        </div>

        {/* Controles */}
        <div className="w-full max-w-lg px-4 py-3 rounded-2xl mb-6"
          style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
          <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: 'var(--txt-dim)' }}>Controles</p>
          <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--txt-dim)' }}>
            <span><kbd className="px-1.5 py-0.5 rounded font-mono text-[10px]" style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>W A S D</kbd> / <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px]" style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>↑ ← ↓ →</kbd> Mover</span>
            <span><kbd className="px-1.5 py-0.5 rounded font-mono text-[10px]" style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>E</kbd> / <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px]" style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>Space</kbd> Subir</span>
            <span><kbd className="px-1.5 py-0.5 rounded font-mono text-[10px]" style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>Q</kbd> Descer / Pousar</span>
            <span>📱 Joystick virtual no mobile</span>
          </div>
        </div>

        <button onClick={() => startGame(scen)}
          className="px-10 py-4 rounded-2xl font-black text-white text-base transition-all active:scale-95 hover:scale-105"
          style={{ background: 'var(--accent)', boxShadow: '0 0 30px rgba(var(--accent-rgb),0.4)' }}>
          🚀 Iniciar Simulação
        </button>

        <p className="mt-4 text-xs text-center" style={{ color: 'var(--txt-dim)', maxWidth: 360 }}>
          Este simulador projeta o futuro das entregas por drone do 37 Sushi. Use para treinar rotas, gestão de bateria e reação ao vento.
        </p>
      </div>
    );
  }

  if (screen === 'results') {
    const r = results;
    const pct = Math.round((r.deliveries / r.total) * 100);
    const stars = pct === 100 ? 3 : pct >= 66 ? 2 : pct >= 33 ? 1 : 0;
    const mm = String(Math.floor(r.time / 60)).padStart(2, '0');
    const ss = String(r.time % 60).padStart(2, '0');
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
        style={{ background: 'var(--space-bg)' }}>
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div style={{ fontSize: 48, lineHeight: 1 }}>
              {r.reason === 'success' ? (stars === 3 ? '🏆' : '✅') : '🔋'}
            </div>
            <h2 className="text-2xl font-black mt-3" style={{ color: 'var(--txt)' }}>
              {r.reason === 'success' ? 'Missão concluída!' : 'Bateria zerada!'}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--txt-dim)' }}>{r.scenario.nome}</p>
            <div className="flex justify-center gap-1 mt-3">
              {[0, 1, 2].map(i => (
                <span key={i} style={{ fontSize: 28, opacity: i < stars ? 1 : 0.2 }}>⭐</span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden mb-4" style={{ background: 'var(--space-surface)', border: '1px solid var(--hairline)' }}>
            {[
              { label: 'Pontuação total', value: r.score.toLocaleString(), color: 'var(--accent)', big: true },
              { label: 'Entregas realizadas', value: `${r.deliveries} / ${r.total}`, color: r.deliveries === r.total ? '#22c55e' : '#f59e0b' },
              { label: 'Bateria restante', value: `${r.battery}%`, color: r.battery > 30 ? '#22c55e' : '#ef4444' },
              { label: 'Tempo de voo', value: `${mm}:${ss}`, color: 'var(--txt)' },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3"
                style={{ borderBottom: i < 3 ? '1px solid var(--hairline)' : 'none' }}>
                <span className="text-sm" style={{ color: 'var(--txt-dim)' }}>{row.label}</span>
                <span className={`font-black ${row.big ? 'text-2xl' : 'text-base'}`} style={{ color: row.color }}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {/* Dicas pós-missão */}
          {r.battery < 15 && (
            <div className="rounded-xl px-4 py-3 mb-4 text-xs"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
              💡 <strong>Gestão de bateria:</strong> Reserve sempre 20% para o retorno ao ponto base. Rotas mais curtas primeiro!
            </div>
          )}
          {r.deliveries < r.total && (
            <div className="rounded-xl px-4 py-3 mb-4 text-xs"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fcd34d' }}>
              💡 <strong>Planejamento de rota:</strong> Comece pelas entregas mais distantes enquanto a bateria está cheia.
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => startGame(r.scenario)}
              className="flex-1 py-3 rounded-2xl font-black text-sm transition-all active:scale-95"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              🔄 Tentar novamente
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

  // ── Tela de jogo ─────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center" style={{ background: 'var(--space-bg)', minHeight: '100vh' }}>
      {/* Canvas do jogo */}
      <div className="relative w-full" style={{ maxWidth: CW }}>
        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          style={{ width: '100%', display: 'block', imageRendering: 'crisp-edges' }}
        />
        {/* Botão sair */}
        <button
          onClick={() => { cancelAnimationFrame(rafRef.current); setScreen('menu'); }}
          className="absolute top-12 right-2 px-2 py-1 rounded-lg text-xs font-bold"
          style={{ background: 'rgba(0,0,0,0.7)', color: '#94a3b8', border: '1px solid #334155' }}>
          ✕ Sair
        </button>
      </div>

      {/* Controles mobile */}
      <div className="flex items-center justify-between w-full px-6 py-4 md:hidden" style={{ maxWidth: CW }}>
        {/* Joystick esquerdo */}
        <div
          ref={joystickRef}
          className="w-28 h-28 rounded-full flex items-center justify-center select-none touch-none"
          style={{ background: 'rgba(0,0,0,0.5)', border: '2px solid #334155' }}
          onTouchStart={onJoyStart}
          onTouchMove={e => { e.preventDefault(); onJoyMove(e); }}
          onTouchEnd={onJoyEnd}>
          <div className="text-center">
            <div style={{ fontSize: 20 }}>🕹️</div>
            <p className="text-[9px] font-bold mt-1" style={{ color: '#475569' }}>Mover</p>
          </div>
        </div>

        {/* Botões de altitude */}
        <div className="flex flex-col gap-3">
          <button
            className="w-16 h-16 rounded-2xl font-black text-xl flex items-center justify-center transition-all active:scale-90 select-none"
            style={{ background: 'rgba(34,197,94,0.2)', border: '2px solid rgba(34,197,94,0.4)', color: '#22c55e' }}
            onTouchStart={() => { touchRef.current.up = true; }}
            onTouchEnd={() => { touchRef.current.up = false; }}>
            ▲
          </button>
          <button
            className="w-16 h-16 rounded-2xl font-black text-xl flex items-center justify-center transition-all active:scale-90 select-none"
            style={{ background: 'rgba(239,68,68,0.2)', border: '2px solid rgba(239,68,68,0.4)', color: '#ef4444' }}
            onTouchStart={() => { touchRef.current.down = true; }}
            onTouchEnd={() => { touchRef.current.down = false; }}>
            ▼
          </button>
        </div>
      </div>

      {/* Controles desktop */}
      <div className="hidden md:flex items-center gap-6 py-3 text-xs" style={{ color: 'var(--txt-dim)' }}>
        <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>W A S D</kbd> Mover</span>
        <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>E</kbd> / <kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>Space</kbd> Subir</span>
        <span><kbd className="px-1.5 py-0.5 rounded font-mono" style={{ background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' }}>Q</kbd> Descer / Pousar</span>
        <span style={{ color: 'var(--accent-2)' }}>📦 Pouse no restaurante → pouse no destino</span>
      </div>
    </div>
  );
}
