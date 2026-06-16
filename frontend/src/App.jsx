import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  MessageCircle, Users, UtensilsCrossed, ShoppingCart, LayoutDashboard,
  Megaphone, Percent, Image as ImageIcon, Wallet, TrendingDown, Receipt,
  TrendingUp, FileBarChart, ClipboardList, Beef, FileText, Fish, Upload, Boxes,
  Smartphone, ConciergeBell, Bot, StickyNote, Sun, Moon, Palette, KeyRound,
  LogOut, Menu, ChevronDown, Circle, Calculator, ChefHat, Pin, Plus, Check, ArrowDownUp, PieChart,
} from 'lucide-react';
import { useTheme } from './hooks/useTheme';
import { useBoletoAlert } from './hooks/useBoletoAlert';
import { useAuth, getToken } from './hooks/useAuth';
import { PersonalizacaoProvider } from './hooks/usePersonalizacao';
import Logo from './components/Logo';
import FundoApp from './components/FundoApp';
import { aplicarCorDestaque, cachearCor } from './lib/tema';
// Rotas públicas do cliente + login: carregadas de imediato (bundle inicial
// enxuto, importante pro cardápio abrir rápido no celular).
import Login from './pages/Login';
import Cardapio from './pages/Cardapio';
import AcompanharPedido from './pages/AcompanharPedido';

// Telas internas (admin): carregadas sob demanda (code splitting). Sem isto, o
// cliente que abre /cardapio baixava o app inteiro (~1,9MB: Dashboard, PDV,
// relatórios com jsPDF/html2canvas/xlsx, etc.) só pra ver o menu.
const AlterarSenha     = React.lazy(() => import('./pages/AlterarSenha'));
const Dashboard        = React.lazy(() => import('./pages/Dashboard'));
const Ingredientes     = React.lazy(() => import('./pages/Ingredientes'));
const FichasTecnicas   = React.lazy(() => import('./pages/FichasTecnicas'));
const FaturamentoDiario= React.lazy(() => import('./pages/FaturamentoDiario'));
const Despesas         = React.lazy(() => import('./pages/Despesas'));
const Relatorios       = React.lazy(() => import('./pages/Relatorios'));
const ListaCompras     = React.lazy(() => import('./pages/ListaCompras'));
const Boletos          = React.lazy(() => import('./pages/Boletos'));
const VendasDia        = React.lazy(() => import('./pages/VendasDia'));
const RendimentoSalmao = React.lazy(() => import('./pages/RendimentoSalmao'));
const Insumos          = React.lazy(() => import('./pages/Insumos'));
const PDV              = React.lazy(() => import('./pages/PDV'));
const WhatsAppConfig   = React.lazy(() => import('./pages/WhatsAppConfig'));
const Clientes         = React.lazy(() => import('./pages/Clientes'));
const CardapioAdmin    = React.lazy(() => import('./pages/CardapioAdmin'));
const ImportarCardapio = React.lazy(() => import('./pages/ImportarCardapio'));
const Promocoes        = React.lazy(() => import('./pages/Promocoes'));
const CriativoSocial   = React.lazy(() => import('./pages/CriativoSocial'));
const RelatorioPedidos = React.lazy(() => import('./pages/RelatorioPedidos'));
const Chat             = React.lazy(() => import('./pages/Chat'));
const Campanhas        = React.lazy(() => import('./pages/Campanhas'));
const Personalizacao   = React.lazy(() => import('./pages/Personalizacao'));
const Caixa            = React.lazy(() => import('./pages/Caixa'));
const Producao         = React.lazy(() => import('./pages/Producao'));
const FluxoCaixa       = React.lazy(() => import('./pages/FluxoCaixa'));
const CmvProdutos      = React.lazy(() => import('./pages/CmvProdutos'));
const Setup            = React.lazy(() => import('./pages/Setup'));
const DroneSimulator   = React.lazy(() => import('./pages/Drone'));
import NotasRapidas from './components/NotasRapidas';
import OfflineIndicator from './components/OfflineIndicator';
import ServidorMonitor from './components/ServidorMonitor';
import AssistenteVoz from './components/AssistenteVoz';
import UnidadeSwitcher from './components/UnidadeSwitcher';
import AlertaPedidosGlobal from './components/AlertaPedidosGlobal';

