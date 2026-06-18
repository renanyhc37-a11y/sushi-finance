import React, { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { getToken } from '../hooks/useAuth';
import {
  Wallet, Smartphone, Banknote, CreditCard, TrendingDown, RefreshCw,
  Lock, Send, Settings, CheckCircle2, ArrowDownToLine, ArrowUpFromLine,
  ChevronRight, Info, Phone,
} from 'lucide-react';

const BASE   = import.meta.env.VITE_API_URL || '/api';
const brl    = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const authJ  = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });
const hoje   = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const pct    = (part, total) => total > 0 ? Math.round((part / total) * 100) : 0;

export default function Caixa() {
  const [data,        setData]        = useState(hoje());
  const [resumo,      setResumo]      = useState(null);
  const [loading,     setLoading]     = useState(true);

  const [contado,     setContado]     = useState('');
  const [sangrias,    setSangrias]    = useState('');
  const [suprimentos, setSuprimentos] = useState('');
  const [obs,         setObs]         = useState('');
  const [enviarWa,    setEnviarWa]    = useState(true);
  const [salvando,    setSalvando]    = useState(false);

  const [adminWa,     setAdminWa]     = useState('');
  const [editandoWa,  setEditandoWa]  = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/caixa/resumo?data=${data}`, { headers: authJ() });
      const d = await r.json();
      setResumo(d);
      setAdminWa(d.admin_whatsapp || '');
    } catch { toast.error('Erro ao carregar'); }
    finally { setLoading(false); }
  }, [data]);

  useEffect(() => { carregar(); }, [carregar]);

  // Cálculos
  const sangV     = Number(sangrias)    || 0;
  const supV      = Number(suprimentos) || 0;
  const esperado  = resumo ? (resumo.dinheiro - sangV + supV) : 0;
  const diferenca = contado !== '' ? (Number(contado) - esperado) : null;
  const fat       = resumo?.faturamento || 0;
  const desp      = resumo?.despesas    || 0;
  const resultado = fat - desp;
  const pedidos   = resumo?.pedidos     || 0;
  const ticket    = pedidos > 0 ? fat / pedidos : 0;
  const fechado   = resumo?.fechamento;

  // Breakdown %
  const pix     = resumo?.pix     || 0;
  const dinheiro= resumo?.dinheiro|| 0;
  const cartao  = resumo?.cartao  || 0;

  async function salvarAdminWa() {
    await fetch(`${BASE}/caixa/admin-whatsapp`, { method: 'PUT', headers: authJ(), body: JSON.stringify({ numero: adminWa }) });
    setEditandoWa(false);
    toast.success('WhatsApp salvo');
  }

  async function fechar() {
    setSalvando(true);
    try {
      const r = await fetch(`${BASE}/caixa/fechar`, {
        method: 'POST', headers: authJ(),
        body: JSON.stringify({ data, valor_contado: contado, sangrias: sangV, suprimentos: supV, observacao: obs, enviar_whatsapp: enviarWa }),
      });
      const d = await r.json();
      toast.success('Caixa fechado!');
      if (enviarWa) {
        if (d.whatsapp_enviado) toast.success('Relatório enviado no WhatsApp 📲');
        else if (d.whatsapp_erro) toast(d.whatsapp_erro, { icon: '⚠️' });
      }
      carregar();
    } catch { toast.error('Erro ao fechar caixa'); }
    finally { setSalvando(false); }
  }

  async function soEnviar() {
    if (!adminWa) { toast.error('Configure o WhatsApp do administrador'); setEditandoWa(true); return; }
    const r = await fetch(`${BASE}/caixa/enviar-relatorio`, { method: 'POST', headers: authJ(), body: JSON.stringify({ data }) });
    if (r.ok) toast.success('Relatório enviado no WhatsApp 📲');
    else { const e = await r.json().catch(() => ({})); toast.error(e.erro || 'WhatsApp não conectado'); }
  }

  // Cor da diferença
  const difCol  = diferenca === null ? null : diferenca === 0 ? '#22c55e' : diferenca > 0 ? '#fbbf24' : '#ef4444';
  const difLabel= diferenca === null ? null : diferenca === 0 ? 'Caixa OK ✓' : diferenca > 0 ? `Sobra de ${brl(Math.abs(diferenca))}` : `Falta de ${brl(Math.abs(diferenca))}`;
  const difIcon = diferenca === null ? null : diferenca === 0 ? '✅' : diferenca > 0 ? '🟡' : '🔴';

  const dataLabel = (() => {
    const d = new Date(data + 'T12:00:00');
    const t = new Date(); t.setHours(12,0,0,0);
    const y = new Date(t); y.setDate(y.getDate()-1);
    if (d.toDateString() === t.toDateString()) return 'Hoje';
    if (d.toDateString() === y.toDateString()) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' });
  })();

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">
      <Toaster />

      {/* ── Cabeçalho ──────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2.5" style={{ color: 'var(--txt-strong)' }}>
            <Wallet size={24} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
            Fechamento de Caixa
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--txt-dim)' }}>
            Confira os valores do dia e feche o caixa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)', color: 'var(--txt)' }}>
            <span style={{ color: 'var(--txt-dim)', fontSize: 12 }}>{dataLabel}</span>
            <input type="date" value={data} onChange={e => setData(e.target.value)}
              className="outline-none bg-transparent text-sm"
              style={{ color: 'var(--txt)', width: 130 }} />
          </div>
          <button onClick={carregar}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--space-elev)', color: 'var(--txt-dim)', border: '1px solid var(--hairline)' }}>
            <RefreshCw size={15} strokeWidth={1.75} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Banner de caixa já fechado ─────────────────── */}
      {fechado && (
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <CheckCircle2 size={22} strokeWidth={1.75} style={{ color: '#34d399', flexShrink: 0 }} />
          <div>
            <p className="font-black text-sm" style={{ color: '#34d399' }}>Caixa fechado para este dia</p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(52,211,153,0.7)' }}>
              {fechado.valor_contado != null
                ? `Dinheiro contado: ${brl(fechado.valor_contado)} · Diferença: ${brl(fechado.diferenca)}`
                : 'Fechado sem conferência de gaveta'}
              {fechado.observacao ? ` · "${fechado.observacao}"` : ''}
            </p>
          </div>
        </div>
      )}

      {/* ── Grid: Faturamento + Resultado ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Card faturamento com breakdown */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--txt-dim)' }}>
                Faturamento Bruto
              </p>
              <p className="text-3xl font-black" style={{ color: 'var(--txt-strong)' }}>
                {loading ? '—' : brl(fat)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold" style={{ color: 'var(--txt-dim)' }}>{pedidos} pedidos</p>
              {ticket > 0 && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--accent)' }}>
                  tkm {brl(ticket)}
                </p>
              )}
            </div>
          </div>

          {/* Barras de forma de pagamento */}
          <div className="space-y-2.5">
            {[
              { label: 'PIX',      valor: pix,      Icon: Smartphone, cor: 'var(--accent)' },
              { label: 'Cartão',   valor: cartao,   Icon: CreditCard,  cor: '#818cf8'       },
              { label: 'Dinheiro', valor: dinheiro, Icon: Banknote,    cor: '#34d399'       },
            ].map(f => {
              const p = pct(f.valor, fat);
              return (
                <div key={f.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <f.Icon size={12} strokeWidth={1.75} style={{ color: f.cor }} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--txt-dim)' }}>{f.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${f.cor}18`, color: f.cor }}>{p}%</span>
                      <span className="text-xs font-black" style={{ color: 'var(--txt-strong)' }}>{brl(f.valor)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--space-elev-2)' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${p}%`, background: f.cor }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card resultado do dia */}
        <div className="rounded-2xl p-5" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
          <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--txt-dim)' }}>
            Resultado do Dia
          </p>

          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.12)' }}>
              <span className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--txt-dim)' }}>
                <span className="text-base">💰</span> Faturamento
              </span>
              <span className="font-black" style={{ color: '#22c55e' }}>+ {brl(fat)}</span>
            </div>

            <div className="flex items-center justify-between rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.12)' }}>
              <span className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--txt-dim)' }}>
                <span className="text-base">📤</span> Despesas
              </span>
              <span className="font-black" style={{ color: '#f87171' }}>− {brl(desp)}</span>
            </div>
          </div>

          <div className="h-px mb-4" style={{ background: 'var(--hairline)' }} />

          <div className="flex items-center justify-between">
            <span className="text-sm font-black" style={{ color: 'var(--txt-strong)' }}>Lucro Líquido</span>
            <div className="text-right">
              <p className="text-2xl font-black" style={{ color: resultado >= 0 ? '#22c55e' : '#f87171' }}>
                {brl(resultado)}
              </p>
              {fat > 0 && (
                <p className="text-xs font-semibold" style={{ color: 'var(--txt-dim)' }}>
                  margem {pct(resultado, fat)}%
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Conferência da gaveta (passo a passo) ──────── */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--hairline)' }}>

        {/* Header da seção */}
        <div className="px-5 py-3 flex items-center gap-3"
          style={{ background: 'rgba(34,197,94,0.06)', borderBottom: '1px solid var(--hairline)' }}>
          <Banknote size={18} strokeWidth={1.75} style={{ color: '#34d399' }} />
          <div>
            <p className="text-sm font-black" style={{ color: 'var(--txt-strong)' }}>
              Conferência da Gaveta — Dinheiro Físico
            </p>
            <p className="text-xs" style={{ color: 'var(--txt-dim)' }}>
              Preencha apenas se houve movimentação em dinheiro no dia
            </p>
          </div>
        </div>

        <div className="p-5 space-y-5" style={{ background: 'var(--space-elev)' }}>

          {/* Passo 1: Sistema registrou */}
          <div className="flex gap-4 items-start">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-black mt-0.5"
              style={{ background: 'rgba(34,197,94,0.15)', color: '#34d399', border: '1px solid rgba(34,197,94,0.3)' }}>1</div>
            <div className="flex-1">
              <p className="text-sm font-black" style={{ color: 'var(--txt-strong)' }}>
                Sistema registrou em dinheiro
              </p>
              <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--txt-dim)' }}>
                Total de pedidos pagos em espécie hoje
              </p>
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl"
                style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <Banknote size={16} strokeWidth={1.75} style={{ color: '#34d399' }} />
                <span className="text-xl font-black" style={{ color: '#34d399' }}>{brl(dinheiro)}</span>
              </div>
            </div>
          </div>

          {/* Passo 2: Sangria */}
          <div className="flex gap-4 items-start">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-black mt-0.5"
              style={{ background: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.25)' }}>2</div>
            <div className="flex-1">
              <p className="text-sm font-black" style={{ color: 'var(--txt-strong)' }}>
                Sangria — dinheiro retirado do caixa
              </p>
              <p className="text-xs mt-0.5 mb-2.5" style={{ color: 'var(--txt-dim)' }}>
                Ex: trocos dados, pagamentos feitos com o dinheiro do caixa, retiradas do responsável
              </p>
              <CampoValor
                label="Valor retirado durante o dia"
                icon={<ArrowUpFromLine size={14} strokeWidth={1.75} />}
                valor={sangrias} setValor={setSangrias}
                cor="#fbbf24" placeholder="0,00 se não houve" />
            </div>
          </div>

          {/* Passo 3: Suprimento */}
          <div className="flex gap-4 items-start">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-black mt-0.5"
              style={{ background: 'rgba(129,140,248,0.12)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.25)' }}>3</div>
            <div className="flex-1">
              <p className="text-sm font-black" style={{ color: 'var(--txt-strong)' }}>
                Suprimento — dinheiro colocado no caixa
              </p>
              <p className="text-xs mt-0.5 mb-2.5" style={{ color: 'var(--txt-dim)' }}>
                Ex: troco inicial colocado no começo do dia, entradas extras não registradas
              </p>
              <CampoValor
                label="Valor adicionado durante o dia"
                icon={<ArrowDownToLine size={14} strokeWidth={1.75} />}
                valor={suprimentos} setValor={setSuprimentos}
                cor="#818cf8" placeholder="0,00 se não houve" />
            </div>
          </div>

          {/* Cálculo esperado */}
          <div className="rounded-xl p-4" style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }}>
            <p className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--txt-dim)' }}>
              Cálculo — Quanto deveria estar na gaveta
            </p>
            <div className="space-y-1.5">
              <LinhaCalc label="Dinheiro registrado"         valor={brl(dinheiro)}   />
              {sangV > 0 && <LinhaCalc label="− Sangria (retirado)"    valor={brl(sangV)}     cor="#fbbf24" />}
              {supV  > 0 && <LinhaCalc label="+ Suprimento (adicionado)" valor={brl(supV)}    cor="#818cf8" />}
              <div className="h-px mt-2 mb-2" style={{ background: 'var(--hairline)' }} />
              <div className="flex items-center justify-between">
                <span className="text-sm font-black" style={{ color: 'var(--txt-strong)' }}>
                  Esperado na gaveta
                </span>
                <span className="text-lg font-black" style={{ color: 'var(--txt-strong)' }}>
                  {brl(esperado)}
                </span>
              </div>
            </div>
          </div>

          {/* Passo 4: contar gaveta */}
          <div className="flex gap-4 items-start">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-black mt-0.5"
              style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.3)' }}>4</div>
            <div className="flex-1">
              <p className="text-sm font-black" style={{ color: 'var(--txt-strong)' }}>
                Conte o dinheiro físico na gaveta agora
              </p>
              <p className="text-xs mt-0.5 mb-2.5" style={{ color: 'var(--txt-dim)' }}>
                Some todas as notas e moedas e digite o total abaixo
              </p>
              <CampoValor
                label="Total contado na gaveta"
                icon={<Wallet size={14} strokeWidth={1.75} />}
                valor={contado} setValor={setContado}
                cor="var(--accent)" grande />
            </div>
          </div>

          {/* Resultado da conferência */}
          {diferenca !== null && (
            <div className="rounded-2xl p-4 text-center"
              style={{ background: `${difCol}12`, border: `2px solid ${difCol}55` }}>
              <p className="text-3xl mb-1">{difIcon}</p>
              <p className="text-xl font-black" style={{ color: difCol }}>{difLabel}</p>
              {diferenca !== 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--txt-dim)' }}>
                  Esperado {brl(esperado)} · Contado {brl(Number(contado))}
                </p>
              )}
              {diferenca > 0 && (
                <p className="text-xs mt-1" style={{ color: '#fbbf24' }}>
                  Há mais dinheiro que o esperado — verifique se há uma sangria não registrada
                </p>
              )}
              {diferenca < 0 && (
                <p className="text-xs mt-1" style={{ color: '#f87171' }}>
                  Falta dinheiro — verifique se houve uma saída não registrada
                </p>
              )}
            </div>
          )}

          {/* Observação */}
          <div>
            <label className="text-xs font-semibold mb-1.5 flex items-center gap-1" style={{ color: 'var(--txt-dim)' }}>
              <Info size={11} strokeWidth={1.75} /> Observação (opcional)
            </label>
            <input value={obs} onChange={e => setObs(e.target.value)}
              placeholder="Ex: caixa estava OK, faltou troco pequeno, etc."
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: 'var(--space-elev-2)', color: 'var(--txt-strong)', border: '1px solid var(--hairline)' }} />
          </div>
        </div>
      </div>

      {/* ── WhatsApp + Ações ───────────────────────────── */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
        <p className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--txt-dim)' }}>
          Relatório via WhatsApp
        </p>

        {/* Config admin WA */}
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl mb-4"
          style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <Phone size={15} strokeWidth={1.75} style={{ color: adminWa ? '#25d366' : 'var(--txt-dim)' }} />
            <div className="min-w-0">
              <p className="text-xs font-semibold" style={{ color: 'var(--txt-strong)' }}>
                {adminWa ? `Enviar para +${adminWa}` : 'WhatsApp do administrador não configurado'}
              </p>
              <p className="text-[10px]" style={{ color: 'var(--txt-dim)' }}>
                {adminWa ? 'Número que receberá o relatório de fechamento' : 'Configure para receber o relatório'}
              </p>
            </div>
          </div>
          {editandoWa ? (
            <div className="flex gap-2 shrink-0">
              <input value={adminWa} onChange={e => setAdminWa(e.target.value)}
                placeholder="44999999999" autoFocus
                className="w-36 px-3 py-1.5 rounded-xl text-sm outline-none"
                style={{ background: 'var(--space-elev)', color: 'var(--txt-strong)', border: '1px solid var(--hairline)' }} />
              <button onClick={salvarAdminWa}
                className="px-3 py-1.5 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                Salvar
              </button>
            </div>
          ) : (
            <button onClick={() => setEditandoWa(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold shrink-0"
              style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.25)' }}>
              <Settings size={13} strokeWidth={1.75} className="inline mr-1" />
              {adminWa ? 'Alterar' : 'Configurar'}
            </button>
          )}
        </div>

        {/* Toggle enviar no fechamento */}
        <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl mb-4"
          style={{ background: enviarWa ? 'rgba(37,211,102,0.06)' : 'var(--space-elev-2)', border: `1px solid ${enviarWa ? 'rgba(37,211,102,0.2)' : 'var(--hairline)'}` }}>
          <input type="checkbox" checked={enviarWa} onChange={e => setEnviarWa(e.target.checked)}
            className="w-4 h-4 rounded accent-green-500 cursor-pointer" />
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--txt-strong)' }}>
              Enviar relatório ao fechar caixa
            </p>
            <p className="text-xs" style={{ color: 'var(--txt-dim)' }}>
              O relatório será disparado automaticamente no WhatsApp ao clicar em "Fechar Caixa"
            </p>
          </div>
        </label>

        {/* Botões de ação */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={soEnviar}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
            style={{ background: 'rgba(37,211,102,0.1)', color: '#25d366', border: '1px solid rgba(37,211,102,0.25)' }}>
            <Send size={15} strokeWidth={1.75} />
            Só enviar relatório
          </button>

          <button onClick={fechar} disabled={salvando}
            className="flex-2 py-3 px-6 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', boxShadow: '0 4px 20px rgba(var(--accent-rgb),0.3)', minWidth: 200 }}>
            <Lock size={15} strokeWidth={2} />
            {salvando ? 'Fechando...' : 'Fechar Caixa do Dia'}
            {!salvando && <ChevronRight size={15} strokeWidth={2} />}
          </button>
        </div>

        {/* Resumo do que será salvo */}
        {!fechado && (
          <div className="mt-3 px-3 py-2 rounded-xl text-xs" style={{ background: 'var(--space-elev-2)', color: 'var(--txt-dim)' }}>
            <span className="font-bold" style={{ color: 'var(--txt)' }}>Será registrado: </span>
            Faturamento {brl(fat)} · Despesas {brl(desp)} · Resultado {brl(resultado)}
            {contado !== '' && ` · Gaveta contada: ${brl(Number(contado))}`}
            {diferenca !== null && diferenca !== 0 && ` · Diferença: ${brl(diferenca)}`}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Componentes internos ──────────────────────────────────
function CampoValor({ label, icon, valor, setValor, cor, grande, placeholder }) {
  return (
    <div>
      <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--txt-dim)' }}>
        <span style={{ color: cor }}>{icon}</span>
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold"
          style={{ color: 'var(--txt-dim)' }}>R$</span>
        <input
          type="number" step="0.01" min="0" inputMode="decimal"
          placeholder={placeholder || '0,00'}
          value={valor} onChange={e => setValor(e.target.value)}
          className="w-full pl-10 pr-4 rounded-xl outline-none transition-all"
          style={{
            background: 'var(--space-elev-2)',
            color: valor ? cor : 'var(--txt-strong)',
            border: `1.5px solid ${valor ? cor + '66' : 'var(--hairline)'}`,
            fontWeight: grande ? 800 : 600,
            fontSize: grande ? 18 : 14,
            padding: grande ? '12px 16px 12px 40px' : '10px 16px 10px 40px',
          }}
        />
      </div>
    </div>
  );
}

function LinhaCalc({ label, valor, cor }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--txt-dim)' }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: cor || 'var(--txt-strong)' }}>{valor}</span>
    </div>
  );
}
