# Fornecedores + Lançar por Foto + Sidebar sem painel

## Contexto
Duas features já existem, prontas, no fork `ninjacontrol` (SaaS sem-PDV) e nunca foram portadas de volta pro `sushi-finance` (PDV em produção): comparador de preços por fornecedor e lançamento de despesa por foto de comprovante. Além disso, a sidebar do `sushi-finance` tem uma mudança **não commitada** que trocou a navegação direta por um painel central ("launcher") — o dono quer essa mudança revertida.

Os dois repositórios não compartilham histórico git (fork por cópia de arquivos), então o port é manual, não merge/cherry-pick.

## 1. Módulo Fornecedores
Comparador de preço de insumo por fornecedor, com pedido pronto via `wa.me`.

- **Backend:** copiar `ninjacontrol/backend/src/routes/fornecedores.js` → `sushi-finance/backend/src/routes/fornecedores.js` sem alterações (não é tenant-scoped no código, usa só o facade `db`). Tabelas `forn_fornecedores`, `forn_itens`, `forn_precos` criadas via `router.use` no boot + seed de ~45 insumos clássicos do sushi.
- Montar em `backend/src/index.js`: `app.use('/api/fornecedores', requireAuth, require('./routes/fornecedores'))` — mesmo padrão dos outros módulos autenticados.
- **Frontend:** copiar `ninjacontrol/frontend/src/pages/Fornecedores.jsx` → mesmo caminho em `sushi-finance`. 3 visões: Comparar (cards por item, 🏆 mais barato editável inline), Tabela (matriz item×fornecedor), Fornecedores (cadastro + telefone + montar pedido).
- Rota `/fornecedores` no `App.jsx`, lazy-loaded como as demais páginas internas.
- Entrada de menu no grupo **Gestão** (mesmo grupo usado no ninjacontrol), ícone `Boxes` ou similar já disponível no lucide-react já importado.

## 2. Lançar por Foto
Botão na página Despesas: tira/sobe foto de cupom ou boleto, IA (Vision) lê e distingue o tipo, mostra preview editável antes de gravar.

- `backend/src/services/assistenteDono.js`: as funções `analisarImagem`, `gravarBoleto`, `gravarDespesa` **já existem** no sushi-finance, só não estão exportadas. Adicionar ao `module.exports` (hoje só exporta `ehDono, processarMensagemDono`).
- `backend/src/routes/despesas.js`: copiar os 2 endpoints do ninjacontrol —
  - `POST /comprovante/analisar` (multipart `foto`, multer memoryStorage 15MB) → chama `analisarImagem`, não grava, devolve preview.
  - `POST /comprovante/confirmar` (JSON `{tipo, dados}`) → `gravarBoleto` ou `gravarDespesa`.
- `frontend/src/components/LancarPorFoto.jsx`: copiar do ninjacontrol (usa `api` client e `react-hot-toast`, ambos já presentes no sushi-finance — nenhuma dependência nova).
- `frontend/src/pages/Despesas.jsx`: importar e renderizar `<LancarPorFoto onSaved={...} />` ao lado do botão "+ Nova Despesa" (linha ~152), recarregando a lista do mês ao salvar.

## 3. Sidebar: reverter o "painel", tudo visível
Estado atual (não commitado) troca a navegação direta por uma sidebar de só-categorias que abre um launcher central em tela cheia. Reverter para o padrão commitado (`NavGroup`: cabeçalho de grupo + `NavLink`s direto na sidebar), com uma mudança: **sem accordion** — todos os grupos sempre expandidos, sem clique pra abrir.

- Remover `NavCategorias`, `CategoriaBtn`, `LauncherInline` e o estado/rota que abre o launcher em `App.jsx`.
- Restaurar renderização tipo `NavGroup` (grupo com linha divisória + ícone + label, itens abaixo sempre visíveis) mas sem o `useState(abertos)` / toggle / `ChevronDown` — todo grupo renderiza seus itens incondicionalmente.
- Mantém drag-to-reorder dos grupos se já existir no código revertido (não é o foco do pedido, mas não deve quebrar).
- Adicionar entrada "Fornecedores" ao grupo Gestão como parte dessa reescrita.

## Fora de escopo
- Import de faturamento por IA (não relevante — o PDV já tem venda real).
- Cobrança/billing (não se aplica ao PDV).
- Qualquer coisa relacionada às mudanças de rebrand/SKU/multi-tenant do ninjacontrol.
- O diff de 91 arquivos não commitados hoje no sushi-finance (Prettier/ESLint setup, editor Fabric.js, etc.) — não será tocado nem commitado por esta tarefa.

## Teste manual
Rodar `cd backend && npm run dev` + `cd frontend && npm run dev`, login `sushi123`:
1. Sidebar mostra todos os 6 grupos sempre expandidos, sem tela de painel ao clicar num grupo.
2. `/fornecedores` abre, cadastra fornecedor, edita preço de item, sem erro no console.
3. Despesas → botão "Lançar por Foto" → upload de uma imagem de teste → preview aparece → confirma → despesa aparece na lista do mês.
