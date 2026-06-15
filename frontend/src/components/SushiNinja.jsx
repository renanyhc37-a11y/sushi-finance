import { useState, useEffect, useRef, useCallback } from 'react';

// ── Constantes ────────────────────────────────────────────────
const SUSHIS  = ['🍣','🍱','🥟','🦐','🐟','🍙','🧆','🥗','🍤','🐠'];
const POWERS  = [
  { emoji:'⚡', id:'lightning', label:'Raio',      desc:'Corta TUDO na tela!' },
  { emoji:'🛡️', id:'shield',    label:'Escudo',    desc:'Protege de 1 bomba' },
  { emoji:'🌀', id:'slowmo',    label:'Slow-Mo',   desc:'Tempo desacelera!' },
  { emoji:'🔥', id:'fire',      label:'Fogo',      desc:'Rastro de fogo 3s!' },
  { emoji:'🧲', id:'magnet',    label:'Imã',       desc:'Atrai sushis ao centro' },
];

function mkPiece(W, H, diff) {
  const roll = Math.random();
  const isBomb    = roll < 0.09;
  const isSpecial = !isBomb && roll > 0.87;
  const isFreeze  = !isBomb && !isSpecial && roll > 0.83;
  const isPower   = !isBomb && !isSpecial && !isFreeze && roll > 0.79;

  const side = Math.random() < 0.18 ? (Math.random()<0.5?'left':'right') : 'bottom';
  let x,y,vx,vy;
  if (side==='bottom') {
    x=W*0.06+Math.random()*W*0.88; y=H+20;
    vy=-(10+Math.random()*5+diff*0.7); vx=(Math.random()-0.5)*4;
  } else if (side==='left') {
    x=-30; y=H*0.25+Math.random()*H*0.5;
    vx=5+Math.random()*4; vy=-(2+Math.random()*4);
  } else {
    x=W+30; y=H*0.25+Math.random()*H*0.5;
    vx=-(5+Math.random()*4); vy=-(2+Math.random()*4);
  }

  const pw = isPower ? POWERS[Math.floor(Math.random()*POWERS.length)] : null;
  const emoji = isBomb?'💣':isSpecial?'⭐':isFreeze?'❄️':isPower?pw.emoji:SUSHIS[Math.floor(Math.random()*SUSHIS.length)];
  return { x,y,vx,vy,rot:Math.random()*360,rotV:(Math.random()-0.5)*7,
    emoji,r:28,isBomb,isSpecial,isFreeze,isPower,pw,sliced:false,alpha:1,scale:1 };
}

function mkDot(x,y,color) {
  return { x,y,vx:(Math.random()-0.5)*8,vy:-Math.random()*7-1,r:2+Math.random()*3,color,type:'dot',life:22,maxLife:22 };
}
function mkFloat(x,y,text,color,size=16,life=38) {
  return { x,y,text,color,size,life,maxLife:life };
}

