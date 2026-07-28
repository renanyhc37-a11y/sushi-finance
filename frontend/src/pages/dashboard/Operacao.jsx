import React, { useState, useEffect, useMemo } from 'react';
import { getToken } from '../../hooks/useAuth';
import { Clock, Activity, Flame } from 'lucide-react';
import { Card, CardHeader } from './_shared';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HORAS_VISIVEIS = Array.from({ length: 16 }, (_, i) => i + 8); // 08h–23h (janela de operação do delivery)

const STATUS_LABEL = {
  novo: 'Novo', espera: 'Aguardando', preparando: 'Em preparo', pronto: 'Pronto', entregue: 'Entregue',
};
const STATUS_COR = {
  novo: '#60a5fa', espera: '#60a5fa', preparando: 'var(--accent-2)', pronto: '#34d399', entregue: '#10b981',
};

function corCelula(valor, max) {
  if (!valor || max === 0) return 'var(--space-elev-2)';
  const intensidade = Math.min(1, valor / max);
  return `color-mix(in srgb, var(--accent) ${Math.round(intensidade * 85 + 10)}%, var(--space-elev-2))`;
}

export default function Operacao() {
  const [mapa, setMapa] = useState([]);
  const [pedidosAtivos, setPedidosAtivos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/relatorios/pico-semanal?dias=90`, { headers: authH() }).then(r => r.json()),
      fetch(`${BASE}/dashboard`, { headers: authH() }).then(r => r.json()),
    ]).then(([pico, dash]) => {
      setMapa(pico?.mapa || []);
      setPedidosAtivos(dash?.pedidos_ativos || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const grade = useMemo(() => {
    const lookup = new Map(mapa.map(m => [`${m.dow}-${m.hora}`, m.pedidos]));
    const max = mapa.reduce((m, x) => Math.max(m, x.pedidos), 0);
    return { lookup, max };
  }, [mapa]);

  const totalAtivos = pedidosAtivos.reduce((s, p) => s + p.qtd, 0);

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="text-sm flex items-center gap-2" style={{ color: 'var(--txt-dim)' }}>
        <Activity size={18} strokeWidth={1.75} style={{ color: 'var(--accent)' }} className="animate-pulse" /> Carregando…
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--txt-strong)' }}>
        <Clock size={16} strokeWidth={1.75} style={{ color: 'var(--accent)' }} /> Pulso da operação
      </h2>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--txt-strong)' }}>
            <Flame size={14} strokeWidth={1.75} style={{ color: 'var(--accent)' }} /> Horário de pico (últimos 90 dias)
          </h3>
          <span className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>só pedidos reais do PDV</span>
        </div>
        {mapa.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--txt-faint)' }}>Sem pedidos suficientes no período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-separate" style={{ borderSpacing: 3 }}>
              <thead>
                <tr>
                  <th></th>
                  {HORAS_VISIVEIS.map(h => (
                    <th key={h} className="text-[9px] font-normal px-0.5" style={{ color: 'var(--txt-faint)' }}>{h}h</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DIAS.map((dia, dow) => (
                  <tr key={dia}>
                    <td className="text-[10px] font-bold pr-2 text-right" style={{ color: 'var(--txt-dim)' }}>{dia}</td>
                    {HORAS_VISIVEIS.map(h => {
                      const valor = grade.lookup.get(`${dow}-${h}`) || 0;
                      return (
                        <td key={h} title={`${dia} ${h}h — ${valor} pedidos`}
                          className="w-6 h-6 rounded-md" style={{ background: corCelula(valor, grade.max) }} />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <CardHeader title="Pedidos ativos agora" cor="var(--accent)" />
        <div className="p-3">
          {totalAtivos === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--txt-faint)' }}>Nenhum pedido em andamento agora</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {pedidosAtivos.map(p => (
                <div key={p.status} className="rounded-xl p-3 text-center" style={{ background: 'var(--space-elev-2)' }}>
                  <p className="text-2xl font-black" style={{ color: STATUS_COR[p.status] || 'var(--txt-strong)' }}>{p.qtd}</p>
                  <p className="text-[10px] font-bold uppercase mt-0.5" style={{ color: 'var(--txt-dim)' }}>{STATUS_LABEL[p.status] || p.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
