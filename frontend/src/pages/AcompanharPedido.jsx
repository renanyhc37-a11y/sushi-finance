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
const SUSHIS = ['🍣','🍱','🥟','🦐','🐟','🍙','🌊'];
const BOMBS  = ['💣'];

function SushiNinja() {
  const canvasRef  = useRef(null);
  const stateRef   = useRef({ running: false, pieces: [], blade: [], particles: [], score: 0, lives: 3, spawnTimer: 0, spawnInterval: 80, frame: 0 });
  const rafRef     = useRef(null);
  const phaseRef   = useRef('idle');
  const [ui, setUi] = useState({ phase: 'idle', score: 0, lives: 3, best: Number(localStorage.getItem('sninja_best') || 0) });

  const spawnPiece = (W, H) => {
    const isBomb = Math.random() < 0.12;
    return {
      x: W * 0.1 + Math.random() * W * 0.8, y: H + 10,
      vy: -(11 + Math.random() * 6), vx: (Math.random() - 0.5) * 3,
      rot: Math.random() * 360, rotV: (Math.random() - 0.5) * 6,
      emoji: isBomb ? BOMBS[0] : SUSHIS[Math.floor(Math.random() * SUSHIS.length)],
      r: 28, isBomb, sliced: false, alpha: 1,
    };
  };

  const endGame = useCallback((finalScore) => {
    cancelAnimationFrame(rafRef.current);
    stateRef.current.running = false;
    phaseRef.current = 'dead';
    const best = Number(localStorage.getItem('sninja_best') || 0);
    const newBest = finalScore > best ? finalScore : best;
    if (finalScore > best) localStorage.setItem('sninja_best', finalScore);
    setUi({ phase: 'dead', score: finalScore, lives: 0, best: newBest });
  }, []);

  const startGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    cancelAnimationFrame(rafRef.current);

    const W = canvas.width, H = canvas.height;
    const s = stateRef.current;
    s.running = true; s.pieces = []; s.blade = []; s.particles = [];
    s.score = 0; s.lives = 3; s.spawnTimer = 0; s.spawnInterval = 80; s.frame = 0;
    phaseRef.current = 'playing';
    setUi(u => ({ ...u, phase: 'playing', score: 0, lives: 3 }));

    const ctx = canvas.getContext('2d');
    const G = 0.38;

    const loop = () => {
      if (!s.running) return;
      s.frame++;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, W, H);

      // grid
      ctx.strokeStyle = 'rgba(249,115,22,0.05)'; ctx.lineWidth = 1;
      for (let i = 0; i < W; i += 44) { ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,H); ctx.stroke(); }
      for (let i = 0; i < H; i += 44) { ctx.beginPath(); ctx.moveTo(0,i); ctx.lineTo(W,i); ctx.stroke(); }

      // spawn
      s.spawnTimer++;
      if (s.spawnTimer >= s.spawnInterval) {
        s.spawnTimer = 0;
        s.pieces.push(spawnPiece(W, H));
        if (s.spawnInterval > 38) s.spawnInterval -= 0.25;
      }

      // física
      s.pieces = s.pieces.filter(p => p.alpha > 0.04);
      for (const p of s.pieces) {
        if (!p.sliced) {
          p.vy += G; p.x += p.vx; p.y += p.vy; p.rot += p.rotV;
          if (p.y > H + 60) {
            if (!p.isBomb) {
              s.lives = Math.max(0, s.lives - 1);
              setUi(u => ({ ...u, lives: s.lives }));
              if (s.lives <= 0) { endGame(s.score); return; }
            }
            p.alpha = 0;
          }
        } else { p.alpha -= 0.06; }
      }

      // draw pieces
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const p of s.pieces) {
        if (p.alpha <= 0) continue;
        ctx.save(); ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
        ctx.font = '40px serif'; ctx.fillText(p.emoji, 0, 0);
        ctx.restore();
      }

      // partículas
      s.particles = s.particles.filter(p => p.life > 0);
      for (const p of s.particles) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.25; p.life--;
        ctx.save(); ctx.globalAlpha = p.life / 18;
        ctx.font = '20px serif'; ctx.textAlign = 'center';
        ctx.fillText(p.emoji, p.x, p.y); ctx.restore();
      }

      // lâmina
      if (s.blade.length > 1) {
        ctx.save();
        const grad = ctx.createLinearGradient(s.blade[0].x, s.blade[0].y, s.blade[s.blade.length-1].x, s.blade[s.blade.length-1].y);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(1, 'rgba(255,200,100,0.9)');
        ctx.strokeStyle = grad; ctx.lineWidth = 3;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.shadowColor = '#f97316'; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.moveTo(s.blade[0].x, s.blade[0].y);
        for (let i = 1; i < s.blade.length; i++) ctx.lineTo(s.blade[i].x, s.blade[i].y);
        ctx.stroke(); ctx.restore();
        s.blade = s.blade.slice(-12);
      }

      // HUD score
      ctx.save();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 24px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.shadowColor = '#f97316'; ctx.shadowBlur = 8;
      ctx.fillText(s.score, 12, 10); ctx.restore();
      // HUD vidas
      ctx.font = '18px serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText('❤️'.repeat(Math.max(0, s.lives)), W - 8, 10);

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [endGame]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const r = canvas.getBoundingClientRect();
    const sx = canvas.width / r.width, sy = canvas.height / r.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - r.left) * sx, y: (src.clientY - r.top) * sy };
  };

  const onMove = useCallback((e) => {
    e.preventDefault();
    if (phaseRef.current !== 'playing') return;
    const pos = getPos(e);
    if (!pos) return;
    const s = stateRef.current;
    s.blade.push(pos);
    for (const p of s.pieces) {
      if (p.sliced || p.alpha <= 0) continue;
      const dx = pos.x - p.x, dy = pos.y - p.y;
      if (Math.sqrt(dx*dx + dy*dy) < p.r + 12) {
        if (p.isBomb) { endGame(s.score); return; }
        p.sliced = true; s.score++;
        setUi(u => ({ ...u, score: s.score }));
        for (let i = 0; i < 5; i++) s.particles.push({
          x: p.x, y: p.y, vx: (Math.random()-0.5)*5, vy: -Math.random()*5, emoji: p.emoji, life: 18,
        });
      }
    }
  }, [endGame]);

  const { phase, score, lives, best } = ui;

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      {/* canvas sempre montado */}
      <canvas
        ref={canvasRef} width={340} height={360}
        style={{ width: '100%', borderRadius: 16, touchAction: 'none', display: phase === 'playing' ? 'block' : 'none', cursor: 'crosshair' }}
        onMouseMove={onMove} onTouchMove={onMove}
      />

      {/* overlay idle */}
      {phase === 'idle' && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🥷</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', marginBottom: 4 }}>Sushi Ninja Cut</div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>Arraste o dedo para cortar os sushis!<br/>Cuidado com as bombas 💣</div>
          {best > 0 && <div style={{ fontSize: 12, color: '#f97316', marginBottom: 14 }}>🏆 Recorde: {best} pts</div>}
          <button onClick={startGame} style={{
            background: 'linear-gradient(135deg,#f97316,#ea580c)', border: 'none',
            borderRadius: 14, padding: '13px 36px', color: '#fff',
            fontWeight: 800, fontSize: 15, cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(249,115,22,0.4)',
          }}>⚔️ Jogar agora!</button>
        </div>
      )}

      {/* overlay game over */}
      {phase === 'dead' && (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>{score >= 40 ? '🏆' : score >= 20 ? '🥷' : '💣'}</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#f97316', marginBottom: 4 }}>{score} pts</div>
          {score >= best && score > 0
            ? <div style={{ fontSize: 13, color: '#10b981', fontWeight: 700, marginBottom: 8 }}>🎉 Novo recorde!</div>
            : <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>Recorde: {best} pts</div>
          }
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
            {score >= 40 ? 'Mestre ninja! 🥷🏆' : score >= 20 ? 'Muito bom! Tente mais! ⚔️' : 'A bomba te pegou! 💣'}
          </div>
          <button onClick={startGame} style={{
            background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)',
            borderRadius: 12, padding: '10px 28px', color: '#f97316',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
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
