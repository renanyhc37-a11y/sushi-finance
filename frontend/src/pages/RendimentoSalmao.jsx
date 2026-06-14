import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import ConfirmDialog from '../components/ConfirmDialog';
import { brl } from '../lib/fmt';

const PCT_OPCOES = [65, 70, 75];

const FORM_VAZIO = {
  data: new Date().toISOString().slice(0, 10),
  fornecedor: '',
  peso_bruto: '',
  valor_total: '',
  peso_liquido: '',
  observacao: '',
  ingrediente_id: '',
};

function calcular(peso_bruto, valor_total, peso_liquido) {
  const pb = parseFloat(peso_bruto);
  const vt = parseFloat(valor_total);
  const pl = parseFloat(peso_liquido);
  if (!pb || !vt || !pl || pb <= 0 || pl <= 0) return null;
  const rendimento_pct = (pl / pb) * 100;
  return {
    rendimento_pct,
    perda_pct: 100 - rendimento_pct,
    custo_kg_bruto: vt / pb,
    custo_kg_limpo: vt / pl,
  };
}

export default function RendimentoSalmao() {
  const qc = useQueryClient();
  const [modo, setModo] = useState('real');
  const [pctEstimado, setPctEstimado] = useState(70);
  const [pctCustom, setPctCustom] = useState('');
  const [form, setForm] = useState(FORM_VAZIO);
  const [aba, setAba] = useState('novo'); // 'novo' | 'historico'
  const [confirmDel, setConfirmDel] = useState(null);

  const { data: historico = [] } = useQuery({
    queryKey: ['rendimento'],
    queryFn: () => api.get('/rendimento'),
  });

  const { data: dash } = useQuery({
    queryKey: ['rendimento-dashboard'],
    queryFn: () => api.get('/rendimento/dashboard'),
  });

  const { data: evolucao = [] } = useQuery({
    queryKey: ['rendimento-evolucao'],
    queryFn: () => api.get('/rendimento/evolucao'),
  });

  const { data: ingredientes = [] } = useQuery({
    queryKey: ['ingredientes'],
    queryFn: () => api.get('/ingredientes'),
  });

  // Ingredientes filtrados (salmão, atum, peixe, frutos do mar)
  const ingredientesSalmao = useMemo(() =>
    ingredientes.filter(i =>
      /salm|atum|peix|tuna|fruto|mar|bluefin/i.test(i.nome)
    ),
    [ingredientes]
  );

  // Calcula peso líquido no modo estimativa
  const pctAtivo = pctCustom ? parseFloat(pctCustom) : pctEstimado;
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const pesoLiquidoEfetivo = useMemo(() => {
    if (modo === 'real') return form.peso_liquido;
    const pb = parseFloat(form.peso_bruto);
    if (!pb || !pctAtivo) return '';
    return (pb * pctAtivo / 100).toFixed(3);
  }, [modo, form.peso_bruto, pctAtivo, form.peso_liquido]);

  const preview = useMemo(() =>
    calcular(form.peso_bruto, form.valor_total, pesoLiquidoEfetivo),
    [form.peso_bruto, form.valor_total, pesoLiquidoEfetivo]
  );

  const alertaCor = (pct) => {
    if (pct >= 70) return { cor: '#22c55e', bg: 'rgba(34,197,94,0.08)', borda: 'rgba(34,197,94,0.3)', emoji: '🟢', texto: 'Ótimo rendimento!' };
    if (pct >= 65) return { cor: 'var(--accent-2)', bg: 'rgba(245,158,11,0.08)', borda: 'rgba(245,158,11,0.3)', emoji: '🟡', texto: 'Rendimento regular' };
    return { cor: '#ef4444', bg: 'rgba(239,68,68,0.08)', borda: 'rgba(239,68,68,0.3)', emoji: '🔴', texto: 'Rendimento abaixo do esperado!' };
  };

  const registrar = useMutation({
    mutationFn: (dados) => api.post('/rendimento', dados),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['rendimento'] });
      qc.invalidateQueries({ queryKey: ['rendimento-dashboard'] });
      qc.invalidateQueries({ queryKey: ['rendimento-evolucao'] });
      qc.invalidateQueries({ queryKey: ['ingredientes'] });
      const alerta = alertaCor(data.rendimento_pct);
      toast.success(`Lote registrado! Rendimento: ${data.rendimento_pct.toFixed(1)}% ${alerta.emoji}`);
      setForm(FORM_VAZIO);
      setAba('historico');
    },
    onError: (e) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: (id) => api.del(`/rendimento/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rendimento'] });
      qc.invalidateQueries({ queryKey: ['rendimento-dashboard'] });
      qc.invalidateQueries({ queryKey: ['rendimento-evolucao'] });
      toast.success('Registro removido.');
      setConfirmDel(null);
    },
    onError: (e) => toast.error(e.message),
  });

  function handleSubmit(e) {
    e.preventDefault();
    registrar.mutate({
      ...form,
      peso_liquido: parseFloat(pesoLiquidoEfetivo),
      modo,
      percentual_estimado: modo === 'estimativa' ? pctAtivo : null,
      ingrediente_id: form.ingrediente_id ? parseInt(form.ingrediente_id) : null,
    });
  }

  const stats = dash?.ultimos30;
  const ultimo = dash?.ultimo;
  const alertaUltimo = ultimo ? alertaCor(ultimo.rendimento_pct) : null;

  const chartData = evolucao.map(e => ({
    label: e.mes.slice(5) + '/' + e.mes.slice(2, 4),
    rendimento: parseFloat(e.media_rendimento?.toFixed(1) ?? 0),
    custo: parseFloat(e.media_custo_kg_limpo?.toFixed(2) ?? 0),
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            🐟 Rendimento do Salmão
          </h1>
          <p className="page-subtitle">Controle de lotes, custo real do filé limpo e evolução</p>
        </div>
        <div className="flex gap-2">
          <TabBtn ativo={aba === 'novo'} onClick={() => setAba('novo')}>+ Novo Lote</TabBtn>
          <TabBtn ativo={aba === 'historico'} onClick={() => setAba('historico')}>
            Histórico {historico.length > 0 && `(${historico.length})`}
          </TabBtn>
        </div>
      </div>

      {/* Alerta do último lote */}
      {alertaUltimo && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 text-sm"
          style={{ background: alertaUltimo.bg, border: `1px solid ${alertaUltimo.borda}` }}>
          <span className="text-base">{alertaUltimo.emoji}</span>
          <span style={{ color: alertaUltimo.cor }}>
            <strong>Último lote ({fmtData(ultimo.data)}):</strong>{' '}
            {alertaUltimo.texto} — {ultimo.rendimento_pct.toFixed(1)}% de rendimento,
            custo do kg limpo: <strong>{brl(ultimo.custo_kg_limpo)}</strong>
            {ultimo.fornecedor ? ` · ${ultimo.fornecedor}` : ''}
          </span>
        </div>
      )}

      {/* Dashboard mini-cards */}
      {stats && stats.total_registros > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MiniCard label="Média Rendimento" valor={`${stats.media_rendimento?.toFixed(1)}%`}
            sub="últimos 30 dias" cor={alertaCor(stats.media_rendimento ?? 0).cor} />
          <MiniCard label="Melhor" valor={`${stats.melhor_rendimento?.toFixed(1)}%`}
            sub="registrado" cor="#22c55e" />
          <MiniCard label="Pior" valor={`${stats.pior_rendimento?.toFixed(1)}%`}
            sub="registrado" cor="#ef4444" />
          <MiniCard label="Total Processado" valor={`${stats.total_processado_kg?.toFixed(1)} kg`}
            sub="peso líquido" cor="var(--accent)" />
          <MiniCard label="Custo Médio/kg" valor={brl(stats.custo_medio_kg_limpo)}
            sub="filé limpo" cor="#3b82f6" />
        </div>
      )}

      {/* ── ABA: Novo Lote ── */}
      {aba === 'novo' && (
        <div className="grid lg:grid-cols-2 gap-5">

          {/* Formulário */}
          <div className="rounded-2xl p-5 space-y-5"
            style={{ background: '#111', border: '1px solid #1e1e1e' }}>

            {/* Toggle modo */}
            <div>
              <p className="text-xs font-bold tracking-widest mb-3" style={{ color: '#555' }}>MODO DE CÁLCULO</p>
              <div className="flex gap-2">
                <ModoBtn ativo={modo === 'real'} onClick={() => setModo('real')}>
                  ⚖️ Pesagem Real
                </ModoBtn>
                <ModoBtn ativo={modo === 'estimativa'} onClick={() => setModo('estimativa')}>
                  ⚡ Estimativa Rápida
                </ModoBtn>
              </div>
              {modo === 'estimativa' && (
                <p className="text-xs mt-2" style={{ color: '#555' }}>
                  Peso líquido calculado automaticamente com base no percentual de rendimento estimado.
                </p>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Data e Fornecedor */}
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Data" required>
                  <input type="date" value={form.data} onChange={set('data')}
                    className="input" required />
                </Campo>
                <Campo label="Fornecedor">
                  <input value={form.fornecedor} onChange={set('fornecedor')}
                    placeholder="Ex: Peixaria Central" className="input" />
                </Campo>
              </div>

              {/* Peso bruto e valor */}
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Peso Bruto da Caixa (kg)" required>
                  <input type="number" step="0.001" min="0.001" value={form.peso_bruto}
                    onChange={set('peso_bruto')} placeholder="Ex: 30" className="input" required />
                </Campo>
                <Campo label="Valor Total Pago (R$)" required>
                  <input type="number" step="0.01" min="0.01" value={form.valor_total}
                    onChange={set('valor_total')} placeholder="Ex: 2000" className="input" required />
                </Campo>
              </div>

              {/* Peso líquido (modo real) ou estimativa */}
              {modo === 'real' ? (
                <Campo label="Peso Líquido Após Limpeza (kg)" required>
                  <input type="number" step="0.001" min="0.001" value={form.peso_liquido}
                    onChange={set('peso_liquido')} placeholder="Ex: 21" className="input" required />
                </Campo>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-wider" style={{ color: '#555' }}>
                    PERCENTUAL DE RENDIMENTO ESTIMADO
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {PCT_OPCOES.map(p => (
                      <button key={p} type="button"
                        onClick={() => { setPctEstimado(p); setPctCustom(''); }}
                        className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
                        style={{
                          background: pctEstimado === p && !pctCustom ? 'linear-gradient(135deg,var(--accent),var(--accent-2))' : '#1a1a1a',
                          color: pctEstimado === p && !pctCustom ? '#000' : '#888',
                          border: pctEstimado === p && !pctCustom ? 'none' : '1px solid #2a2a2a',
                        }}>
                        {p}%
                      </button>
                    ))}
                    <div className="flex items-center gap-2">
                      <input
                        type="number" min="1" max="100" step="0.1"
                        value={pctCustom}
                        onChange={e => setPctCustom(e.target.value)}
                        placeholder="Outro %"
                        className="w-24 px-3 py-2 rounded-xl text-sm outline-none"
                        style={{
                          background: '#0a0a0a',
                          border: pctCustom ? '1px solid var(--accent)' : '1px solid #2a2a2a',
                          color: '#e5e5e5',
                        }}
                      />
                    </div>
                  </div>
                  {pesoLiquidoEfetivo && (
                    <p className="text-xs" style={{ color: '#666' }}>
                      Peso líquido estimado:{' '}
                      <strong style={{ color: 'var(--accent)' }}>{parseFloat(pesoLiquidoEfetivo).toFixed(2)} kg</strong>
                    </p>
                  )}
                </div>
              )}

              {/* Vincular ingrediente */}
              <Campo label="Atualizar custo do ingrediente (opcional)">
                <select value={form.ingrediente_id} onChange={set('ingrediente_id')} className="input">
                  <option value="">— Não atualizar —</option>
                  {ingredientesSalmao.length > 0 && (
                    <optgroup label="🐟 Sugeridos">
                      {ingredientesSalmao.map(i => (
                        <option key={i.id} value={i.id}>{i.nome} ({i.unidade_medida})</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Todos os ingredientes">
                    {ingredientes
                      .filter(i => !ingredientesSalmao.find(s => s.id === i.id))
                      .map(i => (
                        <option key={i.id} value={i.id}>{i.nome} ({i.unidade_medida})</option>
                      ))}
                  </optgroup>
                </select>
                {form.ingrediente_id && (
                  <p className="text-xs mt-1" style={{ color: '#555' }}>
                    ✅ Custo e estoque do ingrediente serão atualizados automaticamente ao salvar.
                  </p>
                )}
              </Campo>

              <Campo label="Observação">
                <input value={form.observacao} onChange={set('observacao')}
                  placeholder="Ex: Lote fora do padrão, gelo excessivo..." className="input" />
              </Campo>

              <button type="submit" disabled={registrar.isPending || !preview}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: !preview || registrar.isPending
                    ? '#1a1a1a'
                    : 'linear-gradient(135deg,var(--accent),var(--accent-2))',
                  color: !preview || registrar.isPending ? '#444' : '#000',
                  cursor: !preview ? 'not-allowed' : 'pointer',
                }}>
                {registrar.isPending ? 'Registrando...' : '✅ Registrar Lote'}
              </button>
            </form>
          </div>

          {/* Preview dos cálculos */}
          <div className="space-y-4">
            <PreviewCalculo preview={preview} pesoLiquido={pesoLiquidoEfetivo} modo={modo} />

            {/* Gráfico de evolução */}
            {chartData.length >= 2 && (
              <div className="rounded-2xl p-5"
                style={{ background: '#111', border: '1px solid #1e1e1e' }}>
                <p className="text-xs font-bold tracking-widest mb-4" style={{ color: '#555' }}>
                  EVOLUÇÃO MENSAL
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="pct" tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false}
                      tickFormatter={v => `${v}%`} domain={[50, 100]} />
                    <YAxis yAxisId="custo" orientation="right" tick={{ fontSize: 10, fill: '#555' }} axisLine={false} tickLine={false}
                      tickFormatter={v => `R$${v}`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: '#666' }} />
                    <ReferenceLine yAxisId="pct" y={70} stroke="#22c55e" strokeDasharray="4 2" strokeOpacity={0.4} />
                    <ReferenceLine yAxisId="pct" y={65} stroke="var(--accent-2)" strokeDasharray="4 2" strokeOpacity={0.4} />
                    <Line yAxisId="pct" type="monotone" dataKey="rendimento" name="Rendimento (%)"
                      stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)' }} />
                    <Line yAxisId="custo" type="monotone" dataKey="custo" name="Custo/kg limpo (R$)"
                      stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} strokeDasharray="4 2" />
                  </LineChart>
                </ResponsiveContainer>
                <div className="flex gap-4 mt-2 text-[10px]" style={{ color: '#444' }}>
                  <span>— <span style={{ color: '#22c55e' }}>70%</span> meta ótima</span>
                  <span>— <span style={{ color: 'var(--accent-2)' }}>65%</span> limite aceitável</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ABA: Histórico ── */}
      {aba === 'historico' && (
        <div className="space-y-5">
          {/* Gráfico */}
          {chartData.length >= 2 && (
            <div className="rounded-2xl p-5"
              style={{ background: '#111', border: '1px solid #1e1e1e' }}>
              <p className="text-xs font-bold tracking-widest mb-4" style={{ color: '#555' }}>
                EVOLUÇÃO MENSAL — RENDIMENTO E CUSTO DO KG LIMPO
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#555' }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="pct" tick={{ fontSize: 11, fill: '#555' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `${v}%`} domain={[50, 100]} />
                  <YAxis yAxisId="custo" orientation="right" tick={{ fontSize: 11, fill: '#555' }} axisLine={false} tickLine={false}
                    tickFormatter={v => `R$${v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#666' }} />
                  <ReferenceLine yAxisId="pct" y={70} stroke="#22c55e" strokeDasharray="4 2" strokeOpacity={0.4} />
                  <ReferenceLine yAxisId="pct" y={65} stroke="var(--accent-2)" strokeDasharray="4 2" strokeOpacity={0.4} />
                  <Line yAxisId="pct" type="monotone" dataKey="rendimento" name="Rendimento (%)"
                    stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 4, fill: 'var(--accent)' }} />
                  <Line yAxisId="custo" type="monotone" dataKey="custo" name="Custo/kg limpo (R$)"
                    stroke="#3b82f6" strokeWidth={2} dot={{ r: 3, fill: '#3b82f6' }} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabela */}
          {historico.length === 0 ? (
            <div className="rounded-2xl p-12 text-center"
              style={{ background: '#111', border: '1px solid #1e1e1e' }}>
              <p className="text-4xl mb-3">🐟</p>
              <p className="font-semibold" style={{ color: '#555' }}>Nenhum lote registrado ainda</p>
              <p className="text-sm mt-1" style={{ color: '#333' }}>
                Vá para "Novo Lote" e registre o primeiro processamento.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: '#111', border: '1px solid #1e1e1e' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: '#0a0a0a', borderBottom: '1px solid #1e1e1e' }}>
                      {['Data', 'Fornecedor', 'Bruto', 'Líquido', 'Rendimento', 'Custo/kg bruto', 'Custo/kg limpo', 'Modo', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#555' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {historico.map((r, i) => {
                      const alerta = alertaCor(r.rendimento_pct);
                      return (
                        <tr key={r.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                          <td className="px-4 py-3 font-medium" style={{ color: '#aaa' }}>{fmtData(r.data)}</td>
                          <td className="px-4 py-3" style={{ color: '#888' }}>{r.fornecedor || '—'}</td>
                          <td className="px-4 py-3 font-mono" style={{ color: '#888' }}>{r.peso_bruto} kg</td>
                          <td className="px-4 py-3 font-mono" style={{ color: '#aaa' }}>{r.peso_liquido.toFixed(2)} kg</td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5 font-bold font-mono"
                              style={{ color: alerta.cor }}>
                              {alerta.emoji} {r.rendimento_pct.toFixed(1)}%
                            </span>
                            <span className="text-xs" style={{ color: '#444' }}>
                              perda: {r.perda_pct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono" style={{ color: '#888' }}>{brl(r.custo_kg_bruto)}</td>
                          <td className="px-4 py-3 font-mono font-semibold" style={{ color: '#e5e5e5' }}>{brl(r.custo_kg_limpo)}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                background: r.modo === 'real' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                                color: r.modo === 'real' ? '#22c55e' : 'var(--accent-2)',
                                border: `1px solid ${r.modo === 'real' ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.3)'}`,
                              }}>
                              {r.modo === 'real' ? '⚖️ Real' : '⚡ Est.'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => setConfirmDel(r)}
                              className="text-xs px-2 py-1 rounded-lg transition-all"
                              style={{ color: '#555' }}
                              onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                              onMouseLeave={e => e.currentTarget.style.color = '#555'}>
                              🗑️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {confirmDel && (
        <ConfirmDialog
          titulo="Remover registro?"
          mensagem={`Lote de ${confirmDel.peso_bruto} kg em ${fmtData(confirmDel.data)} será removido permanentemente.`}
          onConfirm={() => excluir.mutate(confirmDel.id)}
          onCancel={() => setConfirmDel(null)}
          loading={excluir.isPending}
        />
      )}
    </div>
  );
}

/* ── Componentes auxiliares ── */

function PreviewCalculo({ preview, pesoLiquido, modo }) {
  if (!preview) {
    return (
      <div className="rounded-2xl p-6 flex flex-col items-center justify-center gap-2"
        style={{ background: '#111', border: '1px solid #1e1e1e', minHeight: 200 }}>
        <span className="text-3xl opacity-30">🧮</span>
        <p className="text-sm" style={{ color: '#444' }}>
          Preencha os campos para ver o cálculo em tempo real
        </p>
      </div>
    );
  }

  const alerta = alertaCor(preview.rendimento_pct);

  return (
    <div className="rounded-2xl p-5 space-y-4"
      style={{ background: '#111', border: `1px solid ${alerta.borda}` }}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{alerta.emoji}</span>
        <p className="font-bold" style={{ color: alerta.cor }}>{alerta.texto}</p>
        {modo === 'estimativa' && (
          <span className="text-xs ml-auto px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--accent-2)', border: '1px solid rgba(245,158,11,0.3)' }}>
            Estimativa
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ResultCard label="Rendimento" valor={`${preview.rendimento_pct.toFixed(2)}%`} cor={alerta.cor} grande />
        <ResultCard label="Perda" valor={`${preview.perda_pct.toFixed(2)}%`} cor="#ef4444" grande />
        <ResultCard label="Custo/kg bruto" valor={brl(preview.custo_kg_bruto)} cor="#888" />
        <ResultCard label="Custo/kg limpo" valor={brl(preview.custo_kg_limpo)} cor="var(--accent)" destaque />
      </div>

      {pesoLiquido && (
        <p className="text-xs text-center" style={{ color: '#444' }}>
          Peso líquido {modo === 'estimativa' ? 'estimado' : 'informado'}:{' '}
          <strong style={{ color: '#888' }}>{parseFloat(pesoLiquido).toFixed(2)} kg</strong>
        </p>
      )}
    </div>
  );
}

function alertaCor(pct) {
  if (pct >= 70) return { cor: '#22c55e', bg: 'rgba(34,197,94,0.08)', borda: 'rgba(34,197,94,0.3)', emoji: '🟢', texto: 'Ótimo rendimento!' };
  if (pct >= 65) return { cor: 'var(--accent-2)', bg: 'rgba(245,158,11,0.08)', borda: 'rgba(245,158,11,0.3)', emoji: '🟡', texto: 'Rendimento regular' };
  return { cor: '#ef4444', bg: 'rgba(239,68,68,0.08)', borda: 'rgba(239,68,68,0.3)', emoji: '🔴', texto: 'Rendimento abaixo do esperado!' };
}

function ResultCard({ label, valor, cor, grande, destaque }) {
  return (
    <div className="rounded-xl p-3"
      style={{
        background: destaque ? 'rgba(var(--accent-rgb),0.06)' : '#0a0a0a',
        border: destaque ? '1px solid rgba(var(--accent-rgb),0.3)' : '1px solid #1e1e1e',
      }}>
      <p className="text-[10px] font-semibold tracking-wider mb-1" style={{ color: '#444' }}>
        {label.toUpperCase()}
      </p>
      <p className={`font-black font-mono ${grande ? 'text-2xl' : 'text-base'}`} style={{ color: cor }}>
        {valor}
      </p>
    </div>
  );
}

function MiniCard({ label, valor, sub, cor }) {
  return (
    <div className="rounded-2xl p-4 space-y-1"
      style={{ background: '#111', border: '1px solid #1e1e1e' }}>
      <p className="text-[10px] font-bold tracking-widest" style={{ color: '#444' }}>
        {label.toUpperCase()}
      </p>
      <p className="text-xl font-black font-mono" style={{ color: cor }}>{valor}</p>
      {sub && <p className="text-[10px]" style={{ color: '#333' }}>{sub}</p>}
    </div>
  );
}

function Campo({ label, required, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold tracking-wider" style={{ color: '#555' }}>
        {label.toUpperCase()} {required && <span style={{ color: 'var(--accent)' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function ModoBtn({ ativo, onClick, children }) {
  return (
    <button type="button" onClick={onClick}
      className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
      style={{
        background: ativo ? 'linear-gradient(135deg,var(--accent),var(--accent-2))' : '#1a1a1a',
        color: ativo ? '#000' : '#666',
        border: ativo ? 'none' : '1px solid #2a2a2a',
      }}>
      {children}
    </button>
  );
}

function TabBtn({ ativo, onClick, children }) {
  return (
    <button onClick={onClick}
      className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
      style={{
        background: ativo ? 'linear-gradient(135deg,var(--accent),var(--accent-2))' : '#111',
        color: ativo ? '#000' : '#666',
        border: ativo ? 'none' : '1px solid #2a2a2a',
      }}>
      {children}
    </button>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="text-xs rounded-xl p-3 shadow-xl"
      style={{ background: '#111', border: '1px solid #2a2a2a', color: '#e5e5e5' }}>
      <p className="font-semibold mb-1" style={{ color: 'var(--accent)' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: <strong>{p.dataKey === 'rendimento' ? `${p.value}%` : brl(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

function fmtData(data) {
  if (!data) return '';
  const [y, m, d] = data.split('-');
  return `${d}/${m}/${y}`;
}
