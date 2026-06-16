import React, { useEffect, useRef, useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════
//  37 SUSHI GCS — Ground Control System
//  Software profissional de controle de drones
//  Simulação visual baseada em DJI FlightHub 2
// ═══════════════════════════════════════════════════════════

// ── MUNDO (900×700 metros) ────────────────────────────────
const WORLD = {
  w: 900, h: 700,
  base: { x: 450, y: 350, name: 'Base 37 Sushi' },
  bldgs: [
    { x:100, y:30,  w:130, d:100, h:48 }, { x:260, y:50,  w:80,  d:70,  h:22 },
    { x:360, y:35,  w:110, d:90,  h:35 }, { x:500, y:30,  w:100, d:95,  h:44 },
    { x:630, y:40,  w:120, d:85,  h:28 }, { x:770, y:28,  w:110, d:105, h:56 },
    { x:60,  y:140, w:110, d:90,  h:34 }, { x:60,  y:270, w:100, d:90,  h:20 },
    { x:60,  y:390, w:115, d:90,  h:46 }, { x:160, y:180, w:75,  d:65,  h:14 },
    { x:200, y:300, w:85,  d:75,  h:30 }, { x:310, y:190, w:95,  d:80,  h:18 },
    { x:560, y:200, w:90,  d:80,  h:24 }, { x:650, y:180, w:80,  d:70,  h:38 },
    { x:760, y:160, w:110, d:85,  h:40 }, { x:760, y:270, w:100, d:85,  h:26 },
    { x:760, y:380, w:110, d:85,  h:52 }, { x:660, y:290, w:95,  d:80,  h:36 },
    { x:80,  y:460, w:105, d:85,  h:22 }, { x:220, y:450, w:125, d:95,  h:38 },
    { x:380, y:470, w:85,  d:75,  h:16 }, { x:510, y:445, w:105, d:100, h:42 },
    { x:650, y:455, w:95,  d:85,  h:30 }, { x:770, y:462, w:105, d:85,  h:24 },
  ],
  parks: [
    { x:155, y:145, w:180, h:120 }, { x:500, y:138, w:220, h:120 },
    { x:295, y:365, w:190, h:135 }, { x:118, y:362, w:155, h:115 },
    { x:555, y:332, w:185, h:140 },
  ],
  roads: [
    { x:0,   y:185, w:900, h:18, label:'Av. Principal'    },
    { x:0,   y:315, w:900, h:18, label:'Rua Central'      },
    { x:0,   y:430, w:900, h:18, label:'Av. Sul'          },
    { x:185, y:0,   w:18,  h:700, label:'Rua Norte-Sul 1' },
    { x:405, y:0,   w:18,  h:700, label:'Rua Norte-Sul 2' },
    { x:615, y:0,   w:18,  h:700, label:'Av. Leste'       },
  ],
  spots: [
    { id:'P01', x:155, y:100, r:28, nome:'Rua Norte, 12',    alt:18, priority:'normal'  },
    { id:'P02', x:700, y:85,  r:28, nome:'Av. Central, 88',  alt:28, priority:'express' },
    { id:'P03', x:155, y:520, r:28, nome:'Rua Sul, 3',       alt:14, priority:'normal'  },
    { id:'P04', x:720, y:520, r:28, nome:'Eco Park, 44',     alt:12, priority:'normal'  },
    { id:'P05', x:55,  y:305, r:28, nome:'Av. Oeste, 22',    alt:20, priority:'vip'     },
    { id:'P06', x:848, y:330, r:28, nome:'Extremo Leste, 5', alt:22, priority:'normal'  },
    { id:'P07', x:450, y:130, r:28, nome:'Praça Central',    alt:10, priority:'express' },
    { id:'P08', x:350, y:590, r:28, nome:'Terminal Sul',     alt:14, priority:'normal'  },
  ],
};

// ── FÍSICA ────────────────────────────────────────────────
const MAX_H_SPD  = 14;
const MAX_V_SPD  = 6;
const H_DRAG     = 0.88;
const YAW_RATE   = 0.04;
const FOV_DEG    = 70;
const WINCH_SPD  = 0.05;

// ── CÂMERA 3D MATH ────────────────────────────────────────
function getVecs(h, p) {
  const cp=Math.cos(p), sp=Math.sin(p), sh=Math.sin(h), ch=Math.cos(h);
  const fwd={x:sh*cp,y:ch*cp,z:sp};
  if(Math.abs(cp)<0.001){const s=p<0?1:-1;return{fwd,right:{x:ch,y:-sh,z:0},up:{x:sh*s,y:ch*s,z:0}};}
  const rl=Math.sqrt(fwd.y*fwd.y+fwd.x*fwd.x)||1;
  const right={x:fwd.y/rl,y:-fwd.x/rl,z:0};
  return{fwd,right,up:{x:right.y*fwd.z-right.z*fwd.y,y:right.z*fwd.x-right.x*fwd.z,z:right.x*fwd.y-right.y*fwd.x}};
}
function proj3(wx,wy,wz,d,sw,sh){
  const{fwd,right,up}=getVecs(d.heading,d.gimbal);
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const v={x:wx-d.x,y:wy-d.y,z:wz-d.alt};
  const cz=dot(v,fwd);if(cz<0.5)return null;
  const f=(sw/2)/Math.tan((FOV_DEG*Math.PI)/360);
  return{x:dot(v,right)/cz*f+sw/2,y:-dot(v,up)/cz*f+sh/2,z:cz,s:f/cz};
}

// ── UTILS ─────────────────────────────────────────────────
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const rgb=(r,g,b)=>`rgb(${clamp(Math.round(r),0,255)},${clamp(Math.round(g),0,255)},${clamp(Math.round(b),0,255)})`;

function fogRgb(r,g,b,depth,night){
  const t=Math.pow(Math.min(1,depth/(night?160:350)),1.4);
  return rgb(r*(1-t)+(night?4:14)*t,g*(1-t)+(night?8:22)*t,b*(1-t)+(night?24:52)*t);
}
function poly(ctx,pts,color,alpha){
  if(pts.length<3||pts.some(p=>!p))return;
  ctx.globalAlpha=alpha??1;ctx.fillStyle=color;
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);
  ctx.closePath();ctx.fill();ctx.globalAlpha=1;
}