// ── Componente principal ──────────────────────────────────────
export default function SushiNinja({ compact = false }) {
  const canvasRef = useRef(null);
  const S         = useRef(null);
  const rafRef    = useRef(null);
  const phaseRef  = useRef('idle');
  const [ui, setUi] = useState({
    phase:'idle', score:0, lives:3, combo:0, shield:false, activePow:'',
    best: Number(localStorage.getItem('sninja_best')||0),
  });

  const H_CANVAS = compact ? 320 : 400;

  // ── fim de jogo ──────────────────────────────────────────────
  const endGame = useCallback((score) => {
    cancelAnimationFrame(rafRef.current);
    if (S.current) S.current.running = false;
    phaseRef.current = 'dead';
    const best = Number(localStorage.getItem('sninja_best')||0);
    if (score>best) localStorage.setItem('sninja_best',score);
    setUi({ phase:'dead',score,lives:0,combo:0,shield:false,activePow:'', best:Math.max(score,best) });
  },[]);

  // ── ativar super poder ────────────────────────────────────────
  const activatePower = useCallback((pw, s, W, H) => {
    if (!pw) return;
    setUi(u=>({...u, activePow:pw.emoji}));
    setTimeout(()=>setUi(u=>({...u,activePow:''})),1800);

    if (pw.id==='lightning') {
      // corta tudo na tela
      for (const p of s.pieces) {
        if (!p.sliced && !p.isBomb) {
          p.sliced=true; s.score++;
          for(let i=0;i<5;i++) s.particles.push(mkDot(p.x,p.y,'#ffd700'));
          s.floats.push(mkFloat(p.x,p.y-20,'+1','#ffd700'));
        }
      }
      s.flashGold=1.2;
      s.floats.push(mkFloat(W/2,H/2,'⚡ RAIO!','#ffd700',28,55));
      setUi(u=>({...u,score:s.score}));
    }
    if (pw.id==='shield') {
      s.shield=true;
      setUi(u=>({...u,shield:true}));
      s.floats.push(mkFloat(W/2,H/2,'🛡️ ESCUDO ATIVO!','#60a5fa',22,55));
    }
    if (pw.id==='slowmo') {
      s.slowmo=300; // ~5s a 60fps
      s.floats.push(mkFloat(W/2,H/2,'🌀 SLOW-MO!','#a78bfa',24,55));
    }
    if (pw.id==='fire') {
      s.firePow=200;
      s.floats.push(mkFloat(W/2,H/2,'🔥 MODO FOGO!','#f97316',24,55));
    }
    if (pw.id==='magnet') {
      s.magnet=240;
      s.floats.push(mkFloat(W/2,H/2,'🧲 IMÃS!','#10b981',24,55));
    }
  },[]);

  // ── iniciar jogo ─────────────────────────────────────────────
  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    cancelAnimationFrame(rafRef.current);
    const W=canvas.width, H=canvas.height;

    S.current = {
      running:true, pieces:[], blade:[], particles:[], floats:[],
      score:0, lives:3, combo:0, comboTimer:0,
      spawnTimer:0, spawnInterval:70, frame:0, difficulty:0,
      shake:0, flashRed:0, flashGold:0,
      frozen:0, slowmo:0, firePow:0, magnet:0, shield:false,
      fireTrail:[],
    };
    phaseRef.current='playing';
    setUi(u=>({...u,phase:'playing',score:0,lives:3,combo:0,shield:false,activePow:''}));

    const ctx=canvas.getContext('2d');
    const G=0.34;

    const loop=()=>{
      const s=S.current;
      if(!s||!s.running) return;
      s.frame++; s.difficulty=s.frame/320;

      const spd = s.slowmo>0 ? 0.35 : 1;
      if(s.slowmo>0) s.slowmo--;
      if(s.frozen>0) s.frozen--;
      if(s.firePow>0) s.firePow--;
      if(s.magnet>0) s.magnet--;

      // shake
      const shk=s.shake>0?(Math.random()-0.5)*s.shake*9:0;
      const shky=s.shake>0?(Math.random()-0.5)*s.shake*7:0;
      if(s.shake>0) s.shake-=0.09;

      ctx.save();
      ctx.translate(shk,shky);
      ctx.clearRect(-20,-20,W+40,H+40);

      // fundo
      const bg=ctx.createLinearGradient(0,0,0,H);
      const night = s.slowmo>0?'#0a0020':s.firePow>0?'#1a0500':'#060606';
      bg.addColorStop(0,night); bg.addColorStop(1,'#0d0600');
      ctx.fillStyle=bg; ctx.fillRect(-20,-20,W+40,H+40);

      // tint slowmo
      if(s.slowmo>0){ ctx.fillStyle=`rgba(100,60,255,${Math.min(s.slowmo/300,1)*0.08})`; ctx.fillRect(-20,-20,W+40,H+40); }
      if(s.firePow>0){ ctx.fillStyle=`rgba(249,115,22,${Math.min(s.firePow/200,1)*0.06})`; ctx.fillRect(-20,-20,W+40,H+40); }

      if(s.flashRed>0){ ctx.fillStyle=`rgba(239,68,68,${s.flashRed*0.35})`; ctx.fillRect(-20,-20,W+40,H+40); s.flashRed-=0.1; }
      if(s.flashGold>0){ ctx.fillStyle=`rgba(255,215,0,${s.flashGold*0.2})`; ctx.fillRect(-20,-20,W+40,H+40); s.flashGold-=0.08; }

      // grid
      ctx.strokeStyle=s.slowmo>0?'rgba(140,80,255,0.06)':s.firePow>0?'rgba(249,115,22,0.07)':'rgba(249,115,22,0.04)';
      ctx.lineWidth=1;
      for(let i=0;i<W;i+=48){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,H);ctx.stroke();}
      for(let i=0;i<H;i+=48){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(W,i);ctx.stroke();}

      // fire trail
      if(s.firePow>0 && s.blade.length>0){
        const last=s.blade[s.blade.length-1];
        s.fireTrail.push({x:last.x,y:last.y,life:20,maxLife:20});
      }
      s.fireTrail=s.fireTrail.filter(f=>f.life>0);
      for(const f of s.fireTrail){
        f.life--;
        ctx.save(); ctx.globalAlpha=f.life/f.maxLife*0.7;
        ctx.font='16px serif'; ctx.textAlign='center';
        ctx.fillText('🔥',f.x,f.y); ctx.restore();
      }

      // spawn
      s.spawnTimer++;
      if(s.spawnTimer>=s.spawnInterval){
        s.spawnTimer=0;
        const count=s.difficulty>3&&Math.random()<0.3?2:1;
        for(let i=0;i<count;i++) s.pieces.push(mkPiece(W,H,s.difficulty));
        if(s.spawnInterval>30) s.spawnInterval-=0.15;
      }

      // comboTimer
      if(s.comboTimer>0){s.comboTimer--;if(s.comboTimer===0)s.combo=0;}

      // física
      const freeze=s.frozen>0;
      s.pieces=s.pieces.filter(p=>p.alpha>0.03);
      for(const p of s.pieces){
        if(!p.sliced){
          if(!freeze){
            p.vy+=G*spd; p.x+=p.vx*spd; p.y+=p.vy*spd; p.rot+=p.rotV*spd;
          }
          // imã: puxa ao centro
          if(s.magnet>0 && !p.isBomb){
            const cx=W/2,cy=H/2;
            const dx=cx-p.x, dy=cy-p.y;
            const dist=Math.sqrt(dx*dx+dy*dy)||1;
            p.vx+=dx/dist*0.8*spd; p.vy+=dy/dist*0.8*spd;
          }
          if(p.isSpecial||p.isPower) p.scale=1+Math.sin(s.frame*0.12)*0.14;
          // fogo auto-slice
          if(s.firePow>0 && s.blade.length>0){
            const last=s.blade[s.blade.length-1];
            const dx=last.x-p.x,dy=last.y-p.y;
            if(Math.sqrt(dx*dx+dy*dy)<p.r+30 && !p.isBomb){
              p.sliced=true; s.score++;
              for(let i=0;i<5;i++) s.particles.push(mkDot(p.x,p.y,'#f97316'));
              s.floats.push(mkFloat(p.x,p.y-20,'+1🔥','#f97316'));
            }
          }
          if(p.y>H+70||p.x<-90||p.x>W+90){
            if(!p.isBomb){
              if(s.shield){ s.shield=false; setUi(u=>({...u,shield:false}));
                s.floats.push(mkFloat(W/2,H*0.4,'🛡️ BLOQUEADO!','#60a5fa',20,40));
              } else {
                s.lives=Math.max(0,s.lives-1); s.shake=1.2; s.flashRed=1.2;
                s.combo=0; s.comboTimer=0;
                setUi(u=>({...u,lives:s.lives,combo:0}));
                if(s.lives<=0){endGame(s.score);ctx.restore();return;}
              }
            }
            p.alpha=0;
          }
        } else { p.alpha-=0.07; }
      }

      // draw pieces
      ctx.textAlign='center'; ctx.textBaseline='middle';
      for(const p of s.pieces){
        if(p.alpha<=0) continue;
        ctx.save(); ctx.globalAlpha=p.alpha;
        ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
        const sc=p.scale||1; ctx.scale(sc,sc);
        if(p.isSpecial){ctx.shadowColor='#ffd700';ctx.shadowBlur=22;}
        else if(p.isFreeze){ctx.shadowColor='#93d2ff';ctx.shadowBlur=16;}
        else if(p.isBomb){ctx.shadowColor='#ef4444';ctx.shadowBlur=14;}
        else if(p.isPower){ctx.shadowColor=p.pw?.id==='shield'?'#60a5fa':p.pw?.id==='lightning'?'#ffd700':p.pw?.id==='slowmo'?'#a78bfa':'#f97316';ctx.shadowBlur=18;}
        ctx.font='38px serif'; ctx.fillText(p.emoji,0,0);
        // anel especial
        if(p.isPower){
          ctx.strokeStyle=ctx.shadowColor||'#fff'; ctx.lineWidth=2;
          ctx.globalAlpha=(p.alpha||1)*0.5;
          ctx.beginPath(); ctx.arc(0,0,26,0,Math.PI*2); ctx.stroke();
        }
        ctx.restore();
      }

      // partículas
      s.particles=s.particles.filter(p=>p.life>0);
      for(const p of s.particles){
        p.x+=p.vx*spd; p.y+=p.vy*spd; p.vy+=0.3*spd; p.life--;
        ctx.save(); ctx.globalAlpha=p.life/p.maxLife;
        if(p.type==='dot'){ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();}
        else{ctx.font='18px serif';ctx.textAlign='center';ctx.fillText(p.emoji,p.x,p.y);}
        ctx.restore();
      }

      // floats
      s.floats=s.floats.filter(f=>f.life>0);
      for(const f of s.floats){
        f.y-=1.5*spd; f.life--;
        ctx.save(); ctx.globalAlpha=Math.min(1,f.life/(f.maxLife*0.4));
        ctx.font=`bold ${f.size||16}px system-ui`; ctx.fillStyle=f.color||'#ffd700';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.shadowColor=f.color||'#ffd700'; ctx.shadowBlur=10;
        ctx.fillText(f.text,f.x,f.y); ctx.restore();
      }

      // lâmina
      if(s.blade.length>1){
        ctx.save();
        const fireColor=s.firePow>0;
        for(let i=1;i<s.blade.length;i++){
          const t=i/s.blade.length;
          ctx.strokeStyle=fireColor?`rgba(255,${80+t*60},0,${t*0.95})`:`rgba(255,${160+t*95},${t*120},${t*0.9})`;
          ctx.lineWidth=2+t*4; ctx.lineCap='round';
          ctx.shadowColor=fireColor?'#ff4400':'#f97316'; ctx.shadowBlur=12*t;
          ctx.beginPath(); ctx.moveTo(s.blade[i-1].x,s.blade[i-1].y);
          ctx.lineTo(s.blade[i].x,s.blade[i].y); ctx.stroke();
        }
        ctx.restore();
        s.blade=s.blade.slice(-16);
      }

      // ── HUD ──
      // score
      ctx.save();
      ctx.fillStyle='#fff'; ctx.font='bold 26px system-ui';
      ctx.textAlign='left'; ctx.textBaseline='top';
      ctx.shadowColor='#f97316'; ctx.shadowBlur=10;
      ctx.fillText(s.score,12,8); ctx.restore();
      // combo
      if(s.combo>=3){
        const cc=s.combo>=8?'#ffd700':s.combo>=5?'#a78bfa':'#f97316';
        ctx.save(); ctx.fillStyle=cc; ctx.font=`bold 14px system-ui`;
        ctx.textAlign='left'; ctx.textBaseline='top';
        ctx.shadowColor=cc; ctx.shadowBlur=12;
        ctx.fillText(`🔥 x${s.combo}`,12,40); ctx.restore();
      }
      // vidas + escudo
      ctx.font='20px serif'; ctx.textAlign='right'; ctx.textBaseline='top';
      const lifeStr = '❤️'.repeat(Math.max(0,s.lives))+(s.shield?'🛡️':'');
      ctx.fillText(lifeStr,W-6,8);
      // slow-mo badge
      if(s.slowmo>0){
        ctx.save(); ctx.fillStyle='rgba(140,80,255,0.7)'; ctx.fillRect(W/2-36,4,72,20); ctx.restore();
        ctx.fillStyle='#fff'; ctx.font='bold 11px system-ui'; ctx.textAlign='center'; ctx.textBaseline='top';
        ctx.fillText('🌀 SLOW-MO',W/2,7);
      }
      if(s.firePow>0){
        ctx.save(); ctx.fillStyle='rgba(249,80,0,0.7)'; ctx.fillRect(W/2-32,4,64,20); ctx.restore();
        ctx.fillStyle='#fff'; ctx.font='bold 11px system-ui'; ctx.textAlign='center'; ctx.textBaseline='top';
        ctx.fillText('🔥 FOGO',W/2,7);
      }
      if(s.magnet>0){
        ctx.save(); ctx.fillStyle='rgba(16,185,129,0.7)'; ctx.fillRect(W/2-30,4,60,20); ctx.restore();
        ctx.fillStyle='#fff'; ctx.font='bold 11px system-ui'; ctx.textAlign='center'; ctx.textBaseline='top';
        ctx.fillText('🧲 IMÃ',W/2,7);
      }
      // fase
      ctx.font='10px system-ui'; ctx.fillStyle='rgba(249,115,22,0.4)';
      ctx.textAlign='center'; ctx.textBaseline='bottom';
      ctx.fillText(`FASE ${Math.floor(s.difficulty)+1}`,W/2,H-4);

      ctx.restore();
      rafRef.current=requestAnimationFrame(loop);
    };
    rafRef.current=requestAnimationFrame(loop);
  },[endGame,activatePower]);

  // ── input ─────────────────────────────────────────────────────
  const getPos=useCallback((e)=>{
    const c=canvasRef.current; if(!c) return null;
    const r=c.getBoundingClientRect();
    const src=e.touches?e.touches[0]:e;
    return{x:(src.clientX-r.left)*(c.width/r.width),y:(src.clientY-r.top)*(c.height/r.height)};
  },[]);

  const onMove=useCallback((e)=>{
    e.preventDefault();
    if(phaseRef.current!=='playing') return;
    const pos=getPos(e); if(!pos) return;
    const s=S.current; if(!s||!s.running) return;
    s.blade.push(pos);
    const W=canvasRef.current?.width||340, H=canvasRef.current?.height||400;
    for(const p of s.pieces){
      if(p.sliced||p.alpha<=0) continue;
      const dx=pos.x-p.x,dy=pos.y-p.y;
      if(Math.sqrt(dx*dx+dy*dy)<p.r+14){
        if(p.isBomb){
          s.shake=2.5; s.flashRed=2;
          for(let i=0;i<14;i++) s.particles.push({x:p.x,y:p.y,vx:(Math.random()-0.5)*10,vy:-Math.random()*8,r:3+Math.random()*3,color:`hsl(${Math.random()*30},90%,55%)`,type:'dot',life:28,maxLife:28});
          s.floats.push(mkFloat(p.x,p.y-30,'💥 BOOM!','#ef4444',24,40));
          if(s.shield){ s.shield=false; setUi(u=>({...u,shield:false}));
            s.floats.push(mkFloat(W/2,H*0.4,'🛡️ BLOQUEADO!','#60a5fa',22,45));
            p.sliced=true; return;
          }
          endGame(s.score); return;
        }
        if(p.isFreeze){ p.sliced=true; s.frozen=150; s.floats.push(mkFloat(p.x,p.y-20,'❄️ FREEZE!','#93d2ff',18,40)); continue; }
        if(p.isPower){ p.sliced=true; activatePower(p.pw,s,W,H); continue; }

        p.sliced=true;
        const mult=s.combo>=8?3:s.combo>=5?2:s.combo>=3?1.5:1;
        const pts=Math.round((p.isSpecial?3:1)*mult);
        s.score+=pts; s.combo++; s.comboTimer=100;
        setUi(u=>({...u,score:s.score,combo:s.combo}));

        const bonus=mult>1?` x${mult}`:'' ;
        const fc=p.isSpecial?'#ffd700':'#f97316';
        s.floats.push(mkFloat(p.x,p.y-22,`+${pts}${bonus}`,fc,p.isSpecial?22:16));
        if(s.combo===3)  s.floats.push(mkFloat(p.x,p.y-55,'COMBO!','#f97316',20,45));
        if(s.combo===5)  s.floats.push(mkFloat(p.x,p.y-55,'INCRÍVEL!','#a78bfa',22,48));
        if(s.combo===8)  s.floats.push(mkFloat(p.x,p.y-55,'🔥 NINJA! 🔥','#ffd700',24,55));
        if(s.combo===12) s.floats.push(mkFloat(W/2,H/3,'👑 LENDÁRIO!','#ffd700',28,65));

        const colors=p.isSpecial?['#ffd700','#ffe566','#fff']:['#f97316','#fb923c','#fbbf24'];
        for(let i=0;i<8;i++) s.particles.push(mkDot(p.x,p.y,colors[i%colors.length]));
        for(let i=0;i<3;i++) s.particles.push({x:p.x,y:p.y,vx:(Math.random()-0.5)*5,vy:-Math.random()*5,emoji:p.emoji,type:'emoji',life:18,maxLife:18});
      }
    }
  },[endGame,activatePower,getPos]);

  const { phase,score,lives,combo,shield,activePow,best } = ui;

  return (
    <div style={{position:'relative',userSelect:'none'}}>
      {/* canvas sempre montado */}
      <canvas ref={canvasRef} width={340} height={H_CANVAS}
        style={{width:'100%',borderRadius:16,touchAction:'none',display:phase==='playing'?'block':'none',cursor:'crosshair'}}
        onMouseMove={onMove} onTouchMove={onMove}
      />

      {/* ── idle ── */}
      {phase==='idle'&&(
        <div style={{textAlign:'center',padding:'6px 0'}}>
          <div style={{fontSize:compact?42:52,marginBottom:6,lineHeight:1}}>🥷</div>
          <div style={{fontSize:compact?15:18,fontWeight:900,color:'#f1f5f9',marginBottom:4,letterSpacing:-0.5}}>Sushi Ninja Cut</div>
          <div style={{fontSize:11,color:'#475569',marginBottom:12,lineHeight:1.7}}>
            ⚔️ Arraste e corte os sushis!<br/>
            ⭐ Dourado = <b style={{color:'#ffd700'}}>3 pts</b> &nbsp;|&nbsp; ❄️ Freeze = pausa tudo<br/>
            <b style={{color:'#a78bfa'}}>🌀🔥🧲⚡🛡️</b> = super poderes!<br/>
            💣 Bomba = game over (use o escudo!)
          </div>
          {best>0&&<div style={{fontSize:12,color:'#f97316',marginBottom:12,fontWeight:700}}>🏆 Recorde: {best} pts</div>}
          <button onClick={startGame} style={{
            background:'linear-gradient(135deg,#f97316,#dc2626)',border:'none',
            borderRadius:14,padding:compact?'11px 30px':'14px 40px',color:'#fff',fontWeight:900,
            fontSize:compact?14:16,cursor:'pointer',boxShadow:'0 8px 28px rgba(249,115,22,0.5)',letterSpacing:0.5,
          }}>⚔️ Começar!</button>

          {/* legenda poderes */}
          <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:14,flexWrap:'wrap'}}>
            {POWERS.map(pw=>(
              <div key={pw.id} style={{fontSize:10,color:'#475569',textAlign:'center',minWidth:40}}>
                <div style={{fontSize:18}}>{pw.emoji}</div>
                <div style={{fontWeight:700,color:'#64748b'}}>{pw.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── dead ── */}
      {phase==='dead'&&(
        <div style={{textAlign:'center',padding:'4px 0'}}>
          <div style={{fontSize:compact?42:52,marginBottom:8}}>{score>=80?'👑':score>=50?'🏆':score>=25?'🥷':score>=12?'⚔️':'💣'}</div>
          <div style={{fontSize:compact?28:34,fontWeight:900,color:'#f97316',marginBottom:4}}>{score} pts</div>
          {score>=best&&score>0
            ?<div style={{fontSize:13,color:'#10b981',fontWeight:800,marginBottom:8}}>🎉 NOVO RECORDE!</div>
            :<div style={{fontSize:12,color:'#475569',marginBottom:8}}>Recorde: {best} pts</div>
          }
          <div style={{fontSize:13,color:'#94a3b8',marginBottom:16}}>
            {score>=80?'👑 LENDÁRIO! Mestre absoluto!':
             score>=50?'🏆 Sushi Ninja Master!':
             score>=25?'🥷 Excelente! Treine mais!':
             score>=12?'⚔️ Bom começo!':
             '💣 A bomba venceu! Vingança?'}
          </div>
          <button onClick={startGame} style={{
            background:'rgba(249,115,22,0.15)',border:'1px solid rgba(249,115,22,0.4)',
            borderRadius:12,padding:'10px 28px',color:'#f97316',
            fontWeight:800,fontSize:14,cursor:'pointer',
          }}>🔄 Jogar de novo</button>
        </div>
      )}

      {/* badge poder ativo */}
      {activePow&&(
        <div style={{position:'absolute',top:8,left:'50%',transform:'translateX(-50%)',
          background:'rgba(0,0,0,0.8)',borderRadius:20,padding:'4px 14px',
          fontSize:22,pointerEvents:'none',border:'1px solid rgba(249,115,22,0.4)'}}>
          {activePow}
        </div>
      )}
    </div>
  );
}
