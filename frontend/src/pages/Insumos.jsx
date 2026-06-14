import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Fish, TrendingUp, Plus, Trash2, X, PackagePlus, Boxes, Minus } from 'lucide-react';
import { api } from '../api/client';
import { mesAtual } from '../lib/fmt';

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const qtd = (v, u) => `${Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${u || ''}`.trim();
const fmtData = (d) => { if (!d) return '—'; const [a, m, dia] = d.split('-'); return `${dia}/${m}`; };
const hoje = () => new Date().toISOString().slice(0, 10);
const CALIBRES = ['10-12 lb', '12-14 lb', '14-16 lb', '16-18 lb'];

export default function Insumos() {
  const qc = useQueryClient();
  const [mes, setMes] = useState(mesAtual());
  const [modal, setModal] = useState(null);     // item de catálogo p/ registrar entrada
  const [consumoItem, setConsumoItem] = useState(null); // item p/ registrar consumo
  const [addItem, setAddItem] = useState(false); // form de novo insumo

  const { data: catalogo = [] } = useQuery({ queryKey: ['insumo-catalogo'], queryFn: () => api.get('/insumos/catalogo') });
  const { data: resumo } = useQuery({ queryKey: ['insumos-resumo', mes], queryFn: () => api.get(`/insumos/resumo?mes=${mes}`) });
  const { data: entradas = [] } = useQuery({ queryKey: ['insumos-entradas', mes], queryFn: () => api.get(`/insumos/entradas?mes=${mes}`) });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['insumos-resumo'] });
    qc.invalidateQueries({ queryKey: ['insumos-entradas'] });
    qc.invalidateQueries({ queryKey: ['insumo-catalogo'] });
  };

  const delEntrada = useMutation({ mutationFn: (id) => api.del(`/insumos/entradas/${id}`), onSuccess: invalidar });

  const itensResumo = resumo?.itens || [];
  const porSlug = Object.fromEntries(itensResumo.map(i => [i.slug, i]));
  const salmaoR = porSlug['salmao'];
  const nomeItem = (slug) => catalogo.find(c => c.slug === slug)?.nome || slug;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Insumos — chegada de mercadorias</h1>
          <p className="page-subtitle">Toque num item para registrar o que chegou. Salmão, cream cheese, arroz, nori…</p>
        </div>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="input max-w-[160px]" />
      </div>

      {/* Destaque salmão: faturamento por caixa */}
      {salmaoR && (
        <div className="rounded-2xl p-4 flex items-center justify-between flex-wrap gap-3"
          style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(var(--accent-rgb),0.2)' }}><Fish size={20} style={{ color: 'var(--accent)' }} /></span>
            <div>
              <p className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: 'var(--accent)' }}><TrendingUp size={14} /> Faturamento por caixa de salmão</p>
              <p className="text-[11px]" style={{ color: 'var(--txt-dim)' }}>
            {Number(salmaoR.caixas_consumidas_mes || 0).toFixed(1)} caixas usadas · ≈{qtd(salmaoR.kg_util_por_caixa, 'kg')} úteis/caixa
            {salmaoR.peixes_mes > 0 && ` · ${Number(salmaoR.peixes_consumidos_mes || 0).toFixed(1)} peixes usados`}
          </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black" style={{ color: 'var(--accent)' }}>{brl(salmaoR.faturamento_por_caixa)}<span className="text-xs font-normal ml-1" style={{ color: 'var(--txt-dim)' }}>/caixa</span></p>
            {salmaoR.peixes_mes > 0 && (
              <p className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{brl(salmaoR.faturamento_por_peixe)}<span className="text-xs font-normal ml-1" style={{ color: 'var(--txt-dim)' }}>/peixe</span></p>
            )}
          </div>
        </div>
      )}

      {/* Grid de cards dos insumos */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {catalogo.map(item => {
          const r = porSlug[item.slug] || {};
          const baixo = (r.estoque ?? 0) <= 0;
          return (
            <button key={item.slug} onClick={() => setModal(item)}
              className="rounded-2xl p-3.5 text-left transition-all active:scale-[0.98] relative group"
              style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
              <div className="flex items-start justify-between">
                <span className="text-2xl leading-none">{item.emoji || '📦'}</span>
                <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Plus size={15} strokeWidth={2.5} /></span>
              </div>
              <p className="font-bold text-sm mt-2 truncate" style={{ color: 'var(--txt-strong)' }}>{item.nome}</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-[13px] font-black" style={{ color: baixo ? '#f87171' : 'var(--txt)' }}>{qtd(r.estoque, item.unidade)}</span>
                <span className="text-[10px]" style={{ color: 'var(--txt-dim)' }}>em estoque</span>
              </div>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--txt-faint)' }}>
                {r.ultimo_custo ? `${brl(r.ultimo_custo)}/${item.unidade}` : 'sem entradas'}
              </p>
            </button>
          );
        })}

        {/* Card adicionar novo insumo */}
        <button onClick={() => setAddItem(true)}
          className="rounded-2xl p-3.5 flex flex-col items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{ background: 'transparent', border: '1.5px dashed var(--hairline-strong)', minHeight: 110, color: 'var(--txt-dim)' }}>
          <PackagePlus size={22} /><span className="text-xs font-bold">Adicionar insumo</span>
        </button>
      </div>

      {/* Ações: registrar consumo */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setConsumoItem(catalogo[0] || null)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)', color: 'var(--txt)' }}>
          <Minus size={15} /> Registrar consumo / baixa
        </button>
      </div>

      {/* Histórico de entradas */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Entradas do mês</span>
        </div>
        {entradas.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--txt-dim)' }}>Nenhuma entrada registrada neste mês</div>
        ) : (
          <div>
            {entradas.map(e => {
              const it = catalogo.find(c => c.slug === e.insumo);
              return (
                <div key={e.id} className="flex items-center gap-2.5 px-4 py-2.5 text-sm" style={{ borderTop: '1px solid var(--hairline-soft)' }}>
                  <span className="text-base">{it?.emoji || '📦'}</span>
                  <span className="font-semibold" style={{ color: 'var(--txt-strong)' }}>{nomeItem(e.insumo)}</span>
                  <span style={{ color: 'var(--txt-dim)' }}>{fmtData(e.data)}</span>
                  <span style={{ color: 'var(--txt)' }}>
                    {e.caixas ? `${Number(e.caixas)} cx · ` : ''}{qtd(e.peso_util, it?.unidade)}{e.qtd_peixes ? ` · ${e.qtd_peixes} peixes` : ''}{e.calibre ? ` · ${e.calibre}` : ''}
                  </span>
                  <span className="ml-auto font-mono font-semibold" style={{ color: 'var(--txt-strong)' }}>{brl(e.valor_total)}</span>
                  <button onClick={() => delEntrada.mutate(e.id)} className="btn-ghost btn-icon btn-sm text-red-400 hover:text-red-600" title="Excluir"><Trash2 size={14} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && <ModalEntrada item={modal} onClose={() => setModal(null)} onSaved={invalidar} />}
      {consumoItem && <ModalConsumo catalogo={catalogo} inicial={consumoItem} onClose={() => setConsumoItem(null)} onSaved={invalidar} />}
      {addItem && <ModalNovoItem onClose={() => setAddItem(false)} onSaved={invalidar} />}
    </div>
  );
}

// ── Modal: registrar ENTRADA (chegada) de um item ──────────────
function ModalEntrada({ item, onClose, onSaved }) {
  const ehSalmao = item.tipo === 'salmao';
  const [f, setF] = useState({
    data: hoje(), valor_total: '', fornecedor: '',
    caixas: '1', aproveitamento: '70', peso_bruto: '', peso_por_caixa: '', calibre: CALIBRES[1],
    qtd_peixes: '', quantidade: '',
  });
  const m = useMutation({
    mutationFn: (body) => api.post('/insumos/entradas', body),
    onSuccess: () => { toast.success('Entrada registrada!'); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  // peso_bruto manual tem prioridade; senão calcula de caixas × peso_por_caixa; senão caixas × 30
  const pesoBrutoCalc = Number(f.peso_por_caixa) > 0 ? (Number(f.caixas) || 1) * Number(f.peso_por_caixa) : 0;
  const pesoBruto = Number(f.peso_bruto) || pesoBrutoCalc || (Number(f.caixas) || 0) * 30;
  const pesoUtil = pesoBruto * ((Number(f.aproveitamento) || 0) / 100);

  function salvar(e) {
    e.preventDefault();
    if (ehSalmao) {
      m.mutate({
        insumo: item.slug, data: f.data, caixas: Number(f.caixas),
        perda_pct: 100 - (Number(f.aproveitamento) || 0),
        valor_total: Number(f.valor_total), calibre: f.calibre, fornecedor: f.fornecedor,
        peso_bruto: pesoBruto,
        qtd_peixes: f.qtd_peixes ? Number(f.qtd_peixes) : undefined,
      });
    } else {
      m.mutate({ insumo: item.slug, data: f.data, quantidade: Number(f.quantidade), valor_total: Number(f.valor_total), fornecedor: f.fornecedor });
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center gap-2.5 mb-4">
        <span className="text-2xl">{item.emoji || '📦'}</span>
        <div>
          <h2 className="font-black text-lg" style={{ color: 'var(--txt-strong)' }}>Chegou {item.nome}</h2>
          <p className="text-xs" style={{ color: 'var(--txt-dim)' }}>Registre o que chegou do fornecedor</p>
        </div>
        <button onClick={onClose} className="ml-auto btn-ghost btn-icon"><X size={18} /></button>
      </div>
      <form onSubmit={salvar} className="space-y-3">
        <Campo label="Data"><input type="date" className="input" value={f.data} onChange={e => setF(p => ({ ...p, data: e.target.value }))} /></Campo>

        {ehSalmao ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Campo label="Nº de caixas">
                <input type="number" step="1" min="1" className="input" value={f.caixas}
                  onChange={e => setF(p => ({ ...p, caixas: e.target.value }))} />
              </Campo>
              <Campo label="Peso por caixa (kg)">
                <input type="number" step="0.1" min="0" className="input"
                  placeholder="ex: 25"
                  value={f.peso_por_caixa}
                  onChange={e => setF(p => ({ ...p, peso_por_caixa: e.target.value, peso_bruto: '' }))} />
              </Campo>
            </div>
            <Campo label="Peso bruto total (kg)">
              <input type="number" step="0.1" min="0" className="input"
                placeholder={pesoBrutoCalc > 0 ? `${pesoBrutoCalc} kg (${f.caixas} cx × ${f.peso_por_caixa} kg)` : 'ou informe aqui o total'}
                value={f.peso_bruto}
                onChange={e => setF(p => ({ ...p, peso_bruto: e.target.value, peso_por_caixa: '' }))} />
            </Campo>
            <Campo label="Quantidade de peixes na(s) caixa(s)">
              <input type="number" step="1" min="0" className="input"
                placeholder="ex: 8 peixes"
                value={f.qtd_peixes}
                onChange={e => setF(p => ({ ...p, qtd_peixes: e.target.value }))} />
            </Campo>
            <Campo label="Calibragem do salmão">
              <div className="flex flex-wrap gap-2">
                {CALIBRES.map(c => (
                  <button type="button" key={c} onClick={() => setF(p => ({ ...p, calibre: c }))}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                    style={f.calibre === c
                      ? { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent)' }
                      : { background: 'var(--space-elev-2)', color: 'var(--txt-dim)', border: '1px solid var(--hairline)' }}>
                    {c}
                  </button>
                ))}
              </div>
            </Campo>
            <Campo label="Aproveitamento %">
              <input type="number" min="0" max="100" className="input" value={f.aproveitamento}
                onChange={e => setF(p => ({ ...p, aproveitamento: e.target.value }))}
                title="Quanto da caixa vira filé aproveitável" />
            </Campo>
          </>
        ) : (
          <Campo label={`Quantidade (${item.unidade})`}>
            <input type="number" step="0.1" min="0" className="input" autoFocus value={f.quantidade} onChange={e => setF(p => ({ ...p, quantidade: e.target.value }))} required />
          </Campo>
        )}

        <Campo label="Valor pago (R$)"><input type="number" step="0.01" min="0" className="input" value={f.valor_total} onChange={e => setF(p => ({ ...p, valor_total: e.target.value }))} required /></Campo>
        <Campo label="Fornecedor (opcional)"><input className="input" value={f.fornecedor} onChange={e => setF(p => ({ ...p, fornecedor: e.target.value }))} /></Campo>

        {ehSalmao && (
          <div className="rounded-xl p-3 text-xs space-y-1" style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }}>
            <div className="flex justify-between">
              <span style={{ color: 'var(--txt-dim)' }}>Peso bruto total</span>
              <span className="font-semibold" style={{ color: 'var(--txt)' }}>{pesoBruto.toFixed(1)} kg</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--txt-dim)' }}>Aproveitamento {f.aproveitamento}%</span>
              <span className="font-bold" style={{ color: 'var(--accent)' }}>≈ {pesoUtil.toFixed(1)} kg úteis</span>
            </div>
            {f.valor_total && pesoUtil > 0 && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--txt-dim)' }}>Custo por kg útil</span>
                <span className="font-semibold" style={{ color: 'var(--txt)' }}>{brl(Number(f.valor_total) / pesoUtil)}/kg</span>
              </div>
            )}
            {f.qtd_peixes > 0 && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--txt-dim)' }}>Kg útil por peixe</span>
                <span className="font-semibold" style={{ color: 'var(--txt)' }}>{(pesoUtil / Number(f.qtd_peixes)).toFixed(2)} kg/peixe</span>
              </div>
            )}
          </div>
        )}
        {!ehSalmao && f.quantidade && f.valor_total && (
          <p className="text-xs" style={{ color: 'var(--txt-dim)' }}>{brl(Number(f.valor_total) / Number(f.quantidade))}/{item.unidade}</p>
        )}

        <button className="btn-primary w-full" disabled={m.isPending}><Plus size={15} className="inline" /> Registrar entrada</button>
      </form>
    </Overlay>
  );
}