const BASE = import.meta.env.VITE_API_URL || '/api';

const NAV_GRUPOS = [
  {
    grupo: 'Operação',
    cor: 'var(--accent-2)',
    fixo: true,
    itens: [
      { to: '/chat',           icon: MessageCircle,    label: 'Chat & WhatsApp' },
      { to: '/clientes',       icon: Users,            label: 'Clientes'        },
      { to: '/cardapio-admin', icon: UtensilsCrossed,  label: 'Cardápio'        },
      { to: '/producao',       icon: ChefHat,          label: 'Produção'        },
      { to: '/lista-compras',  icon: ShoppingCart,     label: 'Compras'         },
      { to: '/dashboard',      icon: LayoutDashboard,  label: 'Dashboard'       },
    ],
  },
  {
    grupo: 'Marketing',
    cor: '#fb923c',
    itens: [
      { to: '/campanhas',       icon: Megaphone,  label: 'Campanhas' },
      { to: '/promocoes',       icon: Percent,    label: 'Promoções' },
      { to: '/criativo-social', icon: ImageIcon,  label: 'Criativo'  },
    ],
  },
  {
    grupo: 'Financeiro',
    cor: '#34d399',
    itens: [
      { to: '/caixa',             icon: Calculator,    label: 'Caixa'       },
      { to: '/fluxo-caixa',       icon: ArrowDownUp,   label: 'Fluxo de Caixa' },
      { to: '/faturamento',       icon: Wallet,        label: 'Faturamento' },
      { to: '/despesas',          icon: TrendingDown,  label: 'Despesas'    },
      { to: '/boletos',           icon: Receipt,       label: 'Boletos'     },
      { to: '/vendas',            icon: TrendingUp,    label: 'Vendas'      },
      { to: '/relatorios',        icon: FileBarChart,  label: 'Relatórios'  },
      { to: '/cmv-produtos',      icon: PieChart,      label: 'CMV / Margem' },
      { to: '/relatorio-pedidos', icon: ClipboardList, label: 'Rel. Pedidos'},
    ],
  },
  {
    grupo: 'Gestão',
    cor: '#818cf8',
    itens: [
      { to: '/ingredientes',     icon: Beef,       label: 'Ingredientes'    },
      { to: '/fichas',           icon: FileText,   label: 'Fichas Técnicas' },
      { to: '/rendimento',       icon: Fish,       label: 'Rendimento'      },
      { to: '/insumos',          icon: Boxes,      label: 'Insumos'         },
      { to: '/importar-cardapio',icon: Upload,     label: 'Importar'        },
      { to: '/whatsapp',         icon: Smartphone, label: 'Config WhatsApp' },
    ],
  },
  {
    grupo: 'Drone 🚁',
    cor: '#38bdf8',
    itens: [
      { to: '/drone', icon: Bot, label: '🚁 Simulador de Entrega' },
    ],
  },
];

const NAV_ADMIN = NAV_GRUPOS.flatMap(g => g.itens);
const NAV = [{ to: '/pdv', icon: ConciergeBell, label: 'PDV — Pedidos' }, ...NAV_ADMIN];

// ── Acesso rápido ao WhatsApp no topo ─────────────────────────
const WA_STATUS = {
  pronto:        { cor: '#34d399', label: 'Conectado'   },
  conectando:    { cor: '#60a5fa', label: 'Conectando'  },
  aguardando_qr: { cor: '#fbbf24', label: 'Ler QR Code' },
  erro:          { cor: '#f87171', label: 'Erro'        },
  desconectado:  { cor: '#5b6678', label: 'Offline'     },
};

