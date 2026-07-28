# Clientes CRM (RFV + Visão de Conjunto) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar pontuação RFV (Recência/Frequência/Valor) real e uma
aba "Visão Geral" (rankings, saúde da base, lista de ação) à tela de
Clientes, sem alterar o perfil individual já existente além de acrescentar
o RFV nele.

**Architecture:** Um módulo backend novo (`clientesAnalise.js`) calcula o
RFV da base inteira numa única consulta agregada; um endpoint novo expõe
essa análise agregada; o endpoint de perfil individual passa a consumir o
mesmo módulo. No frontend, a tela de Clientes ganha abas — a lista atual
vira uma aba, e uma aba nova mostra a visão de conjunto.

**Tech Stack:** Node/Express, `node:sqlite`, React, Recharts (já é
dependência do frontend).

## Global Constraints

- Sem framework de testes automatizados neste projeto — verificação manual
  via `curl` (JWT autoassinado) e navegador é a convenção estabelecida.
- RFV é calculado sob demanda (sem coluna nova salva em `clientes`) — a
  base é pequena o suficiente pra isso ser rápido a cada request.
- Base pequena (poucos clientes com pedido) faz o cálculo de quintil
  degenerar (todo mundo na mesma nota) — aceitável, não é bug.
- A nomenclatura de segmento (fiel/recorrente/regular/novo/em_risco/inativo)
  usada em `GET /api/clientes/:id/perfil` passa a ser derivada da
  pontuação RFV, substituindo a regra ad-hoc que existe hoje nesse mesmo
  arquivo. **Não mexe** nos chips de filtro da lista em `Clientes.jsx`
  (`SEGMENTOS`: todos/novos/recorrentes/vip/brinde/inativos) — são uma
  coisa diferente (filtro rápido da lista), fora de escopo.
- Segue o estilo visual já usado em `Clientes.jsx` (fundo `#111`, borda
  `#1a1a1a`, `var(--accent)`, `var(--accent-rgb)`) — não introduz um
  design system novo.
- Fora de escopo: "Clientes em potencial" (carrinho abandonado) — não é
  tratado neste plano.

---

## Task 1: Backend — módulo `clientesAnalise.js` + RFV no perfil individual

**Files:**
- Create: `backend/src/lib/clientesAnalise.js`
- Modify: `backend/src/routes/clientes.js` (rota `/:id/perfil`, linhas 88-232 hoje)

**Interfaces:**
- Produces (consumido pela Task 2 e pelo `/:id/perfil` desta mesma tarefa):
  - `calcularBaseRFV()` → array de
    `{ id, nome, telefone, total_gasto, total_pedidos, ticket_medio, dias_desde_ultimo, rfv: {r,f,v,percentil_valor} | null, segmento, recompensas_disponiveis, aniversario }`
    (um item por cliente cadastrado; `rfv` é `null` pra quem nunca fez pedido)
  - `buscarClienteRFV(id)` → um item do array acima (ou `null` se o id não existir)

- [ ] **Step 1: Criar `backend/src/lib/clientesAnalise.js`**

