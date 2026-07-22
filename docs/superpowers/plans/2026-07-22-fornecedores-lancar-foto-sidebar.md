# Fornecedores + Lançar por Foto + Sidebar sem painel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portar o módulo Fornecedores e o "Lançar por Foto" do ninjacontrol pro sushi-finance (PDV), e reverter a sidebar da mudança não commitada de "launcher central" para navegação direta com todos os grupos sempre visíveis.

**Architecture:** Port manual arquivo-a-arquivo (os dois repos não compartilham histórico git). Backend Express + SQLite (`node:sqlite`) via singleton `db`; frontend React 18 + Vite, rotas lazy-loaded, cliente HTTP único em `api/client.js`.

**Tech Stack:** Node 22 / Express / `node:sqlite`, React 18 / React Router v6 / lucide-react / react-hot-toast, multer (já presente).

## Global Constraints
- Não tocar nos 91 arquivos já modificados/não commitados no `sushi-finance` (Prettier/ESLint setup, editor Fabric.js, etc.) — cada task só faz `git add` dos arquivos que ela própria criou/editou.
- Sem framework de teste automatizado neste repo (`backend/package.json` e `frontend/package.json` não têm script `test`) — verificação é manual: `curl` pro backend, servidor dev + navegador pro frontend. Não introduzir Jest/Vitest/Supertest — fora de escopo.
- Node/porta: backend em `:3001` (`cd backend && npm run dev`), frontend Vite em `:3000` com proxy (`cd frontend && npm run dev`). Login `sushi123`.
- Seguir o padrão de rota já existente em `backend/src/index.js`: `const xRouter = require('./routes/x');` no topo + `app.use('/api/x', xRouter)` depois da linha `app.use('/api', requireAuth)` (linha 188) — sem passar `requireAuth` nas rotas individuais, o middleware global já cobre.

---

### Task 1: Backend — endpoints de Lançar por Foto

**Files:**
- Modify: `backend/src/services/assistenteDono.js:237`
- Modify: `backend/src/routes/despesas.js:179` (antes de `module.exports`)

**Interfaces:**
- Consumes: `assistenteDono.analisarImagem(base64, mime)` (já existe, `backend/src/services/assistenteDono.js:203`, retorna `{tipo, valor, ...}` ou lança erro), `assistenteDono.gravarBoleto(dados)` (linha 148, retorna `bool`), `assistenteDono.gravarDespesa(dados)` (linha 168, retorna `{ok, itens}`).
- Produces: `POST /api/despesas/comprovante/analisar` (multipart `foto`) → `200 {tipo, valor, ...}` | `422` | `400` | `503`. `POST /api/despesas/comprovante/confirmar` (JSON `{tipo, dados}`) → `200 {ok:true, tipo, mensagem}` | `400` | `500`.

- [ ] **Step 1: Exportar as 3 funções em `assistenteDono.js`**

Editar a linha 237 de:
```js
module.exports = { ehDono, processarMensagemDono };
```
para:
```js
module.exports = { ehDono, processarMensagemDono, analisarImagem, gravarBoleto, gravarDespesa };
```

- [ ] **Step 2: Adicionar os 2 endpoints em `despesas.js`**

