# Resgate Automático de Brinde no Cardápio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O cliente resgata o brinde de fidelidade sozinho — quando tem
saldo disponível, o item configurado entra grátis no próximo pedido do
cardápio online, sem falar com atendente. O dono escolhe/troca qual item
é o brinde numa tela simples.

**Architecture:** Tabela nova `fidelidade_config` (item_id + ativo),
exposta por um router novo (`fidelidade.js`, mesmo padrão de
`cashback.js`). `cardapio.js` reaproveita a função de leitura da config
(`getConfigComItem`) em dois pontos: `GET /cliente/:telefone` (pra
mostrar o nome do brinde no cartão de fidelidade do checkout) e
`POST /pedido` (pra inserir o item grátis automaticamente quando o
cliente tem saldo). Só 1 brinde por pedido, mesmo com saldo acumulado.

**Tech Stack:** Node/Express, `node:sqlite`, React.

## Global Constraints

- Sem framework de testes automatizados neste projeto — verificação manual
  via `curl` (JWT autoassinado) e navegador é a convenção estabelecida.
- Só 1 brinde resgatado por pedido, mesmo que `recompensas_disponiveis`
  seja 2+. O resto fica guardado.
- O brinde já entra no pedido que **completa** o ciclo de 10 (não precisa
  esperar o próximo pedido) — isso já acontece naturalmente porque o
  resgate roda depois do recálculo de fidelidade desse mesmo pedido.
- Sem item configurado, ou item excluído/indisponível: pedido segue normal
  sem erro, saldo do cliente **não é decrementado** (fica guardado pro
  próximo pedido, depois que o dono configurar).
- Um único item fixo como brinde (não é lista de opções pro cliente
  escolher). O dono troca quando quiser; vale só pra resgates a partir
  dali (sem retroatividade).
- `RECOMPENSA_DESCRICAO` (constante fixa hoje em `cardapio.js`) é REMOVIDA
  — o texto de "você ganhou" passa a vir do nome do item configurado.
- **`backend/src/routes/cardapio.js` e `backend/src/index.js` têm WIP
  não relacionada já em produção mas nunca commitada** (rate limiting,
  sanitização, otimização de imagem, CSP, webhook do WhatsApp, etc.) —
  ao editar esses dois arquivos, usar git-surgery (reconstruir a partir
  do HEAD commitado + aplicar só as mudanças desta tarefa) antes de
  commitar, do jeito já validado nas tarefas anteriores desta sessão.
  NÃO usar `git checkout`/`git restore` nesses arquivos.
- **`frontend/src/pages/Cardapio.jsx` tem ~942 linhas de WIP não
  relacionada e não commitada** (redesign do checkout, não é desta
  tarefa). Diferente dos outros dois arquivos, aqui a WIP **já reescreveu
  o texto do cartão de fidelidade que esta tarefa precisa editar** — não
  dá pra isolar por git-surgery sem reconstruir um estado que nunca
  existiu de verdade. Precedente já validado nesta mesma sessão pra esse
  exato cenário (Task 5 do plano anterior, `Cashback.jsx`): editar direto
  no arquivo atual (não a partir do HEAD) e **commitar o arquivo inteiro
  como 1 commit só**, com mensagem deixando claro que a WIP alheia foi
  incluída porque não dava pra separar. Não tentar git-surgery nesse
  arquivo.
- `frontend/src/pages/Clientes.jsx` e o novo `backend/src/routes/fidelidade.js`
  não têm WIP alheia — commit normal.

---

## Task 1: Backend — arquivo `fidelidade.js` (config) + montagem em `index.js`

**Files:**
- Create: `backend/src/routes/fidelidade.js`
- Modify: `backend/src/index.js` (require na linha ~40, mount na linha ~219 — ambos em git-surgery, ver Global Constraints)

**Interfaces:**
- Produces (consumido pela Task 2 e pela Task 3):
  - `GET /api/fidelidade/config` → `{ id: 1, item_id: number|null, ativo: 0|1, item_nome: string|null }`
    (`item_nome` é `null` se `item_id` for `null`, se o item foi excluído,
    ou se estiver `disponivel = 0`)
  - `PUT /api/fidelidade/config` body `{ item_id, ativo }` → mesmo formato do GET, já atualizado
  - `getConfigComItem()` — função exportada por `fidelidade.js`, mesmo
    formato do GET acima. Usada pela Task 2 dentro de `cardapio.js`
    (chamada direta de função, não HTTP — funciona em rotas públicas sem
    precisar de auth).

- [ ] **Step 1: Criar `backend/src/routes/fidelidade.js`**

```js
const { Router } = require('express');
const db = require('../db/database');

const router = Router();

// ── Migração ──────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS fidelidade_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    item_id INTEGER,
    ativo INTEGER DEFAULT 1
  );
  INSERT OR IGNORE INTO fidelidade_config(id) VALUES(1);
`);

