import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getToken } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

// ── Voz ──────────────────────────────────────────────────────
function falar(texto) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'pt-BR'; u.rate = 1.05; u.pitch = 1;
  const vozes = window.speechSynthesis.getVoices();
  u.voice = vozes.find(v => v.lang === 'pt-BR') || vozes.find(v => v.lang.startsWith('pt')) || null;
  window.speechSynthesis.speak(u);
}

// ── Normalização ─────────────────────────────────────────────
function norm(t = '') {
  return t.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// ── Extrai o ITEM da frase, removendo verbos e preposições ───
// Ex: "adicione cebolinha na lista" → "cebolinha"
// Ex: "coloca 2 tomates na lista de compras" → "tomates"
function extrairItem(frase) {
  const n = norm(frase);

  // Padrões: verbo + [quantidade] + ITEM + [complemento de lista]
  const padroes = [
    // "adicione/coloca/bota X na lista (de compras)"
    /(?:adicione?|adiciona|coloca?|bota?|inclui|inserir?|insere?|comprar?|compra|anota?|anotar?)\s+(?:\d+\s+)?(.+?)(?:\s+(?:na|na a|a|em|no|para a?)\s+lista(?:\s+de\s+compras?)?)?$/,
    // "lista: X" ou "lista de compras: X"
    /lista(?:\s+de\s+compras?)?\s*[:]\s*(.+)/,
    // fallback: tudo depois do primeiro verbo de ação
    /(?:adicione?|adiciona|coloca?|bota?|compra)\s+(.+)/,
  ];

  for (const regex of padroes) {
    const m = n.match(regex);
    if (m && m[1]) {
      // Remove sufixos de lista que possam ter sobrado
      let item = m[1]
        .replace(/\b(na|no|a|em|para|à|ao)\b\s*(lista|compras?|mercado).*$/i, '')
        .replace(/\b(lista|compras?)\b.*/i, '')
        .trim();
      if (item.length >= 2) return item;
    }
  }
  return null;
}

// ── Detecta intenção principal ───────────────────────────────
function detectarIntencao(n) {
  // Lista de compras — padrões amplos
  if (/\b(adicione?|adiciona|coloca?|bota?|inclui|insere?|comprar?|compra|anotar?|anota?)\b/.test(n) &&
      /\b(lista|compras?|mercado|feira)\b/.test(n)) return 'lista_add';

  // Apenas verbo de ação sem mencionar lista — mas contexto de item de mercado
  if (/\b(adicione?|adiciona)\b/.test(n) && !/\b(pdv|despesa|boleto|faturamento)\b/.test(n)) return 'lista_add';

  // Navegação
  if (/\b(abrir?|abre|ir|mostrar?|mostra|ver|veja)\b/.test(n)) {
    if (/\bdashboard\b/.test(n)) return 'nav_dashboard';
    if (/\bpdv\b|\bpedidos?\b/.test(n)) return 'nav_pdv';
    if (/\bdespesas?\b/.test(n)) return 'nav_despesas';
    if (/\blista\b/.test(n)) return 'nav_lista';
    if (/\bfaturamento\b/.test(n)) return 'nav_faturamento';
    if (/\bboletos?\b/.test(n)) return 'nav_boletos';
    if (/\brelatorio\b/.test(n)) return 'nav_relatorios';
    if (/\bwhatsapp\b/.test(n)) return 'nav_whatsapp';
    if (/\bingredientes?\b/.test(n)) return 'nav_ingredientes';
  }

  // Consultas
  if (/\bquantos?\b.*\bpedidos?\b|\bpedidos?.*\bhoje\b|\bresumo.*pedidos?\b/.test(n)) return 'info_pedidos';
  if (/\bfaturamento\b|\bquanto\b.*\bfaturei\b|\bvendas?\b.*\bmes\b/.test(n)) return 'info_faturamento';
  if (/\bboletos?\b.*\bvencendo\b|\bvencer\b|\bboletos?\b.*\bprazo\b/.test(n)) return 'info_boletos';

  // Saudação
  if (/\b(ola|oi|ola|bom\s*dia|boa\s*tarde|boa\s*noite|tudo\s*bem|e\s*ai)\b/.test(n)) return 'saudacao';

  // Ajuda
  if (/\b(ajuda|help|comandos|o\s*que\s*(voce|vc)\s*(faz|pode|sabe))\b/.test(n)) return 'ajuda';

  return null;
}

// ── Engine de comandos ───────────────────────────────────────
async function processarComando(textoOriginal, navigate, setHistorico) {
  const n = norm(textoOriginal);
  const intencao = detectarIntencao(n);

  const log = (resposta, ok = true) => {
    setHistorico(h => [{
      texto: textoOriginal,
      resposta,
      ok,
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }, ...h].slice(0, 30));
    falar(resposta);
  };

  // ── Lista de compras ─────────────────────────────────────
  if (intencao === 'lista_add') {
    const item = extrairItem(n);
    if (!item) return log('Não entendi qual item adicionar. Tente: "Adicione cebolinha na lista".');

    // Capitaliza primeira letra
    const nomeFormatado = item.charAt(0).toUpperCase() + item.slice(1);

    try {
      const res = await fetch(`${BASE}/lista-compras`, {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify({ nome: nomeFormatado, quantidade: '1', unidade: 'un', categoria: 'Outros' }),
      });
      if (res.ok) return log(`${nomeFormatado} adicionado na lista de compras!`);
      return log('Não consegui adicionar. Tente novamente.', false);
    } catch { return log('Erro ao acessar a lista de compras.', false); }
  }

  // ── Navegação ────────────────────────────────────────────
  const rotas = {
    nav_dashboard:    ['/dashboard',    'Abrindo o dashboard.'],
    nav_pdv:          ['/pdv',          'Abrindo o PDV.'],
    nav_despesas:     ['/despesas',     'Abrindo as despesas.'],
    nav_lista:        ['/lista-compras','Abrindo a lista de compras.'],
    nav_faturamento:  ['/faturamento',  'Abrindo o faturamento.'],
    nav_boletos:      ['/boletos',      'Abrindo os boletos.'],
    nav_relatorios:   ['/relatorios',   'Abrindo os relatórios.'],
    nav_whatsapp:     ['/whatsapp',     'Abrindo o WhatsApp.'],
    nav_ingredientes: ['/ingredientes', 'Abrindo os ingredientes.'],
  };
  if (rotas[intencao]) {
    const [rota, msg] = rotas[intencao];
    navigate(rota);
    return log(msg);
  }

  // ── Pedidos ──────────────────────────────────────────────
  if (intencao === 'info_pedidos') {
    try {
      const res = await fetch(`${BASE}/pdv/resumo`, { headers: authH() });
      const d = await res.json();
      const ativos = (d.novo || 0) + (d.preparando || 0) + (d.pronto || 0);
      if (ativos === 0) return log('Não há pedidos ativos no momento.');
      return log(`Você tem ${ativos} pedido${ativos > 1 ? 's' : ''} ativo${ativos > 1 ? 's' : ''}: ${d.novo || 0} novo${d.novo !== 1 ? 's' : ''}, ${d.preparando || 0} em preparo e ${d.pronto || 0} pronto${d.pronto !== 1 ? 's' : ''}.`);
    } catch { return log('Não consegui buscar os pedidos.', false); }
  }

  // ── Faturamento ──────────────────────────────────────────
  if (intencao === 'info_faturamento') {
    try {
      const mes = new Date().toISOString().slice(0, 7);
      const res = await fetch(`${BASE}/faturamento?mes=${mes}`, { headers: authH() });
      const d = await res.json();
      if (Array.isArray(d) && d.length > 0) {
        const total = d.reduce((s, r) => s + (r.total || 0), 0);
        return log(`O faturamento deste mês é de ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`);
      }
      return log('Ainda não há registros de faturamento este mês.');
    } catch { return log('Não consegui buscar o faturamento.', false); }
  }

  // ── Boletos ──────────────────────────────────────────────
  if (intencao === 'info_boletos') {
    try {
      const res = await fetch(`${BASE}/boletos`, { headers: authH() });
      const d = await res.json();
      const pendentes = (d || []).filter(b => b.status === 'pendente');
      if (pendentes.length === 0) return log('Nenhum boleto pendente no momento.');
      return log(`Você tem ${pendentes.length} boleto${pendentes.length > 1 ? 's' : ''} pendente${pendentes.length > 1 ? 's' : ''}.`);
    } catch { return log('Não consegui buscar os boletos.', false); }
  }

  // ── Saudação ─────────────────────────────────────────────
  if (intencao === 'saudacao') {
    const h = new Date().getHours();
    const s = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    return log(`${s}! Estou pronto para ajudar. O que você precisa?`);
  }

  // ── Ajuda ────────────────────────────────────────────────
  if (intencao === 'ajuda') {
    return log('Posso adicionar itens na lista de compras, abrir qualquer página do sistema, informar pedidos do dia, faturamento do mês e boletos pendentes.');
  }

  // ── Não entendeu ─────────────────────────────────────────
  return log(`Não entendi o comando. Tente: "Adicione salmão na lista", "Abrir PDV" ou "Quantos pedidos hoje?".`, false);
}

// ── Componente ───────────────────────────────────────────────
export default function AssistenteVoz() {
  const [aberto, setAberto] = useState(false);
  const [escutando, setEscutando] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [historico, setHistorico] = useState([]);
  const [processando, setProcessando] = useState(false);
  const [suportado] = useState(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const reconRef = useRef(null);
  const navigate = useNavigate();

  const parar = useCallback(() => {
    reconRef.current?.stop();
    setEscutando(false);
  }, []);

  const iniciarEscuta = useCallback(() => {
    if (!suportado || escutando || processando) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    reconRef.current = rec;
    rec.lang = 'pt-BR';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;

    rec.onstart = () => setEscutando(true);
    rec.onend = () => setEscutando(false);

    rec.onresult = async (e) => {
      // Usa a alternativa mais confiável
      const final = Array.from(e.results).filter(r => r.isFinal);
      const interims = Array.from(e.results).filter(r => !r.isFinal);
      const texto = (final.length > 0 ? final : interims).map(r => r[0].transcript).join(' ').trim();
      setTranscript(texto);

      if (e.results[e.results.length - 1].isFinal && texto) {
        setProcessando(true);
        await processarComando(texto, navigate, setHistorico);
        setTranscript('');
        setProcessando(false);
      }
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech') toast.error(`Microfone: ${e.error}`);
      setEscutando(false);
    };

    rec.start();
  }, [suportado, escutando, processando, navigate]);

  useEffect(() => {
    const fnKey = (e) => { if (e.key === 'Escape') { parar(); setAberto(false); } };
    const fnToggle = () => setAberto(v => !v);
    window.addEventListener('keydown', fnKey);
    window.addEventListener('assistente:toggle', fnToggle);
    return () => {
      window.removeEventListener('keydown', fnKey);
      window.removeEventListener('assistente:toggle', fnToggle);
    };
  }, [parar]);

  if (!suportado) return null;

  return (
    <>
      {aberto && (
        <div className="fixed top-16 left-4 lg:left-72 z-40 w-80 flex flex-col rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: '#0c0c0c', border: '1px solid #1a1a1a', maxHeight: 'calc(100vh - 80px)' }}>

          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between shrink-0"
            style={{ background: 'linear-gradient(135deg, #1a0e2e, #110a20)', borderBottom: '1px solid #1e1e1e' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
                style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}>
                🤖
              </div>
              <div>
                <p className="text-sm font-black text-white leading-none">Assistente</p>
                <p className="text-[10px] text-purple-400 mt-0.5 leading-none">Reconhecimento de voz · PT-BR</p>
              </div>
            </div>
            <button onClick={() => { parar(); setAberto(false); }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-400 transition-colors"
              style={{ background: '#1a1a1a' }}>✕</button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">

            {/* Botão principal */}
            <button onClick={escutando ? parar : iniciarEscuta} disabled={processando}
              className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-white transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: escutando
                  ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                  : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                boxShadow: escutando
                  ? '0 4px 24px rgba(239,68,68,0.35)'
                  : '0 4px 24px rgba(124,58,237,0.35)',
              }}>
              {processando ? (
                <>
                  <span className="animate-spin text-lg">⟳</span>
                  <span className="text-sm">Processando...</span>
                </>
              ) : escutando ? (
                <>
                  <span className="text-lg">⏹</span>
                  <span className="text-sm">Parar de ouvir</span>
                  <span className="flex gap-0.5 ml-1">
                    {[1,2,3,4].map(i => (
                      <span key={i} className="w-0.5 rounded-full bg-white/70"
                        style={{ height: `${6 + i * 3}px`, animation: `eq 0.7s ${i*0.12}s infinite alternate` }} />
                    ))}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-lg">🎙️</span>
                  <span className="text-sm">Toque para falar</span>
                </>
              )}
            </button>

            {/* Transcrição ao vivo */}
            {(escutando || transcript) && (
              <div className="px-3 py-2.5 rounded-xl" style={{ background: '#141414', border: '1px solid #222' }}>
                <p className="text-[10px] text-zinc-600 mb-1 font-bold tracking-widest">OUVINDO</p>
                <p className="text-sm text-zinc-300 italic leading-snug">
                  {transcript || <span className="text-zinc-700">Aguardando sua voz...</span>}
                </p>
              </div>
            )}

            {/* Histórico */}
            {historico.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-bold tracking-widest text-zinc-700">HISTÓRICO</p>
                {historico.map((h, i) => (
                  <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
                    {/* Fala do usuário */}
                    <div className="px-3 py-2 flex items-start gap-2" style={{ background: '#111' }}>
                      <span className="text-xs shrink-0 mt-0.5">🎙️</span>
                      <p className="text-xs text-zinc-500 italic flex-1">"{h.texto}"</p>
                      <span className="text-[10px] text-zinc-700 shrink-0">{h.hora}</span>
                    </div>
                    {/* Resposta */}
                    <div className="px-3 py-2 flex items-start gap-2" style={{ background: '#0e0e0e' }}>
                      <span className="text-xs shrink-0 mt-0.5">🤖</span>
                      <p className="text-xs flex-1" style={{ color: h.ok === false ? '#f87171' : '#a78bfa' }}>
                        {h.resposta}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Dicas (só quando histórico vazio) */}
            {historico.length === 0 && !escutando && (
              <div>
                <p className="text-[10px] font-bold tracking-widest text-zinc-700 mb-2">EXEMPLOS</p>
                <div className="space-y-1.5">
                  {[
                    { cmd: '"Adicione cebolinha na lista"',  acao: '→ Lista de compras' },
                    { cmd: '"Coloca salmão na lista"',       acao: '→ Lista de compras' },
                    { cmd: '"Quantos pedidos hoje?"',        acao: '→ Resumo PDV'       },
                    { cmd: '"Abre o dashboard"',             acao: '→ Navegação'        },
                    { cmd: '"Faturamento do mês"',           acao: '→ Consulta'         },
                    { cmd: '"Boletos pendentes"',            acao: '→ Consulta'         },
                  ].map(({ cmd, acao }) => (
                    <div key={cmd} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl"
                      style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                      <span className="text-xs text-zinc-400">{cmd}</span>
                      <span className="text-[10px] text-purple-600 shrink-0">{acao}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes eq {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.4); }
        }
      `}</style>
    </>
  );
}
