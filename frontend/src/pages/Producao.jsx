import React, { useState, useEffect, useCallback } from 'react';
import { getToken } from '../hooks/useAuth';
import {
  ChefHat, RefreshCw, Boxes, TrendingUp, AlertTriangle, Sparkles, UtensilsCrossed,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const fmt = (n, u) => `${Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${u || ''}`.trim();

export default function Producao() {
  const [dia, setDia] = useState(new Date().getDay());
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/producao/sugestao?dia=${dia}`, { headers: authH() });
      setDados(await r.json());
    } catch {} finally { setLoading(false); }
  }, [dia]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5" style={{ color: 'var(--txt-strong)' }}>
            <ChefHat size={24} strokeWidth={1.75} style={{ color: 'var(--accent)' }} /> Sugestão de Produção
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--txt-dim)' }}>Quanto preparar, com base no histórico de vendas + fichas técnicas</p>
        </div>
        <button onClick={carregar} className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: 'var(--space-elev)', color: 'var(--txt-dim)', border: '1px solid var(--hairline)' }}>
          <RefreshCw size={16} strokeWidth={1.75} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Seletor de dia */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {DIAS.map((d, i) => (
          <button key={i} onClick={() => setDia(i)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all"
            style={{
              background: dia === i ? 'rgba(var(--accent-rgb),0.15)' : 'var(--space-elev)',
              color: dia === i ? 'var(--accent)' : 'var(--txt-dim)',
              border: `1px solid ${dia === i ? 'rgba(var(--accent-rgb),0.35)' : 'var(--hairline)'}`,
            }}>
            {d}
          </button>
        ))}
      </div>

      {!dados ? null : !dados.tem_dados ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
          <p className="flex justify-center mb-3" style={{ color: 'var(--txt-faint)' }}><Sparkles size={34} strokeWidth={1.5} /></p>
          <p className="text-sm" style={{ color: 'var(--txt-dim)' }}>Ainda não há vendas suficientes de {DIAS[dia].toLowerCase()}-feira para sugerir produção.</p>
          <p className="text-xs mt-1" style={{ color: 'var(--txt-faint)' }}>Conforme os pedidos forem entrando, a sugestão fica mais precisa.</p>
        </div>
      ) : (
        <>
          {/* Ingredientes a preparar */}
          <div>
            <h2 className="text-[13px] font-bold tracking-[0.12em] uppercase mb-3 flex items-center gap-2" style={{ color: 'var(--txt-dim)' }}>
              <Boxes size={14} strokeWidth={1.75} /> Ingredientes para preparar — {dados.dia_nome}
            </h2>
            {dados.ingredientes.length === 0 ? (
              <div className="rounded-2xl p-5 text-sm" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)', color: 'var(--txt-dim)' }}>
                Cadastre as fichas técnicas dos itens (Cardápio → Ficha) para ver os ingredientes aqui.
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                {dados.ingredientes.map((ing, i) => (
                  <div key={ing.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? '1px solid var(--hairline)' : 'none' }}>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate" style={{ color: 'var(--txt-strong)' }}>{ing.nome}</p>
                      {ing.estoque_atual != null && (
                        <p className="text-[11px]" style={{ color: 'var(--txt-dim)' }}>em estoque: {fmt(ing.estoque_atual, ing.unidade)}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-black" style={{ color: 'var(--accent)' }}>{fmt(ing.qtd, ing.unidade)}</p>
                      {ing.falta > 0 && (
                        <p className="text-[11px] font-bold flex items-center justify-end gap-1" style={{ color: '#f87171' }}>
                          <AlertTriangle size={11} strokeWidth={2} /> faltam {fmt(ing.falta, ing.unidade)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Itens esperados */}
          <div>
            <h2 className="text-[13px] font-bold tracking-[0.12em] uppercase mb-3 flex items-center gap-2" style={{ color: 'var(--txt-dim)' }}>
              <TrendingUp size={14} strokeWidth={1.75} /> Demanda esperada (média por {dados.dia_nome.toLowerCase()})
            </h2>
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
              {dados.itens.map((it, i) => (
                <div key={it.nome} className="flex items-center gap-3 px-4 py-2.5" style={{ borderTop: i ? '1px solid var(--hairline)' : 'none' }}>
                  <UtensilsCrossed size={14} strokeWidth={1.75} style={{ color: 'var(--txt-dim)' }} className="shrink-0" />
                  <span className="flex-1 text-sm truncate" style={{ color: 'var(--txt)' }}>{it.nome}</span>
                  <span className="text-xs" style={{ color: 'var(--txt-dim)' }}>~{it.media}/dia</span>
                  <span className="font-black text-sm w-12 text-right" style={{ color: 'var(--txt-strong)' }}>{it.sugestao}x</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] mt-2" style={{ color: 'var(--txt-faint)' }}>Sugestão = média arredondada para cima dos últimos 60 dias nesse dia da semana.</p>
          </div>
        </>
      )}
    </div>
  );
}