```js
const db = require('../db/database');

// Nota 1-5 por percentil dentro do array ordenado (menor valor = percentil menor).
function notaPorPercentil(ordenados, valor) {
  if (ordenados.length <= 1) return 3;
  let menorIguais = 0;
  for (const v of ordenados) if (v <= valor) menorIguais++;
  const percentil = menorIguais / ordenados.length;
  if (percentil <= 0.2) return 1;
  if (percentil <= 0.4) return 2;
  if (percentil <= 0.6) return 3;
  if (percentil <= 0.8) return 4;
  return 5;
}

function segmentoDeRFV(r, f, v) {
  const media = (r + f + v) / 3;
  if (r <= 2 && (f >= 4 || v >= 4)) return 'em_risco';
  if (media >= 4) return 'fiel';
  if (f >= 3 && r >= 3) return 'recorrente';
  if (r <= 2 && f <= 2) return 'inativo';
  return 'regular';
}

// Calcula RFV (Recência/Frequência/Valor) da base inteira de clientes numa
// única consulta agregada — não faz N+1 (uma query por cliente).
function calcularBaseRFV() {
  const agora = Date.now();

  const agregados = db.prepare(`
    SELECT cliente_telefone AS telefone,
           COUNT(*) AS frequencia,
           SUM(total) AS valor,
           MAX(created_at) AS ultimo_pedido
    FROM pdv_pedidos
    WHERE status != 'cancelado' AND cliente_telefone IS NOT NULL AND cliente_telefone != ''
    GROUP BY cliente_telefone
  `).all();
  const porTelefone = new Map(agregados.map(a => [a.telefone, a]));

  const clientes = db.prepare('SELECT * FROM clientes').all();

  const comHistorico = [];
  const semHistorico = [];
  for (const c of clientes) {
    const ag = porTelefone.get(c.telefone);
    if (!ag) { semHistorico.push(c); continue; }
    const dataUltimo = new Date(ag.ultimo_pedido.replace(' ', 'T') + (ag.ultimo_pedido.endsWith('Z') ? '' : 'Z'));
    const diasDesdeUltimo = Math.floor((agora - dataUltimo.getTime()) / 86400000);
    comHistorico.push({
      cliente: c,
      recencia: diasDesdeUltimo,
      frequencia: ag.frequencia,
      valor: ag.valor,
      ticketMedio: ag.valor / ag.frequencia,
    });
  }

  const recenciasOrdenadas = comHistorico.map(x => x.recencia).sort((a, b) => a - b);
  const frequenciasOrdenadas = comHistorico.map(x => x.frequencia).sort((a, b) => a - b);
  const valoresOrdenados = comHistorico.map(x => x.valor).sort((a, b) => a - b);

  const resultado = comHistorico.map(x => {
    const r = 6 - notaPorPercentil(recenciasOrdenadas, x.recencia); // recência menor = nota maior
    const f = notaPorPercentil(frequenciasOrdenadas, x.frequencia);
    const v = notaPorPercentil(valoresOrdenados, x.valor);
    const percentilValor = valoresOrdenados.length > 1
      ? Math.round((valoresOrdenados.filter(vv => vv <= x.valor).length / valoresOrdenados.length) * 100)
      : 100;
    return {
      id: x.cliente.id, nome: x.cliente.nome, telefone: x.cliente.telefone,
      total_gasto: x.valor, total_pedidos: x.frequencia, ticket_medio: x.ticketMedio,
      dias_desde_ultimo: x.recencia,
      rfv: { r, f, v, percentil_valor: percentilValor },
      segmento: segmentoDeRFV(r, f, v),
      recompensas_disponiveis: x.cliente.recompensas_ganhas - x.cliente.recompensas_usadas,
      aniversario: x.cliente.aniversario,
    };
  });

  for (const c of semHistorico) {
    resultado.push({
      id: c.id, nome: c.nome, telefone: c.telefone,
      total_gasto: 0, total_pedidos: 0, ticket_medio: 0, dias_desde_ultimo: null,
      rfv: null, segmento: 'novo',
      recompensas_disponiveis: c.recompensas_ganhas - c.recompensas_usadas,
      aniversario: c.aniversario,
    });
  }

  return resultado;
}

function buscarClienteRFV(id) {
  const base = calcularBaseRFV();
  return base.find(c => c.id === Number(id)) || null;
}

module.exports = { calcularBaseRFV, buscarClienteRFV };
```

- [ ] **Step 2: Adicionar o RFV ao `GET /api/clientes/:id/perfil`**

Em `backend/src/routes/clientes.js`, adicione o import no topo (depois de
`const db = require('../db/database');`):

```js
const clientesAnalise = require('../lib/clientesAnalise');
```

Dentro da rota `/:id/perfil` (o handler que hoje começa em
`router.get('/:id/perfil', (req, res) => {`), logo antes do `res.json({`
final da rota, adicione:

```js
  const rfvInfo = clientesAnalise.buscarClienteRFV(cliente.id);
```

E dentro do objeto retornado por `res.json({...})`, dentro da chave
`perfil:` já existente, adicione a chave `rfv` como último campo do objeto
`perfil` (mantendo todos os campos que já existem lá):

```js
      tendencia,
      rfv: rfvInfo?.rfv || null,
```

