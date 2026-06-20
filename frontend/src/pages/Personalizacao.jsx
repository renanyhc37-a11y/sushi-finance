import React, { useState, useEffect } from 'react';
import { Sparkles, Star, Square, Rows3, Rows2, Check, Globe2, Orbit, Wind, Palette, RotateCcw, MessageSquare, Plus, Trash2, Phone } from 'lucide-react';
import { usePersonalizacao } from '../hooks/usePersonalizacao';
import { aplicarCorDestaque, cachearCor, corValida, COR_PADRAO } from '../lib/tema';
import { getToken } from '../hooks/useAuth';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

// Cores sugeridas (o operador também pode escolher qualquer cor no seletor).
const PRESETS_COR = [
  { hex: '#f97316', nome: 'Laranja' },
  { hex: '#1e3a8a', nome: 'Azul marinho' },
  { hex: '#dc2626', nome: 'Vermelho' },
  { hex: '#16a34a', nome: 'Verde' },
  { hex: '#7c3aed', nome: 'Roxo' },
  { hex: '#db2777', nome: 'Rosa' },
  { hex: '#0891b2', nome: 'Ciano' },
  { hex: '#ca8a04', nome: 'Dourado' },
];

function SecaoCor() {
  const [cor, setCor] = useState(COR_PADRAO);

  useEffect(() => {
    fetch('/api/cardapio/config')
      .then(r => r.json())
      .then(d => { if (d?.cor_destaque && corValida(d.cor_destaque)) setCor(d.cor_destaque); })
      .catch(() => {});
  }, []);

  function escolher(hex) {
    if (!corValida(hex)) return;
    setCor(hex);
    aplicarCorDestaque(hex);   // aplica na hora
    cachearCor(hex);           // cacheia p/ próximo load
    fetch('/api/cardapio/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ cor_destaque: hex }),
    }).catch(() => {});
  }

  return (
    <Secao titulo="Cor de destaque">
      <div className="rounded-2xl p-4" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
        <div className="flex items-center gap-3 mb-4">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)' }}>
            <Palette size={19} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
          </span>
          <div className="flex-1">
            <p className="text-[14px] font-semibold" style={{ color: 'var(--txt-strong)' }}>Cor da sua marca</p>
            <p className="text-[12px]" style={{ color: 'var(--txt-dim)' }}>Vale no painel e no cardápio do cliente. Aplicada na hora.</p>
          </div>
        </div>

        {/* Swatches sugeridas */}
        <div className="flex flex-wrap gap-2.5 mb-4">
          {PRESETS_COR.map(({ hex, nome }) => {
            const ativo = cor.toLowerCase() === hex.toLowerCase();
            return (
              <button key={hex} onClick={() => escolher(hex)} title={nome}
                className="w-9 h-9 rounded-full transition-all active:scale-90 flex items-center justify-center"
                style={{ background: hex, border: ativo ? '2px solid var(--txt-strong)' : '2px solid transparent', boxShadow: ativo ? `0 0 0 2px ${hex}` : 'none' }}>
                {ativo && <Check size={15} strokeWidth={3} color="#fff" />}
              </button>
            );
          })}
        </div>

        {/* Seletor livre + reset */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer" style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }}>
            <span className="w-6 h-6 rounded-md shrink-0" style={{ background: cor, border: '1px solid var(--hairline-strong)' }} />
            <span className="text-[13px] font-medium" style={{ color: 'var(--txt)' }}>Escolher outra cor</span>
            <input type="color" value={cor} onChange={e => escolher(e.target.value)} className="w-0 h-0 opacity-0 absolute" />
          </label>
          <span className="text-[12px] font-mono" style={{ color: 'var(--txt-dim)' }}>{cor.toUpperCase()}</span>
          {cor.toLowerCase() !== COR_PADRAO && (
            <button onClick={() => escolher(COR_PADRAO)} className="ml-auto flex items-center gap-1.5 text-[12px] font-medium" style={{ color: 'var(--txt-dim)' }}>
              <RotateCcw size={13} strokeWidth={1.75} /> Padrão
            </button>
          )}
        </div>
      </div>
    </Secao>
  );
}