// ── RENDERIZAÇÃO DO MAPA GCS (top-down satélite) ──────────
function renderGCSMap(ctx, drone, waypoints, trails, activeSpot, frame, zoom, panX, panY, night) {
  const W = ctx.canvas.width, H = ctx.canvas.height;

  const toS = (wx, wy) => ({
    x: (wx - WORLD.w/2 + panX) * zoom + W/2,
    y: (wy - WORLD.h/2 + panY) * zoom + H/2,
  });
  const sz = s => s * zoom;

  // Background — solo / asfalto geral
  ctx.fillStyle = night ? '#0a0f08' : '#141c0f';
  ctx.fillRect(0, 0, W, H);

  // Grid de referência
  ctx.strokeStyle = night ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 0.5;
  const gridStep = 100;
  for (let gx = 0; gx <= WORLD.w; gx += gridStep) {
    const s1 = toS(gx, 0), s2 = toS(gx, WORLD.h);
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
  }
  for (let gy = 0; gy <= WORLD.h; gy += gridStep) {
    const s1 = toS(0, gy), s2 = toS(WORLD.w, gy);
    ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
  }

  // Parques com textura de árvores
  WORLD.parks.forEach(p => {
    const s = toS(p.x, p.y);
    ctx.fillStyle = night ? '#0d2208' : '#162e0c';
    ctx.fillRect(s.x, s.y, sz(p.w), sz(p.h));
    // Árvores (círculos determinísticos)
    const treeStep = Math.max(12, sz(20));
    for (let tx = p.x+10; tx < p.x+p.w-10; tx += 18) {
      for (let ty = p.y+10; ty < p.y+p.h-10; ty += 18) {
        const seed = (tx*7+ty*13)%5;
        const ts = toS(tx + seed*1.8 - 4, ty + seed*1.2 - 2);
        const tr = Math.max(2, sz(5+seed*1.5));
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = night ? '#0a1c06' : '#112508';
        ctx.beginPath(); ctx.arc(ts.x, ts.y, tr, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = night ? '#142e0a' : '#1a3c0e';
        ctx.beginPath(); ctx.arc(ts.x - tr*0.25, ts.y - tr*0.25, tr*0.7, 0, Math.PI*2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  });

  // Ruas
  WORLD.roads.forEach(r => {
    const s = toS(r.x, r.y);
    const rw = sz(r.w), rh = sz(r.h);
    ctx.fillStyle = night ? '#1a2014' : '#242c18';
    ctx.fillRect(s.x, s.y, rw, rh);
    // Faixas centrais
    ctx.setLineDash([sz(8), sz(6)]);
    ctx.strokeStyle = night ? 'rgba(255,255,200,0.08)' : 'rgba(255,255,200,0.12)';
    ctx.lineWidth = Math.max(0.5, sz(1));
    if (r.w > r.h) {
      ctx.beginPath(); ctx.moveTo(s.x, s.y+rh/2); ctx.lineTo(s.x+rw, s.y+rh/2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(s.x+rw/2, s.y); ctx.lineTo(s.x+rw/2, s.y+rh); ctx.stroke();
    }
    ctx.setLineDash([]);
    // Calçada
    ctx.strokeStyle = night ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x, s.y, rw, rh);
  });

  // Prédios (visão de cima)
  WORLD.bldgs.forEach(b => {
    const s = toS(b.x, b.y);
    const bw = sz(b.w), bd = sz(b.d);
    // Sombra (offset sudeste)
    const shOff = Math.min(sz(b.h/6), 8);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(s.x + shOff, s.y + shOff, bw, bd);
    // Telhado (mais claro para prédios mais altos)
    const br = 28 + Math.round(b.h/4);
    ctx.fillStyle = night ? rgb(br-8, br-6, br-10) : rgb(br+4, br+4, br);
    ctx.fillRect(s.x, s.y, bw, bd);
    // Borda do telhado
    ctx.strokeStyle = night ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(s.x, s.y, bw, bd);
    // Detalhe de telhado (AC, caixas d'água) em prédios grandes
    if (sz(b.w) > 20 && sz(b.d) > 15 && b.h > 20) {
      ctx.fillStyle = night ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(s.x + bw*0.2, s.y + bd*0.2, bw*0.25, bd*0.25);
      ctx.fillRect(s.x + bw*0.55, s.y + bd*0.5, bw*0.2, bd*0.2);
    }
  });

  // Zona da base (helipad)
  const bs = toS(WORLD.base.x, WORLD.base.y);
  const bsr = Math.max(14, sz(22));
  ctx.fillStyle = night ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.12)';
  ctx.beginPath(); ctx.arc(bs.x, bs.y, bsr, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#f97316'; ctx.lineWidth = Math.max(1.5, sz(1.5));
  ctx.beginPath(); ctx.arc(bs.x, bs.y, bsr, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(bs.x, bs.y, bsr*0.55, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = '#f97316'; ctx.font = `bold ${Math.max(10,sz(14))}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('H', bs.x, bs.y);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

  // Pontos de entrega
  WORLD.spots.forEach(spot => {
    const ss = toS(spot.x, spot.y);
    const sr = Math.max(6, sz(spot.r));
    const isAct = activeSpot?.id === spot.id;
    const priColor = spot.priority === 'vip' ? '#a855f7' : spot.priority === 'express' ? '#ef4444' : '#fbbf24';
    const pulse = Math.abs(Math.sin(frame*0.07));

    ctx.strokeStyle = isAct ? priColor : priColor+'66';
    ctx.lineWidth = isAct ? Math.max(2, sz(2)) : 1;
    ctx.globalAlpha = isAct ? (0.7 + pulse*0.25) : 0.5;
    ctx.beginPath(); ctx.arc(ss.x, ss.y, sr*(isAct?1+pulse*0.06:1), 0, Math.PI*2); ctx.stroke();
    if (isAct) {
      ctx.fillStyle = priColor + '18';
      ctx.fill();
      // Cruz central
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = priColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(ss.x-sr*0.5,ss.y); ctx.lineTo(ss.x+sr*0.5,ss.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ss.x,ss.y-sr*0.5); ctx.lineTo(ss.x,ss.y+sr*0.5); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Label
    ctx.fillStyle = isAct ? priColor : priColor + 'aa';
    ctx.font = `bold ${Math.max(8, sz(10))}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(spot.id, ss.x, ss.y - sr - 3);
    ctx.textAlign = 'left';
  });

  // Rota planejada (linha tracejada entre waypoints)
  if (waypoints.length > 1) {
    ctx.setLineDash([sz(6), sz(4)]);
    ctx.strokeStyle = 'rgba(96,165,250,0.6)';
    ctx.lineWidth = Math.max(1, sz(1.5));
    const wps = [{ x: WORLD.base.x, y: WORLD.base.y }, ...waypoints, { x: WORLD.base.x, y: WORLD.base.y }];
    ctx.beginPath();
    wps.forEach((wp, i) => {
      const s = toS(wp.x, wp.y);
      i === 0 ? ctx.moveTo(s.x, s.y) : ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Waypoint markers
    waypoints.forEach((wp, i) => {
      const s = toS(wp.x, wp.y);
      const sz2 = Math.max(8, sz(10));
      ctx.fillStyle = '#1e40af';
      ctx.beginPath(); ctx.arc(s.x, s.y, sz2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.max(7, sz(8))}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(i+1, s.x, s.y);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    });
  }

  // Trail do voo
  for (let i = 1; i < trails.length; i++) {
    const p1 = toS(trails[i-1].x, trails[i-1].y);
    const p2 = toS(trails[i].x, trails[i].y);
    ctx.globalAlpha = (i / trails.length) * 0.7;
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = Math.max(1, sz(1.2));
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Drone (visão de cima, ícone DJI-style)
  const ds = toS(drone.x, drone.y);
  const drSize = Math.max(12, sz(18));
  ctx.save();
  ctx.translate(ds.x, ds.y);
  ctx.rotate(drone.heading);
  // Corpo
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -drSize*0.5); ctx.lineTo(drSize*0.15, 0); ctx.lineTo(0, drSize*0.2);
  ctx.lineTo(-drSize*0.15, 0); ctx.closePath(); ctx.fill();
  // 4 braços
  const arms = [[.6,-.6],[.6,.6],[-.6,.6],[-.6,-.6]];
  arms.forEach(([ax,ay]) => {
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.moveTo(0,0); ctx.lineTo(ax*drSize*0.5, ay*drSize*0.5);
    ctx.lineWidth = Math.max(1.5, sz(2));
    ctx.strokeStyle = '#94a3b8';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ax*drSize*0.55, ay*drSize*0.55, Math.max(3, sz(4)), 0, Math.PI*2);
    ctx.fillStyle = '#64748b';
    ctx.fill();
  });
  // Círculo de heading
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2,2]);
  ctx.beginPath(); ctx.arc(0, 0, drSize*0.85, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Halo do drone
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath(); ctx.arc(ds.x, ds.y, Math.max(16, sz(25)), 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;

  // Velocidade / altitude no mapa
  if (sz(1) > 0.7) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(ds.x+drSize+4, ds.y-10, 80, 22, 4); ctx.fill();
    ctx.fillStyle = '#e2e8f0'; ctx.font = `bold 9px monospace`;
    ctx.fillText(`${Math.round(drone.alt)}m AGL`, ds.x+drSize+8, ds.y+4);
  }

  // Rosa dos ventos (canto inferior esquerdo)
  const cx2 = 44, cy2 = H - 44, cr = 28;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath(); ctx.arc(cx2, cy2, cr+6, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx2, cy2, cr+6, 0, Math.PI*2); ctx.stroke();
  // N indicator
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.moveTo(cx2, cy2-cr); ctx.lineTo(cx2+6, cy2-4); ctx.lineTo(cx2-6, cy2-4); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(cx2, cy2+cr); ctx.lineTo(cx2+6, cy2+4); ctx.lineTo(cx2-6, cy2+4); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f8fafc'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center';
  ctx.fillText('N', cx2, cy2-cr-4);
  ctx.fillText('S', cx2, cy2+cr+10);
  ctx.fillText('E', cx2+cr+6, cy2+3);
  ctx.fillText('O', cx2-cr-6, cy2+3);
  ctx.restore();

  // Barra de escala
  const scaleW = sz(100);
  const sx2 = W - scaleW - 16, sy2 = H - 16;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(sx2, sy2); ctx.lineTo(sx2+scaleW, sy2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx2, sy2-4); ctx.lineTo(sx2, sy2+4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx2+scaleW, sy2-4); ctx.lineTo(sx2+scaleW, sy2+4); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
  ctx.fillText('100 m', sx2 + scaleW/2, sy2-5);
  ctx.textAlign = 'left';
}

// ── RENDERIZAÇÃO CÂMERA 3D (feed menor) ───────────────────
function renderCamera(ctx, drone, frame, night) {
  const W = ctx.canvas.width, H = ctx.canvas.height;

  // Céu
  const sg = ctx.createLinearGradient(0,0,0,H*0.5);
  sg.addColorStop(0, night?'#000508':'#0d1f3c');
  sg.addColorStop(1, night?'#040e1c':'#1a3a5c');
  ctx.fillStyle = sg; ctx.fillRect(0,0,W,H*0.5);
  // Estrelas
  if (night) {
    for (let i=0;i<80;i++){
      ctx.globalAlpha=(Math.sin(frame*0.05+i)+1)*0.4;
      ctx.fillStyle='#fff';
      ctx.fillRect((i*137%W),Math.round(i*97%H*0.45),1,1);
    }
    ctx.globalAlpha=1;
  }
  // Chão
  ctx.fillStyle = night?'#040a06':'#0c1610';
  ctx.fillRect(0,H*0.5,W,H*0.5);

  // Ruas projetadas
  WORLD.roads.forEach(r=>{
    const cs=[
      proj3(r.x,r.y,0,drone,W,H), proj3(r.x+r.w,r.y,0,drone,W,H),
      proj3(r.x+r.w,r.y+r.h,0,drone,W,H), proj3(r.x,r.y+r.h,0,drone,W,H),
    ];
    const d=cs.filter(Boolean).reduce((a,p)=>a+p.z,0)/(cs.filter(Boolean).length||1);
    poly(ctx,cs,fogRgb(18,26,20,d,night));
  });

  // Parques
  WORLD.parks.forEach(p=>{
    const cs=[
      proj3(p.x,p.y,0,drone,W,H), proj3(p.x+p.w,p.y,0,drone,W,H),
      proj3(p.x+p.w,p.y+p.h,0,drone,W,H), proj3(p.x,p.y+p.h,0,drone,W,H),
    ];
    const d=cs.filter(Boolean).reduce((a,p)=>a+p.z,0)/(cs.filter(Boolean).length||1);
    poly(ctx,cs,fogRgb(12,44,18,d,night));
  });

  // Prédios
  [...WORLD.bldgs].sort((a,b)=>
    Math.hypot(b.x+b.w/2-drone.x,b.y+b.d/2-drone.y)-Math.hypot(a.x+a.w/2-drone.x,a.y+a.d/2-drone.y)
  ).forEach(b=>{
    const dist=Math.hypot(b.x+b.w/2-drone.x,b.y+b.d/2-drone.y);
    const br=32,bg=48,bb=78;
    const cs=[
      [b.x,b.y,0],[b.x+b.w,b.y,0],[b.x+b.w,b.y+b.d,0],[b.x,b.y+b.d,0],
      [b.x,b.y,b.h],[b.x+b.w,b.y,b.h],[b.x+b.w,b.y+b.d,b.h],[b.x,b.y+b.d,b.h],
    ].map(([x,y,z])=>proj3(x,y,z,drone,W,H));
    const[p0,p1,p2,p3,p4,p5,p6,p7]=cs;
    poly(ctx,[p4,p5,p6,p7],fogRgb(br+22,bg+28,bb+34,dist,night));
    if(drone.y<=b.y+b.d/2)poly(ctx,[p0,p1,p5,p4],fogRgb(br+8,bg+12,bb+18,dist,night));
    if(drone.y>=b.y+b.d/2)poly(ctx,[p3,p2,p6,p7],fogRgb(br-4,bg-2,bb+4,dist,night));
    if(drone.x>=b.x+b.w/2)poly(ctx,[p1,p2,p6,p5],fogRgb(br+4,bg+8,bb+14,dist,night));
    if(drone.x<=b.x+b.w/2)poly(ctx,[p0,p3,p7,p4],fogRgb(br-6,bg-4,bb+2,dist,night));
    // Janelas noturnas
    if(night&&p4&&p5&&p6&&p7&&p0&&p1){
      const rows=Math.max(1,Math.floor(b.h/9)),cols=Math.max(1,Math.floor(b.w/12));
      for(let ri=0;ri<Math.min(rows,4);ri++)for(let ci=0;ci<Math.min(cols,5);ci++){
        const seed=(b.x+b.y+ri*13+ci*7)%10;if(seed>5)continue;
        const tr=(ri+0.5)/Math.min(rows,4),tc=(ci+0.5)/Math.min(cols,5);
        if(!p0||!p1||!p5||!p4)continue;
        const wx=p0.x*(1-tc)*(1-tr)+p1.x*tc*(1-tr)+p5.x*tc*tr+p4.x*(1-tc)*tr;
        const wy=p0.y*(1-tc)*(1-tr)+p1.y*tc*(1-tr)+p5.y*tc*tr+p4.y*(1-tc)*tr;
        const ws=Math.max(1.5,p0.s*5);
        ctx.globalAlpha=0.6+seed*0.04;ctx.fillStyle='rgba(255,218,100,1)';
        ctx.fillRect(wx-ws/2,wy-ws*0.35,ws,ws*0.6);
      }
      ctx.globalAlpha=1;
    }
  });

  // Vignette
  const vig=ctx.createRadialGradient(W/2,H/2,H*0.2,W/2,H/2,H*0.7);
  vig.addColorStop(0,'rgba(0,0,0,0)');vig.addColorStop(1,'rgba(0,0,0,0.6)');
  ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);

  // Crosshair
  ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=1;
  const cx=W/2,cy=H/2;
  [[cx-18,cy,cx-6,cy],[cx+6,cy,cx+18,cy],[cx,cy-18,cx,cy-6],[cx,cy+6,cx,cy+18]].forEach(([x1,y1,x2,y2])=>{
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  });

  // REC
  if(frame%60<40){ctx.fillStyle='#ef4444';ctx.beginPath();ctx.arc(8,8,4,0,Math.PI*2);ctx.fill();}
  ctx.fillStyle='rgba(255,255,255,0.5)';ctx.font='7px monospace';
  ctx.fillText(new Date().toTimeString().slice(0,8),W-54,10);
  // Gimbal
  ctx.textAlign='right';
  ctx.fillText(`G:${Math.round(drone.gimbal*180/Math.PI)}°`,W-2,H-4);
  ctx.textAlign='left';

  // Grain noturno leve
  if(night){
    ctx.globalAlpha=0.03;
    for(let i=0;i<300;i++){
      ctx.fillStyle=Math.random()>.5?'#fff':'#000';
      ctx.fillRect((i*997+frame*13)%W,(i*1009+frame*17)%H,1,1);
    }
    ctx.globalAlpha=1;
  }
}

// ── INIT ──────────────────────────────────────────────────
function initFlight(spots, night, wind) {
  const base = WORLD.base;
  return {
    drone:{ x:base.x, y:base.y, alt:0, vx:0, vy:0, vz:0, heading:0, gimbal:-1.1 },
    battery: 100, signal: 98,
    wind:{ angle:Math.random()*Math.PI*2, speed:wind },
    windT: 0, queue:[...spots], spot:null,
    winch:0, winching:false,
    delivered:0, score:0,
    frame:0, t0:Date.now(),
    trails:[], log:['[00:00] GCS conectado. Aguardando decolagem.'],
    over:false, rth:false, night,
    flightTime:0,
    distTotal:0, lastPos:{ x:base.x, y:base.y },
    maxAlt:0,
  };
}

// ── COMPONENTE PRINCIPAL ─────────────────────────────────
export default function Drone() {
  const mapRef  = useRef(null);
  const camRef  = useRef(null);
  const wrapRef = useRef(null);
  const flightRef = useRef(null);
  const rafRef    = useRef(null);
  const keysRef   = useRef({});

  // Map interaction
  const [zoom,   setZoom]  = useState(1.0);
  const [pan,    setPan]   = useState({ x:0, y:0 });
  const panRef   = useRef({ x:0, y:0 });
  const zoomRef  = useRef(1.0);
  const dragging = useRef(null);

  const [screen,    setScreen]   = useState('planning');  // planning | flight | results
  const [selSpots,  setSelSpots] = useState([]);
  const [night,     setNight]    = useState(false);
  const [windSpeed, setWindSpeed]= useState(1.2);
  const [tel,       setTel]      = useState(null);
  const [logLines,  setLog]      = useState(['[00:00] GCS pronto. Configure a missão e inicie o voo.']);
  const [results,   setResults]  = useState(null);
  const [activeSpot,setActiveSpot]=useState(null);
  const [frame,     setFrame]    = useState(0);
  const [showCam,   setShowCam]  = useState(true);

  // ── Teclado ────────────────────────────────────────────
  const onKD = useCallback(e => {
    const g=['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyF','KeyR','BracketLeft','BracketRight'];
    if(g.includes(e.code))e.preventDefault();
    keysRef.current[e.code]=true;
  },[]);
  const onKU = useCallback(e=>{ delete keysRef.current[e.code]; },[]);

  useEffect(()=>{
    if(screen==='flight')setTimeout(()=>wrapRef.current?.focus(),80);
  },[screen]);

  // ── Scroll zoom no mapa ────────────────────────────────
  const onWheel = useCallback(e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.85 : 1.18;
    zoomRef.current = clamp(zoomRef.current * delta, 0.35, 3.5);
    setZoom(zoomRef.current);
  },[]);

  // ── Arrastar mapa ─────────────────────────────────────
  const onMapMouseDown = e => {
    if (e.button === 0) dragging.current = { sx: e.clientX, sy: e.clientY, px: panRef.current.x, py: panRef.current.y };
  };
  const onMapMouseMove = e => {
    if (!dragging.current) return;
    const dx = (e.clientX - dragging.current.sx) / zoomRef.current;
    const dy = (e.clientY - dragging.current.sy) / zoomRef.current;
    panRef.current = { x: dragging.current.px + dx, y: dragging.current.py + dy };
    setPan({ ...panRef.current });
  };
  const onMapMouseUp = () => { dragging.current = null; };

  // ── Render loop de planejamento (sem voo) ─────────────
  const planRafRef = useRef(null);
  const planFrame  = useRef(0);
  useEffect(()=>{
    if(screen!=='planning')return;
    const c=mapRef.current;if(!c)return;
    const ctx=c.getContext('2d');
    const f=()=>{
      planRafRef.current=requestAnimationFrame(f);
      planFrame.current++;
      const fakeDrone={x:WORLD.base.x,y:WORLD.base.y,alt:0,heading:0,gimbal:-1.1};
      renderGCSMap(ctx,fakeDrone,selSpots,[], null, planFrame.current, zoomRef.current, panRef.current.x, panRef.current.y, night);
    };
    f();
    return ()=>cancelAnimationFrame(planRafRef.current);
  },[screen, selSpots, night]);

  // ── Game loop ────────────────────────────────────────
  useEffect(()=>{
    if(screen!=='flight')return;
    const mc=mapRef.current,cc=camRef.current;
    if(!mc||!cc)return;
    const mctx=mc.getContext('2d');
    const cctx=cc.getContext('2d');

    function addLog(g,msg){
      const ms=Date.now()-g.t0;
      const ts=`${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}`;
      g.log.unshift(`[${ts}] ${msg}`);
      if(g.log.length>15)g.log.pop();
    }
    function endFlight(g,reason){
      if(g.over)return;
      g.over=true;cancelAnimationFrame(rafRef.current);
      const t=Math.floor((Date.now()-g.t0)/1000);
      setResults({reason,delivered:g.delivered,total:g.queue.length+g.delivered+(g.spot?1:0),
        battery:Math.round(g.battery),time:t,distTotal:Math.round(g.distTotal),maxAlt:Math.round(g.maxAlt),
        log:[...g.log]});
      setScreen('results');
    }

    function loop(){
      rafRef.current=requestAnimationFrame(loop);
      const g=flightRef.current;if(!g||g.over)return;
      g.frame++;
      const keys=keysRef.current;
      const d=g.drone;
      const night=g.night;

      // Flight time
      g.flightTime=Math.floor((Date.now()-g.t0)/1000);

      // Vento
      g.windT++;
      if(g.windT>200){g.windT=0;g.wind={angle:g.wind.angle+(Math.random()-.5)*1.0,speed:Math.max(0,g.wind.speed+(Math.random()-.5)*g.wind.speed*0.7)};}

      // Teclas gimbal
      if(keys['BracketLeft'])d.gimbal=Math.max(-Math.PI/2,d.gimbal-.024);
      if(keys['BracketRight'])d.gimbal=Math.min(-.1,d.gimbal+.024);

      // Yaw
      if(keys['KeyA'])d.heading-=YAW_RATE;
      if(keys['KeyD'])d.heading+=YAW_RATE;

      // RTH
      if(keys['KeyR']&&!g.rth){g.rth=true;addLog(g,'🏠 RTH ativado');}
      if((keys['KeyW']||keys['KeyS'])&&g.rth){g.rth=false;addLog(g,'✋ RTH cancelado por piloto');}

      // Próximo ponto
      if(!g.spot&&g.queue.length>0){
        g.spot=g.queue.shift();
        setActiveSpot(g.spot);
        addLog(g,`📋 Próxima entrega: ${g.spot.nome} · Alt ${g.spot.alt}m`);
      }

      // Guincho
      if(keys['KeyF']&&!g.winching&&d.alt>1&&g.spot&&!g.winching){
        const dist=Math.hypot(d.x-g.spot.x,d.y-g.spot.y);
        const altOk=Math.abs(d.alt-g.spot.alt)<=8;
        if(dist<g.spot.r+20&&altOk){g.winching=true;addLog(g,'📦 Guincho ativado');}
        else addLog(g,`⚠ Reposicione — dist:${Math.round(dist)}m alt:${Math.round(d.alt)}/${g.spot.alt}m`);
      }
      if(g.winching){
        g.winch=Math.min(1,g.winch+WINCH_SPD);
        if(g.winch>=1){
          g.winching=false;g.winch=0;g.delivered++;
          addLog(g,`✅ Entregue em ${g.spot.nome}`);
          g.spot=null;setActiveSpot(null);
          if(g.delivered>=g.delivered+(g.queue.length===0?0:g.queue.length)){
            if(g.queue.length===0){setTimeout(()=>endFlight(g,'success'),1200);return;}
          }
          if(g.queue.length===0){setTimeout(()=>endFlight(g,'success'),1200);return;}
        }
      }

      // Física
      let ax=0,ay=0;
      if(g.rth){
        const tx=WORLD.base.x-d.x,ty=WORLD.base.y-d.y,dist=Math.hypot(tx,ty);
        if(dist>8){const spd=Math.min(dist*.06,MAX_H_SPD*.5);ax=(tx/dist)*spd*.08;ay=(ty/dist)*spd*.08;if(d.alt<50)d.alt=Math.min(50,d.alt+.5);}
        else{d.alt=Math.max(0,d.alt-1.5);if(d.alt<=0){d.alt=0;d.vx=0;d.vy=0;g.rth=false;addLog(g,'✅ Pousou na base');}}
      } else {
        const cosH=Math.cos(d.heading),sinH=Math.sin(d.heading);
        let ff=0;
        if(keys['KeyW']||keys['ArrowUp'])ff=1;
        if(keys['KeyS']||keys['ArrowDown'])ff=-1;
        ax+=ff*sinH*.42;ay+=ff*cosH*.42;
        if(ff!==0&&d.alt<5)d.alt=Math.min(8,d.alt+.9);
      }

      if((keys['KeyE']||keys['Space'])&&!g.rth)d.vz=Math.min(MAX_V_SPD,d.vz+.18);
      else if(keys['KeyQ']&&!g.rth)d.vz=Math.max(-MAX_V_SPD,d.vz-.18);
      else d.vz*=.82;

      d.alt=Math.max(0,Math.min(150,d.alt+d.vz));
      if(d.alt>g.maxAlt)g.maxAlt=d.alt;

      // Vento
      const wf=.3+(d.alt/150)*.7;
      ax+=Math.cos(g.wind.angle)*g.wind.speed*.032*wf;
      ay+=Math.sin(g.wind.angle)*g.wind.speed*.032*wf;

      d.vx=(d.vx+ax)*H_DRAG;d.vy=(d.vy+ay)*H_DRAG;
      const spd=Math.sqrt(d.vx*d.vx+d.vy*d.vy);
      if(spd>MAX_H_SPD){d.vx=d.vx/spd*MAX_H_SPD;d.vy=d.vy/spd*MAX_H_SPD;}
      d.x=Math.max(20,Math.min(880,d.x+d.vx));
      d.y=Math.max(20,Math.min(680,d.y+d.vy));

      // Distância percorrida
      g.distTotal+=Math.hypot(d.x-g.lastPos.x,d.y-g.lastPos.y);
      g.lastPos={x:d.x,y:d.y};

      // Bateria
      let drain=d.alt>0?.004:0;
      if(spd>.2)drain+=.007;if(d.vz>.1)drain+=.012;
      g.battery=Math.max(0,g.battery-drain);
      if(g.battery<=0){endFlight(g,'battery');return;}

      g.signal=Math.max(12,98-Math.hypot(d.x-WORLD.base.x,d.y-WORLD.base.y)*.065);

      if(d.alt>2&&g.frame%5===0){g.trails.push({x:d.x,y:d.y});if(g.trails.length>120)g.trails.shift();}

      // Render mapa
      renderGCSMap(mctx,d,g.queue.concat(g.spot?[g.spot]:[]).map(s=>({x:s.x,y:s.y})),
        g.trails,g.spot,g.frame,zoomRef.current,panRef.current.x,panRef.current.y,night);

      // Render câmera
      renderCamera(cctx,d,g.frame,night);

      if(g.frame%3===0){
        const ms=Date.now()-g.t0;
        setTel({
          battery:g.battery,signal:g.signal,
          alt:Math.round(d.alt),spd:Math.round(spd*3.6),
          vspd:d.vz.toFixed(1),
          heading:Math.round(((d.heading*180/Math.PI)%360+360)%360),
          dist:Math.round(Math.hypot(d.x-WORLD.base.x,d.y-WORLD.base.y)),
          wind:g.wind,winching:g.winching,winch:g.winch,
          rth:g.rth,spot:g.spot,delivered:g.delivered,
          flightTime:g.flightTime,distTotal:Math.round(g.distTotal),
        });
        setLog([...g.log]);
        setFrame(g.frame);
      }
    }
    loop();
    return()=>cancelAnimationFrame(rafRef.current);
  },[screen]);

  function startFlight(){
    const ordered = selSpots.length>0
      ? WORLD.spots.filter(s=>selSpots.includes(s.id))
      : WORLD.spots.slice(0,3);
    flightRef.current=initFlight(ordered,night,windSpeed);
    setTel(null);setLog([]);setActiveSpot(null);
    setScreen('flight');
  }

  // ── RESULTADOS ───────────────────────────────────────────
  if(screen==='results'){
    const r=results;
    const mm=String(Math.floor(r.time/60)).padStart(2,'0');
    const ss=String(r.time%60).padStart(2,'0');
    return(
      <div className="min-h-screen flex items-center justify-center p-6" style={{background:'var(--space-bg)'}}>
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <div style={{fontSize:48}}>{r.reason==='success'?'✅':r.reason==='battery'?'🔋':'❌'}</div>
            <h2 className="text-xl font-black mt-2" style={{color:'var(--txt)'}}>
              {r.reason==='success'?'Missão concluída com sucesso':'Voo encerrado — '+r.reason}
            </h2>
          </div>
          <div className="rounded-2xl overflow-hidden mb-4" style={{background:'var(--space-surface)',border:'1px solid var(--hairline)'}}>
            {[
              {label:'Entregas realizadas',value:`${r.delivered} / ${r.total}`,color:r.delivered===r.total?'#22c55e':'#f59e0b'},
              {label:'Bateria restante',   value:`${r.battery}%`,              color:r.battery>30?'#22c55e':'#ef4444'},
              {label:'Tempo de voo',       value:`${mm}:${ss}`,               color:'var(--txt)'},
              {label:'Distância voada',    value:`${r.distTotal} m`,           color:'var(--txt)'},
              {label:'Altitude máxima',    value:`${r.maxAlt} m AGL`,         color:'#60a5fa'},
            ].map((row,i,a)=>(
              <div key={i} className="flex justify-between items-center px-5 py-3" style={{borderBottom:i<a.length-1?'1px solid var(--hairline)':''}}>
                <span className="text-sm" style={{color:'var(--txt-dim)'}}>{row.label}</span>
                <span className="font-black" style={{color:row.color}}>{row.value}</span>
              </div>
            ))}
          </div>
          <div className="rounded-2xl p-4 mb-4" style={{background:'var(--space-elev)',border:'1px solid var(--hairline)'}}>
            <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{color:'var(--txt-dim)'}}>Log de voo</p>
            {(r.log||[]).slice(0,8).map((l,i)=>(
              <p key={i} className="text-[9px] font-mono" style={{color:i===0?'#60a5fa':'#334155'}}>{l}</p>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={()=>{setScreen('planning');setSelSpots([]);}}
              className="flex-1 py-3 rounded-2xl font-black text-sm text-white" style={{background:'var(--accent)'}}>
              ← Planejar nova missão
            </button>
            <button onClick={startFlight}
              className="flex-1 py-3 rounded-2xl font-black text-sm" style={{background:'var(--space-elev)',color:'var(--txt)',border:'1px solid var(--hairline)'}}>
              🔄 Repetir
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── LAYOUT GCS ────────────────────────────────────────────
  const battCol  = !tel?'#22c55e':tel.battery>40?'#22c55e':tel.battery>20?'#f59e0b':'#ef4444';
  const sigCol   = !tel?'#22c55e':tel.signal>65?'#22c55e':tel.signal>35?'#f59e0b':'#ef4444';
  const windMs   = tel?.wind?.speed?.toFixed(1)??windSpeed.toFixed(1);
  const compass  = ['N','NE','L','SE','S','SO','O','NO','N'][Math.round(((tel?.heading??0)%360)/45)];
  const ftMM     = String(Math.floor((tel?.flightTime??0)/60)).padStart(2,'0');
  const ftSS     = String((tel?.flightTime??0)%60).padStart(2,'0');
  const isFlight = screen==='flight';

  return(
    <div ref={wrapRef} tabIndex={0} onKeyDown={onKD} onKeyUp={onKU}
      className="outline-none select-none flex flex-col"
      style={{background:'#080e06',minHeight:'100vh',color:'#e2e8f0',fontFamily:'monospace'}}>

      {/* ── Barra superior GCS ────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-1.5 shrink-0"
        style={{background:'rgba(0,0,0,0.92)',borderBottom:'1px solid rgba(255,255,255,0.07)',zIndex:10}}>

        {/* Logo + drone */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-base">🚁</span>
            <span className="text-xs font-black" style={{color:'#22c55e'}}>37 SUSHI GCS</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{background:'rgba(34,197,94,0.1)',color:'#22c55e',border:'1px solid rgba(34,197,94,0.2)'}}>
              {isFlight?'● VIVO':'○ SIMULAÇÃO'}
            </span>
          </div>
          {isFlight&&(
            <div className="flex items-center gap-3">
              {/* Bateria */}
              <div className="flex items-center gap-1.5">
                <div className="w-10 h-2.5 rounded-sm overflow-hidden" style={{background:'#1e293b',border:'1px solid #334155'}}>
                  <div className="h-full transition-all" style={{width:`${tel?.battery??100}%`,background:battCol}}/>
                </div>
                <span className="text-[10px] font-bold" style={{color:battCol}}>{Math.round(tel?.battery??100)}%</span>
              </div>
              {/* Sinal */}
              <div className="flex items-end gap-0.5 h-3">
                {[1,2,3,4].map(b=><div key={b} className="w-1 rounded-sm" style={{height:`${4+b*2}px`,background:(tel?.signal??98)>b*22?sigCol:'#1e293b'}}/>)}
              </div>
              {/* RTK/GPS */}
              <span className="text-[9px]" style={{color:'#475569'}}>GPS {Math.round((tel?.signal??98)/10)} sat</span>
            </div>
          )}
        </div>

        {/* Centro: status missão */}
        <div className="text-center">
          {isFlight&&tel?.rth&&(
            <span className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse" style={{background:'rgba(239,68,68,0.2)',color:'#f87171',border:'1px solid rgba(239,68,68,0.3)'}}>🏠 RTH ATIVO</span>
          )}
          {isFlight&&!tel?.rth&&(
            <span className="text-[10px]" style={{color:'#475569'}}>
              {tel?.spot?`📍 ${tel.spot.nome}`:tel?.delivered>0?`✅ ${tel.delivered} entregas concluídas`:'⏸ Aguardando pedido'}
            </span>
          )}
          {!isFlight&&<span className="text-[10px] font-bold" style={{color:'#475569'}}>PLANEJAMENTO DE MISSÃO</span>}
        </div>

        {/* Direita: tempo + controles */}
        <div className="flex items-center gap-4">
          {isFlight&&(
            <div className="flex items-center gap-3">
              <div className="text-center">
                <div className="text-[8px]" style={{color:'#334155'}}>VOO</div>
                <div className="text-xs font-black" style={{color:'#94a3b8'}}>{ftMM}:{ftSS}</div>
              </div>
              <div className="text-center">
                <div className="text-[8px]" style={{color:'#334155'}}>VENTO</div>
                <div className="text-xs font-black" style={{color:parseFloat(windMs)>3?'#f59e0b':'#22c55e'}}>{windMs}m/s</div>
              </div>
            </div>
          )}
          {!isFlight&&(
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={night} onChange={e=>setNight(e.target.checked)} className="w-3 h-3"/>
                <span className="text-[10px]" style={{color:'#475569'}}>🌙 Noite</span>
              </label>
              <select value={windSpeed} onChange={e=>setWindSpeed(parseFloat(e.target.value))}
                className="text-[10px] rounded px-1 py-0.5" style={{background:'#1e293b',color:'#94a3b8',border:'1px solid #334155'}}>
                <option value="0">Sem vento</option>
                <option value="1.2">Leve 1.2 m/s</option>
                <option value="2.5">Moderado 2.5 m/s</option>
                <option value="4.5">Forte 4.5 m/s</option>
              </select>
            </div>
          )}
          {isFlight?(
            <button onClick={()=>{cancelAnimationFrame(rafRef.current);setScreen('planning');}}
              className="text-[10px] px-2 py-0.5 rounded" style={{color:'#475569',border:'1px solid #1e293b'}}>ENCERRAR</button>
          ):(
            <button onClick={startFlight}
              className="px-4 py-1.5 rounded-xl text-xs font-black text-white transition-all active:scale-95"
              style={{background:'#16a34a',boxShadow:'0 0 12px rgba(22,163,74,0.4)'}}>
              ▶ INICIAR VÔO
            </button>
          )}
        </div>
      </div>

      {/* ── Corpo principal ───────────────────────────────── */}
      <div className="flex flex-1" style={{minHeight:0}}>

        {/* Painel esquerdo */}
        <div className="shrink-0 flex flex-col" style={{width:220,background:'rgba(0,0,0,0.7)',borderRight:'1px solid rgba(255,255,255,0.06)'}}>

          {/* Câmera feed */}
          <div className="shrink-0" style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
            <div className="flex items-center justify-between px-3 py-1" style={{background:'rgba(0,0,0,0.5)'}}>
              <span className="text-[9px] font-bold" style={{color:'#475569'}}>CÂMERA DRONE</span>
              <div className="flex gap-1">
                {['WIDE','ZOOM','IR'].map(m=>(
                  <button key={m} className="text-[7px] px-1 rounded" style={{background:m==='WIDE'?'#1e40af':'#1e293b',color:m==='WIDE'?'#93c5fd':'#475569'}}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <canvas ref={camRef} width={320} height={180}
              style={{width:'100%',aspectRatio:'16/9',display:'block',background:'#040806'}}/>
            {/* Dados ISO/câmera estilo DJI */}
            <div className="flex items-center justify-between px-2 py-1" style={{background:'rgba(0,0,0,0.6)'}}>
              <span className="text-[8px] font-mono" style={{color:'#334155'}}>ISO200 1/800 EV0</span>
              <span className="text-[8px] font-mono" style={{color:'#334155'}}>AFC AUTO</span>
            </div>
          </div>

          {/* Log de voo */}
          <div className="flex-1 overflow-hidden">
            <div className="px-3 py-1.5" style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
              <span className="text-[9px] font-black uppercase tracking-wider" style={{color:'#475569'}}>Log de Voo</span>
            </div>
            <div className="px-2 py-2 overflow-y-auto h-full">
              {logLines.map((l,i)=>(
                <p key={i} className="text-[8px] font-mono leading-relaxed"
                  style={{color:i===0?'#60a5fa':i<3?'#334155':'#1e293b'}}>{l}</p>
              ))}
            </div>
          </div>

          {/* Pontos de entrega (planejamento) */}
          {!isFlight&&(
            <div style={{borderTop:'1px solid rgba(255,255,255,0.06)'}}>
              <div className="px-3 py-1.5" style={{borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                <span className="text-[9px] font-black uppercase tracking-wider" style={{color:'#475569'}}>Pontos de Entrega</span>
              </div>
              <div className="overflow-y-auto" style={{maxHeight:200}}>
                {WORLD.spots.map(s=>{
                  const sel=selSpots.includes(s.id);
                  const pc=s.priority==='vip'?'#a855f7':s.priority==='express'?'#ef4444':'#fbbf24';
                  return(
                    <button key={s.id} onClick={()=>setSelSpots(p=>sel?p.filter(x=>x!==s.id):[...p,s.id])}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all"
                      style={{background:sel?'rgba(30,64,175,0.15)':'transparent',borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{background:sel?'#1e40af':'#1e293b',border:`1px solid ${sel?'#3b82f6':'#334155'}`}}/>
                      <span className="w-1 h-5 rounded-full flex-shrink-0" style={{background:pc}}/>
                      <div>
                        <p className="text-[9px] font-bold" style={{color:'#94a3b8'}}>{s.id} · {s.nome}</p>
                        <p className="text-[8px]" style={{color:'#334155'}}>Alt {s.alt}m · {s.priority}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="p-2">
                <p className="text-[8px] text-center" style={{color:'#334155'}}>
                  {selSpots.length===0?'Nenhum selecionado = automático':`${selSpots.length} ponto(s) selecionado(s)`}
                </p>
              </div>
            </div>
          )}

          {/* Telemetria lateral (voo) */}
          {isFlight&&(
            <div style={{borderTop:'1px solid rgba(255,255,255,0.06)'}}>
              {[
                {label:'ALT AGL',val:`${tel?.alt??0} m`,    color:'#60a5fa'},
                {label:'VEL H',  val:`${tel?.spd??0} km/h`, color:'#94a3b8'},
                {label:'VEL V',  val:`${parseFloat(tel?.vspd??0)>0?'+':''}${tel?.vspd??'0.0'} m/s`, color:parseFloat(tel?.vspd??0)>0?'#22c55e':'#f87171'},
                {label:'DIST',   val:`${tel?.dist??0} m`,   color:'#94a3b8'},
                {label:'RUMO',   val:`${compass} ${tel?.heading??0}°`, color:'#94a3b8'},
              ].map(({label,val,color})=>(
                <div key={label} className="flex items-center justify-between px-3 py-1"
                  style={{borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
                  <span className="text-[9px]" style={{color:'#475569'}}>{label}</span>
                  <span className="text-xs font-black" style={{color}}>{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mapa principal */}
        <div className="flex-1 relative overflow-hidden" style={{cursor:dragging.current?'grabbing':'grab'}}
          onMouseDown={onMapMouseDown} onMouseMove={onMapMouseMove} onMouseUp={onMapMouseUp}
          onMouseLeave={onMapMouseUp} onWheel={onWheel}>
          <canvas ref={mapRef} width={1200} height={800}
            style={{width:'100%',height:'100%',display:'block'}}/>

          {/* Controles de zoom */}
          <div className="absolute top-3 right-3 flex flex-col gap-1">
            {[['＋',1.2],['－',0.85]].map(([l,f])=>(
              <button key={l} onClick={()=>{zoomRef.current=clamp(zoomRef.current*f,0.35,3.5);setZoom(zoomRef.current);}}
                className="w-7 h-7 rounded font-bold text-base flex items-center justify-center"
                style={{background:'rgba(0,0,0,0.7)',color:'#94a3b8',border:'1px solid rgba(255,255,255,0.1)'}}>{l}</button>
            ))}
            <button onClick={()=>{panRef.current={x:0,y:0};setPan({x:0,y:0});zoomRef.current=1;setZoom(1);}}
              className="w-7 h-7 rounded text-[8px] flex items-center justify-center mt-1"
              style={{background:'rgba(0,0,0,0.7)',color:'#475569',border:'1px solid rgba(255,255,255,0.07)'}}>⌂</button>
          </div>

          {/* Planejamento - hint */}
          {!isFlight&&(
            <div className="absolute top-3 left-3 pointer-events-none">
              <div className="px-3 py-1.5 rounded-xl" style={{background:'rgba(0,0,0,0.75)',border:'1px solid rgba(255,255,255,0.08)'}}>
                <p className="text-[9px]" style={{color:'#475569'}}>Scroll = zoom · Arrastar = pan · Selecione pontos no painel esquerdo</p>
              </div>
            </div>
          )}

          {/* Winch overlay */}
          {tel?.winching&&(
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="px-5 py-3 rounded-2xl text-center" style={{background:'rgba(0,0,0,0.85)',border:'1px solid rgba(251,191,36,0.5)'}}>
                <p className="text-xs font-black" style={{color:'#fbbf24'}}>📦 GUINCHO ATIVO</p>
                <div className="mt-2 h-2 w-40 rounded-full" style={{background:'#1e293b'}}>
                  <div className="h-full rounded-full" style={{width:`${(tel.winch??0)*100}%`,background:'linear-gradient(90deg,#fbbf24,#f97316)'}}/>
                </div>
                <p className="text-[9px] mt-1 font-mono" style={{color:'#94a3b8'}}>{Math.round((tel.winch??0)*100)}%</p>
              </div>
            </div>
          )}
        </div>

        {/* Painel direito */}
        <div className="shrink-0 flex flex-col" style={{width:160,background:'rgba(0,0,0,0.7)',borderLeft:'1px solid rgba(255,255,255,0.06)'}}>
          {/* Controles de voo */}
          <div className="p-2 space-y-1.5" style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
            <p className="text-[8px] font-black uppercase tracking-wider mb-2" style={{color:'#475569'}}>Controles</p>
            {[
              {label:'RTH', sub:'R', col:'#f87171', bg:'rgba(239,68,68,0.1)', active:tel?.rth,
               action:()=>{const g=flightRef.current;if(g){g.rth=!g.rth;}}},
              {label:'Guincho', sub:'F', col:'#fbbf24', bg:'rgba(251,191,36,0.1)', active:false,
               action:()=>{const g=flightRef.current;if(!g||!g.spot)return;const d=g.drone;const dist=Math.hypot(d.x-g.spot.x,d.y-g.spot.y);if(dist<g.spot.r+20&&Math.abs(d.alt-g.spot.alt)<=8)g.winching=true;}},
            ].map(btn=>(
              <button key={btn.label} onMouseDown={btn.action} disabled={!isFlight}
                className="w-full py-2 rounded-xl text-xs font-black text-left px-3 transition-all active:scale-95"
                style={{background:btn.active?btn.col.replace(')',',0.25)').replace('rgb','rgba'):btn.bg, color:btn.col,
                  border:`1px solid ${btn.col}44`, opacity:isFlight?1:0.3}}>
                {btn.label}
                <span className="float-right text-[8px] opacity-50">[{btn.sub}]</span>
              </button>
            ))}
          </div>

          {/* Atalhos de teclado */}
          <div className="p-2 flex-1">
            <p className="text-[8px] font-black uppercase tracking-wider mb-2" style={{color:'#475569'}}>Controles</p>
            {[['W/S','Frente/Trás'],['A/D','Yaw'],['E/Space','Subir'],['Q','Descer'],['[/]','Gimbal'],['R','RTH'],['F','Guincho']].map(([k,v])=>(
              <div key={k} className="flex items-center justify-between py-0.5">
                <kbd className="text-[8px] px-1 rounded" style={{background:'#1e293b',color:'#64748b',border:'1px solid #334155'}}>{k}</kbd>
                <span className="text-[8px]" style={{color:'#334155'}}>{v}</span>
              </div>
            ))}
          </div>

          {/* Ponto ativo info */}
          {isFlight&&tel?.spot&&(
            <div className="p-2" style={{borderTop:'1px solid rgba(255,255,255,0.06)'}}>
              <p className="text-[8px] font-black uppercase mb-1" style={{color:'#475569'}}>Destino Atual</p>
              <p className="text-[9px] font-bold" style={{color:'#fbbf24'}}>{tel.spot.nome}</p>
              <p className="text-[8px]" style={{color:'#475569'}}>Alt alvo: {tel.spot.alt}m</p>
              <p className="text-[8px]" style={{color:'#475569'}}>Alt atual: {tel?.alt??0}m</p>
              <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{background:'#1e293b'}}>
                <div className="h-full rounded-full" style={{
                  width:`${Math.min(100,Math.max(0,100-Math.abs((tel?.alt??0)-tel.spot.alt)*5))}%`,
                  background:Math.abs((tel?.alt??0)-tel.spot.alt)<8?'#22c55e':'#f59e0b'
                }}/>
              </div>
              <p className="text-[7px] mt-0.5" style={{color:Math.abs((tel?.alt??0)-tel.spot.alt)<8?'#22c55e':'#f59e0b'}}>
                {Math.abs((tel?.alt??0)-tel.spot.alt)<8?'✓ Em posição':'Ajustar altitude'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