(a linha `tendencia,` já existe no objeto — só adicione `rfv:` logo depois
dela, como mostrado).

- [ ] **Step 3: Verificar manualmente**

Com o backend rodando (`cd backend && npm run dev`), gere um token:
```bash
cd backend && node -e "const jwt=require('jsonwebtoken');require('dotenv').config();console.log(jwt.sign({id:1,usuario:'admin'},process.env.JWT_SECRET,{expiresIn:'20m'}))"
```

Pegue um id de cliente real (`GET /api/clientes` lista todos) e chame:
```bash
curl -s "http://localhost:3001/api/clientes/1/perfil" -H "Authorization: Bearer <TOKEN>"
```

Esperado: a resposta já tinha `perfil.tendencia`, `perfil.segmento` etc. —
confirme que agora também tem `perfil.rfv` com `{r, f, v, percentil_valor}`
(cada nota entre 1 e 5), ou `null` se o cliente não tiver pedidos.

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/clientesAnalise.js backend/src/routes/clientes.js
git commit -m "feat: módulo de RFV (Recência/Frequência/Valor) + expõe no perfil do cliente"
```

---

## Task 2: Backend — endpoint `GET /api/clientes/analise`

**Files:**
- Modify: `backend/src/routes/clientes.js` (nova rota, antes de `module.exports = router;`)

**Interfaces:**
- Consumes: `clientesAnalise.calcularBaseRFV()` (Task 1)
- Produces: `GET /api/clientes/analise` →
  ```json
  {
    "rankings": {
      "porGasto": [{ "id","nome","telefone","total_gasto","total_pedidos" }],
      "porFrequencia": [{ "id","nome","total_pedidos","total_gasto" }],
      "porTicketMedio": [{ "id","nome","ticket_medio","total_pedidos" }]
    },
    "saude": {
      "segmentos": [{ "segmento","qtd","valor_total" }],
      "evolucaoBase": [{ "mes","novos","ativos" }],
      "totalClientes": 0, "totalComPedido": 0
    },
    "acao": {
      "emRisco": [{ "id","nome","telefone","total_gasto","dias_desde_ultimo" }],
      "aniversariosProximos": ["mesmo formato de GET /api/clientes/aniversarios"],
      "brindesParados": [{ "id","nome","telefone","recompensas_disponiveis" }]
    }
  }
  ```

- [ ] **Step 1: Adicionar a rota**

Em `backend/src/routes/clientes.js`, adicione antes de
`module.exports = router;` (final do arquivo):

```js
// ── GET /api/clientes/analise — visão de conjunto da base ─────
router.get('/analise', (req, res) => {
  try {
    const base = clientesAnalise.calcularBaseRFV();
    const comPedido = base.filter(c => c.total_pedidos > 0);

    const porGasto = [...comPedido].sort((a, b) => b.total_gasto - a.total_gasto).slice(0, 10)
      .map(c => ({ id: c.id, nome: c.nome, telefone: c.telefone, total_gasto: c.total_gasto, total_pedidos: c.total_pedidos }));
    const porFrequencia = [...comPedido].sort((a, b) => b.total_pedidos - a.total_pedidos).slice(0, 10)
      .map(c => ({ id: c.id, nome: c.nome, total_pedidos: c.total_pedidos, total_gasto: c.total_gasto }));
    const porTicketMedio = [...comPedido].filter(c => c.total_pedidos >= 2)
      .sort((a, b) => b.ticket_medio - a.ticket_medio).slice(0, 10)
      .map(c => ({ id: c.id, nome: c.nome, ticket_medio: c.ticket_medio, total_pedidos: c.total_pedidos }));

    const segMap = {};
    for (const c of base) {
      if (!segMap[c.segmento]) segMap[c.segmento] = { segmento: c.segmento, qtd: 0, valor_total: 0 };
      segMap[c.segmento].qtd++;
      segMap[c.segmento].valor_total += c.total_gasto;
    }
    const segmentos = Object.values(segMap);

    const hoje = new Date();
    const evolucaoBase = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const novos = db.prepare("SELECT COUNT(*) as n FROM clientes WHERE substr(created_at,1,7) = ?").get(mes).n;
      const ativos = db.prepare("SELECT COUNT(DISTINCT cliente_telefone) as n FROM pdv_pedidos WHERE substr(created_at,1,7) = ? AND status != 'cancelado'").get(mes).n;
      evolucaoBase.push({ mes, novos, ativos });
    }

    const emRisco = base.filter(c => c.segmento === 'em_risco')
      .sort((a, b) => b.total_gasto - a.total_gasto).slice(0, 20)
      .map(c => ({ id: c.id, nome: c.nome, telefone: c.telefone, total_gasto: c.total_gasto, dias_desde_ultimo: c.dias_desde_ultimo }));

    const brindesParados = base.filter(c => c.recompensas_disponiveis > 0)
      .map(c => ({ id: c.id, nome: c.nome, telefone: c.telefone, recompensas_disponiveis: c.recompensas_disponiveis }));

    // Mesma lógica de GET /aniversarios (janela de 30 dias), reaproveitada aqui.
    const rows = db.prepare(
      "SELECT id, nome, telefone, aniversario, total_pedidos FROM clientes WHERE aniversario IS NOT NULL AND aniversario <> ''"
    ).all();
    const hojeSemHora = new Date(); hojeSemHora.setHours(0, 0, 0, 0);
    const aniversariosProximos = [];
    for (const c of rows) {
      const m = /^(\d{2})-(\d{2})$/.exec(c.aniversario);
      if (!m) continue;
      const mesA = Number(m[1]) - 1, diaA = Number(m[2]);
      let prox = new Date(hojeSemHora.getFullYear(), mesA, diaA);
      if (prox < hojeSemHora) prox = new Date(hojeSemHora.getFullYear() + 1, mesA, diaA);
      const faltam = Math.round((prox - hojeSemHora) / 86400000);
      if (faltam <= 30) {
        aniversariosProximos.push({
          id: c.id, nome: c.nome, telefone: c.telefone, total_pedidos: c.total_pedidos,
          aniversario: c.aniversario, dia: diaA, mes: mesA + 1, dias_para: faltam, hoje: faltam === 0,
          data_label: `${String(diaA).padStart(2, '0')}/${String(mesA + 1).padStart(2, '0')}`,
        });
      }
    }
    aniversariosProximos.sort((a, b) => a.dias_para - b.dias_para);

    res.json({
      rankings: { porGasto, porFrequencia, porTicketMedio },
      saude: { segmentos, evolucaoBase, totalClientes: base.length, totalComPedido: comPedido.length },
      acao: { emRisco, aniversariosProximos, brindesParados },
    });
  } catch (e) { console.error('clientes/analise:', e); res.status(500).json({ erro: e.message }); }
});
```

- [ ] **Step 2: Verificar manualmente**

```bash
curl -s "http://localhost:3001/api/clientes/analise" -H "Authorization: Bearer <TOKEN>"
```

Esperado: JSON com `rankings` (3 arrays, cada um até 10 itens),
`saude.segmentos` (array com `segmento`/`qtd`/`valor_total`),
`saude.evolucaoBase` (12 meses), `acao.emRisco`, `acao.aniversariosProximos`,
`acao.brindesParados`. Confira que a soma de `qtd` em `saude.segmentos`
bate com `saude.totalClientes`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/clientes.js
git commit -m "feat: endpoint de análise de conjunto da base de clientes (rankings, saúde, ação)"
```