const FUNDOS = [
  {
    id: 'aurora', nome: 'Aurora', desc: 'Brilhos suaves âmbar e índigo', icon: Sparkles,
    preview: `radial-gradient(60% 50% at 78% 8%, rgba(var(--accent-rgb),0.35), transparent 60%),
              radial-gradient(55% 45% at 12% 18%, rgba(99,102,241,0.35), transparent 60%), #0a0d14`,
  },
  {
    id: 'estrelas', nome: 'Estrelar', desc: 'Campo de estrelas com brilho', icon: Star,
    preview: `radial-gradient(1.5px 1.5px at 20% 30%, rgba(255,255,255,0.9), transparent),
              radial-gradient(1.5px 1.5px at 70% 25%, rgba(255,255,255,0.7), transparent),
              radial-gradient(1px 1px at 45% 65%, rgba(255,255,255,0.8), transparent),
              radial-gradient(1px 1px at 85% 55%, rgba(255,255,255,0.6), transparent), #06080f`,
  },
  {
    id: 'galaxia', nome: 'Galáxia', desc: 'Nebulosa girando devagar', icon: Orbit,
    preview: `radial-gradient(circle at 60% 45%, rgba(255,255,255,0.5), transparent 18%),
              conic-gradient(from 0deg at 60% 45%, rgba(129,90,248,0.5), rgba(56,189,248,0.25), rgba(236,72,153,0.4), rgba(129,90,248,0.5)), #06030f`,
  },
  {
    id: 'terra', nome: 'Planeta Terra', desc: 'A Terra vista do espaço', icon: Globe2,
    preview: `radial-gradient(circle at 50% 130%, #2563eb 0%, #0c2a6b 22%, transparent 40%),
              radial-gradient(1px 1px at 30% 20%, rgba(255,255,255,0.7), transparent),
              radial-gradient(1px 1px at 70% 30%, rgba(255,255,255,0.5), transparent), #03060f`,
  },
  {
    id: 'liso', nome: 'Liso', desc: 'Slate profundo, sem efeitos', icon: Square,
    preview: '#0a0d14',
  },
];

const DENSIDADES = [
  { id: 'confortavel', nome: 'Confortável', desc: 'Mais espaçamento entre os elementos', icon: Rows2 },
  { id: 'compacto',    nome: 'Compacto',    desc: 'Aproveita melhor a tela',            icon: Rows3 },
];

