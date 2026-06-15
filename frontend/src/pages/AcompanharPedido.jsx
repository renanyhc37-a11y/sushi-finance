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

// ── Jogo: Sushi Clicker ───────────────────────────────────────
function SushiClicker() {
  const [score, setScore] = useState(0);
  const [clicks, setClicks] = useState([]);
  const [best, setBest] = useState(() => Number(localStorage.getItem('sushi_best') || 0));
  const [timeLeft, setTimeLeft] = useState(15);
  const [started, setStarted] = useState(false);
  const [ended, setEnded] = useState(false);
  const timerRef = useRef(null);
  const idRef = useRef(0);

  const start = () => { setScore(0); setTimeLeft(15); setEnded(false); setStarted(true); };

  useEffect(() => {
    if (!started || ended) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); setEnded(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [started, ended]);

  useEffect(() => {
    if (ended && score > best) { setBest(score); localStorage.setItem('sushi_best', score); }
  }, [ended]);

  const handleClick = useCallback((e) => {
    if (!started || ended) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = ++idRef.current;
    setScore(s => s + 1);
    setClicks(c => [...c, { id, x, y }]);
    setTimeout(() => setClicks(c => c.filter(cl => cl.id !== id)), 600);
  }, [started, ended]);

  const emojis = ['🍣', '🍱', '🥢', '🐟', '🦐', '🌊'];
  const pct = (timeLeft / 15) * 100;

  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
        Enquanto seu pedido chegou, que tal bater um recorde?
      </p>

      {!started && !ended && (
        <button onClick={start} style={{
          background: 'linear-gradient(135deg,#f97316,#fb923c)',
          border: 'none', borderRadius: 14, padding: '14px 32px',
          color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(249,115,22,0.4)', letterSpacing: 0.5,
        }}>
          🎮 Jogar agora!
        </button>
      )}

      {started && !ended && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>⏱ {timeLeft}s</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#f97316' }}>{score} pts</span>
          </div>
          {/* barra de tempo */}
          <div style={{ height: 6, background: '#1e293b', borderRadius: 99, marginBottom: 16, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99, transition: 'width 1s linear',
              width: `${pct}%`,
              background: pct > 50 ? '#10b981' : pct > 25 ? '#f97316' : '#ef4444',
            }} />
          </div>
          {/* área de clique */}
          <div onClick={handleClick} style={{
            position: 'relative', height: 180, borderRadius: 20, cursor: 'pointer',
            background: 'rgba(249,115,22,0.06)', border: '2px dashed rgba(249,115,22,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            userSelect: 'none', overflow: 'hidden',
          }}>
            <span style={{ fontSize: 64, pointerEvents: 'none' }}>🍣</span>
            <span style={{ position: 'absolute', bottom: 10, fontSize: 12, color: '#64748b' }}>Toque o sushi!</span>
            {clicks.map(cl => (
              <span key={cl.id} style={{
                position: 'absolute', left: cl.x, top: cl.y,
                fontSize: 22, pointerEvents: 'none',
                animation: 'floatUp 0.6s ease-out forwards',
                transform: 'translate(-50%,-50%)',
              }}>
                {emojis[cl.id % emojis.length]}
              </span>
            ))}
          </div>
        </div>
      )}

      {ended && (
        <div>
          <div style={{ fontSize: 52, marginBottom: 8 }}>{score >= 30 ? '🏆' : score >= 15 ? '🥈' : '🍣'}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#f97316', marginBottom: 4 }}>{score} pts</div>
          {score >= best && score > 0 && (
            <div style={{ fontSize: 13, color: '#10b981', fontWeight: 700, marginBottom: 8 }}>🎉 Novo recorde!</div>
          )}
          {score < best && (
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>Recorde: {best} pts</div>
          )}
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16 }}>
            {score >= 30 ? 'Incrível! Você é mestre do sushi! 🏆' :
             score >= 15 ? 'Muito bom! Continue treinando! 💪' :
             'Tente de novo, você consegue mais! 🍣'}
          </div>
          <button onClick={start} style={{
            background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)',
            borderRadius: 12, padding: '10px 24px', color: '#f97316',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}>
            🔄 Jogar de novo
          </button>
        </div>
      )}

      <style>{`
        @keyframes floatUp {
          0%   { opacity:1; transform: translate(-50%,-50%) scale(1.2); }
          100% { opacity:0; transform: translate(-50%,-120%) scale(0.8); }
        }
      `}</style>
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

        {/* Jogo — aparece quando entregue */}
        {entregue && (
          <div style={{ background:'#0f0f0f', border:'1px solid rgba(249,115,22,0.2)', borderRadius:18, padding:'18px 16px', marginBottom:12 }}>
            <div style={{ fontSize:11, color:'#475569', letterSpacing:2, textTransform:'uppercase', marginBottom:12 }}>🎮 Mini jogo</div>
            <SushiClicker />
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
