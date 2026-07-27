# Dashboard Unificado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir as 12 páginas fragmentadas de "visão do negócio" por uma
única página `/dashboard` com 5 abas de análise profissional (Visão Geral,
Financeiro, Produtos, Despesas, Operação).

**Architecture:** Uma casca (`Dashboard.jsx`) com navegação por abas; cada
aba é um componente próprio que busca seus próprios dados via React Query.
Componentes visuais reaproveitados (Card, KpiCard, tooltip) ficam em
`dashboard/_shared.jsx`. A maior parte dos dados já existe em endpoints do
backend — só faltam 2 endpoints novos (análise de despesas, mapa de horário
de pico).

**Tech Stack:** React 18, Recharts (já é dependência do frontend — sem lib
nova), TanStack Query, Express, `node:sqlite`.

## Global Constraints

- **Sem framework de testes automatizados** neste projeto (confirmado: sem
  jest/vitest/mocha, sem `npm test`). Verificação é manual: `curl` com JWT
  autoassinado pro backend, navegador (Browser pane) pro frontend. Isso é a
  convenção estabelecida do projeto, não uma lacuna.
- **`frontend/src/App.jsx` tem bastante WIP não relacionado e não commitado**
  de outras sessões (dashboards antigos, Movimentações, etc.). Qualquer
  tarefa que edite `App.jsx` deve isolar SÓ sua própria mudança usando a
  técnica de "git-surgery": `git show HEAD:frontend/src/App.jsx > base_limpo`
  → aplicar só a mudança pretendida nesse arquivo limpo → `git hash-object -w`
  → `git update-index --cacheinfo 100644 <blob> frontend/src/App.jsx` →
  commit. Isso deixa o commit só com a mudança da tarefa, sem tocar no
  working tree (que continua com o resto do WIP intacto pra quem for
  terminar depois). Task 8 detalha o passo a passo exato.
- **Reconciliação de faturamento:** qualquer métrica de dinheiro ou
  contagem de pedidos que deveria refletir faturamento importado de outro
  PDV usa `faturamentoDia.porDia()` / `.somar()` (`backend/src/lib/faturamentoDia.js`)
  — nunca soma `pdv_pedidos` puro pra esse tipo de métrica.
- **Métricas por item** (CMV, Top Produtos, horário de pico) só refletem
  pedidos reais do PDV/cardápio — a planilha importada não traz item vendido.
  Sempre visível na UI como aviso curto, nunca escondido ou apresentado como
  completo.
- **"Hoje" não mostra variação percentual** — comparar um dia em andamento
  com um dia inteiro anterior sempre parece queda. Mostra aviso amigável
  quando não há dado ainda, não seta vermelha (já corrigido na Visão Geral
  nesta sessão; as outras abas que usam período "hoje" seguem a mesma regra).
- **`Movimentações` (Extrato Banco) NÃO é uma das páginas fragmentadas de
  dashboard** — é a tela de conciliação de extrato bancário (import + vínculo
  de despesa), uma ferramenta operacional distinta. Fica no menu, não é
  tocada por este plano.
- **Paleta e tokens CSS existentes**: `var(--accent)`, `var(--accent-2)`,
  `var(--space-elev)`, `var(--space-elev-2)`, `var(--hairline)`,
  `var(--hairline-strong)`, `var(--txt-strong)`, `var(--txt)`, `var(--txt-dim)`,
  `var(--txt-faint)` — usar os já existentes, não inventar cor nova solta.
- **Formatação BRL**: `Number(v||0).toLocaleString('pt-BR', {style:'currency',currency:'BRL'})`.
- **Ícones**: `lucide-react`, `strokeWidth={1.75}` (convenção do design system).

---

## Task 1: Backend — endpoint de análise de despesas

**Files:**
- Modify: `backend/src/routes/relatorios.js` (adicionar rota antes de `module.exports = router;`, hoje na última linha do arquivo)

**Interfaces:**
- Produces: `GET /api/relatorios/despesas-analise?mes=YYYY-MM` →
  ```json
  {
    "mes": "2026-07",
    "por_categoria": [{ "categoria": "fixo", "total": 1200.5 }],
    "por_tipo": [{ "tipo": "Fornecedor", "total": 2000 }],
    "evolucao": [{ "mes": "2025-08", "fixas": 1000, "variaveis": 2000, "total": 3000 }, "...(12 meses, mais antigo primeiro)"]
  }
  ```

- [ ] **Step 1: Adicionar a rota**

Abra `backend/src/routes/relatorios.js` e adicione, imediatamente antes da
linha `module.exports = router;` (final do arquivo):

```js
// ── GET /api/relatorios/despesas-analise?mes=YYYY-MM ──────────
// Breakdown do mês por categoria/tipo + evolução dos últimos 12 meses.
// Usado pela aba Despesas do Dashboard unificado.
router.get('/despesas-analise', (req, res) => {
  try {
    const mes = getMes(req.query.mes);
    const porCategoria = db.prepare(`
      SELECT categoria, COALESCE(SUM(valor),0) as total
      FROM despesas WHERE substr(data_competencia,1,7) = ?
      GROUP BY categoria ORDER BY total DESC
    `).all(mes);
    const porTipo = db.prepare(`
      SELECT COALESCE(NULLIF(tipo,''), 'Sem tipo') as tipo, COALESCE(SUM(valor),0) as total
      FROM despesas WHERE substr(data_competencia,1,7) = ?
      GROUP BY tipo ORDER BY total DESC
    `).all(mes);

    const [anoAtual, mesAtualNum] = mes.split('-').map(Number);
    const evolucao = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(anoAtual, mesAtualNum - 1 - i, 1);
      const mesRef = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const row = db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN categoria='fixo' THEN valor ELSE 0 END),0) as fixas,
               COALESCE(SUM(CASE WHEN categoria!='fixo' THEN valor ELSE 0 END),0) as variaveis,
               COALESCE(SUM(valor),0) as total
        FROM despesas WHERE substr(data_competencia,1,7) = ?
      `).get(mesRef);
      evolucao.push({ mes: mesRef, fixas: row.fixas, variaveis: row.variaveis, total: row.total });
    }

    res.json({ mes, por_categoria: porCategoria, por_tipo: porTipo, evolucao });
  } catch (e) { console.error('despesas-analise:', e); res.status(500).json({ erro: e.message }); }
});
```

`getMes` já está definido no topo do arquivo (linha ~6) — não precisa
redefinir.

- [ ] **Step 2: Verificar manualmente**

Com o backend rodando (`cd backend && npm run dev`, porta 3001), gere um
token e chame a rota:

```bash
node -e "
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'backend/.env' });
console.log(jwt.sign({id:1,usuario:'admin'}, process.env.JWT_SECRET, {expiresIn:'10m'}));
"
```

```bash
curl -s "http://localhost:3001/api/relatorios/despesas-analise?mes=2026-06" -H "Authorization: Bearer <TOKEN>"
```

Esperado: JSON com `mes`, `por_categoria` (array), `por_tipo` (array),
`evolucao` (array de 12 meses, `2025-07` até `2026-06`, cada um com
`fixas`/`variaveis`/`total`). Confira que os totais de `por_categoria` batem
com a soma de `despesas` daquele mês (pode conferir com
`sqlite3 backend/data/sushi.db "SELECT SUM(valor) FROM despesas WHERE substr(data_competencia,1,7)='2026-06'"`
ou o script Node equivalente com `node:sqlite`).

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/relatorios.js
git commit -m "feat: endpoint de análise de despesas (breakdown + evolução 12 meses)"
```

---

## Task 2: Backend — endpoint de horário de pico semanal

**Files:**
- Modify: `backend/src/routes/relatorios.js` (adicionar rota, mesmo local do Task 1 — antes de `module.exports`)

**Interfaces:**
- Produces: `GET /api/relatorios/pico-semanal?dias=90` →
  ```json
  { "dias": 90, "mapa": [{ "dow": 0, "hora": 18, "pedidos": 12 }] }
  ```
  `dow`: 0=domingo … 6=sábado (mesma convenção de `Date.getDay()` no
  JavaScript). `hora`: 0-23. Só entram combinações com pelo menos 1 pedido —
  o consumidor preenche as células vazias com 0.

- [ ] **Step 1: Adicionar a rota**

Adicione, no mesmo ponto do arquivo (antes de `module.exports = router;`,
pode ser logo após a rota criada no Task 1):

