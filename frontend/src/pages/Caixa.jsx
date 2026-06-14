import React, { useState, useEffect, useCallback } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { getToken } from '../hooks/useAuth';
import {
  Wallet, Smartphone, Banknote, CreditCard, TrendingDown, RefreshCw,
  Lock, Send, Settings, CheckCircle2, AlertTriangle, ArrowDownToLine, ArrowUpFromLine,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '/api';
const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const authJ = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });
const hoje = () => new Date().toISOString().slice(0, 10);

export default function Caixa() {
  const [data, setData] = useState(hoje());
  const [resumo, setResumo] = useState(null);
  const [loading, setLoading] = useState(true);

  const [contado, setContado] = useState('');
  const [sangrias, setSangrias] = useState('');
  const [suprimentos, setSuprimentos] = useState('');
  const [obs, setObs] = useState('');
  const [enviarWa, setEnviarWa] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [adminWa, setAdminWa] = useState('');
  const [editandoWa, setEditandoWa] = useState(false);

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

  const esperado = resumo ? (resumo.dinheiro - (Number(sangrias) || 0) + (Number(suprimentos) || 0)) : 0;
  const diferenca = contado !== '' ? (Number(contado) - esperado) : null;

  async function salvarAdminWa() {
    await fetch(`${BASE}/caixa/admin-whatsapp`, { method: 'PUT', headers: authJ(), body: JSON.stringify({ numero: adminWa }) });
    setEditandoWa(false);
    toast.success('WhatsApp do administrador salvo');
  }

  async function fechar() {
    setSalvando(true);
    try {
      const r = await fetch(`${BASE}/caixa/fechar`, {
        method: 'POST', headers: authJ(),
        body: JSON.stringify({ data, valor_contado: contado, sangrias: Number(sangrias) || 0, suprimentos: Number(suprimentos) || 0, observacao: obs, enviar_whatsapp: enviarWa }),
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

  const fechado = resumo?.fechamento;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Toaster />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2.5" style={{ color: 'var(--txt-strong)' }}>
            <Wallet size={24} strokeWidth={1.75} style={{ color: 'var(--accent)' }} /> Fechamento de Caixa
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--txt-dim)' }}>Confira o dia e envie o relatório no WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={data} onChange={e => setData(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm outline-none"
            style={{ background: 'var(--space-elev)', color: 'var(--txt)', border: '1px solid var(--hairline)' }} />
          <button onClick={carregar} className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: 'var(--space-elev)', color: 'var(--txt-dim)', border: '1px solid var(--hairline)' }}>
            <RefreshCw size={16} strokeWidth={1.75} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {fechado && (
        <div className="rounded-2xl p-3 flex items-center gap-2.5" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <CheckCircle2 size={18} strokeWidth={1.75} style={{ color: '#34d399' }} />
          <span className="text-sm font-semibold" style={{ color: '#34d399' }}>
            Caixa já fechado para este dia {fechado.valor_contado != null && `· diferença ${brl(fechado.diferenca)}`}
          </span>
        </div>
      )}

      {/* Resumo do dia */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'PIX', valor: resumo?.pix, Icon: Smartphone, cor: 'var(--accent)' },
          { label: 'Dinheiro', valor: resumo?.dinheiro, Icon: Banknote, cor: '#34d399' },
          { label: 'Cartão', valor: resumo?.cartao, Icon: CreditCard, cor: '#818cf8' },
          { label: 'Despesas', valor: resumo?.despesas, Icon: TrendingDown, cor: '#f87171' },
        ].map(c => (
          <div key={c.label} className="rounded-2xl p-4" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-black" style={{ color: c.cor }}>{brl(c.valor)}</span>
              <span className="w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: `${c.cor}1a` }}><c.Icon size={15} strokeWidth={1.75} style={{ color: c.cor }} /></span>
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--txt-dim)' }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Totais */}
      <div className="rounded-2xl p-5 space-y-3" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--txt-dim)' }}>Faturamento ({resumo?.pedidos || 0} pedidos)</span>
          <span className="font-black text-lg" style={{ color: 'var(--txt-strong)' }}>{brl(resumo?.faturamento)}</span>
        </div>
        <div className="h-px" style={{ background: 'var(--hairline)' }} />
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold" style={{ color: 'var(--txt-strong)' }}>Resultado do dia</span>
          <span className="font-black text-xl" style={{ color: (resumo?.faturamento - resumo?.despesas) >= 0 ? '#34d399' : '#f87171' }}>
            {brl((resumo?.faturamento || 0) - (resumo?.despesas || 0))}
          </span>
        </div>
      </div>

      {/* Conferência da gaveta */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
        <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--txt-strong)' }}>
          <Banknote size={16} strokeWidth={1.75} style={{ color: '#34d399' }} /> Conferência do dinheiro
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Sangrias (retiradas)" Icon={ArrowUpFromLine} valor={sangrias} setValor={setSangrias} />
          <Campo label="Suprimentos (entradas)" Icon={ArrowDownToLine} valor={suprimentos} setValor={setSuprimentos} />
        </div>
        <Campo label="Dinheiro contado na gaveta" Icon={Wallet} valor={contado} setValor={setContado} destaque />

        {/* Esperado x contado */}
        <div className="rounded-xl p-3 space-y-1.5" style={{ background: 'var(--space-elev-2)' }}>
          <Linha label="Dinheiro recebido" valor={brl(resumo?.dinheiro)} />
          {Number(sangrias) > 0 && <Linha label="− Sangrias" valor={brl(sangrias)} />}
          {Number(suprimentos) > 0 && <Linha label="+ Suprimentos" valor={brl(suprimentos)} />}
          <Linha label="Esperado na gaveta" valor={brl(esperado)} bold />
          {diferenca != null && (
            <Linha label="Diferença" bold
              valor={brl(diferenca)}
              cor={diferenca === 0 ? '#34d399' : diferenca > 0 ? '#fbbf24' : '#f87171'}
              extra={diferenca === 0 ? 'ok' : diferenca > 0 ? 'sobra' : 'falta'} />
          )}
        </div>

        <input value={obs} onChange={e => setObs(e.target.value)} placeholder="Observação (opcional)"
          className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'var(--space-elev-2)', color: 'var(--txt-strong)', border: '1px solid var(--hairline)' }} />
      </div>

      {/* WhatsApp do administrador */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Settings size={16} strokeWidth={1.75} style={{ color: 'var(--txt-dim)' }} />
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--txt-strong)' }}>WhatsApp do administrador</p>
              <p className="text-xs truncate" style={{ color: 'var(--txt-dim)' }}>{adminWa ? `+${adminWa}` : 'Não configurado — para receber o relatório'}</p>
            </div>
          </div>
          {editandoWa ? (
            <div className="flex gap-2 shrink-0">
              <input value={adminWa} onChange={e => setAdminWa(e.target.value)} placeholder="44999999999"
                className="w-36 px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: 'var(--space-elev-2)', color: 'var(--txt-strong)', border: '1px solid var(--hairline)' }} />
              <button onClick={salvarAdminWa} className="px-3 py-2 rounded-xl text-xs font-bold" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>Salvar</button>
            </div>
          ) : (
            <button onClick={() => setEditandoWa(true)} className="px-3 py-2 rounded-xl text-xs font-bold shrink-0" style={{ background: 'var(--space-elev-2)', color: 'var(--txt)', border: '1px solid var(--hairline)' }}>
              {adminWa ? 'Alterar' : 'Configurar'}
            </button>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none" style={{ color: 'var(--txt)' }}>
          <input type="checkbox" checked={enviarWa} onChange={e => setEnviarWa(e.target.checked)} className="w-4 h-4 accent-orange-500" />
          Enviar relatório no WhatsApp ao fechar
        </label>
        <div className="flex-1" />
        <button onClick={soEnviar}
          className="py-3 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
          style={{ background: 'rgba(37,211,102,0.12)', color: '#25d366', border: '1px solid rgba(37,211,102,0.3)' }}>
          <Send size={15} strokeWidth={1.75} /> Só enviar relatório
        </button>
        <button onClick={fechar} disabled={salvando}
          className="py-3 px-5 rounded-xl text-sm font-black text-white flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))', boxShadow: '0 4px 16px rgba(var(--accent-rgb),0.3)' }}>
          <Lock size={15} strokeWidth={2} /> {salvando ? 'Fechando...' : 'Fechar caixa do dia'}
        </button>
      </div>
    </div>
  );
}

function Campo({ label, Icon, valor, setValor, destaque }) {
  return (
    <div>
      <label className="text-xs font-medium flex items-center gap-1.5 mb-1.5" style={{ color: 'var(--txt-dim)' }}>
        <Icon size={12} strokeWidth={1.75} /> {label}
      </label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--txt-dim)' }}>R$</span>
        <input type="number" step="0.01" min="0" inputMode="decimal" placeholder="0,00"
          value={valor} onChange={e => setValor(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ background: 'var(--space-elev-2)', color: 'var(--txt-strong)', border: `1px solid ${destaque ? 'rgba(var(--accent-rgb),0.4)' : 'var(--hairline)'}`, fontWeight: destaque ? 800 : 400 }} />
      </div>
    </div>
  );
}

function Linha({ label, valor, bold, cor, extra }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span style={{ color: 'var(--txt-dim)', fontWeight: bold ? 700 : 400 }}>{label}</span>
      <span style={{ color: cor || 'var(--txt-strong)', fontWeight: bold ? 800 : 500 }}>
        {valor}{extra && <span className="text-xs ml-1 opacity-80">({extra})</span>}
      </span>
    </div>
  );
}
