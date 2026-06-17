import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import GameHub from '../components/GameHub';
import { getToken } from '../hooks/useAuth';
import { getUnidadeId } from '../hooks/useUnidade';
import {
  Bell, ChefHat, CheckCircle2, Bike, X, Check, Smartphone, Banknote,
  CreditCard, MapPin, Star, Gift, AlertTriangle, ChevronDown, MessageCircle,
  Printer, RefreshCw, Circle, Undo2, ConciergeBell, Inbox, Clock, Pause,
  Volume2, Play, ShoppingBag, Plus, Trash2, Search as SearchIcon,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '/api';
const brl = v => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const authH = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

// ── Impressão via iframe (não é bloqueado pelo browser) ───────
function imprimirPedido(pedido) {
  const agora = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const pagamentoLabel = {
    dinheiro:    'DINHEIRO',
    cartao_cred: 'CARTAO CREDITO',
    cartao_deb:  'CARTAO DEBITO',
    pix:         'PIX',
  }[pedido.forma_pagamento] || (pedido.forma_pagamento?.toUpperCase()) || '---';

  const cfg = _printCfg;
  const fs = cfg.tamanhoBase;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Pedido #${pedido.numero}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-weight: 900;
      font-size: ${fs}px;
      color: #000;
      width: ${cfg.largura};
      padding: 6mm 4mm 10mm 4mm;
      line-height: 1.6;
    }
    b, strong { font-weight: 900; }
    .centro { text-align: center; }
    .sep-duplo { border-top: 4px double #000; margin: 8px 0; }
    .sep       { border-top: 2px dashed #000; margin: 8px 0; }
    .sep-solido { border-top: 2px solid #000; margin: 8px 0; }

    .loja-nome { font-size: ${fs+10}px; font-weight: 900; letter-spacing: 2px; }
    .loja-sub  { font-size: ${fs-2}px; font-weight: 900; letter-spacing: 4px; margin-top: 2px; }

    .secao-label {
      font-size: ${fs-4}px;
      font-weight: 900;
      letter-spacing: 2px;
      text-transform: uppercase;
      background: #000;
      color: #fff;
      padding: 2px 6px;
      margin-bottom: 4px;
      display: inline-block;
    }

    .num-pedido { font-size: ${fs+34}px; font-weight: 900; line-height: 1; letter-spacing: 3px; }
    .data-hora  { font-size: ${fs-2}px; font-weight: 900; margin-top: 4px; }

    .cliente-nome { font-size: ${fs+4}px; font-weight: 900; }
    .cliente-info { font-size: ${fs-1}px; font-weight: 900; margin-top: 3px; }

    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin: 6px 0;
      font-size: ${fs}px;
      font-weight: 900;
      border-bottom: 1px dotted #000;
      padding-bottom: 4px;
    }
    .item-nome { flex: 1; padding-right: 6px; }
    .item-qtd  { font-size: ${fs+4}px; font-weight: 900; min-width: 32px; }
    .item-val  { white-space: nowrap; font-size: ${fs-1}px; font-weight: 900; }

    .total-wrap {
      border: 3px solid #000;
      padding: 8px 10px;
      margin-top: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .total-label { font-size: ${fs+6}px; font-weight: 900; }
    .total-valor { font-size: ${fs+14}px; font-weight: 900; }

    .pgto-wrap {
      border: 2px solid #000;
      padding: 6px 10px;
      margin-top: 6px;
      font-size: ${fs+2}px;
      font-weight: 900;
      text-align: center;
      letter-spacing: 1px;
    }

    .troco-wrap {
      border: 3px solid #000;
      background: #000;
      color: #fff;
      padding: 6px 10px;
      margin-top: 6px;
      font-size: ${fs+2}px;
      font-weight: 900;
      text-align: center;
      letter-spacing: 1px;
    }
    .troco-valor { font-size: ${fs+8}px; font-weight: 900; margin-top: 2px; }

    .obs-wrap {
      border-left: 6px solid #000;
      padding: 6px 8px;
      margin-top: 6px;
      font-size: ${fs}px;
      font-weight: 900;
      background: #eee;
    }
    .obs-titulo { font-size: 14px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 2px; }

    .rodape { text-align: center; font-size: ${fs-3}px; font-weight: 900; margin-top: 8px; letter-spacing: 1px; }

    @media print {
      body { width: auto; }
      @page { margin: 3mm; size: ${cfg.largura} auto; }
    }
  </style>
</head>
<body>

  <div class="centro">
    <div class="loja-nome">${(cfg.loja || 'SUSHI CONTRLOL').toUpperCase()}</div>
    <div class="loja-sub">D E L I V E R Y</div>
  </div>

  <div class="sep-duplo"></div>

  <div class="centro">
    <div class="secao-label">PEDIDO</div><br/>
    <div class="num-pedido">#${pedido.numero}</div>
    <div class="data-hora">EFETUADO: ${new Date(pedido.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
    <div class="data-hora" style="font-size:${fs-4}px;letter-spacing:1px;">IMP: ${agora}</div>
    ${pedido.agendado_para ? `<div class="data-hora">AGENDADO P/ ${new Date(pedido.agendado_para).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>` : ''}
  </div>

  <div class="sep"></div>

  <div class="secao-label">CLIENTE</div>
  <div class="cliente-nome">${pedido.cliente_nome}</div>
  ${cfg.mostrarTel && pedido.cliente_telefone ? `<div class="cliente-info">TEL: ${pedido.cliente_telefone}</div>` : ''}
  ${cfg.mostrarEnd ? `<div class="cliente-info">END: ${pedido.cliente_endereco}${pedido.bairro ? ` - ${pedido.bairro}` : ''}</div>` : ''}
  ${pedido.frete > 0 ? `<div class="cliente-info">FRETE: ${brl(pedido.frete)}</div>` : ''}

  <div class="sep"></div>

  <div class="secao-label">ITENS</div>
  ${pedido.itens.map(i => `
    <div class="item-row">
      <span class="item-qtd">${i.quantidade}x</span>
      <span class="item-nome">${i.item_nome}</span>
      <span class="item-val">${brl(i.valor_unitario * i.quantidade)}</span>
    </div>
  `).join('')}

  <div class="total-wrap">
    <span class="total-label">TOTAL</span>
    <span class="total-valor">${brl(pedido.total)}</span>
  </div>

  ${cfg.mostrarPgto ? `<div class="pgto-wrap">PAGTO: ${pagamentoLabel}</div>` : ''}

  ${(pedido.forma_pagamento === 'dinheiro' && pedido.troco_para > pedido.total) ? `
    <div class="troco-wrap">
      <div>TROCO PARA ${brl(pedido.troco_para)}</div>
      <div class="troco-valor">LEVAR TROCO: ${brl(pedido.troco_para - pedido.total)}</div>
    </div>
  ` : ''}

  ${pedido.observacao ? `
    <div class="sep-solido"></div>
    <div class="obs-wrap">
      <div class="obs-titulo">*** OBSERVACOES ***</div>
      ${pedido.observacao}
    </div>
  ` : ''}

  <div class="sep-duplo"></div>
  <div class="rodape">OBRIGADO! BOM APETITE :)</div>

</body>
</html>`;

  // Remove iframe anterior se existir
  const anterior = document.getElementById('__print_frame__');
  if (anterior) anterior.remove();

  const iframe = document.createElement('iframe');
  iframe.id = '__print_frame__';
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();

  // Aguarda imagens/fontes e então imprime
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 2000);
    }, 300);
  };
}

// ── Camada 2: impressão idempotente ──────────────────────────
// Registra no SERVIDOR que a comanda foi impressa (ou libera reimpressão).
async function marcarImpresso(id, impresso = true) {
  try {
    await fetch(`${BASE}/pdv/pedidos/${id}/impresso`, {
      method: 'PATCH', headers: authH(), body: JSON.stringify({ impresso }),
    });
  } catch {}
}
// Impressão AUTOMÁTICA (ao aceitar / avançar): só imprime se a comanda ainda
// NÃO foi impressa. É a barreira que impede reimpressão em massa numa
// recuperação após queda — o desastre que aconteceu com a Saipos.
function imprimirAuto(pedido) {
  if (!pedido || pedido.impresso) return;
  imprimirPedido(pedido);
  marcarImpresso(pedido.id, true);
}
// Reimpressão MANUAL (botão): sempre imprime, de forma explícita.
function reimprimir(pedido) {
  imprimirPedido(pedido);
  marcarImpresso(pedido.id, true);
}

// ── WhatsApp ──────────────────────────────────────────────────
const MSG_STATUS = {
  novo:       (p) => `Olá, ${p.cliente_nome}! 🍣 Recebemos seu pedido #${p.numero} no valor de ${brl(p.total)}. Em breve começaremos a preparar!`,
  preparando: (p) => `Olá, ${p.cliente_nome}! 👨‍🍳 Seu pedido #${p.numero} já está sendo preparado. Aguarde um pouquinho!`,
  pronto:     (p) => `Olá, ${p.cliente_nome}! ✅ Seu pedido #${p.numero} está pronto e saindo para entrega agora! 🛵`,
  entregue:   (p) => `Olá, ${p.cliente_nome}! 🎉 Seu pedido #${p.numero} foi entregue. Bom apetite! 🍣`,
  cancelado:  (p) => `Olá, ${p.cliente_nome}. Seu pedido #${p.numero} foi cancelado. Entre em contato para mais informações.`,
};
function abrirWhatsApp(pedido, status) {
  const tel = pedido.cliente_telefone?.replace(/\D/g, '');
  if (!tel) return toast.error('Pedido sem telefone cadastrado');
  const fone = tel.startsWith('55') ? tel : `55${tel}`;
  const msg = (MSG_STATUS[status] || MSG_STATUS[pedido.status])(pedido);
  window.open(`https://wa.me/${fone}?text=${encodeURIComponent(msg)}`, '_blank');
}

// ── Som de campainha (Web Audio API) ─────────────────────────
let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }
  if (_audioCtx?.state === 'suspended') _audioCtx.resume().catch(() => {});
  return _audioCtx;
}

// Sons disponíveis
const SONS = {
  campanha: {
    label: 'Campainha',
    tocar: (vol = 0.7) => {
      const ctx = getAudioCtx(); if (!ctx) return;
      const notas = [
        { freq: 880, t: 0, dur: 0.35 }, { freq: 783.99, t: 0.20, dur: 0.35 },
        { freq: 659.25, t: 0.40, dur: 0.35 }, { freq: 523.25, t: 0.60, dur: 0.55 },
      ];
      notas.forEach(({ freq, t, dur }) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, ctx.currentTime + t);
        gain.gain.setValueAtTime(0, ctx.currentTime + t);
        gain.gain.linearRampToValueAtTime(vol * 0.6, ctx.currentTime + t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur);
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + dur + 0.05);
      });
    },
  },
  bip: {
    label: 'Bip duplo',
    tocar: (vol = 0.7) => {
      const ctx = getAudioCtx(); if (!ctx) return;
      [0, 0.25].forEach(t => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'square'; osc.frequency.setValueAtTime(1200, ctx.currentTime + t);
        gain.gain.setValueAtTime(0, ctx.currentTime + t);
        gain.gain.linearRampToValueAtTime(vol * 0.3, ctx.currentTime + t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.2);
      });
    },
  },
  alerta: {
    label: 'Alerta',
    tocar: (vol = 0.7) => {
      const ctx = getAudioCtx(); if (!ctx) return;
      [0, 0.15, 0.30].forEach((t, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(i % 2 === 0 ? 880 : 660, ctx.currentTime + t);
        gain.gain.setValueAtTime(0, ctx.currentTime + t);
        gain.gain.linearRampToValueAtTime(vol * 0.25, ctx.currentTime + t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.12);
        osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.14);
      });
    },
  },
  suave: {
    label: 'Suave',
    tocar: (vol = 0.7) => {
      const ctx = getAudioCtx(); if (!ctx) return;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine'; osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(880, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(vol * 0.4, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(); osc.stop(ctx.currentTime + 0.85);
    },
  },
};

// Configurações globais de som — persistidas no localStorage
let _somCfg = (() => {
  try { return JSON.parse(localStorage.getItem('pdv_som') || '{}'); } catch { return {}; }
})();
function salvarSomCfg() { try { localStorage.setItem('pdv_som', JSON.stringify(_somCfg)); } catch {} }
_somCfg.som = _somCfg.som || 'campanha';
_somCfg.volume = _somCfg.volume ?? 0.7;
// Som por coluna: { novo: 'campanha', preparando: null, pronto: 'bip', ... }
// null = usa o som padrão; 'off' = silencia aquela coluna
if (!_somCfg.porColuna) _somCfg.porColuna = {};

function tocarSom(status) {
  const cfg = _somCfg.porColuna?.[status];
  const som = cfg === undefined ? _somCfg.som : cfg;
  if (!som || som === 'off') return;
  SONS[som]?.tocar(_somCfg.volume);
}

// Configurações globais de impressão — persistidas no localStorage
let _printCfg = (() => {
  try { return JSON.parse(localStorage.getItem('pdv_print') || '{}'); } catch { return {}; }
})();
function salvarPrintCfg() { try { localStorage.setItem('pdv_print', JSON.stringify(_printCfg)); } catch {} }
_printCfg.largura     = _printCfg.largura     || '80mm';
_printCfg.tamanhoBase = _printCfg.tamanhoBase ?? 18;
_printCfg.mostrarEnd  = _printCfg.mostrarEnd  ?? true;
_printCfg.mostrarTel  = _printCfg.mostrarTel  ?? true;
_printCfg.mostrarPgto = _printCfg.mostrarPgto ?? true;