---

## Task 3: Frontend — abas na tela de Clientes (Visão Geral | Todos os Clientes)

Esta tarefa só reorganiza a tela em abas — não muda nenhum comportamento
do que já existe. A Task 4 preenche a aba nova.

**Files:**
- Modify: `frontend/src/pages/Clientes.jsx`

**Interfaces:**
- Produces: estado `aba` (`'geral' | 'lista'`) no componente `Clientes`,
  usado pela Task 4 pra saber quando renderizar `VisaoGeralClientes`.

- [ ] **Step 1: Adicionar estado de aba e o seletor visual**

Em `frontend/src/pages/Clientes.jsx`, dentro de `export default function
Clientes() {` (linha 691), logo após a linha
`const [modalAniversarios, setModalAniversarios] = useState(false);`
(linha 699), adicione:

```js
  const [aba, setAba] = useState('geral'); // 'geral' | 'lista'
```

Logo depois do bloco do Header (o `<div className="flex items-start
justify-between">...</div>` que tem o `<h1>Clientes</h1>`, terminando
antes do comentário `{/* Cards resumo */}`), adicione o seletor de abas:

```jsx
      {/* Abas */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#111', border: '1px solid #1a1a1a', width: 'fit-content' }}>
        {[{ id: 'geral', label: 'Visão Geral' }, { id: 'lista', label: 'Todos os Clientes' }].map(t => (
          <button key={t.id} onClick={() => setAba(t.id)}
            className="px-4 py-2 rounded-lg text-xs font-bold transition-all"
            style={aba === t.id
              ? { background: 'rgba(var(--accent-rgb),0.15)', color: 'var(--accent)' }
              : { color: '#666' }}>
            {t.label}
          </button>
        ))}
      </div>
```