function SecaoRelatorio() {
  const [numeros, setNumeros] = useState([]);
  const [novo, setNovo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetch(`${BASE}/ia/relatorio-admins`, { headers: authH() })
      .then(r => r.json())
      .then(d => setNumeros(d.numeros || []))
      .catch(() => {});
  }, []);

  const salvar = async (lista) => {
    setSalvando(true);
    setMsg(null);
    try {
      const r = await fetch(`${BASE}/ia/relatorio-admins`, {
        method: 'PUT', headers: authH(),
        body: JSON.stringify({ numeros: lista }),
      });
      if (r.ok) { setNumeros(lista); setMsg({ ok: true, texto: 'Salvo!' }); }
      else setMsg({ ok: false, texto: 'Erro ao salvar.' });
    } catch { setMsg({ ok: false, texto: 'Erro de conexão.' }); }
    setSalvando(false);
    setTimeout(() => setMsg(null), 2500);
  };

  const adicionar = () => {
    const tel = novo.replace(/\D/g, '');
    if (!tel || tel.length < 10) return;
    if (numeros.includes(tel)) { setNovo(''); return; }
    salvar([...numeros, tel]);
    setNovo('');
  };

  const remover = (tel) => salvar(numeros.filter(n => n !== tel));

  return (
    <Secao titulo="Relatório diário WhatsApp">
      <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
        <div className="flex items-center gap-3 mb-1">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#052e16', border: '1px solid #16a34a' }}>
            <MessageSquare size={19} strokeWidth={1.75} style={{ color: '#4ade80' }} />
          </span>
          <div className="flex-1">
            <p className="text-[14px] font-semibold" style={{ color: 'var(--txt-strong)' }}>Admins que recebem o resumo</p>
            <p className="text-[12px]" style={{ color: 'var(--txt-dim)' }}>Todo dia às 23h, se o WhatsApp estiver conectado, esses números recebem o relatório automático.</p>
          </div>
        </div>

        {/* Lista de números cadastrados */}
        {numeros.length > 0 && (
          <div className="space-y-2">
            {numeros.map(tel => (
              <div key={tel} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }}>
                <Phone size={14} strokeWidth={1.75} style={{ color: 'var(--txt-dim)' }} />
                <span className="flex-1 text-[13px] font-mono" style={{ color: 'var(--txt)' }}>+{tel}</span>
                <button onClick={() => remover(tel)} title="Remover"
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
                  style={{ background: '#450a0a', border: '1px solid #dc2626', color: '#fca5a5' }}>
                  <Trash2 size={13} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        )}

        {numeros.length === 0 && (
          <p className="text-[12px] px-1" style={{ color: 'var(--txt-dim)' }}>Nenhum número cadastrado. Adicione abaixo.</p>
        )}

        {/* Campo para adicionar */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 px-3 rounded-xl" style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)' }}>
            <span className="text-[12px] font-mono shrink-0" style={{ color: 'var(--txt-dim)' }}>+</span>
            <input
              type="tel"
              placeholder="5544999998888 (com DDD e DDI)"
              value={novo}
              onChange={e => setNovo(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && adicionar()}
              className="flex-1 bg-transparent py-2.5 text-[13px] font-mono outline-none"
              style={{ color: 'var(--txt)' }}
            />
          </div>
          <button onClick={adicionar} disabled={salvando}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all active:scale-95"
            style={{ background: 'var(--accent-soft)', border: '1px solid rgba(var(--accent-rgb),0.4)', color: 'var(--accent)' }}>
            <Plus size={15} strokeWidth={2.5} />
            Adicionar
          </button>
        </div>

        {msg && (
          <p className="text-[12px] font-medium" style={{ color: msg.ok ? '#4ade80' : '#f87171' }}>{msg.texto}</p>
        )}

        <p className="text-[11px]" style={{ color: 'var(--txt-faint)' }}>
          Formato: código do país + DDD + número (ex: 5544999998888). Sem espaços ou traços.
        </p>
      </div>
    </Secao>
  );
}

function Secao({ titulo, children }) {
  return (
    <div>
      <h2 className="text-[13px] font-bold tracking-[0.14em] uppercase mb-3" style={{ color: 'var(--txt-dim)' }}>{titulo}</h2>
      {children}
    </div>
  );
}

export default function Personalizacao() {
  const { config, set } = usePersonalizacao();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--txt-strong)' }}>Personalização</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--txt-dim)' }}>Ajuste a aparência do sistema do seu jeito. As mudanças são aplicadas na hora.</p>
      </div>

      {/* Cor de destaque da marca */}
      <SecaoCor />

      {/* Plano de fundo */}
      <Secao titulo="Plano de fundo">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FUNDOS.map(({ id, nome, desc, icon: Icon, preview }) => {
            const ativo = config.fundo === id;
            return (
              <button key={id} onClick={() => set('fundo', id)}
                className="text-left rounded-2xl overflow-hidden transition-all active:scale-[0.98]"
                style={{ background: 'var(--space-elev)', border: `1px solid ${ativo ? 'var(--accent)' : 'var(--hairline)'}`, boxShadow: ativo ? '0 0 0 1px var(--accent), 0 8px 24px rgba(var(--accent-rgb),0.15)' : 'none' }}>
                <div className="h-24 relative" style={{ background: preview, backgroundSize: id === 'estrelas' || id === 'terra' ? '120px 120px, 120px 120px, 120px 120px, 100% 100%' : 'auto' }}>
                  {ativo && <span className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}><Check size={13} strokeWidth={3} color="#fff" /></span>}
                </div>
                <div className="px-3.5 py-3 flex items-center gap-2.5">
                  <Icon size={17} strokeWidth={1.75} style={{ color: ativo ? 'var(--accent)' : 'var(--txt-dim)' }} />
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--txt-strong)' }}>{nome}</p>
                    <p className="text-[11px]" style={{ color: 'var(--txt-dim)' }}>{desc}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Secao>

      {/* Movimento */}
      <Secao titulo="Movimento">
        <button onClick={() => set('animacao', !config.animacao)}
          className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[0.99]"
          style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: config.animacao ? 'var(--accent-soft)' : 'var(--space-elev-2)', border: `1px solid ${config.animacao ? 'rgba(var(--accent-rgb),0.3)' : 'var(--hairline-soft)'}` }}>
            <Wind size={19} strokeWidth={1.75} style={{ color: config.animacao ? 'var(--accent)' : 'var(--txt-dim)' }} />
          </span>
          <div className="flex-1">
            <p className="text-[14px] font-semibold" style={{ color: 'var(--txt-strong)' }}>Movimento suave</p>
            <p className="text-[12px]" style={{ color: 'var(--txt-dim)' }}>Estrelas cadentes e flutuação calma do fundo</p>
          </div>
          {/* Switch */}
          <span className="w-12 h-7 rounded-full relative shrink-0 transition-all" style={{ background: config.animacao ? 'var(--accent)' : 'var(--space-elev-2)', border: '1px solid var(--hairline)' }}>
            <span className="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all" style={{ left: config.animacao ? 'calc(100% - 22px)' : '2px' }} />
          </span>
        </button>
      </Secao>

      {/* Densidade */}
      <Secao titulo="Densidade da interface">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DENSIDADES.map(({ id, nome, desc, icon: Icon }) => {
            const ativo = config.densidade === id;
            return (
              <button key={id} onClick={() => set('densidade', id)}
                className="flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-left transition-all active:scale-[0.98]"
                style={{ background: 'var(--space-elev)', border: `1px solid ${ativo ? 'var(--accent)' : 'var(--hairline)'}`, boxShadow: ativo ? '0 0 0 1px var(--accent)' : 'none' }}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: ativo ? 'var(--accent-soft)' : 'var(--space-elev-2)', border: `1px solid ${ativo ? 'rgba(var(--accent-rgb),0.3)' : 'var(--hairline-soft)'}` }}>
                  <Icon size={19} strokeWidth={1.75} style={{ color: ativo ? 'var(--accent)' : 'var(--txt-dim)' }} />
                </span>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold" style={{ color: 'var(--txt-strong)' }}>{nome}</p>
                  <p className="text-[12px]" style={{ color: 'var(--txt-dim)' }}>{desc}</p>
                </div>
                {ativo && <Check size={18} strokeWidth={2.5} style={{ color: 'var(--accent)' }} />}
              </button>
            );
          })}
        </div>
      </Secao>

      {/* Relatório diário WhatsApp */}
      <SecaoRelatorio />

      <p className="text-[12px] flex items-center gap-2" style={{ color: 'var(--txt-faint)' }}>
        <Sparkles size={13} strokeWidth={1.75} /> A logo da sua loja pode ser enviada em Cardápio → Configurações e aparece na tela de login.
      </p>
    </div>
  );
}