// ── Configurações de status ───────────────────────────────────
const STATUS_CFG = {
  novo:       { label: 'Novos',      Icon: Bell,         cor: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  borda: 'rgba(59,130,246,0.3)'  },
  espera:     { label: 'Espera',     Icon: Clock,        cor: '#a855f7', bg: 'rgba(168,85,247,0.08)', borda: 'rgba(168,85,247,0.3)'  },
  preparando: { label: 'Preparando', Icon: ChefHat,      cor: 'var(--accent-2)', bg: 'rgba(245,158,11,0.08)',  borda: 'rgba(245,158,11,0.3)'  },
  pronto:     { label: 'Prontos',    Icon: CheckCircle2, cor: '#10b981', bg: 'rgba(16,185,129,0.08)',  borda: 'rgba(16,185,129,0.3)'  },
  entregue:   { label: 'Entregues',  Icon: Bike,         cor: '#6b7280', bg: 'rgba(107,114,128,0.08)', borda: 'rgba(107,114,128,0.25)' },
  cancelado:  { label: 'Cancelados', Icon: X,            cor: '#ef4444', bg: 'rgba(239,68,68,0.08)',   borda: 'rgba(239,68,68,0.25)'  },
};
// Colunas do kanban (visíveis simultaneamente)
const COLUNAS = ['novo','espera','preparando','pronto','entregue'];
const AVANCAR = {
  novo:       { status: 'espera',     label: 'Aceitar',  Icon: Clock },
  espera:     { status: 'preparando', label: 'Preparar', Icon: ChefHat },
  preparando: { status: 'pronto',     label: 'Pronto',   Icon: CheckCircle2 },
  pronto:     { status: 'entregue',   label: 'Entregue', Icon: Bike },
};
function tempo(created_at) {
  const s = Math.floor((Date.now() - new Date(created_at + 'Z').getTime()) / 1000);
  if (s < 60) return { texto: `${s}s`, urgente: false };
  const m = Math.floor(s / 60);
  if (m < 60) return { texto: `${m}min`, urgente: m >= 20 };
  return { texto: `${Math.floor(m / 60)}h${m % 60}min`, urgente: true };
}

// ── Camada 3: semáforo de atraso + prioridade ────────────────
// O relógio relevante muda por etapa: pedido NOVO conta desde que chegou;
// EM PREPARO desde que foi aceito; PRONTO desde que ficou pronto (esperando
// sair). Assim o operador sempre sabe o que está mais atrasado de verdade.
const ATRASO_MIN = 15;   // amarelo a partir de 15 min na etapa
const ATRASO_CRIT = 30;  // vermelho a partir de 30 min na etapa
function refTempo(p) {
  if (p.status === 'preparando') return p.aceito_em || p.created_at;
  if (p.status === 'pronto') return p.pronto_em || p.created_at;
  return p.created_at;
}
function nivelAtraso(p) {
  const min = Math.floor((Date.now() - new Date(refTempo(p) + 'Z').getTime()) / 60000);
  if (min >= ATRASO_CRIT) return { min, nivel: 'critico', cor: '#ef4444', label: 'CRÍTICO' };
  if (min >= ATRASO_MIN) return { min, nivel: 'atrasado', cor: '#f59e0b', label: 'atrasado' };
  return { min, nivel: 'ok', cor: '#22c55e', label: 'no prazo' };
}