function WhatsAppTopo() {
  const [status, setStatus] = useState('desconectado');
  const navigate = useNavigate();

  useEffect(() => {
    let es;
    fetch(`${BASE}/whatsapp/status`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(d => d?.status && setStatus(d.status)).catch(() => {});
    try {
      es = new EventSource(`${BASE}/whatsapp/sse?token=${encodeURIComponent(getToken())}`);
      es.addEventListener('status', e => { try { setStatus(JSON.parse(e.data).status); } catch {} });
      es.addEventListener('qr', () => setStatus('aguardando_qr'));
      es.addEventListener('pronto', () => setStatus('pronto'));
    } catch {}
    return () => es?.close();
  }, []);

  const info = WA_STATUS[status] || WA_STATUS.desconectado;
  return (
    <button onClick={() => navigate('/chat')}
      className="flex items-center gap-2 h-9 pl-2.5 pr-3 rounded-xl transition-all active:scale-95"
      style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}
      title={`WhatsApp — ${info.label}`}>
      <MessageCircle size={17} strokeWidth={1.75} style={{ color: 'var(--jade)' }} />
      <span className="hidden sm:block text-[12px] font-semibold" style={{ color: 'var(--txt)' }}>WhatsApp</span>
      <span className="relative flex w-1.5 h-1.5">
        {status === 'pronto' && <span className="absolute inline-flex w-full h-full rounded-full animate-ping" style={{ background: info.cor, opacity: 0.5 }} />}
        <span className="relative inline-flex rounded-full w-1.5 h-1.5" style={{ background: info.cor, boxShadow: `0 0 6px ${info.cor}` }} />
      </span>
    </button>
  );
}

