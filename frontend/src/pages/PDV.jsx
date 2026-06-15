import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import GameHub from '../components/GameHub';
import { getToken } from '../hooks/useAuth';
import { getUnidadeId } from '../hooks/useUnidade';
import {
  Bell, ChefHat, CheckCircle2, Bike, X, Check, Smartphone, Banknote,
  CreditCard, MapPin, Star, Gift, AlertTriangle, ChevronDown, MessageCircle,
  Printer, RefreshCw, Circle, Undo2, ConciergeBell, Inbox, Clock, Pause,
  Volume2, Play, ShoppingBag,
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

function tocarSom() {
  SONS[_somCfg.som]?.tocar(_somCfg.volume);
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

// ── Componente principal ──────────────────────────────────────
const hoje = () => new Date().toISOString().slice(0, 10);

export default function PDV() {
  const [pedidos, setPedidos] = useState([]);
  const [resumo, setResumo] = useState({ novo: 0, espera: 0, preparando: 0, pronto: 0, entregue: 0, cancelado: 0 });
  const [loading, setLoading] = useState(true);
  const [pedidoAberto, setPedidoAberto] = useState(null);
  const [pedidoModal, setPedidoModal] = useState(null);
  const [pedidosNovosAlerta, setPedidosNovosAlerta] = useState([]);
  const [mostrarCancelados, setMostrarCancelados] = useState(false);
  const alarmRef = useRef(null);
  const [tick, setTick] = useState(0);
  const [filtroData, setFiltroData] = useState(hoje());

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
    tocarSom();
    alarmRef.current = setInterval(() => { tocarSom(); }, 4500);
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

  const totalAtivos = (resumo.novo || 0) + (resumo.preparando || 0) + (resumo.pronto || 0);
  const temAlerta = pedidosNovosAlerta.length > 0;
  const faturamentoHoje = pedidos.filter(p => p.status !== 'cancelado').reduce((s, p) => s + (p.total || 0), 0);

  // Agrupa pedidos por status para o kanban. Nas colunas ATIVAS, ordena por
  // prioridade: quem está esperando há mais tempo aparece em cima (= o que
  // deve sair primeiro). Resolve o "não sei o que sai primeiro" da Saipos.
  const porStatus = Object.fromEntries(
    [...COLUNAS, 'cancelado'].map(s => {
      let arr = pedidos.filter(p => p.status === s);
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

        {/* Header clicável — número grande + cliente + tempo */}
        <button onClick={() => setPedidoModal(pedido)}
          className="w-full text-left px-3 pt-3 pb-2 active:opacity-60 transition-opacity"
          style={{ borderBottom: `1px solid ${cfg.cor}22` }}>
          <div className="flex items-start justify-between gap-2">
            {/* Número bem grande */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-3xl font-black leading-none" style={{ color: cfg.cor }}>#{pedido.numero}</span>
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
              </div>
              <p className="font-black text-base leading-tight mt-1" style={{ color: 'var(--txt-strong)' }}>{pedido.cliente_nome}</p>
              <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: 'var(--txt-dim)' }}>
                {pedido.tipo_entrega === 'retirada'
                  ? <><ShoppingBag size={11} strokeWidth={1.75} className="shrink-0" /><span className="font-semibold" style={{ color: '#60a5fa' }}>RETIRADA</span></>
                  : <><MapPin size={11} strokeWidth={1.75} className="shrink-0" /><span className="truncate max-w-[150px]">{pedido.cliente_endereco}</span></>
                }
              </p>
            </div>
            {/* Tempo + pagamento */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-sm font-black px-2 py-1 rounded-xl flex items-center gap-1"
                style={{
                  background: atraso && atraso.nivel !== 'ok' ? `${atraso.cor}22` : 'var(--space-elev-2)',
                  color: atraso && atraso.nivel !== 'ok' ? atraso.cor : 'var(--txt-dim)',
                  border: atraso && atraso.nivel !== 'ok' ? `1px solid ${atraso.cor}44` : 'none',
                }}>
                {atraso && atraso.nivel !== 'ok' && <AlertTriangle size={12} strokeWidth={2.5} />}
                {tempoTexto}
              </span>
              {pedido.forma_pagamento && (
                <span className="text-[11px] font-bold flex items-center gap-1" style={{ color: '#818cf8' }}>
                  {PgtoIcon && <PgtoIcon size={12} strokeWidth={1.75} />} {pgtoLabel}
                </span>
              )}
              {pedido.cliente_total_pedidos > 1 && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>
                  <Star size={9} strokeWidth={2} /> {pedido.cliente_total_pedidos}º
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

          {/* Métricas do dia */}
          <div className="flex items-center gap-2">
            {[
              { label: 'Novos',      val: resumo.novo || 0,       cor: '#3b82f6', show: true },
              { label: 'Preparando', val: resumo.preparando || 0, cor: 'var(--accent-2)', show: true },
              { label: 'Prontos',    val: resumo.pronto || 0,     cor: '#10b981', show: true },
              { label: 'Entregues',  val: resumo.entregue || 0,   cor: '#6b7280', show: true },
            ].map(({ label, val, cor }) => (
              <div key={label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                style={{ background: `${cor}12`, border: `1px solid ${cor}30` }}>
                <span className="text-lg font-black leading-none" style={{ color: cor }}>{val}</span>
                <span className="text-[10px] t-dim leading-none hidden sm:block">{label}</span>
              </div>
            ))}
            {faturamentoHoje > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                style={{ background: 'rgba(var(--accent-rgb),0.08)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
                <span className="text-xs font-black text-orange-400">{brl(faturamentoHoje)}</span>
                <span className="text-[10px] t-dim hidden sm:block">hoje</span>
              </div>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Controles */}
          <div className="flex items-center gap-2">
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
                <div className="fixed sm:absolute left-3 right-3 bottom-3 sm:left-auto sm:right-0 sm:bottom-auto sm:top-full sm:mt-1 z-50 rounded-2xl overflow-hidden shadow-2xl sm:w-[210px]"
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
                      onMouseUp={() => tocarSom()}
                      className="w-full accent-indigo-500" />
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
            {(mostrarCancelados || (porStatus.cancelado?.length > 0)) && (
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
                    <button onClick={() => setMostrarCancelados(false)}
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
        <button onClick={() => setMostrarCancelados(v => !v)}
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