// ── Banner de alerta para pedidos novos ───────────────────────
function BannerNovoPedido({ pedidos, onAceitar, onIrParaNovos }) {
  const [piscando, setPiscando] = useState(true);
  useEffect(() => {
    const iv = setInterval(() => setPiscando(p => !p), 600);
    return () => clearInterval(iv);
  }, []);

  if (!pedidos.length) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex flex-col gap-0"
      style={{ filter: 'drop-shadow(0 8px 32px rgba(239,68,68,0.5))' }}>
      {pedidos.map(p => (
        <div key={p.id}
          className="flex items-center gap-3 px-4 py-3"
          style={{
            background: piscando
              ? 'linear-gradient(135deg, #7f1d1d, #991b1b)'
              : 'linear-gradient(135deg, #dc2626, #ef4444)',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            transition: 'background 0.3s',
          }}>
          {/* Ícone pulsante */}
          <div className="shrink-0 flex items-center justify-center w-10 h-10 rounded-2xl text-white"
            style={{ background: 'rgba(255,255,255,0.15)', animation: 'bellRing 0.5s infinite alternate' }}>
            <Bell size={20} strokeWidth={1.75} />
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-black text-white text-sm leading-none">
              Pedido #{p.numero} chegou!
            </p>
            <p className="text-red-200 text-xs mt-0.5 truncate">
              {p.cliente_nome} · {brl(p.total)}
            </p>
          </div>
          {/* Ações */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onIrParaNovos()}
              className="px-3 py-2 rounded-xl text-xs font-bold text-red-200 transition-all active:scale-95"
              style={{ background: 'rgba(0,0,0,0.25)' }}>
              Ver
            </button>
            <button
              onClick={() => onAceitar(p)}
              className="px-4 py-2 rounded-xl text-xs font-black text-red-700 transition-all active:scale-95"
              style={{ background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
              <span className="flex items-center gap-1.5"><Check size={14} strokeWidth={2.5} /> Aceitar</span>
            </button>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes bellRing {
          from { transform: rotate(-15deg) scale(1.1); }
          to   { transform: rotate(15deg)  scale(0.9); }
        }
      `}</style>
    </div>
  );
}

// ── Modal: novo pedido pelo operador ─────────────────────────
const PGTO_OPTS = [
  { v: 'pix',         l: 'PIX' },
  { v: 'dinheiro',    l: 'Dinheiro' },
  { v: 'cartao_cred', l: 'Crédito' },
  { v: 'cartao_deb',  l: 'Débito' },
];

function ModalNovoPedido({ onClose, onCriado }) {
  const [cardapio, setCardapio] = useState([]);
  const [busca, setBusca] = useState('');
  const [catAtiva, setCatAtiva] = useState('');
  const [carrinho, setCarrinho] = useState([]);
  const [cliente, setCliente] = useState({ nome: '', telefone: '', endereco: '', bairro: '' });
  const [pgto, setPgto] = useState('pix');
  const [tipoEntrega, setTipoEntrega] = useState('entrega');
  const [troco, setTroco] = useState('');
  const [obs, setObs] = useState('');
  const [frete, setFrete] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [painelAberto, setPainelAberto] = useState(false); // resumo/cliente no mobile
  const buscaRef = useRef(null);

  useEffect(() => {
    fetch(`${BASE}/cardapio/itens`, { headers: authH() })
      .then(r => r.ok ? r.json() : [])
      .then(data => setCardapio(Array.isArray(data) ? data.filter(i => i.disponivel) : []))
      .catch(() => {});
    setTimeout(() => buscaRef.current?.focus(), 100);
  }, []);

  const categorias = [...new Set(cardapio.map(i => i.categoria_nome || 'Outros'))];

  const itensFiltrados = cardapio.filter(i => {
    const matchBusca = !busca || i.nome.toLowerCase().includes(busca.toLowerCase());
    const matchCat = !catAtiva || (i.categoria_nome || 'Outros') === catAtiva;
    return matchBusca && matchCat;
  });

  const porCategoria = itensFiltrados.reduce((acc, i) => {
    const cat = i.categoria_nome || 'Outros';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(i);
    return acc;
  }, {});

  function addItem(item) {
    setCarrinho(prev => {
      const existe = prev.find(c => c.item.id === item.id);
      if (existe) return prev.map(c => c.item.id === item.id ? { ...c, qtd: c.qtd + 1 } : c);
      return [...prev, { item, qtd: 1 }];
    });
  }
  function setQtd(id, qtd) {
    if (qtd <= 0) setCarrinho(prev => prev.filter(c => c.item.id !== id));
    else setCarrinho(prev => prev.map(c => c.item.id === id ? { ...c, qtd } : c));
  }

  const subtotal = carrinho.reduce((s, c) => s + c.item.preco * c.qtd, 0);
  const totalFinal = subtotal + Number(frete || 0);
  const qtdItem = id => carrinho.find(c => c.item.id === id)?.qtd || 0;
  const totalItens = carrinho.reduce((s, c) => s + c.qtd, 0);

  async function enviar() {
    if (!cliente.nome.trim()) { toast.error('Informe o nome do cliente'); setPainelAberto(true); return; }
    if (carrinho.length === 0) { toast.error('Adicione pelo menos um item'); return; }
    setEnviando(true);
    try {
      const r = await fetch(`${BASE}/pdv/pedido`, {
        method: 'POST', headers: authH(),
        body: JSON.stringify({
          cliente_nome: cliente.nome,
          cliente_telefone: cliente.telefone,
          cliente_endereco: tipoEntrega === 'retirada' ? 'Retirada no balcão' : cliente.endereco,
          bairro: cliente.bairro,
          observacao: obs,
          forma_pagamento: pgto,
          tipo_entrega: tipoEntrega,
          frete: Number(frete || 0),
          troco_para: Number(troco || 0),
          itens: carrinho.map(c => ({ item_id: c.item.id, quantidade: c.qtd })),
        }),
      });
      const data = await r.json();
      if (!r.ok) { toast.error(data.erro || 'Erro ao criar pedido'); setEnviando(false); return; }
      toast.success(`Pedido #${data.numero} criado!`);
      onCriado?.();
      onClose();
    } catch { toast.error('Erro de conexão'); }
    setEnviando(false);
  }

  // Painel lateral (resumo + dados cliente)
  const PainelDireito = () => (
    <div className="flex flex-col h-full">
      {/* Tipo entrega */}
      <div className="px-4 pt-4 pb-3 shrink-0" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <div className="flex gap-2">
          {[{ v: 'entrega', l: '🛵 Entrega' }, { v: 'retirada', l: '🏪 Retirada' }].map(t => (
            <button key={t.v} onClick={() => setTipoEntrega(t.v)}
              className="flex-1 py-2 rounded-xl text-xs font-black transition-all"
              style={{ background: tipoEntrega === t.v ? 'rgba(var(--accent-rgb),0.15)' : 'var(--space-elev)', color: tipoEntrega === t.v ? 'var(--accent)' : 'var(--txt-dim)', border: `1px solid ${tipoEntrega === t.v ? 'rgba(var(--accent-rgb),0.3)' : 'var(--hairline)'}` }}>
              {t.l}
            </button>
          ))}
        </div>
      </div>

      {/* Scroll: carrinho + dados cliente */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

        {/* Carrinho */}
        {carrinho.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 t-dim text-center">
            <ShoppingBag size={28} strokeWidth={1.5} className="mb-2 opacity-40" />
            <p className="text-xs">Nenhum item ainda</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {carrinho.map(({ item, qtd }) => (
              <div key={item.id} className="flex items-center gap-2 py-1">
                <div className="flex items-center gap-1">
                  <button onClick={() => setQtd(item.id, qtd - 1)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center transition-all active:scale-90"
                    style={{ background: 'var(--space-elev-2)', color: qtd === 1 ? '#f87171' : 'var(--txt-dim)' }}>
                    {qtd === 1 ? <Trash2 size={11} strokeWidth={2} /> : <span className="text-xs font-black">−</span>}
                  </button>
                  <span className="text-xs font-black t-strong w-5 text-center">{qtd}</span>
                  <button onClick={() => setQtd(item.id, qtd + 1)}
                    className="w-6 h-6 rounded-lg flex items-center justify-center transition-all active:scale-90"
                    style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)' }}>
                    <span className="text-xs font-black">+</span>
                  </button>
                </div>
                <span className="flex-1 text-xs t-strong truncate">{item.nome}</span>
                <span className="text-xs font-black shrink-0" style={{ color: 'var(--accent)' }}>{brl(item.preco * qtd)}</span>
              </div>
            ))}
            {tipoEntrega === 'entrega' && (
              <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px dashed var(--hairline)' }}>
                <span className="text-xs t-dim flex-1">Frete</span>
                <input type="number" placeholder="0,00" value={frete}
                  onChange={e => setFrete(e.target.value)} min="0" step="0.01"
                  className="w-20 text-xs text-right rounded-lg px-2 py-1 outline-none"
                  style={{ background: 'var(--space-elev)', color: 'var(--txt)', border: '1px solid var(--hairline)' }} />
              </div>
            )}
            <div className="flex items-center justify-between pt-1 font-black" style={{ borderTop: '1px solid var(--hairline)' }}>
              <span className="text-xs t-dim">Total</span>
              <span className="text-sm" style={{ color: 'var(--accent)' }}>{brl(totalFinal)}</span>
            </div>
          </div>
        )}

        {/* Dados do cliente */}
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider t-dim">Cliente</p>
          {[
            { k: 'nome',     ph: 'Nome *',    type: 'text' },
            { k: 'telefone', ph: 'Telefone',  type: 'tel' },
            ...(tipoEntrega === 'entrega' ? [
              { k: 'endereco', ph: 'Endereço', type: 'text' },
              { k: 'bairro',   ph: 'Bairro',   type: 'text' },
            ] : []),
          ].map(({ k, ph, type }) => (
            <input key={k} type={type} placeholder={ph} value={cliente[k]}
              onChange={e => setCliente(prev => ({ ...prev, [k]: e.target.value }))}
              className="w-full text-xs rounded-xl px-3 py-2 outline-none"
              style={{ background: 'var(--space-elev)', color: 'var(--txt)', border: '1px solid var(--hairline)' }} />
          ))}
        </div>

        {/* Pagamento */}
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-wider t-dim">Pagamento</p>
          <div className="grid grid-cols-2 gap-1.5">
            {PGTO_OPTS.map(o => (
              <button key={o.v} onClick={() => setPgto(o.v)}
                className="py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: pgto === o.v ? 'rgba(var(--accent-rgb),0.15)' : 'var(--space-elev)', color: pgto === o.v ? 'var(--accent)' : 'var(--txt-dim)', border: `1px solid ${pgto === o.v ? 'rgba(var(--accent-rgb),0.3)' : 'var(--hairline)'}` }}>
                {o.l}
              </button>
            ))}
          </div>
          {pgto === 'dinheiro' && (
            <input type="number" placeholder="Troco para (R$)" value={troco}
              onChange={e => setTroco(e.target.value)} min="0" step="0.01"
              className="w-full text-xs rounded-xl px-3 py-2 outline-none"
              style={{ background: 'var(--space-elev)', color: 'var(--txt)', border: '1px solid var(--hairline)' }} />
          )}
        </div>

        {/* Observação */}
        <textarea placeholder="Observação (opcional)" value={obs}
          onChange={e => setObs(e.target.value)} rows={2}
          className="w-full text-xs rounded-xl px-3 py-2 outline-none resize-none"
          style={{ background: 'var(--space-elev)', color: 'var(--txt)', border: '1px solid var(--hairline)' }} />
      </div>

      {/* Botão criar */}
      <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid var(--hairline)' }}>
        <button onClick={enviar}
          disabled={enviando || carrinho.length === 0}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-white text-sm transition-all active:scale-95 disabled:opacity-40"
          style={{ background: carrinho.length === 0 ? 'var(--space-elev-2)' : 'var(--accent)' }}>
          {enviando ? 'Criando…' : <><Plus size={15} strokeWidth={2.5} /> Criar pedido{carrinho.length > 0 ? ` · ${brl(totalFinal)}` : ''}</>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(5px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      {/* Container: 2 colunas no desktop, 1 coluna no mobile */}
      <div className="w-full rounded-t-3xl sm:rounded-3xl overflow-hidden flex"
        style={{ background: 'var(--space-surface)', border: '1px solid var(--hairline)', maxHeight: '94vh', maxWidth: 820 }}>

        {/* ── Coluna esquerda: cardápio ── */}
        <div className="flex flex-col flex-1 min-w-0" style={{ borderRight: '1px solid var(--hairline)' }}>
          {/* Header */}
          <div className="shrink-0 flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
            <div className="flex-1 min-w-0">
              <p className="font-black t-strong text-sm leading-none">Novo pedido</p>
            </div>
            {/* Botão carrinho no mobile */}
            <button className="sm:hidden relative px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
              style={{ background: carrinho.length > 0 ? 'rgba(var(--accent-rgb),0.12)' : 'var(--space-elev)', color: carrinho.length > 0 ? 'var(--accent)' : 'var(--txt-dim)', border: `1px solid ${carrinho.length > 0 ? 'rgba(var(--accent-rgb),0.3)' : 'var(--hairline)'}` }}
              onClick={() => setPainelAberto(v => !v)}>
              <ShoppingBag size={13} strokeWidth={2} />
              {totalItens > 0 && <span>{totalItens}</span>}
            </button>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-xl t-dim shrink-0"
              style={{ background: 'var(--space-elev-2)' }}><X size={15} /></button>
          </div>

          {/* Busca */}
          <div className="shrink-0 px-3 pt-2.5 pb-2">
            <div className="relative">
              <SearchIcon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 t-dim" strokeWidth={2} />
              <input ref={buscaRef} value={busca} onChange={e => { setBusca(e.target.value); setCatAtiva(''); }}
                placeholder="Buscar item…"
                className="w-full text-sm rounded-xl pl-8 pr-3 py-2 outline-none"
                style={{ background: 'var(--space-elev)', color: 'var(--txt)', border: '1px solid var(--hairline)' }} />
            </div>
          </div>

          {/* Filtros de categoria */}
          {!busca && (
            <div className="shrink-0 px-3 pb-2 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              <button onClick={() => setCatAtiva('')}
                className="shrink-0 px-3 py-1 rounded-xl text-xs font-bold transition-all"
                style={{ background: !catAtiva ? 'rgba(var(--accent-rgb),0.15)' : 'var(--space-elev)', color: !catAtiva ? 'var(--accent)' : 'var(--txt-dim)', border: `1px solid ${!catAtiva ? 'rgba(var(--accent-rgb),0.3)' : 'var(--hairline)'}` }}>
                Todos
              </button>
              {categorias.map(cat => (
                <button key={cat} onClick={() => setCatAtiva(cat === catAtiva ? '' : cat)}
                  className="shrink-0 px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
                  style={{ background: catAtiva === cat ? 'rgba(var(--accent-rgb),0.15)' : 'var(--space-elev)', color: catAtiva === cat ? 'var(--accent)' : 'var(--txt-dim)', border: `1px solid ${catAtiva === cat ? 'rgba(var(--accent-rgb),0.3)' : 'var(--hairline)'}` }}>
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Lista de itens */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-3">
            {Object.entries(porCategoria).map(([cat, items]) => (
              <div key={cat}>
                {!catAtiva && <p className="text-[10px] font-black uppercase tracking-wider t-dim mb-1.5 mt-1">{cat}</p>}
                <div className="space-y-1">
                  {items.map(item => {
                    const qtd = qtdItem(item.id);
                    return (
                      <div key={item.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
                        style={{ background: qtd > 0 ? 'rgba(var(--accent-rgb),0.08)' : 'var(--space-elev)', border: `1px solid ${qtd > 0 ? 'rgba(var(--accent-rgb),0.25)' : 'transparent'}` }}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold t-strong leading-tight truncate">{item.nome}</p>
                          <p className="text-xs font-black" style={{ color: 'var(--accent)' }}>{brl(item.preco)}</p>
                        </div>
                        {qtd === 0 ? (
                          <button onClick={() => addItem(item)}
                            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all active:scale-90 shrink-0"
                            style={{ background: 'rgba(var(--accent-rgb),0.12)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
                            <Plus size={16} strokeWidth={2.5} />
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => setQtd(item.id, qtd - 1)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all active:scale-90"
                              style={{ background: 'var(--space-elev-2)' }}>
                              {qtd === 1 ? <Trash2 size={13} strokeWidth={2} style={{ color: '#f87171' }} /> : <span className="text-sm font-black t-dim">−</span>}
                            </button>
                            <span className="text-sm font-black t-strong w-5 text-center">{qtd}</span>
                            <button onClick={() => addItem(item)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all active:scale-90"
                              style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)' }}>
                              <span className="text-sm font-black">+</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {Object.keys(porCategoria).length === 0 && (
              <p className="text-center t-dim text-sm py-10">Nenhum item encontrado</p>
            )}
          </div>
        </div>

        {/* ── Coluna direita: resumo + cliente (sempre visível no desktop) ── */}
        <div className="hidden sm:flex flex-col shrink-0" style={{ width: 280 }}>
          <PainelDireito />
        </div>

        {/* ── Painel mobile: slide-up quando aberto ── */}
        {painelAberto && (
          <div className="sm:hidden fixed inset-0 z-10 flex flex-col justify-end"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={e => { if (e.target === e.currentTarget) setPainelAberto(false); }}>
            <div className="rounded-t-3xl overflow-hidden flex flex-col" style={{ background: 'var(--space-surface)', maxHeight: '85vh', border: '1px solid var(--hairline)' }}>
              <div className="shrink-0 flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
                <p className="font-black t-strong text-sm">Resumo do pedido</p>
                <button onClick={() => setPainelAberto(false)} className="w-7 h-7 flex items-center justify-center rounded-xl t-dim" style={{ background: 'var(--space-elev-2)' }}><X size={15} /></button>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col">
                <PainelDireito />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Barra de métricas customizável ───────────────────────────
const ESTILOS_BARRA = [
  {
    id: 'default',
    nome: 'Padrão',
    preview: 'R$ 0,00',
    wrap:   { background: 'rgba(var(--accent-rgb),0.08)', border: '1px solid rgba(var(--accent-rgb),0.2)', borderRadius: 12, padding: '6px 12px' },
    valor:  { color: 'var(--accent)', fontWeight: 900, fontSize: 13 },
    label:  { color: 'var(--t-dim)', fontSize: 10 },
    chip:   (bg, cor) => ({ background: bg, color: cor, padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700 }),
    anim:   '',
  },
  {
    id: 'cyberpunk',
    nome: 'Cyberpunk',
    preview: '▸ R$ 0,00',
    wrap:   { background: 'rgba(0,0,0,0.85)', border: '1px solid #ff00aa', borderRadius: 4, padding: '6px 14px', boxShadow: '0 0 12px rgba(255,0,170,0.3), inset 0 0 20px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' },
    valor:  { color: '#ffee00', fontWeight: 900, fontSize: 13, fontFamily: 'monospace', letterSpacing: 2, textShadow: '0 0 8px #ffee00, 0 0 20px rgba(255,238,0,0.5)' },
    label:  { color: '#ff00aa', fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 3 },
    chip:   (bg, cor) => ({ background: 'transparent', color: '#00ffcc', border: '1px solid #00ffcc', padding: '1px 8px', borderRadius: 2, fontSize: 10, fontWeight: 700, fontFamily: 'monospace', letterSpacing: 1, textShadow: '0 0 6px #00ffcc' }),
    anim:   'barra-glitch',
  },
  {
    id: 'neon',
    nome: 'Neon',
    preview: 'R$ 0,00',
    wrap:   { background: 'rgba(0,0,0,0.7)', border: '1px solid #00f5ff', borderRadius: 8, padding: '6px 14px', boxShadow: '0 0 16px rgba(0,245,255,0.25), inset 0 0 16px rgba(0,245,255,0.05)' },
    valor:  { color: '#00f5ff', fontWeight: 900, fontSize: 13, textShadow: '0 0 10px #00f5ff, 0 0 30px rgba(0,245,255,0.4)' },
    label:  { color: 'rgba(0,245,255,0.6)', fontSize: 10 },
    chip:   (bg, cor) => ({ background: 'rgba(0,245,255,0.1)', color: '#00f5ff', border: '1px solid rgba(0,245,255,0.4)', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, textShadow: '0 0 6px #00f5ff' }),
    anim:   'barra-pulse-neon',
  },
  {
    id: 'matrix',
    nome: 'Matrix',
    preview: '>> R$ 0,00',
    wrap:   { background: 'rgba(0,20,0,0.9)', border: '1px solid #00ff41', borderRadius: 4, padding: '6px 14px', boxShadow: '0 0 10px rgba(0,255,65,0.2)' },
    valor:  { color: '#00ff41', fontWeight: 700, fontSize: 13, fontFamily: '"Courier New", monospace', textShadow: '0 0 8px #00ff41' },
    label:  { color: '#00aa2a', fontSize: 10, fontFamily: '"Courier New", monospace' },
    chip:   (bg, cor) => ({ background: 'rgba(0,255,65,0.08)', color: '#00ff41', border: '1px solid rgba(0,255,65,0.3)', padding: '2px 8px', borderRadius: 2, fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }),
    anim:   'barra-scan',
  },
  {
    id: 'retro',
    nome: 'Retrô',
    preview: 'R$ 0,00',
    wrap:   { background: 'rgba(30,15,0,0.95)', border: '2px solid #ff8800', borderRadius: 6, padding: '6px 14px', boxShadow: '0 0 0 1px rgba(255,136,0,0.2), 0 0 20px rgba(255,136,0,0.1)', position: 'relative' },
    valor:  { color: '#ffaa33', fontWeight: 700, fontSize: 13, fontFamily: '"Courier New", monospace', textShadow: '0 0 6px rgba(255,170,51,0.6)' },
    label:  { color: '#804400', fontSize: 10, fontFamily: '"Courier New", monospace' },
    chip:   (bg, cor) => ({ background: 'rgba(255,136,0,0.1)', color: '#ff8800', border: '1px solid rgba(255,136,0,0.4)', padding: '2px 8px', borderRadius: 3, fontSize: 10, fontWeight: 700, fontFamily: 'monospace' }),
    anim:   'barra-flicker',
  },
  {
    id: 'minimal',
    nome: 'Minimal',
    preview: 'R$ 0,00',
    wrap:   { padding: '4px 0' },
    valor:  { color: 'var(--t-strong)', fontWeight: 900, fontSize: 14 },
    label:  { color: 'var(--t-faint)', fontSize: 10 },
    chip:   (bg, cor) => ({ color: 'var(--t-dim)', fontSize: 11, fontWeight: 600, padding: '0 4px' }),
    anim:   '',
  },
  {
    id: 'holo',
    nome: 'Holográfico',
    preview: 'R$ 0,00',
    wrap:   { background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.12) 50%, rgba(236,72,153,0.12) 100%)', border: '1px solid rgba(168,85,247,0.35)', borderRadius: 12, padding: '6px 14px', boxShadow: '0 2px 20px rgba(99,102,241,0.15)' },
    valor:  { background: 'linear-gradient(90deg,#6366f1,#a855f7,#ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', fontWeight: 900, fontSize: 13 },
    label:  { color: 'rgba(168,85,247,0.7)', fontSize: 10 },
    chip:   (bg, cor) => ({ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)', padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700 }),
    anim:   'barra-holo-shift',
  },
];

const BARRA_ANIM_CSS = `
@keyframes barra-glitch-shift {
  0%,100% { text-shadow: 0 0 8px #ffee00, 2px 0 #ff00aa, -2px 0 #00ffcc; }
  25%      { text-shadow: -2px 0 #ff00aa, 2px 0 #00ffcc; clip-path: inset(10% 0 80% 0); }
  50%      { text-shadow: 2px 0 #00ffcc, -2px 0 #ffee00; clip-path: inset(60% 0 20% 0); }
  75%      { text-shadow: 1px 0 #ffee00, -1px 0 #ff00aa; }
}
.barra-glitch .barra-valor { animation: barra-glitch-shift 4s infinite steps(1); }

@keyframes barra-neon-pulse {
  0%,100% { opacity: 1; }
  50%     { opacity: 0.75; }
}
.barra-pulse-neon .barra-wrap { animation: barra-neon-pulse 2s ease-in-out infinite; }

@keyframes barra-scanline {
  0%   { transform: translateY(-100%); }
  100% { transform: translateY(400%); }
}
.barra-scan .barra-wrap::after {
  content: ''; position: absolute; left: 0; top: 0; right: 0; height: 25%;
  background: linear-gradient(to bottom, transparent, rgba(0,255,65,0.08), transparent);
  animation: barra-scanline 2.5s linear infinite; pointer-events: none;
}

@keyframes barra-flicker-anim {
  0%,100% { opacity: 1; }
  92%     { opacity: 1; }
  93%     { opacity: 0.4; }
  94%     { opacity: 1; }
  97%     { opacity: 0.7; }
  98%     { opacity: 1; }
}
.barra-flicker .barra-wrap { animation: barra-flicker-anim 5s infinite; }

@keyframes barra-holo-shift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.barra-holo-shift .barra-wrap { background-size: 200% 200%; animation: barra-holo-shift 4s ease infinite; }
`;

const TRANSICOES = [
  { id: 'fade',       nome: 'Fade',        desc: 'Dissolve suave' },
  { id: 'slide-up',   nome: 'Slide Up',    desc: 'Sobe de baixo' },
  { id: 'slide-left', nome: 'Slide Left',  desc: 'Entra pela direita' },
  { id: 'typewriter', nome: 'Typewriter',  desc: 'Digita letra a letra' },
  { id: 'marquee',    nome: 'Letreiro',    desc: 'Rola continuamente' },
  { id: 'flip',       nome: 'Flip',        desc: 'Vira como placar' },
  { id: 'glitch',     nome: 'Glitch',      desc: 'Falha digital' },
  { id: 'zoom',       nome: 'Zoom',        desc: 'Aparece do centro' },
];

const EXTRA_ANIM_CSS = `
@keyframes tw-blink { 0%,100%{opacity:1} 50%{opacity:0} }
@keyframes letreiro-scroll { 0%{transform:translateX(100%)} 100%{transform:translateX(-100%)} }
@keyframes flip-in { 0%{transform:rotateX(-90deg);opacity:0} 100%{transform:rotateX(0);opacity:1} }
@keyframes flip-out { 0%{transform:rotateX(0);opacity:1} 100%{transform:rotateX(90deg);opacity:0} }
@keyframes zoom-in { 0%{transform:scale(0.5);opacity:0} 100%{transform:scale(1);opacity:1} }
@keyframes zoom-out { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.5);opacity:0} }
@keyframes slide-up-in  { 0%{transform:translateY(20px);opacity:0} 100%{transform:translateY(0);opacity:1} }
@keyframes slide-up-out { 0%{transform:translateY(0);opacity:1} 100%{transform:translateY(-20px);opacity:0} }
@keyframes slide-left-in  { 0%{transform:translateX(40px);opacity:0} 100%{transform:translateX(0);opacity:1} }
@keyframes slide-left-out { 0%{transform:translateX(0);opacity:1} 100%{transform:translateX(-40px);opacity:0} }
@keyframes glitch-in { 0%{clip-path:inset(50% 0 50% 0);transform:translateX(-4px)} 25%{clip-path:inset(10% 0 80% 0);transform:translateX(4px)} 50%{clip-path:inset(60% 0 20% 0);transform:translateX(-2px)} 75%{clip-path:inset(0);transform:translateX(0)} 100%{clip-path:none;transform:none;opacity:1} }
`;

function useTypewriter(text, active, speed = 50) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!active) { setDisplayed(text); return; }
    setDisplayed('');
    let i = 0;
    const t = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(t);
    }, speed);
    return () => clearInterval(t);
  }, [text, active]);
  return displayed;
}

function FraseDisplay({ frase, transicaoId, estiloTexto, estiloWrap }) {
  const [fase, setFase] = useState('in'); // 'in' | 'show' | 'out'
  const twText = useTypewriter(frase, transicaoId === 'typewriter' && fase === 'in');

  useEffect(() => { setFase('in'); const t = setTimeout(() => setFase('show'), 600); return () => clearTimeout(t); }, [frase, transicaoId]);

  const animIn = {
    fade:        { animation: 'barra-neon-pulse 0.4s ease forwards', opacity: fase === 'in' ? 0 : 1, transition: 'opacity 0.4s' },
    'slide-up':  { animation: fase === 'in' ? 'slide-up-in 0.4s ease forwards' : 'none' },
    'slide-left':{ animation: fase === 'in' ? 'slide-left-in 0.4s ease forwards' : 'none' },
    typewriter:  {},
    marquee:     {},
    flip:        { animation: fase === 'in' ? 'flip-in 0.5s ease forwards' : 'none', transformOrigin: 'center', perspective: 400 },
    glitch:      { animation: fase === 'in' ? 'glitch-in 0.5s steps(1) forwards' : 'none' },
    zoom:        { animation: fase === 'in' ? 'zoom-in 0.4s ease forwards' : 'none' },
  }[transicaoId] || {};

  if (transicaoId === 'marquee') {
    return (
      <div style={{ ...estiloWrap, overflow: 'hidden', minWidth: 160, maxWidth: 320 }}>
        <div style={{ ...estiloTexto, display: 'inline-block', whiteSpace: 'nowrap', animation: 'letreiro-scroll 8s linear infinite' }}>
          {frase}&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;{frase}
        </div>
      </div>
    );
  }

  const texto = transicaoId === 'typewriter' ? twText : frase;
  return (
    <div style={{ ...estiloWrap, overflow: 'hidden' }}>
      <span style={{ ...estiloTexto, display: 'inline-block', ...animIn }}>
        {texto}
        {transicaoId === 'typewriter' && texto.length < frase.length && (
          <span style={{ animation: 'tw-blink 0.7s infinite', marginLeft: 1 }}>▌</span>
        )}
      </span>
    </div>
  );
}

function ModalLetreiro({ onClose, estiloId }) {
  const salvar = (k, v) => { localStorage.setItem(k, JSON.stringify(v)); };
  const ler    = (k, def) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; } catch { return def; } };

  const [frases,      setFrases]      = useState(() => ler('pdv_letreiro_frases', ['🍣 Bem-vindo ao 37 Sushi!', '🔥 Pedidos no WhatsApp', '⭐ Qualidade premium']));
  const [transicao,   setTransicao]   = useState(() => ler('pdv_letreiro_transicao', 'fade'));
  const [intervalo,   setIntervalo]   = useState(() => ler('pdv_letreiro_intervalo', 4));
  const [ativo,       setAtivo]       = useState(() => ler('pdv_letreiro_ativo', false));
  const [novaFrase,   setNovaFrase]   = useState('');
  const [previewIdx,  setPreviewIdx]  = useState(0);
  const estilo = ESTILOS_BARRA.find(e => e.id === estiloId) || ESTILOS_BARRA[0];

  useEffect(() => {
    if (!frases.length) return;
    const t = setInterval(() => setPreviewIdx(i => (i + 1) % frases.length), intervalo * 1000);
    return () => clearInterval(t);
  }, [frases, intervalo]);

  function adicionarFrase() {
    if (!novaFrase.trim()) return;
    const novas = [...frases, novaFrase.trim()];
    setFrases(novas); salvar('pdv_letreiro_frases', novas); setNovaFrase('');
  }
  function removerFrase(i) { const novas = frases.filter((_, j) => j !== i); setFrases(novas); salvar('pdv_letreiro_frases', novas); }
  function moverFrase(i, dir) {
    const novas = [...frases]; const j = i + dir;
    if (j < 0 || j >= novas.length) return;
    [novas[i], novas[j]] = [novas[j], novas[i]]; setFrases(novas); salvar('pdv_letreiro_frases', novas);
  }
  function toggleAtivo() {
    const v = !ativo; setAtivo(v); salvar('pdv_letreiro_ativo', v);
  }
  function mudarTransicao(t) { setTransicao(t); salvar('pdv_letreiro_transicao', t); }
  function mudarIntervalo(v) { setIntervalo(v); salvar('pdv_letreiro_intervalo', v); }
  function salvarTudo() { onClose(); }

  const fraseAtual = frases[previewIdx] || '';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden" style={{ background: 'var(--space-elev)', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '92vh', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <p className="font-black t-strong text-sm flex items-center gap-2">
              <span>📺</span> Letreiro Personalizado
            </p>
            <p className="text-[10px] t-faint mt-0.5">Frases exibidas na barra do PDV com transições</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg t-dim" style={{ background: 'var(--space-elev-2)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {/* Preview ao vivo */}
          <div>
            <p className="text-[10px] font-black t-dim tracking-widest mb-2">PREVIEW AO VIVO</p>
            <div className="rounded-xl p-4 flex items-center justify-center" style={{ background: '#0a0a0a', minHeight: 56, border: '1px solid rgba(255,255,255,0.06)' }}>
              {frases.length > 0
                ? <FraseDisplay frase={fraseAtual} transicaoId={transicao} estiloTexto={estilo.valor} estiloWrap={{}} />
                : <span className="text-xs t-faint">Adicione frases abaixo</span>}
            </div>
          </div>

          {/* On/Off */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: 'var(--space-elev-2)' }}>
            <div>
              <p className="text-sm font-bold t-strong">Letreiro ativo</p>
              <p className="text-[10px] t-dim mt-0.5">Substitui as métricas na barra do PDV</p>
            </div>
            <button onClick={toggleAtivo}
              className="w-12 h-6 rounded-full relative transition-colors shrink-0"
              style={{ background: ativo ? 'var(--accent)' : '#333' }}>
              <div className="w-5 h-5 bg-white rounded-full absolute top-0.5 transition-all shadow" style={{ left: ativo ? '26px' : '2px' }} />
            </button>
          </div>

          {/* Frases */}
          <div>
            <p className="text-[10px] font-black t-dim tracking-widest mb-2">FRASES ({frases.length})</p>
            <div className="space-y-1.5 mb-2">
              {frases.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--space-elev-2)', border: previewIdx === i ? '1px solid rgba(var(--accent-rgb),0.3)' : '1px solid transparent' }}>
                  <span className="text-[10px] t-faint w-4 shrink-0 text-center">{i + 1}</span>
                  <span className="flex-1 text-sm t-strong truncate">{f}</span>
                  <button onClick={() => moverFrase(i, -1)} disabled={i === 0} className="text-[10px] t-faint px-1 disabled:opacity-20">▲</button>
                  <button onClick={() => moverFrase(i, 1)} disabled={i === frases.length - 1} className="text-[10px] t-faint px-1 disabled:opacity-20">▼</button>
                  <button onClick={() => removerFrase(i)} className="w-6 h-6 flex items-center justify-center rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={novaFrase} onChange={e => setNovaFrase(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && adicionarFrase()}
                placeholder="Nova frase… (Enter para adicionar)"
                className="flex-1 px-3 py-2 rounded-xl text-sm t-strong outline-none"
                style={{ background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.06)' }} />
              <button onClick={adicionarFrase}
                className="px-3 py-2 rounded-xl text-xs font-bold shrink-0"
                style={{ background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.3)' }}>
                + Adicionar
              </button>
            </div>
          </div>

          {/* Transição */}
          <div>
            <p className="text-[10px] font-black t-dim tracking-widest mb-2">TRANSIÇÃO</p>
            <div className="grid grid-cols-2 gap-1.5">
              {TRANSICOES.map(t => (
                <button key={t.id} onClick={() => mudarTransicao(t.id)}
                  className="px-3 py-2.5 rounded-xl text-left transition-all"
                  style={transicao === t.id
                    ? { background: 'rgba(var(--accent-rgb),0.15)', border: '1px solid rgba(var(--accent-rgb),0.4)' }
                    : { background: 'var(--space-elev-2)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <p className="text-xs font-bold t-strong">{t.nome}</p>
                  <p className="text-[10px] t-dim">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Intervalo */}
          <div>
            <p className="text-[10px] font-black t-dim tracking-widest mb-2">INTERVALO ENTRE FRASES — {intervalo}s</p>
            <input type="range" min={2} max={15} value={intervalo} onChange={e => mudarIntervalo(Number(e.target.value))}
              className="w-full accent-orange-500" />
            <div className="flex justify-between text-[10px] t-faint mt-1"><span>2s</span><span>15s</span></div>
          </div>
        </div>

        <div className="px-5 pb-5 pt-3 flex gap-2 shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-bold t-dim" style={{ background: 'var(--space-elev-2)' }}>Cancelar</button>
          <button onClick={salvarTudo}
            className="flex-1 py-2.5 rounded-xl text-sm font-black t-strong"
            style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-2))' }}>
            Salvar configurações
          </button>
        </div>
      </div>
    </div>
  );
}

function BarraMetricas({ metricasHoje, faturamentoHoje }) {
  const ler = (k, def) => { try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : def; } catch { return def; } };
  const [estiloId,  setEstiloId]  = useState(() => localStorage.getItem('pdv_barra_estilo') || 'default');
  const [abrirConfig, setAbrirConfig] = useState(false);
  const [abrirLetreiro, setAbrirLetreiro] = useState(false);
  const [fraseIdx,  setFraseIdx]  = useState(0);
  const [letrAtivo, setLetrAtivo] = useState(() => ler('pdv_letreiro_ativo', false));
  const [frases,    setFrases]    = useState(() => ler('pdv_letreiro_frases', []));
  const [transicao, setTransicao] = useState(() => ler('pdv_letreiro_transicao', 'fade'));
  const [intervalo, setIntervalo] = useState(() => ler('pdv_letreiro_intervalo', 4));
  const refConfig = useRef(null);
  const estilo = ESTILOS_BARRA.find(e => e.id === estiloId) || ESTILOS_BARRA[0];

  // Recarrega config do localStorage ao fechar o modal
  function recarregarConfig() {
    setLetrAtivo(ler('pdv_letreiro_ativo', false));
    setFrases(ler('pdv_letreiro_frases', []));
    setTransicao(ler('pdv_letreiro_transicao', 'fade'));
    setIntervalo(ler('pdv_letreiro_intervalo', 4));
  }

  useEffect(() => {
    if (!letrAtivo || !frases.length) return;
    const t = setInterval(() => setFraseIdx(i => (i + 1) % frases.length), intervalo * 1000);
    return () => clearInterval(t);
  }, [letrAtivo, frases, intervalo]);

  useEffect(() => {
    function fechar(e) { if (refConfig.current && !refConfig.current.contains(e.target)) setAbrirConfig(false); }
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, []);

  const m = metricasHoje;
  const total = m?.total || faturamentoHoje || 0;

  return (<>
    <style>{BARRA_ANIM_CSS + EXTRA_ANIM_CSS}</style>
    {abrirLetreiro && <ModalLetreiro estiloId={estiloId} onClose={() => { setAbrirLetreiro(false); recarregarConfig(); }} />}

    <div className={`flex items-center gap-2 relative ${estilo.anim}`}>
      {/* Conteúdo: letreiro OU métricas */}
      {letrAtivo && frases.length > 0
        ? <FraseDisplay frase={frases[fraseIdx] || ''} transicaoId={transicao} estiloTexto={estilo.valor} estiloWrap={estilo.wrap} />
        : (
          <div className="barra-wrap flex items-center gap-2 flex-wrap" style={estilo.wrap}>
            <span className="barra-valor" style={estilo.valor}>{brl(total)}</span>
            <span style={estilo.label}>hoje</span>
            {m?.pix > 0      && <span style={estilo.chip('rgba(99,102,241,0.15)','#818cf8')}>PIX {brl(m.pix)}</span>}
            {m?.dinheiro > 0 && <span style={estilo.chip('rgba(16,185,129,0.12)','#34d399')}>$ {brl(m.dinheiro)}</span>}
            {m?.cartao > 0   && <span style={estilo.chip('rgba(245,158,11,0.12)','#fbbf24')}>Cartão {brl(m.cartao)}</span>}
          </div>
        )
      }

      {/* Botão de configuração */}
      <div ref={refConfig} className="relative">
        <button onClick={() => setAbrirConfig(v => !v)}
          className="w-6 h-6 flex items-center justify-center rounded-lg"
          style={{ color: 'var(--t-faint)', opacity: abrirConfig ? 1 : 0.4 }}
          title="Personalizar barra">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
        </button>

        {abrirConfig && (
          <div className="absolute top-full mt-2 right-0 z-50 rounded-2xl overflow-hidden"
            style={{ background: 'var(--space-elev)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 16px 48px rgba(0,0,0,0.7)', width: 270 }}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-xs font-black t-strong">Personalizar barra</p>
            </div>

            {/* Letreiro */}
            <div className="px-3 pt-3 pb-2">
              <p className="text-[10px] font-black t-faint tracking-widest mb-1.5">LETREIRO</p>
              <button onClick={() => { setAbrirConfig(false); setAbrirLetreiro(true); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left"
                style={{ background: letrAtivo ? 'rgba(var(--accent-rgb),0.12)' : 'var(--space-elev-2)', border: letrAtivo ? '1px solid rgba(var(--accent-rgb),0.3)' : '1px solid transparent' }}>
                <span className="text-lg">📺</span>
                <div>
                  <p className="text-xs font-bold t-strong">Frases personalizadas</p>
                  <p className="text-[10px] t-dim">{letrAtivo ? `${frases.length} frase(s) · ${transicao}` : 'Desativado'}</p>
                </div>
              </button>
            </div>

            {/* Estilos */}
            <div className="px-3 pb-3">
              <p className="text-[10px] font-black t-faint tracking-widest mb-1.5 mt-2">ESTILO VISUAL</p>
              <div className="space-y-1">
                {ESTILOS_BARRA.map(e => (
                  <button key={e.id} onClick={() => { setEstiloId(e.id); localStorage.setItem('pdv_barra_estilo', e.id); setAbrirConfig(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all"
                    style={estiloId === e.id
                      ? { background: 'rgba(var(--accent-rgb),0.12)', border: '1px solid rgba(var(--accent-rgb),0.3)' }
                      : { background: 'transparent', border: '1px solid transparent' }}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-mono" style={e.valor}>{e.preview}</span>
                      <span className="text-xs t-strong">{e.nome}</span>
                    </div>
                    {estiloId === e.id && (
                      <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--accent)' }}>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </>);
}

// ── Componente principal ──────────────────────────────────────
const hoje = () => new Date().toISOString().slice(0, 10);

export default function PDV() {
  const [pedidos, setPedidos] = useState([]);
  const [resumo, setResumo] = useState({ novo: 0, espera: 0, preparando: 0, pronto: 0, entregue: 0, cancelado: 0 });
  const [loading, setLoading] = useState(true);
  const [pedidoAberto, setPedidoAberto] = useState(null);
  const [pedidoModal, setPedidoModal] = useState(null);
  const [historicoCliente, setHistoricoCliente] = useState([]);
  const [metricasHoje, setMetricasHoje] = useState(null);
  const [pedidosNovosAlerta, setPedidosNovosAlerta] = useState([]);
  const [mostrarCancelados, setMostrarCancelados] = useState(false);
  const [ocultarCancelados, setOcultarCancelados] = useState(() => sessionStorage.getItem('pdv_ocultar_cancelados') === '1');
  const alarmRef = useRef(null);
  const [tick, setTick] = useState(0);
  const [filtroData, setFiltroData] = useState(hoje());
  const [busca, setBusca] = useState('');

  // ── Config de som / impressão ───────────────────────────────
  const [colunaAtiva, setColunaAtiva] = useState('novo');
  const [mostrarSom, setMostrarSom] = useState(false);
  const [mostrarPrint, setMostrarPrint] = useState(false);
  const [jogoAberto, setJogoAberto] = useState(false);
  const [somAtual, setSomAtual] = useState(_somCfg.som);
  const [volumeAtual, setVolumeAtual] = useState(_somCfg.volume);
  const [printVer, setPrintVer] = useState(0); // força re-render ao mudar printCfg

  // ── Controle de loja ────────────────────────────────────────
  const [statusLoja, setStatusLoja] = useState(null); // null | 'aberto_forcado' | 'fechado_forcado' | 'fechamento_temp' | 'auto'
  const [pausaMin, setPausaMin] = useState(null);
  const [mostrarControlesLoja, setMostrarControlesLoja] = useState(false);
  const [novoPedidoAberto, setNovoPedidoAberto] = useState(false);

  const carregarStatusLoja = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/cardapio/config`, { headers: authH() });
      const d = await r.json();
      if (d.nome_restaurante) { _printCfg.loja = d.nome_restaurante; }
      if (d.fechado_forcado) setStatusLoja('fechado_forcado');
      else if (d.aberto_forcado) setStatusLoja('aberto_forcado');
      else if (d.fechamento_temp) { setStatusLoja('fechamento_temp'); setPausaMin(d.fechamento_temp); }
      else { setStatusLoja('auto'); setPausaMin(null); }
    } catch {}
  }, []);

  useEffect(() => { carregarStatusLoja(); }, [carregarStatusLoja]);

  async function lojaAbrirAgora() {
    await fetch(`${BASE}/cardapio/abrir-agora`, { method: 'POST', headers: authH() });
    carregarStatusLoja();
    toast.success('Loja aberta!');
  }
  async function lojaFecharAgora() {
    await fetch(`${BASE}/cardapio/fechar-agora`, { method: 'POST', headers: authH() });
    carregarStatusLoja();
    toast.success('Loja fechada!');
  }
  async function lojaAutomatico() {
    await fetch(`${BASE}/cardapio/modo-forcado`, { method: 'DELETE', headers: authH() });
    await fetch(`${BASE}/cardapio/fechar-temp`, { method: 'DELETE', headers: authH() });
    carregarStatusLoja();
    toast.success('Modo automático ativado');
  }
  async function lojaPausar(minutos) {
    await fetch(`${BASE}/cardapio/fechar-temp`, {
      method: 'POST', headers: { ...authH(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ minutos }),
    });
    carregarStatusLoja();
    toast.success(`Pausa de ${minutos} min ativada`);
  }

  // ── Alarme em loop ──────────────────────────────────────────
  const iniciarAlarme = useCallback(() => {
    if (alarmRef.current) return; // já tocando
    tocarSom('novo');
    alarmRef.current = setInterval(() => { tocarSom('novo'); }, 4500);
  }, []);

  const pararAlarme = useCallback(() => {
    if (alarmRef.current) { clearInterval(alarmRef.current); alarmRef.current = null; }
  }, []);

  // Para o alarme quando não houver mais alertas pendentes
  useEffect(() => {
    if (pedidosNovosAlerta.length === 0) pararAlarme();
  }, [pedidosNovosAlerta, pararAlarme]);

  // ── Carregar pedidos — sempre todos os status do dia ────────
  const carregar = useCallback(async (silent = false) => {
    try {
      const [pRes, rRes] = await Promise.all([
        fetch(`${BASE}/pdv/pedidos?status=todos&data=${filtroData}&unidade_id=${getUnidadeId()}`, { headers: authH() }),
        fetch(`${BASE}/pdv/resumo`, { headers: authH() }),
      ]);
      if (!pRes.ok) return;
      const [pData, rData] = await Promise.all([pRes.json(), rRes.json()]);
      setPedidos(pData);
      setResumo(rData);
    } catch {}
    setLoading(false);
  }, [filtroData]);

  useEffect(() => { setLoading(true); carregar(); }, [carregar]);

  // ── Solicita permissão de notificação do navegador ───────────
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── SSE — eventos em tempo real ─────────────────────────────
  useEffect(() => {
    const es = new EventSource(`${BASE}/pdv/eventos?token=${encodeURIComponent(getToken())}`);

    es.addEventListener('novo_pedido', async (e) => {
      const dados = JSON.parse(e.data);

      // Adiciona ao banner de alerta e inicia alarme
      setPedidosNovosAlerta(prev => {
        if (prev.some(p => p.id === dados.id)) return prev;
        return [...prev, dados];
      });
      iniciarAlarme();

      toast(`🔔 Novo pedido #${dados.numero} — ${dados.cliente_nome}`, {
        duration: 8000,
        style: {
          background: 'linear-gradient(135deg, #0f1c3a, #0a1628)',
          color: '#93c5fd', fontWeight: '700',
          border: '1px solid rgba(59,130,246,0.5)',
          fontSize: 14, borderRadius: 16, padding: '12px 16px',
          boxShadow: '0 8px 32px rgba(59,130,246,0.3)',
        },
      });

      // Notificação do sistema operacional (funciona mesmo com a aba minimizada)
      if ('Notification' in window && Notification.permission === 'granted') {
        const notif = new Notification(`🔔 Novo pedido #${dados.numero}`, {
          body: `${dados.cliente_nome} · R$ ${Number(dados.total || 0).toFixed(2).replace('.', ',')}`,
          icon: '/pwa-192x192.png',
          badge: '/pwa-64x64.png',
          tag: `pedido-${dados.id}`,
          requireInteraction: true,
        });
        notif.onclick = () => { window.focus(); notif.close(); };
      }

      carregar(true);
    });

    es.addEventListener('status_atualizado', (e) => {
      carregar(true);
      try {
        const dados = JSON.parse(e.data);
        if (dados?.id) setPedidosNovosAlerta(prev => {
          const next = prev.filter(p => p.id !== dados.id);
          if (next.length === 0) pararAlarme();
          return next;
        });
      } catch {}
    });
    es.addEventListener('impresso_atualizado', () => carregar(true));
    es.onerror = () => {};

    const iv1 = setInterval(() => carregar(true), 30000);
    const iv2 = setInterval(() => setTick(t => t + 1), 30000);

    return () => { es.close(); clearInterval(iv1); clearInterval(iv2); };
  }, [carregar, iniciarAlarme]);

  // ── Aceitar pedido pelo banner ──────────────────────────────
  async function aceitarPedido(pedido) {
    try {
      await fetch(`${BASE}/pdv/pedidos/${pedido.id}/status`, {
        method: 'PATCH', headers: authH(),
        body: JSON.stringify({ status: 'espera' }),
      });
      removerAlerta(pedido.id);
      toast.success(`#${pedido.numero} aceito — na fila de espera!`);

      // Impressão automática ao aceitar (idempotente: não reimprime se já saiu)
      const res = await fetch(`${BASE}/pdv/pedidos/${pedido.id}`, { headers: authH() });
      if (res.ok) imprimirAuto(await res.json());

      carregar(true);
    } catch { toast.error('Erro ao aceitar pedido'); }
  }

  function removerAlerta(id) {
    setPedidosNovosAlerta(prev => {
      const next = prev.filter(p => p.id !== id);
      if (next.length === 0) pararAlarme();
      return next;
    });
  }

  // ── Avançar status ──────────────────────────────────────────
  async function avancar(pedido) {
    const prox = AVANCAR[pedido.status];
    if (!prox) return;
    try {
      await fetch(`${BASE}/pdv/pedidos/${pedido.id}/status`, {
        method: 'PATCH', headers: authH(),
        body: JSON.stringify({ status: prox.status }),
      });

      // Se era novo, remove do alerta e imprime (idempotente)
      if (pedido.status === 'novo') {
        removerAlerta(pedido.id);
        imprimirAuto(pedido);
      }

      if (pedido.cliente_telefone) {
        toast((t) => (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span>#{pedido.numero} → {prox.status}</span>
            <button onClick={() => { abrirWhatsApp(pedido, prox.status); toast.dismiss(t.id); }}
              style={{ background: '#25d366', color: '#fff', border: 'none', borderRadius: 8, padding: '4px 10px', fontWeight: 700, cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageCircle size={13} strokeWidth={2} /> Avisar cliente
            </button>
          </div>
        ), { duration: 6000 });
      } else {
        toast.success(`#${pedido.numero} → ${prox.status}`);
      }

      if (pedidoAberto?.id === pedido.id) setPedidoAberto(null);
      if (pedidoModal?.id === pedido.id) setPedidoModal(null);
      carregar(true);
    } catch { toast.error('Erro ao atualizar'); }
  }

  async function confirmarPix(pedido) {
    try {
      await fetch(`${BASE}/pdv/pedidos/${pedido.id}/pix-confirmado`, { method: 'PATCH', headers: authH() });
      toast.success(`PIX do pedido #${pedido.numero} confirmado ✓`);
      carregar(true);
    } catch { toast.error('Erro ao confirmar'); }
  }

  async function cancelar(pedido) {
    if (!confirm(`Cancelar pedido #${pedido.numero}?`)) return;
    try {
      await fetch(`${BASE}/pdv/pedidos/${pedido.id}/status`, {
        method: 'PATCH', headers: authH(),
        body: JSON.stringify({ status: 'cancelado' }),
      });
      if (pedido.status === 'novo') removerAlerta(pedido.id);
      toast.success(`#${pedido.numero} cancelado`);
      if (pedidoAberto?.id === pedido.id) setPedidoAberto(null);
      if (pedidoModal?.id === pedido.id) setPedidoModal(null);
      carregar(true);
    } catch { toast.error('Erro ao cancelar'); }
  }

  async function abrirModal(pedido) {
    setPedidoModal(pedido);
    setHistoricoCliente([]);
    if (pedido.cliente_telefone) {
      try {
        const r = await fetch(`${BASE}/pdv/cliente/${encodeURIComponent(pedido.cliente_telefone)}/historico`, { headers: authH() });
        if (r.ok) setHistoricoCliente(await r.json());
      } catch {}
    }
  }

  async function carregarMetricasHoje() {
    try {
      const r = await fetch(`${BASE}/pdv/metricas-hoje`, { headers: authH() });
      if (r.ok) setMetricasHoje(await r.json());
    } catch {}
  }

  useEffect(() => {
    carregarMetricasHoje();
    const iv = setInterval(carregarMetricasHoje, 30000);
    return () => clearInterval(iv);
  }, []);

  const totalAtivos = (resumo.novo || 0) + (resumo.preparando || 0) + (resumo.pronto || 0);
  const temAlerta = pedidosNovosAlerta.length > 0;
  const faturamentoHoje = pedidos.filter(p => p.status !== 'cancelado').reduce((s, p) => s + (p.total || 0), 0);

  // Agrupa pedidos por status para o kanban. Nas colunas ATIVAS, ordena por
  // prioridade: quem está esperando há mais tempo aparece em cima (= o que
  // deve sair primeiro). Resolve o "não sei o que sai primeiro" da Saipos.
  const pedidosFiltrados = busca.trim()
    ? pedidos.filter(p => {
        const q = busca.trim().toLowerCase();
        return String(p.numero).includes(q) || (p.cliente_nome || '').toLowerCase().includes(q);
      })
    : pedidos;

  const porStatus = Object.fromEntries(
    [...COLUNAS, 'cancelado'].map(s => {
      let arr = pedidosFiltrados.filter(p => p.status === s);
      if (s === 'novo' || s === 'preparando' || s === 'pronto') {
        arr = [...arr].sort((a, b) => new Date(refTempo(a) + 'Z') - new Date(refTempo(b) + 'Z'));
      }
      return [s, arr];
    })
  );

  // ── Camada 3: exportar fila ativa (contingência) ──────────────
  // Gera uma folha imprimível com TODOS os pedidos ativos, ordenados por
  // prioridade, com o tempo de espera e o nível de atraso. Se a tela/sistema
  // cair no pico, a cozinha continua operando no papel — sem perder a ordem.
  function exportarFila() {
    const ativos = ['novo', 'preparando', 'pronto'].flatMap(s => porStatus[s] || []);
    if (!ativos.length) { toast('Nenhum pedido ativo na fila'); return; }
    const secao = (s, titulo) => {
      const lista = porStatus[s] || [];
      if (!lista.length) return '';
      const rows = lista.map((p, i) => {
        const a = nivelAtraso(p);
        const itens = (p.itens || []).map(it => `${it.quantidade}x ${it.item_nome || it.nome || ''}`).join(', ');
        return `<tr><td class="n">${i + 1}</td><td class="num">#${p.numero}</td><td>${new Date(p.created_at + 'Z').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td><td class="${a.nivel}">${a.min}min${a.nivel !== 'ok' ? ' · ' + a.label : ''}</td><td class="it">${itens || '—'}${p.cliente_nome ? ' <span class=cl>(' + p.cliente_nome + ')</span>' : ''}</td></tr>`;
      }).join('');
      return `<h2>${titulo} (${lista.length})</h2><table><thead><tr><th>#</th><th>Pedido</th><th>Hora</th><th>Espera</th><th>Itens</th></tr></thead><tbody>${rows}</tbody></table>`;
    };
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      *{font-family:Arial,Helvetica,sans-serif} body{margin:16px;color:#000}
      h1{font-size:18px;margin:0 0 2px} .sub{font-size:11px;color:#555;margin:0 0 12px}
      h2{font-size:13px;margin:14px 0 4px;border-bottom:2px solid #000;padding-bottom:2px}
      table{width:100%;border-collapse:collapse;font-size:12px} th,td{text-align:left;padding:3px 5px;border-bottom:1px solid #ccc;vertical-align:top}
      .n{width:16px;color:#999} .num{font-weight:bold;width:52px} .it{font-size:11px} .cl{color:#666}
      .atrasado{color:#b45309;font-weight:bold} .critico{color:#b91c1c;font-weight:bold} .ok{color:#15803d}
      @media print{body{margin:0}}
    </style></head><body>
      <h1>Fila de Pedidos — Contingência</h1>
      <p class="sub">${new Date().toLocaleString('pt-BR')} · ${ativos.length} pedido(s) ativo(s) · ordenado por prioridade (mais antigo primeiro)</p>
      ${secao('novo', 'AGUARDANDO ACEITE')}${secao('preparando', 'EM PREPARO')}${secao('pronto', 'PRONTO / SAINDO')}
    </body></html>`;
    const iframe = document.createElement('iframe');
    Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    document.body.appendChild(iframe);
    iframe.contentDocument.open(); iframe.contentDocument.write(html); iframe.contentDocument.close();
    iframe.onload = () => { setTimeout(() => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => iframe.remove(), 2000); }, 200); };
  }

  // Card de pedido — renderizado inline para evitar re-montagem por closure
  const renderCard = (pedido) => {
    const cfg = STATUS_CFG[pedido.status] || STATUS_CFG.novo;
    const av = AVANCAR[pedido.status];
    const { texto: tempoTexto } = tempo(pedido.created_at);
    const atraso = pedido.status === 'entregue' || pedido.status === 'cancelado' ? null : nivelAtraso(pedido);
    const aberto = pedidoAberto?.id === pedido.id;
    const eNovo = pedido.status === 'novo';
    const eEntregue = pedido.status === 'entregue';

    // Cards entregues ficam colapsados até clicar
    if (eEntregue && !aberto) {
      return (
        <div key={pedido.id} className="rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer"
          style={{ background: 'var(--space-elev)', border: '1.5px solid var(--space-elev-2)' }}
          onClick={() => setPedidoAberto(pedido)}>
          <div style={{ height: 3, background: `linear-gradient(90deg, ${cfg.cor}, ${cfg.cor}44)` }} />
          <div className="px-3 py-2 flex items-center gap-2">
            <span className="text-sm font-black t-strong">#{pedido.numero}</span>
            <span className="text-sm font-bold t-strong truncate flex-1">{pedido.cliente_nome}</span>
            <span className="text-xs t-dim">{tempoTexto}</span>
            <span className="text-sm font-black t-strong shrink-0">{brl(pedido.total)}</span>
            <ChevronDown size={14} className="t-dim shrink-0" />
          </div>
        </div>
      );
    }
    const PgtoIcon = { pix: Smartphone, dinheiro: Banknote, cartao_cred: CreditCard, cartao_deb: CreditCard }[pedido.forma_pagamento] || null;
    const pgtoLabel = { pix: 'PIX', dinheiro: 'Dinheiro', cartao_cred: 'Crédito', cartao_deb: 'Débito' }[pedido.forma_pagamento] || '';

    return (
      <div key={pedido.id} className="rounded-2xl overflow-hidden transition-all duration-200"
        style={{
          background: 'var(--space-elev)',
          border: `2px solid ${eNovo ? '#3b82f6' : cfg.cor + '55'}`,
          boxShadow: eNovo
            ? '0 0 28px rgba(59,130,246,0.22), 0 2px 8px rgba(0,0,0,0.4)'
            : `0 0 12px ${cfg.cor}18, 0 2px 8px rgba(0,0,0,0.35)`,
        }}>

        {/* Barra colorida topo — mais grossa */}
        <div style={{ height: 5, background: `linear-gradient(90deg, ${cfg.cor}, ${cfg.cor}66)` }} />

        {/* Header clicável — número + cliente + tempo */}
        <button onClick={() => abrirModal(pedido)}
          className="w-full text-left active:opacity-60 transition-opacity">
          {/* Faixa de destaque com número + pagamento + tempo */}
          <div className="flex items-center gap-2 px-3 py-2"
            style={{ background: `${cfg.cor}18`, borderBottom: `1px solid ${cfg.cor}33` }}>
            <span className="text-xl font-black leading-none" style={{ color: cfg.cor }}>#{pedido.numero}</span>
            {eNovo && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-md animate-pulse"
                style={{ background: 'rgba(59,130,246,0.25)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.4)' }}>NOVO</span>
            )}
            {pedido.agendado_para && (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1"
                style={{ background: 'rgba(168,85,247,0.18)', color: '#c084fc' }}>
                <Clock size={10} strokeWidth={2} /> {new Date(pedido.agendado_para).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {pedido.forma_pagamento && (
                <span className="text-xs font-bold flex items-center gap-1" style={{ color: `${cfg.cor}cc` }}>
                  {PgtoIcon && <PgtoIcon size={12} strokeWidth={1.75} />} {pgtoLabel}
                </span>
              )}
              <span className="text-xs font-black flex items-center gap-1"
                style={{ color: atraso && atraso.nivel !== 'ok' ? atraso.cor : `${cfg.cor}99` }}>
                {atraso && atraso.nivel !== 'ok' && <AlertTriangle size={11} strokeWidth={2.5} />}
                {new Date(pedido.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          {/* Cliente + endereço */}
          <div className="px-3 pt-2.5 pb-2 flex items-start justify-between gap-2">
            <div>
              <p className="font-black text-base leading-tight" style={{ color: 'var(--txt-strong)' }}>{pedido.cliente_nome}</p>
              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--txt-dim)' }}>
                {pedido.tipo_entrega === 'retirada'
                  ? <><ShoppingBag size={11} strokeWidth={1.75} className="shrink-0" /><span className="font-semibold" style={{ color: '#60a5fa' }}>RETIRADA</span></>
                  : <><MapPin size={11} strokeWidth={1.75} className="shrink-0" /><span className="truncate max-w-[150px]">{pedido.cliente_endereco}</span></>
                }
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {pedido.cliente_total_pedidos > 1 && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
                  <Star size={9} strokeWidth={2} /> {pedido.cliente_total_pedidos}º pedido
                </span>
              )}
              {pedido.cliente_total_pedidos === 1 && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>1º PEDIDO</span>
              )}
            </div>
          </div>
        </button>

        <div className="px-3 pb-3 pt-2.5 space-y-2">

          {/* Observação — destaque máximo */}
          {pedido.observacao && (() => {
            const linhas = pedido.observacao.split('\n');
            const obsNormal = linhas.filter(l => !l.startsWith('📩 WhatsApp:')).join(' ').replace(/\s+/g, ' ').trim();
            const wppMsgs = linhas.filter(l => l.startsWith('📩 WhatsApp:')).map(l => l.replace('📩 WhatsApp:', '').trim()).filter(Boolean);
            const obsTrunc = obsNormal.length > 80 ? obsNormal.slice(0, 80) + '…' : obsNormal;
            const wppRecentes = wppMsgs.slice(-2);
            return (<>
              {obsTrunc && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.35)' }}>
                  <AlertTriangle size={14} strokeWidth={2} className="shrink-0 mt-0.5" style={{ color: '#fbbf24' }} />
                  <p className="text-sm font-semibold leading-snug" style={{ color: '#fbbf24' }}>{obsTrunc}</p>
                </div>
              )}
              {wppRecentes.length > 0 && (
                <div className="px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(37,211,102,0.08)', border: '1px solid rgba(37,211,102,0.2)' }}>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: '#25d366' }}>📩 WhatsApp</p>
                  {wppRecentes.map((m, i) => <p key={i} className="text-xs leading-snug" style={{ color: '#25d366', opacity: 0.85 }}>• {m.length > 70 ? m.slice(0, 70) + '…' : m}</p>)}
                </div>
              )}
            </>);
          })()}

          {/* Itens */}
          <div className="rounded-xl px-2.5 py-2" style={{ background: 'rgba(0,0,0,0.25)' }}>
            <div className="space-y-1.5">
              {(aberto ? pedido.itens : pedido.itens.slice(0, 3)).map(item => (
                <div key={item.id} className="flex items-center gap-2">
                  <span className="text-sm font-black w-6 shrink-0 text-center" style={{ color: cfg.cor }}>{item.quantidade}×</span>
                  <span className="text-sm font-semibold flex-1" style={{ color: 'var(--txt-strong)' }}>{item.item_nome}</span>
                  <span className="text-xs shrink-0" style={{ color: 'var(--txt-dim)' }}>{brl(item.valor_unitario * item.quantidade)}</span>
                </div>
              ))}
              {!aberto && pedido.itens.length > 3 && (
                <button onClick={e => { e.stopPropagation(); setPedidoAberto(pedido); }}
                  className="text-xs font-semibold flex items-center gap-0.5 mt-1" style={{ color: cfg.cor }}>
                  +{pedido.itens.length - 3} mais <ChevronDown size={11} strokeWidth={2} />
                </button>
              )}
            </div>
          </div>

          {/* Total em destaque */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl"
            style={{ background: `${cfg.cor}18`, border: `1px solid ${cfg.cor}33` }}>
            <span className="text-xs font-semibold" style={{ color: cfg.cor }}>Total</span>
            <span className="text-lg font-black" style={{ color: 'var(--txt-strong)' }}>{brl(pedido.total)}</span>
          </div>

          {/* PIX */}
          {pedido.forma_pagamento === 'pix' && !['cancelado'].includes(pedido.status) && (
            pedido.pix_confirmado_em ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <CheckCircle2 size={13} strokeWidth={2} style={{ color: '#34d399' }} />
                <span className="text-[11px] font-bold" style={{ color: '#34d399' }}>
                  PIX confirmado {new Date(pedido.pix_confirmado_em + 'Z').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl animate-pulse"
                style={{ background: 'rgba(245,158,11,0.12)', border: '2px solid rgba(245,158,11,0.5)' }}>
                <span className="text-xs font-black flex items-center gap-1.5" style={{ color: '#fbbf24' }}>
                  <AlertTriangle size={14} strokeWidth={2} /> CONFERIR PIX
                </span>
                <button onClick={() => confirmarPix(pedido)}
                  className="px-3 py-1.5 rounded-lg text-xs font-black shrink-0 transition-all active:scale-95"
                  style={{ background: 'rgba(16,185,129,0.25)', color: '#34d399', border: '1px solid rgba(16,185,129,0.5)' }}>
                  ✓ Caiu
                </button>
              </div>
            )
          )}

          {/* Troco */}
          {pedido.forma_pagamento === 'dinheiro' && pedido.troco_para > pedido.total && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ background: 'rgba(16,185,129,0.1)', border: '1.5px solid rgba(16,185,129,0.35)' }}>
              <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: '#34d399' }}>
                <Banknote size={14} strokeWidth={1.75} /> Troco p/ {brl(pedido.troco_para)}
              </span>
              <span className="font-black text-sm" style={{ color: '#34d399' }}>levar {brl(pedido.troco_para - pedido.total)}</span>
            </div>
          )}

          {/* Ações — botão principal maior */}
          <div className="flex gap-1.5 pt-1">
            {av && (
              <button onClick={() => avancar(pedido)}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-white text-sm transition-all active:scale-95"
                style={{
                  background: eNovo ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : `linear-gradient(135deg,${cfg.cor},${cfg.cor}cc)`,
                  boxShadow: eNovo ? '0 4px 16px rgba(37,99,235,0.5)' : `0 4px 14px ${cfg.cor}55`,
                }}>
                <av.Icon size={16} strokeWidth={2.5} /> {av.label}
              </button>
            )}
            {pedido.cliente_telefone && (
              <button onClick={() => abrirWhatsApp(pedido, pedido.status)}
                className="w-11 h-11 flex items-center justify-center rounded-xl transition-all active:scale-90 shrink-0"
                style={{ background: 'rgba(37,211,102,0.12)', color: '#25d366', border: '1px solid rgba(37,211,102,0.25)' }}
                title="WhatsApp"><MessageCircle size={18} strokeWidth={1.75} /></button>
            )}
            <button onClick={() => reimprimir(pedido)}
              className="w-11 h-11 flex items-center justify-center rounded-xl transition-all active:scale-90 shrink-0 relative"
              style={pedido.impresso
                ? { background: 'var(--space-elev-2)', color: '#555', border: '1px solid var(--hairline)' }
                : { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent)' }}
              title={pedido.impresso ? 'Reimprimir' : 'Imprimir (pendente)'}>
              <Printer size={18} strokeWidth={1.75} />
              {!pedido.impresso && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ background: 'var(--accent)', border: '2px solid var(--space-surface)' }} />}
            </button>
            {pedido.status !== 'cancelado' && pedido.status !== 'entregue' && (
              <button onClick={() => cancelar(pedido)}
                className="w-11 h-11 flex items-center justify-center rounded-xl transition-all active:scale-90 shrink-0"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                title="Cancelar"><X size={18} strokeWidth={1.75} /></button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--space-base)', color: 'var(--txt)' }}
      onClick={e => {
        if (!e.target.closest('.relative')) {
          setMostrarControlesLoja(false);
          setMostrarSom(false);
          setMostrarPrint(false);
        }
        // Inicializa AudioContext na primeira interação
        getAudioCtx();
      }}>
      <Toaster position="top-center" toastOptions={{ style: { fontSize: 14 } }} />

      {/* Modal do jogo */}
      {jogoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}
          onClick={e => { if (e.target === e.currentTarget) setJogoAberto(false); }}>
          <div style={{ background: '#0f0f0f', borderRadius: 24, padding: '20px 16px 16px', width: '100%', maxWidth: 400, border: '1px solid rgba(249,115,22,0.25)', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>🎮 Mini-Jogos</div>
                <div style={{ fontSize: 11, color: '#475569' }}>Modo operador — aproveite a ociosidade!</div>
              </div>
              <button onClick={() => setJogoAberto(false)} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 8, width: 32, height: 32, color: '#64748b', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <GameHub compact />
          </div>
        </div>
      )}

      {/* Modal novo pedido manual */}
      {novoPedidoAberto && (
        <ModalNovoPedido
          onClose={() => setNovoPedidoAberto(false)}
          onCriado={() => carregar(true)}
        />
      )}

      {/* Modal detalhes completo do pedido */}
      {pedidoModal && (() => {
        const p = pedidos.find(x => x.id === pedidoModal.id) || pedidoModal;
        const cfg = STATUS_CFG[p.status] || STATUS_CFG.novo;
        const av = AVANCAR[p.status];
        const { texto: tempoTexto } = tempo(p.created_at);
        const linhas = (p.observacao || '').split('\n');
        const obsNormal = linhas.filter(l => !l.startsWith('📩 WhatsApp:')).join('\n').trim();
        const wppMsgs = linhas.filter(l => l.startsWith('📩 WhatsApp:')).map(l => l.replace('📩 WhatsApp:', '').trim()).filter(Boolean);
        const pgtoLabel = { pix: 'PIX', dinheiro: 'Dinheiro', credito: 'Crédito', debito: 'Débito' }[p.forma_pagamento] || p.forma_pagamento || '—';
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) setPedidoModal(null); }}>
            <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
              style={{ background: 'var(--space-surface)', maxHeight: '92vh', border: '1px solid var(--hairline)' }}>

              {/* Topo colorido */}
              <div style={{ height: 4, background: `linear-gradient(90deg,${cfg.cor},${cfg.cor}44)` }} />

              {/* Header */}
              <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--hairline)' }}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black t-strong">#{p.numero}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `${cfg.cor}22`, color: cfg.cor }}>
                      {cfg.label}
                    </span>
                    {p.agendado_para && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1"
                        style={{ background: 'rgba(168,85,247,0.18)', color: '#c084fc' }}>
                        <Clock size={10} /> {new Date(p.agendado_para).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}
                      </span>
                    )}
                  </div>
                  <p className="text-xs t-dim mt-0.5">{tempoTexto} · {new Date(p.created_at).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</p>
                </div>
                <button onClick={() => setPedidoModal(null)}
                  className="ml-auto w-8 h-8 flex items-center justify-center rounded-xl t-dim"
                  style={{ background: 'var(--space-elev-2)' }}>✕</button>
              </div>

              {/* Corpo scrollável */}
              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">

                {/* Cliente */}
                <div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest t-dim">Cliente</p>
                  <p className="font-black t-strong text-base">{p.cliente_nome}</p>
                  {p.cliente_telefone && (
                    <a href={`tel:${p.cliente_telefone}`} className="flex items-center gap-2 text-sm" style={{ color: '#60a5fa' }}>
                      <Smartphone size={14} /> {p.cliente_telefone}
                    </a>
                  )}
                  <div className="flex items-start gap-2 text-sm t-mut">
                    {p.tipo_entrega === 'retirada'
                      ? <><ShoppingBag size={14} className="shrink-0 mt-0.5" /><span>Retirada no balcão</span></>
                      : <><MapPin size={14} className="shrink-0 mt-0.5" /><span>{p.cliente_endereco}{p.bairro ? ` — ${p.bairro}` : ''}</span></>
                    }
                  </div>
                  {p.cliente_total_pedidos > 1 && (
                    <p className="text-xs font-bold flex items-center gap-1" style={{ color: '#fbbf24' }}>
                      <Star size={12} /> {p.cliente_total_pedidos}º pedido deste cliente
                    </p>
                  )}
                </div>

                {/* Itens */}
                <div className="rounded-2xl p-4" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest t-dim mb-3">Itens do pedido</p>
                  <div className="space-y-2">
                    {p.itens.map((item, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="font-black text-sm shrink-0" style={{ color: cfg.cor }}>{item.quantidade}×</span>
                        <span className="t-strong text-sm flex-1">{item.item_nome}</span>
                        <span className="t-dim text-sm shrink-0">{brl(item.valor_unitario * item.quantidade)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop: '1px solid var(--hairline)' }}>
                    <span className="text-sm t-dim">Total</span>
                    <span className="font-black t-strong text-lg">{brl(p.total)}</span>
                  </div>
                  {p.desconto > 0 && <p className="text-xs mt-1 text-right" style={{ color: '#34d399' }}>Desconto: -{brl(p.desconto)}</p>}
                  {p.frete > 0  && <p className="text-xs mt-0.5 text-right t-dim">Frete: +{brl(p.frete)}</p>}
                </div>

                {/* Pagamento */}
                <div className="rounded-2xl p-4 space-y-2" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  <p className="text-[10px] font-bold uppercase tracking-widest t-dim">Pagamento</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm t-mut">{pgtoLabel}</span>
                    {p.forma_pagamento === 'pix' && (
                      p.pix_confirmado_em
                        ? <span className="text-xs font-bold flex items-center gap-1" style={{ color: '#34d399' }}><CheckCircle2 size={13} /> Confirmado</span>
                        : <button onClick={() => { confirmarPix(p); setPedidoModal(null); }}
                            className="text-xs font-bold px-3 py-1 rounded-lg"
                            style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                            ✓ Caiu no banco
                          </button>
                    )}
                  </div>
                  {p.forma_pagamento === 'dinheiro' && p.troco_para > p.total && (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl"
                      style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
                      <span className="text-sm t-mut">Troco p/ {brl(p.troco_para)}</span>
                      <span className="font-black" style={{ color: '#34d399' }}>Levar {brl(p.troco_para - p.total)}</span>
                    </div>
                  )}
                  {p.cupom_codigo && <p className="text-xs t-dim">Cupom: <span className="font-bold t-strong">{p.cupom_codigo}</span></p>}
                </div>

                {/* Observação */}
                {obsNormal && (
                  <div className="rounded-2xl p-4" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#f59e0b' }}>⚠️ Observação</p>
                    <p className="text-sm leading-relaxed" style={{ color: '#fbbf24', whiteSpace: 'pre-wrap' }}>{obsNormal}</p>
                  </div>
                )}

                {/* Mensagens WhatsApp */}
                {wppMsgs.length > 0 && (
                  <div className="rounded-2xl p-4" style={{ background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.2)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#25d366' }}>📩 WhatsApp ({wppMsgs.length})</p>
                    <div className="space-y-1.5">
                      {wppMsgs.map((m, i) => <p key={i} className="text-sm leading-snug" style={{ color: '#25d366', opacity: 0.9 }}>• {m}</p>)}
                    </div>
                  </div>
                )}

                {/* Histórico do cliente */}
                {historicoCliente.length > 1 && (
                  <div className="rounded-2xl p-4" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest t-dim mb-3">Últimos pedidos</p>
                    <div className="space-y-2">
                      {historicoCliente.filter(h => h.id !== p.id).slice(0, 5).map(h => (
                        <div key={h.id} className="flex items-center gap-2 py-1.5 px-2 rounded-xl"
                          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--hairline)' }}>
                          <span className="text-xs font-black t-dim w-8 shrink-0">#{h.numero}</span>
                          <span className="text-xs t-dim flex-1">
                            {new Date(h.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                          <span className="text-xs font-bold t-strong shrink-0">{brl(h.total)}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md shrink-0"
                            style={{ background: h.status === 'entregue' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)', color: h.status === 'entregue' ? '#34d399' : '#f87171' }}>
                            {h.status === 'entregue' ? '✓' : '✕'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer — ações */}
              {p.status !== 'cancelado' && p.status !== 'entregue' && (
                <div className="px-5 py-4 flex gap-2" style={{ borderTop: '1px solid var(--hairline)' }}>
                  <button onClick={() => cancelar(p)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <X size={17} />
                  </button>
                  {p.cliente_telefone && (
                    <button onClick={() => abrirWhatsApp(p, p.status)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl shrink-0"
                      style={{ background: 'rgba(37,211,102,0.1)', color: '#25d366', border: '1px solid rgba(37,211,102,0.2)' }}>
                      <MessageCircle size={17} />
                    </button>
                  )}
                  {av && (
                    <button onClick={() => { avancar(p); }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-white text-sm transition-all active:scale-95"
                      style={{
                        background: p.status === 'novo' ? 'linear-gradient(135deg,#2563eb,#1d4ed8)' : cfg.cor,
                        boxShadow: `0 4px 16px ${cfg.cor}44`,
                      }}>
                      <av.Icon size={16} strokeWidth={2} /> {av.label}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Banner alerta novos pedidos */}
      <BannerNovoPedido
        pedidos={pedidosNovosAlerta}
        onAceitar={aceitarPedido}
        onIrParaNovos={() => {}}
      />
      {temAlerta && <div style={{ height: pedidosNovosAlerta.length * 64 }} />}

      {/* ── Header ── */}
      <header className="shrink-0 px-4 pt-4 pb-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Logo / título */}
          <div className="mr-2">
            <h1 className="text-xl font-black t-strong leading-none">PDV</h1>
            <p className="text-[10px] t-faint mt-0.5">Ponto de Venda · tempo real</p>
          </div>

          {/* Métricas do dia — customizável */}
          <BarraMetricas metricasHoje={metricasHoje} faturamentoHoje={faturamentoHoje} />

          {/* Busca rápida */}
          <div className="relative flex-1 max-w-[200px]">
            <input
              type="search"
              placeholder="Buscar #nº ou nome…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full text-xs font-semibold rounded-xl px-3 py-1.5 pl-7 outline-none"
              style={{ background: 'var(--space-elev)', color: 'var(--txt)', border: '1px solid var(--hairline)' }}
            />
            <span className="absolute left-2 top-1/2 -translate-y-1/2 t-dim pointer-events-none">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
          </div>

          {/* Spacer */}
          <div className="flex-1 hidden md:block" />

          {/* Controles */}
          <div className="flex items-center gap-2">
            {/* Novo pedido manual */}
            <button onClick={() => setNovoPedidoAberto(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
              style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}
              title="Criar pedido manualmente para um cliente">
              <Plus size={13} strokeWidth={2.5} /> <span className="hidden sm:inline">Novo pedido</span>
            </button>
            {/* Exportar fila (contingência) — imprime a lista ativa por prioridade */}
            <button onClick={exportarFila}
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
              style={{ background: 'var(--space-elev)', color: 'var(--txt-dim)', border: '1px solid var(--hairline)' }}
              title="Imprimir a fila de pedidos ativos (contingência — operar no papel se a tela cair)">
              <Printer size={13} strokeWidth={1.75} /> <span className="hidden sm:inline">Fila</span>
            </button>
            {/* Botão status da loja */}
            <div className="relative">
              <button onClick={() => setMostrarControlesLoja(v => !v)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                style={{
                  background: statusLoja === 'aberto_forcado' ? 'rgba(16,185,129,0.15)' : statusLoja === 'fechado_forcado' ? 'rgba(239,68,68,0.15)' : statusLoja === 'fechamento_temp' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.12)',
                  color: statusLoja === 'aberto_forcado' ? '#10b981' : statusLoja === 'fechado_forcado' ? '#ef4444' : statusLoja === 'fechamento_temp' ? 'var(--accent-2)' : '#818cf8',
                  border: `1px solid ${statusLoja === 'aberto_forcado' ? 'rgba(16,185,129,0.3)' : statusLoja === 'fechado_forcado' ? 'rgba(239,68,68,0.3)' : statusLoja === 'fechamento_temp' ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.25)'}`,
                }}>
                <span className="flex items-center">{statusLoja === 'aberto_forcado' ? <Circle size={11} strokeWidth={3} fill="currentColor" /> : statusLoja === 'fechado_forcado' ? <Circle size={11} strokeWidth={3} fill="currentColor" /> : statusLoja === 'fechamento_temp' ? <Pause size={12} strokeWidth={2} /> : <Clock size={12} strokeWidth={1.75} />}</span>
                <span className="hidden sm:inline">{statusLoja === 'aberto_forcado' ? 'Aberta' : statusLoja === 'fechado_forcado' ? 'Fechada' : statusLoja === 'fechamento_temp' ? `Pausa ${pausaMin}min` : 'Loja'}</span>
                <ChevronDown size={11} strokeWidth={2} />
              </button>

              {/* Dropdown de controles */}
              {mostrarControlesLoja && (
                <div className="fixed sm:absolute left-3 right-3 bottom-3 sm:left-auto sm:right-0 sm:bottom-auto sm:top-full sm:mt-1 z-50 rounded-2xl overflow-hidden shadow-2xl sm:w-[220px]"
                  style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  <div className="px-3 py-2 text-[10px] font-black t-dim uppercase tracking-wider"
                    style={{ borderBottom: '1px solid var(--space-elev-2)' }}>Controle da loja</div>

                  {/* Abrir / Fechar / Auto */}
                  <div className="p-2 space-y-1">
                    <button onClick={() => { lojaAbrirAgora(); setMostrarControlesLoja(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
                      <Circle size={12} strokeWidth={3} fill="currentColor" /> Abrir agora
                    </button>
                    <button onClick={() => { lojaFecharAgora(); setMostrarControlesLoja(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                      <Circle size={12} strokeWidth={3} fill="currentColor" /> Fechar agora
                    </button>
                    <button onClick={() => { lojaAutomatico(); setMostrarControlesLoja(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                      style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}>
                      <Undo2 size={13} strokeWidth={2} /> Automático
                    </button>
                  </div>

                  {/* Pausa rápida */}
                  <div className="px-3 pt-1 pb-2" style={{ borderTop: '1px solid var(--space-elev-2)' }}>
                    <p className="text-[10px] t-dim font-bold mb-1.5 flex items-center gap-1"><Pause size={11} strokeWidth={2} /> PAUSA RÁPIDA</p>
                    <div className="grid grid-cols-4 gap-1">
                      {[15, 30, 60, 120].map(m => (
                        <button key={m} onClick={() => { lojaPausar(m); setMostrarControlesLoja(false); }}
                          className="py-1.5 rounded-lg text-[10px] font-black transition-all"
                          style={{ background: 'rgba(245,158,11,0.1)', color: 'var(--accent-2)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          {m < 60 ? `${m}m` : `${m/60}h`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Configurações de som ── */}
            <div className="relative">
              <button onClick={() => { setMostrarSom(v => !v); setMostrarPrint(false); getAudioCtx(); }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
                title="Configurações de som">
                <Bell size={16} strokeWidth={1.75} />
              </button>
              {mostrarSom && (
                <div className="fixed sm:absolute left-3 right-3 bottom-3 sm:left-auto sm:right-0 sm:bottom-auto sm:top-full sm:mt-1 z-50 rounded-2xl overflow-hidden shadow-2xl sm:w-[230px]"
                  style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  <div className="px-3 py-2 text-[10px] font-black t-dim uppercase tracking-wider border-b border-zinc-800">Som de notificação</div>
                  <div className="p-2 space-y-1">
                    {Object.entries(SONS).map(([key, s]) => (
                      <button key={key}
                        onClick={() => { _somCfg.som = key; salvarSomCfg(); setSomAtual(key); SONS[key].tocar(_somCfg.volume); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                        style={{ background: somAtual === key ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)', color: somAtual === key ? '#818cf8' : '#666', border: `1px solid ${somAtual === key ? 'rgba(99,102,241,0.4)' : 'transparent'}` }}>
                        {somAtual === key ? <Play size={12} strokeWidth={2} fill="currentColor" /> : <Circle size={12} strokeWidth={2} />}{s.label}
                      </button>
                    ))}
                  </div>
                  <div className="px-3 pb-3 border-t border-zinc-800 pt-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] t-dim font-bold">VOLUME</span>
                      <span className="text-[10px] t-dim">{Math.round(volumeAtual * 100)}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value={volumeAtual}
                      onChange={e => { const v = parseFloat(e.target.value); _somCfg.volume = v; salvarSomCfg(); setVolumeAtual(v); }}
                      onMouseUp={() => tocarSom('novo')}
                      className="w-full accent-indigo-500" />
                  </div>
                  {/* Som por coluna */}
                  <div className="px-3 pb-3 border-t border-zinc-800 pt-2">
                    <p className="text-[10px] t-dim font-bold mb-2">SOM POR COLUNA</p>
                    <div className="space-y-1.5">
                      {[
                        { key: 'novo',       label: 'Novo pedido',  cor: '#3b82f6' },
                        { key: 'preparando', label: 'Em preparo',   cor: 'var(--accent-2)' },
                        { key: 'pronto',     label: 'Pronto',       cor: '#10b981' },
                      ].map(({ key, label, cor }) => {
                        const atual = _somCfg.porColuna?.[key] ?? undefined;
                        const opcoes = [['off', '🔕'], ...Object.keys(SONS).map(k => [k, SONS[k].label])];
                        return (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-[10px] font-bold flex-1" style={{ color: cor }}>{label}</span>
                            <select
                              value={atual === undefined ? '' : atual}
                              onChange={e => {
                                const v = e.target.value;
                                if (!_somCfg.porColuna) _somCfg.porColuna = {};
                                if (v === '') { delete _somCfg.porColuna[key]; }
                                else { _somCfg.porColuna[key] = v; if (v !== 'off') SONS[v]?.tocar(_somCfg.volume); }
                                salvarSomCfg(); setSomAtual(s => s); // força re-render
                              }}
                              className="text-[10px] rounded-lg px-1.5 py-1 font-bold"
                              style={{ background: 'var(--space-elev-2)', color: '#999', border: '1px solid var(--hairline)', outline: 'none' }}>
                              <option value="">padrão</option>
                              <option value="off">silenciar</option>
                              {Object.entries(SONS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
                            </select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Configurações de impressão ── */}
            <div className="relative">
              <button onClick={() => { setMostrarPrint(v => !v); setMostrarSom(false); }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold"
                style={{ background: 'rgba(99,102,241,0.1)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' }}
                title="Configurações de impressão">
                <Printer size={16} strokeWidth={1.75} />
              </button>
              {mostrarPrint && (
                <div className="fixed sm:absolute left-3 right-3 bottom-3 sm:left-auto sm:right-0 sm:bottom-auto sm:top-full sm:mt-1 z-50 rounded-2xl overflow-hidden shadow-2xl sm:w-[230px]"
                  style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                  <div className="px-3 py-2 text-[10px] font-black t-dim uppercase tracking-wider border-b border-zinc-800">Modelo de impressão</div>
                  <div className="p-3 space-y-3">

                    {/* Largura do papel */}
                    <div>
                      <p className="text-[10px] t-dim font-bold mb-1.5">LARGURA DO PAPEL</p>
                      <div className="flex gap-1.5">
                        {['58mm','80mm'].map(l => (
                          <button key={l}
                            onClick={() => { _printCfg.largura = l; salvarPrintCfg(); setPrintVer(v=>v+1); }}
                            className="flex-1 py-1.5 rounded-lg text-xs font-black transition-all"
                            style={{ background: _printCfg.largura === l ? 'rgba(99,102,241,0.2)' : 'var(--space-elev-2)', color: _printCfg.largura === l ? '#818cf8' : '#555', border: `1px solid ${_printCfg.largura === l ? 'rgba(99,102,241,0.4)' : 'var(--hairline)'}` }}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Tamanho da fonte */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-[10px] t-dim font-bold">TAMANHO DA FONTE</p>
                        <span className="text-[10px] t-dim">{_printCfg.tamanhoBase}px</span>
                      </div>
                      <div className="flex gap-1.5">
                        {[{l:'P',v:14},{l:'M',v:18},{l:'G',v:22}].map(({l,v}) => (
                          <button key={l}
                            onClick={() => { _printCfg.tamanhoBase = v; salvarPrintCfg(); setPrintVer(pv=>pv+1); }}
                            className="flex-1 py-1.5 rounded-lg text-xs font-black"
                            style={{ background: _printCfg.tamanhoBase === v ? 'rgba(99,102,241,0.2)' : 'var(--space-elev-2)', color: _printCfg.tamanhoBase === v ? '#818cf8' : '#555', border: `1px solid ${_printCfg.tamanhoBase === v ? 'rgba(99,102,241,0.4)' : 'var(--hairline)'}` }}>
                            {l}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Campos exibidos */}
                    <div>
                      <p className="text-[10px] t-dim font-bold mb-1.5">EXIBIR NA COMANDA</p>
                      {[
                        {k:'mostrarEnd', label:'Endereço'},
                        {k:'mostrarTel', label:'Telefone'},
                        {k:'mostrarPgto',label:'Forma de pgto'},
                      ].map(({k,label}) => (
                        <label key={k} className="flex items-center gap-2 py-1 cursor-pointer">
                          <input type="checkbox" checked={_printCfg[k]}
                            onChange={e => { _printCfg[k] = e.target.checked; salvarPrintCfg(); setPrintVer(v=>v+1); }}
                            className="accent-indigo-500 w-3.5 h-3.5" />
                          <span className="text-xs t-mut">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => carregar()}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center"
              style={{ background: 'var(--space-elev)', color: '#555', border: '1px solid var(--space-elev-2)' }}>
              <RefreshCw size={15} strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Kanban ── */}
      <main className="flex-1 overflow-hidden flex flex-col gap-0">
        {/* Mobile tab bar */}
        <div className="md:hidden flex border-b shrink-0" style={{ borderColor: 'var(--hairline)', background: 'var(--space-base)' }}>
          {COLUNAS.map(statusKey => {
            const cfg = STATUS_CFG[statusKey];
            const count = porStatus[statusKey]?.length || 0;
            return (
              <button key={statusKey} onClick={() => setColunaAtiva(statusKey)}
                className="flex-1 flex flex-col items-center py-2 px-1 text-xs font-bold transition-all"
                style={{
                  color: colunaAtiva === statusKey ? cfg.cor : '#444',
                  borderBottom: colunaAtiva === statusKey ? `2px solid ${cfg.cor}` : '2px solid transparent',
                  background: colunaAtiva === statusKey ? `${cfg.cor}10` : 'transparent',
                }}>
                <cfg.Icon size={17} strokeWidth={1.75} />
                <span className="text-[10px] mt-0.5">{cfg.label}</span>
                {count > 0 && <span className="text-[9px] font-black px-1 rounded-full mt-0.5" style={{ background: cfg.cor, color: '#fff' }}>{count}</span>}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center t-faint text-sm gap-2">
            <RefreshCw size={18} strokeWidth={1.75} className="animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="flex-1 flex gap-3 p-2 md:p-4 overflow-x-auto">
            {COLUNAS.map(statusKey => {
              const cfg = STATUS_CFG[statusKey];
              const lista = porStatus[statusKey] || [];
              const isNovo = statusKey === 'novo';

              return (
                <div key={statusKey}
                  className={`flex flex-col rounded-2xl overflow-hidden ${statusKey !== colunaAtiva ? 'hidden md:flex md:shrink-0' : 'flex-1 md:flex-none md:shrink-0'}`}
                  style={{
                    minWidth: 240,
                    background: 'var(--space-surface)',
                    border: `1.5px solid ${isNovo && lista.length > 0 ? 'rgba(59,130,246,0.35)' : 'var(--hairline)'}`,
                    boxShadow: isNovo && lista.length > 0 ? '0 0 20px rgba(59,130,246,0.08)' : 'none',
                  }}>

                  {/* Cabeçalho da coluna */}
                  <div className="px-3 py-3 shrink-0 flex items-center gap-2"
                    style={{ borderBottom: `1px solid ${cfg.cor}22`, background: `${cfg.cor}08` }}>
                    <span className="flex items-center" style={{ color: cfg.cor, animation: isNovo && lista.length > 0 ? 'bellRing 0.5s infinite alternate' : 'none' }}>
                      <cfg.Icon size={17} strokeWidth={1.75} />
                    </span>
                    <span className="font-black text-sm" style={{ color: cfg.cor }}>{cfg.label}</span>
                    <div className="ml-auto w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs text-white"
                      style={{ background: lista.length > 0 ? cfg.cor : 'var(--space-elev-2)' }}>
                      {lista.length}
                    </div>
                  </div>

                  {/* Cards */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-2">
                    {lista.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center opacity-30" style={{ color: cfg.cor }}>
                        <cfg.Icon size={28} strokeWidth={1.5} className="mb-2" />
                        <p className="text-xs t-dim">Nenhum pedido</p>
                      </div>
                    ) : lista.map(p => renderCard(p))}
                  </div>
                </div>
              );
            })}

            {/* Coluna de cancelados — opcional */}
            {!ocultarCancelados && (mostrarCancelados || (porStatus.cancelado?.length > 0)) && (
              <div className="flex flex-col rounded-2xl shrink-0 overflow-hidden"
                style={{ minWidth: 240, background: 'var(--space-surface)', border: '1.5px solid var(--hairline)' }}>
                <div className="px-3 py-3 shrink-0 flex items-center gap-2"
                  style={{ borderBottom: '1px solid rgba(239,68,68,0.1)', background: 'rgba(239,68,68,0.05)' }}>
                  <span className="flex items-center text-red-500"><X size={17} strokeWidth={1.75} /></span>
                  <span className="font-black text-sm text-red-500">Cancelados</span>
                  <div className="ml-auto w-6 h-6 rounded-lg flex items-center justify-center font-black text-xs text-white"
                    style={{ background: (porStatus.cancelado?.length || 0) > 0 ? '#ef4444' : 'var(--space-elev-2)' }}>
                    {porStatus.cancelado?.length || 0}
                  </div>
                  {(porStatus.cancelado?.length || 0) > 0 && (
                    <button onClick={() => { setOcultarCancelados(true); setMostrarCancelados(false); sessionStorage.setItem('pdv_ocultar_cancelados','1'); }}
                      className="text-[10px] font-bold px-2 py-1 rounded-lg ml-1"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}
                      title="Ocultar cancelados">
                      Limpar
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  {(porStatus.cancelado || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 opacity-30 text-red-500">
                      <X size={28} strokeWidth={1.5} className="mb-2" />
                      <p className="text-xs t-dim">Nenhum</p>
                    </div>
                  ) : (porStatus.cancelado || []).map(p => renderCard(p))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <div className="shrink-0 flex items-center justify-between px-4 py-1.5"
        style={{ borderTop: '1px solid var(--space-elev)' }}>
        <span className="text-[10px] t-faint">Tempo real via SSE · {new Date().toLocaleTimeString('pt-BR')}</span>
        <button onClick={() => { setOcultarCancelados(false); sessionStorage.removeItem('pdv_ocultar_cancelados'); setMostrarCancelados(v => !v); }}
          className="text-[10px] font-semibold px-2 py-1 rounded-lg"
          style={{ color: mostrarCancelados ? '#f87171' : '#333', background: 'transparent' }}>
          {mostrarCancelados ? <span className="flex items-center gap-1"><X size={11} strokeWidth={2} /> Ocultar cancelados</span> : `+ Cancelados (${porStatus.cancelado?.length || 0})`}
        </button>
      </div>

      <style>{`
        @keyframes bellRing {
          from { transform: rotate(-20deg); }
          to   { transform: rotate(20deg); }
        }
      `}</style>
    </div>
  );
}
