import React, { useState, useEffect, useCallback } from 'react';
import { getToken } from '../hooks/useAuth';
import toast, { Toaster } from 'react-hot-toast';
import {
  Coins, Search, RefreshCw, Settings, PlusCircle, History,
  Trophy, TrendingUp, Users, X, ChevronDown, ChevronUp, ToggleLeft, ToggleRight
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '/api';
const H = () => ({ Authorization: `Bearer ${getToken()}` });
const J = () => ({ ...H(), 'Content-Type': 'application/json' });

function fmt(v) { return `R$ ${Number(v || 0).toFixed(2)}`; }

export default function Cashback() {
  const [aba, setAba] = useState('ranking');
  const [config, setConfig] = useState({ percentual: 5, minimo_resgate: 10, ativo: 1 });
  const [salvandoCfg, setSalvandoCfg] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [busca, setBusca] = useState('');
  const [expandido, setExpandido] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [modalCredito, setModalCredito] = useState(null);
  const [creditoForm, setCreditoForm] = useState({ telefone: '', nome: '', valor: '', descricao: '' });
  const [consultaTel, setConsultaTel] = useState('');
  const [consultaResult, setConsultaResult] = useState(null);

  const carregarConfig = useCallback(async () => {
    const r = await fetch(`${BASE}/cashback/config`, { headers: H() });
    if (r.ok) setConfig(await r.json());
  }, []);

  const carregarClientes = useCallback(async () => {
    const r = await fetch(`${BASE}/cashback/todos?busca=${encodeURIComponent(busca)}`, { headers: H() });
    if (r.ok) setClientes(await r.json());
  }, [busca]);

  useEffect(() => { carregarConfig(); }, [carregarConfig]);
  useEffect(() => { carregarClientes(); }, [carregarClientes]);

  async function salvarConfig() {
    setSalvandoCfg(true);
    const r = await fetch(`${BASE}/cashback/config`, { method: 'PUT', headers: J(), body: JSON.stringify(config) });
    if (r.ok) { setConfig(await r.json()); toast.success('Configuração salva!'); }
    else toast.error('Erro ao salvar');
    setSalvandoCfg(false);
  }

  async function abrirHistorico(tel) {
    if (expandido === tel) { setExpandido(null); return; }
    setExpandido(tel);
    const r = await fetch(`${BASE}/cashback/historico/${tel}`, { headers: H() });
    if (r.ok) setHistorico(await r.json());
  }

  async function creditar() {
    const { telefone, nome, valor, descricao } = creditoForm;
    if (!telefone || !valor) return toast.error('Preencha telefone e valor');
    const r = await fetch(`${BASE}/cashback/creditar`, { method: 'POST', headers: J(), body: JSON.stringify({ telefone, nome, valor: parseFloat(valor), descricao }) });
    const d = await r.json();
    if (d.ok) { toast.success('Cashback creditado!'); setModalCredito(false); setCreditoForm({ telefone: '', nome: '', valor: '', descricao: '' }); carregarClientes(); }
    else toast.error(d.erro || 'Erro');
  }

  async function consultarSaldo() {
    if (!consultaTel.trim()) return;
    const r = await fetch(`${BASE}/cashback/saldo/${consultaTel.replace(/\D/g, '')}`, { headers: H() });
    if (r.ok) setConsultaResult(await r.json());
    else toast.error('Erro ao consultar');
  }

  const stats = {
    total_clientes: clientes.length,
    total_saldo: clientes.reduce((a, c) => a + (c.saldo || 0), 0),
    total_ganho: clientes.reduce((a, c) => a + (c.total_ganho || 0), 0),
    total_usado: clientes.reduce((a, c) => a + (c.total_usado || 0), 0),
  };

  const tipoColor = { ganho: '#22c55e', usado: '#f59e0b', manual: '#3b82f6', estorno: '#ef4444' };
  const tipoLabel = { ganho: 'Ganho', usado: 'Usado', manual: 'Manual', estorno: 'Estorno' };

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'system-ui,sans-serif' }}>
      <Toaster position="top-right" />

      {/* Header */}
      <div style={{ background: '#1e293b', borderBottom: '1px solid #334155', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Coins size={22} style={{ color: '#f59e0b' }} />
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>Cashback</h1>
          <span style={{ padding: '2px 8px', borderRadius: 12, background: config.ativo ? '#16a34a20' : '#ef444420', color: config.ativo ? '#4ade80' : '#f87171', fontSize: 11, fontWeight: 700 }}>
            {config.ativo ? 'ATIVO' : 'PAUSADO'}
          </span>
        </div>
        <button onClick={() => setModalCredito(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#f59e0b', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
          <PlusCircle size={15} /> Creditar manual
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, padding: '20px 24px 0' }}>
        {[
          { label: 'Clientes com saldo', val: stats.total_clientes, icon: Users, color: '#3b82f6' },
          { label: 'Saldo em circulação', val: fmt(stats.total_saldo), icon: Coins, color: '#f59e0b' },
          { label: 'Total distribuído', val: fmt(stats.total_ganho), icon: TrendingUp, color: '#22c55e' },
          { label: 'Total resgatado', val: fmt(stats.total_usado), icon: Trophy, color: '#a855f7' },
        ].map(s => (
          <div key={s.label} style={{ background: '#1e293b', borderRadius: 12, padding: '16px', border: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <s.icon size={16} style={{ color: s.color }} />
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{s.label.toUpperCase()}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '16px 24px 0' }}>
        {[['ranking', 'Clientes'], ['consulta', 'Consultar saldo'], ['config', 'Configurações']].map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: aba === id ? '#f59e0b' : '#1e293b',
            color: aba === id ? '#000' : '#94a3b8',
            border: aba === id ? 'none' : '1px solid #334155',
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: '16px 24px 32px' }}>

        {/* ── RANKING / CLIENTES ── */}
        {aba === 'ranking' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone"
                  style={{ width: '100%', padding: '9px 12px 9px 32px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none' }} />
              </div>
              <button onClick={carregarClientes} style={{ padding: '9px 12px', background: '#1e293b', border: '1px solid #334155', borderRadius: 8, cursor: 'pointer', color: '#94a3b8' }}>
                <RefreshCw size={16} />
              </button>
            </div>

            {clientes.length === 0 && (
              <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>
                <Coins size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
                <p>Nenhum cliente com cashback ainda</p>
                <p style={{ fontSize: 12 }}>O saldo é creditado automaticamente quando um pedido é entregue</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {clientes.map((c, i) => (
                <div key={c.id} style={{ background: '#1e293b', borderRadius: 10, border: '1px solid #334155', overflow: 'hidden' }}>
                  <div onClick={() => abrirHistorico(c.telefone)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: i < 3 ? ['#f59e0b','#94a3b8','#b45309'][i] + '30' : '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: i < 3 ? ['#f59e0b','#94a3b8','#b45309'][i] : '#64748b', flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome || c.telefone}</div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>{c.telefone} · Ganhou {fmt(c.total_ganho)} · Usou {fmt(c.total_usado)}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: c.saldo > 0 ? '#f59e0b' : '#64748b' }}>{fmt(c.saldo)}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>saldo disponível</div>
                    </div>
                    {expandido === c.telefone ? <ChevronUp size={16} style={{ color: '#64748b', flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: '#64748b', flexShrink: 0 }} />}
                  </div>

                  {expandido === c.telefone && (
                    <div style={{ borderTop: '1px solid #334155', padding: '12px 16px', background: '#0f172a' }}>
                      <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 8 }}>HISTÓRICO</div>
                      {historico.length === 0 && <p style={{ color: '#64748b', fontSize: 13 }}>Sem transações</p>}
                      {historico.map(t => (
                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #1e293b' }}>
                          <div>
                            <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, background: `${tipoColor[t.tipo]}20`, color: tipoColor[t.tipo], fontWeight: 700, marginRight: 8 }}>{tipoLabel[t.tipo]}</span>
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>{t.descricao}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: ['ganho','manual'].includes(t.tipo) ? '#22c55e' : '#f87171' }}>
                              {['ganho','manual'].includes(t.tipo) ? '+' : '-'}{fmt(t.valor)}
                            </div>
                            <div style={{ fontSize: 10, color: '#64748b' }}>{new Date(t.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CONSULTAR SALDO ── */}
        {aba === 'consulta' && (
          <div style={{ maxWidth: 480 }}>
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, border: '1px solid #334155', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginBottom: 10 }}>CONSULTAR SALDO POR TELEFONE</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={consultaTel} onChange={e => setConsultaTel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && consultarSaldo()}
                  placeholder="Ex: 44999887766"
                  style={{ flex: 1, padding: '10px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none' }} />
                <button onClick={consultarSaldo} style={{ padding: '10px 16px', background: '#f59e0b', color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>Consultar</button>
              </div>
            </div>

            {consultaResult && (
              <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, border: '1px solid #334155' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>{consultaResult.nome || 'Sem nome'}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{consultaResult.telefone || consultaTel}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>{fmt(consultaResult.saldo)}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>saldo disponível</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Total ganho</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>{fmt(consultaResult.total_ganho)}</div>
                  </div>
                  <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>Total usado</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#a855f7' }}>{fmt(consultaResult.total_usado)}</div>
                  </div>
                </div>
                {consultaResult.saldo < consultaResult.config?.minimo_resgate && (
                  <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: '#1a1200', border: '1px solid #3a2800', color: '#fbbf24', fontSize: 12 }}>
                    Mínimo para resgatar: {fmt(consultaResult.config.minimo_resgate)} — faltam {fmt(consultaResult.config.minimo_resgate - consultaResult.saldo)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── CONFIGURAÇÕES ── */}
        {aba === 'config' && (
          <div style={{ maxWidth: 480 }}>
            <div style={{ background: '#1e293b', borderRadius: 12, padding: 20, border: '1px solid #334155', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 15 }}>Cashback ativo</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Clientes ganham cashback em pedidos entregues</div>
                </div>
                <button onClick={() => setConfig(p => ({ ...p, ativo: p.ativo ? 0 : 1 }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: config.ativo ? '#22c55e' : '#64748b' }}>
                  {config.ativo ? <ToggleRight size={36} /> : <ToggleLeft size={36} />}
                </button>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  PERCENTUAL DE CASHBACK: <span style={{ color: '#f59e0b', fontSize: 16, fontWeight: 800 }}>{config.percentual}%</span>
                </label>
                <input type="range" min={1} max={20} step={0.5} value={config.percentual}
                  onChange={e => setConfig(p => ({ ...p, percentual: parseFloat(e.target.value) }))}
                  style={{ width: '100%', accentColor: '#f59e0b' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginTop: 2 }}>
                  <span>1%</span><span>10%</span><span>20%</span>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  VALOR MÍNIMO PARA RESGATAR
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#64748b', fontSize: 14 }}>R$</span>
                  <input type="number" min={0} step={0.5} value={config.minimo_resgate}
                    onChange={e => setConfig(p => ({ ...p, minimo_resgate: parseFloat(e.target.value) }))}
                    style={{ flex: 1, padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none' }} />
                </div>
              </div>

              <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                💡 Com as configurações atuais: a cada <strong style={{ color: '#f1f5f9' }}>R$100</strong> em pedidos, o cliente ganha <strong style={{ color: '#f59e0b' }}>R${config.percentual.toFixed(2)}</strong> de cashback.
                O cliente pode resgatar ao acumular <strong style={{ color: '#f59e0b' }}>R${config.minimo_resgate.toFixed(2)}</strong>.
              </div>

              <button onClick={salvarConfig} disabled={salvandoCfg} style={{ width: '100%', padding: '12px', borderRadius: 8, fontWeight: 700, fontSize: 14, background: salvandoCfg ? '#334155' : '#f59e0b', color: salvandoCfg ? '#64748b' : '#000', border: 'none', cursor: 'pointer' }}>
                {salvandoCfg ? 'Salvando...' : 'Salvar configurações'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal crédito manual */}
      {modalCredito && (
        <div onClick={() => setModalCredito(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 400, background: '#1e293b', borderRadius: 16, padding: 24, border: '1px solid #334155', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                <PlusCircle size={18} style={{ color: '#f59e0b' }} /> Creditar cashback
              </div>
              <button onClick={() => setModalCredito(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
            </div>
            {[
              { key: 'telefone', label: 'TELEFONE', placeholder: '44999887766' },
              { key: 'nome', label: 'NOME (opcional)', placeholder: 'Nome do cliente' },
              { key: 'valor', label: 'VALOR (R$)', placeholder: '0.00', type: 'number' },
              { key: 'descricao', label: 'DESCRIÇÃO (opcional)', placeholder: 'Ex: Cortesia aniversário' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input type={f.type || 'text'} value={creditoForm[f.key]} onChange={e => setCreditoForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  style={{ width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
            <button onClick={creditar} style={{ width: '100%', padding: '12px', borderRadius: 8, fontWeight: 700, fontSize: 14, background: '#f59e0b', color: '#000', border: 'none', cursor: 'pointer', marginTop: 8 }}>
              Creditar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
