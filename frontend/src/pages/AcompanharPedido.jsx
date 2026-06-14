import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

// Status reais gravados pelo PDV: novo, preparando, pronto, entregue, cancelado.
// (Precisam casar exatamente, senão a timeline não avança quando o operador
//  muda o status do pedido.)
const STATUS_LABELS = {
  novo:        { label: 'Aguardando confirmação', emoji: '⏳', cor: '#f97316' },
  preparando:  { label: 'Em preparo',             emoji: '🍣', cor: '#3b82f6' },
  pronto:      { label: 'Saiu para entrega',      emoji: '🛵', cor: '#8b5cf6' },
  entregue:    { label: 'Entregue!',              emoji: '🎉', cor: '#10b981' },
  cancelado:   { label: 'Cancelado',              emoji: '❌', cor: '#ef4444' },
};

const ETAPAS = ['novo', 'preparando', 'pronto', 'entregue'];

export default function AcompanharPedido() {
  const { id } = useParams();
  const [pedido, setPedido] = useState(null);
  const [erro, setErro] = useState('');
  const [ultima, setUltima] = useState('');

  const carregar = async () => {
    try {
      const r = await fetch(`/api/cardapio/pedido/${id}/rastreio`);
      if (!r.ok) { setErro('Pedido não encontrado'); return; }
      const data = await r.json();
      setPedido(data);
      setUltima(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } catch { setErro('Erro ao carregar pedido'); }
  };

  useEffect(() => {
    carregar();
    const iv = setInterval(carregar, 7000);
    return () => clearInterval(iv);
  }, [id]);

  if (erro) return (
    <div style={{ minHeight:'100vh', background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16, color:'#fff' }}>
      <span style={{ fontSize:48 }}>😕</span>
      <p style={{ color:'#94a3b8', fontSize:18 }}>{erro}</p>
    </div>
  );

  if (!pedido) return (
    <div style={{ minHeight:'100vh', background:'#0f172a', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#94a3b8', fontSize:18 }}>Carregando...</div>
    </div>
  );

  const statusInfo = STATUS_LABELS[pedido.status] || STATUS_LABELS.novo;
  const etapaAtual = ETAPAS.indexOf(pedido.status);
  const cancelado = pedido.status === 'cancelado';

  return (
    <div style={{ minHeight:'100vh', background:'#0f172a', fontFamily:'system-ui,sans-serif', color:'#fff', padding:'0 0 40px' }}>
      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#1e1b4b,#312e81)', padding:'32px 20px 24px', textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:8 }}>🍣</div>
        <h1 style={{ margin:0, fontSize:22, fontWeight:700 }}>Sushi Control</h1>
        <p style={{ margin:'4px 0 0', color:'#a5b4fc', fontSize:14 }}>Acompanhe seu pedido</p>
      </div>

      <div style={{ maxWidth:480, margin:'0 auto', padding:'0 16px' }}>
        {/* Número do Pedido */}
        <div style={{ background:'#1e293b', borderRadius:16, padding:'20px', margin:'20px 0 16px', textAlign:'center' }}>
          <div style={{ color:'#64748b', fontSize:13, marginBottom:4 }}>Pedido nº</div>
          <div style={{ fontSize:40, fontWeight:800, color:'#f1f5f9' }}>#{pedido.numero}</div>
          <div style={{ color:'#64748b', fontSize:12, marginTop:4 }}>
            {pedido.cliente_nome}
          </div>
        </div>

        {/* Status atual */}
        <div style={{
          background: cancelado ? '#1a0a0a' : '#0f1a2e',
          border: `2px solid ${statusInfo.cor}`,
          borderRadius: 16,
          padding: '24px 20px',
          textAlign: 'center',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 52, marginBottom: 8 }}>{statusInfo.emoji}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: statusInfo.cor }}>{statusInfo.label}</div>
          {pedido.status === 'pronto' && (
            <div style={{ color:'#94a3b8', fontSize:13, marginTop:8 }}>
              Seu pedido está a caminho! 🛵
            </div>
          )}
        </div>

        {/* Timeline */}
        {!cancelado && (
          <div style={{ background:'#1e293b', borderRadius:16, padding:'20px', marginBottom:16 }}>
            <div style={{ fontSize:13, color:'#64748b', marginBottom:16, textTransform:'uppercase', letterSpacing:1 }}>Progresso</div>
            {ETAPAS.map((etapa, idx) => {
              const info = STATUS_LABELS[etapa];
              const feito = etapaAtual >= idx;
              const atual = etapaAtual === idx;
              return (
                <div key={etapa} style={{ display:'flex', alignItems:'flex-start', gap:12, marginBottom: idx < ETAPAS.length-1 ? 0 : 0 }}>
                  {/* Bolinha + linha */}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius:'50%',
                      background: feito ? info.cor : '#334155',
                      border: atual ? `3px solid ${info.cor}` : '2px solid transparent',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize: 16, transition:'all .3s',
                      boxShadow: atual ? `0 0 12px ${info.cor}88` : 'none',
                    }}>
                      {feito ? '✓' : ''}
                    </div>
                    {idx < ETAPAS.length - 1 && (
                      <div style={{ width:2, height:28, background: feito && etapaAtual > idx ? info.cor : '#334155', transition:'all .3s' }} />
                    )}
                  </div>
                  {/* Texto */}
                  <div style={{ paddingTop:5, paddingBottom: idx < ETAPAS.length-1 ? 16 : 0 }}>
                    <div style={{ fontSize:14, fontWeight: atual ? 700 : 500, color: feito ? '#f1f5f9' : '#475569' }}>
                      {info.emoji} {info.label}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Itens do pedido */}
        <div style={{ background:'#1e293b', borderRadius:16, padding:'20px', marginBottom:16 }}>
          <div style={{ fontSize:13, color:'#64748b', marginBottom:12, textTransform:'uppercase', letterSpacing:1 }}>Seu pedido</div>
          {pedido.itens?.map((item, i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom: i < pedido.itens.length-1 ? '1px solid #2d3748' : 'none' }}>
              <span style={{ color:'#cbd5e1', fontSize:14 }}>{item.quantidade}x {item.item_nome}</span>
              <span style={{ color:'#94a3b8', fontSize:13 }}>
                R$ {(item.quantidade * item.valor_unitario).toFixed(2).replace('.',',')}
              </span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:12, paddingTop:12, borderTop:'1px solid #2d3748' }}>
            <span style={{ fontWeight:700 }}>Total</span>
            <span style={{ fontWeight:700, color:'#10b981', fontSize:16 }}>
              R$ {Number(pedido.total).toFixed(2).replace('.',',')}
            </span>
          </div>
        </div>

        {/* Última atualização */}
        <div style={{ textAlign:'center', color:'#475569', fontSize:12 }}>
          🔄 Atualizado às {ultima} · atualiza automaticamente
        </div>
      </div>
    </div>
  );
}
