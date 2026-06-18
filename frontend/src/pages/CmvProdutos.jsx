import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, TrendingUp, Pencil, Plus, Trash2, X, Save } from 'lucide-react';
import { api } from '../api/client';
import { mesAtual } from '../lib/fmt';
import { PageLoading } from '../components/Loading';
import toast, { Toaster } from 'react-hot-toast';

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function corCmv(cmv, semFicha) {
  if (semFicha) return 'var(--txt-faint)';
  if (cmv <= 30) return '#10b981';
  if (cmv <= 45) return '#f59e0b';
  return '#ef4444';
}

// ── Modal de ficha técnica ────────────────────────────────────
function ModalFicha({ nomeProduto, precoMedio, onClose, onSalvo }) {
  const [ficha, setFicha] = useState(null);
  const [item, setItem] = useState(null);
  const [linhas, setLinhas] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const { data: ingredientes = [] } = useQuery({
    queryKey: ['ingredientes'],
    queryFn: () => api.get('/ingredientes'),
  });

  useEffect(() => {
    api.get(`/relatorios/cmv-produtos/${encodeURIComponent(nomeProduto)}/ficha`)
      .then(d => {
        setItem(d.item);
        setLinhas(d.ficha.map(f => ({ ...f, _key: Math.random() })));
        setFicha(d);
      })
      .catch(e => toast.error(e.message));
  }, [nomeProduto]);

  function addLinha() {
    setLinhas(p => [...p, { _key: Math.random(), ingrediente_id: '', quantidade: '' }]);
  }

  function remLinha(key) {
    setLinhas(p => p.filter(l => l._key !== key));
  }

  function setLinha(key, field, val) {
    setLinhas(p => p.map(l => l._key === key ? { ...l, [field]: val } : l));
  }

  const custoTotal = linhas.reduce((s, l) => {
    const ing = ingredientes.find(i => String(i.id) === String(l.ingrediente_id));
    return s + (ing ? (ing.custo_unitario || 0) * Number(l.quantidade || 0) : 0);
  }, 0);
  const cmvCalc = precoMedio > 0 ? (custoTotal / precoMedio) * 100 : 0;

  async function salvar() {
    if (!item) {
      toast.error('Produto não encontrado no cardápio. Cadastre-o primeiro.');
      return;
    }
    const validas = linhas.filter(l => l.ingrediente_id && Number(l.quantidade) > 0);
    if (validas.length === 0) { toast.error('Adicione ao menos um ingrediente.'); return; }
    setSalvando(true);
    try {
      // Remove todas as linhas antigas e reinsere
      for (const l of (ficha?.ficha || [])) {
        await api.del(`/dashboard/ficha/${l.id}`);
      }
      for (const l of validas) {
        await api.post('/dashboard/ficha', {
          cardapio_item_id: item.id,
          ingrediente_id: Number(l.ingrediente_id),
          quantidade: Number(l.quantidade),
        });
      }
      toast.success('Ficha salva! CMV atualizado.');
      onSalvo();
      onClose();
    } catch (e) { toast.error(e.message); }
    setSalvando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: '#111', border: '1px solid #222' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #1a1a1a' }}>
          <div>
            <p className="font-black text-white">{nomeProduto}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--txt-dim)' }}>Ficha técnica · Preço médio {brl(precoMedio)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl"
            style={{ background: '#1a1a1a', color: '#666' }}>
            <X size={16} />
          </button>
        </div>

        {/* CMV preview */}
        <div className="px-5 py-3 flex gap-4" style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a' }}>
          <div>
            <p className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--txt-faint)' }}>CUSTO TOTAL</p>
            <p className="text-lg font-black text-white">{brl(custoTotal)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--txt-faint)' }}>CMV</p>
            <p className="text-lg font-black" style={{ color: corCmv(cmvCalc, false) }}>
              {cmvCalc.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-widest" style={{ color: 'var(--txt-faint)' }}>MARGEM</p>
            <p className="text-lg font-black" style={{ color: precoMedio - custoTotal >= 0 ? '#10b981' : '#ef4444' }}>
              {brl(precoMedio - custoTotal)}
            </p>
          </div>
        </div>

        {/* Linhas da ficha */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-2">
          {ficha === null ? (
            <p className="text-center py-6" style={{ color: 'var(--txt-faint)' }}>Carregando...</p>
          ) : (
            <>
              {linhas.map(l => {
                const ing = ingredientes.find(i => String(i.id) === String(l.ingrediente_id));
                const subtotal = ing ? (ing.custo_unitario || 0) * Number(l.quantidade || 0) : 0;
                return (
                  <div key={l._key} className="flex items-center gap-2 p-3 rounded-xl" style={{ background: '#1a1a1a' }}>
                    <select
                      value={l.ingrediente_id}
                      onChange={e => setLinha(l._key, 'ingrediente_id', e.target.value)}
                      className="flex-1 rounded-lg px-2 py-1.5 text-sm"
                      style={{ background: '#111', border: '1px solid #333', color: '#fff', outline: 'none' }}>
                      <option value="">Selecionar ingrediente…</option>
                      {ingredientes.map(i => (
                        <option key={i.id} value={i.id}>{i.nome} ({i.unidade_medida})</option>
                      ))}
                    </select>
                    <input
                      type="number" step="0.001" min="0"
                      placeholder="Qtd"
                      value={l.quantidade}
                      onChange={e => setLinha(l._key, 'quantidade', e.target.value)}
                      className="w-20 rounded-lg px-2 py-1.5 text-sm text-right"
                      style={{ background: '#111', border: '1px solid #333', color: '#fff', outline: 'none' }}
                    />
                    <span className="text-xs w-20 text-right shrink-0" style={{ color: subtotal > 0 ? '#10b981' : 'var(--txt-faint)' }}>
                      {subtotal > 0 ? brl(subtotal) : '—'}
                    </span>
                    <button onClick={() => remLinha(l._key)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg shrink-0"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}

              <button onClick={addLinha}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: 'rgba(var(--accent-rgb),0.08)', border: '1px dashed rgba(var(--accent-rgb),0.3)', color: 'var(--accent)' }}>
                <Plus size={15} /> Adicionar ingrediente
              </button>

              {!item && (
                <p className="text-xs text-center pt-1" style={{ color: '#f59e0b' }}>
                  ⚠️ Este produto não está cadastrado no Cardápio. Cadastre-o lá para salvar a ficha.
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: '1px solid #1a1a1a' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-bold"
            style={{ background: '#1a1a1a', color: '#666' }}>
            Cancelar
          </button>
          <button onClick={salvar} disabled={salvando || !item}
            className="px-5 py-2 rounded-xl text-sm font-black flex items-center gap-2"
            style={{ background: 'var(--accent)', color: '#fff', opacity: (salvando || !item) ? 0.6 : 1 }}>
            <Save size={14} /> {salvando ? 'Salvando…' : 'Salvar ficha'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function CmvProdutos() {
  const [mes, setMes] = useState(mesAtual());
  const [modalProduto, setModalProduto] = useState(null);
  const qc = useQueryClient();
  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ['cmv-produtos', mes],
    queryFn: () => api.get(`/relatorios/cmv-produtos?mes=${mes}`),
  });

  const comFicha = linhas.filter(l => !l.sem_ficha || l.custo_manual);
  const semFicha = linhas.filter(l => l.sem_ficha && !l.custo_manual);
  const totReceita = linhas.reduce((s, l) => s + l.receita, 0);
  const totCusto = comFicha.reduce((s, l) => s + l.custo_total, 0);
  const cmvMedio = totReceita > 0 ? (totCusto / totReceita) * 100 : 0;
  const margemTotal = comFicha.reduce((s, l) => s + l.margem, 0);

  const invalidar = () => qc.invalidateQueries(['cmv-produtos', mes]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Toaster position="top-right" />
      {modalProduto && (
        <ModalFicha
          nomeProduto={modalProduto.nome}
          precoMedio={modalProduto.preco_medio}
          onClose={() => setModalProduto(null)}
          onSalvo={invalidar}
        />
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">CMV por Produto</h1>
          <p className="page-subtitle">Custo, margem e CMV de cada item vendido no mês</p>
        </div>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="input max-w-[160px]" />
      </div>

      {isLoading ? <PageLoading /> : linhas.length === 0 ? (
        <div className="card p-10 text-center" style={{ color: 'var(--txt-dim)' }}>Nenhuma venda registrada neste mês.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Mini label="Receita (vendas)" valor={brl(totReceita)} cor="#3b82f6" />
            <Mini label="Custo (CMV)" valor={brl(totCusto)} cor="#f59e0b" />
            <Mini label="CMV médio" valor={`${cmvMedio.toFixed(1)}%`} cor={corCmv(cmvMedio, false)} destaque />
            <Mini label="Margem total" valor={brl(margemTotal)} cor="#10b981" />
          </div>

          {semFicha.length > 0 && (
            <div className="rounded-2xl p-3.5 flex items-start gap-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <AlertTriangle size={18} className="shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>{semFicha.length} item(ns) sem ficha técnica</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--txt-dim)' }}>
                  Clique no <Pencil size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> de qualquer item para montar a ficha e calcular o CMV automaticamente.
                </p>
              </div>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="text-center">Vendas</th>
                    <th className="text-right">Preço médio</th>
                    <th className="text-right">Custo/un</th>
                    <th className="text-center">CMV</th>
                    <th className="text-right">Margem</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map(l => (
                    <tr key={l.nome} style={{ cursor: 'pointer' }} onClick={() => setModalProduto(l)}
                      className="hover:bg-white/5 transition-colors">
                      <td className="font-semibold">
                        {l.nome}
                        {l.sem_ficha && !l.custo_manual && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>sem ficha</span>
                        )}
                        {l.custo_manual && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>manual</span>
                        )}
                      </td>
                      <td className="text-center font-mono">{l.qtd}</td>
                      <td className="text-right font-mono" style={{ color: 'var(--txt-dim)' }}>{brl(l.preco_medio)}</td>
                      <td className="text-right font-mono">{l.custo_unit > 0 ? brl(l.custo_unit) : '—'}</td>
                      <td className="text-center">
                        <span className="font-black" style={{ color: corCmv(l.cmv, l.sem_ficha && !l.custo_manual) }}>
                          {(l.sem_ficha && !l.custo_manual) ? '—' : `${l.cmv}%`}
                        </span>
                      </td>
                      <td className="text-right font-mono font-semibold" style={{ color: l.margem >= 0 ? '#10b981' : '#ef4444' }}>{brl(l.margem)}</td>
                      <td>
                        <button
                          onClick={e => { e.stopPropagation(); setModalProduto(l); }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg"
                          style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}
                          title="Editar ficha técnica">
                          <Pencil size={12} strokeWidth={2} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-[11px] flex items-center gap-1.5" style={{ color: 'var(--txt-faint)' }}>
            <TrendingUp size={12} /> CMV ideal pra sushi costuma ficar entre 30% e 40%. Verde ≤30% · amarelo ≤45% · vermelho acima. Clique em qualquer linha para editar a ficha.
          </p>
        </>
      )}
    </div>
  );
}

function Mini({ label, valor, cor, destaque }) {
  return (
    <div className="card p-3.5" style={destaque ? { border: `1px solid ${cor}55` } : undefined}>
      <p className="text-[11px]" style={{ color: 'var(--txt-dim)' }}>{label}</p>
      <p className={`font-black ${destaque ? 'text-xl' : 'text-lg'}`} style={{ color: cor }}>{valor}</p>
    </div>
  );
}
