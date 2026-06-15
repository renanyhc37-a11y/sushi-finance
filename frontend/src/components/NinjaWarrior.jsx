import { useState, useEffect, useRef, useCallback } from 'react';

// ── Constantes ────────────────────────────────────────────────
const W = 340, H = 380;
const PLAYER_X = 48;

const ENEMY_TYPES = {
  ninja:   { emoji:'🥷', hp:2,  spd:1.2, pts:10,  sz:28, color:'#94a3b8' },
  samurai: { emoji:'⚔️', hp:5,  spd:0.8, pts:25,  sz:32, color:'#f97316' },
  archer:  { emoji:'🏹', hp:3,  spd:1.0, pts:20,  sz:28, color:'#10b981', ranged:true },
  oni:     { emoji:'👹', hp:8,  spd:0.6, pts:40,  sz:36, color:'#a78bfa' },
  boss:    { emoji:'💀', hp:40, spd:0.5, pts:200, sz:44, color:'#ef4444', isBoss:true },
};

const WAVES = [
  // fase 1
  [['ninja',4],['ninja',6]],
  // fase 2
  [['ninja',4],['samurai',2],['ninja',4,{mix:'samurai'}]],
  // fase 3
  [['ninja',3],['archer',3],['samurai',2,{mix:'ninja'}]],
  // fase 4
  [['samurai',3],['archer',3],['oni',2],['ninja',4,{mix:'archer'}]],
  // fase 5
  [['oni',3],['samurai',4,{mix:'archer'}],['oni',4,{mix:'samurai'}]],
];
const BOSSES = ['ninja','samurai','archer','oni','boss'];

// ── helpers ───────────────────────────────────────────────────
const rnd  = (a,b) => a + Math.random()*(b-a);
const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);

function mkEnemy(type, phase) {
  const t = ENEMY_TYPES[type];
  const spd = t.spd * (1 + phase*0.12);
  return {
    id: Math.random(), type, ...t, spd,
    x: W + rnd(20,100), y: rnd(60, H-60),
    maxHp: t.hp * (1 + Math.floor(phase/2)*0.5)|0,
    hp:    t.hp * (1 + Math.floor(phase/2)*0.5)|0,
    vx: -spd, vy: 0, hitFlash: 0,
    shootTimer: type==='archer'?rnd(60,120):0,
    alive: true,
  };
}

function mkFloat(x,y,text,color,size=15,life=40) {
  return {x,y,text,color,size,life,maxLife:life,vy:-1.2};
}

