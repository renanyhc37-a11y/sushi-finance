import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { PageLoading } from '../components/Loading';
import { useListaOffline } from '../hooks/useListaOffline';
import {
  ShoppingCart, Star, Trash2, WifiOff, RefreshCw, AlertTriangle, CheckCircle2,
  Banknote, Plus, Pencil, Check, X, Package, ListChecks, Coins, TrendingUp,
  ChevronRight, Sparkles,
} from 'lucide-react';

const UNIDADES = ['unidade', 'kg', 'g', 'litro', 'ml', 'caixa', 'pacote', 'dúzia'];
const FORM_VAZIO = { nome: '', quantidade: '1', unidade: 'unidade', observacao: '' };
const brl = (v) => v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* ── Estilos compartilhados com design system ── */
const S = {
  card: {
    background: 'var(--space-elev)',
    border: '1px solid var(--hairline)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardPad: {
    background: 'var(--space-elev)',
    border: '1px solid var(--hairline)',
    borderRadius: 14,
    padding: '1rem',
  },
  headerSection: {
    padding: '10px 16px',
    borderBottom: '1px solid var(--hairline)',
    background: 'var(--space-elev-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  divider: { borderTop: '1px solid var(--hairline)' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    transition: 'background 0.15s',
    cursor: 'default',
  },
  iconBox: (cor) => ({
    width: 34,
    height: 34,
    borderRadius: 8,
    background: cor + '22',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    flexShrink: 0,
  }),
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid var(--hairline)',
    background: 'var(--space-elev-2)',
    color: 'var(--txt)',
    transition: 'background 0.15s',
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    background: 'var(--accent)',
    color: '#fff',
    transition: 'opacity 0.15s',
  },
  btnIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 7,
    cursor: 'pointer',
    border: '1px solid var(--hairline)',
    background: 'var(--space-elev-2)',
    color: 'var(--txt-dim)',
    transition: 'background 0.15s',
    flexShrink: 0,
  },
  input: {
    background: 'var(--space-elev-2)',
    border: '1px solid var(--hairline)',
    borderRadius: 8,
    padding: '7px 10px',
    fontSize: 13,
    color: 'var(--txt)',
    outline: 'none',
  },
  badge: (cor) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    background: cor + '22',
    color: cor,
  }),
  tag: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '1px 8px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 500,
    background: 'var(--space-elev-2)',
    color: 'var(--txt-dim)',
    border: '1px solid var(--hairline)',
  },
};

