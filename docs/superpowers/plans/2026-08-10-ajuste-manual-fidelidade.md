# Ajuste Manual de Fidelidade (Selos + Cashback) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao dono a capacidade de conceder/revogar brindes do cartão de
fidelidade e adicionar/remover saldo de cashback, por cliente, direto na
ficha do cliente (`/clientes`).

**Architecture:** Uma coluna nova (`recompensas_bonus`) desacopla o ajuste
manual do recálculo automático que roda em todo pedido real do PDV. Dois
endpoints novos em `clientes.js` (conceder/revogar + histórico). O cashback
não precisa de endpoint novo — `POST /cashback/creditar` e
`POST /cashback/estornar` já existem; só falta interface. Tudo fica na aba
"Fidelidade" já existente na ficha do cliente, mais um toggle na tela
global de Cashback.

**Tech Stack:** Node/Express, `node:sqlite`, React, `react-hot-toast`.

## Global Constraints

- Sem framework de testes automatizados neste projeto — verificação manual
  via `curl` (JWT autoassinado) e navegador é a convenção estabelecida.
- Motivo é obrigatório em todo ajuste manual (selos e cashback) — é o que
  explica o ajuste depois, no histórico.
- Nenhum ajuste pode deixar o saldo disponível (brindes ou cashback)
  negativo. Validado no backend; refletido na UI.
- `recompensas_ganhas` é recalculado do zero em todo pedido real
  (`pdv.js:571-574`, `Math.floor(total_pedidos / 10)`) — **não tocar nesse
  arquivo nem nessa fórmula**. O ajuste manual vive inteiramente na coluna
  nova `recompensas_bonus`, que o `pdv.js` nunca escreve.
- Sem campo de "quem ajustou" — o sistema não tem múltiplos usuários hoje.
- Segue o estilo visual já usado em `Clientes.jsx` (classes Tailwind,
  variáveis `--space-elev`, `--hairline`, `--accent-rgb`, `t-dim`) — não
  introduz um design system novo. `Cashback.jsx` usa inline styles com
  paleta `#1e293b`/`#0f172a` própria — mantém esse estilo ali.

---

## Task 1: Backend — coluna `recompensas_bonus` + cálculo de disponíveis

**Files:**
- Modify: `backend/src/routes/cardapio.js:154` (migração da tabela `clientes`)
- Modify: `backend/src/routes/clientes.js:1-18` (helpers `calcFidelidade`/`comFidelidade`) e `:249-261` (`/resgatar`)

**Interfaces:**
- Produces (consumido pelas Tasks 2, 3, 4): `calcFidelidade(total_pedidos, recompensas_ganhas, recompensas_usadas, recompensas_bonus = 0)` retorna
  `{ total_pedidos, recompensas_ganhas, recompensas_usadas, recompensas_bonus, recompensas_disponiveis, pedidos_no_ciclo, proximo_em }`
  onde `recompensas_disponiveis = (recompensas_ganhas + recompensas_bonus) - recompensas_usadas`.
- Produces: `comFidelidade(cliente)` — mesmo formato de sempre, `cliente.fidelidade` agora inclui `recompensas_bonus`.

- [ ] **Step 1: Adicionar a coluna via migração**

Em `backend/src/routes/cardapio.js`, logo após a linha 154
(`try { db.exec('ALTER TABLE clientes ADD COLUMN bairro TEXT'); } catch {}`),
adicionar:

```js
try { db.exec('ALTER TABLE clientes ADD COLUMN recompensas_bonus INTEGER DEFAULT 0'); } catch {}
```

- [ ] **Step 2: Atualizar `calcFidelidade` e `comFidelidade`**

Em `backend/src/routes/clientes.js`, substituir as linhas 9-18:

```js
function calcFidelidade(total_pedidos, recompensas_ganhas, recompensas_usadas) {
  const recompensas_disponiveis = recompensas_ganhas - recompensas_usadas;
  const pedidos_no_ciclo = total_pedidos % PEDIDOS_POR_RECOMPENSA;
  const proximo_em = PEDIDOS_POR_RECOMPENSA - pedidos_no_ciclo;
  return { total_pedidos, recompensas_ganhas, recompensas_usadas, recompensas_disponiveis, pedidos_no_ciclo, proximo_em };
}

function comFidelidade(c) {
  return { ...c, fidelidade: calcFidelidade(c.total_pedidos, c.recompensas_ganhas, c.recompensas_usadas) };
}
```

por:

```js
function calcFidelidade(total_pedidos, recompensas_ganhas, recompensas_usadas, recompensas_bonus = 0) {
  const recompensas_disponiveis = (recompensas_ganhas + recompensas_bonus) - recompensas_usadas;
  const pedidos_no_ciclo = total_pedidos % PEDIDOS_POR_RECOMPENSA;
  const proximo_em = PEDIDOS_POR_RECOMPENSA - pedidos_no_ciclo;
  return { total_pedidos, recompensas_ganhas, recompensas_usadas, recompensas_bonus, recompensas_disponiveis, pedidos_no_ciclo, proximo_em };
}

function comFidelidade(c) {
  return { ...c, fidelidade: calcFidelidade(c.total_pedidos, c.recompensas_ganhas, c.recompensas_usadas, c.recompensas_bonus || 0) };
}
```