// Devolve a config + nome do item "vivo" (null se não configurado,
// excluído, ou indisponível). Reaproveitada por cardapio.js (rotas
// públicas do checkout) e pelas rotas admin abaixo.
function getConfigComItem() {
  const cfg = db.prepare('SELECT * FROM fidelidade_config WHERE id = 1').get();
  if (!cfg.item_id) return { ...cfg, item_nome: null };
  const item = db.prepare('SELECT nome, disponivel FROM cardapio_itens WHERE id = ?').get(cfg.item_id);
  return { ...cfg, item_nome: item && item.disponivel ? item.nome : null };
}

// GET /api/fidelidade/config
router.get('/config', (req, res) => res.json(getConfigComItem()));

// PUT /api/fidelidade/config
router.put('/config', (req, res) => {
  const { item_id, ativo } = req.body;
  db.prepare('UPDATE fidelidade_config SET item_id = ?, ativo = ? WHERE id = 1')
    .run(item_id != null ? Number(item_id) : null, ativo ? 1 : 0);
  res.json(getConfigComItem());
});

module.exports = router;
module.exports.getConfigComItem = getConfigComItem;
```

Nota: sem `requireAuth` explícito nas rotas — `index.js` já aplica
`app.use('/api', requireAuth)` antes de montar este router (Step 2),
mesmo padrão de `clientes.js`/`cashback.js`.

- [ ] **Step 2: Montar o router em `index.js` (git-surgery)**

`backend/src/index.js` tem WIP não relacionada e não commitada. Antes de
editar, rodar `git show HEAD:backend/src/index.js > <arquivo temporário>`
pra ter uma cópia limpa da última versão commitada.

Na cópia limpa, aplicar 2 edições:

Depois da linha `const cashbackRouter = require('./routes/cashback');`
(a linha exata; usar essa string como âncora, não confiar num número de
linha):

```js
const cashbackRouter = require('./routes/cashback');
const fidelidadeRouter = require('./routes/fidelidade');
```

E depois da linha `app.use('/api/cashback', cashbackRouter);`:

```js
app.use('/api/cashback', cashbackRouter);
app.use('/api/fidelidade', fidelidadeRouter);
```

Confirmar que essas duas linhas-âncora (`const cashbackRouter = ...` e
`app.use('/api/cashback', ...)`) não aparecem em nenhum `+`/`-` de
`git diff backend/src/index.js` antes de usá-las como âncora — se
aparecerem, parar e reportar BLOCKED em vez de adivinhar uma âncora nova.

Depois de editar a cópia limpa, usar `git hash-object -w <arquivo>` +
`git update-index --cacheinfo 100644,<hash>,backend/src/index.js` pra
colocar essa versão isolada no índice do git, sem tocar no working tree
real (que continua com a WIP intacta, não commitada).

**Importante:** o *working tree* real de `backend/src/index.js` (o
arquivo que o servidor local roda) também precisa das mesmas 2 linhas
adicionadas, pra dev/teste local funcionar — aplicar a mesma edição
directly no arquivo real também (via Edit tool, com as mesmas duas
âncoras), só que esse arquivo fica com a WIP + as 2 linhas nele, e é o
`git update-index` acima (não esse arquivo) que decide o que entra no
commit.

- [ ] **Step 3: Verificar sintaxe e teste local**

```bash
node --check backend/src/routes/fidelidade.js
cd backend && npm run dev
```

Gerar um token e testar:

```bash
cd backend && node -e "const jwt=require('jsonwebtoken');require('dotenv').config();console.log(jwt.sign({id:1,usuario:'admin'},process.env.JWT_SECRET,{expiresIn:'20m'}))" | tail -1
```

```bash
curl -s "http://localhost:3001/api/fidelidade/config" -H "Authorization: Bearer <TOKEN>"
```

Esperado: `{"id":1,"item_id":null,"ativo":1,"item_nome":null}` (config
vazia, primeira vez).

```bash
curl -s -X PUT "http://localhost:3001/api/fidelidade/config" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"item_id": 1, "ativo": 1}'
```

Esperado: `200` com `item_nome` preenchido (o nome do item de id 1 no
cardápio local) — se o item 1 não existir/estiver indisponível,
`item_nome: null` mesmo com `item_id: 1` setado (comportamento correto,
não é bug).

Reverter pro estado vazio depois do teste:

```bash
curl -s -X PUT "http://localhost:3001/api/fidelidade/config" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"item_id": null, "ativo": 1}'
```

- [ ] **Step 4: Lint**

```bash
cd backend && npm run lint
```

Esperado: `0 errors`.

- [ ] **Step 5: Commit**

O `fidelidade.js` é arquivo novo, sem conflito — `git add` normal. Pro
`index.js`, seguir o fluxo de git-surgery: depois do
`git update-index --cacheinfo` do Step 2, os dois arquivos já estão no
índice certo — só falta `git commit`.

```bash
git add backend/src/routes/fidelidade.js
git status --short backend/src/index.js
```

Confirmar que `backend/src/index.js` aparece como `M` (staged) — se não
aparecer nada staged pra ele, o `update-index` do Step 2 não funcionou,
não commitar, reportar BLOCKED.

```bash
git commit -m "feat: config do brinde de fidelidade (item + ativo)"
```

Depois do commit, confirmar que a WIP de `index.js` continua intacta e
não commitada:

```bash
git diff backend/src/index.js
```

Esperado: mostra a MESMA WIP de antes (CSP, webhook, etc.), sem as 2
linhas que acabaram de ser commitadas (essas já saíram do diff, porque
agora fazem parte do HEAD).

---

## Task 2: Backend — resgate automático no `POST /pedido` + nome do brinde em `GET /cliente/:telefone`

**Files:**
- Modify: `backend/src/routes/cardapio.js` (git-surgery — mesma técnica já usada 3x nesta sessão pra esse arquivo)

**Interfaces:**
- Consumes: `getConfigComItem()` da Task 1.
- Produces (consumido pela Task 4):
  - `GET /api/cardapio/cliente/:telefone` — resposta ganha o campo
    `brinde_item_nome: string|null` (nome do brinde ativo, ou `null` se
    não configurado/desativado/indisponível).
  - `POST /api/cardapio/pedido` — resposta ganha o campo
    `brinde_resgatado: { item_id, nome } | null` (preenchido só quando um
    item grátis foi de fato inserido nesse pedido). O campo
    `recompensa_descricao` é REMOVIDO da resposta (não existe mais).

**Contexto:** este arquivo tem WIP não relacionada (rate limiting,
sanitização, otimização de imagem, coluna `bairro`, etc.) já commitada
parcialmente em rodadas anteriores desta sessão — mas as linhas exatas
que esta tarefa toca (`calcFidelidade`, `RECOMPENSA_DESCRICAO`,
`GET /cliente/:telefone`, `POST /pedido`) estão limpas/intocadas pela
WIP restante. Confirmar isso de novo antes de editar
(`git diff backend/src/routes/cardapio.js | grep -E "RECOMPENSA_DESCRICAO|recompensa_descricao"` —
só deve aparecer como contexto, nunca com `+`/`-`; se aparecer, parar e
reportar BLOCKED em vez de adivinhar).

- [ ] **Step 1: Require de `getConfigComItem` no topo do arquivo**

Localizar a linha `const { otimizar } = require('../utils/otimizarImagem');`
perto do topo do arquivo e adicionar logo depois:

```js
const { otimizar } = require('../utils/otimizarImagem');
const { getConfigComItem } = require('./fidelidade');
```

- [ ] **Step 2: Remover `RECOMPENSA_DESCRICAO`**

Localizar:

```js
const PEDIDOS_POR_RECOMPENSA = 10;
const RECOMPENSA_DESCRICAO   = '1 Temaki Salmão grátis no próximo pedido! 🎁';
```

Trocar por (remove só a segunda linha):

```js
const PEDIDOS_POR_RECOMPENSA = 10;
```

- [ ] **Step 3: `GET /cliente/:telefone` — adicionar `brinde_item_nome`**

Localizar:

```js
router.get('/cliente/:telefone', limiteCliente, (req, res) => {
  const tel = normalizarTelefone(req.params.telefone);
  if (tel.length < 8) return res.status(400).json({ erro: 'Telefone inválido' });

  const cliente = db.prepare('SELECT * FROM clientes WHERE telefone = ?').get(tel);
  if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

  res.json({ ...cliente, fidelidade: calcFidelidade(cliente.total_pedidos, cliente.recompensas_ganhas, cliente.recompensas_usadas, cliente.selos_bonus || 0) });
});
```

Trocar por:

```js
router.get('/cliente/:telefone', limiteCliente, (req, res) => {
  const tel = normalizarTelefone(req.params.telefone);
  if (tel.length < 8) return res.status(400).json({ erro: 'Telefone inválido' });

  const cliente = db.prepare('SELECT * FROM clientes WHERE telefone = ?').get(tel);
  if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

  const brindeCfg = getConfigComItem();
  res.json({
    ...cliente,
    fidelidade: calcFidelidade(cliente.total_pedidos, cliente.recompensas_ganhas, cliente.recompensas_usadas, cliente.selos_bonus || 0),
    brinde_item_nome: brindeCfg.ativo ? brindeCfg.item_nome : null,
  });
});
```

- [ ] **Step 4: `POST /pedido` — resgate automático**

Localizar o bloco de fidelidade dentro de `router.post('/pedido', ...)`
(depois do `if (cliente_telefone?.trim()) {` que atualiza/cria o
cliente):

```js
  if (cliente_telefone?.trim()) {
    const tel = normalizarTelefone(cliente_telefone.trim());
    const clienteExistente = db.prepare('SELECT * FROM clientes WHERE telefone = ?').get(tel);

    if (clienteExistente) {
      // Atualiza cliente existente
      const novo_total = clienteExistente.total_pedidos + 1;
      const novo_ganhas = Math.floor(novo_total / PEDIDOS_POR_RECOMPENSA);
      ganhou_recompensa = novo_ganhas > clienteExistente.recompensas_ganhas;

      db.prepare(`
        UPDATE clientes SET
          nome = ?, endereco = ?, bairro = COALESCE(NULLIF(?, ''), bairro),
          total_pedidos = ?, recompensas_ganhas = ?,
          aniversario = COALESCE(?, aniversario), updated_at = CURRENT_TIMESTAMP
        WHERE telefone = ?
      `).run(cliente_nome.trim(), cliente_endereco.trim(), bairro?.trim() || '', novo_total, novo_ganhas, anivMMDD, tel);

      const atualizado = db.prepare('SELECT * FROM clientes WHERE telefone = ?').get(tel);
      fidelidade = calcFidelidade(atualizado.total_pedidos, atualizado.recompensas_ganhas, atualizado.recompensas_usadas, atualizado.selos_bonus || 0);
    } else {
      // Cria novo cliente
      db.prepare(`
        INSERT INTO clientes (telefone, nome, endereco, bairro, total_pedidos, recompensas_ganhas, aniversario)
        VALUES (?, ?, ?, ?, 1, 0, ?)
      `).run(tel, cliente_nome.trim(), cliente_endereco.trim(), bairro?.trim() || null, anivMMDD);

      fidelidade = calcFidelidade(1, 0, 0);
    }
  }
```

Trocar por (mesmo conteúdo + bloco novo de resgate no final, ainda dentro
do `if`):

```js
  if (cliente_telefone?.trim()) {
    const tel = normalizarTelefone(cliente_telefone.trim());
    const clienteExistente = db.prepare('SELECT * FROM clientes WHERE telefone = ?').get(tel);

    if (clienteExistente) {
      // Atualiza cliente existente
      const novo_total = clienteExistente.total_pedidos + 1;
      const novo_ganhas = Math.floor(novo_total / PEDIDOS_POR_RECOMPENSA);
      ganhou_recompensa = novo_ganhas > clienteExistente.recompensas_ganhas;

      db.prepare(`
        UPDATE clientes SET
          nome = ?, endereco = ?, bairro = COALESCE(NULLIF(?, ''), bairro),
          total_pedidos = ?, recompensas_ganhas = ?,
          aniversario = COALESCE(?, aniversario), updated_at = CURRENT_TIMESTAMP
        WHERE telefone = ?
      `).run(cliente_nome.trim(), cliente_endereco.trim(), bairro?.trim() || '', novo_total, novo_ganhas, anivMMDD, tel);

      const atualizado = db.prepare('SELECT * FROM clientes WHERE telefone = ?').get(tel);
      fidelidade = calcFidelidade(atualizado.total_pedidos, atualizado.recompensas_ganhas, atualizado.recompensas_usadas, atualizado.selos_bonus || 0);
    } else {
      // Cria novo cliente
      db.prepare(`
        INSERT INTO clientes (telefone, nome, endereco, bairro, total_pedidos, recompensas_ganhas, aniversario)
        VALUES (?, ?, ?, ?, 1, 0, ?)
      `).run(tel, cliente_nome.trim(), cliente_endereco.trim(), bairro?.trim() || null, anivMMDD);

      fidelidade = calcFidelidade(1, 0, 0);
    }

    // ── Resgate automático de brinde ──────────────────────────
    // No máximo 1 por pedido, mesmo com saldo acumulado. Sem item
    // configurado/ativo/disponível: não decrementa nada, o saldo fica
    // guardado pro próximo pedido — nunca falha o checkout por isso.
    if (fidelidade.recompensas_disponiveis > 0) {
      const brindeCfg = getConfigComItem();
      if (brindeCfg.ativo && brindeCfg.item_id && brindeCfg.item_nome) {
        insItem.run(pedidoId, `${brindeCfg.item_nome} (Brinde fidelidade 🎁)`, 1, 0, null);
        db.prepare('UPDATE clientes SET recompensas_usadas = recompensas_usadas + 1, updated_at = CURRENT_TIMESTAMP WHERE telefone = ?').run(tel);
        const clienteFinal = db.prepare('SELECT * FROM clientes WHERE telefone = ?').get(tel);
        fidelidade = calcFidelidade(clienteFinal.total_pedidos, clienteFinal.recompensas_ganhas, clienteFinal.recompensas_usadas, clienteFinal.selos_bonus || 0);
        brinde_resgatado = { item_id: brindeCfg.item_id, nome: brindeCfg.item_nome };
      }
    }
  }
```

- [ ] **Step 5: Declarar `brinde_resgatado` e ajustar a resposta final**

Localizar (perto do início do bloco de fidelidade, onde `fidelidade` e
`ganhou_recompensa` já são declarados):

```js
  // ── Fidelidade ──────────────────────────────────────────────
  let fidelidade = null;
  let ganhou_recompensa = false;
```

Trocar por:

```js
  // ── Fidelidade ──────────────────────────────────────────────
  let fidelidade = null;
  let ganhou_recompensa = false;
  let brinde_resgatado = null;
```

E localizar a resposta final da rota:

```js
  res.status(201).json({ id: pedidoId, numero, total, fidelidade, ganhou_recompensa, recompensa_descricao: ganhou_recompensa ? RECOMPENSA_DESCRICAO : null });
```

Trocar por:

```js
  res.status(201).json({ id: pedidoId, numero, total, fidelidade, ganhou_recompensa, brinde_resgatado });
```

- [ ] **Step 6: Verificar sintaxe e testar localmente**

```bash
node --check backend/src/routes/cardapio.js
cd backend && npm run dev
```

Usando o mesmo token do Task 1, escolher um cliente de teste local e:

1. Configurar um item como brinde:
   ```bash
   curl -s -X PUT "http://localhost:3001/api/fidelidade/config" -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" -d '{"item_id": <ID de um item real do cardápio local>, "ativo": 1}'
   ```
2. Garantir que o cliente de teste tem `recompensas_disponiveis > 0`
   (usar `POST /clientes/:id/fidelidade/ajustar` com `delta` suficiente
   se precisar, motivo "teste resgate automático").
3. Simular um pedido desse cliente via `POST /api/cardapio/pedido` (ver
   o body esperado no próprio código da rota — `cliente_nome`,
   `cliente_telefone` igual ao do cliente de teste, `itens: [{item_id:
   <qualquer item válido>, quantidade: 1}]`, `tipo_entrega: 'retirada'`).
4. Confirmar na resposta: `brinde_resgatado` preenchido com o item
   configurado.
5. Consultar `GET /api/clientes` (ou o cliente específico) e confirmar
   que `recompensas_usadas` subiu 1 e `pdv_itens` do pedido criado tem 2
   linhas (o item pedido + o brinde grátis com `valor_unitario = 0`).
6. Reverter: usar `/fidelidade/ajustar` pra devolver o saldo consumido
   se necessário, e `PUT /fidelidade/config` com `item_id: null` pra
   limpar a config de teste.

- [ ] **Step 7: Lint**

```bash
cd backend && npm run lint
```

Esperado: `0 errors`.

- [ ] **Step 8: Commit (git-surgery)**

Mesma técnica das rodadas anteriores desta sessão pra este arquivo:
reconstruir a partir de `git show HEAD:backend/src/routes/cardapio.js`,
aplicar os Steps 1-5 nessa cópia limpa, conferir que bate byte-a-byte
com as seções equivalentes do arquivo real (`diff` num trecho pequeno,
tipo a função `calcFidelidade` ou o bloco de resgate), depois
`git hash-object -w` + `git update-index --cacheinfo` + `git commit`.
Confirmar depois que `git diff backend/src/routes/cardapio.js` ainda
mostra a WIP alheia intacta e não commitada.

```bash
git commit -m "feat: resgate automático de brinde no checkout do cardápio"
```

---

## Task 3: Frontend — painel de configuração do brinde em `Clientes.jsx`

**Files:**
- Modify: `frontend/src/pages/Clientes.jsx` (sem WIP alheia — commit normal)

**Interfaces:**
- Consumes: `GET /api/fidelidade/config`, `PUT /api/fidelidade/config`
  (Task 1), `GET /api/cardapio/itens` (já existe, não muda nesta tarefa
  — devolve `[{id, nome, preco, emoji, categoria_id, disponivel}]`).

- [ ] **Step 1: Adicionar estados e funções de carregamento/troca**

Em `frontend/src/pages/Clientes.jsx`, dentro de `export default function
Clientes() {`, logo após a linha
`const [mostrarQtd, setMostrarQtd] = useState(50); // paginação client-side da lista (bases grandes travavam o navegador)`,
adicionar:

```jsx
  const [fidConfig, setFidConfig] = useState(null);
  const [trocandoBrinde, setTrocandoBrinde] = useState(false);
  const [itensCardapio, setItensCardapio] = useState(null);
  const [buscaItemBrinde, setBuscaItemBrinde] = useState('');
  const [salvandoBrinde, setSalvandoBrinde] = useState(false);
```

Logo após a função `carregar` (depois do `}, []);` que a fecha, antes de
`useEffect(() => { carregar(); }, [carregar]);`), adicionar:

```jsx
  const carregarFidConfig = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/fidelidade/config`, { headers: authH() });
      if (r.ok) setFidConfig(await r.json());
    } catch {}
  }, []);