// ── Modal: registrar CONSUMO ──────────────────────────────────
function ModalConsumo({ catalogo, inicial, onClose, onSaved }) {
  const [f, setF] = useState({ data: hoje(), insumo: inicial?.slug || catalogo[0]?.slug, quantidade_kg: '' });
  const m = useMutation({
    mutationFn: (body) => api.post('/insumos/consumo', body),
    onSuccess: () => { toast.success('Consumo registrado!'); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const item = catalogo.find(c => c.slug === f.insumo);
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center gap-2.5 mb-4">
        <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Boxes size={18} /></span>
        <h2 className="font-black text-lg" style={{ color: 'var(--txt-strong)' }}>Registrar consumo</h2>
        <button onClick={onClose} className="ml-auto btn-ghost btn-icon"><X size={18} /></button>
      </div>
      <form onSubmit={e => { e.preventDefault(); m.mutate({ ...f, quantidade_kg: Number(f.quantidade_kg) }); }} className="space-y-3">
        <Campo label="Data"><input type="date" className="input" value={f.data} onChange={e => setF(p => ({ ...p, data: e.target.value }))} /></Campo>
        <Campo label="Insumo">
          <select className="input" value={f.insumo} onChange={e => setF(p => ({ ...p, insumo: e.target.value }))}>
            {catalogo.map(c => <option key={c.slug} value={c.slug}>{c.emoji} {c.nome}</option>)}
          </select>
        </Campo>
        <Campo label={`Quantidade usada (${item?.unidade || ''})`}>
          <input type="number" step="0.1" min="0" className="input" autoFocus value={f.quantidade_kg} onChange={e => setF(p => ({ ...p, quantidade_kg: e.target.value }))} required />
        </Campo>
        <button className="btn-primary w-full" disabled={m.isPending}>Registrar consumo</button>
      </form>
    </Overlay>
  );
}

// ── Modal: novo insumo no catálogo ────────────────────────────
function ModalNovoItem({ onClose, onSaved }) {
  const [f, setF] = useState({ nome: '', unidade: 'kg', emoji: '📦' });
  const UNIDADES = ['kg', 'L', 'un', 'pacote', 'par', 'fardo', 'caixa'];
  const m = useMutation({
    mutationFn: (body) => api.post('/insumos/catalogo', body),
    onSuccess: () => { toast.success('Insumo adicionado!'); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center gap-2.5 mb-4">
        <PackagePlus size={20} style={{ color: 'var(--accent)' }} />
        <h2 className="font-black text-lg" style={{ color: 'var(--txt-strong)' }}>Novo insumo</h2>
        <button onClick={onClose} className="ml-auto btn-ghost btn-icon"><X size={18} /></button>
      </div>
      <form onSubmit={e => { e.preventDefault(); m.mutate(f); }} className="space-y-3">
        <Campo label="Nome"><input className="input" autoFocus placeholder="Ex: Tarê, Vinagre de arroz…" value={f.nome} onChange={e => setF(p => ({ ...p, nome: e.target.value }))} required /></Campo>
        <Campo label="Unidade">
          <div className="flex flex-wrap gap-2">
            {UNIDADES.map(u => (
              <button type="button" key={u} onClick={() => setF(p => ({ ...p, unidade: u }))}
                className="px-3 py-1.5 rounded-xl text-xs font-bold"
                style={f.unidade === u ? { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent)' } : { background: 'var(--space-elev-2)', color: 'var(--txt-dim)', border: '1px solid var(--hairline)' }}>{u}</button>
            ))}
          </div>
        </Campo>
        <Campo label="Emoji (opcional)"><input className="input" maxLength={4} value={f.emoji} onChange={e => setF(p => ({ ...p, emoji: e.target.value }))} /></Campo>
        <button className="btn-primary w-full" disabled={m.isPending}>Adicionar</button>
      </form>
    </Overlay>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="text-[11px] font-semibold block mb-1" style={{ color: 'var(--txt-dim)' }}>{label}</label>
      {children}
    </div>
  );
}

function Overlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-3xl p-5 max-h-[92vh] overflow-y-auto" style={{ background: 'var(--space-surface)', border: '1px solid var(--hairline-strong)' }}>
        {children}
      </div>
    </div>
  );
}