```js
// ── GET /api/relatorios/pico-semanal?dias=90 ───────────────────
// Pedidos por dia da semana × hora — mapa de calor de horário de pico.
// Só pedidos reais do PDV (faturamento importado não tem timestamp).
router.get('/pico-semanal', (req, res) => {
  try {
    const dias = Math.min(Math.max(parseInt(req.query.dias) || 90, 1), 365);
    const mapa = db.prepare(`
      SELECT CAST(strftime('%w', created_at, '-3 hours') AS INTEGER) as dow,
             CAST(strftime('%H', created_at, '-3 hours') AS INTEGER) as hora,
             COUNT(*) as pedidos
      FROM pdv_pedidos
      WHERE created_at >= datetime('now', '-' || ? || ' days') AND status != 'cancelado'
      GROUP BY dow, hora
      ORDER BY dow, hora
    `).all(dias);
    res.json({ dias, mapa });
  } catch (e) { console.error('pico-semanal:', e); res.status(500).json({ erro: e.message }); }
});
```

- [ ] **Step 2: Verificar manualmente**

```bash
curl -s "http://localhost:3001/api/relatorios/pico-semanal?dias=90" -H "Authorization: Bearer <TOKEN>"
```

Esperado: `{ "dias": 90, "mapa": [...] }`, cada item com `dow` entre 0-6 e
`hora` entre 0-23. Se o banco local não tiver pedidos recentes (comum em
dev), `mapa` pode vir vazio — nesse caso confirme que a query não dá erro
(retorna `{ "dias": 90, "mapa": [] }`), não que os números batam.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/relatorios.js
git commit -m "feat: endpoint de horário de pico semanal (dia da semana × hora)"
```

---

## Task 3: Frontend — casca do Dashboard + componentes compartilhados + aba Visão Geral

Esta tarefa cria a nova página `/dashboard` funcional com 1 aba (Visão
Geral). As próximas 4 tarefas adicionam as demais abas por cima, sem mexer
nesta.

**Files:**
- Create: `frontend/src/pages/dashboard/_shared.jsx`
- Create: `frontend/src/pages/dashboard/VisaoGeral.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx` (substitui o conteúdo atual — é a tela antiga e simples que este projeto está substituindo)

**Interfaces:**
- Produces (`_shared.jsx`, consumido por todas as abas das próximas tarefas):
  - `brl(v)`, `brlK(v)` — formatação de moeda
  - `<Card className? style?>` — container base
  - `<CardHeader title icon? cor? action?>`
  - `<KpiCard label value sub? cor? icon? trend?>` — `trend` em pontos
    percentuais (`number|null`); `null` não mostra a seta
  - `<ChartTooltip active payload label series>` — `series`:
    `[{ key, label, cor, fmt? }]`, usado com `<Tooltip content={<ChartTooltip series={...} />} />` do Recharts
  - `CORES` — objeto com cores nomeadas (`azul`, `verde`, `roxo`, `vermelho`, `cinza`)
- Produces (`Dashboard.jsx`):
  - Estado de aba ativa (`ABAS` array, cada `{ id, label, icon, componente }`) —
    as Tasks 4-7 adicionam suas próprias entradas nesse array (só essa
    linha muda; o resto do shell não muda)

- [ ] **Step 1: Criar `frontend/src/pages/dashboard/_shared.jsx`**

```jsx
import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const brlK = v => Math.abs(v || 0) >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : brl(v);

export const CORES = { azul: '#60a5fa', verde: '#34d399', roxo: '#a78bfa', vermelho: '#ef4444', cinza: '#5b6678' };

export function Card({ children, className = '', style = {} }) {
  return (
    <div className={`rounded-2xl overflow-hidden relative ${className}`}
      style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)', ...style }}>
      {children}
    </div>
  );
}

export function CardHeader({ title, icon: Icon, cor = 'var(--accent)', action }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--hairline)' }}>
      <h2 className="font-black text-sm flex items-center gap-2" style={{ color: 'var(--txt-strong)' }}>
        {Icon && <Icon size={16} strokeWidth={1.75} style={{ color: cor }} />}
        {title}
      </h2>
      {action}
    </div>
  );
}

export function KpiCard({ label, value, sub, cor = 'var(--accent)', icon: Icon, trend }) {
  return (
    <Card className="p-4 flex flex-col gap-2">
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{ background: `radial-gradient(circle at 82% 15%, ${cor}, transparent 60%)` }} />
      <div className="flex items-center justify-between gap-1 relative">
        <span className="text-[10px] font-bold uppercase tracking-widest truncate" style={{ color: 'var(--txt-dim)' }}>{label}</span>
        {Icon && (
          <span className="w-8 h-8 flex items-center justify-center rounded-xl shrink-0" style={{ background: `${cor}20` }}>
            <Icon size={16} strokeWidth={1.75} style={{ color: cor }} />
          </span>
        )}
      </div>
      <div className="font-black text-2xl leading-none relative" style={{ color: 'var(--txt-strong)' }}>{value}</div>
      <div className="flex items-center justify-between gap-2 relative">
        {sub && <span className="text-[11px] truncate" style={{ color: 'var(--txt-dim)' }}>{sub}</span>}
        {trend != null && (
          <span className="text-[10px] font-black flex items-center gap-0.5 shrink-0"
            style={{ color: trend >= 0 ? '#10b981' : '#ef4444' }}>
            {trend >= 0 ? <ArrowUpRight size={11} strokeWidth={2.5} /> : <ArrowDownRight size={11} strokeWidth={2.5} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
    </Card>
  );
}

export function ChartTooltip({ active, payload, label, series }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-2xl"
      style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline-strong)' }}>
      <p className="font-bold mb-1" style={{ color: 'var(--txt-strong)' }}>{label}</p>
      {(series || []).map(s => {
        const p = payload.find(x => x.dataKey === s.key);
        if (!p) return null;
        return <p key={s.key} style={{ color: s.cor }}>{s.label}: <b>{s.fmt ? s.fmt(p.value) : p.value}</b></p>;
      })}
    </div>
  );
}
```

- [ ] **Step 2: Criar `frontend/src/pages/dashboard/VisaoGeral.jsx`**

Adaptado do `DashboardCentral.jsx` já existente (hoje commitado, mas a
página em si vai ser removida do menu na Task 8) — mesmo comportamento já
verificado nesta sessão (KPIs sem alarme falso em "Hoje", aviso de dia sem
pedido, Top Produtos com aviso de dados importados), agora usando
`_shared.jsx` em vez de componentes locais duplicados, e SEM o wrapper de
página (`Toaster`, `min-h-screen`, padding) — isso fica no shell
`Dashboard.jsx`.

```jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToken } from '../../hooks/useAuth';
import toast from 'react-hot-toast';
import {
  ShoppingBag, Wallet, Receipt, Users, Plus, TrendingUp, Trophy, Clock, ChevronRight, Activity,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardHeader, KpiCard, ChartTooltip, brl, brlK } from './_shared';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });

const hora = s => {
  if (!s) return '';
  const d = new Date(String(s).replace(' ', 'T') + (String(s).endsWith('Z') ? '' : 'Z'));
  return isNaN(d) ? '' : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const NOMES_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const ymd = (d = new Date()) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

function serie30dias(evolucao30d = []) {
  const map = Object.fromEntries(evolucao30d.map(d => [d.dia, d]));
  const out = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const dia = ymd(d);
    const e = map[dia];
    out.push({ dia, dow: d.getDay(), pedidos: e?.pedidos || 0, total: e?.total || 0 });
  }
  return out;
}

function somaJanela(dias, offsetFim, n) {
  const end = dias.length - offsetFim;
  const start = end - n;
  if (start < 0) return null;
  const slice = dias.slice(start, end);
  return {
    pedidos: slice.reduce((s, d) => s + d.pedidos, 0),
    total: slice.reduce((s, d) => s + d.total, 0),
  };
}

const variacao = (cur, prev) => (prev && prev > 0) ? Math.round(((cur - prev) / prev) * 100) : null;

const STATUS = {
  novo: { label: 'Novo', cor: '#60a5fa' },
  espera: { label: 'Aguardando', cor: '#60a5fa' },
  preparando: { label: 'Em preparo', cor: 'var(--accent-2)' },
  pronto: { label: 'Pronto', cor: '#34d399' },
  entregue: { label: 'Entregue', cor: '#10b981' },
  cancelado: { label: 'Cancelado', cor: '#ef4444' },
};
const statusInfo = s => STATUS[s] || { label: s || '—', cor: 'var(--txt-dim)' };