// ── Atalhos editáveis no topo ─────────────────────────────────
// O adm fixa as categorias que mais usa (ex.: Insumos chega quase todo dia).
const ATALHOS_PADRAO = ['/insumos'];
function AtalhosTopo() {
  const navigate = useNavigate();
  const [editar, setEditar] = useState(false);
  const [pins, setPins] = useState(() => {
    try { const s = JSON.parse(localStorage.getItem('atalhos_topo') || 'null'); return Array.isArray(s) ? s : ATALHOS_PADRAO; }
    catch { return ATALHOS_PADRAO; }
  });
  const itensPin = pins.map(to => NAV_ADMIN.find(n => n.to === to)).filter(Boolean);
  function toggle(to) {
    setPins(prev => {
      const next = prev.includes(to) ? prev.filter(x => x !== to) : [...prev, to];
      try { localStorage.setItem('atalhos_topo', JSON.stringify(next)); } catch {}
      return next;
    });
  }
  return (
    <div className="flex items-center gap-1.5">
      {itensPin.map(n => (
        <button key={n.to} onClick={() => navigate(n.to)} title={n.label}
          className="flex items-center gap-1.5 h-9 px-2.5 rounded-xl transition-all active:scale-95"
          style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
          <n.icon size={16} strokeWidth={1.85} />
          <span className="hidden md:block text-[12px] font-bold">{n.label}</span>
        </button>
      ))}
      <div className="relative">
        <button onClick={() => setEditar(v => !v)} title="Editar atalhos"
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95"
          style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)', color: 'var(--txt-dim)' }}>
          <Pin size={15} strokeWidth={1.85} />
        </button>
        {editar && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setEditar(false)} />
            <div className="absolute left-0 top-full mt-1.5 z-50 rounded-2xl p-2 w-60 max-h-[70vh] overflow-y-auto shadow-2xl"
              style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline-strong)' }}>
              <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--txt-dim)' }}>Fixar atalhos no topo</div>
              {NAV_ADMIN.map(n => {
                const ativo = pins.includes(n.to);
                return (
                  <button key={n.to} onClick={() => toggle(n.to)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all"
                    style={{ background: ativo ? 'var(--accent-soft)' : 'transparent', color: ativo ? 'var(--accent)' : 'var(--txt)' }}>
                    <n.icon size={16} strokeWidth={1.75} />
                    <span className="text-[13px] font-semibold flex-1">{n.label}</span>
                    {ativo ? <Check size={15} strokeWidth={2.5} /> : <Plus size={15} strokeWidth={2} style={{ color: 'var(--txt-faint)' }} />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NavGroup({ onClose }) {
  const location = useLocation();
  const [abertos, setAbertos] = useState({ Operação: true, Marketing: false, Financeiro: false, Gestão: false });
  const toggle = g => setAbertos(a => ({ ...a, [g]: !a[g] }));

  useEffect(() => {
    NAV_GRUPOS.forEach(({ grupo, fixo, itens }) => {
      if (!fixo && itens.some(n => location.pathname.startsWith(n.to))) {
        setAbertos(a => ({ ...a, [grupo]: true }));
      }
    });
  }, [location.pathname]);

  return (
    <div className="mt-1 space-y-1">
      {NAV_GRUPOS.map(({ grupo, cor, fixo, itens }) => {
        const isGrupoAtivo = itens.some(n => location.pathname.startsWith(n.to));
        const aberto = fixo || abertos[grupo];
        return (
          <div key={grupo}>
            {fixo ? (
              <div className="flex items-center gap-2.5 px-2 pt-3 pb-1.5">
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.18em', color: cor, textTransform: 'uppercase' }}>{grupo}</span>
                <div className="h-px flex-1" style={{ background: `linear-gradient(90deg, ${cor}40, transparent)` }} />
              </div>
            ) : (
              <button onClick={() => toggle(grupo)}
                className="w-full flex items-center gap-2.5 px-2 pt-3 pb-1.5 select-none">
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.18em', color: isGrupoAtivo ? cor : 'var(--txt-faint)', textTransform: 'uppercase' }}>{grupo}</span>
                <div className="h-px flex-1" style={{ background: isGrupoAtivo ? `linear-gradient(90deg, ${cor}40, transparent)` : 'var(--hairline-soft)' }} />
                <ChevronDown size={13} strokeWidth={2} style={{ color: isGrupoAtivo ? cor : 'var(--txt-faint)', transform: aberto ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s' }} />
              </button>
            )}

            {aberto && (
              <div className="space-y-0.5">
                {itens.map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to} onClick={onClose} className="block group">
                    {({ isActive }) => (
                      <div className="flex items-center gap-3 px-2.5 py-2 rounded-xl relative transition-all duration-150"
                        style={{
                          background: isActive ? `linear-gradient(100deg, ${cor}1f, ${cor}08 60%, transparent)` : 'transparent',
                          border: `1px solid ${isActive ? cor + '2e' : 'transparent'}`,
                        }}>
                        {isActive && (
                          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: cor, boxShadow: `0 0 8px ${cor}` }} />
                        )}
                        <span className="w-8 h-8 flex items-center justify-center rounded-lg shrink-0 transition-all"
                          style={{ background: isActive ? `${cor}1a` : 'var(--space-elev)', border: `1px solid ${isActive ? cor + '33' : 'var(--hairline-soft)'}` }}>
                          <Icon size={17} strokeWidth={1.75} style={{ color: isActive ? cor : 'var(--txt-dim)' }} />
                        </span>
                        <span className="leading-none transition-colors"
                          style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--txt-strong)' : 'var(--txt)' }}>
                          {label}
                        </span>
                      </div>
                    )}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Sidebar({ open, onClose }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-20 lg:hidden" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)' }} onClick={onClose} />}
      <aside className={`
        fixed top-0 left-0 h-full w-64 z-30 flex flex-col
        transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `} style={{ background: 'var(--surface-glass)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderRight: '1px solid var(--hairline)' }}>

        {/* Marca */}
        <div className="px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-3">
            <div className="shrink-0 relative">
              <div className="absolute inset-0 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(var(--accent-rgb),0.30) 0%, transparent 70%)', transform: 'scale(1.5)' }} />
              <Logo size={40} />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline">
                <p className="font-bold text-[15px] leading-none tracking-tight" style={{ color: 'var(--txt-strong)' }}>Sushi</p>
                <p className="font-bold text-[15px] leading-none tracking-tight" style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-2))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Contrlol</p>
              </div>
              <p className="text-[9.5px] tracking-[0.2em] font-medium mt-1.5" style={{ color: 'var(--txt-faint)' }}>SISTEMA DE GESTÃO</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          {/* PDV — destaque */}
          <NavLink to="/pdv" onClick={onClose} className="block">
            {({ isActive }) => (
              <div className="relative overflow-hidden rounded-2xl transition-all" style={{
                background: isActive ? 'linear-gradient(135deg, var(--accent) 0%, var(--accent-2) 100%)' : 'linear-gradient(135deg, var(--space-elev) 0%, var(--space-surface) 100%)',
                border: `1px solid ${isActive ? 'transparent' : 'rgba(var(--accent-rgb),0.30)'}`,
                boxShadow: isActive ? '0 6px 24px rgba(var(--accent-rgb),0.40)' : 'none',
              }}>
                {!isActive && <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 25% 50%, rgba(var(--accent-rgb),0.12) 0%, transparent 70%)' }} />}
                <div className="relative flex items-center gap-3 px-3.5 py-3.5 z-10">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(var(--accent-rgb),0.14)', border: `1px solid ${isActive ? 'transparent' : 'rgba(var(--accent-rgb),0.3)'}` }}>
                    <ConciergeBell size={20} strokeWidth={1.75} style={{ color: isActive ? '#fff' : '#fb923c' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: 15, fontWeight: 700, color: isActive ? '#fff' : 'var(--txt-strong)', lineHeight: 1.2 }}>PDV</div>
                    <div style={{ fontSize: 10.5, fontWeight: 500, color: isActive ? 'rgba(255,255,255,0.75)' : 'var(--txt-dim)', marginTop: 2 }}>Pedidos em tempo real</div>
                  </div>
                  <span className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: isActive ? 'rgba(255,255,255,0.85)' : 'var(--accent)', boxShadow: isActive ? '0 0 6px rgba(255,255,255,0.5)' : '0 0 8px var(--accent)' }} />
                </div>
              </div>
            )}
          </NavLink>

          <NavGroup onClose={onClose} />
        </nav>

        {/* Footer */}
        <div className="px-5 py-3.5 shrink-0" style={{ borderTop: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--jade)', boxShadow: '0 0 6px var(--jade)' }} />
            <p className="text-[11px]" style={{ color: 'var(--txt-faint)' }}>v1.0 · Sistema online</p>
          </div>
        </div>
      </aside>
    </>
  );
}

function BottomNav() {
  const NAV_MOBILE = [
    { to: '/insumos',       icon: Boxes,           label: 'Insumos'   },
    { to: '/dashboard',     icon: LayoutDashboard, label: 'Painel'    },
    { to: '/pdv',           icon: ConciergeBell,   label: 'PDV', destaque: true },
    { to: '/despesas',      icon: TrendingDown,    label: 'Despesas'  },
    { to: '/lista-compras', icon: ShoppingCart,    label: 'Compras'   },
  ];
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-10"
      style={{ background: 'var(--surface-glass)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderTop: '1px solid var(--hairline)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, var(--accent), var(--accent-2), transparent)' }} />
      <ul className="flex items-end">
        {NAV_MOBILE.map(({ to, icon: Icon, label, destaque }) => (
          <li key={to} className="flex-1">
            <NavLink to={to}>
              {({ isActive }) => destaque ? (
                <div className="flex flex-col items-center justify-center pb-1 relative" style={{ marginTop: -16 }}>
                  <div className={`w-14 h-14 flex items-center justify-center rounded-2xl mb-1 transition-all ${isActive ? 'scale-105' : ''}`}
                    style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 4px 20px rgba(var(--accent-rgb),0.5)', border: '2px solid rgba(var(--accent-rgb),0.4)' }}>
                    <Icon size={24} strokeWidth={1.75} color="#fff" />
                  </div>
                  <span className="text-[9px] font-bold tracking-wide" style={{ color: isActive ? 'var(--accent)' : 'var(--accent)99' }}>{label}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center pt-2 pb-1.5 px-1 relative">
                  {isActive && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 rounded-b-full" style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }} />}
                  <div className={`w-8 h-8 flex items-center justify-center rounded-lg mb-0.5 transition-all ${isActive ? 'scale-105' : ''}`}
                    style={{ background: isActive ? 'rgba(var(--accent-rgb),0.14)' : 'transparent', border: `1px solid ${isActive ? 'rgba(var(--accent-rgb),0.3)' : 'transparent'}` }}>
                    <Icon size={18} strokeWidth={1.75} style={{ color: isActive ? '#fb923c' : 'var(--txt-dim)' }} />
                  </div>
                  <span className="text-[9px] font-semibold tracking-wide" style={{ color: isActive ? '#fb923c' : 'var(--txt-faint)' }}>{label}</span>
                </div>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function IconBtn({ onClick, title, children, accent }) {
  return (
    <button onClick={onClick} title={title}
      className="w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95"
      style={{ background: 'var(--space-elev)', border: `1px solid ${accent || 'var(--hairline)'}`, color: 'var(--txt)' }}>
      {children}
    </button>
  );
}

function UserMenu({ logout }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)} className="relative w-9 h-9 flex items-center justify-center rounded-xl" title="Menu do usuário">
        <div className="absolute inset-0 rounded-xl pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(var(--accent-rgb),0.3) 0%, transparent 70%)', transform: 'scale(1.5)' }} />
        <Logo size={34} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-52 rounded-xl overflow-hidden shadow-2xl" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline-strong)' }}>
            <button onClick={() => { setOpen(false); navigate('/personalizacao'); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors" style={{ color: 'var(--txt)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--space-elev-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <Palette size={16} strokeWidth={1.75} /> Personalização
            </button>
            <button onClick={() => { setOpen(false); navigate('/alterar-senha'); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors" style={{ color: 'var(--txt)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--space-elev-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <KeyRound size={16} strokeWidth={1.75} /> Alterar senha
            </button>
            <div style={{ height: 1, background: 'var(--hairline)' }} />
            <button onClick={() => { setOpen(false); logout(); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors" style={{ color: '#f87171' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--space-elev-2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <LogOut size={16} strokeWidth={1.75} /> Sair
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function AvisoSenhaPadrao() {
  const [mostrar, setMostrar] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    fetch(`${BASE}/auth/security-status`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.json()).then(d => setMostrar(!!d?.senha_padrao)).catch(() => {});
  }, []);
  if (!mostrar) return null;
  return (
    <div className="px-4 py-2.5 flex items-center gap-3 shrink-0"
      style={{ background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.3)' }}>
      <KeyRound size={16} strokeWidth={2} style={{ color: '#f87171' }} className="shrink-0" />
      <p className="text-xs flex-1" style={{ color: '#fca5a5' }}>
        <b>Segurança:</b> você ainda está usando a senha padrão. Troque antes de usar no dia a dia.
      </p>
      <button onClick={() => navigate('/alterar-senha')}
        className="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0"
        style={{ background: '#ef4444', color: '#fff' }}>
        Trocar senha
      </button>
    </div>
  );
}

function Layout({ logout }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, toggleTheme] = useTheme();
  const navigate = useNavigate();
  const [setupPendente, setSetupPendente] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/setup/status`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && !d.concluido) setSetupPendente(true); })
      .catch(() => {})
      .finally(() => setSetupChecked(true));
  }, []);

  if (!setupChecked) return null; // aguarda verificação silenciosa

  if (setupPendente) return (
    <React.Suspense fallback={null}>
      <Setup onConcluido={() => setSetupPendente(false)} />
    </React.Suspense>
  );

  return (
    <>
      <FundoApp />
      <div className="relative z-10 flex h-screen overflow-hidden" style={{ background: 'transparent' }}>
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Topbar */}
          <header className="px-4 py-2.5 flex items-center gap-2.5 shrink-0"
            style={{ background: 'var(--surface-glass)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', borderBottom: '1px solid var(--hairline)' }}>
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl" style={{ color: 'var(--txt)' }}>
              <Menu size={20} strokeWidth={1.75} />
            </button>

            {/* WhatsApp + atalhos editáveis (acesso rápido, esquerda) */}
            <WhatsAppTopo />
            <AtalhosTopo />

            <div className="ml-auto flex items-center gap-2">
              <UnidadeSwitcher />
              <button onClick={() => window.dispatchEvent(new CustomEvent('assistente:toggle'))}
                className="flex w-9 h-9 items-center justify-center rounded-xl transition-all active:scale-95 shrink-0"
                style={{ background: 'var(--space-elev)', border: '1px solid rgba(129,140,248,0.3)', color: '#a5b4fc' }} title="Assistente de voz">
                <Bot size={18} strokeWidth={1.75} />
              </button>
              <button onClick={() => window.dispatchEvent(new CustomEvent('notas:toggle'))}
                className="flex w-9 h-9 items-center justify-center rounded-xl transition-all active:scale-95 shrink-0"
                style={{ background: 'var(--space-elev)', border: '1px solid rgba(var(--accent-rgb),0.25)', color: '#fb923c' }} title="Bloco de notas">
                <StickyNote size={18} strokeWidth={1.75} />
              </button>
              <IconBtn onClick={() => navigate('/personalizacao')} title="Personalização">
                <Palette size={18} strokeWidth={1.75} />
              </IconBtn>
              <IconBtn onClick={toggleTheme} title={dark ? 'Modo claro' : 'Modo escuro'}>
                {dark ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
              </IconBtn>
              <UserMenu logout={logout} />
            </div>
          </header>

          <div className="h-px w-full shrink-0" style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-2), transparent)', opacity: 0.5 }} />

          <AvisoSenhaPadrao />

          <main className="main-conteudo flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6" style={{ background: 'transparent' }}>
            <React.Suspense fallback={<div className="p-10 text-center text-sm" style={{ color: 'var(--txt-muted, #71717a)' }}>Carregando…</div>}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/ingredientes" element={<Ingredientes />} />
              <Route path="/fichas" element={<FichasTecnicas />} />
              <Route path="/faturamento" element={<FaturamentoDiario />} />
              <Route path="/despesas" element={<Despesas />} />
              <Route path="/relatorios" element={<Relatorios />} />
              <Route path="/lista-compras" element={<ListaCompras />} />
              <Route path="/boletos" element={<Boletos />} />
              <Route path="/vendas" element={<VendasDia />} />
              <Route path="/rendimento" element={<RendimentoSalmao />} />
              <Route path="/insumos" element={<Insumos />} />
              <Route path="/pdv" element={<PDV />} />
              <Route path="/clientes" element={<Clientes />} />
              <Route path="/cardapio-admin" element={<CardapioAdmin />} />
              <Route path="/promocoes" element={<Promocoes />} />
              <Route path="/criativo-social" element={<CriativoSocial />} />
              <Route path="/importar-cardapio" element={<ImportarCardapio />} />
              <Route path="/relatorio-pedidos" element={<RelatorioPedidos />} />
              <Route path="/whatsapp" element={<WhatsAppConfig />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/campanhas" element={<Campanhas />} />
              <Route path="/personalizacao" element={<Personalizacao />} />
              <Route path="/caixa" element={<Caixa />} />
              <Route path="/fluxo-caixa" element={<FluxoCaixa />} />
              <Route path="/cmv-produtos" element={<CmvProdutos />} />
              <Route path="/producao" element={<Producao />} />
              <Route path="/alterar-senha" element={<AlterarSenha />} />
              <Route path="/setup" element={<Setup onConcluido={() => navigate('/dashboard')} />} />
              <Route path="/drone" element={<DroneSimulator />} />
            </Routes>
            </React.Suspense>
          </main>
        </div>

        <BottomNav />
        <NotasRapidas />
        <OfflineIndicator />
        <ServidorMonitor />
        <AssistenteVoz />
        <AlertaPedidosGlobal />
      </div>
    </>
  );
}

export default function App() {
  const { isAuthenticated, login, logout } = useAuth();

  // Cor de destaque da marca (personalizável): busca do banco e aplica no
  // painel. O cache local já aplicou instantâneo no boot (main.jsx).
  useEffect(() => {
    fetch('/api/cardapio/config')
      .then(r => r.json())
      .then(d => { if (d?.cor_destaque) { aplicarCorDestaque(d.cor_destaque); cachearCor(d.cor_destaque); } })
      .catch(() => {});
  }, []);

  return (
    <PersonalizacaoProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/cardapio" element={<Cardapio />} />
          <Route path="/pedido/:id" element={<AcompanharPedido />} />
          <Route path="*" element={!isAuthenticated ? <Login onLogin={login} /> : <Layout logout={logout} />} />
        </Routes>
      </BrowserRouter>
    </PersonalizacaoProvider>
  );
}