export default function ListaCompras() {
  const [aba, setAba] = useState('lista');

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Tabs */}
      <div style={{
        display: 'inline-flex',
        gap: 2,
        padding: 4,
        background: 'var(--space-elev)',
        border: '1px solid var(--hairline)',
        borderRadius: 12,
        marginBottom: 20,
      }}>
        {[
          { id: 'lista', icon: <ShoppingCart size={14} strokeWidth={1.75} />, label: 'Lista Ativa' },
          { id: 'catalogo', icon: <Star size={14} strokeWidth={1.75} />, label: 'Meus Itens' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setAba(tab.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', border: 'none', transition: 'all 0.15s',
            background: aba === tab.id ? 'var(--accent)' : 'transparent',
            color: aba === tab.id ? '#fff' : 'var(--txt-dim)',
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {aba === 'lista'
        ? <AbaLista onVerCatalogo={() => setAba('catalogo')} />
        : <AbaCatalogo />}
    </div>
  );
}

/* ─────────────────── ABA LISTA ATIVA ─────────────────── */
function AbaLista({ onVerCatalogo }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(FORM_VAZIO);
  const [editando, setEditando] = useState(null);
  const [formAberto, setFormAberto] = useState(false);

  const {
    lista: itens, online, syncing, loading: isLoading, qtdFila,
    buscar, adicionarItem, marcarItem, removerItem, editarItem,
  } = useListaOffline();

  const { data: sugestoes = [] } = useQuery({
    queryKey: ['lista-compras-sugestoes'],
    queryFn: () => api.get('/lista-compras/sugestoes'),
    enabled: online,
  });
  const { data: catalogo = [] } = useQuery({
    queryKey: ['catalogo-compras'],
    queryFn: () => api.get('/lista-compras/catalogo'),
    enabled: online,
  });

  const limparComprados = useMutation({
    mutationFn: () => api.del('/lista-compras/comprados/limpar'),
    onSuccess: () => { buscar(); toast.success('Itens comprados removidos!'); },
  });

  const lancarDespesa = useMutation({
    mutationFn: (body) => api.post('/despesas', body),
    onSuccess: (_, vars) => toast.success(`R$ ${vars.valor.toFixed(2).replace('.', ',')} lançado nas despesas!`),
    onError: (e) => toast.error(e.message),
  });

  const salvarCatalogo = (item) => {
    if (!online) { toast.error('Sem conexão — não é possível salvar no catálogo agora'); return; }
    api.post('/lista-compras/catalogo', {
      nome: item.nome, quantidade: item.quantidade,
      unidade: item.unidade, observacao: item.observacao,
    }).then(() => {
      qc.invalidateQueries(['catalogo-compras']);
      toast.success(`"${item.nome}" salvo no catálogo!`);
    }).catch(e => toast.error(e.message === 'Item já está no catálogo' ? `"${item.nome}" já está no catálogo` : e.message));
  };

  const adicionarSugestao = (s) => {
    adicionarItem({ nome: s.nome, quantidade: 1, unidade: s.unidade_medida, ingrediente_id: s.id });
  };

  const enviarWhatsApp = () => {
    if (!pendentes.length) { toast.error('Nenhum item pendente!'); return; }
    const texto = [
      '🛒 *Lista de Compras — Sushi Finance*', '',
      ...pendentes.map(i => `▫️ ${i.nome}${i.observacao ? ` (${i.observacao})` : ''}`),
      '', `_${pendentes.length} item(s) · ${new Date().toLocaleDateString('pt-BR')}_`,
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const pendentes = itens.filter(i => !i.comprado);
  const comprados = itens.filter(i => i.comprado);
  const totalGasto = comprados.reduce((a, d) => a + (d.valor_pago ?? 0), 0);
  const total = itens.length;
  const pct = total > 0 ? Math.round((comprados.length / total) * 100) : 0;
  const nomesNoCatalogo = new Set(catalogo.map(c => c.nome.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Banners offline/sync */}
      {!online && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          borderRadius: 10, background: '#92400e22', border: '1px solid #d97706',
          color: '#d97706',
        }}>
          <WifiOff size={16} strokeWidth={1.75} style={{ flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>Modo offline — lista salva localmente</p>
            {qtdFila > 0 && <p style={{ fontSize: 11, opacity: 0.8, margin: '2px 0 0' }}>{qtdFila} alteração(ões) aguardando sincronização</p>}
          </div>
        </div>
      )}
      {online && syncing && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
          borderRadius: 10, background: '#1e40af22', border: '1px solid #3b82f6', color: '#3b82f6',
        }}>
          <RefreshCw size={16} strokeWidth={1.75} style={{ flexShrink: 0, animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: 13, fontWeight: 500, margin: 0 }}>Sincronizando alterações offline…</p>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--txt-strong)', margin: 0 }}>Lista de Compras</h1>
          <p style={{ fontSize: 13, color: 'var(--txt-dim)', margin: '3px 0 0' }}>
            {total === 0 ? 'Lista vazia' : `${pendentes.length} pendente${pendentes.length !== 1 ? 's' : ''} · ${comprados.length} comprado${comprados.length !== 1 ? 's' : ''}`}
            {!online && <span style={{ color: '#d97706', fontWeight: 600, marginLeft: 6 }}>· offline</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={onVerCatalogo} style={S.btn} disabled={!online}>
            <Star size={13} strokeWidth={1.75} /> Usar catálogo
          </button>
          {comprados.length > 0 && (
            <button
              onClick={() => limparComprados.mutate()}
              style={{ ...S.btn, color: '#ef4444', borderColor: '#ef44441a' }}
              disabled={!online || limparComprados.isPending}
            >
              <Trash2 size={13} strokeWidth={1.75} /> Limpar comprados
            </button>
          )}
          <button onClick={enviarWhatsApp} style={{
            ...S.btn, background: '#22c55e', color: '#fff', border: 'none',
          }}>
            <WhatsAppIcon /> WhatsApp
          </button>
        </div>
      </div>

      {/* Cards de resumo */}
      {total > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <CardResumo
            icon="🛒" cor="#f59e0b" label="A comprar"
            valor={String(pendentes.length)} sub={`de ${total} itens`}
          />
          <CardResumo
            icon="✅" cor="#10b981" label="Comprados"
            valor={String(comprados.length)}
            sub={pct > 0 ? `${pct}% concluído` : 'nenhum ainda'}
          />
          <CardResumo
            icon="💰" cor="#6366f1" label="Total gasto"
            valor={brl(totalGasto)} sub="itens com valor"
          />
        </div>
      )}

      {/* Barra de progresso */}
      {total > 0 && (
        <div style={S.cardPad}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ListChecks size={14} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
              {comprados.length} de {total} comprados
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: pct === 100 ? '#10b981' : 'var(--txt-dim)' }}>{pct}%</span>
          </div>
          <div style={{ height: 7, borderRadius: 99, background: 'var(--space-elev-2)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 99,
              background: pct === 100 ? '#10b981' : 'var(--accent)',
              width: `${pct}%`, transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}

      {/* Sugestões de estoque zerado */}
      {online && sugestoes.length > 0 && (
        <div style={S.cardPad}>
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#d97706', margin: '0 0 10px' }}>
            <AlertTriangle size={14} strokeWidth={1.75} /> Estoque zerado — adicionar à lista?
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {sugestoes.map(s => (
              <button key={s.id} onClick={() => adicionarSugestao(s)} style={{
                ...S.tag,
                background: '#92400e22', color: '#d97706', border: '1px solid #d9770644',
                cursor: 'pointer', padding: '4px 10px',
              }}>
                + {s.nome} <span style={{ opacity: 0.7 }}>({s.unidade_medida})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Formulário adicionar */}
      <div style={S.cardPad}>
        <button
          onClick={() => setFormAberto(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--txt)', padding: 0,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
            <Plus size={15} strokeWidth={2} style={{ color: 'var(--accent)' }} /> Adicionar item à lista
          </span>
          <ChevronRight size={15} strokeWidth={1.75} style={{
            color: 'var(--txt-dim)', transition: 'transform 0.2s',
            transform: formAberto ? 'rotate(90deg)' : 'none',
          }} />
        </button>
        {formAberto && (
          <form
            onSubmit={e => { e.preventDefault(); adicionarItem(form); setForm(FORM_VAZIO); }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}
          >
            <input className="input" style={{ flex: '1 1 180px' }} placeholder="Nome do item…" value={form.nome}
              onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} required />
            <input type="number" className="input" style={{ width: 80 }} placeholder="Qtd" min="0.01" step="0.01"
              value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} />
            <select className="input" style={{ width: 110 }} value={form.unidade}
              onChange={e => setForm(p => ({ ...p, unidade: e.target.value }))}>
              {UNIDADES.map(u => <option key={u}>{u}</option>)}
            </select>
            <input className="input" style={{ flex: '1 1 140px' }} placeholder="Observação (opcional)" value={form.observacao}
              onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))} />
            <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
              + Adicionar
            </button>
            {!online && (
              <p style={{ width: '100%', fontSize: 11, color: '#d97706', display: 'flex', alignItems: 'center', gap: 4, margin: '2px 0 0' }}>
                <WifiOff size={11} strokeWidth={1.75} /> Offline — item salvo localmente e sincronizado ao reconectar
              </p>
            )}
          </form>
        )}
      </div>

      {/* Listas */}
      {isLoading && !itens.length ? <PageLoading /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!itens.length && (
            <div style={{ ...S.card, padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🛒</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--txt)', margin: 0 }}>Lista vazia</p>
              <p style={{ fontSize: 13, color: 'var(--txt-dim)', margin: '6px 0 0' }}>
                Adicione itens acima ou use o catálogo de itens salvos
              </p>
            </div>
          )}

          {pendentes.length > 0 && (
            <div style={S.card}>
              <div style={S.headerSection}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>
                  <ShoppingCart size={14} strokeWidth={1.75} style={{ color: '#f59e0b' }} />
                  Pendentes
                  <span style={S.badge('#f59e0b')}>{pendentes.length}</span>
                </span>
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {pendentes.map((item, i) => (
                  <li key={item.id} style={i > 0 ? S.divider : {}}>
                    <ItemLinha item={item} editando={editando} setEditando={setEditando}
                      noCatalogo={nomesNoCatalogo.has(item.nome.toLowerCase())}
                      online={online}
                      onMarcar={(c, vp, qtd, un) => marcarItem(item.id, c, { valor_pago: vp, qtd_comprada: qtd, unidade_comprada: un })}
                      onRemover={() => removerItem(item.id)}
                      onSalvar={(f) => { editarItem(item.id, f); setEditando(null); }}
                      onSalvarCatalogo={() => salvarCatalogo(item)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {comprados.length > 0 && (
            <div style={S.card}>
              <div style={{ ...S.headerSection, background: '#10b98115' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: '#10b981' }}>
                  <CheckCircle2 size={14} strokeWidth={1.75} />
                  Comprados
                  <span style={S.badge('#10b981')}>{comprados.length}</span>
                  {totalGasto > 0 && (
                    <span style={{ ...S.badge('#10b981'), marginLeft: 4 }}>
                      <Coins size={11} strokeWidth={1.75} /> {brl(totalGasto)}
                    </span>
                  )}
                </span>
                {online && comprados.some(d => d.valor_pago > 0) && (
                  <button
                    onClick={() => {
                      const tot = comprados.reduce((a, d) => a + (d.valor_pago ?? 0), 0);
                      const qtd = comprados.filter(d => d.valor_pago > 0).length;
                      const hoje = new Date().toISOString().slice(0, 10);
                      lancarDespesa.mutate({
                        descricao: `Compras do mercado — ${qtd} item(s)`,
                        categoria: 'variavel', tipo: 'Mercado',
                        valor: tot, data_competencia: hoje, recorrente: false,
                      });
                    }}
                    disabled={lancarDespesa.isPending}
                    style={{ ...S.btn, color: '#10b981', borderColor: '#10b98133', fontSize: 12, padding: '4px 10px' }}
                  >
                    <Banknote size={13} strokeWidth={1.75} /> Lançar nas Despesas
                  </button>
                )}
              </div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {comprados.map((item, i) => (
                  <li key={item.id} style={i > 0 ? S.divider : {}}>
                    <ItemLinha item={item} editando={editando} setEditando={setEditando}
                      noCatalogo={nomesNoCatalogo.has(item.nome.toLowerCase())}
                      online={online}
                      onMarcar={(c, vp, qtd, un) => marcarItem(item.id, c, { valor_pago: vp, qtd_comprada: qtd, unidade_comprada: un })}
                      onRemover={() => removerItem(item.id)}
                      onSalvar={(f) => { editarItem(item.id, f); setEditando(null); }}
                      onSalvarCatalogo={() => salvarCatalogo(item)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────── CARD RESUMO ─────────────────── */
function CardResumo({ icon, cor, label, valor, sub }) {
  return (
    <div style={{
      ...S.cardPad,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={S.iconBox(cor)}>{icon}</div>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--txt-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      </div>
      <p style={{ fontSize: 20, fontWeight: 700, color: cor, margin: 0, lineHeight: 1 }}>{valor}</p>
      <p style={{ fontSize: 11, color: 'var(--txt-dim)', margin: 0 }}>{sub}</p>
    </div>
  );
}

/* ─────────────────── ABA CATÁLOGO ─────────────────── */
function AbaCatalogo() {
  const qc = useQueryClient();
  const [selecionados, setSelecionados] = useState(new Set());
  const [form, setForm] = useState(FORM_VAZIO);
  const [editando, setEditando] = useState(null);
  const [formEdit, setFormEdit] = useState(FORM_VAZIO);
  const [formAberto, setFormAberto] = useState(false);

  const { data: catalogo = [], isLoading } = useQuery({
    queryKey: ['catalogo-compras'],
    queryFn: () => api.get('/lista-compras/catalogo'),
  });

  const adicionar = useMutation({
    mutationFn: (f) => api.post('/lista-compras/catalogo', f),
    onSuccess: () => { qc.invalidateQueries(['catalogo-compras']); setForm(FORM_VAZIO); setFormAberto(false); toast.success('Salvo no catálogo!'); },
    onError: (e) => toast.error(e.message),
  });

  const atualizar = useMutation({
    mutationFn: ({ id, ...f }) => api.put(`/lista-compras/catalogo/${id}`, f),
    onSuccess: () => { qc.invalidateQueries(['catalogo-compras']); setEditando(null); toast.success('Atualizado!'); },
  });

  const remover = useMutation({
    mutationFn: (id) => api.del(`/lista-compras/catalogo/${id}`),
    onSuccess: () => { qc.invalidateQueries(['catalogo-compras']); setSelecionados(new Set()); },
  });

  const adicionarNaLista = useMutation({
    mutationFn: (ids) => api.post('/lista-compras/catalogo/adicionar-lista', { ids }),
    onSuccess: () => {
      qc.invalidateQueries(['lista-compras']);
      setSelecionados(new Set());
      toast.success(`${selecionados.size} item(s) adicionado(s) à lista!`);
    },
    onError: (e) => toast.error(e.message),
  });

  const enviarWhatsAppDireto = () => {
    const itens = catalogo.filter(c => selecionados.has(c.id));
    if (!itens.length) { toast.error('Selecione pelo menos um item!'); return; }
    const texto = [
      '🛒 *Lista de Compras — Sushi Finance*', '',
      ...itens.map(i => `▫️ ${i.nome}${i.observacao ? ` (${i.observacao})` : ''}`),
      '', `_${itens.length} item(s) · ${new Date().toLocaleDateString('pt-BR')}_`,
    ].join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
  };

  const toggleItem = (id) => {
    setSelecionados(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleTodos = () => {
    if (selecionados.size === catalogo.length) setSelecionados(new Set());
    else setSelecionados(new Set(catalogo.map(c => c.id)));
  };

  const abrirEditar = (item) => {
    setFormEdit({ nome: item.nome, quantidade: item.quantidade, unidade: item.unidade, observacao: item.observacao || '' });
    setEditando(item.id);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--txt-strong)', margin: 0 }}>Meus Itens</h1>
          <p style={{ fontSize: 13, color: 'var(--txt-dim)', margin: '3px 0 0' }}>
            {catalogo.length} item(s) salvos
            {selecionados.size > 0 && <span style={{ color: 'var(--accent)', fontWeight: 600 }}> · {selecionados.size} selecionado(s)</span>}
          </p>
        </div>
        {selecionados.size > 0 && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => adicionarNaLista.mutate([...selecionados])} style={S.btn}>
              <ShoppingCart size={13} strokeWidth={1.75} /> Adicionar à lista ({selecionados.size})
            </button>
            <button onClick={enviarWhatsAppDireto} style={{ ...S.btn, background: '#22c55e', color: '#fff', border: 'none' }}>
              <WhatsAppIcon /> WhatsApp
            </button>
          </div>
        )}
      </div>

      {/* Formulário novo item */}
      <div style={S.cardPad}>
        <button
          onClick={() => setFormAberto(p => !p)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--txt)', padding: 0,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
            <Sparkles size={14} strokeWidth={1.75} style={{ color: 'var(--accent)' }} /> Adicionar ao catálogo
          </span>
          <ChevronRight size={15} strokeWidth={1.75} style={{
            color: 'var(--txt-dim)', transition: 'transform 0.2s',
            transform: formAberto ? 'rotate(90deg)' : 'none',
          }} />
        </button>
        {formAberto && (
          <form onSubmit={e => { e.preventDefault(); adicionar.mutate(form); }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            <input className="input" style={{ flex: '1 1 180px' }} placeholder="Nome do item…" value={form.nome}
              onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} required />
            <input type="number" className="input" style={{ width: 80 }} placeholder="Qtd" min="0.01" step="0.01"
              value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} />
            <select className="input" style={{ width: 110 }} value={form.unidade}
              onChange={e => setForm(p => ({ ...p, unidade: e.target.value }))}>
              {UNIDADES.map(u => <option key={u}>{u}</option>)}
            </select>
            <input className="input" style={{ flex: '1 1 140px' }} placeholder="Observação (opcional)" value={form.observacao}
              onChange={e => setForm(p => ({ ...p, observacao: e.target.value }))} />
            <button type="submit" className="btn-primary" style={{ whiteSpace: 'nowrap' }}>Salvar</button>
          </form>
        )}
      </div>

      {isLoading ? <PageLoading /> : catalogo.length === 0 ? (
        <div style={{ ...S.card, padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>⭐</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--txt)', margin: 0 }}>Catálogo vazio</p>
          <p style={{ fontSize: 13, color: 'var(--txt-dim)', margin: '6px 0 0' }}>
            Salve itens frequentes aqui para reutilizar rapidamente
          </p>
        </div>
      ) : (
        <div style={S.card}>
          {/* Header com seleção */}
          <div style={S.headerSection}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--txt-dim)', fontWeight: 500 }}>
              <input type="checkbox"
                checked={selecionados.size === catalogo.length && catalogo.length > 0}
                onChange={toggleTodos}
                style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              {selecionados.size === catalogo.length && catalogo.length > 0 ? 'Desselecionar todos' : 'Selecionar todos'}
            </label>
            <span style={S.badge('var(--accent)')}>{catalogo.length} itens</span>
          </div>

          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {catalogo.map((item, i) => (
              <li key={item.id} style={i > 0 ? S.divider : {}}>
                {editando === item.id ? (
                  <div style={{ padding: '12px 16px' }}>
                    <form onSubmit={e => { e.preventDefault(); atualizar.mutate({ id: item.id, ...formEdit }); }}
                      style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      <input className="input" style={{ flex: '1 1 140px' }} value={formEdit.nome}
                        onChange={e => setFormEdit(p => ({ ...p, nome: e.target.value }))} required />
                      <input type="number" className="input" style={{ width: 76 }} value={formEdit.quantidade}
                        onChange={e => setFormEdit(p => ({ ...p, quantidade: e.target.value }))} />
                      <select className="input" style={{ width: 100 }} value={formEdit.unidade}
                        onChange={e => setFormEdit(p => ({ ...p, unidade: e.target.value }))}>
                        {UNIDADES.map(u => <option key={u}>{u}</option>)}
                      </select>
                      <input className="input" style={{ flex: '1 1 120px' }} placeholder="Obs." value={formEdit.observacao}
                        onChange={e => setFormEdit(p => ({ ...p, observacao: e.target.value }))} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="submit" className="btn-primary btn-sm">Salvar</button>
                        <button type="button" onClick={() => setEditando(null)} style={S.btnIcon}><X size={14} strokeWidth={2} /></button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div
                    onClick={() => toggleItem(item.id)}
                    style={{
                      ...S.row,
                      background: selecionados.has(item.id) ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <input type="checkbox" checked={selecionados.has(item.id)} onChange={() => toggleItem(item.id)}
                      onClick={e => e.stopPropagation()}
                      style={{ width: 16, height: 16, accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, background: 'var(--space-elev-2)', fontSize: 16, flexShrink: 0 }}>
                      📦
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt-strong)' }}>{item.nome}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                        <span style={S.tag}>{item.quantidade} {item.unidade}</span>
                        {item.observacao && <span style={{ fontSize: 11, color: 'var(--txt-dim)', fontStyle: 'italic' }}>{item.observacao}</span>}
                        {item.ultimo_preco != null && (
                          <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                            último: {brl(item.ultimo_preco)}
                            {item.ultimo_preco_em && <span style={{ color: 'var(--txt-dim)', fontWeight: 400 }}> em {new Date(item.ultimo_preco_em).toLocaleDateString('pt-BR')}</span>}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => abrirEditar(item)} style={S.btnIcon} title="Editar">
                        <Pencil size={13} strokeWidth={1.75} />
                      </button>
                      <button onClick={() => remover.mutate(item.id)}
                        style={{ ...S.btnIcon, color: '#ef4444', borderColor: '#ef44441a' }} title="Remover">
                        <Trash2 size={13} strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── ITEM DA LISTA ─────────────────── */
function ItemLinha({ item, editando, setEditando, noCatalogo, online, onMarcar, onRemover, onSalvar, onSalvarCatalogo }) {
  const [formEdit, setFormEdit] = useState({
    nome: item.nome, quantidade: item.quantidade,
    unidade: item.unidade, observacao: item.observacao || '',
  });
  const [modalPreco, setModalPreco] = useState(false);
  const [valorPago, setValorPago] = useState('');
  const [qtdComprada, setQtdComprada] = useState(String(item.quantidade));
  const [unidadeComprada, setUnidadeComprada] = useState(item.unidade);
  const inputRef = useRef(null);

  useEffect(() => {
    if (modalPreco && inputRef.current) inputRef.current.focus();
  }, [modalPreco]);

  const confirmarCompra = (comValor) => {
    onMarcar(true, comValor ? Number(valorPago) : null, Number(qtdComprada), unidadeComprada);
    setModalPreco(false);
    setValorPago('');
  };

  if (editando === item.id) {
    return (
      <div style={{ padding: '12px 16px' }}>
        <form onSubmit={e => { e.preventDefault(); onSalvar(formEdit); }}
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <input className="input" style={{ flex: '1 1 140px' }} value={formEdit.nome}
            onChange={e => setFormEdit(p => ({ ...p, nome: e.target.value }))} required />
          <input type="number" className="input" style={{ width: 76 }} value={formEdit.quantidade}
            onChange={e => setFormEdit(p => ({ ...p, quantidade: e.target.value }))} />
          <select className="input" style={{ width: 100 }} value={formEdit.unidade}
            onChange={e => setFormEdit(p => ({ ...p, unidade: e.target.value }))}>
            {UNIDADES.map(u => <option key={u}>{u}</option>)}
          </select>
          <input className="input" style={{ flex: '1 1 120px' }} placeholder="Obs." value={formEdit.observacao}
            onChange={e => setFormEdit(p => ({ ...p, observacao: e.target.value }))} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="submit" className="btn-primary btn-sm">Salvar</button>
            <button type="button" onClick={() => setEditando(null)} style={S.btnIcon}><X size={14} strokeWidth={2} /></button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div style={{ ...S.row, opacity: item.comprado ? 0.65 : 1 }}>
        {/* Checkbox */}
        <input
          type="checkbox" checked={!!item.comprado}
          onChange={e => { if (e.target.checked) setModalPreco(true); else onMarcar(false, null); }}
          style={{ width: 17, height: 17, accentColor: '#10b981', cursor: 'pointer', flexShrink: 0 }}
        />

        {/* Ícone */}
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: item.comprado ? '#10b98120' : 'var(--space-elev-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>
          {item.comprado ? '✅' : '🛒'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 13, fontWeight: 600,
              color: item.comprado ? 'var(--txt-dim)' : 'var(--txt-strong)',
              textDecoration: item.comprado ? 'line-through' : 'none',
            }}>
              {item.nome}
            </span>
            {item.id < 0 && (
              <span style={S.badge('#d97706')}>pendente</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
            {item.observacao && <span style={{ fontSize: 11, color: 'var(--txt-dim)', fontStyle: 'italic' }}>{item.observacao}</span>}
            {item.comprado && item.valor_pago != null && (
              <span style={S.badge('#10b981')}>
                <Coins size={11} strokeWidth={1.75} /> {brl(item.valor_pago)}
                {item.qtd_comprada > 0 && <span style={{ fontWeight: 400 }}> · {item.qtd_comprada} {item.unidade_comprada}</span>}
              </span>
            )}
          </div>
        </div>

        {/* Ações sempre visíveis */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {!item.comprado && (
            <>
              <button onClick={() => setEditando(item.id)} style={S.btnIcon} title="Editar">
                <Pencil size={13} strokeWidth={1.75} />
              </button>
              <button
                onClick={onSalvarCatalogo}
                style={{ ...S.btnIcon, color: noCatalogo ? '#f59e0b' : 'var(--txt-dim)', borderColor: noCatalogo ? '#f59e0b33' : 'var(--hairline)' }}
                title={noCatalogo ? 'Já está no catálogo' : 'Salvar no catálogo'}
              >
                <Star size={13} strokeWidth={1.75} fill={noCatalogo ? 'currentColor' : 'none'} />
              </button>
            </>
          )}
          <button onClick={onRemover} style={{ ...S.btnIcon, color: '#ef4444', borderColor: '#ef44441a' }} title="Remover">
            <Trash2 size={13} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {/* Modal de preço inline */}
      {modalPreco && (
        <div style={{
          margin: '0 16px 12px',
          padding: '14px 16px',
          borderRadius: 12,
          border: '1.5px solid #10b98155',
          background: '#10b98110',
        }}>
          <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#10b981', margin: '0 0 12px' }}>
            <ShoppingCart size={14} strokeWidth={1.75} />
            Registrar compra de <strong>{item.nome}</strong>
            {!online && <span style={{ fontSize: 11, color: '#d97706', fontWeight: 500 }}>(offline)</span>}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#10b981', display: 'block', marginBottom: 4 }}>Quantidade comprada</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="number" step="0.01" min="0" placeholder="1" value={qtdComprada}
                  onChange={e => setQtdComprada(e.target.value)}
                  className="input" style={{ width: 72 }} />
                <select value={unidadeComprada} onChange={e => setUnidadeComprada(e.target.value)} className="input" style={{ flex: 1 }}>
                  {UNIDADES.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#10b981', display: 'block', marginBottom: 4 }}>Valor pago (R$)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--txt-dim)' }}>R$</span>
                <input ref={inputRef} type="number" step="0.01" min="0" placeholder="0,00"
                  value={valorPago} onChange={e => setValorPago(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') confirmarCompra(true); if (e.key === 'Escape') setModalPreco(false); }}
                  className="input" style={{ paddingLeft: 32 }} />
              </div>
            </div>
          </div>
          {valorPago && qtdComprada && Number(qtdComprada) > 0 && (
            <p style={{ fontSize: 11, color: '#10b981', margin: '0 0 10px' }}>
              ≈ <strong>{brl(Number(valorPago) / Number(qtdComprada))}</strong> por {unidadeComprada}
            </p>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => confirmarCompra(true)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: '#10b981', color: '#fff', border: 'none', cursor: 'pointer',
            }}>
              <Check size={13} strokeWidth={2.5} /> Confirmar
            </button>
            <button onClick={() => confirmarCompra(false)} style={{
              ...S.btn, fontSize: 12, padding: '5px 10px',
            }}>
              Pular valor
            </button>
            <button onClick={() => setModalPreco(false)} style={{ ...S.btnIcon, marginLeft: 'auto' }}>
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'currentColor' }} xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