function PerformanceChart({ data, accent, titulo }) {
  const totalFat = data.reduce((s, d) => s + d.faturamento, 0);
  const totalPed = data.reduce((s, d) => s + d.pedidos, 0);
  return (
    <Card>
      <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap" style={{ borderBottom: '1px solid var(--hairline)' }}>
        <h2 className="font-black text-sm flex items-center gap-2" style={{ color: 'var(--txt-strong)' }}>
          <TrendingUp size={16} strokeWidth={1.75} style={{ color: accent }} /> {titulo}
        </h2>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--txt-dim)' }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: accent }} /> {brlK(totalFat)}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--txt-dim)' }}>
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: '#60a5fa' }} /> {totalPed} ped.
          </span>
        </div>
      </div>
      <div className="p-3 pt-4">
        <ResponsiveContainer width="100%" height={264}>
          <LineChart data={data} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.10)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
            <YAxis yAxisId="fat" tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} width={38}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <YAxis yAxisId="ped" orientation="right" tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
            <Tooltip content={<ChartTooltip series={[
              { key: 'faturamento', label: 'Faturamento', cor: accent, fmt: brl },
              { key: 'pedidos', label: 'Pedidos', cor: '#60a5fa' },
            ]} />} cursor={{ stroke: 'rgba(148,163,184,0.25)' }} />
            <Line yAxisId="fat" type="monotone" dataKey="faturamento" stroke={accent} strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: accent }} />
            <Line yAxisId="ped" type="monotone" dataKey="pedidos" stroke="#60a5fa" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#60a5fa' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function TopProdutos({ itens, faturamento }) {
  return (
    <Card>
      <CardHeader title="Top produtos" icon={Trophy} cor="var(--accent-2)" />
      <div className="px-4 pt-3">
        <p className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>
          Baseado em pedidos do cardápio/PDV — faturamento importado de outro sistema não entra aqui (sem item por item).
        </p>
      </div>
      <div className="p-4 pt-2 space-y-3">
        {itens.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--txt-faint)' }}>Sem vendas no período</p>
        ) : itens.slice(0, 5).map((it, i) => {
          const pct = faturamento > 0 ? (it.receita / faturamento) * 100 : 0;
          const medal = i === 0 ? 'var(--accent-2)' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'var(--txt-faint)';
          return (
            <div key={it.item_nome} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0"
                style={{ background: `color-mix(in srgb, ${medal} 16%, transparent)`, color: medal }}>{i + 1}</span>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold truncate" style={{ color: 'var(--txt-strong)' }}>{it.item_nome}</span>
                  <span className="text-[10px] font-black shrink-0" style={{ color: medal }}>{it.qtd_vendida}×</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ background: 'var(--space-elev-2)' }}>
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: medal }} />
                </div>
              </div>
              <span className="text-[11px] font-black shrink-0 w-12 text-right" style={{ color: 'var(--txt-dim)' }}>{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PedidosRecentes({ pedidos, onVerTodos }) {
  return (
    <Card>
      <CardHeader title="Pedidos recentes" icon={Clock} cor="#60a5fa"
        action={
          <button onClick={onVerTodos} className="text-[11px] font-bold flex items-center gap-0.5" style={{ color: 'var(--accent)' }}>
            Ver todos <ChevronRight size={13} strokeWidth={2.5} />
          </button>
        } />
      {pedidos.length === 0 ? (
        <p className="text-xs text-center py-10" style={{ color: 'var(--txt-faint)' }}>Nenhum pedido hoje ainda</p>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--hairline)' }}>
          {pedidos.map(p => {
            const si = statusInfo(p.status);
            const qtdItens = (p.itens || []).reduce((s, it) => s + (it.quantidade || 0), 0);
            return (
              <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--txt-strong)' }}>
                    {p.cliente_nome || 'Cliente'} <span className="font-normal" style={{ color: 'var(--txt-faint)' }}>#{p.numero}</span>
                  </p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--txt-faint)' }}>
                    {qtdItens} {qtdItens === 1 ? 'item' : 'itens'} · {brl(p.total)}
                  </p>
                </div>
                <span className="text-[10px] font-black px-2 py-1 rounded-lg shrink-0"
                  style={{ background: `color-mix(in srgb, ${si.cor} 15%, transparent)`, color: si.cor }}>{si.label}</span>
                <span className="text-[11px] shrink-0 w-10 text-right tabular-nums" style={{ color: 'var(--txt-dim)' }}>{hora(p.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ClientesDonut({ segmentos, total }) {
  const dados = segmentos.filter(s => s.value > 0);
  return (
    <Card>
      <CardHeader title="Distribuição de clientes" icon={Users} cor="#a78bfa" />
      <div className="p-5 flex items-center gap-4 flex-wrap sm:flex-nowrap">
        <div className="relative shrink-0 mx-auto sm:mx-0" style={{ width: 168, height: 168 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={dados.length ? dados : [{ label: '—', value: 1, cor: 'var(--space-elev-2)' }]}
                dataKey="value" nameKey="label" innerRadius={56} outerRadius={80} paddingAngle={dados.length > 1 ? 3 : 0} stroke="none">
                {(dados.length ? dados : [{ cor: 'var(--space-elev-2)' }]).map((s, i) => <Cell key={i} fill={s.cor} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="font-black text-2xl leading-none" style={{ color: 'var(--txt-strong)' }}>{total}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--txt-dim)' }}>clientes</span>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2.5 w-full">
          {segmentos.map(s => {
            const pct = total > 0 ? (s.value / total) * 100 : 0;
            return (
              <div key={s.label} className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.cor }} />
                <span className="text-xs flex-1 min-w-0 truncate" style={{ color: 'var(--txt)' }}>{s.label}</span>
                <span className="text-xs font-black shrink-0" style={{ color: 'var(--txt-strong)' }}>{s.value}</span>
                <span className="text-[10px] shrink-0 w-9 text-right" style={{ color: 'var(--txt-dim)' }}>{pct.toFixed(0)}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

const PERIODOS = [{ id: 'hoje', label: 'Hoje' }, { id: '7d', label: '7 dias' }, { id: '30d', label: '30 dias' }];

export default function VisaoGeral() {
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState('hoje');
  const [accent, setAccent] = useState('#f97316');

  useEffect(() => {
    try {
      const c = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      if (c) setAccent(c);
    } catch {}
  }, []);

  const carregar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [dRes, pRes] = await Promise.all([
        fetch(`${BASE}/dashboard`, { headers: authH() }),
        fetch(`${BASE}/pdv/pedidos`, { headers: authH() }),
      ]);
      if (dRes.ok) setDados(await dRes.json());
      if (pRes.ok) setPedidos(await pRes.json());
    } catch { if (!silent) toast.error('Erro ao carregar o painel'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => {
    const iv = setInterval(() => carregar(true), 60_000);
    return () => clearInterval(iv);
  }, [carregar]);

  const derivado = useMemo(() => {
    if (!dados) return null;
    const dias30 = serie30dias(dados.evolucao30d);
    const n = periodo === 'hoje' ? 1 : periodo === '7d' ? 7 : 30;
    const cur = somaJanela(dias30, 0, n) || { pedidos: 0, total: 0 };
    const prev = somaJanela(dias30, n, n);

    const ticketCur = cur.pedidos > 0 ? cur.total / cur.pedidos : 0;
    const ticketPrev = prev && prev.pedidos > 0 ? prev.total / prev.pedidos : null;

    const janela = periodo === '30d' ? dias30 : dias30.slice(-7);
    const chart = janela.map(d => ({
      label: periodo === '30d' ? d.dia.slice(8, 10) + '/' + d.dia.slice(5, 7) : NOMES_DIA[d.dow],
      pedidos: d.pedidos,
      faturamento: d.total,
    }));

    const fat30 = dias30.reduce((s, d) => s + d.total, 0);

    const cli = dados.clientes || {};
    const totalCli = cli.total_clientes || 0;
    const novos = cli.novos_mes || 0;
    const recorrentes = cli.recorrentes || 0;
    const outros = Math.max(0, totalCli - novos - recorrentes);
    const segmentos = [
      { label: 'Recorrentes', value: recorrentes, cor: '#a78bfa' },
      { label: 'Novos (30d)', value: novos, cor: '#34d399' },
      { label: 'Inativos', value: outros, cor: '#5b6678' },
    ];

    return {
      kpis: {
        pedidos: cur.pedidos,
        faturamento: cur.total,
        ticket: ticketCur,
        clientes: totalCli,
        varPedidos: (prev && periodo !== 'hoje') ? variacao(cur.pedidos, prev.pedidos) : null,
        varFat: (prev && periodo !== 'hoje') ? variacao(cur.total, prev.total) : null,
        varTicket: (ticketPrev && periodo !== 'hoje') ? variacao(ticketCur, ticketPrev) : null,
        novos, recorrentes,
      },
      chart, fat30, segmentos, totalCli,
    };
  }, [dados, periodo]);

  const pedidosRecentes = useMemo(
    () => [...pedidos].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 6),
    [pedidos]
  );

  const tituloGrafico = periodo === '30d' ? 'Pedidos vs Faturamento — Últimos 30 dias' : 'Pedidos vs Faturamento — Últimos 7 dias';

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="text-sm flex items-center gap-2" style={{ color: 'var(--txt-dim)' }}>
        <Activity size={18} strokeWidth={1.75} style={{ color: 'var(--accent)' }} className="animate-pulse" /> Carregando painel...
      </div>
    </div>
  );

  if (!derivado) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="text-sm" style={{ color: 'var(--txt-dim)' }}>
        Erro ao carregar.{' '}
        <button onClick={() => carregar()} style={{ color: 'var(--accent)' }} className="underline">Tentar novamente</button>
      </div>
    </div>
  );

  const k = derivado.kpis;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-0.5 p-0.5 rounded-xl" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
          {PERIODOS.map(p => (
            <button key={p.id} onClick={() => setPeriodo(p.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={periodo === p.id
                ? { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.3)' }
                : { color: 'var(--txt-dim)', border: '1px solid transparent' }}>
              {p.label}
            </button>
          ))}
        </div>
        <button onClick={() => navigate('/pdv')}
          className="px-4 py-2 rounded-xl font-black text-sm text-white flex items-center gap-1.5 active:scale-95 transition-transform"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))', boxShadow: '0 6px 20px rgba(var(--accent-rgb),0.35)' }}>
          <Plus size={16} strokeWidth={2.5} /> Novo Pedido
        </button>
      </div>

      {periodo === 'hoje' && k.pedidos === 0 && k.faturamento === 0 && (
        <div className="rounded-xl px-4 py-2.5 text-xs flex items-center gap-2"
          style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)', color: 'var(--txt-dim)' }}>
          <Activity size={14} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
          Nenhum pedido registrado hoje ainda — os números abaixo aparecem conforme chegam. Veja <b>7 dias</b> ou <b>30 dias</b> pro histórico.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Pedidos" value={k.pedidos} sub="no período" cor="#60a5fa" icon={ShoppingBag} trend={k.varPedidos} />
        <KpiCard label="Faturamento" value={brlK(k.faturamento)} sub="no período" cor="var(--accent)" icon={Wallet} trend={k.varFat} />
        <KpiCard label="Ticket médio" value={brl(k.ticket)} sub="por pedido" cor="var(--accent-2)" icon={Receipt} trend={k.varTicket} />
        <KpiCard label="Clientes" value={k.clientes} sub={`${k.novos} novos · ${k.recorrentes} fiéis`} cor="#a78bfa" icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><PerformanceChart data={derivado.chart} accent={accent} titulo={tituloGrafico} /></div>
        <TopProdutos itens={dados.top_itens || []} faturamento={derivado.fat30} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2"><PedidosRecentes pedidos={pedidosRecentes} onVerTodos={() => navigate('/relatorio-pedidos')} /></div>
        <ClientesDonut segmentos={derivado.segmentos} total={derivado.totalCli} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Substituir `frontend/src/pages/Dashboard.jsx`**

Leia o arquivo atual primeiro (`frontend/src/pages/Dashboard.jsx`) só pra
confirmar que não há nada além do dashboard simples de antes — não deve
haver lógica de negócio única que precise ser preservada (é a tela antiga
sendo substituída, conforme a spec). Substitua todo o conteúdo por:

```jsx
import React, { useState, useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { LayoutDashboard, Wallet, Package, TrendingDown, Clock } from 'lucide-react';
import { getToken } from '../hooks/useAuth';
import VisaoGeral from './dashboard/VisaoGeral';

const BASE = import.meta.env.VITE_API_URL || '/api';

const ABAS = [
  { id: 'geral', label: 'Visão Geral', icon: LayoutDashboard, componente: VisaoGeral },
];

export default function Dashboard() {
  const [aba, setAba] = useState('geral');
  const [nome, setNome] = useState('');

  useEffect(() => {
    fetch(`${BASE}/cardapio/config`).then(r => r.json())
      .then(c => { if (c?.nome_restaurante) setNome(c.nome_restaurante); }).catch(() => {});
  }, []);

  const AbaAtiva = ABAS.find(a => a.id === aba)?.componente || VisaoGeral;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <Toaster position="top-center" toastOptions={{ style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' } }} />

      <div className="max-w-7xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-black" style={{ color: 'var(--txt-strong)' }}>
            Bem-vindo de volta{nome ? `, ${nome}` : ''} 👋
          </h1>
          <p className="text-[13px] mt-1" style={{ color: 'var(--txt-dim)' }}>Veja o resumo do seu negócio hoje</p>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1" style={{ borderBottom: '1px solid var(--hairline)' }}>
          {ABAS.map(a => (
            <button key={a.id} onClick={() => setAba(a.id)}
              className="px-4 py-2.5 text-sm font-bold flex items-center gap-1.5 shrink-0 transition-colors"
              style={aba === a.id
                ? { color: 'var(--accent)', borderBottom: '2px solid var(--accent)' }
                : { color: 'var(--txt-dim)', borderBottom: '2px solid transparent' }}>
              <a.icon size={15} strokeWidth={1.75} />
              {a.label}
            </button>
          ))}
        </div>

        <AbaAtiva />
      </div>
    </div>
  );
}
```

Note: `Wallet, Package, TrendingDown, Clock` são importados mas ainda não
usados nesta tarefa — as Tasks 4-7 vão usá-los como ícone de cada aba nova.
Se o linter reclamar de import não usado nesta tarefa específica (rodando
isoladamente), é esperado e resolvido pelas tarefas seguintes; não remova.

- [ ] **Step 4: Verificar no navegador**

Com `cd frontend && npm run dev` e `cd backend && npm run dev` rodando,
abra `http://localhost:3000/dashboard`. Confirme:
- Header "Bem-vindo de volta, <nome>" aparece.
- Uma aba só, "Visão Geral", já ativa.
- KPIs, gráfico, Top Produtos, Pedidos recentes, Distribuição de clientes —
  mesmo comportamento já validado nesta sessão (sem alarme falso em "Hoje").
- Sem erros no console (`read_console_messages`, `onlyErrors: true`).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/dashboard/_shared.jsx frontend/src/pages/dashboard/VisaoGeral.jsx frontend/src/pages/Dashboard.jsx
git commit -m "feat: casca do Dashboard unificado + aba Visão Geral"
```

---

## Task 4: Frontend — aba Financeiro

**Files:**
- Create: `frontend/src/pages/dashboard/Financeiro.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx:9-11` (array `ABAS` — adicionar 1 linha)

**Interfaces:**
- Consumes: `Card`, `CardHeader`, `brl`, `brlK`, `ChartTooltip`, `CORES` de `./_shared` (Task 3)
- Consumes: `GET /api/relatorios/dre?mes=YYYY-MM`, `GET /api/relatorios/evolucao`, `GET /api/relatorios/meta?mes=YYYY-MM` (já existem)
- Produces: componente default-exportado, sem props (busca seus próprios dados) — mesmo contrato de `VisaoGeral`

- [ ] **Step 1: Criar `frontend/src/pages/dashboard/Financeiro.jsx`**

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { getToken } from '../../hooks/useAuth';
import { Wallet, TrendingUp, Target, Activity } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
  ComposedChart, Line, PieChart, Pie, Legend,
} from 'recharts';
import { Card, CardHeader, ChartTooltip, brl, brlK, CORES } from './_shared';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const mesAtual = () => new Date().toISOString().slice(0, 7);
const nomeMesCurto = (mes) => {
  const [a, m] = mes.split('-');
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
};

// Waterfall com Recharts: cada barra é [base invisível, valor visível].
// base = ponto de partida da barra (não desenhado); delta = altura visível.
function montarWaterfall(dre) {
  if (!dre) return [];
  let acumulado = dre.faturamento_bruto;
  const passos = [
    { label: 'Faturamento bruto', valor: dre.faturamento_bruto, tipo: 'total' },
    { label: 'Taxa cartão', valor: -dre.taxa_cartao, tipo: 'saida' },
    { label: 'CMV', valor: -dre.cmv_total, tipo: 'saida' },
    { label: 'Despesas fixas', valor: -dre.despesas_fixas, tipo: 'saida' },
    { label: 'Despesas variáveis', valor: -dre.despesas_variaveis, tipo: 'saida' },
    { label: 'Lucro líquido', valor: dre.lucro_liquido, tipo: 'total', absoluto: true },
  ];
  let corrente = 0;
  return passos.map(p => {
    if (p.tipo === 'total' && p.absoluto) {
      const barra = { label: p.label, base: 0, valor: p.valor, tipo: p.tipo, exibicao: p.valor };
      return barra;
    }
    if (p.tipo === 'total') {
      corrente = p.valor;
      return { label: p.label, base: 0, valor: p.valor, tipo: p.tipo, exibicao: p.valor };
    }
    const inicio = corrente;
    corrente += p.valor;
    const base = Math.min(inicio, corrente);
    const altura = Math.abs(p.valor);
    return { label: p.label, base, valor: altura, tipo: p.tipo, exibicao: p.valor };
  });
}

export default function Financeiro() {
  const [mes, setMes] = useState(mesAtual());
  const [dre, setDre] = useState(null);
  const [evolucao, setEvolucao] = useState([]);
  const [meta, setMeta] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${BASE}/relatorios/dre?mes=${mes}`, { headers: authH() }).then(r => r.json()),
      fetch(`${BASE}/relatorios/evolucao`, { headers: authH() }).then(r => r.json()),
      fetch(`${BASE}/relatorios/meta?mes=${mes}`, { headers: authH() }).then(r => r.json()),
    ]).then(([d, ev, m]) => {
      setDre(d); setEvolucao(ev || []); setMeta(m?.meta || 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [mes]);

  const waterfall = useMemo(() => montarWaterfall(dre), [dre]);
  const evolucaoChart = useMemo(() => evolucao.map(e => ({
    mes: nomeMesCurto(e.mes),
    faturamento: e.faturamento_bruto,
    lucro: e.lucro_liquido,
  })), [evolucao]);

  const pagamentos = dre?.pagamentos || {};
  const pagamentosChart = [
    { label: 'PIX', value: pagamentos.pix || 0, cor: CORES.verde },
    { label: 'Dinheiro', value: pagamentos.dinheiro || 0, cor: CORES.azul },
    { label: 'Crédito', value: pagamentos.credito || 0, cor: CORES.roxo },
    { label: 'Débito', value: pagamentos.debito || 0, cor: CORES.cinza },
  ].filter(p => p.value > 0);

  const progressoMeta = meta > 0 && dre ? Math.min(100, (dre.faturamento_bruto / meta) * 100) : 0;

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="text-sm flex items-center gap-2" style={{ color: 'var(--txt-dim)' }}>
        <Activity size={18} strokeWidth={1.75} style={{ color: 'var(--accent)' }} className="animate-pulse" /> Carregando…
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--txt-strong)' }}>
          <Wallet size={16} strokeWidth={1.75} style={{ color: 'var(--accent)' }} /> DRE do mês
        </h2>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="input max-w-[160px]" />
      </div>

      <Card className="p-4">
        <p className="text-[11px] mb-3" style={{ color: 'var(--txt-dim)' }}>
          Do faturamento bruto até o lucro líquido, passo a passo. CMV calculado só sobre pedidos reais do PDV/cardápio.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={waterfall} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.10)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} width={44} tickFormatter={v => v >= 1000 || v <= -1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0]?.payload;
              return (
                <div className="rounded-xl px-3 py-2 text-xs shadow-2xl" style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline-strong)' }}>
                  <p className="font-bold mb-1" style={{ color: 'var(--txt-strong)' }}>{label}</p>
                  <p style={{ color: item?.exibicao >= 0 ? '#10b981' : '#ef4444' }}>{brl(item?.exibicao)}</p>
                </div>
              );
            }} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
            <Bar dataKey="base" stackId="w" fill="transparent" />
            <Bar dataKey="valor" stackId="w" radius={[4, 4, 4, 4]}>
              {waterfall.map((d, i) => (
                <Cell key={i} fill={d.tipo === 'total' ? (d.exibicao >= 0 ? 'var(--accent)' : '#ef4444') : (d.exibicao >= 0 ? '#10b981' : '#ef4444')} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <CardHeader title="Faturamento e lucro — últimos 12 meses" icon={TrendingUp} cor="var(--accent)" />
          <div className="p-3 pt-4">
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={evolucaoChart} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.10)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} width={38} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip content={<ChartTooltip series={[
                  { key: 'faturamento', label: 'Faturamento', cor: 'var(--accent)', fmt: brl },
                  { key: 'lucro', label: 'Lucro líquido', cor: '#10b981', fmt: brl },
                ]} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
                <Bar dataKey="faturamento" fill="var(--accent)" radius={[4, 4, 0, 0]} opacity={0.85} />
                <Line type="monotone" dataKey="lucro" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <CardHeader title="Forma de pagamento" icon={Wallet} cor="#a78bfa" />
          <div className="p-3">
            {pagamentosChart.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--txt-faint)' }}>Sem dados no período</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={pagamentosChart} dataKey="value" nameKey="label" innerRadius={44} outerRadius={68} paddingAngle={3} stroke="none">
                      {pagamentosChart.map((p, i) => <Cell key={i} fill={p.cor} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {pagamentosChart.map(p => (
                    <div key={p.label} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.cor }} />
                      <span className="flex-1" style={{ color: 'var(--txt)' }}>{p.label}</span>
                      <span className="font-bold" style={{ color: 'var(--txt-strong)' }}>{brl(p.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {meta > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--txt-strong)' }}>
              <Target size={15} strokeWidth={1.75} style={{ color: 'var(--accent)' }} /> Meta do mês
            </h2>
            <span className="text-xs font-bold" style={{ color: 'var(--txt-dim)' }}>{brl(dre?.faturamento_bruto)} de {brl(meta)}</span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--space-elev-2)' }}>
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${progressoMeta}%`, background: progressoMeta >= 100 ? '#10b981' : 'var(--accent)' }} />
          </div>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Adicionar a aba em `Dashboard.jsx`**

Em `frontend/src/pages/Dashboard.jsx`, adicione o import e a entrada no
array `ABAS` (arquivo criado do zero na Task 3 — mudança direta, sem
conflito de WIP):

```jsx
import Financeiro from './dashboard/Financeiro';
```

```jsx
const ABAS = [
  { id: 'geral', label: 'Visão Geral', icon: LayoutDashboard, componente: VisaoGeral },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet, componente: Financeiro },
];
```

- [ ] **Step 3: Verificar no navegador**

Abra `/dashboard`, clique na aba "Financeiro". Confirme:
- Gráfico waterfall renderiza sem erro (faturamento bruto até lucro líquido).
- Gráfico de evolução 12 meses renderiza.
- Donut de forma de pagamento (ou "Sem dados no período" se todos zerados).
- Trocar o mês no seletor recarrega os dados.
- Sem erros no console.

Confira contra `curl` no endpoint `/api/relatorios/dre?mes=<mes>` que os
valores da cascata batem com o JSON retornado.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/dashboard/Financeiro.jsx frontend/src/pages/Dashboard.jsx
git commit -m "feat: aba Financeiro do Dashboard (DRE em cascata, evolução, pagamentos, meta)"
```

---

## Task 5: Frontend — aba Produtos

**Files:**
- Create: `frontend/src/pages/dashboard/Produtos.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx` (array `ABAS` — adicionar 1 linha, mesmo padrão do Task 4)

**Interfaces:**
- Consumes: `Card`, `CardHeader`, `brl` de `./_shared`
- Consumes: `GET /api/relatorios/itens-comp?mes=YYYY-MM` (já existe, traz comparação com mês anterior), `GET /api/relatorios/produto?nome=X&dias=90` (já existe, para o drill-down)

- [ ] **Step 1: Criar `frontend/src/pages/dashboard/Produtos.jsx`**

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { getToken } from '../../hooks/useAuth';
import { Package, AlertTriangle, ChevronDown, ChevronUp, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardHeader, brl } from './_shared';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const mesAtual = () => new Date().toISOString().slice(0, 7);

function VariacaoBadge({ atual, anterior }) {
  if (!anterior) return <span className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>novo</span>;
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (Math.abs(pct) < 1) return <span className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>estável</span>;
  const Icon = pct >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="text-[10px] font-black flex items-center gap-0.5" style={{ color: pct >= 0 ? '#10b981' : '#ef4444' }}>
      <Icon size={10} strokeWidth={2.5} />{Math.abs(pct)}%
    </span>
  );
}

export default function Produtos() {
  const [mes, setMes] = useState(mesAtual());
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ordem, setOrdem] = useState({ campo: 'receita', dir: 'desc' });
  const [expandido, setExpandido] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/relatorios/itens-comp?mes=${mes}`, { headers: authH() })
      .then(r => r.json()).then(setDados).catch(() => {}).finally(() => setLoading(false));
  }, [mes]);

  const itensOrdenados = useMemo(() => {
    const itens = dados?.itens || [];
    const copia = [...itens];
    copia.sort((a, b) => {
      const va = a[ordem.campo] ?? 0, vb = b[ordem.campo] ?? 0;
      return ordem.dir === 'desc' ? vb - va : va - vb;
    });
    return copia;
  }, [dados, ordem]);

  const semFicha = (dados?.itens || []).filter(i => i.sem_ficha);
  const ranking = useMemo(() => {
    const vendidos = (dados?.itens || []).filter(i => i.qtd > 0);
    const porMargem = [...vendidos].sort((a, b) => b.margem_pct - a.margem_pct);
    return { melhores: porMargem.slice(0, 5), piores: porMargem.slice(-5).reverse() };
  }, [dados]);

  function ordenarPor(campo) {
    setOrdem(o => ({ campo, dir: o.campo === campo && o.dir === 'desc' ? 'asc' : 'desc' }));
  }

  const COLUNAS = [
    { campo: 'nome', label: 'Produto', num: false },
    { campo: 'qtd', label: 'Qtd', num: true },
    { campo: 'receita', label: 'Receita', num: true, fmt: brl },
    { campo: 'custo_total', label: 'Custo', num: true, fmt: brl },
    { campo: 'margem', label: 'Margem R$', num: true, fmt: brl },
    { campo: 'margem_pct', label: 'Margem %', num: true, fmt: v => `${v}%` },
    { campo: 'cmv_pct', label: 'CMV %', num: true, fmt: v => `${v}%` },
  ];

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="text-sm flex items-center gap-2" style={{ color: 'var(--txt-dim)' }}>
        <Activity size={18} strokeWidth={1.75} style={{ color: 'var(--accent)' }} className="animate-pulse" /> Carregando…
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--txt-strong)' }}>
          <Package size={16} strokeWidth={1.75} style={{ color: 'var(--accent)' }} /> Lucratividade por produto
        </h2>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="input max-w-[160px]" />
      </div>

      {semFicha.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', color: '#f59e0b' }}>
          <AlertTriangle size={14} /> {semFicha.length} produtos vendidos sem ficha técnica — custo desconhecido, margem real pode ser menor. Preencha em Fichas Técnicas.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <CardHeader title="Melhores margens" cor="#10b981" />
          <div className="p-3 space-y-2">
            {ranking.melhores.map(it => (
              <div key={it.nome} className="flex items-center justify-between text-xs">
                <span className="truncate flex-1" style={{ color: 'var(--txt)' }}>{it.nome}</span>
                <span className="font-black shrink-0 ml-2" style={{ color: '#10b981' }}>{it.margem_pct}%</span>
              </div>
            ))}
            {ranking.melhores.length === 0 && <p className="text-xs text-center py-4" style={{ color: 'var(--txt-faint)' }}>Sem vendas no mês</p>}
          </div>
        </Card>
        <Card className="p-4">
          <CardHeader title="Piores margens" cor="#ef4444" />
          <div className="p-3 space-y-2">
            {ranking.piores.map(it => (
              <div key={it.nome} className="flex items-center justify-between text-xs">
                <span className="truncate flex-1" style={{ color: 'var(--txt)' }}>{it.nome}</span>
                <span className="font-black shrink-0 ml-2" style={{ color: '#ef4444' }}>{it.margem_pct}%</span>
              </div>
            ))}
            {ranking.piores.length === 0 && <p className="text-xs text-center py-4" style={{ color: 'var(--txt-faint)' }}>Sem vendas no mês</p>}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Todos os produtos vendidos no mês" cor="var(--accent)" />
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--hairline)' }}>
                {COLUNAS.map(c => (
                  <th key={c.campo} onClick={() => ordenarPor(c.campo)}
                    className={`px-3 py-2 font-bold cursor-pointer select-none whitespace-nowrap ${c.num ? 'text-right' : 'text-left'}`}
                    style={{ color: 'var(--txt-dim)' }}>
                    <span className="inline-flex items-center gap-1">
                      {c.label}
                      {ordem.campo === c.campo && (ordem.dir === 'desc' ? <ChevronDown size={12} /> : <ChevronUp size={12} />)}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-bold" style={{ color: 'var(--txt-dim)' }}>vs mês ant.</th>
              </tr>
            </thead>
            <tbody>
              {itensOrdenados.map(it => (
                <React.Fragment key={it.nome}>
                  <tr className="cursor-pointer hover:bg-white/[0.02]" style={{ borderBottom: '1px solid var(--hairline)' }}
                    onClick={() => setExpandido(expandido === it.nome ? null : it.nome)}>
                    <td className="px-3 py-2 font-medium" style={{ color: 'var(--txt-strong)' }}>
                      {it.nome} {it.sem_ficha && <AlertTriangle size={11} className="inline ml-1" style={{ color: '#f59e0b' }} />}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: 'var(--txt)' }}>{it.qtd}</td>
                    <td className="px-3 py-2 text-right" style={{ color: 'var(--txt)' }}>{brl(it.receita)}</td>
                    <td className="px-3 py-2 text-right" style={{ color: 'var(--txt)' }}>{brl(it.custo_total)}</td>
                    <td className="px-3 py-2 text-right font-bold" style={{ color: it.margem >= 0 ? '#10b981' : '#ef4444' }}>{brl(it.margem)}</td>
                    <td className="px-3 py-2 text-right" style={{ color: 'var(--txt)' }}>{it.margem_pct}%</td>
                    <td className="px-3 py-2 text-right" style={{ color: 'var(--txt)' }}>{it.cmv_pct}%</td>
                    <td className="px-3 py-2 text-right"><VariacaoBadge atual={it.receita} anterior={it.prev_receita} /></td>
                  </tr>
                  {expandido === it.nome && <DetalheProduto nome={it.nome} />}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          {itensOrdenados.length === 0 && <p className="text-xs text-center py-8" style={{ color: 'var(--txt-faint)' }}>Sem produtos vendidos nesse mês</p>}
        </div>
      </Card>
    </div>
  );
}

function DetalheProduto({ nome }) {
  const [detalhe, setDetalhe] = useState(null);
  useEffect(() => {
    fetch(`${BASE}/relatorios/produto?nome=${encodeURIComponent(nome)}&dias=90`, { headers: authH() })
      .then(r => r.json()).then(setDetalhe).catch(() => {});
  }, [nome]);

  if (!detalhe) return (
    <tr><td colSpan={8} className="px-3 py-3 text-xs text-center" style={{ color: 'var(--txt-faint)' }}>Carregando…</td></tr>
  );

  return (
    <tr>
      <td colSpan={8} className="px-3 py-3" style={{ background: 'var(--space-elev-2)' }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div><span style={{ color: 'var(--txt-faint)' }}>Participação (90d)</span><p className="font-black" style={{ color: 'var(--txt-strong)' }}>{detalhe.participacao}%</p></div>
          <div><span style={{ color: 'var(--txt-faint)' }}>Média/dia</span><p className="font-black" style={{ color: 'var(--txt-strong)' }}>{detalhe.media_dia}</p></div>
          <div><span style={{ color: 'var(--txt-faint)' }}>Lucro por unidade</span><p className="font-black" style={{ color: 'var(--txt-strong)' }}>{brl(detalhe.lucro_unit)}</p></div>
          <div><span style={{ color: 'var(--txt-faint)' }}>Pedidos (90d)</span><p className="font-black" style={{ color: 'var(--txt-strong)' }}>{detalhe.pedidos}</p></div>
        </div>
        {detalhe.insumos?.length > 0 && (
          <div className="mt-3">
            <p className="text-[10px] font-bold uppercase mb-1.5" style={{ color: 'var(--txt-faint)' }}>Insumos (custo total no período)</p>
            <div className="flex flex-wrap gap-2">
              {detalhe.insumos.slice(0, 8).map(ins => (
                <span key={ins.nome} className="px-2 py-1 rounded-lg text-[10px]" style={{ background: 'var(--space-elev)', color: 'var(--txt)' }}>
                  {ins.nome}: {brl(ins.custo_total)}
                </span>
              ))}
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}
```

- [ ] **Step 2: Adicionar a aba em `Dashboard.jsx`**

```jsx
import Produtos from './dashboard/Produtos';
```

```jsx
const ABAS = [
  { id: 'geral', label: 'Visão Geral', icon: LayoutDashboard, componente: VisaoGeral },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet, componente: Financeiro },
  { id: 'produtos', label: 'Produtos', icon: Package, componente: Produtos },
];
```

- [ ] **Step 3: Verificar no navegador**

Aba "Produtos": tabela carrega, clicar num cabeçalho de coluna reordena,
clicar numa linha expande o detalhe (participação, insumos). Se houver
itens sem ficha técnica no mês testado, o aviso amarelo aparece com a
contagem certa (confira contra `curl .../itens-comp?mes=X` — campo
`sem_ficha`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/dashboard/Produtos.jsx frontend/src/pages/Dashboard.jsx
git commit -m "feat: aba Produtos do Dashboard (tabela ordenável, ranking, drill-down)"
```

---

## Task 6: Frontend — aba Despesas

**Files:**
- Create: `frontend/src/pages/dashboard/Despesas.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx` (array `ABAS` — adicionar 1 linha)

**Interfaces:**
- Consumes: `Card`, `CardHeader`, `brl`, `CORES` de `./_shared`
- Consumes: `GET /api/relatorios/despesas-analise?mes=YYYY-MM` (Task 1), `GET /api/relatorios/painel-dono?mes=YYYY-MM` (já existe — usado só pro `maior_gasto`)

- [ ] **Step 1: Criar `frontend/src/pages/dashboard/Despesas.jsx`**

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { getToken } from '../../hooks/useAuth';
import { TrendingDown, Activity } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardHeader, ChartTooltip, brl, CORES } from './_shared';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const mesAtual = () => new Date().toISOString().slice(0, 7);
const nomeMesCurto = (mes) => {
  const [a, m] = mes.split('-');
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
};
const CORES_TIPO = ['#60a5fa', '#34d399', '#a78bfa', '#f97316', '#ef4444', '#5b6678', '#fbbf24'];

export default function Despesas() {
  const [mes, setMes] = useState(mesAtual());
  const [dados, setDados] = useState(null);
  const [maiorGasto, setMaiorGasto] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`${BASE}/relatorios/despesas-analise?mes=${mes}`, { headers: authH() }).then(r => r.json()),
      fetch(`${BASE}/relatorios/painel-dono?mes=${mes}`, { headers: authH() }).then(r => r.json()),
    ]).then(([d, p]) => { setDados(d); setMaiorGasto(p?.saiu?.maior_gasto || null); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [mes]);

  const porCategoria = (dados?.por_categoria || []).map(c => ({
    label: c.categoria === 'fixo' ? 'Fixas' : 'Variáveis',
    value: c.total,
    cor: c.categoria === 'fixo' ? CORES.roxo : CORES.vermelho,
  }));
  const porTipo = (dados?.por_tipo || []).slice(0, 7);
  const evolucaoChart = useMemo(() => (dados?.evolucao || []).map(e => ({
    mes: nomeMesCurto(e.mes), fixas: e.fixas, variaveis: e.variaveis,
  })), [dados]);

  const totalMes = porCategoria.reduce((s, c) => s + c.value, 0);

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="text-sm flex items-center gap-2" style={{ color: 'var(--txt-dim)' }}>
        <Activity size={18} strokeWidth={1.75} style={{ color: 'var(--accent)' }} className="animate-pulse" /> Carregando…
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--txt-strong)' }}>
          <TrendingDown size={16} strokeWidth={1.75} style={{ color: '#ef4444' }} /> Para onde foi o dinheiro
        </h2>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)} className="input max-w-[160px]" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4">
          <CardHeader title="Fixas vs variáveis" cor="var(--accent)" />
          <div className="p-3">
            {totalMes === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--txt-faint)' }}>Nenhuma despesa lançada nesse mês</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <PieChart>
                    <Pie data={porCategoria} dataKey="value" nameKey="label" innerRadius={40} outerRadius={64} paddingAngle={3} stroke="none">
                      {porCategoria.map((c, i) => <Cell key={i} fill={c.cor} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-1.5 mt-2">
                  {porCategoria.map(c => (
                    <div key={c.label} className="flex items-center gap-2 text-xs">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.cor }} />
                      <span className="flex-1" style={{ color: 'var(--txt)' }}>{c.label}</span>
                      <span className="font-bold" style={{ color: 'var(--txt-strong)' }}>{brl(c.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <CardHeader title="Por tipo/fornecedor" cor="#a78bfa" />
          <div className="p-3 space-y-2">
            {porTipo.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--txt-faint)' }}>Sem dados no período</p>
            ) : porTipo.map((t, i) => {
              const pct = totalMes > 0 ? (t.total / totalMes) * 100 : 0;
              return (
                <div key={t.tipo}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span style={{ color: 'var(--txt)' }}>{t.tipo}</span>
                    <span className="font-bold" style={{ color: 'var(--txt-strong)' }}>{brl(t.total)}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ background: 'var(--space-elev-2)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CORES_TIPO[i % CORES_TIPO.length] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <CardHeader title="Evolução — últimos 12 meses (fixas vs variáveis)" cor="var(--accent)" />
        <div className="p-3 pt-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={evolucaoChart} margin={{ top: 6, right: 6, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.10)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#5b6678', fontSize: 10 }} axisLine={false} tickLine={false} width={38} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip content={<ChartTooltip series={[
                { key: 'fixas', label: 'Fixas', cor: CORES.roxo, fmt: brl },
                { key: 'variaveis', label: 'Variáveis', cor: CORES.vermelho, fmt: brl },
              ]} />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
              <Bar dataKey="fixas" stackId="d" fill={CORES.roxo} radius={[0, 0, 0, 0]} />
              <Bar dataKey="variaveis" stackId="d" fill={CORES.vermelho} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {maiorGasto && (
        <p className="text-xs text-center" style={{ color: 'var(--txt-dim)' }}>
          Maior gasto do mês: <b style={{ color: 'var(--txt)' }}>{maiorGasto.descricao?.trim() || '—'}</b> — {brl(maiorGasto.valor)}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Adicionar a aba em `Dashboard.jsx`**

```jsx
import Despesas from './dashboard/Despesas';
```

```jsx
const ABAS = [
  { id: 'geral', label: 'Visão Geral', icon: LayoutDashboard, componente: VisaoGeral },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet, componente: Financeiro },
  { id: 'produtos', label: 'Produtos', icon: Package, componente: Produtos },
  { id: 'despesas', label: 'Despesas', icon: TrendingDown, componente: Despesas },
];
```

- [ ] **Step 3: Verificar no navegador**

Aba "Despesas": donut fixas/variáveis, barra por tipo/fornecedor, gráfico
empilhado de evolução, maior gasto do mês. Troque o mês e confirme que
recarrega. Confira contra `curl .../despesas-analise?mes=X` (Task 1).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/dashboard/Despesas.jsx frontend/src/pages/Dashboard.jsx
git commit -m "feat: aba Despesas do Dashboard (breakdown, evolução 12 meses)"
```

---

## Task 7: Frontend — aba Operação

**Files:**
- Create: `frontend/src/pages/dashboard/Operacao.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx` (array `ABAS` — adicionar 1 linha)

**Interfaces:**
- Consumes: `Card`, `CardHeader` de `./_shared`
- Consumes: `GET /api/relatorios/pico-semanal?dias=90` (Task 2), `GET /api/dashboard` (já existe — usa `pedidos_ativos`)

- [ ] **Step 1: Criar `frontend/src/pages/dashboard/Operacao.jsx`**

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { getToken } from '../../hooks/useAuth';
import { Clock, Activity, Flame } from 'lucide-react';
import { Card, CardHeader } from './_shared';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HORAS_VISIVEIS = Array.from({ length: 16 }, (_, i) => i + 8); // 08h–23h (janela de operação do delivery)

const STATUS_LABEL = {
  novo: 'Novo', espera: 'Aguardando', preparando: 'Em preparo', pronto: 'Pronto', entregue: 'Entregue',
};
const STATUS_COR = {
  novo: '#60a5fa', espera: '#60a5fa', preparando: 'var(--accent-2)', pronto: '#34d399', entregue: '#10b981',
};

function corCelula(valor, max) {
  if (!valor || max === 0) return 'var(--space-elev-2)';
  const intensidade = Math.min(1, valor / max);
  return `color-mix(in srgb, var(--accent) ${Math.round(intensidade * 85 + 10)}%, var(--space-elev-2))`;
}

export default function Operacao() {
  const [mapa, setMapa] = useState([]);
  const [pedidosAtivos, setPedidosAtivos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/relatorios/pico-semanal?dias=90`, { headers: authH() }).then(r => r.json()),
      fetch(`${BASE}/dashboard`, { headers: authH() }).then(r => r.json()),
    ]).then(([pico, dash]) => {
      setMapa(pico?.mapa || []);
      setPedidosAtivos(dash?.pedidos_ativos || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const grade = useMemo(() => {
    const lookup = new Map(mapa.map(m => [`${m.dow}-${m.hora}`, m.pedidos]));
    const max = mapa.reduce((m, x) => Math.max(m, x.pedidos), 0);
    return { lookup, max };
  }, [mapa]);

  const totalAtivos = pedidosAtivos.reduce((s, p) => s + p.qtd, 0);

  if (loading) return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="text-sm flex items-center gap-2" style={{ color: 'var(--txt-dim)' }}>
        <Activity size={18} strokeWidth={1.75} style={{ color: 'var(--accent)' }} className="animate-pulse" /> Carregando…
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-bold flex items-center gap-1.5" style={{ color: 'var(--txt-strong)' }}>
        <Clock size={16} strokeWidth={1.75} style={{ color: 'var(--accent)' }} /> Pulso da operação
      </h2>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--txt-strong)' }}>
            <Flame size={14} strokeWidth={1.75} style={{ color: 'var(--accent)' }} /> Horário de pico (últimos 90 dias)
          </h3>
          <span className="text-[10px]" style={{ color: 'var(--txt-faint)' }}>só pedidos reais do PDV</span>
        </div>
        {mapa.length === 0 ? (
          <p className="text-xs text-center py-8" style={{ color: 'var(--txt-faint)' }}>Sem pedidos suficientes no período</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="border-separate" style={{ borderSpacing: 3 }}>
              <thead>
                <tr>
                  <th></th>
                  {HORAS_VISIVEIS.map(h => (
                    <th key={h} className="text-[9px] font-normal px-0.5" style={{ color: 'var(--txt-faint)' }}>{h}h</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DIAS.map((dia, dow) => (
                  <tr key={dia}>
                    <td className="text-[10px] font-bold pr-2 text-right" style={{ color: 'var(--txt-dim)' }}>{dia}</td>
                    {HORAS_VISIVEIS.map(h => {
                      const valor = grade.lookup.get(`${dow}-${h}`) || 0;
                      return (
                        <td key={h} title={`${dia} ${h}h — ${valor} pedidos`}
                          className="w-6 h-6 rounded-md" style={{ background: corCelula(valor, grade.max) }} />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <CardHeader title="Pedidos ativos agora" cor="var(--accent)" />
        <div className="p-3">
          {totalAtivos === 0 ? (
            <p className="text-xs text-center py-6" style={{ color: 'var(--txt-faint)' }}>Nenhum pedido em andamento agora</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {pedidosAtivos.map(p => (
                <div key={p.status} className="rounded-xl p-3 text-center" style={{ background: 'var(--space-elev-2)' }}>
                  <p className="text-2xl font-black" style={{ color: STATUS_COR[p.status] || 'var(--txt-strong)' }}>{p.qtd}</p>
                  <p className="text-[10px] font-bold uppercase mt-0.5" style={{ color: 'var(--txt-dim)' }}>{STATUS_LABEL[p.status] || p.status}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Adicionar a aba em `Dashboard.jsx`**

```jsx
import Operacao from './dashboard/Operacao';
```

```jsx
const ABAS = [
  { id: 'geral', label: 'Visão Geral', icon: LayoutDashboard, componente: VisaoGeral },
  { id: 'financeiro', label: 'Financeiro', icon: Wallet, componente: Financeiro },
  { id: 'produtos', label: 'Produtos', icon: Package, componente: Produtos },
  { id: 'despesas', label: 'Despesas', icon: TrendingDown, componente: Despesas },
  { id: 'operacao', label: 'Operação', icon: Clock, componente: Operacao },
];
```

Neste ponto todos os ícones importados no shell (`Wallet, Package,
TrendingDown, Clock`, Task 3 Step 3) já estão em uso — confirme que não
sobra import não utilizado.

- [ ] **Step 3: Verificar no navegador**

Aba "Operação": mapa de calor renderiza (ou aviso de dados insuficientes),
células mais escuras nos horários de mais pedido, tooltip nativo (`title`)
mostra dia/hora/contagem ao passar o mouse. "Pedidos ativos agora" reflete
o que está de fato em aberto no PDV — confira criando um pedido de teste e
vendo o card mudar.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/dashboard/Operacao.jsx frontend/src/pages/Dashboard.jsx
git commit -m "feat: aba Operação do Dashboard (mapa de calor de pico, pedidos ativos)"
```

---

## Task 8: Frontend — remover páginas antigas do menu

**Files:**
- Modify: `frontend/src/App.jsx` (só os pontos listados abaixo — o arquivo tem bastante WIP não relacionado, ver Global Constraints)

**Interfaces:**
- Nenhuma nova — só remove entradas de navegação e repointa uma rota da barra inferior mobile.

- [ ] **Step 1: Localizar as mudanças exatas**

Rode `grep -n "DashboardCentral\|PainelDono\|CentroComando\|'/dashboard-central'\|'/painel-dono'\|'/centro-comando'" frontend/src/App.jsx`
pra confirmar os números de linha atuais antes de editar (podem ter mudado
desde que este plano foi escrito, por causa do resto do WIP no arquivo).
No momento em que este plano foi escrito, as mudanças necessárias eram:

1. No array `NAV_GRUPOS`, grupo `'Operação'`: remover as linhas
   ```jsx
   { to: '/centro-comando', icon: Sparkles,         label: 'Centro de Comando' },
   { to: '/dashboard-central', icon: LayoutDashboard, label: 'Dashboard Central' },
   ```
2. No array `NAV_GRUPOS`, grupo `'Relatórios'`: remover a linha
   ```jsx
   { to: '/painel-dono',       icon: PieChart,      label: 'Painel do Dono' },
   ```
   (as outras duas linhas do grupo — CMV/Margem e Rel. Pedidos — ficam)
3. Na função `BottomNav`, array `NAV_MOBILE`: trocar
   ```jsx
   { to: '/painel-dono',   icon: LayoutDashboard, label: 'Painel'    },
   ```
   por
   ```jsx
   { to: '/dashboard',     icon: LayoutDashboard, label: 'Painel'    },
   ```
   (o conteúdo de Painel do Dono passou a viver na aba Financeiro/Visão
   Geral do `/dashboard` unificado — o atalho mobile aponta pra lá agora)
4. **Não remova** `/movimentacoes` (Extrato Banco) — não é uma das páginas
   de dashboard fragmentado, é conciliação bancária, fica como está.
5. **Não remova** as declarações `React.lazy` (`DashboardCentral`,
   `PainelDono`, `CentroComando`) nem as `<Route>` correspondentes — os
   componentes continuam existindo e acessíveis por URL direta (mesmo
   padrão já usado neste arquivo pros dashboards antigos aposentados
   anteriormente — ver comentário próximo à linha 129 do arquivo: "as
   rotas seguem vivas p/ acesso direto, se preciso"). Só a navegação visível
   muda.

- [ ] **Step 2: Aplicar via git-surgery (isola só esta mudança do resto do WIP)**

```bash
cd "C:/Users/User/Desktop/CLAUDE/sushi-finance"
git show HEAD:frontend/src/App.jsx > /tmp/app_base_limpo.jsx
```

Escreva um script Node pontual que abre `/tmp/app_base_limpo.jsx`, aplica
EXATAMENTE as 3 mudanças do Step 1 (usando substituição de string única —
não `sed`/regex ambíguo) e escreve o resultado em
`/tmp/app_reconstruido.jsx`. Confirme com `diff /tmp/app_base_limpo.jsx
/tmp/app_reconstruido.jsx` que só essas linhas mudaram — nada mais.

```bash
BLOB=$(git hash-object -w /tmp/app_reconstruido.jsx)
git update-index --cacheinfo 100644 $BLOB frontend/src/App.jsx
git commit -m "fix: remove páginas de dashboard fragmentado do menu (unificadas em /dashboard)"
```

Isso commita só essa mudança. O working tree do `App.jsx` (com o resto do
WIP não relacionado) não é tocado — confirme com `git status --short
frontend/src/App.jsx`, que deve continuar mostrando `M` (modificado) com o
resto do WIP intacto.

- [ ] **Step 3: Verificar no navegador**

- Menu lateral: "Centro de Comando", "Dashboard Central" e "Painel do Dono"
  não aparecem mais nos grupos Operação/Relatórios.
- "Extrato Banco" continua no grupo Financeiro.
- Barra inferior (mobile — redimensione a janela do navegador pra largura
  < 1024px): o botão "Painel" agora navega pra `/dashboard`.
- Acessar `/painel-dono` ou `/dashboard-central` diretamente pela URL ainda
  funciona (rota viva, só não está mais no menu).
- Sem erros no console.

---

## Self-Review desta tarefa (preenchido pelo controller antes de dispatch)

**Cobertura da spec:** Visão Geral (Task 3), Financeiro (Task 4), Produtos
(Task 5), Despesas (Task 6 + endpoint Task 1), Operação (Task 7 + endpoint
Task 2), remoção do menu antigo (Task 8, com correção: Movimentações
excluída da lista de remoção por não ser dashboard fragmentado). Todas as
seções da spec têm tarefa correspondente.

**Placeholders:** nenhum "TBD"/"implementar depois" — todo código é
completo e executável como escrito.

**Consistência de tipos:** `brl`/`brlK`/`Card`/`CardHeader`/`KpiCard`/`ChartTooltip`/`CORES`
definidos uma vez em `_shared.jsx` (Task 3) e importados com a mesma
assinatura em todas as tarefas seguintes — conferido nome a nome.
