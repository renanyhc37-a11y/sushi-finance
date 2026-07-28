import React, { useState, useEffect } from 'react';
import { getToken } from '../../hooks/useAuth';
import {
  Trophy, TrendingUp, TrendingDown, AlertTriangle, Gift, Cake, Users,
  MessageCircle, Crown, Repeat, Star, Sparkles, MoonStar,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const SEGMENTO_CFG = {
  fiel:       { label: 'Fiel',       cor: '#f59e0b', Icon: Crown },
  recorrente: { label: 'Recorrente', cor: '#10b981', Icon: Repeat },
  regular:    { label: 'Regular',    cor: '#3b82f6', Icon: Star },
  novo:       { label: 'Novo',       cor: '#8b5cf6', Icon: Sparkles },
  em_risco:   { label: 'Em risco',   cor: '#f97316', Icon: TrendingDown },
  inativo:    { label: 'Inativo',    cor: '#6b7280', Icon: MoonStar },
};

function Card({ children, titulo, Icon, cor }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
      {titulo && (
        <h3 className="text-sm font-black mb-3 flex items-center gap-2" style={{ color: 'var(--cor-texto, #fff)' }}>
          {Icon && <Icon size={15} strokeWidth={1.75} style={{ color: cor || 'var(--accent)' }} />} {titulo}
        </h3>
      )}
      {children}
    </div>
  );
}

function ListaRanking({ itens, campo, formatador, onAbrirCliente }) {
  if (!itens.length) return <p className="text-xs text-center py-6" style={{ color: '#555' }}>Sem dados ainda</p>;
  return (
    <div className="space-y-1.5">
      {itens.map((c, i) => (
        <button key={c.id} onClick={() => onAbrirCliente(c.id)}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors hover:bg-white/[0.03]">
          <span className="w-5 text-[11px] font-black shrink-0" style={{ color: i < 3 ? '#f59e0b' : '#555' }}>{i + 1}º</span>
          <span className="flex-1 min-w-0 text-xs font-bold truncate" style={{ color: '#ddd' }}>{c.nome}</span>
          <span className="text-xs font-black shrink-0" style={{ color: 'var(--accent)' }}>{formatador(c[campo])}</span>
        </button>
      ))}
    </div>
  );
}

