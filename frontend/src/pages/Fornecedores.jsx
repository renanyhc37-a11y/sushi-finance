import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast, { Toaster } from 'react-hot-toast';
import {
  Truck, Plus, Search, Trophy, MessageCircle, Trash2, X, Store,
  Package, LayoutGrid, Table2, Send, Check, Loader2,
} from 'lucide-react';
import { api } from '../api/client';
import DicaNinja from '../components/DicaNinja';

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Link de WhatsApp com texto pré-preenchido (normaliza DDI 55).
function waLink(tel, texto) {
  let d = String(tel || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length <= 11) d = '55' + d;
  return `https://wa.me/${d}?text=${encodeURIComponent(texto)}`;
}

export default function Fornecedores() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['fornecedores-dados'], queryFn: () => api.get('/fornecedores/dados') });
  const refetch = () => qc.invalidateQueries(['fornecedores-dados']);

  const fornecedores = data?.fornecedores || [];
  const itens = data?.itens || [];
  const precos = data?.precos || [];

  const [view, setView] = useState(() => localStorage.getItem('forn_view') || 'comparar');
  const trocarView = (v) => { setView(v); try { localStorage.setItem('forn_view', v); } catch {} };
  const [busca, setBusca] = useState('');
  const [catFiltro, setCatFiltro] = useState('');
  const [modal, setModal] = useState(null); // 'fornecedor' | 'item' | { pedido: fornecedor }

  const precoMap = useMemo(() => {
    const m = {};
    for (const p of precos) (m[p.item_id] ||= {})[p.fornecedor_id] = p.preco;
    return m;
  }, [precos]);
  const precoDe = (itemId, fornId) => precoMap[itemId]?.[fornId];
  const melhorForn = (itemId) => {
    let best = null;
    for (const f of fornecedores) {
      const p = precoDe(itemId, f.id);
      if (p > 0 && (best === null || p < best.preco)) best = { id: f.id, preco: p };
    }
    return best;
  };

  const categorias = useMemo(() => [...new Set(itens.map((i) => i.categoria).filter(Boolean))], [itens]);
  const itensFiltrados = useMemo(() => itens.filter((i) =>
    (!busca || i.nome.toLowerCase().includes(busca.toLowerCase())) &&
    (!catFiltro || i.categoria === catFiltro)
  ), [itens, busca, catFiltro]);

  // Agrupa por categoria (para a visão "Comparar")
  const porCategoria = useMemo(() => {
    const g = {};
    for (const it of itensFiltrados) (g[it.categoria || 'Geral'] ||= []).push(it);
    return Object.entries(g);
  }, [itensFiltrados]);

  async function salvarPreco(item_id, fornecedor_id, valor) {
    try { await api.put('/fornecedores/preco', { item_id, fornecedor_id, preco: valor }); refetch(); }
    catch (e) { toast.error(e.message); }
  }
  async function excluirItem(id) {
    if (!window.confirm('Remover este item da lista?')) return;
    try { await api.del(`/fornecedores/item/${id}`); refetch(); } catch (e) { toast.error(e.message); }
  }
  async function excluirFornecedor(id) {
    if (!window.confirm('Remover este fornecedor e seus preços?')) return;
    try { await api.del(`/fornecedores/fornecedor/${id}`); refetch(); } catch (e) { toast.error(e.message); }
  }

  const VIEWS = [
    { id: 'comparar', label: 'Comparar', Icon: LayoutGrid },
    { id: 'matriz', label: 'Tabela', Icon: Table2 },
    { id: 'fornecedores', label: 'Fornecedores', Icon: Store },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-16">
      <DicaNinja id="fornecedores" />
      <Toaster position="top-right" />

      {/* Cabeçalho */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2.5" style={{ color: 'var(--txt-strong)' }}>
            <Truck size={24} strokeWidth={1.75} style={{ color: 'var(--accent)' }} /> Fornecedores
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--txt-dim)' }}>
            {fornecedores.length} fornecedor(es) · {itens.length} itens · compare e peça pelo WhatsApp
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setModal('fornecedor')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl font-black text-sm text-white transition active:scale-95"
            style={{ background: 'var(--accent)', boxShadow: '0 2px 12px rgba(var(--accent-rgb),0.3)' }}>
            <Plus size={16} strokeWidth={2.5} /> Fornecedor
          </button>
          <button onClick={() => setModal('item')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl font-black text-sm transition active:scale-95"
            style={{ background: 'var(--space-elev)', border: '1px solid rgba(var(--accent-rgb),0.35)', color: 'var(--accent)' }}>
            <Plus size={16} strokeWidth={2.5} /> Item
          </button>
        </div>
      </div>

      {/* Switcher de visão */}
      <div className="flex items-center gap-0.5 p-0.5 rounded-xl w-fit" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
        {VIEWS.map((v) => (
          <button key={v.id} onClick={() => trocarView(v.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={view === v.id
              ? { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.3)' }
              : { color: 'var(--txt-dim)', border: '1px solid transparent' }}>
            <v.Icon size={14} strokeWidth={2} /> {v.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-sm" style={{ color: 'var(--txt-dim)' }}>Carregando…</div>
      ) : fornecedores.length === 0 && view !== 'fornecedores' ? (
        <VazioFornecedores onAdd={() => setModal('fornecedor')} />
      ) : (
        <>
          {/* Busca + filtro de categoria (comparar/tabela) */}
          {view !== 'fornecedores' && (
            <>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--txt-dim)' }} />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item…"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm"
                  style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)', color: 'var(--txt-strong)', outline: 'none' }} />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <Chip ativo={!catFiltro} onClick={() => setCatFiltro('')}>Todas</Chip>
                {categorias.map((c) => <Chip key={c} ativo={catFiltro === c} onClick={() => setCatFiltro(c)}>{c}</Chip>)}
              </div>
            </>
          )}

          {view === 'comparar' && (
            <div className="space-y-5">
              {porCategoria.map(([cat, its]) => (
                <div key={cat}>
                  <p className="text-[11px] font-bold tracking-[0.15em] mb-2 px-1" style={{ color: 'var(--txt-faint)' }}>{cat.toUpperCase()}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {its.map((it) => (
                      <ItemCard key={it.id} item={it} fornecedores={fornecedores}
                        precoDe={precoDe} melhor={melhorForn(it.id)}
                        onSalvar={salvarPreco} onExcluir={() => excluirItem(it.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {view === 'matriz' && (
            <Matriz itens={itensFiltrados} fornecedores={fornecedores}
              precoDe={precoDe} melhorForn={melhorForn} onSalvar={salvarPreco} />
          )}

          {view === 'fornecedores' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fornecedores.length === 0 && <VazioFornecedores onAdd={() => setModal('fornecedor')} />}
              {fornecedores.map((f) => (
                <FornecedorCard key={f.id} f={f} itens={itens} precoDe={precoDe}
                  onPedido={() => setModal({ pedido: f })} onExcluir={() => excluirFornecedor(f.id)} />
              ))}
            </div>
          )}
        </>
      )}

      {modal === 'fornecedor' && <ModalFornecedor onClose={() => setModal(null)} onSalvo={() => { setModal(null); refetch(); }} />}
      {modal === 'item' && <ModalItem categorias={categorias} onClose={() => setModal(null)} onSalvo={() => { setModal(null); refetch(); }} />}
      {modal?.pedido && <ModalPedido fornecedor={modal.pedido} itens={itens} precoDe={precoDe} onClose={() => setModal(null)} />}
    </div>
  );
}

// ── Célula de preço (editável) ─────────────────────────────────────
function PriceCell({ valor, melhor, onSalvar, compact }) {
  const [editando, setEditando] = useState(false);
  const [v, setV] = useState('');
  function abrir() { setV(valor ? String(valor).replace('.', ',') : ''); setEditando(true); }
  function fechar() { setEditando(false); onSalvar(v); }
  if (editando) {
    return (
      <input autoFocus type="text" inputMode="decimal" value={v}
        onChange={(e) => setV(e.target.value)} onBlur={fechar}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setEditando(false); }}
        placeholder="R$"
        className="w-full text-center rounded-lg px-1 py-1 text-[13px] font-bold"
        style={{ background: 'var(--space-base)', border: '1px solid var(--accent)', color: 'var(--txt-strong)', outline: 'none' }} />
    );
  }
  return (
    <button onClick={abrir}
      className="w-full rounded-lg px-1 py-1.5 text-[13px] font-bold transition"
      style={melhor && valor > 0
        ? { background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981' }
        : { background: valor > 0 ? 'var(--space-elev-2)' : 'transparent', border: `1px solid ${valor > 0 ? 'var(--hairline)' : 'var(--hairline-soft)'}`, color: valor > 0 ? 'var(--txt-strong)' : 'var(--txt-faint)' }}>
      {valor > 0 ? (compact ? brl(valor).replace('R$ ', '') : brl(valor)) : '—'}
    </button>
  );
}

// ── Card de item (visão Comparar) ──────────────────────────────────
function ItemCard({ item, fornecedores, precoDe, melhor, onSalvar, onExcluir }) {
  return (
    <div className="rounded-2xl p-3.5" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="min-w-0">
          <p className="font-bold text-[14px] truncate" style={{ color: 'var(--txt-strong)' }}>{item.nome}</p>
          <p className="text-[11px]" style={{ color: 'var(--txt-dim)' }}>por {item.unidade}</p>
        </div>
        {melhor && (
          <span className="shrink-0 flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full"
            style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
            <Trophy size={11} /> {brl(melhor.preco)}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {fornecedores.map((f) => {
          const p = precoDe(item.id, f.id);
          const ehMelhor = melhor && melhor.id === f.id;
          return (
            <div key={f.id} className="flex items-center gap-2">
              <span className="flex-1 text-[12.5px] truncate" style={{ color: ehMelhor ? '#10b981' : 'var(--txt)' }}>
                {ehMelhor && '🏆 '}{f.nome}
              </span>
              <div className="w-24 shrink-0">
                <PriceCell valor={p} melhor={ehMelhor} onSalvar={(v) => onSalvar(item.id, f.id, v)} />
              </div>
            </div>
          );
        })}
        {fornecedores.length === 0 && <p className="text-[12px]" style={{ color: 'var(--txt-faint)' }}>Cadastre um fornecedor pra lançar preços.</p>}
      </div>
      <button onClick={onExcluir} className="mt-2 text-[11px] flex items-center gap-1" style={{ color: 'var(--txt-faint)' }}>
        <Trash2 size={11} /> remover item
      </button>
    </div>
  );
}

// ── Matriz (tabela item × fornecedor) ──────────────────────────────
function Matriz({ itens, fornecedores, precoDe, melhorForn, onSalvar }) {
  if (!fornecedores.length) return <p className="text-sm" style={{ color: 'var(--txt-dim)' }}>Cadastre fornecedores para ver a tabela.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl no-scrollbar" style={{ border: '1px solid var(--hairline)' }}>
      <table className="w-full border-collapse text-sm" style={{ minWidth: 120 + fornecedores.length * 110 }}>
        <thead>
          <tr style={{ background: 'var(--space-elev)' }}>
            <th className="text-left px-3 py-2.5 sticky left-0 z-10 text-[12px] font-bold"
              style={{ background: 'var(--space-elev)', color: 'var(--txt-dim)', minWidth: 130 }}>Item</th>
            {fornecedores.map((f) => (
              <th key={f.id} className="px-2 py-2.5 text-[12px] font-bold text-center" style={{ color: 'var(--txt-strong)', minWidth: 100 }}>{f.nome}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {itens.map((it) => {
            const melhor = melhorForn(it.id);
            return (
              <tr key={it.id} style={{ borderTop: '1px solid var(--hairline)' }}>
                <td className="px-3 py-2 sticky left-0 z-10" style={{ background: 'var(--space-surface)' }}>
                  <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--txt-strong)', maxWidth: 130 }}>{it.nome}</p>
                  <p className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>{it.unidade}</p>
                </td>
                {fornecedores.map((f) => (
                  <td key={f.id} className="px-1.5 py-1.5">
                    <PriceCell valor={precoDe(it.id, f.id)} melhor={melhor && melhor.id === f.id} compact
                      onSalvar={(v) => onSalvar(it.id, f.id, v)} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Card de fornecedor ─────────────────────────────────────────────
function FornecedorCard({ f, itens, precoDe, onPedido, onExcluir }) {
  const comPreco = itens.filter((it) => precoDe(it.id, f.id) > 0).length;
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-black text-[15px] truncate" style={{ color: 'var(--txt-strong)' }}>{f.nome}</p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--txt-dim)' }}>
            {f.telefone ? f.telefone.replace(/(\d{2})(\d{4,5})(\d{4})/, '($1) $2-$3') : 'sem telefone'} · {comPreco} itens com preço
          </p>
          {f.observacao && <p className="text-[11.5px] mt-1" style={{ color: 'var(--txt-faint)' }}>{f.observacao}</p>}
        </div>
        <button onClick={onExcluir} className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg" style={{ color: 'var(--txt-faint)' }}>
          <Trash2 size={14} />
        </button>
      </div>
      <button onClick={onPedido} disabled={!f.telefone}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black text-white transition active:scale-95"
        style={{ background: f.telefone ? '#25D366' : 'var(--space-elev-2)', color: f.telefone ? '#fff' : 'var(--txt-faint)' }}>
        <MessageCircle size={16} /> {f.telefone ? 'Montar pedido no WhatsApp' : 'Cadastre um telefone'}
      </button>
    </div>
  );
}

// ── Modais ─────────────────────────────────────────────────────────
function Overlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(6,8,13,0.72)', backdropFilter: 'blur(5px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline-strong)', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
        {children}
      </div>
    </div>
  );
}

function CampoM({ label, children }) {
  return (
    <div>
      <label className="text-[11px] font-bold tracking-wide" style={{ color: 'var(--txt-faint)' }}>{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
const inputCss = { background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: 'var(--txt-strong)', outline: 'none' };

function ModalFornecedor({ onClose, onSalvo }) {
  const [nome, setNome] = useState(''); const [tel, setTel] = useState(''); const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    if (!nome.trim()) return toast.error('Nome do fornecedor?');
    setSalvando(true);
    try { await api.post('/fornecedores/fornecedor', { nome, telefone: tel, observacao: obs }); toast.success('Fornecedor salvo!'); onSalvo(); }
    catch (e) { toast.error(e.message); setSalvando(false); }
  }
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <p className="font-black" style={{ color: 'var(--txt-strong)' }}>Novo fornecedor</p>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ background: 'var(--space-elev-2)', color: 'var(--txt-dim)' }}><X size={16} /></button>
      </div>
      <div className="px-5 py-4 space-y-3">
        <CampoM label="NOME"><input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: Atacadão do Sushi" className="w-full rounded-xl px-3 py-2 text-sm" style={inputCss} /></CampoM>
        <CampoM label="WHATSAPP (com DDD)"><input value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" placeholder="(44) 99999-9999" className="w-full rounded-xl px-3 py-2 text-sm" style={inputCss} /></CampoM>
        <CampoM label="OBSERVAÇÃO (opcional)"><input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Entrega terça e sexta…" className="w-full rounded-xl px-3 py-2 text-sm" style={inputCss} /></CampoM>
      </div>
      <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--hairline)' }}>
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--space-elev-2)', color: 'var(--txt-dim)' }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black text-white" style={{ background: 'var(--accent)', opacity: salvando ? 0.6 : 1 }}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Salvar
        </button>
      </div>
    </Overlay>
  );
}

function ModalItem({ categorias, onClose, onSalvo }) {
  const [nome, setNome] = useState(''); const [un, setUn] = useState('kg'); const [cat, setCat] = useState(categorias[0] || 'Geral');
  const [salvando, setSalvando] = useState(false);
  async function salvar() {
    if (!nome.trim()) return toast.error('Nome do item?');
    setSalvando(true);
    try { await api.post('/fornecedores/item', { nome, unidade: un, categoria: cat }); toast.success('Item adicionado!'); onSalvo(); }
    catch (e) { toast.error(e.message); setSalvando(false); }
  }
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <p className="font-black" style={{ color: 'var(--txt-strong)' }}>Novo item de compra</p>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ background: 'var(--space-elev-2)', color: 'var(--txt-dim)' }}><X size={16} /></button>
      </div>
      <div className="px-5 py-4 space-y-3">
        <CampoM label="NOME"><input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex.: Cream Cheese" className="w-full rounded-xl px-3 py-2 text-sm" style={inputCss} /></CampoM>
        <div className="grid grid-cols-2 gap-3">
          <CampoM label="UNIDADE"><input value={un} onChange={(e) => setUn(e.target.value)} placeholder="kg, L, cx, pct…" className="w-full rounded-xl px-3 py-2 text-sm" style={inputCss} /></CampoM>
          <CampoM label="CATEGORIA">
            <input value={cat} onChange={(e) => setCat(e.target.value)} list="forn-cats" placeholder="Categoria" className="w-full rounded-xl px-3 py-2 text-sm" style={inputCss} />
            <datalist id="forn-cats">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
          </CampoM>
        </div>
      </div>
      <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--hairline)' }}>
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold" style={{ background: 'var(--space-elev-2)', color: 'var(--txt-dim)' }}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black text-white" style={{ background: 'var(--accent)', opacity: salvando ? 0.6 : 1 }}>
          {salvando ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Adicionar
        </button>
      </div>
    </Overlay>
  );
}

// Monta o pedido e abre o WhatsApp do fornecedor com a lista pronta.
function ModalPedido({ fornecedor, itens, precoDe, onClose }) {
  const [qtd, setQtd] = useState({}); // item_id -> quantidade
  const setQ = (id, v) => setQtd((q) => ({ ...q, [id]: Math.max(0, v) }));
  const escolhidos = itens.filter((it) => (qtd[it.id] || 0) > 0);
  const total = escolhidos.reduce((s, it) => s + (precoDe(it.id, fornecedor.id) || 0) * qtd[it.id], 0);

  function enviar() {
    if (!escolhidos.length) return toast.error('Escolha ao menos um item.');
    const linhas = escolhidos.map((it) => `• ${qtd[it.id]} ${it.unidade} — ${it.nome}`);
    const msg = `Olá, ${fornecedor.nome}! Gostaria de fazer um pedido:\n\n${linhas.join('\n')}\n\n${total > 0 ? `Estimativa: ${brl(total)}\n\n` : ''}Obrigado! 🙏`;
    const link = waLink(fornecedor.telefone, msg);
    if (link) window.open(link, '_blank');
  }

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <div>
          <p className="font-black" style={{ color: 'var(--txt-strong)' }}>Pedido · {fornecedor.nome}</p>
          <p className="text-[11px]" style={{ color: 'var(--txt-dim)' }}>Escolha as quantidades e envie no WhatsApp</p>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl" style={{ background: 'var(--space-elev-2)', color: 'var(--txt-dim)' }}><X size={16} /></button>
      </div>
      <div className="overflow-y-auto px-5 py-3 flex-1 space-y-1.5">
        {itens.map((it) => {
          const p = precoDe(it.id, fornecedor.id);
          const q = qtd[it.id] || 0;
          return (
            <div key={it.id} className="flex items-center gap-2 py-1">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] truncate" style={{ color: q > 0 ? 'var(--txt-strong)' : 'var(--txt)' }}>{it.nome}</p>
                <p className="text-[10.5px]" style={{ color: 'var(--txt-faint)' }}>{it.unidade}{p > 0 ? ` · ${brl(p)}` : ''}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setQ(it.id, q - 1)} className="w-7 h-7 rounded-lg font-bold" style={{ background: 'var(--space-elev-2)', color: 'var(--txt)' }}>–</button>
                <span className="w-6 text-center text-[13px] font-bold" style={{ color: 'var(--txt-strong)' }}>{q}</span>
                <button onClick={() => setQ(it.id, q + 1)} className="w-7 h-7 rounded-lg font-bold text-white" style={{ background: 'var(--accent)' }}>+</button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="px-5 py-4 space-y-2" style={{ borderTop: '1px solid var(--hairline)' }}>
        {total > 0 && <p className="text-[12px] text-center" style={{ color: 'var(--txt-dim)' }}>Estimativa: <b style={{ color: 'var(--txt-strong)' }}>{brl(total)}</b></p>}
        <button onClick={enviar} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black text-white transition active:scale-95" style={{ background: '#25D366' }}>
          <Send size={16} /> Enviar {escolhidos.length ? `(${escolhidos.length})` : ''} no WhatsApp
        </button>
      </div>
    </Overlay>
  );
}

function Chip({ ativo, onClick, children }) {
  return (
    <button onClick={onClick} className="px-3 py-1.5 rounded-full text-xs font-bold transition"
      style={ativo
        ? { background: 'var(--accent)', color: '#fff' }
        : { background: 'var(--space-elev)', color: 'var(--txt-dim)', border: '1px solid var(--hairline)' }}>
      {children}
    </button>
  );
}

function VazioFornecedores({ onAdd }) {
  return (
    <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--space-elev)', border: '1px dashed var(--hairline-strong)' }}>
      <div className="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(var(--accent-rgb),0.12)' }}>
        <Package size={26} style={{ color: 'var(--accent)' }} />
      </div>
      <p className="font-bold" style={{ color: 'var(--txt-strong)' }}>Cadastre seus fornecedores</p>
      <p className="text-sm mt-1 mb-4 max-w-xs mx-auto" style={{ color: 'var(--txt-dim)' }}>
        🥷 Bota os fornecedores que você usa, lança o preço de cada item e o sistema te mostra onde tá mais barato — e ainda monta o pedido no WhatsApp.
      </p>
      <button onClick={onAdd} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm text-white" style={{ background: 'var(--accent)' }}>
        <Plus size={16} /> Adicionar fornecedor
      </button>
    </div>
  );
}