Inserir antes da linha `module.exports = router;` (atual linha 179):
```js
// ── Lançar por FOTO (comprovante OU boleto) — reusa a lógica do assistente ──
// Fluxo em 2 passos pra ter preview antes de gravar:
//   POST /comprovante/analisar  (multipart 'foto') → lê com Vision, NÃO grava
//   POST /comprovante/confirmar (JSON { tipo, dados }) → grava despesa OU boleto
let uploadFoto;
try {
  const multer = require('multer');
  uploadFoto = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
} catch (e) { console.error('[despesas] multer indisponível:', e.message); }

const assistente = require('../services/assistenteDono');

router.post('/comprovante/analisar', (req, res) => {
  if (!uploadFoto) return res.status(503).json({ erro: 'Upload indisponível (multer não instalado).' });
  uploadFoto.single('foto')(req, res, async (err) => {
    if (err) return res.status(400).json({ erro: err.message });
    if (!req.file) return res.status(400).json({ erro: 'Nenhuma foto enviada.' });
    try {
      const base64 = req.file.buffer.toString('base64');
      const dados = await assistente.analisarImagem(base64, req.file.mimetype);
      if (!dados || !dados.tipo || dados.tipo === 'desconhecido' || !dados.valor) {
        return res.status(422).json({ erro: 'Não consegui ler essa foto. Tente uma imagem mais nítida do boleto ou do comprovante.' });
      }
      res.json(dados); // { tipo:'boleto'|'comprovante', ...campos, itens? }
    } catch (e) {
      console.error('[despesas/comprovante/analisar]', e.message);
      res.status(500).json({ erro: 'Falha ao analisar a foto.' });
    }
  });
});

router.post('/comprovante/confirmar', (req, res) => {
  try {
    const { tipo, dados } = req.body || {};
    if (!dados || !dados.valor) return res.status(400).json({ erro: 'Dados incompletos.' });
    if (tipo === 'boleto') {
      const ok = assistente.gravarBoleto(dados);
      return ok
        ? res.json({ ok: true, tipo: 'boleto', mensagem: 'Boleto registrado.' })
        : res.status(500).json({ erro: 'Não consegui gravar o boleto.' });
    }
    // comprovante → despesa + itens + auto-vínculo (aprendizado)
    const r = assistente.gravarDespesa(dados);
    if (!r.ok) return res.status(500).json({ erro: 'Não consegui gravar a despesa.' });
    res.json({ ok: true, tipo: 'despesa', itens: r.itens || 0, mensagem: 'Despesa registrada.' });
  } catch (e) {
    console.error('[despesas/comprovante/confirmar]', e.message);
    res.status(500).json({ erro: e.message });
  }
});
```

- [ ] **Step 3: Reiniciar o backend e verificar os endpoints via curl**

Este backend usa `npm run dev` com nodemon (recarrega sozinho ao salvar o arquivo — não precisa matar processo). Se estiver usando `npm start` (produção), reiniciar manualmente.

```bash
cd backend
curl -s -X POST http://localhost:3001/api/despesas/comprovante/analisar \
  -H "Authorization: Bearer $(node -e "console.log(require('jsonwebtoken').sign({},'')||'')" 2>/dev/null || echo SEM_TOKEN)"
```
Expected (sem arquivo `foto` anexado, mesmo sem token válido o multer roda antes da validação de auth pra rota devolver o erro de payload — se vier 401 primeiro, use um token válido obtido via `POST /api/auth/login` com `{"senha":"sushi123"}`):
```json
{"erro":"Nenhuma foto enviada."}
```
Rodar o login pra pegar token de verdade e confirmar o fluxo completo:
```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"senha":"sushi123"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")
curl -s -X POST http://localhost:3001/api/despesas/comprovante/analisar -H "Authorization: Bearer $TOKEN"
```
Expected: `{"erro":"Nenhuma foto enviada."}` (400) — confirma que a rota existe, está autenticada corretamente e a validação de arquivo funciona. O teste com foto real de verdade acontece no Task 2 (fluxo completo pela UI).

- [ ] **Step 4: Commit**