- [ ] **Step 2: Envolver o conteúdo existente na aba "lista"**

Tudo que hoje vem depois do seletor de abas — do comentário
`{/* Cards resumo */}` (logo antes de `<div className="grid grid-cols-3
gap-3">`) até o fechamento do bloco da lista (a linha `)}` que fecha
`{loading ? (...) : filtrados.length === 0 ? (...) : (<div
className="space-y-2">...</div>)}`, imediatamente antes do comentário
`{/* Modal detalhe */}` — precisa ficar dentro de `{aba === 'lista' &&
(<>...</>)}`.

Ou seja: adicione `{aba === 'lista' && (<>` imediatamente antes do
comentário `{/* Cards resumo */}`, e feche com `</>)}` imediatamente
depois do bloco da lista (antes do comentário `{/* Modal detalhe */}`).
Os dois modais (`ModalCliente` e `ModalAniversarios`, já no final do
componente) **ficam fora** dessa condicional — continuam podendo abrir
não importa qual aba está ativa.

Adicione também, no mesmo lugar (antes do fechamento `</>)}`, um
placeholder temporário para a aba nova — será substituído na Task 4:
```jsx
      {aba === 'geral' && (
        <div className="py-20 text-center text-zinc-600">Em breve</div>
      )}
```
(Esse placeholder existe só entre o fim desta tarefa e o início da Task 4
— a Task 4 substitui esse bloco pelo componente de verdade.)

- [ ] **Step 3: Verificar no navegador**

Abra `/clientes`. Confirme: duas abas aparecem, "Visão Geral" ativa por
padrão mostra "Em breve", clicar em "Todos os Clientes" mostra exatamente
o que a tela já mostrava antes desta tarefa (cards resumo, aniversários,
chips, busca, lista) — sem nenhuma mudança de comportamento. Clicar num
cliente da lista ainda abre o modal normalmente. Sem erros no console.

Se o Browser pane não responder (problema de ferramenta já visto nesta
sessão, não do código), verifique por leitura direta do arquivo que a
condicional `{aba === 'lista' && (...)}` engloba exatamente o bloco
descrito no Step 2 — nada a mais, nada a menos — e rode
`cd frontend && npx eslint src/pages/Clientes.jsx` (deve dar 0 erros).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/Clientes.jsx
git commit -m "feat: abas Visão Geral / Todos os Clientes na tela de Clientes"
```

---

## Task 4: Frontend — `VisaoGeralClientes.jsx` (rankings, saúde, ação)

**Files:**
- Create: `frontend/src/pages/clientes/VisaoGeralClientes.jsx`
- Modify: `frontend/src/pages/Clientes.jsx` (substitui o placeholder "Em breve" da Task 3)

**Interfaces:**
- Consumes: `GET /api/clientes/analise` (Task 2)
- Consumes props: `onAbrirCliente(id)` — callback pra abrir o
  `ModalCliente` já existente em `Clientes.jsx` a partir de um clique num
  ranking/lista de ação (evita duplicar o modal).

- [ ] **Step 1: Criar `frontend/src/pages/clientes/VisaoGeralClientes.jsx`**

```jsx
import React, { useState, useEffect } from 'react';
import { getToken } from '../../hooks/useAuth';
import {
  Trophy, TrendingUp, TrendingDown, AlertTriangle, Gift, Cake, Users,
  MessageCircle, Crown, Repeat, Star, Sparkles, MoonStar,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });
const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const SEGMENTO_CFG = {
  fiel:       { label: 'Fiel',       cor: '#f59e0b', Icon: Crown },
  recorrente: { label: 'Recorrente', cor: '#10b981', Icon: Repeat },
  regular:    { label: 'Regular',    cor: '#3b82f6', Icon: Star },
  novo:       { label: 'Novo',       cor: '#8b5cf6', Icon: Sparkles },
  em_risco:   { label: 'Em risco',   cor: '#f97316', Icon: TrendingDown },
  inativo:    { label: 'Inativo',    cor: '#6b7280', Icon: MoonStar },
};

function Card({ children, titulo, Icon, cor }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
      {titulo && (
        <h3 className="text-sm font-black mb-3 flex items-center gap-2" style={{ color: 'var(--cor-texto, #fff)' }}>
          {Icon && <Icon size={15} strokeWidth={1.75} style={{ color: cor || 'var(--accent)' }} />} {titulo}
        </h3>
      )}
      {children}
    </div>
  );
}