```

Trocar a linha `useEffect(() => { carregar(); }, [carregar]);` por:

```jsx
  useEffect(() => { carregar(); carregarFidConfig(); }, [carregar, carregarFidConfig]);
```

Logo depois da função `handleResgatar` (depois do `}` que a fecha),
adicionar:

```jsx
  async function abrirTrocaBrinde() {
    setTrocandoBrinde(true);
    if (itensCardapio === null) {
      try {
        const r = await fetch(`${BASE}/cardapio/itens`, { headers: authH() });
        setItensCardapio(r.ok ? await r.json() : []);
      } catch { setItensCardapio([]); }
    }
  }

  async function escolherBrinde(item) {
    setSalvandoBrinde(true);
    try {
      const r = await fetch(`${BASE}/fidelidade/config`, {
        method: 'PUT', headers: authH(),
        body: JSON.stringify({ item_id: item.id, ativo: 1 }),
      });
      if (r.ok) {
        setFidConfig(await r.json());
        toast.success('Brinde atualizado!');
        setTrocandoBrinde(false);
        setBuscaItemBrinde('');
      } else toast.error('Erro ao salvar');
    } catch { toast.error('Erro ao salvar'); }
    setSalvandoBrinde(false);
  }
```

- [ ] **Step 2: Adicionar o painel na UI**

Localizar o bloco:

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

      {aba === 'lista' && (<>
```