```bash
git add backend/src/services/assistenteDono.js backend/src/routes/despesas.js
git commit -m "$(cat <<'EOF'
feat: exporta funções do assistente e adiciona endpoints de lançar despesa/boleto por foto

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Frontend — componente Lançar por Foto

**Files:**
- Create: `frontend/src/components/LancarPorFoto.jsx` (copiado de `../../ninjacontrol/frontend/src/components/LancarPorFoto.jsx`)
- Modify: `frontend/src/pages/Despesas.jsx:1-13` (imports), `:57` (destructuring do hook), `:152-156` (botão)

**Interfaces:**
- Consumes: `POST /api/despesas/comprovante/analisar`, `POST /api/despesas/comprovante/confirmar` (Task 1). `api` client de `../api/client` (idêntico entre os dois repos — sem adaptação).
- Produces: `<LancarPorFoto onSaved={fn} />` — componente default export, sem outras props.

- [ ] **Step 1: Copiar o componente**

```bash
cp "../ninjacontrol/frontend/src/components/LancarPorFoto.jsx" "frontend/src/components/LancarPorFoto.jsx"
```
(rodar a partir da raiz de `sushi-finance`; ajustar o caminho relativo se o shell não estiver nessa pasta)

- [ ] **Step 2: Verificar que não há import quebrado**

```bash
grep -n "^import" frontend/src/components/LancarPorFoto.jsx
```
Expected: só `react`, `lucide-react`, `react-hot-toast`, `../api/client` — todos já são dependências do `sushi-finance` (confirmado: `react-hot-toast` em `frontend/package.json`). Nenhum import de arquivo exclusivo do ninjacontrol (branding, tenant, etc.) — se aparecer algo assim, remover/adaptar antes de seguir.

- [ ] **Step 3: Importar e usar `buscar` em `Despesas.jsx`**

Editar a linha 57 de:
```js
  const { despesas, online, syncing, loading, qtdFila, criarDespesa, editarDespesa, excluirDespesa } = useDespesasOffline(mes);
```
para:
```js
  const { despesas, online, syncing, loading, qtdFila, buscar, criarDespesa, editarDespesa, excluirDespesa } = useDespesasOffline(mes);