// ── Componente ────────────────────────────────────────────────
export default function NinjaWarrior({ compact=false }) {
  const canvasRef = useRef(null);
  const G         = useRef(null);
  const rafRef    = useRef(null);
  const phaseRef  = useRef('idle');

  const [ui, setUi] = useState({
    phase:'idle', hp:5, maxHp:5, weapon:'shuriken',
    wave:0, stage:1, kills:0, score:0,
    best: Number(localStorage.getItem('nw_best')||0),
  });

  // ── init ──────────────────────────────────────────────────────
  const startGame = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    cancelAnimationFrame(rafRef.current);
    phaseRef.current = 'playing';

    G.current = {
      running:true, frame:0,
      player:{ x:PLAYER_X, y:H/2, hp:5, maxHp:5, invincible:0, slashCd:0, bowCharge:0, weapon:'shuriken', score:0, kills:0 },
      enemies:[], projectiles:[], eProjectiles:[], particles:[], floats:[],
      stage:0, wave:-1, waveTimer:0, bossSpawned:false, bossDefeated:false,
      waveClearing:false, stageClearing:false, stagePause:0,
      weaponMode:'shuriken',
      shurCd:0, bowCharging:false, bowRelease:false,
      dragY: null, swordSwipe:[], swordCd:0,
      shake:0, flashRed:0,
    };

    setUi(u=>({...u, phase:'playing', hp:5, maxHp:5, weapon:'shuriken', wave:1, stage:1, kills:0, score:0}));
    runLoop(canvas);
  },[]);

  const endGame = useCallback((score) => {
    cancelAnimationFrame(rafRef.current);
    if (G.current) G.current.running=false;
    phaseRef.current='dead';
    const best=Number(localStorage.getItem('nw_best')||0);
    if (score>best) localStorage.setItem('nw_best',score);
    setUi(u=>({...u, phase:'dead', score, best:Math.max(score,best)}));
  },[]);

  const nextWave = useCallback((g) => {
    const stageIdx = g.stage;
    const waveIdx  = g.wave;
    const waveData = WAVES[stageIdx]?.[waveIdx];
    if (!waveData) {
      // boss!
      if (!g.bossSpawned) {
        const bossType = BOSSES[stageIdx]||'boss';
        const boss = mkEnemy(bossType==='boss'?'boss':bossType, stageIdx);
        boss.isBoss=true; boss.maxHp*=2; boss.hp=boss.maxHp; boss.sz=48; boss.spd*=0.7;
        g.enemies.push(boss); g.bossSpawned=true;
        g.floats.push(mkFloat(W/2,H/2-40,'⚠️ BOSS!','#ef4444',26,80));
      }
      return;
    }
    // spawn inimigos da wave
    const [mainType, count, opts] = waveData;
    for (let i=0;i<count;i++) setTimeout(()=>{ if(G.current?.running) G.current.enemies.push(mkEnemy(mainType,stageIdx)); }, i*500);
    if (opts?.mix) for (let i=0;i<Math.ceil(count/2);i++) setTimeout(()=>{ if(G.current?.running) G.current.enemies.push(mkEnemy(opts.mix,stageIdx)); }, i*700+300);
    g.floats.push(mkFloat(W/2,40,`WAVE ${waveIdx+1}`,'#f97316',18,50));
  },[]);

  // ── loop ─────────────────────────────────────────────────────
  const runLoop = useCallback((canvas) => {
    const ctx = canvas.getContext('2d');

    const tick = () => {
      const g = G.current;
      if (!g||!g.running) return;
      g.frame++;

      // wave management
      if (!g.stageClearing) {
        const alive = g.enemies.filter(e=>e.alive).length;
        if (alive===0 && !g.bossSpawned) {
          g.waveTimer++;
          if (g.waveTimer>80) {
            g.waveTimer=0; g.wave++;
            const stageWaves = WAVES[g.stage]||[];
            if (g.wave>=stageWaves.length) nextWave(g); // boss
            else nextWave(g);
          }
        } else if (alive===0 && g.bossSpawned && g.bossDefeated) {
          // próximo stage
          g.stagePause++;
          if (g.stagePause>120) {
            g.stage++; g.wave=0; g.bossSpawned=false; g.bossDefeated=false; g.stagePause=0;
            if (g.stage>=WAVES.length) { endGame(g.player.score); return; }
            g.floats.push(mkFloat(W/2,H/2,'✅ FASE CLARA!','#10b981',22,90));
            setUi(u=>({...u, stage:g.stage+1, wave:1, kills:g.player.kills, score:g.player.score, hp:g.player.hp}));
            setTimeout(()=>{ if(G.current?.running){nextWave(G.current); G.current.wave=0;} },1500);
          }
        }
      }

      // física
      if (g.player.invincible>0) g.player.invincible--;
      if (g.shurCd>0) g.shurCd--;
      if (g.swordCd>0) g.swordCd--;
      if (g.shake>0) g.shake-=0.1;
      if (g.flashRed>0) g.flashRed-=0.08;

      // bow charge
      if (g.bowCharging) g.player.bowCharge=Math.min(60,g.player.bowCharge+1);

      // auto-shuriken if weapon=shuriken and enemy nearby
      if (g.weaponMode==='shuriken' && g.shurCd<=0) {
        const nearest = g.enemies.filter(e=>e.alive).sort((a,b)=>a.x-b.x)[0];
        if (nearest) {
          fireShuriken(g, g.player.x+20, g.player.y, nearest.x, nearest.y);
          g.shurCd=22;
        }
      }

      // inimigos
      for (const e of g.enemies) {
        if (!e.alive) continue;
        // IA
        e.vy += (g.player.y - e.y)*0.006;
        e.vy *= 0.85;
        e.y += e.vy;
        e.x += e.vx;
        e.y = Math.max(30, Math.min(H-30, e.y));
        if (e.hitFlash>0) e.hitFlash--;

        // projétil inimigo (archer)
        if (e.type==='archer' && e.shootTimer>0) {
          e.shootTimer--;
          if (e.shootTimer<=0) {
            g.eProjectiles.push({x:e.x,y:e.y,vx:-5,vy:(g.player.y-e.y)*0.05,emoji:'🏹',life:80,maxLife:80});
            e.shootTimer=rnd(90,140);
          }
        }

        // alcance corpo-a-corpo
        if (e.x<g.player.x+30 && dist(e,g.player)<38) {
          if (g.player.invincible<=0) {
            g.player.hp--;
            g.player.invincible=60;
            g.shake=1.5; g.flashRed=1;
            setUi(u=>({...u, hp:g.player.hp}));
            g.floats.push(mkFloat(g.player.x,g.player.y-30,'-1 HP','#ef4444',16,35));
            if (g.player.hp<=0) { endGame(g.player.score); return; }
          }
          e.vx=-1; // recua um pouco
        }
      }

      // projéteis do jogador
      for (const p of g.projectiles) {
        p.x+=p.vx; p.y+=p.vy; p.life--;
        if (p.x>W+20||p.x<-20||p.y<0||p.y>H||p.life<=0){p.dead=true;continue;}
        for (const e of g.enemies) {
          if (!e.alive||p.dead) continue;
          if (dist(p,e)<e.sz/2+8) {
            const dmg = p.pierce?2:p.dmg||1;
            e.hp-=dmg; e.hitFlash=8;
            if (!p.pierce) p.dead=true;
            if (e.hp<=0) { killEnemy(g,e); }
            else {
              for(let i=0;i<4;i++) g.particles.push({x:e.x,y:e.y,vx:rnd(-3,3),vy:rnd(-4,0),color:'#ef4444',r:2,life:14,maxLife:14,type:'dot'});
            }
          }
        }
      }
      G.current.projectiles=g.projectiles.filter(p=>!p.dead);

      // projéteis inimigos
      for (const p of g.eProjectiles) {
        p.x+=p.vx; p.y+=p.vy; p.life--;
        if (dist(p,g.player)<20 && g.player.invincible<=0) {
          g.player.hp--; g.player.invincible=50; g.shake=1; g.flashRed=0.8;
          setUi(u=>({...u, hp:g.player.hp}));
          p.life=0;
          if (g.player.hp<=0){endGame(g.player.score);return;}
        }
      }
      G.current.eProjectiles=g.eProjectiles.filter(p=>p.life>0);

      // partículas / floats
      for (const p of g.particles){p.x+=p.vx;p.y+=p.vy;p.vy+=0.2;p.life--;}
      G.current.particles=g.particles.filter(p=>p.life>0);
      for (const f of g.floats){f.y+=f.vy;f.life--;}
      G.current.floats=g.floats.filter(f=>f.life>0);

      // ── DRAW ─────────────────────────────────────────────────
      const shk=g.shake>0?(Math.random()-0.5)*g.shake*8:0;
      const shky=g.shake>0?(Math.random()-0.5)*g.shake*6:0;
      ctx.save(); ctx.translate(shk,shky);
      ctx.clearRect(-20,-20,W+40,H+40);

      // fundo dojo
      const bg=ctx.createLinearGradient(0,0,0,H);
      bg.addColorStop(0,'#0a0008'); bg.addColorStop(1,'#140010');
      ctx.fillStyle=bg; ctx.fillRect(-20,-20,W+40,H+40);

      if (g.flashRed>0){ctx.fillStyle=`rgba(239,68,68,${g.flashRed*0.3})`;ctx.fillRect(-20,-20,W+40,H+40);}

      // chão e plataformas decorativas
      ctx.strokeStyle='rgba(168,85,247,0.12)'; ctx.lineWidth=1;
      for(let i=0;i<H;i+=40){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(W,i);ctx.stroke();}
      ctx.strokeStyle='rgba(168,85,247,0.06)';
      for(let i=0;i<W;i+=40){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,H);ctx.stroke();}

      // linha divisória jogador
      ctx.setLineDash([4,4]); ctx.strokeStyle='rgba(168,85,247,0.15)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(PLAYER_X+36,0); ctx.lineTo(PLAYER_X+36,H); ctx.stroke();
      ctx.setLineDash([]);

      // inimigos
      for (const e of g.enemies) {
        if (!e.alive) continue;
        ctx.save();
        ctx.globalAlpha=e.hitFlash>0?0.5:1;
        // barra de vida
        const bw=e.sz; const bx=e.x-bw/2; const by=e.y-e.sz/2-10;
        ctx.fillStyle='#1e293b'; ctx.fillRect(bx,by,bw,5);
        const hpPct=e.hp/e.maxHp;
        ctx.fillStyle=hpPct>0.6?'#10b981':hpPct>0.3?'#f97316':'#ef4444';
        ctx.fillRect(bx,by,bw*hpPct,5);
        // sprite
        ctx.font=`${e.sz}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
        if (e.isBoss){ctx.shadowColor='#ef4444';ctx.shadowBlur=20;}
        ctx.fillText(e.emoji,e.x,e.y);
        ctx.restore();
      }

      // projéteis inimigos
      ctx.font='18px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      for(const p of g.eProjectiles) ctx.fillText(p.emoji,p.x,p.y);

      // projéteis do jogador
      for(const p of g.projectiles){
        ctx.save();
        const angle=Math.atan2(p.vy,p.vx);
        ctx.translate(p.x,p.y); ctx.rotate(angle);
        ctx.font=`${p.sz||16}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
        if(p.glow){ctx.shadowColor=p.glow;ctx.shadowBlur=14;}
        ctx.fillText(p.emoji,0,0);
        ctx.restore();
      }

      // sword slash arc
      if (g.swordSlash>0) {
        ctx.save();
        ctx.strokeStyle=`rgba(251,191,36,${g.swordSlash/15})`;
        ctx.lineWidth=5; ctx.lineCap='round';
        ctx.shadowColor='#fbbf24'; ctx.shadowBlur=20;
        ctx.beginPath();
        ctx.arc(g.player.x+20,g.player.y,55,-Math.PI*0.4,Math.PI*0.4);
        ctx.stroke();
        ctx.restore();
        g.swordSlash--;
      }

      // bow charge arc
      if (g.bowCharging && g.player.bowCharge>0) {
        const pct=g.player.bowCharge/60;
        ctx.save(); ctx.strokeStyle=`rgba(16,185,129,${pct*0.8})`; ctx.lineWidth=2+pct*3;
        ctx.shadowColor='#10b981'; ctx.shadowBlur=10*pct;
        ctx.beginPath(); ctx.arc(g.player.x,g.player.y,30*pct,0,Math.PI*2); ctx.stroke();
        ctx.restore();
      }

      // partículas
      for(const p of g.particles){
        ctx.save(); ctx.globalAlpha=p.life/p.maxLife;
        if(p.type==='dot'){ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
        else{ctx.font='18px serif';ctx.textAlign='center';ctx.fillText(p.emoji,p.x,p.y);}
        ctx.restore();
      }

      // floats
      for(const f of g.floats){
        ctx.save(); ctx.globalAlpha=Math.min(1,f.life/(f.maxLife*0.5));
        ctx.font=`bold ${f.size}px system-ui`; ctx.fillStyle=f.color;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.shadowColor=f.color; ctx.shadowBlur=8;
        ctx.fillText(f.text,f.x,f.y); ctx.restore();
      }

      // player
      ctx.save();
      if (g.player.invincible>0 && Math.floor(g.frame/4)%2===0) ctx.globalAlpha=0.3;
      ctx.font='36px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.shadowColor='#a78bfa'; ctx.shadowBlur=16;
      ctx.fillText('🥷',g.player.x,g.player.y);
      ctx.restore();

      // weapon indicator
      const wEmoji={shuriken:'⭐',sword:'⚔️',bow:'🏹'}[g.weaponMode]||'⭐';
      ctx.font='13px serif'; ctx.textAlign='left'; ctx.textBaseline='top';
      ctx.fillText(wEmoji,8,8);

      // HUD
      // HP bar
      const hpW=90;
      ctx.fillStyle='#1e293b'; ctx.fillRect(W-hpW-8,8,hpW,12);
      const hpPct=g.player.hp/g.player.maxHp;
      ctx.fillStyle=hpPct>0.5?'#10b981':hpPct>0.25?'#f97316':'#ef4444';
      ctx.fillRect(W-hpW-8,8,hpW*hpPct,12);
      ctx.fillStyle='#fff'; ctx.font='bold 10px system-ui'; ctx.textAlign='center';
      ctx.fillText(`❤️ ${g.player.hp}/${g.player.maxHp}`,W-hpW/2-8,9);

      // score
      ctx.fillStyle='#f1f5f9'; ctx.font='bold 14px system-ui'; ctx.textAlign='center';
      ctx.shadowColor='#a78bfa'; ctx.shadowBlur=6;
      ctx.fillText(g.player.score,W/2,12);
      ctx.shadowBlur=0;

      // stage/wave
      const stageWaves=WAVES[g.stage]||[];
      const waveLabel=g.bossSpawned?'BOSS!`':`W${g.wave}/${stageWaves.length}`;
      ctx.fillStyle='rgba(168,85,247,0.7)'; ctx.font='10px system-ui'; ctx.textAlign='left';
      ctx.fillText(`F${g.stage+1} ${waveLabel}`,30,12);

      ctx.restore();
      rafRef.current=requestAnimationFrame(tick);
    };
    rafRef.current=requestAnimationFrame(tick);
  },[endGame,nextWave]);

  // ── helpers de combate ────────────────────────────────────────
  function fireShuriken(g,x,y,tx,ty,opts={}) {
    const angle=Math.atan2(ty-y,tx-x);
    const spd=opts.spd||8;
    g.projectiles.push({x,y,vx:Math.cos(angle)*spd,vy:Math.sin(angle)*spd,emoji:'⭐',sz:16,dmg:1,pierce:opts.pierce||false,glow:opts.glow||null,life:80});
  }
  function fireArrow(g,x,y,charge) {
    const pct=charge/60;
    const dmg=Math.round(1+pct*4);
    g.projectiles.push({x,y,vx:10+pct*4,vy:0,emoji:'🏹',sz:20,dmg,pierce:pct>0.8,glow:pct>0.8?'#10b981':null,life:80});
    if (pct>0.5) g.floats.push(mkFloat(x,y-30,dmg>3?'⚡ PENETRA!':'🏹 +'+dmg,'#10b981',14,35));
  }
  function swordSlash(g) {
    if (g.swordCd>0) return;
    g.swordCd=40; g.swordSlash=15;
    const range=70;
    let hit=0;
    for (const e of g.enemies) {
      if (!e.alive) continue;
      if (e.x-g.player.x<range && dist(e,g.player)<80) {
        const dmg=3; e.hp-=dmg; e.hitFlash=10; hit++;
        if (e.hp<=0) killEnemy(g,e);
        else { for(let i=0;i<5;i++) g.particles.push({x:e.x,y:e.y,vx:rnd(1,5),vy:rnd(-3,1),color:'#fbbf24',r:2,life:14,maxLife:14,type:'dot'}); }
      }
    }
    if (hit>1) g.floats.push(mkFloat(g.player.x+40,g.player.y-30,`⚔️ x${hit}!`,'#fbbf24',18,45));
  }
  function killEnemy(g,e) {
    e.alive=false;
    g.player.score+=e.pts; g.player.kills++;
    if (e.isBoss) { g.bossDefeated=true; g.floats.push(mkFloat(W/2,H/2-20,'💀 BOSS DERROTADO!','#ffd700',22,100)); }
    g.floats.push(mkFloat(e.x,e.y-20,`+${e.pts}`,'#ffd700',14,38));
    for(let i=0;i<8;i++) g.particles.push({x:e.x,y:e.y,vx:rnd(-4,4),vy:rnd(-5,0),color:e.color||'#f97316',r:2+Math.random()*3,life:22,maxLife:22,type:'dot'});
    g.particles.push({x:e.x,y:e.y,vx:0,vy:-1,emoji:e.emoji,type:'emoji',life:20,maxLife:20});
    setUi(u=>({...u,score:g.player.score,kills:g.player.kills}));
  }

  // ── input ─────────────────────────────────────────────────────
  const getPos=useCallback((e)=>{
    const c=canvasRef.current; if(!c) return null;
    const r=c.getBoundingClientRect();
    const src=e.touches?e.touches[0]:e;
    return{x:(src.clientX-r.left)*(W/r.width),y:(src.clientY-r.top)*(H/r.height)};
  },[]);

  const onDown=useCallback((e)=>{
    e.preventDefault();
    if(phaseRef.current!=='playing') return;
    const pos=getPos(e); if(!pos) return;
    const g=G.current; if(!g) return;
    if(pos.x<W/2) { g.dragY=pos.y; return; } // mover jogador
    const wm=g.weaponMode;
    if(wm==='bow') { g.bowCharging=true; g.player.bowCharge=0; }
  },[getPos]);

  const onMove=useCallback((e)=>{
    e.preventDefault();
    if(phaseRef.current!=='playing') return;
    const pos=getPos(e); if(!pos) return;
    const g=G.current; if(!g) return;
    if(pos.x<W/2 && g.dragY!==null) { g.player.y=Math.max(30,Math.min(H-30,pos.y)); g.dragY=pos.y; }
  },[getPos]);

  const onUp=useCallback((e)=>{
    e.preventDefault();
    if(phaseRef.current!=='playing') return;
    const pos=getPos(e); if(!pos) return;
    const g=G.current; if(!g) return;
    if(g.dragY!==null){g.dragY=null;return;}
    const wm=g.weaponMode;
    if(wm==='bow' && g.bowCharging) {
      fireArrow(g,g.player.x+20,g.player.y,g.player.bowCharge);
      g.bowCharging=false; g.player.bowCharge=0; return;
    }
    if(wm==='sword') { swordSlash(g); return; }
    // shuriken: atira no ponto tocado
    if(wm==='shuriken' && pos.x>W/2 && g.shurCd<=0) {
      fireShuriken(g,g.player.x+20,g.player.y,pos.x,pos.y,{spd:10});
      g.shurCd=10;
    }
  },[getPos]);

  const setWeapon=useCallback((w)=>{
    if(!G.current) return;
    G.current.weaponMode=w;
    if(G.current.bowCharging){G.current.bowCharging=false;G.current.player.bowCharge=0;}
    setUi(u=>({...u,weapon:w}));
  },[]);

  const {phase,hp,maxHp,weapon,wave,stage,kills,score,best}=ui;
  const cH=compact?320:H;

  return (
    <div style={{position:'relative',userSelect:'none'}}>
      <canvas ref={canvasRef} width={W} height={H}
        style={{width:'100%',borderRadius:16,touchAction:'none',display:phase==='playing'?'block':'none',cursor:'crosshair'}}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      />

      {/* weapon bar — durante o jogo */}
      {phase==='playing'&&(
        <div style={{display:'flex',gap:6,justifyContent:'center',padding:'6px 0',background:'rgba(0,0,0,0.6)',borderRadius:'0 0 16px 16px'}}>
          {[['shuriken','⭐','Shuriken'],['sword','⚔️','Espada'],['bow','🏹','Arco']].map(([w,em,lb])=>(
            <button key={w} onClick={()=>setWeapon(w)} style={{
              background:weapon===w?'rgba(168,85,247,0.35)':'rgba(255,255,255,0.05)',
              border:`1px solid ${weapon===w?'rgba(168,85,247,0.8)':'rgba(255,255,255,0.1)'}`,
              borderRadius:10,padding:'4px 12px',cursor:'pointer',color:'#f1f5f9',fontSize:12,fontWeight:weapon===w?700:400,
            }}>{em} {lb}</button>
          ))}
        </div>
      )}

      {/* idle */}
      {phase==='idle'&&(
        <div style={{textAlign:'center',padding:'4px 0'}}>
          <div style={{fontSize:48,marginBottom:6}}>🥷</div>
          <div style={{fontSize:17,fontWeight:900,color:'#f1f5f9',marginBottom:4,letterSpacing:-0.5}}>Ninja Warrior</div>
          <div style={{fontSize:11,color:'#475569',marginBottom:14,lineHeight:1.8}}>
            🖱️ <b>Arraste esquerda</b> = mover ninja<br/>
            ⭐ <b>Shuriken:</b> toque à direita = atirar<br/>
            ⚔️ <b>Espada:</b> toque à direita = slash AoE<br/>
            🏹 <b>Arco:</b> segure = carregar • solte = atirar
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'center',marginBottom:14,flexWrap:'wrap'}}>
            {Object.entries(ENEMY_TYPES).map(([k,v])=>(
              <div key={k} style={{textAlign:'center',fontSize:10,color:'#475569'}}>
                <div style={{fontSize:20}}>{v.emoji}</div>
                <div style={{fontWeight:700}}>{v.hp} HP</div>
              </div>
            ))}
          </div>
          {best>0&&<div style={{fontSize:12,color:'#a78bfa',marginBottom:12,fontWeight:700}}>🏆 Recorde: {best} pts</div>}
          <button onClick={startGame} style={{
            background:'linear-gradient(135deg,#7c3aed,#4f46e5)',border:'none',
            borderRadius:14,padding:'13px 36px',color:'#fff',fontWeight:900,
            fontSize:15,cursor:'pointer',boxShadow:'0 8px 28px rgba(124,58,237,0.5)',letterSpacing:0.5,
          }}>⚔️ Batalhar!</button>
        </div>
      )}

      {/* dead */}
      {phase==='dead'&&(
        <div style={{textAlign:'center',padding:'4px 0'}}>
          <div style={{fontSize:48,marginBottom:8}}>{score>=500?'👑':score>=200?'🏆':score>=80?'🥷':'💀'}</div>
          <div style={{fontSize:32,fontWeight:900,color:'#a78bfa',marginBottom:4}}>{score} pts</div>
          <div style={{fontSize:12,color:'#64748b',marginBottom:4}}>Inimigos eliminados: {kills}</div>
          {score>=best&&score>0
            ?<div style={{fontSize:13,color:'#10b981',fontWeight:800,marginBottom:8}}>🎉 NOVO RECORDE!</div>
            :<div style={{fontSize:12,color:'#475569',marginBottom:8}}>Recorde: {best} pts</div>
          }
          <div style={{fontSize:13,color:'#94a3b8',marginBottom:16}}>
            {score>=500?'👑 MESTRE NINJA LENDÁRIO!':score>=200?'🏆 Ninja Elite!':score>=80?'🥷 Bom guerreiro!':'💀 Você foi derrotado! Vingança?'}
          </div>
          <button onClick={startGame} style={{
            background:'rgba(124,58,237,0.15)',border:'1px solid rgba(124,58,237,0.4)',
            borderRadius:12,padding:'10px 28px',color:'#a78bfa',fontWeight:800,fontSize:14,cursor:'pointer',
          }}>🔄 Revanche!</button>
        </div>
      )}
    </div>
  );
}