Trocar por (mantém tudo igual, insere o painel novo entre as Abas e o
`{aba === 'lista' && (<>` — visível nas duas abas):

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

      {/* Configuração do brinde de fidelidade */}
      <div className="rounded-2xl p-4" style={{ background: '#111', border: '1px solid #1a1a1a' }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black tracking-widest text-zinc-600">BRINDE DE FIDELIDADE</p>
            {fidConfig?.item_nome ? (
              <p className="text-sm font-bold t-strong mt-0.5 truncate">{fidConfig.item_nome}</p>
            ) : (
              <p className="text-xs mt-0.5" style={{ color: '#f97316' }}>⚠️ Nenhum brinde configurado — resgate automático desligado</p>
            )}
          </div>
          <button onClick={abrirTrocaBrinde}
            className="px-3 py-2 rounded-xl text-xs font-bold shrink-0"
            style={{ background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
            Trocar
          </button>
        </div>

        {trocandoBrinde && (
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid #1a1a1a' }}>
            <div className="relative mb-2">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
              <input value={buscaItemBrinde} onChange={e => setBuscaItemBrinde(e.target.value)}
                placeholder="Buscar item do cardápio..."
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm"
                style={{ background: '#0a0a0a', border: '1px solid #1a1a1a', color: '#fff' }} />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {itensCardapio === null ? (
                <p className="text-xs t-dim py-2 text-center">Carregando…</p>
              ) : itensCardapio.filter(i => i.nome.toLowerCase().includes(buscaItemBrinde.toLowerCase())).slice(0, 30).map(i => (
                <button key={i.id} onClick={() => escolherBrinde(i)} disabled={salvandoBrinde}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between disabled:opacity-50"
                  style={{ background: i.id === fidConfig?.item_id ? 'rgba(var(--accent-rgb),0.12)' : '#0a0a0a' }}>
                  <span className="truncate">{i.emoji} {i.nome}</span>
                  {i.id === fidConfig?.item_id && <CheckCircle2 size={14} style={{ color: 'var(--accent)' }} />}
                </button>
              ))}
            </div>
            <button onClick={() => { setTrocandoBrinde(false); setBuscaItemBrinde(''); }}
              className="w-full text-center py-2 mt-2 text-xs t-dim">Cancelar</button>
          </div>
        )}
      </div>

      {aba === 'lista' && (<>
```

- [ ] **Step 3: Lint**

```bash
cd frontend && npm run lint
```

Esperado: `0 errors` (`Search` e `CheckCircle2` já estão importados no
topo do arquivo — conferir se não sobra warning de import não usado, mas
ambos já são usados em outros pontos do arquivo).

- [ ] **Step 4: Verificação visual local**

Se houver ferramenta de browser disponível: abrir `/clientes`, conferir
que o painel "BRINDE DE FIDELIDADE" aparece (com aviso de "nenhum brinde
configurado" já que é a primeira vez), clicar "Trocar", buscar um item,
selecionar, confirmar que o nome aparece no painel e o toast de sucesso
dispara. Se a ferramenta de browser não estiver disponível/travar,
reportar isso no relatório e confiar na checagem de sintaxe/lint —
Task 5 faz a verificação visual final.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Clientes.jsx
git commit -m "feat: painel de configuração do brinde de fidelidade em Clientes"
```

---

## Task 4: Frontend — mensagens do cliente em `Cardapio.jsx` (checkout + confirmação)

**Files:**
- Modify: `frontend/src/pages/Cardapio.jsx` (WIP alheia grande e
  entrelaçada — ver Global Constraints: editar direto, commitar o
  arquivo inteiro junto)

**Interfaces:**
- Consumes: `brinde_item_nome` em `clienteEncontrado` (vem de
  `GET /cardapio/cliente/:telefone`, Task 2) e `brinde_resgatado` em
  `pedidoFeito` (vem de `POST /cardapio/pedido`, Task 2).

**Contexto importante:** este arquivo tem ~942 linhas de mudanças não
commitadas de uma tarefa diferente (redesign do checkout). As 3 edições
abaixo têm texto exato tirado do arquivo **atual** (working tree, com a
WIP já aplicada) — não do último commit. Ler o arquivo antes de editar
pra confirmar que os trechos batem exatamente; se algum não bater, é
sinal de que a WIP mudou de novo nesse meio-tempo — parar e reportar
BLOCKED com o que foi encontrado, em vez de aproximar.

- [ ] **Step 1: Resposta do pedido — trocar `recompensa_descricao` por `brinde_resgatado`**

Localizar (dentro da função que envia o pedido, depois do `fetch` de
`POST /cardapio/pedido`):

```jsx
      setPedidoFeito({ id: data.id, numero: data.numero, total: data.total, desconto: calcDesconto(), telefone: form.telefone, pagamento: form.pagamento, fidelidade: data.fidelidade, ganhou_recompensa: data.ganhou_recompensa, recompensa_descricao: data.recompensa_descricao });
```

Trocar por:

```jsx
      setPedidoFeito({ id: data.id, numero: data.numero, total: data.total, desconto: calcDesconto(), telefone: form.telefone, pagamento: form.pagamento, fidelidade: data.fidelidade, ganhou_recompensa: data.ganhou_recompensa, brinde_resgatado: data.brinde_resgatado });
```

- [ ] **Step 2: Banner de confirmação — unificar em torno de `brinde_resgatado`**

Localizar o bloco (tela de confirmação do pedido, dois cards em
sequência — "Card recompensa ganha" e "Card fidelidade"):

```jsx
          {/* Card recompensa ganha */}
          {pedidoFeito.ganhou_recompensa && (
            <div className="rounded-2xl p-4 mb-3 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.08))', border: '2px solid rgba(251,191,36,0.4)', boxShadow: '0 0 24px rgba(251,191,36,0.15)' }}>
              <div className="flex justify-center mb-2 text-yellow-400"><Gift size={34} strokeWidth={1.6} /></div>
              <p className="font-black text-yellow-400 text-base">Parabéns! Você ganhou um brinde!</p>
              <p className="text-xs text-yellow-300/70 mt-1">{pedidoFeito.recompensa_descricao}</p>
              <p className="text-[10px] text-zinc-500 mt-2">Informe ao atendente ao receber o pedido</p>
            </div>
          )}

          {/* Card fidelidade */}
          {fid && !pedidoFeito.ganhou_recompensa && (
```

Trocar por:

```jsx
          {/* Card brinde resgatado automaticamente */}
          {pedidoFeito.brinde_resgatado && (
            <div className="rounded-2xl p-4 mb-3 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.15), rgba(245,158,11,0.08))', border: '2px solid rgba(251,191,36,0.4)', boxShadow: '0 0 24px rgba(251,191,36,0.15)' }}>
              <div className="flex justify-center mb-2 text-yellow-400"><Gift size={34} strokeWidth={1.6} /></div>
              <p className="font-black text-yellow-400 text-base">
                {pedidoFeito.ganhou_recompensa ? 'Parabéns! Você completou o ciclo e ganhou um brinde!' : 'Você tinha um brinde disponível!'}
              </p>
              <p className="text-xs text-yellow-300/70 mt-1">{pedidoFeito.brinde_resgatado.nome} grátis — já incluso no seu pedido 🎁</p>
            </div>
          )}

          {/* Card fidelidade */}
          {fid && !pedidoFeito.brinde_resgatado && (
```

Não muda mais nada dentro do "Card fidelidade" (o conteúdo do card de
progresso continua idêntico — só a condição que decide se ele aparece
mudou, de `!ganhou_recompensa` pra `!brinde_resgatado`). Esse card já
mostra "🎁 Brinde disponível!" quando `fid.proximo_em === 0`, então o
caso "ganhou mas não configurou item" cai de volta nesse mesmo aviso —
sem precisar de um terceiro card.

- [ ] **Step 3: Mensagem no cartão de fidelidade do checkout (antes de confirmar o pedido)**

Localizar:

```jsx
                    <div className="px-4 pb-4">
                      {fid.recompensas_disponiveis > 0 ? (
                        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                          style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.06))', border: '1px solid rgba(251,191,36,0.25)' }}>
                          <Gift size={14} strokeWidth={1.75} style={{ color: '#fbbf24' }} className="shrink-0" />
                          <p className="text-[11px] font-medium leading-snug" style={{ color: '#fde68a' }}>
                            Você tem um brinde! Informe ao atendente ao retirar.
                          </p>
                        </div>
                      ) : (
```

Trocar por:

```jsx
                    <div className="px-4 pb-4">
                      {fid.recompensas_disponiveis > 0 ? (
                        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
                          style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(245,158,11,0.06))', border: '1px solid rgba(251,191,36,0.25)' }}>
                          <Gift size={14} strokeWidth={1.75} style={{ color: '#fbbf24' }} className="shrink-0" />
                          <p className="text-[11px] font-medium leading-snug" style={{ color: '#fde68a' }}>
                            {clienteEncontrado?.brinde_item_nome
                              ? <>Seu brinde <strong>{clienteEncontrado.brinde_item_nome}</strong> entra automático no seu pedido! 🎁</>
                              : 'Você tem um brinde disponível! Ele será resgatado automaticamente assim que a loja configurar o item.'}
                          </p>
                        </div>
                      ) : (
```

- [ ] **Step 4: Lint**

```bash
cd frontend && npm run lint
```

Esperado: `0 errors` (a mesma contagem de warnings pré-existentes de
antes desta tarefa é aceitável — não introduzir warning novo).

- [ ] **Step 5: Verificação local**

Se a ferramenta de browser estiver disponível: rodar o cardápio local
(`npm run dev` no frontend), simular um cliente com telefone que tenha
`recompensas_disponiveis > 0` (usar um telefone de teste já ajustado via
`/fidelidade/ajustar` na Task 2), confirmar que o texto novo aparece no
cartão de fidelidade do checkout. Se travar, reportar e confiar em
lint + revisão de código — a Task 5 faz a verificação visual final
completa (incluindo pedido de ponta a ponta).

- [ ] **Step 6: Commit — arquivo inteiro, mensagem transparente**

Conforme os Global Constraints: este arquivo não permite git-surgery
limpo (a WIP já reescreveu o texto que esta tarefa edita). Commitar o
estado atual do arquivo inteiro como está, comentando isso na mensagem.

```bash
git add frontend/src/pages/Cardapio.jsx
git commit -m "$(cat <<'EOF'
feat: cliente vê e recebe o brinde de fidelidade automático no cardápio

Inclui também uma redesign não relacionada do checkout que já estava em
andamento sem commit neste arquivo — entrelaçada com o texto do cartão
de fidelidade que esta tarefa precisou editar, sem como separar por
git-surgery sem reconstruir um estado que nunca existiu de verdade
(mesma situação do Cashback.jsx, Task 5 do plano anterior desta sessão).
EOF
)"
```

---

## Task 5: Verificação end-to-end e deploy

**Files:** nenhum (só verificação e deploy)

**Interfaces:** Consumes tudo das Tasks 1-4.

- [ ] **Step 1: Subir backend e frontend localmente**

```bash
cd backend && npm run dev
```

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Fluxo completo — configurar, ganhar, resgatar**

1. Em `/clientes`, configurar um item real como brinde (painel novo).
2. Escolher (ou criar) um cliente de teste local com `total_pedidos`
   terminando em 9 (falta 1 pro ciclo fechar) — ou usar
   `/fidelidade/ajustar` pra deixar `recompensas_disponiveis > 0`
   diretamente.
3. No cardápio público (`/cardapio` local), fazer um pedido de teste com
   o telefone desse cliente. Conferir:
   - O cartão de fidelidade no checkout mostra a mensagem nova (com o
     nome do item, se configurado).
   - Depois de confirmar, a tela de confirmação mostra o banner de
     brinde resgatado com o nome certo.
4. Conferir no admin (`/clientes`, ficha do cliente ou
   `GET /api/clientes`) que `recompensas_usadas` subiu e o pedido criado
   tem a linha extra do item grátis (`GET /api/clientes/:id/pedidos` ou
   olhando o pedido direto no PDV).

- [ ] **Step 3: Casos de borda**

1. Sem item configurado (`PUT /fidelidade/config` com `item_id: null`):
   fazer um pedido de um cliente com saldo disponível — confirmar que o
   pedido é criado normalmente, sem `brinde_resgatado`, e o saldo
   **não** foi consumido (confere de novo depois: ainda disponível).
2. Cliente com 2 brindes disponíveis: confirmar que só 1 é aplicado no
   pedido, o outro continua disponível pro próximo.

- [ ] **Step 4: Lint final nos dois pacotes**

```bash
cd backend && npm run lint
cd frontend && npm run lint
```

Esperado: `0 errors` nos dois.

- [ ] **Step 5: Deploy**

Mesma receita já validada nesta sessão (deploy manual via scp pra
`root@2.25.207.3`, `/opt/37sushi/paranav*/app/`):

1. Backup do banco de produção antes (schema novo:
   `CREATE TABLE fidelidade_config`):
   ```bash
   ssh root@2.25.207.3 'cp /opt/37sushi/paranav*/data/sushi.db /root/sushi-REAL.db.pre-brinde-auto-$(date +%Y%m%d-%H%M%S)'
   ```
2. Copiar os arquivos de backend modificados/novos (`index.js`,
   `cardapio.js`, `fidelidade.js`) pra
   `/opt/37sushi/paranav*/app/backend/src/...` via `/tmp` (usar o glob
   `paranav*` — o acento corrompe scp direto).
3. `node --check` em cada arquivo copiado antes de reiniciar.
4. `pm2 restart 0 --update-env` e conferir `pm2 logs 0 --lines 15
   --nostream` sem erro de `MODULE_NOT_FOUND` ou sintaxe.
5. Testar via curl em produção com um cliente real (gerar token no
   servidor, `tail -1` pra descartar o banner do dotenv no stdout — ver
   `deploy_vps_topologia_real` se precisar do passo-a-passo) — configurar
   um item, ajustar o saldo de um cliente de teste real via
   `/fidelidade/ajustar`, simular um pedido, confirmar
   `brinde_resgatado`, reverter o ajuste de teste.
6. `cd frontend && npm run build` local, empacotar `dist/` (sem as
   pastas `cardapio/`/`banners/` de upload), subir e trocar com
   `chmod -R a+rX dist`.
7. Testar no ar: abrir `/clientes`, conferir o painel de brinde; abrir
   `/cardapio`, conferir a mensagem do cartão de fidelidade — usar a
   técnica de injetar um JWT autoassinado no `localStorage['sushi_token']`
   pra entrar no admin sem saber a senha real de produção (mesma técnica
   já validada nesta sessão), se o navegador travar em `localhost`
   testar direto contra `37sushi.com.br` numa aba nova.

- [ ] **Step 6: Commit final (se sobrou algo não commitado)**

```bash
git status
```

Se tudo já foi commitado nas Tasks 1-4, não há o que fazer aqui.