```
(`buscar` já é retornado pelo hook em `frontend/src/hooks/useDespesasOffline.js:236` — só faltava ser desestruturado aqui.)

Adicionar o import no topo (depois da linha 4 `import ConfirmDialog...`):
```js
import LancarPorFoto from '../components/LancarPorFoto';
```

- [ ] **Step 4: Renderizar o botão ao lado de "Nova Despesa"**

Editar as linhas 152-156 de:
```jsx
          <button onClick={abrirNovo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm text-white transition-all active:scale-95"
            style={{ background:'var(--accent)', boxShadow:'0 2px 12px rgba(var(--accent-rgb),0.3)' }}>
            <Plus size={16} strokeWidth={2.5} /> Nova Despesa
          </button>
```
para:
```jsx
          <LancarPorFoto onSaved={() => buscar(mes)} />
          <button onClick={abrirNovo}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm text-white transition-all active:scale-95"
            style={{ background:'var(--accent)', boxShadow:'0 2px 12px rgba(var(--accent-rgb),0.3)' }}>
            <Plus size={16} strokeWidth={2.5} /> Nova Despesa
          </button>
```

- [ ] **Step 5: Verificar no navegador**

Com `cd backend && npm run dev` e `cd frontend && npm run dev` rodando, abrir `http://localhost:3000/despesas`, logar com `sushi123`.
Expected: botão "Lançar por Foto" (ou ícone de câmera, conforme o componente copiado) aparece ao lado de "+ Nova Despesa". Clicar nele abre o fluxo de escolha câmera/arquivo sem erro no console do navegador. Fazer upload de uma imagem qualquer de teste (não precisa ser um comprovante real) e confirmar que a chamada para `/api/despesas/comprovante/analisar` acontece (checar aba Network) — se a chave Anthropic não estiver configurada em `backend/.env`, a análise pode falhar com 500/422, o que é esperado nesse ambiente; o importante é confirmar que a UI e a rota estão plugadas corretamente.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/LancarPorFoto.jsx frontend/src/pages/Despesas.jsx
git commit -m "$(cat <<'EOF'
feat: adiciona botão Lançar por Foto na página de Despesas

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Backend — rota Fornecedores

**Files:**
- Create: `backend/src/routes/fornecedores.js` (copiado de `../ninjacontrol/backend/src/routes/fornecedores.js`, sem alterações — não é tenant-scoped)
- Modify: `backend/src/index.js` (require no topo + `app.use`)

**Interfaces:**
- Produces: `GET /api/fornecedores/dados`, `POST /api/fornecedores/fornecedor`, `PATCH /api/fornecedores/fornecedor/:id`, `DELETE /api/fornecedores/fornecedor/:id`, `POST /api/fornecedores/item`, `PATCH /api/fornecedores/item/:id`, `DELETE /api/fornecedores/item/:id`, `PUT /api/fornecedores/preco`.

- [ ] **Step 1: Copiar o arquivo**

```bash
cp "../ninjacontrol/backend/src/routes/fornecedores.js" "backend/src/routes/fornecedores.js"
```

- [ ] **Step 2: Confirmar que não referencia nada tenant-specific**

```bash
grep -n "tenant\|req\.tenant\|AsyncLocalStorage" backend/src/routes/fornecedores.js
```
Expected: nenhum resultado (o arquivo só usa `db.prepare`/`db.exec` diretos, compatível com o singleton do sushi-finance).

- [ ] **Step 3: Montar a rota em `index.js`**

Adicionar depois da linha 12 (`const despesasRouter = require('./routes/despesas');`):
```js
const fornecedoresRouter = require('./routes/fornecedores');
```
Adicionar depois da linha `app.use('/api/despesas', despesasRouter);` (linha 194):
```js
app.use('/api/fornecedores', fornecedoresRouter);
```

- [ ] **Step 4: Verificar via curl**

```bash
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d '{"senha":"sushi123"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")
curl -s http://localhost:3001/api/fornecedores/dados -H "Authorization: Bearer $TOKEN"
```
Expected: JSON com `{"fornecedores":[],"itens":[...45 itens seedados...],"precos":[]}` — confirma que as tabelas foram criadas e o seed rodou no primeiro request.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/fornecedores.js backend/src/index.js
git commit -m "$(cat <<'EOF'
feat: porta rota de comparador de preços por fornecedor do ninjacontrol

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Frontend — página Fornecedores

**Files:**
- Create: `frontend/src/pages/Fornecedores.jsx` (copiado de `../ninjacontrol/frontend/src/pages/Fornecedores.jsx`)
- Modify: `frontend/src/App.jsx` (lazy import + rota — sem entrada de menu ainda, isso é Task 5)

**Interfaces:**
- Consumes: endpoints do Task 3.
- Produces: rota `/fornecedores` acessível por URL direta.

- [ ] **Step 1: Copiar o arquivo**

```bash
cp "../ninjacontrol/frontend/src/pages/Fornecedores.jsx" "frontend/src/pages/Fornecedores.jsx"
```

- [ ] **Step 2: Confirmar imports compatíveis**

```bash
grep -n "^import" frontend/src/pages/Fornecedores.jsx
```
Expected: `react`, `lucide-react` (ícones), `../api/client`, `react-hot-toast` (ou similar) — nada exclusivo de branding/tenant do ninjacontrol.

- [ ] **Step 3: Adicionar lazy import em `App.jsx`**

Adicionar depois da linha 43 (`const Insumos = React.lazy(() => import('./pages/Insumos'));`):
```js
const Fornecedores     = React.lazy(() => import('./pages/Fornecedores'));
```

- [ ] **Step 4: Adicionar a rota**

Adicionar depois da linha `<Route path="/insumos" element={<Insumos />} />` (linha 774):
```jsx
              <Route path="/fornecedores" element={<Fornecedores />} />
```

- [ ] **Step 5: Verificar no navegador (acesso direto por URL)**

Com os dois servidores dev rodando e logado, navegar direto para `http://localhost:3000/fornecedores`.
Expected: página carrega sem erro no console, mostra as 3 visões (Comparar/Tabela/Fornecedores) com os ~45 insumos clássicos já listados (do seed do Task 3). Cadastrar um fornecedor de teste e um preço, confirmar que persiste ao recarregar a página.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Fornecedores.jsx frontend/src/App.jsx
git commit -m "$(cat <<'EOF'
feat: adiciona página Fornecedores (rota direta, sem entrada de menu ainda)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Sidebar — reverter o painel, todos os grupos sempre visíveis

**Files:**
- Modify: `frontend/src/App.jsx:3-4` (remover imports dnd-kit), `:11` (adicionar ícone `Truck`), `:132-144` (adicionar item Fornecedores no grupo Gestão), `:260-461` (substituir `ordenarGrupos`/`CategoriaBtn`/`NavCategorias`/`LauncherInline` por `NavGroup`), `:463-529` (`Sidebar`), `:674-761` (`Layout`)

**Interfaces:**
- Produces: `<NavGroup onClose={fn} />` — substitui `<NavCategorias onPick={fn} ativoGrupo={g} />`. `Sidebar({ open, onClose })` — remove as props `onPickCategoria`/`launcherGrupo`.

- [ ] **Step 1: Remover os imports do dnd-kit (não usados fora do código sendo removido)**

Remover as linhas 3-4:
```js
import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
```
(a 3ª linha, `CSS` de `@dnd-kit/utilities`, está logo abaixo das duas primeiras — remover as três).

- [ ] **Step 2: Adicionar o ícone `Truck` ao import do lucide-react**

Na linha 11, adicionar `Truck` à lista:
```js
  LogOut, Menu, ChevronDown, Circle, Calculator, ChefHat, Pin, Plus, Check, ArrowDownUp, PieChart, Coins, Sparkles, X, Landmark, Truck,
```

- [ ] **Step 3: Adicionar "Fornecedores" ao grupo Gestão em `NAV_GRUPOS`**

Editar o bloco do grupo Gestão (linhas 132-144) de:
```js
  {
    grupo: 'Gestão',
    cor: '#818cf8',
    icone: Boxes,
    itens: [
      { to: '/ingredientes',     icon: Beef,       label: 'Ingredientes'    },
      { to: '/fichas',           icon: FileText,   label: 'Fichas Técnicas' },
      { to: '/rendimento',       icon: Fish,       label: 'Rendimento'      },
      { to: '/insumos',          icon: Boxes,      label: 'Insumos'         },
      { to: '/importar-cardapio', icon: Upload,     label: 'Importar Cardápio'  },
      { to: '/importar-clientes', icon: Users,     label: 'Importar Clientes'  },
      { to: '/whatsapp',          icon: Smartphone, label: 'Config WhatsApp'   },
    ],
  },
```
para:
```js
  {
    grupo: 'Gestão',
    cor: '#818cf8',
    icone: Boxes,
    itens: [
      { to: '/ingredientes',     icon: Beef,       label: 'Ingredientes'    },
      { to: '/fichas',           icon: FileText,   label: 'Fichas Técnicas' },
      { to: '/fornecedores',     icon: Truck,      label: 'Fornecedores'    },
      { to: '/rendimento',       icon: Fish,       label: 'Rendimento'      },
      { to: '/insumos',          icon: Boxes,      label: 'Insumos'         },
      { to: '/importar-cardapio', icon: Upload,     label: 'Importar Cardápio'  },
      { to: '/importar-clientes', icon: Users,     label: 'Importar Clientes'  },
      { to: '/whatsapp',          icon: Smartphone, label: 'Config WhatsApp'   },
    ],
  },
```

- [ ] **Step 4: Substituir `ordenarGrupos`/`CategoriaBtn`/`NavCategorias`/`LauncherInline` por `NavGroup` sem accordion**

Remover inteiramente o bloco das linhas 260-461 (do comentário `// Ordena os grupos...` até o fechamento de `LauncherInline`, `}` antes de `function Sidebar`) e colocar no lugar:
```jsx
// Barra lateral: todos os grupos sempre abertos, links direto (sem painel central).
function NavGroup({ onClose }) {
  const location = useLocation();

  return (
    <div className="mt-1 space-y-1">
      {NAV_GRUPOS.map(({ grupo, cor, itens }) => {
        const isGrupoAtivo = itens.some(n => location.pathname.startsWith(n.to));
        return (
          <div key={grupo}>
            <div className="flex items-center gap-2.5 px-2 pt-3 pb-1.5">
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.18em', color: isGrupoAtivo ? cor : 'var(--txt-faint)', textTransform: 'uppercase' }}>{grupo}</span>
              <div className="h-px flex-1" style={{ background: isGrupoAtivo ? `linear-gradient(90deg, ${cor}40, transparent)` : 'var(--hairline-soft)' }} />
            </div>

            <div className="space-y-0.5">
              {itens.map(({ to, icon: Icon, label, badge }) => (
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
                      <span className="leading-none transition-colors flex-1"
                        style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? 'var(--txt-strong)' : 'var(--txt)' }}>
                        {label}
                      </span>
                      {badge && (
                        <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
                          style={{ background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b44' }}>
                          {badge}
                        </span>
                      )}
                    </div>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```
(essa versão remove o `useState(abertos)`, o `toggle`, o botão com `ChevronDown` e o `fixo` do `NavGroup` original commitado — todo grupo renderiza os itens direto, sempre.)

- [ ] **Step 5: Atualizar `Sidebar` para usar `NavGroup`**

Editar a assinatura da função (linha 463) de:
```js
function Sidebar({ open, onClose, onPickCategoria, launcherGrupo }) {
```
para:
```js
function Sidebar({ open, onClose }) {
```
E a linha 516 de:
```jsx
          <NavCategorias onPick={g => { onPickCategoria(g); onClose(); }} ativoGrupo={launcherGrupo} />
```
para:
```jsx
          <NavGroup onClose={onClose} />
```

- [ ] **Step 6: Remover o estado/render do launcher em `Layout`**

Remover a linha 679:
```js
  const [launcherGrupo, setLauncherGrupo] = useState(null);
```
Remover o `useEffect` da linha 685:
```js
  useEffect(() => { setLauncherGrupo(null); }, [location.pathname]);
```
Editar as linhas 710-711 de:
```jsx
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
          onPickCategoria={setLauncherGrupo} launcherGrupo={launcherGrupo} />
```
para:
```jsx
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
```
Editar as linhas 755-758 de:
```jsx
            {launcherGrupo ? (
              <LauncherInline grupo={launcherGrupo} onClose={() => setLauncherGrupo(null)} />
            ) : (
            <RotaErrorBoundary rotaKey={location.pathname}>
```
para:
```jsx
            <RotaErrorBoundary rotaKey={location.pathname}>
```
E editar as linhas 801-803 (o fechamento correspondente ao ternário removido, logo depois de `</Routes>`) de:
```jsx
            </React.Suspense>
            </RotaErrorBoundary>
            )}
```
para:
```jsx
            </React.Suspense>
            </RotaErrorBoundary>
```
(o `<React.Suspense>...<Routes>...</Routes></React.Suspense>` volta a ser o único filho direto de `<RotaErrorBoundary>`, sem o `)}` extra que fechava o ternário do launcher.)

- [ ] **Step 7: Rodar o lint do frontend**

```bash
cd frontend && npm run lint
```
Expected: `0 errors` (mesma meta do CLAUDE.md). Se aparecerem erros de variável não definida (`NavCategorias`, `LauncherInline`, `CategoriaBtn`, `ordenarGrupos` referenciados em algum lugar que a Step 4/6 não cobriu), corrigir antes de seguir.

- [ ] **Step 8: Verificar no navegador**

Com os servidores dev rodando, abrir `http://localhost:3000/dashboard`, logar com `sushi123`.
Expected:
1. A sidebar mostra os 6 grupos (Operação, Marketing, Financeiro, Relatórios, Gestão, Drone) com todos os itens visíveis de cara, sem precisar clicar em nada.
2. Clicar em qualquer item de qualquer grupo navega direto pra página — nenhuma tela de "painel"/launcher central aparece.
3. O grupo Gestão mostra "Fornecedores" na lista, entre "Fichas Técnicas" e "Rendimento"; clicar leva pra `/fornecedores`.
4. Nenhum erro no console do navegador.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "$(cat <<'EOF'
fix: reverte sidebar do launcher central pra navegação direta, todos os grupos sempre visíveis

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```
