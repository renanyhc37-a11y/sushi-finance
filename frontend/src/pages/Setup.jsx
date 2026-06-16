import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken } from '../hooks/useAuth';
import {
  CheckCircle2, ChevronRight, ChevronLeft, Package, TrendingUp,
  ClipboardList, Rocket, AlertTriangle, Check, X,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });
const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const PASSOS = [
  { id: 'boas-vindas', label: 'Início',    Icon: Rocket },
  { id: 'estoque',     label: 'Estoque',   Icon: Package },
  { id: 'saldo',       label: 'Saldo',     Icon: TrendingUp },
  { id: 'checklist',   label: 'Conclusão', Icon: ClipboardList },
];

export default function Setup({ onConcluido }) {
  const navigate = useNavigate();
  const [passo, setPasso] = useState(0);
  const [status, setStatus] = useState(null);
  const [ingredientes, setIngredientes] = useState([]);
  const [estoques, setEstoques] = useState({});   // { [id]: { quantidade, preco_total } }
  const [saldo, setSaldo] = useState({
    data_inicio: '', data_fim: new Date().toISOString().slice(0, 10),
    total_bruto: '', pix: '', dinheiro: '', credito: '', debito: '',
    despesas_total: '', despesas_descricao: '',
    pular: false,
  });
  const [salvando, setSalvando] = useState(false);
  const [concluido, setConcluido] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/setup/status`, { headers: authH() })
      .then(r => r.json()).then(setStatus).catch(() => {});
    fetch(`${BASE}/ingredientes`, { headers: authH() })
      .then(r => r.json()).then(data => {
        setIngredientes(Array.isArray(data) ? data : []);
        const init = {};
        (Array.isArray(data) ? data : []).forEach(i => { init[i.id] = { quantidade: '', preco_total: '' }; });
        setEstoques(init);
      }).catch(() => {});
  }, []);

  async function salvarEstoque() {
    const itens = ingredientes
      .map(i => ({
        ingrediente_id: i.id,
        quantidade: parseFloat(estoques[i.id]?.quantidade) || 0,
        preco_total: parseFloat(estoques[i.id]?.preco_total) || 0,
      }))
      .filter(i => i.quantidade > 0);
    if (itens.length === 0) return true; // pular se nenhum preenchido
    const r = await fetch(`${BASE}/setup/estoque-inicial`, {
      method: 'POST', headers: authH(), body: JSON.stringify(itens),
    });
    return r.ok;
  }

  async function salvarSaldo() {
    if (saldo.pular || !saldo.total_bruto) return true;
    const r = await fetch(`${BASE}/setup/saldo-abertura`, {
      method: 'POST', headers: authH(),
      body: JSON.stringify({
        data_inicio: saldo.data_inicio,
        data_fim: saldo.data_fim,
        total_bruto: parseFloat(saldo.total_bruto) || 0,
        pix: parseFloat(saldo.pix) || 0,
        dinheiro: parseFloat(saldo.dinheiro) || 0,
        credito: parseFloat(saldo.credito) || 0,
        debito: parseFloat(saldo.debito) || 0,
        despesas_total: parseFloat(saldo.despesas_total) || 0,
        despesas_descricao: saldo.despesas_descricao,
      }),
    });
    return r.ok;
  }

  async function avancar() {
    if (passo === 1) { // salva estoque ao sair do passo
      setSalvando(true);
      await salvarEstoque();
      setSalvando(false);
    }
    if (passo === 2) { // salva saldo ao sair do passo
      setSalvando(true);
      await salvarSaldo();
      setSalvando(false);
    }
    if (passo < PASSOS.length - 1) { setPasso(p => p + 1); return; }

    // Último passo: concluir
    setSalvando(true);
    await fetch(`${BASE}/setup/concluir`, { method: 'POST', headers: authH() });
    setSalvando(false);
    setConcluido(true);
    setTimeout(() => { onConcluido?.(); navigate('/pdv'); }, 1800);
  }

  const estoquePreenchidos = Object.values(estoques).filter(e => parseFloat(e.quantidade) > 0).length;
  const totalEstoque = ingredientes
    .reduce((s, i) => s + (parseFloat(estoques[i.id]?.preco_total) || 0), 0);

  if (concluido) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--space-base)' }}>
      <div className="text-center space-y-4">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
          style={{ background: 'rgba(16,185,129,0.15)', border: '2px solid #10b981' }}>
          <Check size={40} style={{ color: '#10b981' }} />
        </div>
        <p className="text-2xl font-black t-strong">Sistema pronto!</p>
        <p className="t-dim text-sm">Redirecionando para o PDV…</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--space-base)', color: 'var(--txt)', fontFamily: 'system-ui,sans-serif' }}>

      {/* Header */}
      <div className="shrink-0 px-6 py-5 flex items-center gap-4" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <div>
          <h1 className="text-xl font-black t-strong leading-none">Configuração inicial</h1>
          <p className="text-xs t-dim mt-0.5">Implantação do sistema · leva menos de 5 minutos</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {PASSOS.map((p, i) => (
            <div key={p.id} className="flex items-center gap-1">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black transition-all"
                style={{
                  background: i < passo ? '#10b981' : i === passo ? 'var(--accent)' : 'var(--space-elev)',
                  color: i <= passo ? '#fff' : 'var(--txt-dim)',
                  border: i === passo ? '2px solid var(--accent)' : '2px solid transparent',
                }}>
                {i < passo ? <Check size={13} strokeWidth={2.5} /> : i + 1}
              </div>
              {i < PASSOS.length - 1 && (
                <div className="w-6 h-0.5 rounded-full" style={{ background: i < passo ? '#10b981' : 'var(--hairline)' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">

        {/* PASSO 0 — Boas-vindas */}
        {passo === 0 && (
          <div className="space-y-6">
            <div className="text-center py-6">
              <div className="text-6xl mb-4">🍣</div>
              <h2 className="text-2xl font-black t-strong">Bem-vindo ao sistema!</h2>
              <p className="t-dim mt-2 text-sm max-w-md mx-auto leading-relaxed">
                Vamos configurar tudo em 3 passos rápidos para você começar a operar hoje mesmo.
              </p>
            </div>

            <div className="space-y-3">
              {[
                { Icon: Package, cor: '#f97316', titulo: 'Estoque inicial', desc: 'Registre o que você tem em estoque hoje, com os custos atuais' },
                { Icon: TrendingUp, cor: '#3b82f6', titulo: 'Saldo de abertura', desc: 'Informe o faturamento e despesas dos dias antes da implantação (opcional)' },
                { Icon: ClipboardList, cor: '#10b981', titulo: 'Checklist final', desc: 'Verificamos se o cardápio e as fichas técnicas estão prontas para operar' },
              ].map(({ Icon, cor, titulo, desc }) => (
                <div key={titulo} className="flex gap-4 p-4 rounded-2xl"
                  style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${cor}18` }}>
                    <Icon size={20} style={{ color: cor }} strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className="font-black t-strong text-sm">{titulo}</p>
                    <p className="text-xs t-dim mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {status && (
              <div className="p-4 rounded-2xl text-sm space-y-1"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <p className="font-black text-xs uppercase tracking-wider" style={{ color: '#f59e0b' }}>Estado atual do sistema</p>
                <p className="t-dim text-xs">📦 {status.totalIngredientes} ingrediente(s) cadastrado(s)</p>
                <p className="t-dim text-xs">🍣 {status.totalItensCardapio} item(s) no cardápio</p>
                <p className="t-dim text-xs">📋 {status.totalFichas} ficha(s) técnica(s)</p>
              </div>
            )}
          </div>
        )}

        {/* PASSO 1 — Estoque inicial */}
        {passo === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-black t-strong">Estoque inicial</h2>
              <p className="text-xs t-dim mt-1 leading-relaxed">
                Informe as quantidades que você tem agora em cada ingrediente. Deixe em branco os que estão zerados.
                {estoquePreenchidos > 0 && <span className="font-bold" style={{ color: 'var(--accent)' }}> {estoquePreenchidos} preenchido(s) · {brl(totalEstoque)}</span>}
              </p>
            </div>

            {ingredientes.length === 0 ? (
              <div className="text-center py-12 t-dim">
                <Package size={32} className="mx-auto mb-3 opacity-30" strokeWidth={1.5} />
                <p className="text-sm">Nenhum ingrediente cadastrado ainda.</p>
                <p className="text-xs mt-1">Cadastre ingredientes em <strong>Ingredientes</strong> e volte aqui.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ingredientes.map(ing => (
                  <div key={ing.id} className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold t-strong text-sm truncate">{ing.nome}</p>
                      <p className="text-[10px] t-dim">{ing.unidade_medida} · estoque atual: {ing.estoque_atual || 0}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div>
                        <p className="text-[9px] t-dim text-center mb-0.5">Qtd ({ing.unidade_medida})</p>
                        <input
                          type="number" min="0" step="0.01" placeholder="0"
                          value={estoques[ing.id]?.quantidade || ''}
                          onChange={e => setEstoques(prev => ({ ...prev, [ing.id]: { ...prev[ing.id], quantidade: e.target.value } }))}
                          className="w-20 text-xs text-right rounded-lg px-2 py-1.5 font-bold outline-none"
                          style={{ background: 'var(--space-elev-2)', color: 'var(--txt)', border: '1px solid var(--hairline)' }}
                        />
                      </div>
                      <div>
                        <p className="text-[9px] t-dim text-center mb-0.5">Valor (R$)</p>
                        <input
                          type="number" min="0" step="0.01" placeholder="0,00"
                          value={estoques[ing.id]?.preco_total || ''}
                          onChange={e => setEstoques(prev => ({ ...prev, [ing.id]: { ...prev[ing.id], preco_total: e.target.value } }))}
                          className="w-24 text-xs text-right rounded-lg px-2 py-1.5 font-bold outline-none"
                          style={{ background: 'var(--space-elev-2)', color: 'var(--txt)', border: '1px solid var(--hairline)' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PASSO 2 — Saldo de abertura */}
        {passo === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-black t-strong">Saldo de abertura</h2>
              <p className="text-xs t-dim mt-1 leading-relaxed">
                Se você já operava antes de instalar o sistema, informe o faturamento e despesas do período anterior para que os relatórios do mês fiquem completos.
              </p>
            </div>

            <label className="flex items-center gap-3 p-4 rounded-2xl cursor-pointer"
              style={{ background: saldo.pular ? 'rgba(99,102,241,0.1)' : 'var(--space-elev)', border: `1px solid ${saldo.pular ? 'rgba(99,102,241,0.4)' : 'var(--hairline)'}` }}>
              <input type="checkbox" checked={saldo.pular} onChange={e => setSaldo(s => ({ ...s, pular: e.target.checked }))}
                className="w-4 h-4 accent-indigo-500" />
              <div>
                <p className="font-bold text-sm t-strong">Pular esta etapa</p>
                <p className="text-xs t-dim">Meu delivery está começando agora, não tem histórico anterior</p>
              </div>
            </label>

            {!saldo.pular && (
              <div className="space-y-4">
                {/* Período */}
                <div className="p-4 rounded-2xl space-y-3" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  <p className="text-xs font-black uppercase tracking-wider t-dim">Período anterior</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] t-dim font-bold block mb-1">De (opcional)</label>
                      <input type="date" value={saldo.data_inicio}
                        onChange={e => setSaldo(s => ({ ...s, data_inicio: e.target.value }))}
                        className="w-full text-sm rounded-xl px-3 py-2 outline-none"
                        style={{ background: 'var(--space-elev-2)', color: 'var(--txt)', border: '1px solid var(--hairline)' }} />
                    </div>
                    <div>
                      <label className="text-[10px] t-dim font-bold block mb-1">Até</label>
                      <input type="date" value={saldo.data_fim}
                        onChange={e => setSaldo(s => ({ ...s, data_fim: e.target.value }))}
                        className="w-full text-sm rounded-xl px-3 py-2 outline-none"
                        style={{ background: 'var(--space-elev-2)', color: 'var(--txt)', border: '1px solid var(--hairline)' }} />
                    </div>
                  </div>
                </div>

                {/* Faturamento */}
                <div className="p-4 rounded-2xl space-y-3" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  <p className="text-xs font-black uppercase tracking-wider t-dim">Faturamento do período</p>
                  <div>
                    <label className="text-[10px] t-dim font-bold block mb-1">Total bruto (R$)</label>
                    <input type="number" min="0" step="0.01" placeholder="Ex: 4200.00"
                      value={saldo.total_bruto}
                      onChange={e => setSaldo(s => ({ ...s, total_bruto: e.target.value }))}
                      className="w-full text-sm rounded-xl px-3 py-2 font-bold outline-none"
                      style={{ background: 'var(--space-elev-2)', color: 'var(--txt)', border: '1px solid var(--hairline)' }} />
                  </div>
                  <p className="text-[10px] t-dim">Breakdown por forma de pagamento (opcional)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { k: 'pix', label: 'PIX' },
                      { k: 'dinheiro', label: 'Dinheiro' },
                      { k: 'credito', label: 'Crédito' },
                      { k: 'debito', label: 'Débito' },
                    ].map(({ k, label }) => (
                      <div key={k}>
                        <label className="text-[10px] t-dim font-bold block mb-1">{label} (R$)</label>
                        <input type="number" min="0" step="0.01" placeholder="0,00"
                          value={saldo[k]}
                          onChange={e => setSaldo(s => ({ ...s, [k]: e.target.value }))}
                          className="w-full text-xs rounded-lg px-2 py-1.5 outline-none"
                          style={{ background: 'var(--space-elev-2)', color: 'var(--txt)', border: '1px solid var(--hairline)' }} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Despesas */}
                <div className="p-4 rounded-2xl space-y-3" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  <p className="text-xs font-black uppercase tracking-wider t-dim">Despesas do período (opcional)</p>
                  <div>
                    <label className="text-[10px] t-dim font-bold block mb-1">Total de despesas (R$)</label>
                    <input type="number" min="0" step="0.01" placeholder="Ex: 1500.00"
                      value={saldo.despesas_total}
                      onChange={e => setSaldo(s => ({ ...s, despesas_total: e.target.value }))}
                      className="w-full text-sm rounded-xl px-3 py-2 font-bold outline-none"
                      style={{ background: 'var(--space-elev-2)', color: 'var(--txt)', border: '1px solid var(--hairline)' }} />
                  </div>
                  <div>
                    <label className="text-[10px] t-dim font-bold block mb-1">Descrição</label>
                    <input type="text" placeholder="Ex: aluguel, embalagens, insumos…"
                      value={saldo.despesas_descricao}
                      onChange={e => setSaldo(s => ({ ...s, despesas_descricao: e.target.value }))}
                      className="w-full text-xs rounded-lg px-2 py-1.5 outline-none"
                      style={{ background: 'var(--space-elev-2)', color: 'var(--txt)', border: '1px solid var(--hairline)' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* PASSO 3 — Checklist / Conclusão */}
        {passo === 3 && status && (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-black t-strong">Tudo pronto?</h2>
              <p className="text-xs t-dim mt-1">Verifique os itens abaixo antes de começar a operar.</p>
            </div>

            <div className="space-y-2">
              {[
                {
                  ok: status.checklist.cardapio,
                  titulo: 'Cardápio configurado',
                  desc: status.checklist.cardapio
                    ? `${status.totalItensCardapio} item(s) ativo(s)`
                    : 'Sem itens no cardápio — clientes não conseguem fazer pedidos',
                  link: '/cardapio-admin',
                  linkLabel: 'Configurar cardápio',
                },
                {
                  ok: status.checklist.fichas,
                  titulo: 'Fichas técnicas',
                  desc: status.checklist.fichas
                    ? `${status.totalFichas} produto(s) com ficha — CMV automático ativo`
                    : 'Sem fichas técnicas — o CMV não será calculado automaticamente',
                  link: '/fichas',
                  linkLabel: 'Criar fichas técnicas',
                  aviso: true,
                },
                {
                  ok: status.checklist.ingredientes,
                  titulo: 'Ingredientes cadastrados',
                  desc: status.checklist.ingredientes
                    ? `${status.totalIngredientes} ingrediente(s) no sistema`
                    : 'Sem ingredientes — não será possível montar fichas técnicas',
                  link: '/ingredientes',
                  linkLabel: 'Cadastrar ingredientes',
                },
              ].map(({ ok, titulo, desc, link, linkLabel, aviso }) => (
                <div key={titulo} className="flex items-start gap-3 p-4 rounded-2xl"
                  style={{ background: 'var(--space-elev)', border: `1px solid ${ok ? 'rgba(16,185,129,0.3)' : aviso ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.25)'}` }}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: ok ? 'rgba(16,185,129,0.15)' : aviso ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)' }}>
                    {ok
                      ? <Check size={14} style={{ color: '#10b981' }} strokeWidth={2.5} />
                      : aviso
                        ? <AlertTriangle size={13} style={{ color: '#f59e0b' }} strokeWidth={2} />
                        : <X size={13} style={{ color: '#ef4444' }} strokeWidth={2.5} />
                    }
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-sm t-strong">{titulo}</p>
                    <p className="text-xs t-dim mt-0.5">{desc}</p>
                    {!ok && (
                      <a href={link} className="text-xs font-bold mt-1.5 inline-block"
                        style={{ color: aviso ? '#f59e0b' : '#f87171' }}>
                        → {linkLabel}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 rounded-2xl space-y-1 text-sm"
              style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <p className="font-black text-xs uppercase tracking-wider" style={{ color: '#10b981' }}>Você pode continuar configurando depois</p>
              <p className="text-xs t-dim leading-relaxed">
                Os itens em amarelo/vermelho não impedem o funcionamento do PDV — apenas limitam alguns recursos. Você pode concluir agora e ajustar no painel a qualquer momento.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer — navegação */}
      <div className="shrink-0 px-4 py-4 flex gap-3" style={{ borderTop: '1px solid var(--hairline)' }}>
        {passo > 0 && (
          <button onClick={() => setPasso(p => p - 1)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all active:scale-95"
            style={{ background: 'var(--space-elev)', color: 'var(--txt-dim)', border: '1px solid var(--hairline)' }}>
            <ChevronLeft size={16} strokeWidth={2} /> Voltar
          </button>
        )}
        <button onClick={avancar} disabled={salvando}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-white text-sm transition-all active:scale-95"
          style={{ background: passo === PASSOS.length - 1 ? '#10b981' : 'var(--accent)', opacity: salvando ? 0.7 : 1 }}>
          {salvando ? 'Salvando…' : passo === PASSOS.length - 1 ? <><Rocket size={16} strokeWidth={2} /> Começar a operar!</> : <>{passo === 0 ? 'Começar configuração' : 'Continuar'} <ChevronRight size={16} strokeWidth={2} /></>}
        </button>
      </div>
    </div>
  );
}