- [ ] **Step 3: Atualizar o guard de `/resgatar` pra considerar o bônus**

Em `backend/src/routes/clientes.js`, dentro de `router.post('/:id/resgatar', ...)`
(linha 253), trocar:

```js
  const disponiveis = cliente.recompensas_ganhas - cliente.recompensas_usadas;
```

por:

```js
  const disponiveis = (cliente.recompensas_ganhas + (cliente.recompensas_bonus || 0)) - cliente.recompensas_usadas;
```

- [ ] **Step 4: Rodar o backend e confirmar que a coluna foi criada**

```bash
cd backend && npm run dev
```

Em outro terminal:

```bash
cd backend && node -e "const db=require('./src/db/database'); console.log(db.prepare(\"PRAGMA table_info(clientes)\").all().find(c => c.name === 'recompensas_bonus'))"
```

Esperado: imprime `{ cid: ..., name: 'recompensas_bonus', type: 'INTEGER', ... dflt_value: '0', ... }` (não `undefined`).

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/cardapio.js backend/src/routes/clientes.js
git commit -m "feat: coluna recompensas_bonus desacopla ajuste manual do recálculo automático de fidelidade"
```

---

## Task 2: Backend — endpoints de ajuste manual de brindes

**Files:**
- Modify: `backend/src/routes/clientes.js` (adiciona migração da tabela de auditoria + duas rotas novas)

**Interfaces:**
- Consumes: `comFidelidade` da Task 1.
- Produces (consumido pela Task 4):
  - `POST /api/clientes/:id/fidelidade/ajustar` body `{ delta: number, motivo: string }` →
    `200 { ok: true, cliente: <comFidelidade> }` ou `400 { erro: string }` ou `404 { erro: string }`.
  - `GET /api/clientes/:id/fidelidade/ajustes` → `200` array de
    `{ id, cliente_id, delta, motivo, created_at }`, mais recente primeiro, máx. 50.

- [ ] **Step 1: Adicionar a migração da tabela de auditoria**

Em `backend/src/routes/clientes.js`, logo após os `require`s (linha 3,
antes de `const router = Router();`), adicionar:

```js

