import { useState, useEffect } from 'react';
import { getToken } from '../hooks/useAuth';
import toast from 'react-hot-toast';

const BASE = '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const authJ = () => ({ ...authH(), 'Content-Type': 'application/json' });
const IS = { background: '#161616', border: '1px solid #252525', color: '#e5e5e5' };

const TIPOS = [
  { id: 'reativacao', label: 'Reativação',  icon: '💤', desc: 'Clientes que sumiram' },
  { id: 'promocao',   label: 'Promoção',    icon: '🔥', desc: 'Oferta especial'     },
  { id: 'cupom',      label: 'Cupom',       icon: '🎟️', desc: 'Desconto exclusivo'  },
  { id: 'novidade',   label: 'Novidade',    icon: '✨', desc: 'Item novo no cardápio'},
  { id: 'fidelidade', label: 'Fidelidade',  icon: '⭐', desc: 'Clientes frequentes'  },
];

const FILTROS = [
  { id: 'inativos_7',  label: 'Inativos 7 dias'  },
  { id: 'inativos_30', label: 'Inativos 30 dias' },
  { id: 'inativos_60', label: 'Inativos 60 dias' },
];

function fmt(n) { return Number(n || 0).toFixed(2).replace('.', ','); }

export default function Campanhas() {
  const [aba, setAba] = useState('recuperar'); // recuperar | campanhas | cupons
  const [stats, setStats] = useState(null);
  const [inativos, setInativos] = useState([]);
  const [loadingInativos, setLoadingInativos] = useState(false);
  const [diasFiltro, setDiasFiltro] = useState(30);
  const [campanhas, setCampanhas] = useState([]);
  const [cupons, setCupons] = useState([]);
  const [selecionados, setSelecionados] = useState(new Set());
  const [resAberto, setResAberto] = useState(null);
  const [resultados, setResultados] = useState({});
  const [trafego, setTrafego] = useState(null);
  const [trafegoDias, setTrafegoDias] = useState(30);

  // Formulário nova campanha
  const [form, setForm] = useState({ titulo: '', tipo: 'reativacao', mensagem: '', cupom_codigo: '', filtro: 'inativos_30', dias_inativo: 30 });
  const [criando, setCriando] = useState(false);
  const [sugerindoIA, setSugerindoIA] = useState(false);
  const [sugestoes, setSugestoes] = useState([]);

  // Formulário novo cupom
  const [formCupom, setFormCupom] = useState({ codigo: '', descricao: '', tipo: 'percentual', valor: '', minimo: '', usos_maximos: '', validade: '' });
  const [criandoCupom, setCriandoCupom] = useState(false);
  const [mostrarFormCupom, setMostrarFormCupom] = useState(false);

  useEffect(() => { carregarStats(); carregarCampanhas(); carregarCupons(); }, []);

  async function carregarStats() {
    const r = await fetch(`${BASE}/campanhas/stats`, { headers: authH() });
    if (r.ok) setStats(await r.json());
  }

  async function carregarInativos(dias = diasFiltro) {
    setLoadingInativos(true);
    const r = await fetch(`${BASE}/campanhas/clientes-inativos?dias=${dias}&limite=200`, { headers: authH() });
    if (r.ok) setInativos(await r.json());
    setLoadingInativos(false);
  }

  async function carregarCampanhas() {
    const r = await fetch(`${BASE}/campanhas`, { headers: authH() });
    if (r.ok) setCampanhas(await r.json());
  }

  async function carregarCupons() {
    const r = await fetch(`${BASE}/campanhas/cupons`, { headers: authH() });
    if (r.ok) setCupons(await r.json());
  }

  async function sugerirIA() {
    setSugerindoIA(true);
    setSugestoes([]);
    const r = await fetch(`${BASE}/campanhas/sugerir-ia`, {
      method: 'POST', headers: authJ(),
      body: JSON.stringify({ tipo: form.tipo }),
    });
    const d = await r.json();
    if (d.sugestoes) setSugestoes(d.sugestoes);
    else toast.error(d.erro || 'Erro ao gerar sugestões');
    setSugerindoIA(false);
  }

  async function criarCampanha() {
    if (!form.titulo.trim() || !form.mensagem.trim()) return toast.error('Preencha título e mensagem');
    setCriando(true);
    const r = await fetch(`${BASE}/campanhas`, { method: 'POST', headers: authJ(), body: JSON.stringify(form) });
    const d = await r.json();
    if (d.id) { toast.success('Campanha criada'); carregarCampanhas(); setForm({ titulo: '', tipo: 'reativacao', mensagem: '', cupom_codigo: '', filtro: 'inativos_30', dias_inativo: 30 }); setSugestoes([]); }
    else toast.error(d.erro || 'Erro');
    setCriando(false);
  }

  async function dispararCampanha(id) {
    if (!confirm('Disparar esta campanha agora?')) return;
    const r = await fetch(`${BASE}/campanhas/${id}/disparar?limite=80`, { method: 'POST', headers: authH() });
    const d = await r.json();
    if (d.ok) { toast.success(`Enviando para ${d.total} contatos...`); carregarCampanhas(); }
    else toast.error(d.erro || 'Erro');
  }

  async function carregarTrafego(dias = trafegoDias) {
    try {
      const r = await fetch(`${BASE}/cardapio/trafego-relatorio?dias=${dias}`, { headers: authH() });
      if (r.ok) setTrafego(await r.json());
    } catch {}
  }

  async function verResultado(id) {
    if (resAberto === id) { setResAberto(null); return; }
    setResAberto(id);
    try {
      const r = await fetch(`${BASE}/campanhas/${id}/resultado`, { headers: authH() });
      if (r.ok) { const data = await r.json(); setResultados(prev => ({ ...prev, [id]: data })); }
    } catch {}
  }

  async function deletarCampanha(id) {
    if (!confirm('Deletar campanha?')) return;
    await fetch(`${BASE}/campanhas/${id}`, { method: 'DELETE', headers: authH() });
    carregarCampanhas();
  }

  async function gerarCodigo() {
    const r = await fetch(`${BASE}/campanhas/gerar-codigo`, { headers: authH() });
    const d = await r.json();
    if (d.codigo) setFormCupom(p => ({ ...p, codigo: d.codigo }));
  }

  async function criarCupom() {
    if (!formCupom.codigo.trim() || !formCupom.valor) return toast.error('Código e valor obrigatórios');
    setCriandoCupom(true);
    const r = await fetch(`${BASE}/campanhas/cupons`, { method: 'POST', headers: authJ(), body: JSON.stringify(formCupom) });
    const d = await r.json();
    if (d.id) {
      toast.success(`Cupom ${d.codigo} criado`);
      carregarCupons();
      setFormCupom({ codigo: '', descricao: '', tipo: 'percentual', valor: '', minimo: '', usos_maximos: '', validade: '' });
      setMostrarFormCupom(false);
    } else toast.error(d.erro || 'Erro');
    setCriandoCupom(false);
  }

  async function toggleCupom(id, ativo) {
    await fetch(`${BASE}/campanhas/cupons/${id}`, { method: 'PATCH', headers: authJ(), body: JSON.stringify({ ativo: !ativo }) });
    carregarCupons();
  }

  async function deletarCupom(id) {
    if (!confirm('Deletar cupom?')) return;
    await fetch(`${BASE}/campanhas/cupons/${id}`, { method: 'DELETE', headers: authH() });
    carregarCupons();
  }

  async function enviarParaSelecionados(mensagem) {
    if (!mensagem?.trim() || !selecionados.size) return;
    const convs = inativos.filter(c => selecionados.has(c.id));
    toast.success(`Enviando para ${convs.length} contatos...`);
    for (const conv of convs) {
      const nome = (conv.nome || '').split(' ')[0] || 'cliente';
      const msg = mensagem.replace(/\{nome\}/gi, nome);
      await fetch(`${BASE}/chat/conversas/${conv.id}/responder`, {
        method: 'POST', headers: authJ(), body: JSON.stringify({ corpo: msg }),
      });
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 4000));
    }
    toast.success('Envio concluído');
    setSelecionados(new Set());
  }

  const navs = [
    { id: 'recuperar', label: '💤 Recuperar Clientes' },
    { id: 'campanhas', label: '📣 Campanhas' },
    { id: 'cupons',    label: '🎟️ Cupons' },
    { id: 'anuncios',  label: '📈 Anúncios' },
  ];

  return (
    <div className="flex flex-col h-screen" style={{ background: '#0d0d0d', color: '#e5e5e5' }}>
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4 shrink-0" style={{ borderBottom: '1px solid #1a1a1a' }}>
        <div>
          <h1 className="text-white font-black text-xl">🎯 Campanhas & Recuperação</h1>
          <p className="text-xs text-zinc-600 mt-0.5">Reative clientes inativos, crie campanhas e gerencie cupons</p>
        </div>
        {stats && (
          <div className="ml-auto flex gap-3">
            {[
              { label: '7 dias', val: stats.inativos_7,  color: 'var(--accent-2)' },
              { label: '30 dias', val: stats.inativos_30, color: 'var(--accent)' },
              { label: '60 dias', val: stats.inativos_60, color: '#ef4444' },
            ].map(s => (
              <div key={s.label} className="text-center px-3 py-1.5 rounded-xl" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
                <div className="font-black text-lg" style={{ color: s.color }}>{s.val}</div>
                <div className="text-[10px] text-zinc-600">inativos {s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sub-nav */}
      <div className="flex gap-1 px-6 pt-3 shrink-0">
        {navs.map(n => (
          <button key={n.id} onClick={() => { setAba(n.id); if (n.id === 'recuperar' && !inativos.length) carregarInativos(); if (n.id === 'anuncios') carregarTrafego(); }}
            className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
            style={{ background: aba === n.id ? 'rgba(var(--accent-rgb),0.12)' : 'transparent', border: aba === n.id ? '1px solid rgba(var(--accent-rgb),0.3)' : '1px solid transparent', color: aba === n.id ? 'var(--accent)' : '#666' }}>
            {n.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">

        {/* ── RECUPERAR CLIENTES ── */}
        {aba === 'recuperar' && (
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Filtro */}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-zinc-500">Mostrar inativos há mais de:</span>
              {[7, 14, 30, 60, 90].map(d => (
                <button key={d} onClick={() => { setDiasFiltro(d); carregarInativos(d); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={{ background: diasFiltro === d ? 'rgba(var(--accent-rgb),0.12)' : '#111', border: diasFiltro === d ? '1px solid rgba(var(--accent-rgb),0.4)' : '1px solid #1e1e1e', color: diasFiltro === d ? 'var(--accent)' : '#666' }}>
                  {d} dias
                </button>
              ))}
              <button onClick={() => carregarInativos(diasFiltro)} className="px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:text-white transition-all" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
                ↻ Atualizar
              </button>
              {selecionados.size > 0 && (
                <EnvioRapido selecionados={selecionados} onEnviar={enviarParaSelecionados} cupons={cupons} />
              )}
              {inativos.length > 0 && (
                <button onClick={() => setSelecionados(selecionados.size === inativos.length ? new Set() : new Set(inativos.map(c => c.id)))}
                  className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-500 hover:text-white transition-all" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
                  {selecionados.size === inativos.length ? 'Desmarcar todos' : `Selecionar todos (${inativos.length})`}
                </button>
              )}
            </div>

            {loadingInativos ? (
              <div className="text-center text-zinc-700 py-16">Carregando...</div>
            ) : inativos.length === 0 ? (
              <div className="text-center py-16 space-y-2">
                <div className="text-4xl">🎉</div>
                <div className="text-zinc-500">Nenhum cliente inativo há {diasFiltro} dias</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-zinc-600">{inativos.length} clientes inativos encontrados · {selecionados.size} selecionados</div>
                {inativos.map(c => (
                  <ClienteInativoCard key={c.id} cliente={c} selecionado={selecionados.has(c.id)}
                    onToggle={() => setSelecionados(prev => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CAMPANHAS ── */}
        {aba === 'campanhas' && (
          <div className="max-w-3xl mx-auto space-y-5">
            {/* Criar campanha */}
            <div className="rounded-2xl p-5 space-y-4" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
              <div className="text-xs text-zinc-500 font-bold tracking-widest">NOVA CAMPANHA</div>

              {/* Tipo */}
              <div className="grid grid-cols-5 gap-2">
                {TIPOS.map(t => (
                  <button key={t.id} onClick={() => setForm(p => ({ ...p, tipo: t.id }))}
                    className="py-2 px-1 rounded-xl text-center transition-all"
                    style={{ background: form.tipo === t.id ? 'rgba(var(--accent-rgb),0.12)' : '#161616', border: form.tipo === t.id ? '1px solid rgba(var(--accent-rgb),0.3)' : '1px solid #222' }}>
                    <div className="text-lg">{t.icon}</div>
                    <div className="text-[10px] font-bold mt-0.5" style={{ color: form.tipo === t.id ? 'var(--accent)' : '#555' }}>{t.label}</div>
                  </button>
                ))}
              </div>

              <input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
                placeholder="Título da campanha (interno)" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={IS} />

              {/* Mensagem + IA */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-600">Mensagem</span>
                  <div className="flex gap-2">
                    <button onClick={() => setForm(p => ({ ...p, mensagem: p.mensagem + ' {nome}' }))}
                      className="text-[10px] px-2 py-1 rounded-lg font-bold" style={{ background: '#1e1e1e', color: 'var(--accent)', border: '1px solid #333' }}>
                      + {'{nome}'}
                    </button>
                    <button onClick={sugerirIA} disabled={sugerindoIA}
                      className="text-[10px] px-2 py-1 rounded-lg font-bold transition-all" style={{ background: sugerindoIA ? '#1a1a1a' : 'rgba(var(--accent-rgb),0.1)', color: sugerindoIA ? '#444' : 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
                      {sugerindoIA ? '⟳ Gerando...' : '🤖 Sugerir com IA'}
                    </button>
                  </div>
                </div>
                <textarea value={form.mensagem} onChange={e => setForm(p => ({ ...p, mensagem: e.target.value }))}
                  placeholder={`Olá {nome}! Sentimos sua falta...`}
                  rows={4} className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ ...IS, lineHeight: 1.6 }} />

                {/* Sugestões IA */}
                {sugestoes.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] text-zinc-600 font-bold tracking-widest">SUGESTÕES DA IA — clique para usar</div>
                    {sugestoes.map((s, i) => (
                      <button key={i} onClick={() => setForm(p => ({ ...p, mensagem: s }))}
                        className="w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all hover:border-orange-500/30"
                        style={{ background: '#0d0d0d', border: '1px solid #252525', color: '#aaa', lineHeight: 1.6 }}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Cupom */}
              <div className="flex gap-2">
                <select value={form.cupom_codigo} onChange={e => setForm(p => ({ ...p, cupom_codigo: e.target.value }))}
                  className="flex-1 px-3 py-2 rounded-xl text-sm outline-none" style={IS}>
                  <option value="">Sem cupom</option>
                  {cupons.filter(c => c.ativo).map(c => (
                    <option key={c.id} value={c.codigo}>{c.codigo} — {c.tipo === 'percentual' ? `${c.valor}% off` : `R$ ${fmt(c.valor)} off`}</option>
                  ))}
                </select>
              </div>

              {/* Filtro público */}
              <div>
                <div className="text-xs text-zinc-600 mb-2">Público-alvo:</div>
                <div className="flex gap-2">
                  {FILTROS.map(f => (
                    <button key={f.id} onClick={() => { setForm(p => ({ ...p, filtro: f.id, dias_inativo: parseInt(f.id.split('_')[1]) })); }}
                      className="flex-1 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{ background: form.filtro === f.id ? 'rgba(var(--accent-rgb),0.12)' : '#161616', border: form.filtro === f.id ? '1px solid rgba(var(--accent-rgb),0.3)' : '1px solid #222', color: form.filtro === f.id ? 'var(--accent)' : '#555' }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={criarCampanha} disabled={criando || !form.titulo.trim() || !form.mensagem.trim()}
                className="w-full py-3 rounded-xl font-black text-sm transition-all"
                style={{ background: criando || !form.titulo || !form.mensagem ? '#1a1a1a' : 'linear-gradient(135deg,var(--accent),var(--accent-2))', color: criando || !form.titulo || !form.mensagem ? '#444' : '#000' }}>
                {criando ? '⟳ Salvando...' : '💾 Salvar campanha'}
              </button>
            </div>

            {/* Lista de campanhas */}
            {campanhas.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-zinc-600 font-bold tracking-widest">CAMPANHAS SALVAS</div>
                {campanhas.map(c => {
                  const tipo = TIPOS.find(t => t.id === c.tipo);
                  const statusColor = { rascunho: '#666', disparando: 'var(--accent)', concluida: '#22c55e' }[c.status] || '#666';
                  return (
                    <div key={c.id} className="rounded-2xl p-4" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{tipo?.icon || '📣'}</span>
                            <span className="font-bold text-white text-sm">{c.titulo}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: statusColor + '20', color: statusColor }}>{c.status}</span>
                          </div>
                          <p className="text-xs text-zinc-600 mt-1 line-clamp-2">{c.mensagem}</p>
                          <div className="flex gap-3 mt-2 text-[10px] text-zinc-700">
                            <span>👥 {c.filtro}</span>
                            {c.cupom_codigo && <span>🎟️ {c.cupom_codigo}</span>}
                            {c.disparos > 0 && <span>📤 {c.disparos} enviados</span>}
                          </div>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          {c.status !== 'disparando' && (
                            <button onClick={() => dispararCampanha(c.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                              style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
                              Disparar
                            </button>
                          )}
                          {c.disparos > 0 && (
                            <button onClick={() => verResultado(c.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                              style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.2)' }}>
                              📊 Resultado
                            </button>
                          )}
                          <button onClick={() => deletarCampanha(c.id)}
                            className="px-2 py-1.5 rounded-lg text-xs text-zinc-600 hover:text-red-400 transition-all"
                            style={{ background: '#161616', border: '1px solid #222' }}>
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Painel de resultado / ROI */}
                      {resAberto === c.id && (() => {
                        const r = resultados[c.id];
                        if (!r) return <p className="text-xs text-zinc-600 mt-3">Carregando...</p>;
                        const pct = (r.taxa_conversao * 100).toFixed(0);
                        return (
                          <div className="mt-3 pt-3" style={{ borderTop: '1px solid #1e1e1e' }}>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { lbl: 'Enviados', val: r.enviados, cor: '#60a5fa' },
                                { lbl: 'Voltaram a pedir', val: `${r.conversoes} (${pct}%)`, cor: '#22c55e' },
                                { lbl: 'Faturamento', val: `R$ ${Number(r.faturamento).toFixed(2).replace('.', ',')}`, cor: '#fbbf24' },
                              ].map(k => (
                                <div key={k.lbl} className="rounded-xl p-2.5 text-center" style={{ background: '#161616', border: '1px solid #222' }}>
                                  <p className="text-base font-black" style={{ color: k.cor }}>{k.val}</p>
                                  <p className="text-[9px] text-zinc-600 mt-0.5">{k.lbl}</p>
                                </div>
                              ))}
                            </div>
                            {r.conversoes > 0 && (
                              <p className="text-[10px] text-zinc-500 mt-2">
                                Ticket médio: <span className="text-green-400 font-bold">R$ {Number(r.ticket_medio).toFixed(2).replace('.', ',')}</span> · Janela de atribuição: 14 dias
                              </p>
                            )}
                            {r.convertidos?.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {r.convertidos.slice(0, 5).map((x, i) => (
                                  <div key={i} className="flex items-center justify-between text-[11px]">
                                    <span className="text-zinc-400">🎯 {x.nome || x.telefone}</span>
                                    <span className="text-green-400 font-bold">R$ {Number(x.valor_convertido || 0).toFixed(2).replace('.', ',')}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── CUPONS ── */}
        {aba === 'cupons' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-black">🎟️ Cupons de Desconto</h2>
                <p className="text-xs text-zinc-600 mt-0.5">Aplicáveis no cardápio online pelo cliente</p>
              </div>
              <button onClick={() => setMostrarFormCupom(!mostrarFormCupom)}
                className="px-4 py-2 rounded-xl text-sm font-bold transition-all"
                style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
                + Novo cupom
              </button>
            </div>

            {/* Form novo cupom */}
            {mostrarFormCupom && (
              <div className="rounded-2xl p-4 space-y-3" style={{ background: '#111', border: '1px solid #252525' }}>
                <div className="text-xs text-zinc-500 font-bold tracking-widest">NOVO CUPOM</div>
                <div className="flex gap-2">
                  <input value={formCupom.codigo} onChange={e => setFormCupom(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
                    placeholder="CÓDIGO" className="flex-1 px-3 py-2 rounded-xl text-sm outline-none font-mono font-bold tracking-widest" style={IS} />
                  <button onClick={gerarCodigo} className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: '#1e1e1e', color: '#aaa', border: '1px solid #333' }}>Gerar</button>
                </div>
                <input value={formCupom.descricao} onChange={e => setFormCupom(p => ({ ...p, descricao: e.target.value }))}
                  placeholder="Descrição (ex: Promoção de volta das férias)" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={IS} />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-zinc-600 mb-1">Tipo</div>
                    <select value={formCupom.tipo} onChange={e => setFormCupom(p => ({ ...p, tipo: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={IS}>
                      <option value="percentual">Percentual (%)</option>
                      <option value="fixo">Valor fixo (R$)</option>
                    </select>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-600 mb-1">Valor {formCupom.tipo === 'percentual' ? '(%)' : '(R$)'}</div>
                    <input type="number" value={formCupom.valor} onChange={e => setFormCupom(p => ({ ...p, valor: e.target.value }))}
                      placeholder={formCupom.tipo === 'percentual' ? '10' : '15.00'} className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={IS} />
                  </div>
                  <div>
                    <div className="text-xs text-zinc-600 mb-1">Pedido mínimo (R$)</div>
                    <input type="number" value={formCupom.minimo} onChange={e => setFormCupom(p => ({ ...p, minimo: e.target.value }))}
                      placeholder="0 = sem mínimo" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={IS} />
                  </div>
                  <div>
                    <div className="text-xs text-zinc-600 mb-1">Usos máximos</div>
                    <input type="number" value={formCupom.usos_maximos} onChange={e => setFormCupom(p => ({ ...p, usos_maximos: e.target.value }))}
                      placeholder="0 = ilimitado" className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={IS} />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-600 mb-1">Validade (opcional)</div>
                  <input type="date" value={formCupom.validade} onChange={e => setFormCupom(p => ({ ...p, validade: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none" style={IS} />
                </div>
                <div className="flex gap-2">
                  <button onClick={criarCupom} disabled={criandoCupom}
                    className="flex-1 py-2.5 rounded-xl font-black text-sm transition-all"
                    style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', color: '#000' }}>
                    {criandoCupom ? 'Salvando...' : '🎟️ Criar cupom'}
                  </button>
                  <button onClick={() => setMostrarFormCupom(false)} className="px-4 py-2.5 rounded-xl text-sm text-zinc-500 hover:text-white" style={{ background: '#161616', border: '1px solid #222' }}>
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Lista cupons */}
            {cupons.length === 0 ? (
              <div className="text-center py-12 text-zinc-700">Nenhum cupom criado ainda</div>
            ) : (
              <div className="space-y-2">
                {cupons.map(c => (
                  <div key={c.id} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: '#111', border: `1px solid ${c.ativo ? '#1e2e1e' : '#1e1e1e'}` }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-white tracking-widest">{c.codigo}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: c.tipo === 'percentual' ? '#1a3a6a' : '#1a3a1a', color: c.tipo === 'percentual' ? '#60a5fa' : '#4ade80' }}>
                          {c.tipo === 'percentual' ? `${c.valor}% off` : `R$ ${fmt(c.valor)} off`}
                        </span>
                        {c.minimo > 0 && <span className="text-[10px] text-zinc-600">mín R$ {fmt(c.minimo)}</span>}
                        {c.validade && <span className="text-[10px] text-zinc-600">até {new Date(c.validade + 'T12:00:00').toLocaleDateString('pt-BR')}</span>}
                        {!c.ativo && <span className="text-[10px] text-zinc-700 font-bold">INATIVO</span>}
                      </div>
                      {c.descricao && <p className="text-xs text-zinc-600 mt-0.5">{c.descricao}</p>}
                      <div className="text-[10px] text-zinc-700 mt-1">
                        {c.usos_atuais || 0} usos {c.usos_maximos > 0 ? `/ ${c.usos_maximos}` : '(ilimitado)'}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => toggleCupom(c.id, c.ativo)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{ background: c.ativo ? '#1a3a1a' : '#1a1a1a', color: c.ativo ? '#4ade80' : '#666', border: `1px solid ${c.ativo ? '#2a5a2a' : '#252525'}` }}>
                        {c.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                      <button onClick={() => deletarCupom(c.id)}
                        className="px-2 py-1.5 rounded-lg text-xs text-zinc-600 hover:text-red-400 transition-all"
                        style={{ background: '#161616', border: '1px solid #222' }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ANÚNCIOS / TRÁFEGO PAGO ── */}
        {aba === 'anuncios' && (
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-black">📈 Anúncios — de onde vêm os pedidos</h2>
                <p className="text-xs text-zinc-600 mt-0.5">Pedidos e faturamento por origem (links com ?utm_source=)</p>
              </div>
              <select value={trafegoDias} onChange={e => { const d = Number(e.target.value); setTrafegoDias(d); carregarTrafego(d); }}
                className="px-3 py-2 rounded-xl text-xs font-bold outline-none" style={{ background: '#111', color: '#aaa', border: '1px solid #222' }}>
                <option value={7}>7 dias</option>
                <option value={30}>30 dias</option>
                <option value={90}>90 dias</option>
              </select>
            </div>

            {!trafego ? (
              <div className="text-center py-12 text-zinc-700">Carregando...</div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { lbl: 'Pedidos (total)', val: trafego.total_pedidos, cor: '#60a5fa' },
                    { lbl: 'Vindos de anúncio', val: trafego.pedidos_pagos, cor: 'var(--accent)' },
                    { lbl: 'Faturamento de anúncio', val: `R$ ${fmt(trafego.faturamento_pago)}`, cor: '#22c55e' },
                  ].map(k => (
                    <div key={k.lbl} className="rounded-2xl p-4 text-center" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
                      <p className="text-xl font-black" style={{ color: k.cor }}>{k.val}</p>
                      <p className="text-[10px] text-zinc-600 mt-1">{k.lbl}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl overflow-hidden" style={{ background: '#111', border: '1px solid #1e1e1e' }}>
                  <div className="grid grid-cols-12 px-4 py-2 text-[10px] font-black tracking-wider text-zinc-600" style={{ borderBottom: '1px solid #1e1e1e' }}>
                    <span className="col-span-5">ORIGEM</span><span className="col-span-3">CAMPANHA</span>
                    <span className="col-span-2 text-right">PEDIDOS</span><span className="col-span-2 text-right">R$</span>
                  </div>
                  {trafego.por_origem.length === 0 ? (
                    <div className="text-center py-10 text-zinc-700 text-sm">Nenhum pedido no período</div>
                  ) : trafego.por_origem.map((o, i) => (
                    <div key={i} className="grid grid-cols-12 px-4 py-2.5 text-xs items-center" style={{ borderBottom: '1px solid #161616' }}>
                      <span className="col-span-5 text-white font-bold truncate">{o.origem}</span>
                      <span className="col-span-3 text-zinc-500 truncate">{o.campanha}</span>
                      <span className="col-span-2 text-right text-zinc-300">{o.pedidos}</span>
                      <span className="col-span-2 text-right text-green-400 font-bold">{fmt(o.faturamento)}</span>
                    </div>
                  ))}
                </div>

                <p className="text-[11px] text-zinc-600 leading-relaxed">
                  💡 Use links com etiqueta nos seus anúncios, ex:<br />
                  <code className="text-zinc-400">…/cardapio?utm_source=instagram&utm_campaign=promo_combo</code><br />
                  Os pedidos desses links aparecem aqui por origem. Configure os <b>pixels</b> (Meta/Google) no Cardápio → engrenagem para a plataforma otimizar e medir as compras.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────

function ClienteInativoCard({ cliente, selecionado, onToggle }) {
  const dias = cliente.dias_inativo || 0;
  const cor = dias >= 60 ? '#ef4444' : dias >= 30 ? 'var(--accent)' : 'var(--accent-2)';
  return (
    <div onClick={onToggle} className="rounded-2xl p-3 flex items-center gap-3 cursor-pointer transition-all"
      style={{ background: selecionado ? 'rgba(var(--accent-rgb),0.06)' : '#111', border: `1px solid ${selecionado ? 'rgba(var(--accent-rgb),0.3)' : '#1e1e1e'}` }}>
      <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
        style={{ background: selecionado ? 'var(--accent)' : '#1e1e1e', border: `1px solid ${selecionado ? 'var(--accent)' : '#333'}` }}>
        {selecionado && <span className="text-black text-[10px] font-black">✓</span>}
      </div>
      <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-black" style={{ background: '#1e1e1e', color: '#666' }}>
        {(cliente.nome || '?')[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-white truncate">{cliente.nome || cliente.telefone}</div>
        <div className="text-[11px] text-zinc-600 truncate">{cliente.telefone}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-black" style={{ color: cor }}>{dias}d inativo</div>
        {cliente.total_pedidos > 0 && (
          <div className="text-[10px] text-zinc-600">{cliente.total_pedidos} pedidos · R$ {Number(cliente.total_gasto || 0).toFixed(0)}</div>
        )}
      </div>
    </div>
  );
}

function EnvioRapido({ selecionados, onEnviar, cupons }) {
  const [msg, setMsg] = useState('');
  const [aberto, setAberto] = useState(false);
  const IS2 = { background: '#161616', border: '1px solid #252525', color: '#e5e5e5' };

  const templates = [
    { label: 'Sentimos falta', texto: 'Oi {nome}! Sentimos sua falta 🍣 Que tal pedir hoje? Confira nosso cardápio.' },
    { label: 'Promoção', texto: 'Olá {nome}! Temos uma promoção especial esperando por você. Acesse o cardápio e confira.' },
    { label: 'Voltamos', texto: 'Oi {nome}, tudo bem? Faz tempo que não te vemos por aqui. Que tal um combinado hoje?' },
  ];

  if (!aberto) return (
    <button onClick={() => setAberto(true)} className="px-4 py-1.5 rounded-lg text-xs font-black transition-all"
      style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', color: '#000' }}>
      Enviar para {selecionados.size} selecionados →
    </button>
  );

  return (
    <div className="w-full mt-2 rounded-2xl p-4 space-y-3" style={{ background: '#111', border: '1px solid #252525' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 font-bold tracking-widest">MENSAGEM PARA {selecionados.size} CONTATOS</span>
        <button onClick={() => setAberto(false)} className="text-xs text-zinc-600 hover:text-white">✕</button>
      </div>
      <div className="flex gap-2 flex-wrap">
        {templates.map(t => (
          <button key={t.label} onClick={() => setMsg(t.texto)}
            className="px-2 py-1 rounded-lg text-[10px] font-bold" style={{ background: '#1e1e1e', color: '#aaa', border: '1px solid #2e2e2e' }}>
            {t.label}
          </button>
        ))}
        <select onChange={e => e.target.value && setMsg(p => p + `\n\nUse o cupom: *${e.target.value}*`)}
          className="px-2 py-1 rounded-lg text-[10px] outline-none" style={{ ...IS2, color: 'var(--accent)' }}>
          <option value="">+ Adicionar cupom</option>
          {cupons.filter(c => c.ativo).map(c => <option key={c.id} value={c.codigo}>{c.codigo}</option>)}
        </select>
      </div>
      <textarea value={msg} onChange={e => setMsg(e.target.value)}
        placeholder="Mensagem... use {nome} para personalizar" rows={3}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none" style={{ ...IS2, lineHeight: 1.6 }} />
      <button onClick={() => { onEnviar(msg); setAberto(false); setMsg(''); }}
        disabled={!msg.trim()}
        className="w-full py-2.5 rounded-xl font-black text-sm transition-all"
        style={{ background: msg.trim() ? 'linear-gradient(135deg,var(--accent),var(--accent-2))' : '#1a1a1a', color: msg.trim() ? '#000' : '#444' }}>
        Enviar agora (delay 3–8s entre contatos)
      </button>
    </div>
  );
}
