import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import SushiNinja from '../components/SushiNinja';

const STATUS = {
  novo:       { label: 'Confirmando pedido', emoji: '⏳', cor: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  preparando: { label: 'Em preparo',          emoji: '🍣', cor: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  pronto:     { label: 'Saiu para entrega',   emoji: '🛵', cor: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
  entregue:   { label: 'Entregue!',           emoji: '🎉', cor: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  cancelado:  { label: 'Cancelado',           emoji: '❌', cor: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
};
const ETAPAS = ['novo', 'preparando', 'pronto', 'entregue'];

export default function AcompanharPedido() {
  const { id } = useParams();
  const [pedido, setPedido] = useState(null);
  const [erro, setErro]     = useState('');
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

  const st       = STATUS[pedido.status] || STATUS.novo;
  const etapaAtual = ETAPAS.indexOf(pedido.status);
  const cancelado  = pedido.status === 'cancelado';
  const entregue   = pedido.status === 'entregue';
  const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div style={{ minHeight:'100vh', background:'#070707', fontFamily:'system-ui,sans-serif', color:'#f1f5f9', paddingBottom: 48 }}>

      {/* Header */}
      <div style={{ background:'linear-gradient(160deg,#0f0f0f 0%,#1a0a00 100%)', borderBottom:'1px solid rgba(249,115,22,0.15)', padding:'28px 20px 20px', textAlign:'center' }}>
        <div style={{ width:56, height:56, borderRadius:16, margin:'0 auto 12px', background:'linear-gradient(135deg,#f97316,#ea580c)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, boxShadow:'0 8px 24px rgba(249,115,22,0.35)' }}>🍣</div>
        <h1 style={{ margin:0, fontSize:20, fontWeight:800, letterSpacing:-0.5 }}>37 Sushi</h1>
        <p style={{ margin:'3px 0 0', color:'#64748b', fontSize:13 }}>Paranavaí</p>
      </div>

      <div style={{ maxWidth:440, margin:'0 auto', padding:'0 16px' }}>

        {/* Número + agradecimento */}
        <div style={{ background:'#0f0f0f', border:'1px solid rgba(255,255,255,0.06)', borderRadius:20, padding:'20px', margin:'16px 0 12px', textAlign:'center' }}>
          <div style={{ fontSize:11, color:'#475569', letterSpacing:2, textTransform:'uppercase', marginBottom:6 }}>Pedido</div>
          <div style={{ fontSize:44, fontWeight:900, color:'#f97316', lineHeight:1 }}>#{pedido.numero}</div>
          <div style={{ fontSize:14, color:'#94a3b8', marginTop:6 }}>Obrigado, <strong style={{ color:'#f1f5f9' }}>{pedido.cliente_nome}</strong>! 🙏</div>
          <div style={{ fontSize:12, color:'#475569', marginTop:4 }}>Seu pedido está sendo cuidado com carinho</div>
        </div>

        {/* Status */}
        <div style={{ background:st.bg, border:`1.5px solid ${st.cor}`, borderRadius:18, padding:'18px 16px', textAlign:'center', marginBottom:12 }}>
          <div style={{ fontSize:40, marginBottom:6, lineHeight:1 }}>{st.emoji}</div>
          <div style={{ fontSize:18, fontWeight:800, color:st.cor }}>{st.label}</div>
          {pedido.status==='preparando' && <div style={{ fontSize:12, color:'#64748b', marginTop:6 }}>Nossos chefs estão preparando com cuidado 👨‍🍳</div>}
          {pedido.status==='pronto'     && <div style={{ fontSize:12, color:'#64748b', marginTop:6 }}>Seu pedido está a caminho! 🛵💨</div>}
          {entregue                     && <div style={{ fontSize:12, color:'#10b981', marginTop:6, fontWeight:600 }}>Bom apetite! Aproveite seu sushi! 🎉</div>}
        </div>

        {/* Timeline */}
        {!cancelado && (
          <div style={{ background:'#0f0f0f', border:'1px solid rgba(255,255,255,0.06)', borderRadius:18, padding:'16px', marginBottom:12 }}>
            <div style={{ fontSize:11, color:'#475569', letterSpacing:2, textTransform:'uppercase', marginBottom:14 }}>Progresso</div>
            {ETAPAS.map((etapa, idx) => {
              const info = STATUS[etapa];
              const feito = etapaAtual >= idx, atual = etapaAtual === idx, ultimo = idx === ETAPAS.length-1;
              return (
                <div key={etapa} style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                    <div style={{ width:30, height:30, borderRadius:'50%', background:feito?info.cor:'#1e293b', border:atual?`2px solid ${info.cor}`:'2px solid transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'#fff', boxShadow:atual?`0 0 14px ${info.cor}66`:'none', transition:'all .4s' }}>
                      {feito ? '✓' : <span style={{ fontSize:13, opacity:0.3 }}>○</span>}
                    </div>
                    {!ultimo && <div style={{ width:2, height:24, marginTop:2, background:feito&&etapaAtual>idx?info.cor:'#1e293b', transition:'all .4s' }} />}
                  </div>
                  <div style={{ paddingTop:5, paddingBottom:ultimo?0:12 }}>
                    <div style={{ fontSize:13, fontWeight:atual?700:500, color:feito?'#f1f5f9':'#334155' }}>{info.emoji} {info.label}</div>
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
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:i<pedido.itens.length-1?'1px solid rgba(255,255,255,0.04)':'none' }}>
              <span style={{ color:'#cbd5e1', fontSize:13 }}><span style={{ color:'#f97316', fontWeight:700 }}>{item.quantidade}x</span> {item.item_nome}</span>
              <span style={{ color:'#64748b', fontSize:12 }}>{brl(item.quantidade*item.valor_unitario)}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:10, paddingTop:10, borderTop:'1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontWeight:700, fontSize:14 }}>Total</span>
            <span style={{ fontWeight:800, color:'#10b981', fontSize:15 }}>{brl(pedido.total)}</span>
          </div>
        </div>

        {/* Jogo */}
        {!cancelado && (
          <div style={{ background:'#0f0f0f', border:'1px solid rgba(249,115,22,0.2)', borderRadius:18, padding:'18px 16px', marginBottom:12 }}>
            <div style={{ fontSize:11, color:'#475569', letterSpacing:2, textTransform:'uppercase', marginBottom:4 }}>🎮 Sushi Ninja</div>
            <p style={{ fontSize:12, color:'#475569', marginBottom:12 }}>
              {entregue ? 'Pedido chegou! Bata seu recorde! 🏆' : 'Jogue enquanto aguarda! 🍣'}
            </p>
            <SushiNinja />
          </div>
        )}

        <div style={{ textAlign:'center', color:'#334155', fontSize:11 }}>
          🔄 Atualizado às {ultima} · atualiza a cada 7s
        </div>
      </div>
    </div>
  );
}