// ── Migração: histórico de ajustes manuais de fidelidade ──────
db.exec(`
  CREATE TABLE IF NOT EXISTS clientes_fidelidade_ajustes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    delta INTEGER NOT NULL,
    motivo TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);
```

- [ ] **Step 2: Adicionar as duas rotas**

Em `backend/src/routes/clientes.js`, logo após o fim de
`router.post('/:id/resgatar', ...)` (depois da linha `});` que fecha essa
rota, adicionar:

```js

// POST /api/clientes/:id/fidelidade/ajustar — concede (delta>0) ou revoga (delta<0) brindes manualmente
router.post('/:id/fidelidade/ajustar', (req, res) => {
  const { delta, motivo } = req.body;
  const d = parseInt(delta, 10);
  if (!Number.isInteger(d) || d === 0) return res.status(400).json({ erro: 'delta deve ser um número inteiro diferente de zero' });
  if (!motivo || !String(motivo).trim()) return res.status(400).json({ erro: 'Motivo é obrigatório' });

  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

  const novoBonus = (cliente.recompensas_bonus || 0) + d;
  const disponiveisApos = (cliente.recompensas_ganhas + novoBonus) - cliente.recompensas_usadas;
  if (disponiveisApos < 0) {
    return res.status(400).json({ erro: 'Isso deixaria o saldo de brindes negativo' });
  }

  db.prepare('UPDATE clientes SET recompensas_bonus = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(novoBonus, cliente.id);
  db.prepare('INSERT INTO clientes_fidelidade_ajustes (cliente_id, delta, motivo) VALUES (?, ?, ?)').run(cliente.id, d, String(motivo).trim());

  const atualizado = db.prepare('SELECT * FROM clientes WHERE id = ?').get(cliente.id);
  res.json({ ok: true, cliente: comFidelidade(atualizado) });
});

// GET /api/clientes/:id/fidelidade/ajustes — histórico de ajustes manuais
router.get('/:id/fidelidade/ajustes', (req, res) => {
  const ajustes = db.prepare(
    'SELECT * FROM clientes_fidelidade_ajustes WHERE cliente_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.params.id);
  res.json(ajustes);
});
```

- [ ] **Step 3: Gerar um token de teste**

```bash
cd backend && node -e "const jwt=require('jsonwebtoken');require('dotenv').config();console.log(jwt.sign({id:1,usuario:'admin'},process.env.JWT_SECRET,{expiresIn:'20m'}))"
```

Copiar o token impresso pra usar nos próximos steps como `<TOKEN>`.

- [ ] **Step 4: Testar conceder um brinde**

Pegar o id de um cliente existente:

```bash
curl -s "http://localhost:3001/api/clientes" -H "Authorization: Bearer <TOKEN>" | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d)[0]))"
```

Anotar o `id` retornado (`<CLIENTE_ID>`) e o `recompensas_bonus` atual
(deve ser `0`). Conceder 1 brinde:

```bash
curl -s -X POST "http://localhost:3001/api/clientes/<CLIENTE_ID>/fidelidade/ajustar" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"delta": 1, "motivo": "teste do plano"}'
```

Esperado: `200` com `cliente.recompensas_bonus: 1` e
`cliente.fidelidade.recompensas_disponiveis` incluindo esse +1.

- [ ] **Step 5: Testar a trava de saldo negativo**

Com o mesmo cliente (que agora tem no máximo 1 brinde disponível via
bônus, supondo 0 ganhos orgânicos), tentar revogar 5:

```bash
curl -s -X POST "http://localhost:3001/api/clientes/<CLIENTE_ID>/fidelidade/ajustar" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"delta": -5, "motivo": "teste trava"}'
```

Esperado: `400 { "erro": "Isso deixaria o saldo de brindes negativo" }`.

- [ ] **Step 6: Testar motivo obrigatório**

```bash
curl -s -X POST "http://localhost:3001/api/clientes/<CLIENTE_ID>/fidelidade/ajustar" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"delta": 1, "motivo": ""}'
```

Esperado: `400 { "erro": "Motivo é obrigatório" }`.

- [ ] **Step 7: Conferir o histórico**

```bash
curl -s "http://localhost:3001/api/clientes/<CLIENTE_ID>/fidelidade/ajustes" -H "Authorization: Bearer <TOKEN>"
```

Esperado: array com o ajuste de +1 do Step 4 (o de -5 e o de motivo vazio
do Step 5/6 não devem aparecer — foram rejeitados antes de gravar).

- [ ] **Step 8: Reverter o ajuste de teste**

```bash
curl -s -X POST "http://localhost:3001/api/clientes/<CLIENTE_ID>/fidelidade/ajustar" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"delta": -1, "motivo": "revertendo teste do plano"}'
```

- [ ] **Step 9: Commit**

```bash
git add backend/src/routes/clientes.js
git commit -m "feat: endpoints para conceder/revogar brindes manualmente com auditoria"
```

---

## Task 3: Backend — `clientesAnalise.js` passa a contar o bônus

**Files:**
- Modify: `backend/src/lib/clientesAnalise.js:76,86`

**Interfaces:**
- Consumes: coluna `recompensas_bonus` da Task 1.
- Produces: nenhuma interface nova — corrige um valor que `GET /api/clientes/analise`
  (usado pela aba "Visão Geral" de Clientes e por `acao.brindesParados`)
  já expõe.

**Contexto:** esse arquivo recalcula `recompensas_disponiveis` de forma
independente de `calcFidelidade` (é otimizado pra base inteira numa
query só). Sem esse fix, um cliente que só tem saldo via bônus manual não
apareceria na lista de "brindes parados" do dashboard.

- [ ] **Step 1: Corrigir as duas ocorrências**

Em `backend/src/lib/clientesAnalise.js`, linha 76, trocar:

```js
      recompensas_disponiveis: x.cliente.recompensas_ganhas - x.cliente.recompensas_usadas,
```

por:

```js
      recompensas_disponiveis: (x.cliente.recompensas_ganhas + (x.cliente.recompensas_bonus || 0)) - x.cliente.recompensas_usadas,
```

E na linha 86:

```js
      recompensas_disponiveis: c.recompensas_ganhas - c.recompensas_usadas,
```

por:

```js
      recompensas_disponiveis: (c.recompensas_ganhas + (c.recompensas_bonus || 0)) - c.recompensas_usadas,
```

- [ ] **Step 2: Testar com o cliente ajustado**

Conceder 1 brinde de novo num cliente sem pedidos (usar o mesmo fluxo do
Task 2 Step 4, sem reverter dessa vez), depois:

```bash
curl -s "http://localhost:3001/api/clientes/analise" -H "Authorization: Bearer <TOKEN>" | node -e "process.stdin.on('data',d=>{const j=JSON.parse(d);console.log(j.acao.brindesParados)})"
```

Esperado: o cliente ajustado aparece na lista `brindesParados`.

- [ ] **Step 3: Reverter o ajuste de teste**

```bash
curl -s -X POST "http://localhost:3001/api/clientes/<CLIENTE_ID>/fidelidade/ajustar" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"delta": -1, "motivo": "revertendo teste do plano"}'
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/clientesAnalise.js
git commit -m "fix: clientesAnalise considera recompensas_bonus no cálculo de brindes disponíveis"
```

---

## Task 4: Frontend — ficha do cliente: ajuste de selos + cashback + histórico

**Files:**
- Modify: `frontend/src/pages/Clientes.jsx`

**Interfaces:**
- Consumes:
  - `POST /api/clientes/:id/fidelidade/ajustar` e `GET /api/clientes/:id/fidelidade/ajustes` (Task 2)
  - `GET /api/cashback/saldo/:telefone`, `POST /api/cashback/creditar`, `POST /api/cashback/estornar`, `GET /api/cashback/historico/:telefone` (já existem, sem mudança)
- Produces: nenhuma interface nova exposta a outros arquivos — mudança de UI isolada em `ModalCliente`.

**Contexto importante:** hoje a aba Fidelidade só renderiza se o cliente
tiver pelo menos 1 pedido real (`!perfil` esconde a aba inteira). Isso
bloquearia o ajuste manual justamente para o caso mais comum de uso —
compensar ou premiar um cliente que ainda não tem pedido registrado no
PDV. O Step 1 corrige isso antes de adicionar a UI nova.

- [ ] **Step 1: Não esconder a aba Fidelidade quando o cliente não tem pedidos**

Em `frontend/src/pages/Clientes.jsx`, linha 256, trocar:

```jsx
          ) : aba !== 'dados' && !perfil ? (
```

por:

```jsx
          ) : aba !== 'dados' && aba !== 'fidelidade' && !perfil ? (
```

- [ ] **Step 2: Corrigir `ehComBrinde` e `temBrinde` pra considerar o bônus**

Em `frontend/src/pages/Clientes.jsx`, linha 752, trocar:

```jsx
  const ehComBrinde   = c => (c.recompensas_ganhas - c.recompensas_usadas) > 0;
```

por:

```jsx
  const ehComBrinde   = c => (c.fidelidade?.recompensas_disponiveis || 0) > 0;
```

E na linha 917 (dentro do `.map(c => {` da lista), trocar:

```jsx
            const temBrinde = (c.recompensas_ganhas - c.recompensas_usadas) > 0;
```

por:

```jsx
            const temBrinde = (fid.recompensas_disponiveis || 0) > 0;
```

(`fid` já está disponível na linha anterior: `const fid = c.fidelidade || {};`)

- [ ] **Step 3: Adicionar estado e busca de saldo de cashback em `ModalCliente`**

Em `frontend/src/pages/Clientes.jsx`, dentro de `function ModalCliente(...)`
(linha 62-69), trocar o bloco de `useState`s:

```jsx
  const [dados, setDados] = useState(null);
  const [promocoes, setPromocoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resgatando, setResgatando] = useState(null);
  const [aba, setAba] = useState('perfil'); // 'perfil' | 'historico' | 'fidelidade' | 'dados'
  const [editDados, setEditDados] = useState({ nome: cliente.nome || '', endereco: cliente.endereco || '', bairro: cliente.bairro || '', email: cliente.email || '', observacao: cliente.observacao || '', aniversario: cliente.aniversario ? cliente.aniversario.split('-').reverse().join('/') : '' });
  const [salvandoDados, setSalvandoDados] = useState(false);
```

por (acrescentando os novos estados no final):

```jsx
  const [dados, setDados] = useState(null);
  const [promocoes, setPromocoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resgatando, setResgatando] = useState(null);
  const [aba, setAba] = useState('perfil'); // 'perfil' | 'historico' | 'fidelidade' | 'dados'
  const [editDados, setEditDados] = useState({ nome: cliente.nome || '', endereco: cliente.endereco || '', bairro: cliente.bairro || '', email: cliente.email || '', observacao: cliente.observacao || '', aniversario: cliente.aniversario ? cliente.aniversario.split('-').reverse().join('/') : '' });
  const [salvandoDados, setSalvandoDados] = useState(false);
  const [ajusteQtd, setAjusteQtd] = useState(1);
  const [ajusteMotivo, setAjusteMotivo] = useState('');
  const [ajustando, setAjustando] = useState(false);
  const [cashbackSaldo, setCashbackSaldo] = useState(null);
  const [cbValor, setCbValor] = useState('');
  const [cbMotivo, setCbMotivo] = useState('');
  const [cbOperando, setCbOperando] = useState(false);
  const [historicoAjustes, setHistoricoAjustes] = useState(null); // null = não carregado ainda
  const [carregandoHist, setCarregandoHist] = useState(false);
```

Em seguida, trocar o `useEffect` de carregamento inicial (linhas 71-77):

```jsx
  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/clientes/${cliente.id}/perfil`, { headers: authH() }).then(r => r.ok ? r.json() : null),
      fetch(`${BASE}/promocoes/cliente/${cliente.id}`, { headers: authH() }).then(r => r.ok ? r.json() : []),
    ]).then(([d, pr]) => { setDados(d); setPromocoes(pr); setLoading(false); })
      .catch(() => setLoading(false));
  }, [cliente.id]);