export default function VisaoGeralClientes({ onAbrirCliente }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/clientes/analise`, { headers: authH() })
      .then(r => r.ok ? r.json() : null).then(setDados).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-20 text-center text-zinc-600 animate-pulse">Carregando visão geral…</div>;
  if (!dados) return <div className="py-20 text-center text-zinc-600">Erro ao carregar</div>;

  const { rankings, saude, acao } = dados;
  const evolucaoChart = saude.evolucaoBase.map(e => ({
    mes: e.mes.slice(5, 7) + '/' + e.mes.slice(2, 4), novos: e.novos, ativos: e.ativos,
  }));
  const semHistorico = saude.totalClientes - saude.totalComPedido;

  return (
    <div className="space-y-4">
      {semHistorico > 0 && (
        <div className="rounded-xl px-4 py-2.5 text-xs" style={{ background: '#111', border: '1px solid #1a1a1a', color: '#888' }}>
          {semHistorico} de {saude.totalClientes} clientes ainda não têm pedido pelo cardápio novo (cadastro importado ou nunca pediu por aqui) —
          eles não aparecem nos rankings/segmentos até o primeiro pedido. Todos os {saude.totalClientes} cadastros estão em <b style={{ color: '#aaa' }}>Todos os Clientes</b>.
        </div>
      )}

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card titulo="Top 10 · Maior gasto" Icon={Trophy} cor="#f59e0b">
          <ListaRanking itens={rankings.porGasto} campo="total_gasto" formatador={brl} onAbrirCliente={onAbrirCliente} />
        </Card>
        <Card titulo="Top 10 · Mais pedidos" Icon={Repeat} cor="#10b981">
          <ListaRanking itens={rankings.porFrequencia} campo="total_pedidos" formatador={v => `${v}×`} onAbrirCliente={onAbrirCliente} />
        </Card>
        <Card titulo="Top 10 · Maior ticket médio" Icon={TrendingUp} cor="var(--accent)">
          <ListaRanking itens={rankings.porTicketMedio} campo="ticket_medio" formatador={brl} onAbrirCliente={onAbrirCliente} />
        </Card>
      </div>

      {/* Saúde da base */}
      <Card titulo="Saúde da base" Icon={Users}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          {Object.entries(SEGMENTO_CFG).map(([chave, cfg]) => {
            const s = saude.segmentos.find(x => x.segmento === chave);
            return (
              <div key={chave} className="rounded-xl p-2.5" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                <cfg.Icon size={14} strokeWidth={1.75} style={{ color: cfg.cor }} />
                <p className="text-lg font-black mt-1" style={{ color: '#fff' }}>{s?.qtd || 0}</p>
                <p className="text-[10px]" style={{ color: '#666' }}>{cfg.label}</p>
                <p className="text-[10px] font-bold" style={{ color: cfg.cor }}>{brl(s?.valor_total || 0)}</p>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] mb-2" style={{ color: '#666' }}>Clientes novos vs. ativos por mês (12 meses)</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={evolucaoChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, fontSize: 11 }} />
            <Line type="monotone" dataKey="novos" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Novos" />
            <Line type="monotone" dataKey="ativos" stroke="#10b981" strokeWidth={2} dot={false} name="Ativos" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Lista de ação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card titulo={`Em risco (${acao.emRisco.length})`} Icon={AlertTriangle} cor="#f97316">
          {acao.emRisco.length === 0 ? <p className="text-xs text-center py-6" style={{ color: '#555' }}>Nenhum</p> : (
            <div className="space-y-1.5">
              {acao.emRisco.slice(0, 8).map(c => (
                <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: '#0a0a0a' }}>
                  <button onClick={() => onAbrirCliente(c.id)} className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-bold truncate" style={{ color: '#ddd' }}>{c.nome}</p>
                    <p className="text-[10px]" style={{ color: '#666' }}>{brl(c.total_gasto)} · {c.dias_desde_ultimo}d sumido</p>
                  </button>
                  <a href={`https://wa.me/55${c.telefone}`} target="_blank" rel="noreferrer"
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(16,185,129,0.12)' }}>
                    <MessageCircle size={13} strokeWidth={1.75} style={{ color: '#10b981' }} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card titulo={`Aniversários (${acao.aniversariosProximos.length})`} Icon={Cake} cor="#ec4899">
          {acao.aniversariosProximos.length === 0 ? <p className="text-xs text-center py-6" style={{ color: '#555' }}>Nenhum nos próximos 30 dias</p> : (
            <div className="space-y-1.5">
              {acao.aniversariosProximos.slice(0, 8).map(a => (
                <button key={a.id} onClick={() => onAbrirCliente(a.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left" style={{ background: '#0a0a0a' }}>
                  <span className="text-xs font-bold truncate" style={{ color: '#ddd' }}>{a.nome}</span>
                  <span className="text-[10px] font-bold shrink-0" style={{ color: a.hoje ? '#ec4899' : '#666' }}>
                    {a.hoje ? 'HOJE' : a.data_label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
        <Card titulo={`Brindes parados (${acao.brindesParados.length})`} Icon={Gift} cor="#eab308">
          {acao.brindesParados.length === 0 ? <p className="text-xs text-center py-6" style={{ color: '#555' }}>Nenhum</p> : (
            <div className="space-y-1.5">
              {acao.brindesParados.slice(0, 8).map(c => (
                <button key={c.id} onClick={() => onAbrirCliente(c.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left" style={{ background: '#0a0a0a' }}>
                  <span className="text-xs font-bold truncate" style={{ color: '#ddd' }}>{c.nome}</span>
                  <span className="text-[10px] font-bold shrink-0" style={{ color: '#eab308' }}>{c.recompensas_disponiveis}×</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
