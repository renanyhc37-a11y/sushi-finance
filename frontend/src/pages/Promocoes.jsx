import React, { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { getToken } from '../hooks/useAuth';

const BASE = import.meta.env.VITE_API_URL || '/api';
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function authH() { return { Authorization: `Bearer ${getToken()}` }; }
function authJ() { return { ...authH(), 'Content-Type': 'application/json' }; }

// ─────────────────────────────────────────────
// PROMOÇÕES
// ─────────────────────────────────────────────

function ModalPromo({ promo, onClose, onSalvo }) {
  const editando = !!promo?.id;
  const [form, setForm] = useState({
    nome: promo?.nome || '',
    descricao: promo?.descricao || '',
    tipo: promo?.tipo || 'pedidos',
    meta: promo?.meta || 5,
    recompensa: promo?.recompensa || '',
    emoji: promo?.emoji || '🎁',
  });
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!form.nome.trim()) return toast.error('Nome obrigatório');
    if (!form.recompensa.trim()) return toast.error('Informe a recompensa');
    setSalvando(true);
    try {
      const url = editando ? `${BASE}/promocoes/${promo.id}` : `${BASE}/promocoes`;
      const method = editando ? 'PATCH' : 'POST';
      const r = await fetch(url, { method, headers: authJ(), body: JSON.stringify(form) });
      if (!r.ok) throw new Error((await r.json()).erro || 'Erro');
      toast.success(editando ? 'Promoção atualizada!' : 'Promoção criada!');
      onSalvo();
    } catch (e) { toast.error(e.message); }
    setSalvando(false);
  }

  const input = 'w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-orange-500/40';
  const iStyle = { background: '#1a1a1a', border: '1px solid #2a2a2a' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#111', border: '1px solid #252525' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1e1e1e' }}>
          <h2 className="font-bold text-white">{editando ? '✏️ Editar Promoção' : '🎯 Nova Promoção'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex gap-2">
            <div className="w-16">
              <label className="text-xs text-zinc-500 mb-1 block">Emoji</label>
              <input className={input} style={iStyle} value={form.emoji}
                onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-zinc-500 mb-1 block">Nome da promoção</label>
              <input className={input} style={iStyle} placeholder="Ex: Clube Sushi Lover"
                value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Descrição (opcional)</label>
            <input className={input} style={iStyle} placeholder="Ex: A cada 5 pedidos ganhe um temaki grátis"
              value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Tipo</label>
              <select className={input} style={iStyle} value={form.tipo}
                onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                <option value="pedidos">Por pedidos</option>
                <option value="valor">Por valor gasto</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">
                Meta ({form.tipo === 'pedidos' ? 'pedidos' : 'R$'})
              </label>
              <input type="number" className={input} style={iStyle} min={1}
                value={form.meta} onChange={e => setForm(p => ({ ...p, meta: Number(e.target.value) }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Recompensa</label>
            <input className={input} style={iStyle} placeholder="Ex: Temaki grátis, 20% de desconto..."
              value={form.recompensa} onChange={e => setForm(p => ({ ...p, recompensa: e.target.value }))} />
          </div>
          <button onClick={salvar} disabled={salvando}
            className="w-full py-3 rounded-xl font-bold text-white text-sm mt-1 transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', opacity: salvando ? 0.6 : 1 }}>
            {salvando ? '...' : editando ? 'Salvar alterações' : 'Criar promoção'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalParticipantes({ promo, onClose }) {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/promocoes/${promo.id}/participantes`, { headers: authH() })
      .then(r => r.json()).then(d => setLista(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setCarregando(false));
  }, [promo.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden flex flex-col"
        style={{ background: '#111', border: '1px solid #252525', maxHeight: '80vh' }}>
        <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #1e1e1e' }}>
          <div>
            <h2 className="font-bold text-white">{promo.emoji} {promo.nome}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Participantes · meta: {promo.meta} {promo.tipo}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-3 space-y-2">
          {carregando && <p className="text-center text-zinc-500 py-8">Carregando...</p>}
          {!carregando && lista.length === 0 && (
            <p className="text-center text-zinc-600 py-8">Nenhum participante ainda</p>
          )}
          {lista.map(p => {
            const pct = Math.min(100, Math.round((p.progresso / promo.meta) * 100));
            return (
              <div key={p.id} className="rounded-xl p-3 flex items-center gap-3"
                style={{ background: '#1a1a1a', border: '1px solid #252525' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                  style={{ background: '#252525', color: 'var(--accent)' }}>
                  {p.nome?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-white truncate">{p.nome}</span>
                    <span className="text-xs shrink-0" style={{ color: p.completado ? '#22c55e' : 'var(--accent)' }}>
                      {p.progresso}/{promo.meta}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#252525' }}>
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: p.completado ? '#22c55e' : 'linear-gradient(90deg,var(--accent),var(--accent-2))' }} />
                  </div>
                </div>
                {p.completado && !p.recompensa_resgatada && (
                  <span className="text-xs font-bold px-2 py-1 rounded-lg shrink-0"
                    style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                    🎁 Pronto
                  </span>
                )}
                {p.recompensa_resgatada && (
                  <span className="text-xs px-2 py-1 rounded-lg shrink-0"
                    style={{ background: '#1e1e1e', color: '#555' }}>✓ Resgatado</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TabPromocoes() {
  const [promos, setPromos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(null); // null | 'criar' | { promo } para editar
  const [participantes, setParticipantes] = useState(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    fetch(`${BASE}/promocoes`, { headers: authH() })
      .then(r => r.json()).then(d => setPromos(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setCarregando(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function toggleAtivo(promo) {
    await fetch(`${BASE}/promocoes/${promo.id}`, {
      method: 'PATCH', headers: authJ(),
      body: JSON.stringify({ ativo: promo.ativo ? 0 : 1 }),
    });
    carregar();
  }

  async function deletar(promo) {
    if (!confirm(`Deletar a promoção "${promo.nome}"? Esta ação não pode ser desfeita.`)) return;
    await fetch(`${BASE}/promocoes/${promo.id}`, { method: 'DELETE', headers: authH() });
    toast.success('Promoção removida');
    carregar();
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-zinc-500">
            {promos.filter(p => p.ativo).length} ativa{promos.filter(p => p.ativo).length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setModal('criar')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
          + Nova Promoção
        </button>
      </div>

      {carregando && (
        <div className="text-center py-16 text-zinc-500">Carregando...</div>
      )}

      {!carregando && promos.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">🎯</div>
          <p className="text-zinc-400 font-semibold">Nenhuma promoção criada</p>
          <p className="text-zinc-600 text-sm mt-1">Crie promoções de fidelidade para seus clientes</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {promos.map(p => (
          <div key={p.id} className="rounded-2xl overflow-hidden"
            style={{ background: '#111', border: `1px solid ${p.ativo ? 'rgba(var(--accent-rgb),0.2)' : '#1e1e1e'}` }}>

            {/* Top bar */}
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0"
                  style={{ background: p.ativo ? 'rgba(var(--accent-rgb),0.12)' : '#1a1a1a' }}>
                  {p.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-sm truncate">{p.nome}</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        background: p.ativo ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                        color: p.ativo ? '#22c55e' : '#555',
                        border: `1px solid ${p.ativo ? 'rgba(34,197,94,0.3)' : '#222'}`,
                      }}>
                      {p.ativo ? 'ATIVA' : 'INATIVA'}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Meta: {p.meta} {p.tipo === 'pedidos' ? 'pedidos' : `R$ em compras`} · {p.recompensa}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 divide-x" style={{ borderTop: '1px solid #1e1e1e', divideColor: '#1e1e1e' }}>
              {[
                { label: 'Inscritos', valor: p.inscritos || 0, cor: 'var(--accent)' },
                { label: 'Completos', valor: p.completados || 0, cor: '#22c55e' },
                { label: 'Resgatados', valor: p.resgatados || 0, cor: '#a78bfa' },
              ].map(s => (
                <div key={s.label} className="py-2.5 text-center" style={{ borderRight: '1px solid #1e1e1e' }}>
                  <div className="text-lg font-black" style={{ color: s.cor }}>{s.valor}</div>
                  <div className="text-[10px] text-zinc-600">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Ações */}
            <div className="px-3 py-2.5 flex gap-2" style={{ borderTop: '1px solid #1e1e1e' }}>
              <button onClick={() => setParticipantes(p)}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: '#1a1a1a', color: '#888' }}>
                👥 Ver participantes
              </button>
              <button onClick={() => setModal(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: '#1a1a1a', color: '#aaa' }}>
                ✏️
              </button>
              <button onClick={() => toggleAtivo(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: p.ativo ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: p.ativo ? '#ef4444' : '#22c55e' }}>
                {p.ativo ? '⏸' : '▶'}
              </button>
              <button onClick={() => deletar(p)}
                className="px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal === 'criar' && (
        <ModalPromo onClose={() => setModal(null)} onSalvo={() => { setModal(null); carregar(); }} />
      )}
      {modal && modal !== 'criar' && (
        <ModalPromo promo={modal} onClose={() => setModal(null)} onSalvo={() => { setModal(null); carregar(); }} />
      )}
      {participantes && (
        <ModalParticipantes promo={participantes} onClose={() => setParticipantes(null)} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// CUPONS
// ─────────────────────────────────────────────

function ModalCupom({ cupom, onClose, onSalvo }) {
  const editando = !!cupom?.id;
  const [form, setForm] = useState({
    codigo: cupom?.codigo || '',
    descricao: cupom?.descricao || '',
    tipo: cupom?.tipo || 'percentual',
    valor: cupom?.valor || '',
    minimo: cupom?.minimo || 0,
    usos_maximos: cupom?.usos_maximos || 0,
    validade: cupom?.validade || '',
  });
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!form.codigo.trim()) return toast.error('Código obrigatório');
    if (!form.valor || Number(form.valor) <= 0) return toast.error('Valor inválido');
    setSalvando(true);
    try {
      const url = editando ? `${BASE}/cardapio/cupons/${cupom.id}` : `${BASE}/cardapio/cupons`;
      const method = editando ? 'PATCH' : 'POST';
      const r = await fetch(url, { method, headers: authJ(), body: JSON.stringify({ ...form, valor: Number(form.valor), minimo: Number(form.minimo), usos_maximos: Number(form.usos_maximos) }) });
      if (!r.ok) throw new Error((await r.json()).erro || 'Erro');
      toast.success(editando ? 'Cupom atualizado!' : 'Cupom criado!');
      onSalvo();
    } catch (e) { toast.error(e.message); }
    setSalvando(false);
  }

  const input = 'w-full px-3 py-2.5 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-orange-500/40';
  const iStyle = { background: '#1a1a1a', border: '1px solid #2a2a2a' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: '#111', border: '1px solid #252525' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1e1e1e' }}>
          <h2 className="font-bold text-white">{editando ? '✏️ Editar Cupom' : '🏷️ Novo Cupom'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Código do cupom</label>
            <input className={input} style={iStyle} placeholder="Ex: SUSHI10"
              value={form.codigo} disabled={editando}
              onChange={e => setForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))} />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Descrição (opcional)</label>
            <input className={input} style={iStyle} placeholder="Ex: 10% de desconto para novos clientes"
              value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Tipo</label>
              <select className={input} style={iStyle} value={form.tipo}
                onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                <option value="percentual">Percentual (%)</option>
                <option value="fixo">Valor fixo (R$)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">
                {form.tipo === 'percentual' ? 'Desconto (%)' : 'Desconto (R$)'}
              </label>
              <input type="number" className={input} style={iStyle} min={0} step={form.tipo === 'percentual' ? 1 : 0.01}
                value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Pedido mínimo (R$)</label>
              <input type="number" className={input} style={iStyle} min={0} step={0.01}
                value={form.minimo} onChange={e => setForm(p => ({ ...p, minimo: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Usos máximos (0 = ∞)</label>
              <input type="number" className={input} style={iStyle} min={0}
                value={form.usos_maximos} onChange={e => setForm(p => ({ ...p, usos_maximos: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Validade (opcional)</label>
            <input type="date" className={input} style={iStyle}
              value={form.validade} onChange={e => setForm(p => ({ ...p, validade: e.target.value }))} />
          </div>
          <button onClick={salvar} disabled={salvando}
            className="w-full py-3 rounded-xl font-bold text-white text-sm mt-1 transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', opacity: salvando ? 0.6 : 1 }}>
            {salvando ? '...' : editando ? 'Salvar alterações' : 'Criar cupom'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabCupons() {
  const [cupons, setCupons] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modal, setModal] = useState(null);

  const carregar = useCallback(() => {
    setCarregando(true);
    fetch(`${BASE}/cardapio/cupons`, { headers: authH() })
      .then(r => r.json()).then(d => setCupons(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setCarregando(false));
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function toggleAtivo(c) {
    await fetch(`${BASE}/cardapio/cupons/${c.id}`, {
      method: 'PATCH', headers: authJ(),
      body: JSON.stringify({ ativo: c.ativo ? 0 : 1 }),
    });
    carregar();
  }

  async function deletar(c) {
    if (!confirm(`Deletar o cupom "${c.codigo}"?`)) return;
    await fetch(`${BASE}/cardapio/cupons/${c.id}`, { method: 'DELETE', headers: authH() });
    toast.success('Cupom removido');
    carregar();
  }

  // Copy to clipboard
  function copiar(codigo) {
    navigator.clipboard.writeText(codigo).then(() => toast.success(`${codigo} copiado!`)).catch(() => {});
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-zinc-500">
          {cupons.filter(c => c.ativo).length} ativo{cupons.filter(c => c.ativo).length !== 1 ? 's' : ''}
        </p>
        <button onClick={() => setModal('criar')}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}>
          + Novo Cupom
        </button>
      </div>

      {carregando && <div className="text-center py-16 text-zinc-500">Carregando...</div>}

      {!carregando && cupons.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">🏷️</div>
          <p className="text-zinc-400 font-semibold">Nenhum cupom criado</p>
          <p className="text-zinc-600 text-sm mt-1">Crie cupons de desconto para seus clientes</p>
        </div>
      )}

      <div className="space-y-2">
        {cupons.map(c => {
          const esgotado = c.usos_maximos > 0 && c.usos_atuais >= c.usos_maximos;
          const expirado = c.validade && new Date(c.validade + 'T23:59:59') < new Date();
          const invalido = !c.ativo || esgotado || expirado;

          return (
            <div key={c.id} className="rounded-2xl overflow-hidden"
              style={{ background: '#111', border: `1px solid ${invalido ? '#1e1e1e' : 'rgba(var(--accent-rgb),0.2)'}` }}>
              <div className="px-4 py-3 flex items-center gap-3">
                {/* Código */}
                <button onClick={() => copiar(c.codigo)}
                  className="shrink-0 px-3 py-1.5 rounded-xl font-black text-sm tracking-widest transition-all active:scale-95"
                  style={{
                    background: invalido ? '#1a1a1a' : 'rgba(var(--accent-rgb),0.12)',
                    color: invalido ? '#555' : 'var(--accent)',
                    border: `1px dashed ${invalido ? '#2a2a2a' : 'rgba(var(--accent-rgb),0.4)'}`,
                    fontFamily: 'monospace',
                  }}
                  title="Copiar código">
                  {c.codigo}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-bold">
                      {c.tipo === 'percentual' ? `${c.valor}% off` : brl(c.valor) + ' off'}
                    </span>
                    {c.minimo > 0 && (
                      <span className="text-[11px] text-zinc-500">· mín. {brl(c.minimo)}</span>
                    )}
                    {esgotado && <span className="text-[10px] font-bold text-red-400">ESGOTADO</span>}
                    {expirado && <span className="text-[10px] font-bold text-red-400">EXPIRADO</span>}
                    {!c.ativo && !esgotado && !expirado && <span className="text-[10px] font-bold text-zinc-600">INATIVO</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-zinc-500">
                    {c.descricao && <span className="truncate">{c.descricao}</span>}
                    <span className="shrink-0">
                      {c.usos_atuais || 0}{c.usos_maximos > 0 ? `/${c.usos_maximos}` : ''} uso{(c.usos_atuais || 0) !== 1 ? 's' : ''}
                    </span>
                    {c.validade && <span className="shrink-0">até {new Date(c.validade + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => setModal(c)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
                    style={{ background: '#1a1a1a', color: '#aaa' }} title="Editar">
                    ✏️
                  </button>
                  <button onClick={() => toggleAtivo(c)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
                    style={{ background: c.ativo ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)', color: c.ativo ? '#ef4444' : '#22c55e' }}
                    title={c.ativo ? 'Desativar' : 'Ativar'}>
                    {c.ativo ? '⏸' : '▶'}
                  </button>
                  <button onClick={() => deletar(c)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }} title="Deletar">
                    🗑
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modal === 'criar' && (
        <ModalCupom onClose={() => setModal(null)} onSalvo={() => { setModal(null); carregar(); }} />
      )}
      {modal && modal !== 'criar' && (
        <ModalCupom cupom={modal} onClose={() => setModal(null)} onSalvo={() => { setModal(null); carregar(); }} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────

export default function Promocoes() {
  const [aba, setAba] = useState('promocoes');

  const abas = [
    { id: 'promocoes', label: '🎯 Promoções', desc: 'Fidelidade e recompensas' },
    { id: 'cupons', label: '🏷️ Cupons', desc: 'Códigos de desconto' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-white">Promoções & Cupons</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Gerencie fidelidade e descontos para seus clientes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-2xl" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
        {abas.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all"
            style={{
              background: aba === a.id ? 'linear-gradient(135deg, var(--accent), var(--accent-2))' : 'transparent',
              color: aba === a.id ? '#fff' : '#555',
            }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {aba === 'promocoes' && <TabPromocoes />}
      {aba === 'cupons' && <TabCupons />}
    </div>
  );
}