function ListaRanking({ itens, campo, formatador, onAbrirCliente }) {
  if (!itens.length) return <p className="text-xs text-center py-6" style={{ color: '#555' }}>Sem dados ainda</p>;
  return (
    <div className="space-y-1.5">
      {itens.map((c, i) => (
        <button key={c.id} onClick={() => onAbrirCliente(c.id)}
          className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left transition-colors hover:bg-white/[0.03]">
          <span className="w-5 text-[11px] font-black shrink-0" style={{ color: i < 3 ? '#f59e0b' : '#555' }}>{i + 1}º</span>
          <span className="flex-1 min-w-0 text-xs font-bold truncate" style={{ color: '#ddd' }}>{c.nome}</span>
          <span className="text-xs font-black shrink-0" style={{ color: 'var(--accent)' }}>{formatador(c[campo])}</span>
        </button>
      ))}
    </div>
  );
}

export default function VisaoGeralClientes({ onAbrirCliente }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE}/clientes/analise`, { headers: authH() })
      .then(r => r.json()).then(setDados).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="py-20 text-center text-zinc-600 animate-pulse">Carregando visão geral…</div>;
  if (!dados) return <div className="py-20 text-center text-zinc-600">Erro ao carregar</div>;

  const { rankings, saude, acao } = dados;
  const evolucaoChart = saude.evolucaoBase.map(e => ({
    mes: e.mes.slice(5, 7) + '/' + e.mes.slice(2, 4), novos: e.novos, ativos: e.ativos,
  }));

  return (
    <div className="space-y-4">
      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card titulo="Top 10 · Maior gasto" Icon={Trophy} cor="#f59e0b">
          <ListaRanking itens={rankings.porGasto} campo="total_gasto" formatador={brl} onAbrirCliente={onAbrirCliente} />
        </Card>
        <Card titulo="Top 10 · Mais pedidos" Icon={Repeat} cor="#10b981">
          <ListaRanking itens={rankings.porFrequencia} campo="total_pedidos" formatador={v => `${v}×`} onAbrirCliente={onAbrirCliente} />
        </Card>
        <Card titulo="Top 10 · Maior ticket médio" Icon={TrendingUp} cor="var(--accent)">
          <ListaRanking itens={rankings.porTicketMedio} campo="ticket_medio" formatador={brl} onAbrirCliente={onAbrirCliente} />
        </Card>
      </div>

      {/* Saúde da base */}
      <Card titulo="Saúde da base" Icon={Users}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
          {Object.entries(SEGMENTO_CFG).map(([chave, cfg]) => {
            const s = saude.segmentos.find(x => x.segmento === chave);
            return (
              <div key={chave} className="rounded-xl p-2.5" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                <cfg.Icon size={14} strokeWidth={1.75} style={{ color: cfg.cor }} />
                <p className="text-lg font-black mt-1" style={{ color: '#fff' }}>{s?.qtd || 0}</p>
                <p className="text-[10px]" style={{ color: '#666' }}>{cfg.label}</p>
                <p className="text-[10px] font-bold" style={{ color: cfg.cor }}>{brl(s?.valor_total || 0)}</p>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] mb-2" style={{ color: '#666' }}>Clientes novos vs. ativos por mês (12 meses)</p>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={evolucaoChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
            <XAxis dataKey="mes" tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#555', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: 8, fontSize: 11 }} />
            <Line type="monotone" dataKey="novos" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Novos" />
            <Line type="monotone" dataKey="ativos" stroke="#10b981" strokeWidth={2} dot={false} name="Ativos" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Lista de ação */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card titulo={`Em risco (${acao.emRisco.length})`} Icon={AlertTriangle} cor="#f97316">
          {acao.emRisco.length === 0 ? <p className="text-xs text-center py-6" style={{ color: '#555' }}>Nenhum</p> : (
            <div className="space-y-1.5">
              {acao.emRisco.slice(0, 8).map(c => (
                <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: '#0a0a0a' }}>
                  <button onClick={() => onAbrirCliente(c.id)} className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-bold truncate" style={{ color: '#ddd' }}>{c.nome}</p>
                    <p className="text-[10px]" style={{ color: '#666' }}>{brl(c.total_gasto)} · {c.dias_desde_ultimo}d sumido</p>
                  </button>
                  <a href={`https://wa.me/55${c.telefone}`} target="_blank" rel="noreferrer"
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg" style={{ background: 'rgba(16,185,129,0.12)' }}>
                    <MessageCircle size={13} strokeWidth={1.75} style={{ color: '#10b981' }} />
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card titulo={`Aniversários (${acao.aniversariosProximos.length})`} Icon={Cake} cor="#ec4899">
          {acao.aniversariosProximos.length === 0 ? <p className="text-xs text-center py-6" style={{ color: '#555' }}>Nenhum nos próximos 30 dias</p> : (
            <div className="space-y-1.5">
              {acao.aniversariosProximos.slice(0, 8).map(a => (
                <button key={a.id} onClick={() => onAbrirCliente(a.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left" style={{ background: '#0a0a0a' }}>
                  <span className="text-xs font-bold truncate" style={{ color: '#ddd' }}>{a.nome}</span>
                  <span className="text-[10px] font-bold shrink-0" style={{ color: a.hoje ? '#ec4899' : '#666' }}>
                    {a.hoje ? 'HOJE' : a.data_label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
        <Card titulo={`Brindes parados (${acao.brindesParados.length})`} Icon={Gift} cor="#eab308">
          {acao.brindesParados.length === 0 ? <p className="text-xs text-center py-6" style={{ color: '#555' }}>Nenhum</p> : (
            <div className="space-y-1.5">
              {acao.brindesParados.slice(0, 8).map(c => (
                <button key={c.id} onClick={() => onAbrirCliente(c.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left" style={{ background: '#0a0a0a' }}>
                  <span className="text-xs font-bold truncate" style={{ color: '#ddd' }}>{c.nome}</span>
                  <span className="text-[10px] font-bold shrink-0" style={{ color: '#eab308' }}>{c.recompensas_disponiveis}×</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Ligar o componente em `Clientes.jsx`**

Em `frontend/src/pages/Clientes.jsx`, adicione o import perto dos outros
imports de componentes locais (topo do arquivo):

```js
import VisaoGeralClientes from './clientes/VisaoGeralClientes';
```

Substitua o placeholder criado na Task 3 (`{aba === 'geral' && (<div
className="py-20 text-center text-zinc-600">Em breve</div>)}`) por:

```jsx
      {aba === 'geral' && (
        <VisaoGeralClientes onAbrirCliente={id => {
          const c = clientes.find(x => x.id === id);
          if (c) setClienteSelecionado(c);
        }} />
      )}
```

(`clientes` e `setClienteSelecionado` já existem no componente `Clientes`
— reaproveita o mesmo `ModalCliente` já renderizado no final do arquivo,
não abre um modal novo.)

- [ ] **Step 3: Verificar no navegador**

Abra `/clientes`, aba "Visão Geral" (padrão). Confirme: 3 rankings
aparecem (ou "Sem dados ainda" se a base local não tiver pedidos
suficientes), cards de saúde da base com contagem por segmento, gráfico de
novos vs. ativos por mês, as 3 listas de ação. Clicar num nome em
qualquer lista abre o `ModalCliente` do cliente certo. Sem erros no
console.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/clientes/VisaoGeralClientes.jsx frontend/src/pages/Clientes.jsx
git commit -m "feat: aba Visão Geral de Clientes (rankings, saúde da base, lista de ação)"
```

---

## Task 5: Frontend — RFV numérico no perfil individual (`ModalCliente`)

**Files:**
- Modify: `frontend/src/pages/Clientes.jsx` (dentro de `ModalCliente`, aba "Perfil")

**Interfaces:**
- Consumes: `perfil.rfv` (`{r, f, v, percentil_valor} | null`), já vindo
  de `GET /api/clientes/:id/perfil` desde a Task 1.

- [ ] **Step 1: Adicionar o bloco de RFV**

Em `frontend/src/pages/Clientes.jsx`, dentro de `ModalCliente`, na aba
"Perfil" (`aba === 'perfil'`), logo depois do bloco de KPIs (o `grid` com
"Total gasto", "Ticket médio", "Pedidos", "Últ. pedido" — procure a linha
com `{ label: 'Total gasto',   val: brl(perfil.totalGasto), ...`) e antes
do bloco de tendência (`{perfil.tendencia === 'subindo' ...`), adicione:

```jsx
              {perfil.rfv && (
                <div className="rounded-2xl p-4" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
                  <p className="text-xs font-bold mb-3" style={{ color: '#888' }}>RFV — comparado com a base inteira</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Recência', nota: perfil.rfv.r },
                      { label: 'Frequência', nota: perfil.rfv.f },
                      { label: 'Valor', nota: perfil.rfv.v },
                    ].map(x => (
                      <div key={x.label} className="text-center">
                        <p className="text-2xl font-black" style={{ color: x.nota >= 4 ? '#10b981' : x.nota <= 2 ? '#ef4444' : 'var(--accent)' }}>{x.nota}</p>
                        <p className="text-[10px]" style={{ color: '#666' }}>{x.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] mt-3 text-center" style={{ color: '#666' }}>
                    Valor gasto: top {100 - perfil.rfv.percentil_valor}% da base
                  </p>
                </div>
              )}
```

- [ ] **Step 2: Verificar no navegador**

Abra `/clientes`, clique num cliente que tenha pedidos registrados.
Confirme: o bloco "RFV — comparado com a base inteira" aparece com 3
notas (1-5) e a frase de percentil. Clique num cliente sem nenhum pedido
(se existir um assim na base local): o bloco não aparece (sem erro).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Clientes.jsx
git commit -m "feat: mostra RFV numérico no perfil individual do cliente"
```

---

## Self-Review desta tarefa (preenchido pelo controller antes de dispatch)

**Cobertura da spec:** RFV real (Task 1 + 5), rankings (Task 4), saúde da
base (Task 4), lista de ação (Task 4), endpoint agregado (Task 2), sem
duplicar o modal de perfil (Task 4 reaproveita via `onAbrirCliente`).
Todos os itens da spec têm tarefa correspondente. "Clientes em potencial"
fica de fora, conforme decidido.

**Placeholders:** nenhum "TBD"/"implementar depois" — todo código é
completo e executável como escrito. O único "placeholder" textual (Task 3
Step 2, texto "Em breve") é intencional e documentado como temporário,
substituído na Task 4 Step 2 — não é um placeholder de especificação
incompleta.

**Consistência de tipos:** `calcularBaseRFV()`/`buscarClienteRFV()`
definidos uma vez (Task 1) e consumidos com a mesma assinatura pela Task 2
(`/analise`) e já embutidos no `/:id/perfil` da própria Task 1. O shape
`{r, f, v, percentil_valor}` é usado identicamente no backend (Task 1) e
no frontend (Task 5). `onAbrirCliente(id)` tem a mesma assinatura entre
quem produz (Task 4, `VisaoGeralClientes`) e quem consome (Task 4 Step 2,
`Clientes.jsx`).
