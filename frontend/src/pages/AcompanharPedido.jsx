import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';

const STATUS = {
  novo:       { label: 'Confirmando pedido', emoji: '⏳', cor: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  preparando: { label: 'Em preparo',          emoji: '🍣', cor: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  pronto:     { label: 'Saiu para entrega',   emoji: '🛵', cor: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  entregue:   { label: 'Entregue!',           emoji: '🎉', cor: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  cancelado:  { label: 'Cancelado',           emoji: '❌', cor: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
};
const ETAPAS = ['novo', 'preparando', 'pronto', 'entregue'];

// ── Jogo: Sushi Ninja Cut ────────────────────────────────────
const SUSHIS  = ['🍣','🍱','🥟','🦐','🐟','🍙','🧆','🥗'];
const SPECIAL = '⭐'; // sushi dourado vale 3pts
const FREEZE  = '❄️'; // congela tudo por 2s

function mkPiece(W, H, difficulty) {
  const roll = Math.random();
  const isBomb    = roll < 0.10;
  const isSpecial = !isBomb && roll > 0.88;
  const isFreeze  = !isBomb && !isSpecial && roll > 0.82;
  // spawn de baixo ou das laterais
  const side = Math.random() < 0.2 ? (Math.random() < 0.5 ? 'left' : 'right') : 'bottom';
  let x, y, vx, vy;
  if (side === 'bottom') {
    x = W * 0.08 + Math.random() * W * 0.84; y = H + 20;
    vy = -(10 + Math.random() * 6 + difficulty * 0.8);
    vx = (Math.random() - 0.5) * 4;
  } else if (side === 'left') {
    x = -30; y = H * 0.3 + Math.random() * H * 0.4;
    vx = 5 + Math.random() * 4; vy = -(3 + Math.random() * 4);
  } else {
    x = W + 30; y = H * 0.3 + Math.random() * H * 0.4;
    vx = -(5 + Math.random() * 4); vy = -(3 + Math.random() * 4);
  }
  const emoji = isBomb ? '💣' : isSpecial ? SPECIAL : isFreeze ? FREEZE : SUSHIS[Math.floor(Math.random() * SUSHIS.length)];
  return { x, y, vx, vy, rot: Math.random()*360, rotV: (Math.random()-0.5)*7,
    emoji, r: 26, isBomb, isSpecial, isFreeze, sliced: false, alpha: 1, scale: 1 };
}

function SushiNinja() {
  const canvasRef = useRef(null);
  const S = useRef(null); // game state
  const rafRef = useRef(null);
  const phaseRef = useRef('idle');
  const [ui, setUi] = useState({ phase: 'idle', score: 0, lives: 3, combo: 0, best: Number(localStorage.getItem('sninja_best')||0) });

  const endGame = useCallback((score) => {
    cancelAnimationFrame(rafRef.current);
    if (S.current) S.current.running = false;
    phaseRef.current = 'dead';
    const best = Number(localStorage.getItem('sninja_best')||0);
    if (score > best) localStorage.setItem('sninja_best', score);
    setUi({ phase:'dead', score, lives:0, combo:0, best: Math.max(score, best) });
  }, []);

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    cancelAnimationFrame(rafRef.current);
    const W = canvas.width, H = canvas.height;

    S.current = {
      running: true, pieces: [], blade: [], particles: [], floats: [],
      score: 0, lives: 3, combo: 0, comboTimer: 0,
      spawnTimer: 0, spawnInterval: 75, frame: 0, difficulty: 0,
      shake: 0, frozen: 0, flashRed: 0,
    };
    phaseRef.current = 'playing';
    setUi(u => ({ ...u, phase:'playing', score:0, lives:3, combo:0 }));

    const ctx = canvas.getContext('2d');
    const G = 0.35;

    const loop = () => {
      const s = S.current;
      if (!s || !s.running) return;
      s.frame++; s.difficulty = s.frame / 300;

      // shake offset
      const shk = s.shake > 0 ? (Math.random()-0.5)*s.shake*8 : 0;
      const shky = s.shake > 0 ? (Math.random()-0.5)*s.shake*8 : 0;
      if (s.shake > 0) s.shake -= 0.08;

      ctx.save();
      ctx.translate(shk, shky);
      ctx.clearRect(-20,-20,W+40,H+40);

      // fundo gradiente
      const bg = ctx.createLinearGradient(0,0,0,H);
      bg.addColorStop(0,'#050505'); bg.addColorStop(1,'#0d0500');
      ctx.fillStyle = bg; ctx.fillRect(-20,-20,W+40,H+40);

      // flash vermelho (bomba/vida)
      if (s.flashRed > 0) {
        ctx.fillStyle = `rgba(239,68,68,${s.flashRed * 0.35})`;
        ctx.fillRect(-20,-20,W+40,H+40);
        s.flashRed -= 0.08;
      }

      // linhas decorativas
      ctx.strokeStyle = 'rgba(249,115,22,0.04)'; ctx.lineWidth = 1;
      for (let i=0;i<W;i+=50){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,H);ctx.stroke();}
      for (let i=0;i<H;i+=50){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(W,i);ctx.stroke();}

      // efeito frozen
      if (s.frozen > 0) {
        ctx.fillStyle = `rgba(147,210,255,0.06)`;
        ctx.fillRect(-20,-20,W+40,H+40);
        s.frozen--;
      }

      // spawn
      s.spawnTimer++;
      if (s.spawnTimer >= s.spawnInterval) {
        s.spawnTimer = 0;
        // duplo spawn em dificuldade alta
        const count = s.difficulty > 3 && Math.random() < 0.3 ? 2 : 1;
        for (let i=0;i<count;i++) s.pieces.push(mkPiece(W, H, s.difficulty));
        if (s.spawnInterval > 32) s.spawnInterval -= 0.18;
      }

      // comboTimer
      if (s.comboTimer > 0) { s.comboTimer--; if (s.comboTimer===0) s.combo=0; }

      // física
      const frozen = s.frozen > 0;
      s.pieces = s.pieces.filter(p => p.alpha > 0.03);
      for (const p of s.pieces) {
        if (!p.sliced) {
          if (!frozen) { p.vy += G; p.x += p.vx; p.y += p.vy; p.rot += p.rotV; }
          // pulse nos especiais
          if (p.isSpecial) p.scale = 1 + Math.sin(s.frame*0.15)*0.12;
          if (p.y > H+70 || p.x < -80 || p.x > W+80) {
            if (!p.isBomb) {
              s.lives = Math.max(0,s.lives-1);
              s.shake = 1; s.flashRed = 1; s.combo = 0; s.comboTimer = 0;
              setUi(u=>({...u, lives:s.lives, combo:0}));
              if (s.lives<=0){endGame(s.score);ctx.restore();return;}
            }
            p.alpha=0;
          }
        } else { p.alpha -= 0.07; }
      }

      // draw pieces
      ctx.textAlign='center'; ctx.textBaseline='middle';
      for (const p of s.pieces) {
        if (p.alpha<=0) continue;
        ctx.save(); ctx.globalAlpha=p.alpha;
        ctx.translate(p.x,p.y); ctx.rotate(p.rot*Math.PI/180);
        const sc = p.scale||1;
        ctx.scale(sc,sc);
        // glow especiais
        if (p.isSpecial){ ctx.shadowColor='#ffd700'; ctx.shadowBlur=18; }
        if (p.isFreeze) { ctx.shadowColor='#93d2ff'; ctx.shadowBlur=14; }
        if (p.isBomb)   { ctx.shadowColor='#ef4444'; ctx.shadowBlur=10; }
        ctx.font='38px serif'; ctx.fillText(p.emoji,0,0);
        ctx.restore();
      }

      // partículas
      s.particles = s.particles.filter(p=>p.life>0);
      for (const p of s.particles) {
        p.x+=p.vx; p.y+=p.vy; p.vy+=0.3; p.life--;
        ctx.save(); ctx.globalAlpha=p.life/p.maxLife;
        if (p.type==='dot'){
          ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
        } else {
          ctx.font='18px serif'; ctx.textAlign='center'; ctx.fillText(p.emoji,p.x,p.y);
        }
        ctx.restore();
      }

      // floats (textos +pts, COMBO)
      s.floats = s.floats.filter(f=>f.life>0);
      for (const f of s.floats) {
        f.y-=1.2; f.life--;
        ctx.save(); ctx.globalAlpha=f.life/f.maxLife;
        ctx.font=`bold ${f.size||18}px system-ui`; ctx.fillStyle=f.color||'#ffd700';
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.shadowColor=f.color||'#ffd700'; ctx.shadowBlur=8;
        ctx.fillText(f.text,f.x,f.y); ctx.restore();
      }

      // lâmina
      if (s.blade.length>1) {
        ctx.save();
        for (let i=1;i<s.blade.length;i++){
          const t=(i/s.blade.length);
          ctx.strokeStyle=`rgba(255,${180+t*75},${t*100},${t*0.9})`;
          ctx.lineWidth=2+t*3; ctx.lineCap='round';
          ctx.shadowColor='#f97316'; ctx.shadowBlur=10*t;
          ctx.beginPath(); ctx.moveTo(s.blade[i-1].x,s.blade[i-1].y);
          ctx.lineTo(s.blade[i].x,s.blade[i].y); ctx.stroke();
        }
        ctx.restore();
        s.blade=s.blade.slice(-14);
      }

      // HUD
      ctx.save();
      // score
      ctx.fillStyle='#fff'; ctx.font='bold 26px system-ui';
      ctx.textAlign='left'; ctx.textBaseline='top';
      ctx.shadowColor='#f97316'; ctx.shadowBlur=10;
      ctx.fillText(s.score,12,8); ctx.restore();
      // combo badge
      if (s.combo>=3){
        ctx.save();
        ctx.fillStyle=s.combo>=8?'#ffd700':s.combo>=5?'#a78bfa':'#f97316';
        ctx.font=`bold ${s.combo>=8?16:14}px system-ui`;
        ctx.textAlign='left'; ctx.textBaseline='top';
        ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=12;
        ctx.fillText(`🔥 COMBO x${s.combo}`,12,40); ctx.restore();
      }
      // vidas
      ctx.font='20px serif'; ctx.textAlign='right'; ctx.textBaseline='top';
      ctx.fillText('❤️'.repeat(Math.max(0,s.lives)),W-6,8);
      // wave/level
      const lv = Math.floor(s.difficulty)+1;
      ctx.font='11px system-ui'; ctx.fillStyle='rgba(249,115,22,0.5)';
      ctx.textAlign='center'; ctx.textBaseline='top';
      ctx.fillText(`FASE ${lv}`,W/2,8);

      ctx.restore();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [endGame]);

  const getPos = (e) => {
    const c = canvasRef.current; if (!c) return null;
    const r = c.getBoundingClientRect();
    const src = e.touches?e.touches[0]:e;
    return { x:(src.clientX-r.left)*(c.width/r.width), y:(src.clientY-r.top)*(c.height/r.height) };
  };

  const onMove = useCallback((e) => {
    e.preventDefault();
    if (phaseRef.current!=='playing') return;
    const pos = getPos(e); if (!pos) return;
    const s = S.current; if (!s||!s.running) return;
    s.blade.push(pos);
    for (const p of s.pieces) {
      if (p.sliced||p.alpha<=0) continue;
      const dx=pos.x-p.x, dy=pos.y-p.y;
      if (Math.sqrt(dx*dx+dy*dy)<p.r+14) {
        if (p.isBomb) {
          s.shake=2; s.flashRed=2;
          // explodir partículas
          for(let i=0;i<10;i++) s.particles.push({x:p.x,y:p.y,vx:(Math.random()-0.5)*8,vy:-Math.random()*6,r:3+Math.random()*3,color:`hsl(${Math.random()*30},90%,50%)`,type:'dot',life:25,maxLife:25});
          endGame(s.score); return;
        }
        p.sliced=true;
        // freeze
        if (p.isFreeze) { s.frozen=120; s.floats.push({x:p.x,y:p.y-20,text:'❄️ FREEZE!',color:'#93d2ff',life:40,maxLife:40,size:16}); }
        // pontos
        const pts = p.isSpecial?3:1;
        s.score += pts * (s.combo>=8?3 : s.combo>=5?2 : s.combo>=3?1.5 : 1) | 0 || pts;
        s.combo++; s.comboTimer=90;
        setUi(u=>({...u, score:s.score, combo:s.combo}));
        // float pts
        const comboBonus = s.combo>=8?'🔥x3':s.combo>=5?'x2':s.combo>=3?'x1.5':'';
        s.floats.push({x:p.x,y:p.y-20,text:`+${pts}${comboBonus?` ${comboBonus}`:''}`,color:p.isSpecial?'#ffd700':'#f97316',life:35,maxLife:35,size:p.isSpecial?22:16});
        if (s.combo===3) s.floats.push({x:p.x,y:p.y-50,text:'COMBO!',color:'#f97316',life:45,maxLife:45,size:20});
        if (s.combo===5) s.floats.push({x:p.x,y:p.y-50,text:'INCRÍVEL!',color:'#a78bfa',life:45,maxLife:45,size:20});
        if (s.combo===8) s.floats.push({x:p.x,y:p.y-50,text:'🔥 NINJA! 🔥',color:'#ffd700',life:55,maxLife:55,size:22});
        // partículas
        const colors = p.isSpecial?['#ffd700','#ffe066','#fff']:['#f97316','#fb923c','#fff'];
        for(let i=0;i<7;i++) s.particles.push({x:p.x,y:p.y,vx:(Math.random()-0.5)*7,vy:-Math.random()*6-1,r:2+Math.random()*3,color:colors[i%colors.length],type:'dot',life:20,maxLife:20});
        for(let i=0;i<3;i++) s.particles.push({x:p.x,y:p.y,vx:(Math.random()-0.5)*5,vy:-Math.random()*4,emoji:p.emoji,type:'emoji',life:16,maxLife:16});
      }
    }
  },[endGame]);

  const { phase, score, lives, combo, best } = ui;

  return (
    <div style={{ position:'relative', userSelect:'none' }}>
      <canvas ref={canvasRef} width={340} height={380}
        style={{ width:'100%', borderRadius:16, touchAction:'none', display:phase==='playing'?'block':'none', cursor:'crosshair' }}
        onMouseMove={onMove} onTouchMove={onMove}
      />

      {phase==='idle' && (
        <div style={{ textAlign:'center', padding:'4px 0' }}>
          <div style={{ fontSize:52, marginBottom:6, lineHeight:1 }}>🥷</div>
          <div style={{ fontSize:18, fontWeight:900, color:'#f1f5f9', marginBottom:4, letterSpacing:-0.5 }}>Sushi Ninja Cut</div>
          <div style={{ fontSize:12, color:'#64748b', marginBottom:14, lineHeight:1.6 }}>
            ⚔️ Arraste o dedo e corte os sushis<br/>
            ⭐ Sushi dourado vale <b style={{color:'#ffd700'}}>3 pts</b> e há combos!<br/>
            ❄️ Gelo = modo freeze • 💣 Bomba = game over
          </div>
          {best>0 && <div style={{fontSize:13,color:'#f97316',marginBottom:14,fontWeight:700}}>🏆 Recorde: {best} pts</div>}
          <button onClick={startGame} style={{
            background:'linear-gradient(135deg,#f97316,#dc2626)', border:'none',
            borderRadius:14, padding:'14px 40px', color:'#fff', fontWeight:900,
            fontSize:16, cursor:'pointer', boxShadow:'0 8px 28px rgba(249,115,22,0.5)',
            letterSpacing:0.5,
          }}>⚔️ Começar!</button>
        </div>
      )}

      {phase==='dead' && (
        <div style={{ textAlign:'center', padding:'4px 0' }}>
          <div style={{ fontSize:52, marginBottom:8 }}>{score>=60?'🏆':score>=30?'🥷':score>=15?'⚔️':'💣'}</div>
          <div style={{ fontSize:34, fontWeight:900, color:'#f97316', marginBottom:4 }}>{score} pts</div>
          {score>=best && score>0
            ? <div style={{fontSize:13,color:'#10b981',fontWeight:800,marginBottom:8}}>🎉 NOVO RECORDE!</div>
            : <div style={{fontSize:12,color:'#475569',marginBottom:8}}>Recorde: {best} pts</div>
          }
          <div style={{fontSize:13,color:'#94a3b8',marginBottom:18}}>
            {score>=60?'Lendário! Você é um Sushi Ninja Master! 🏆':
             score>=30?'Incrível! Mestre ninja! 🥷':
             score>=15?'Bom! Continue treinando! ⚔️':
             'A bomba te pegou! Revanche! 💣'}
          </div>
          <button onClick={startGame} style={{
            background:'rgba(249,115,22,0.15)', border:'1px solid rgba(249,115,22,0.4)',
            borderRadius:12, padding:'11px 30px', color:'#f97316',
            fontWeight:800, fontSize:14, cursor:'pointer',
          }}>🔄 Jogar de novo</button>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function AcompanharPedido() {
  const { id } = useParams();
  const [pedido, setPedido] = useState(null);
  const [erro, setErro]   = useState('');
  const [ultima, setUltima] = useState('');

  const carregar = async () => {
    try {
      const r = await fetch(`/api/cardapio/pedido/${id}/rastreio`);
      if (!r.ok) { setErro('Pedido não encontrado'); return; }
      setPedido(await r.json());
      setUltima(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch { setErro('Erro ao carregar'); }
  };

  useEffect(() => {
    carregar();
    const iv = setInterval(carregar, 7000);
    return () => clearInterval(iv);
  }, [id]);

  if (erro) return (
    <div style={{ minHeight:'100vh', background:'#070707', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
      <span style={{ fontSize: 48 }}>😕</span>
      <p style={{ color:'#64748b', fontSize:16 }}>{erro}</p>
    </div>
  );

  if (!pedido) return (
    <div style={{ minHeight:'100vh', background:'#070707', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontSize: 36, animation: 'spin 1s linear infinite' }}>🍣</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const st = STATUS[pedido.status] || STATUS.novo;
  const etapaAtual = ETAPAS.indexOf(pedido.status);
  const cancelado  = pedido.status === 'cancelado';
  const entregue   = pedido.status === 'entregue';
  const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div style={{ minHeight:'100vh', background:'#070707', fontFamily:'system-ui,sans-serif', color:'#f1f5f9', paddingBottom: 48 }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(160deg,#0f0f0f 0%,#1a0a00 100%)',
        borderBottom: '1px solid rgba(249,115,22,0.15)',
        padding: '28px 20px 20px', textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
          background: 'linear-gradient(135deg,#f97316,#ea580c)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, boxShadow: '0 8px 24px rgba(249,115,22,0.35)',
        }}>🍣</div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>37 Sushi</h1>
        <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: 13 }}>Paranavaí</p>
      </div>

      <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 16px' }}>

        {/* Card número + agradecimento */}
        <div style={{
          background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 20, padding: '20px', margin: '16px 0 12px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, color: '#475569', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Pedido</div>
          <div style={{ fontSize: 44, fontWeight: 900, color: '#f97316', lineHeight: 1 }}>#{pedido.numero}</div>
          <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 6 }}>
            Obrigado, <strong style={{ color: '#f1f5f9' }}>{pedido.cliente_nome}</strong>! 🙏
          </div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
            Seu pedido está sendo cuidado com carinho
          </div>
        </div>

        {/* Status atual */}
        <div style={{
          background: st.bg, border: `1.5px solid ${st.cor}`,
          borderRadius: 18, padding: '18px 16px', textAlign: 'center', marginBottom: 12,
        }}>
          <div style={{ fontSize: 40, marginBottom: 6, lineHeight: 1 }}>{st.emoji}</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: st.cor }}>{st.label}</div>
          {pedido.status === 'preparando' && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Nossos chefs estão preparando com cuidado 👨‍🍳</div>
          )}
          {pedido.status === 'pronto' && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Seu pedido está a caminho! 🛵💨</div>
          )}
          {entregue && (
            <div style={{ fontSize: 12, color: '#10b981', marginTop: 6, fontWeight: 600 }}>Bom apetite! Aproveite seu sushi! 🎉</div>
          )}
        </div>

        {/* Timeline */}
        {!cancelado && (
          <div style={{ background:'#0f0f0f', border:'1px solid rgba(255,255,255,0.06)', borderRadius:18, padding:'16px', marginBottom:12 }}>
            <div style={{ fontSize:11, color:'#475569', letterSpacing:2, textTransform:'uppercase', marginBottom:14 }}>Progresso</div>
            {ETAPAS.map((etapa, idx) => {
              const info   = STATUS[etapa];
              const feito  = etapaAtual >= idx;
              const atual  = etapaAtual === idx;
              const ultimo = idx === ETAPAS.length - 1;
              return (
                <div key={etapa} style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                    <div style={{
                      width:30, height:30, borderRadius:'50%', flexShrink:0,
                      background: feito ? info.cor : '#1e293b',
                      border: atual ? `2px solid ${info.cor}` : '2px solid transparent',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize: feito ? 14 : 16, fontWeight:800, color:'#fff',
                      boxShadow: atual ? `0 0 14px ${info.cor}66` : 'none',
                      transition:'all .4s',
                    }}>
                      {feito ? '✓' : <span style={{ fontSize:13, opacity:0.3 }}>○</span>}
                    </div>
                    {!ultimo && (
                      <div style={{ width:2, height:24, marginTop:2, background: feito && etapaAtual > idx ? info.cor : '#1e293b', transition:'all .4s' }} />
                    )}
                  </div>
                  <div style={{ paddingTop:5, paddingBottom: ultimo ? 0 : 12 }}>
                    <div style={{ fontSize:13, fontWeight: atual ? 700 : 500, color: feito ? '#f1f5f9' : '#334155' }}>
                      {info.emoji} {info.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Itens */}
        <div style={{ background:'#0f0f0f', border:'1px solid rgba(255,255,255,0.06)', borderRadius:18, padding:'16px', marginBottom:12 }}>
          <div style={{ fontSize:11, color:'#475569', letterSpacing:2, textTransform:'uppercase', marginBottom:12 }}>Seu pedido</div>
          {pedido.itens?.map((item, i) => (
            <div key={i} style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              padding:'7px 0', borderBottom: i < pedido.itens.length-1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <span style={{ color:'#cbd5e1', fontSize:13 }}><span style={{ color:'#f97316', fontWeight:700 }}>{item.quantidade}x</span> {item.item_nome}</span>
              <span style={{ color:'#64748b', fontSize:12 }}>{brl(item.quantidade * item.valor_unitario)}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:10, paddingTop:10, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontWeight:700, fontSize:14 }}>Total</span>
            <span style={{ fontWeight:800, color:'#10b981', fontSize:15 }}>{brl(pedido.total)}</span>
          </div>
        </div>

        {/* Jogo — sempre visível enquanto não cancelado */}
        {!cancelado && (
          <div style={{ background:'#0f0f0f', border:'1px solid rgba(249,115,22,0.2)', borderRadius:18, padding:'18px 16px', marginBottom:12 }}>
            <div style={{ fontSize:11, color:'#475569', letterSpacing:2, textTransform:'uppercase', marginBottom:4 }}>🎮 Mini jogo</div>
            <p style={{ fontSize:12, color:'#475569', marginBottom:12 }}>
              {entregue ? 'Seu pedido chegou! Bata seu recorde! 🏆' : 'Jogue enquanto seu pedido chega! 🍣'}
            </p>
            <SushiNinja />
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign:'center', color:'#334155', fontSize:11 }}>
          🔄 Atualizado às {ultima} · atualiza a cada 7s
        </div>
      </div>
    </div>
  );
}