```

por:

```jsx
  useEffect(() => {
    Promise.all([
      fetch(`${BASE}/clientes/${cliente.id}/perfil`, { headers: authH() }).then(r => r.ok ? r.json() : null),
      fetch(`${BASE}/promocoes/cliente/${cliente.id}`, { headers: authH() }).then(r => r.ok ? r.json() : []),
      fetch(`${BASE}/cashback/saldo/${cliente.telefone}`, { headers: authH() }).then(r => r.ok ? r.json() : null),
    ]).then(([d, pr, cb]) => { setDados(d); setPromocoes(pr); setCashbackSaldo(cb); setLoading(false); })
      .catch(() => setLoading(false));
  }, [cliente.id, cliente.telefone]);
```

- [ ] **Step 4: Adicionar as funções de ajuste**

Em `frontend/src/pages/Clientes.jsx`, localizar a função `handleResgatar`
completa (por volta da linha 106-119):

```jsx
  async function handleResgatar() {
    const fid = dados?.cliente?.fidelidade;
    if (!fid || fid.recompensas_disponiveis <= 0) return;
    setResgatando('fid');
    try {
      const res = await fetch(`${BASE}/clientes/${cliente.id}/resgatar`, { method: 'POST', headers: authH() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Erro');
      toast.success('🎁 Brinde resgatado com sucesso!');
      onResgatar(data.cliente);
      setDados(prev => ({ ...prev, cliente: { ...prev.cliente, ...data.cliente } }));
    } catch (err) { toast.error(err.message); }
    setResgatando(null);
  }
```

Substituir por ela mesma seguida das funções novas (não muda nada da
função original, só acrescenta depois):

```jsx
  async function handleResgatar() {
    const fid = dados?.cliente?.fidelidade;
    if (!fid || fid.recompensas_disponiveis <= 0) return;
    setResgatando('fid');
    try {
      const res = await fetch(`${BASE}/clientes/${cliente.id}/resgatar`, { method: 'POST', headers: authH() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erro || 'Erro');
      toast.success('🎁 Brinde resgatado com sucesso!');
      onResgatar(data.cliente);
      setDados(prev => ({ ...prev, cliente: { ...prev.cliente, ...data.cliente } }));
    } catch (err) { toast.error(err.message); }
    setResgatando(null);
  }

  async function ajustarFidelidade(sinal) {
    if (!ajusteMotivo.trim()) { toast.error('Informe o motivo'); return; }
    const qtd = Math.abs(parseInt(ajusteQtd, 10)) || 0;
    if (qtd <= 0) { toast.error('Quantidade inválida'); return; }
    setAjustando(true);
    try {
      const r = await fetch(`${BASE}/clientes/${cliente.id}/fidelidade/ajustar`, {
        method: 'POST', headers: authH(),
        body: JSON.stringify({ delta: sinal * qtd, motivo: ajusteMotivo.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao ajustar');
      toast.success(sinal > 0 ? 'Brinde(s) concedido(s)!' : 'Brinde(s) revogado(s)!');
      onResgatar(d.cliente);
      setDados(prev => prev ? { ...prev, cliente: { ...prev.cliente, ...d.cliente } } : prev);
      setAjusteMotivo(''); setAjusteQtd(1);
      setHistoricoAjustes(null); // força recarregar se o usuário abrir de novo
    } catch (e) { toast.error(e.message); }
    setAjustando(false);
  }

  async function recarregarCashback() {
    try {
      const r = await fetch(`${BASE}/cashback/saldo/${cliente.telefone}`, { headers: authH() });
      if (r.ok) setCashbackSaldo(await r.json());
    } catch { /* mantém saldo atual */ }
  }

  async function ajustarCashback(tipo) {
    const valor = parseFloat(cbValor);
    if (!valor || valor <= 0) { toast.error('Informe um valor válido'); return; }
    if (!cbMotivo.trim()) { toast.error('Informe o motivo'); return; }
    if (tipo === 'remover' && valor > (cashbackSaldo?.saldo || 0)) {
      toast.error(`Valor maior que o saldo disponível (${brl(cashbackSaldo?.saldo || 0)})`);
      return;
    }
    setCbOperando(true);
    try {
      const endpoint = tipo === 'creditar' ? 'creditar' : 'estornar';
      const r = await fetch(`${BASE}/cashback/${endpoint}`, {
        method: 'POST', headers: authH(),
        body: JSON.stringify({ telefone: cliente.telefone, nome: cliente.nome, valor, descricao: cbMotivo.trim() }),
      });
      const d = await r.json();
      if (!r.ok || d.erro) throw new Error(d.erro || 'Erro');
      toast.success(tipo === 'creditar' ? 'Cashback creditado!' : 'Cashback removido!');
      await recarregarCashback();
      setCbValor(''); setCbMotivo('');
      setHistoricoAjustes(null);
    } catch (e) { toast.error(e.message); }
    setCbOperando(false);
  }

  async function abrirHistoricoAjustes() {
    if (historicoAjustes !== null) { setHistoricoAjustes(null); return; }
    setCarregandoHist(true);
    try {
      const [selos, cb] = await Promise.all([
        fetch(`${BASE}/clientes/${cliente.id}/fidelidade/ajustes`, { headers: authH() }).then(r => r.ok ? r.json() : []),
        fetch(`${BASE}/cashback/historico/${cliente.telefone}`, { headers: authH() }).then(r => r.ok ? r.json() : []),
      ]);
      const unificado = [
        ...selos.map(a => ({ tipo: 'selo', delta: a.delta, motivo: a.motivo, data: a.created_at })),
        ...cb.filter(t => t.tipo === 'manual' || t.tipo === 'estorno')
             .map(t => ({ tipo: 'cashback', delta: t.tipo === 'estorno' ? -t.valor : t.valor, motivo: t.descricao, data: t.created_at })),
      ].sort((a, b) => new Date(b.data) - new Date(a.data));
      setHistoricoAjustes(unificado);
    } catch { setHistoricoAjustes([]); }
    setCarregandoHist(false);
  }
```

- [ ] **Step 5: Adicionar a UI na aba Fidelidade**

Em `frontend/src/pages/Clientes.jsx`, localizar o fim do bloco da aba
Fidelidade (por volta da linha 550-556):

```jsx
              {promocoes.length === 0 && !fid?.recompensas_disponiveis && (
                <div className="py-12 text-center t-dim text-sm">
                  <Award size={28} className="mx-auto mb-3 opacity-30" strokeWidth={1.5} />
                  <p>Nenhuma promoção ativa para este cliente.</p>
                </div>
              )}
            </>)
```

Substituir por (mantém o bloco original intacto, insere as seções novas
antes do `</>)` que fecha a aba):

```jsx
              {promocoes.length === 0 && !fid?.recompensas_disponiveis && (
                <div className="py-12 text-center t-dim text-sm">
                  <Award size={28} className="mx-auto mb-3 opacity-30" strokeWidth={1.5} />
                  <p>Nenhuma promoção ativa para este cliente.</p>
                </div>
              )}

              {/* Ajuste manual — brindes do cartão fidelidade */}
              <div className="rounded-2xl p-4" style={{ background: 'var(--space-elev)', border: '1px solid var(--hairline)' }}>
                <p className="text-[10px] font-black tracking-widest t-dim mb-3">AJUSTE MANUAL — BRINDES</p>
                <div className="flex items-center gap-2 mb-2">
                  <input type="number" min={1} value={ajusteQtd} onChange={e => setAjusteQtd(e.target.value)}
                    className="w-16 px-2 py-2 rounded-lg text-sm text-center"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: 'var(--txt-strong)' }} />
                  <input value={ajusteMotivo} onChange={e => setAjusteMotivo(e.target.value)} placeholder="Motivo (obrigatório)"
                    className="flex-1 px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: 'var(--txt-strong)' }} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => ajustarFidelidade(1)} disabled={ajustando}
                    className="flex-1 py-2 rounded-lg text-xs font-black disabled:opacity-50"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                    + Conceder
                  </button>
                  <button onClick={() => ajustarFidelidade(-1)} disabled={ajustando || (fid?.recompensas_disponiveis || 0) < 1}
                    className="flex-1 py-2 rounded-lg text-xs font-black disabled:opacity-50"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                    − Revogar
                  </button>
                </div>
              </div>

              {/* Cashback */}
              <div className="rounded-2xl p-4" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black tracking-widest" style={{ color: '#f59e0b' }}>CASHBACK</p>
                  <p className="text-lg font-black" style={{ color: '#f59e0b' }}>{brl(cashbackSaldo?.saldo || 0)}</p>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <input type="number" min={0} step="0.01" value={cbValor} onChange={e => setCbValor(e.target.value)} placeholder="Valor"
                    className="w-24 px-2 py-2 rounded-lg text-sm"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: 'var(--txt-strong)' }} />
                  <input value={cbMotivo} onChange={e => setCbMotivo(e.target.value)} placeholder="Motivo (obrigatório)"
                    className="flex-1 px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'var(--space-elev-2)', border: '1px solid var(--hairline)', color: 'var(--txt-strong)' }} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => ajustarCashback('creditar')} disabled={cbOperando}
                    className="flex-1 py-2 rounded-lg text-xs font-black disabled:opacity-50"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                    + Adicionar
                  </button>
                  <button onClick={() => ajustarCashback('remover')} disabled={cbOperando}
                    className="flex-1 py-2 rounded-lg text-xs font-black disabled:opacity-50"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                    − Remover
                  </button>
                </div>
              </div>

              {/* Histórico de ajustes manuais */}
              <div>
                <button onClick={abrirHistoricoAjustes} className="text-xs font-bold t-dim flex items-center gap-1.5">
                  <ChevronRight size={12} style={{ transform: historicoAjustes !== null ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }} />
                  Histórico de ajustes manuais
                </button>
                {carregandoHist && <p className="text-xs t-dim mt-2">Carregando…</p>}
                {historicoAjustes !== null && !carregandoHist && (
                  <div className="mt-2 space-y-1.5">
                    {historicoAjustes.length === 0
                      ? <p className="text-xs t-dim">Nenhum ajuste manual ainda.</p>
                      : historicoAjustes.map((h, i) => (
                        <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg" style={{ background: 'var(--space-elev)' }}>
                          <div>
                            <span className="font-bold" style={{ color: h.delta > 0 ? '#10b981' : '#ef4444' }}>
                              {h.tipo === 'selo' ? `${h.delta > 0 ? '+' : ''}${h.delta} brinde${Math.abs(h.delta) > 1 ? 's' : ''}` : brl(h.delta)}
                            </span>
                            <span className="t-dim ml-2">{h.motivo}</span>
                          </div>
                          <span className="t-faint shrink-0 ml-2">{new Date(h.data).toLocaleDateString('pt-BR')}</span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </>)
```

- [ ] **Step 6: Lint**

```bash
cd frontend && npm run lint
```

Esperado: `0 errors` (warnings pré-existentes não relacionados são aceitáveis).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/Clientes.jsx
git commit -m "feat: ajuste manual de brindes e cashback na ficha do cliente"
```

---

## Task 5: Frontend — tela global de Cashback: toggle Creditar/Remover

**Files:**
- Modify: `frontend/src/pages/Cashback.jsx`

**Interfaces:**
- Consumes: `POST /api/cashback/creditar` e `POST /api/cashback/estornar` (já existem, sem mudança).

- [ ] **Step 1: Adicionar estado do modo do modal**

Em `frontend/src/pages/Cashback.jsx`, linha 19, trocar:

```jsx
  const [modalCredito, setModalCredito] = useState(null);
```

por:

```jsx
  const [modalCredito, setModalCredito] = useState(null);
  const [modoCredito, setModoCredito] = useState('creditar'); // 'creditar' | 'remover'
```

- [ ] **Step 2: Generalizar a função `creditar` pra `salvarOperacao`**

Em `frontend/src/pages/Cashback.jsx`, linhas 54-68, trocar:

```jsx
  async function creditar() {
    const { telefone, nome, valor, descricao } = creditoForm;
    if (!telefone || !valor) return toast.error('Preencha telefone e valor');
    try {
      const d = await api.post('/cashback/creditar', { telefone, nome, valor: parseFloat(valor), descricao });
      if (d.ok) {
        toast.success('Cashback creditado!');
        setModalCredito(false);
        setCreditoForm({ telefone: '', nome: '', valor: '', descricao: '' });
        carregarClientes();
      } else toast.error(d.erro || 'Erro');
    } catch (e) {
      toast.error(e.message || 'Erro');
    }
  }
```

por:

```jsx
  async function salvarOperacao() {
    const { telefone, nome, valor, descricao } = creditoForm;
    if (!telefone || !valor) return toast.error('Preencha telefone e valor');
    const endpoint = modoCredito === 'creditar' ? '/cashback/creditar' : '/cashback/estornar';
    try {
      const d = await api.post(endpoint, { telefone, nome, valor: parseFloat(valor), descricao });
      if (d.erro) { toast.error(d.erro); return; }
      toast.success(modoCredito === 'creditar' ? 'Cashback creditado!' : 'Cashback removido!');
      setModalCredito(false);
      setCreditoForm({ telefone: '', nome: '', valor: '', descricao: '' });
      carregarClientes();
    } catch (e) {
      toast.error(e.message || 'Erro');
    }
  }
```

- [ ] **Step 3: Atualizar o botão do header**

Em `frontend/src/pages/Cashback.jsx`, linhas 102-104, trocar:

```jsx
        <button onClick={() => setModalCredito(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#f59e0b', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
          <PlusCircle size={15} /> Creditar manual
        </button>
```

por:

```jsx
        <button onClick={() => { setModoCredito('creditar'); setModalCredito(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#f59e0b', color: '#000', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
          <PlusCircle size={15} /> Ajustar manualmente
        </button>
```

- [ ] **Step 4: Adicionar o seletor dentro do modal e trocar o texto/handler**

Em `frontend/src/pages/Cashback.jsx`, dentro do bloco `{modalCredito && (...)}`
(linhas 303-329), trocar:

```jsx
      {modalCredito && (
        <div onClick={() => setModalCredito(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 400, background: '#1e293b', borderRadius: 16, padding: 24, border: '1px solid #334155', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                <PlusCircle size={18} style={{ color: '#f59e0b' }} /> Creditar cashback
              </div>
              <button onClick={() => setModalCredito(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
            </div>
            {[
              { key: 'telefone', label: 'TELEFONE', placeholder: '44999887766' },
              { key: 'nome', label: 'NOME (opcional)', placeholder: 'Nome do cliente' },
              { key: 'valor', label: 'VALOR (R$)', placeholder: '0.00', type: 'number' },
              { key: 'descricao', label: 'DESCRIÇÃO (opcional)', placeholder: 'Ex: Cortesia aniversário' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input type={f.type || 'text'} value={creditoForm[f.key]} onChange={e => setCreditoForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  style={{ width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
            <button onClick={creditar} style={{ width: '100%', padding: '12px', borderRadius: 8, fontWeight: 700, fontSize: 14, background: '#f59e0b', color: '#000', border: 'none', cursor: 'pointer', marginTop: 8 }}>
              Creditar
            </button>
          </div>
        </div>
      )}
```

por:

```jsx
      {modalCredito && (
        <div onClick={() => setModalCredito(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 400, background: '#1e293b', borderRadius: 16, padding: 24, border: '1px solid #334155', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 8 }}>
                <PlusCircle size={18} style={{ color: '#f59e0b' }} /> Ajuste manual de cashback
              </div>
              <button onClick={() => setModalCredito(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {[['creditar', 'Creditar'], ['remover', 'Remover']].map(([id, label]) => (
                <button key={id} onClick={() => setModoCredito(id)} style={{
                  flex: 1, padding: '8px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  background: modoCredito === id ? (id === 'creditar' ? '#16a34a' : '#dc2626') : '#0f172a',
                  color: modoCredito === id ? '#fff' : '#64748b',
                  border: modoCredito === id ? 'none' : '1px solid #334155',
                }}>{label}</button>
              ))}
            </div>

            {[
              { key: 'telefone', label: 'TELEFONE', placeholder: '44999887766' },
              { key: 'nome', label: 'NOME (opcional)', placeholder: 'Nome do cliente' },
              { key: 'valor', label: 'VALOR (R$)', placeholder: '0.00', type: 'number' },
              { key: 'descricao', label: 'MOTIVO', placeholder: 'Ex: Cortesia aniversário' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 4 }}>{f.label}</label>
                <input type={f.type || 'text'} value={creditoForm[f.key]} onChange={e => setCreditoForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder}
                  style={{ width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#e2e8f0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
            <button onClick={salvarOperacao} style={{ width: '100%', padding: '12px', borderRadius: 8, fontWeight: 700, fontSize: 14, background: modoCredito === 'creditar' ? '#f59e0b' : '#ef4444', color: modoCredito === 'creditar' ? '#000' : '#fff', border: 'none', cursor: 'pointer', marginTop: 8 }}>
              {modoCredito === 'creditar' ? 'Creditar' : 'Remover'}
            </button>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Lint**

```bash
cd frontend && npm run lint
```

Esperado: `0 errors`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Cashback.jsx
git commit -m "feat: toggle Creditar/Remover no ajuste manual de cashback"
```

---

## Task 6: Verificação end-to-end e deploy

**Files:** nenhum (só verificação e deploy)

**Interfaces:** Consumes tudo das Tasks 1-5.

- [ ] **Step 1: Subir backend e frontend localmente**

```bash
cd backend && npm run dev
```

Em outro terminal:

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Verificar visualmente — ficha do cliente**

No navegador, abrir `http://localhost:3000/clientes`, abrir a ficha de um
cliente qualquer (inclusive um sem pedidos, se houver, pra confirmar o fix
do Step 1 da Task 4), ir na aba "Fidelidade" e confirmar:
- Card "AJUSTE MANUAL — BRINDES" aparece com os campos e botões.
- Conceder 1 brinde com motivo → toast de sucesso, contador de disponíveis sobe.
- Tentar revogar sem preencher motivo → toast de erro, nada muda.
- Card "CASHBACK" mostra o saldo correto (comparar com a tela `/cashback`).
- Adicionar cashback com motivo → saldo atualiza na hora.
- Abrir "Histórico de ajustes manuais" → aparecem as duas operações feitas acima.

- [ ] **Step 3: Verificar que o bônus sobrevive a um pedido real**

Anotar `recompensas_bonus` do cliente ajustado (via
`curl .../clientes` como na Task 2). Fechar um pedido de teste desse
cliente pelo PDV (`http://localhost:3000/pdv`) até o status virar
"entregue" (ou o que o fluxo do PDV considerar "pedido completo" — conferir
`total_pedidos` incrementando). Consultar o cliente de novo e confirmar que
`recompensas_bonus` continua o mesmo valor de antes (não foi zerado nem
sobrescrito pelo recálculo de `recompensas_ganhas`).

- [ ] **Step 4: Verificar a tela global de Cashback**

Em `http://localhost:3000/cashback`, clicar em "Ajustar manualmente",
alternar entre "Creditar" e "Remover", confirmar que o botão final muda de
cor/texto e que a operação reflete corretamente na lista de clientes.

- [ ] **Step 5: Lint final nos dois pacotes**

```bash
cd backend && npm run lint
cd frontend && npm run lint
```

Esperado: `0 errors` nos dois.

- [ ] **Step 6: Deploy**

Seguir a receita já validada nesta sessão (deploy manual via scp para
`root@2.25.207.3`, `/opt/37sushi/paranav*/app/`):
1. Copiar os arquivos backend modificados (`cardapio.js`, `clientes.js`,
   `clientesAnalise.js`) para `/opt/37sushi/paranav*/app/backend/src/...`
   via `/tmp` (o acento em "paranavaí" corrompe scp direto — usar o glob).
2. `pm2 restart 0` e conferir `pm2 logs 0 --lines 15` sem erro de
   `MODULE_NOT_FOUND` ou de sintaxe.
3. `cd frontend && npm run build` local, empacotar `dist/` (sem as pastas
   `cardapio/`/`banners/` de upload — não fazem parte do build), subir e
   trocar com `chmod -R a+rX dist` (crítico — sem isso o nginx dá 500).
4. Testar no ar: abrir `/clientes`, conferir que a aba Fidelidade carrega
   sem erro no console e que o ajuste manual funciona com um cliente real.

- [ ] **Step 7: Commit final (se sobrou algo não commitado)**

```bash
git status
```

Se tudo já foi commitado nas Tasks 1-5, não há o que fazer aqui.
