# Motor de Promoções Automáticas — Design

## O problema

O faturamento do delivery cai quando não há promoção, mas montar promoção
consome tempo e cabeça do dono, então acaba não saindo. Quando sai, é no
"achismo": não há nada que impeça promover justamente o item de margem
apertada.

Os dados de julho/2026 (22 dias, R$74.848) mostram o alvo com clareza:

| Dia | Faturamento médio |
|---|---|
| Sexta | R$ 4.845 |
| Sábado | R$ 4.791 |
| Quarta | R$ 2.796 |
| Terça | R$ 2.649 |
| Domingo | R$ 2.557 |
| **Quinta** | **R$ 2.374** |

Sexta e sábado faturam ~2× os dias fracos. O dono confirmou que os dias
fracos são fracos por **falta de movimento** (loja aberta, equipe presente,
capacidade ociosa) — não por motivo estrutural. Logo, são recuperáveis.

**Objetivo:** um motor que monta sozinho a promoção dos 4 dias fracos, com
trava matemática que impede prejuízo, aprovação em um clique, ativação
automática no cardápio e medição honesta do resultado.

## Ativos já existentes (não serão reconstruídos)

- `cardapio_itens` já tem as colunas `preco_promo`, `promo_tag`, `promo_ativa`
- `cupons` (código, tipo percentual/fixo, mínimo, usos máximos, validade)
- Checkout público (`POST /api/cardapio/pedido`) já aplica cupom, cashback e
  brinde de fidelidade; `pdv_pedidos` já grava `desconto` e `cupom_codigo`
- 87 dos 101 itens ativos têm ficha técnica (média 6,1 ingredientes) → custo real
- Gerador de arte (`CriativoSocial`) já suporta Story 9:16 (1080×1920) com
  templates curados, área de foto e paletas

## Escopo

Este spec cobre **o motor** (cérebro, calendário, aplicação e medição), com
aprovação por tela web. A aprovação por WhatsApp, o envio da arte em alta
resolução e o modelo de permissões do assistente ficam para um **segundo
spec** (ver "Fora de escopo").

---

## Peça 1 — Catálogo de Margem

Serviço `backend/src/services/margemCatalogo.js`. Fonte única de verdade sobre
custo e confiabilidade de cada item.

Para cada item ativo calcula: preço de menu, custo real (soma da ficha
técnica), margem, CMV, e um **selo de confiança**:

| Selo | Critério | Uso pelo motor |
|---|---|---|
| `confiavel` | Tem ficha e CMV entre 10% e 45% | Liberado |
| `suspeito` | Tem ficha mas CMV < 10% ou > 60% | **Bloqueado** — ficha provavelmente incompleta |
| `sem_dado` | Sem ficha técnica | **Bloqueado** |

Hoje: ~60 itens `confiavel`, 2 `suspeito`, 14 `sem_dado`.

O motor **nunca** promove item bloqueado. A tela de aprovação exibe a lista de
bloqueados para o dono corrigir as fichas quando quiser — o sistema prefere
dizer "não sei o custo" a chutar.

Exporta também `melhoresBrindes()`: itens `confiavel` ordenados pela razão
valor-percebido ÷ custo-real. Hoje o topo é o Nigiri Poró Brie (R$20 de menu,
R$2,22 de custo).

**Interface:**
- `catalogoMargem()` → `[{ id, nome, preco, custo, cmv, margem, selo }]`
- `melhoresBrindes(limite)` → itens `confiavel` ordenados por `preco/custo` desc
- `cmvMediana()` → mediana do CMV dos itens `confiavel` (hoje 30,8%)

## Peça 2 — Motor de Ofertas

Serviço `backend/src/services/motorPromocoes.js`. Função pura: recebe contexto,
devolve oferta candidata com a conta explicada. Não escreve no banco.

### Mecânicas do v1

**`brinde_por_valor`** — "Peça acima de R$X e leve [item]"
A mecânica principal, indicada pelo dono como a que mais converte. Vantagem
sobre desconto: não reduz a receita de quem compraria de qualquer forma, e um
gatilho acima do ticket médio (hoje ~R$105) empurra o cliente a adicionar item
para alcançá-lo.

**`brinde_por_item`** — "Peça [item A] e leve [item B]"
Mesma família, reaproveita a mesma trava. Útil para girar um item específico.

**`desconto_item`** — usa `preco_promo` do cardápio, que já existe.
Melhor apelo visual para Story ("de R$37 por R$24").

### A trava de lucro

Piso de margem configurável, **padrão 60%**.

Para `desconto_item` a conta é exata, porque o item é conhecido:

```
preco_promo_minimo = custo / (1 - piso)
```

Exemplo real: Uramaki Ostra Brie, preço R$37, custo R$4,12, piso 60% →
mínimo R$10,30. Cabe desconto até R$10,30. Já um item com CMV 40% e preço
R$40 → mínimo R$40,00, ou seja, **não cabe desconto nenhum** e o motor o
recusa automaticamente.

Para as mecânicas de brinde o cesto não é conhecido de antemão, então o teto
usa o CMV mediano real do cardápio confiável:

```
custo_maximo_brinde = gatilho × (1 - cmv_mediana - piso)
```

Com piso 60% e CMV mediana 30,8% → o brinde pode custar até **9,2% do
gatilho**. Gatilho R$130 → brinde de até R$11,96. O Nigiri Poró Brie (R$2,22)
cabe com folga de 5×.

**Limitação assumida e documentada:** o percentil 90 do CMV é 51,2%. Um cesto
composto majoritariamente por esses itens caros fica abaixo do piso mesmo sem
brinde algum — nenhuma promoção pode consertar isso. O motor calcula pelo cesto
típico, e a Peça 5 reporta a **margem realizada de verdade**, para que o dono
veja a diferença e ajuste gatilho ou piso com base em fato, não em estimativa.
Uma trava adicional impede que o custo do brinde passe de 12% do gatilho, mesmo
que a fórmula permita.

### Rotação

Item usado em promoção entra em **quarentena de 3 semanas** e a mecânica usada
não se repete na semana seguinte. Objetivo: variedade ("de tudo um pouco"),
evitando fadiga do público e a leitura de que "aquilo ali vive em promoção".

**Interface:**
- `gerarOferta({ diaSemana, piso, itensEmQuarentena, mecanicasRecentes })`
  → `{ mecanica, item_id, brinde_item_id, gatilho, preco_promo, custo_estimado, margem_projetada, justificativa }`
  ou `null` se nenhuma oferta segura for possível

## Peça 3 — Calendário Semanal

Tabela nova `promo_calendario`:

```sql
CREATE TABLE IF NOT EXISTS promo_calendario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,                 -- dia em que a promoção roda (YYYY-MM-DD)
  dia_semana INTEGER NOT NULL,        -- 0=dom .. 6=sab
  mecanica TEXT NOT NULL,             -- brinde_por_valor | brinde_por_item | desconto_item
  item_id INTEGER,                    -- item promovido (desconto_item / brinde_por_item)
  brinde_item_id INTEGER,             -- item dado de brinde
  gatilho REAL,                       -- valor mínimo do pedido (brinde_por_valor)
  preco_promo REAL,                   -- preço promocional (desconto_item)
  custo_estimado REAL NOT NULL DEFAULT 0,
  margem_projetada REAL,
  justificativa TEXT,                 -- explicação legível da conta
  status TEXT NOT NULL DEFAULT 'rascunho',  -- rascunho|aprovada|no_ar|encerrada|recusada
  aprovada_em TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(data)
);
```

**Geração:** um job semanal (quinta-feira) monta a semana seguinte, gerando uma
oferta `rascunho` para cada dia fraco (ter/qua/qui/dom). Reaproveita o padrão de
serviços agendados já existente no projeto (backup diário, relatório das 23h).

**Aprovação:** tela web lista a semana com a conta de cada oferta; o dono aprova
tudo num clique ou recusa individualmente.

**Ativação:** um job diário (00:05) aplica a promoção `aprovada` do dia —
gravando `preco_promo`/`promo_ativa`/`promo_tag` no item para `desconto_item` —
e marca `no_ar`. À meia-noite seguinte reverte o item ao preço normal e marca
`encerrada`.

**Fail-safe:** promoção não aprovada **nunca** entra no ar. Se o dono não
responder, a semana passa sem promoção. Decisão explícita do dono: prefere
perder uma semana a ser surpreendido.

## Peça 4 — Aplicação no checkout

Modificação em `backend/src/routes/cardapio.js` (`POST /pedido`), no mesmo
ponto onde cupom, cashback e brinde de fidelidade já são aplicados.

Ao fechar o pedido, busca a promoção `no_ar` do dia:
- `brinde_por_valor`: se `subtotal >= gatilho`, adiciona o item de brinde ao
  pedido com valor R$0 e observação identificando a promoção
- `brinde_por_item`: se o carrinho contém `item_id`, adiciona o brinde igual
- `desconto_item`: nada a fazer no checkout — o `preco_promo` já está no item

Duas colunas novas em `pdv_pedidos` (via migração incremental, padrão do
projeto): `promo_id INTEGER` e `promo_custo REAL DEFAULT 0`. São elas que
tornam a medição da Peça 5 possível.

O brinde é adicionado **uma vez por pedido**, nunca multiplicado por
quantidade.

## Peça 5 — Placar

Rota `GET /api/promo-motor/resultado?inicio=&fim=` e um painel na tela.

Para cada promoção encerrada compara o faturamento do dia com a **linha de base
daquele mesmo dia da semana** (média histórica das últimas 8 ocorrências do
mesmo dia, excluindo dias que tiveram promoção):

```
Terça do Brinde — 14 pedidos acionaram
Ticket médio: R$142 (linha de base das terças: R$105)
Custo dos brindes entregues: R$31
Receita incremental estimada: R$518
```

Reporta também a **margem realizada de verdade**, calculada a partir dos itens
efetivamente vendidos — não da projeção. Se uma mecânica não pagar, aparece no
painel e o motor a despriorizada nas semanas seguintes.

**Honestidade sobre a precisão:** `pdv_pedidos` tem hoje 6 pedidos (o cardápio
online é recente, de 27/07). O placar será magro nas primeiras semanas e ganha
precisão conforme os pedidos entram. O motor **não depende** disso para
funcionar — ele opera sobre margem e dia da semana, que já são sólidos.
`faturamento_diario` (22 dias) serve de linha de base inicial.

## Peça 6 — Briefing da arte

O motor expõe `GET /api/promo-motor/:id/briefing`, devolvendo os campos que o
gerador de arte já sabe consumir: chamada, subtítulo, nome e foto do item,
gatilho/preço, e o formato `stories`.

A tela de aprovação ganha um botão "Gerar arte" que abre o `CriativoSocial` já
preenchido com esse briefing, em Story 9:16. **Nenhuma alteração no editor** —
apenas passagem de parâmetros para a tela existente.

---

## Arquitetura — fluxo completo

```
Job semanal (quinta)
  └─> motorPromocoes.gerarOferta() × 4 dias fracos
        └─> consulta margemCatalogo (selo de confiança + trava de lucro)
        └─> grava promo_calendario como 'rascunho'

Dono abre a tela → vê a semana com as contas → aprova (1 clique)
  └─> status vira 'aprovada'

Job diário (00:05)
  └─> promoção 'aprovada' do dia vira 'no_ar' (aplica preco_promo se for desconto)
  └─> promoção de ontem vira 'encerrada' (reverte preço)

Cliente fecha pedido no cardápio
  └─> checkout aplica brinde/desconto e grava promo_id + promo_custo

Fim da semana
  └─> placar compara com a linha de base do mesmo dia da semana
```

## Tratamento de erros

- **Nenhuma oferta segura possível** (todos os candidatos violam o piso ou estão
  em quarentena): o dia fica sem promoção e a tela explica o motivo. O motor
  nunca "força" uma oferta relaxando a trava.
- **Item do brinde fica indisponível** entre a aprovação e o dia: o checkout
  registra a promoção sem entregar o brinde e sinaliza no placar; a promoção do
  dia é encerrada automaticamente para não prometer o que não existe.
- **Job não roda** (servidor reiniciado no horário): a ativação é idempotente e
  verifica o estado real na próxima execução, em vez de assumir que rodou.
- **Falha ao aplicar no checkout** nunca derruba o pedido — o pedido do cliente
  tem precedência sobre a promoção; o erro é registrado.

## Testes

- **Unitários** (`node:test`, padrão já adotado no projeto) para
  `margemCatalogo` e `motorPromocoes`: são funções puras e concentram toda a
  matemática de risco. Cobertura obrigatória para: piso respeitado em cada
  mecânica, recusa de item `suspeito`/`sem_dado`, teto do brinde, quarentena,
  e o caso "nenhuma oferta possível".
- **Teste de checkout** com pedido acima e abaixo do gatilho, verificando que o
  brinde entra uma única vez e que `promo_id`/`promo_custo` são gravados.
- **Verificação manual** do ciclo completo com uma promoção de teste antes de
  qualquer ativação real.

## Fora de escopo (deliberadamente)

- **Aprovação por WhatsApp + envio da arte em alta resolução + permissões do
  assistente em 3 níveis com "desfazer"** — desenhado e acordado com o dono,
  mas é um segundo projeto. Depende de um endpoint de envio de mídia que **não
  existe** hoje (`whatsapp-service` só envia texto) e a arte precisa ir como
  **documento**, não como imagem, senão o WhatsApp comprime e inutiliza a
  qualidade. Será o spec seguinte.
- **Combo fechado e frete grátis** como mecânicas — o motor nasce com mecânicas
  plugáveis; entram depois sem retrabalho.
- **Publicação automática no Instagram** — exige app aprovado na Meta e conta
  business verificada; prazo não controlável por este projeto.
- **Disparo para a base de 5.577 clientes** — é provavelmente a maior alavanca
  não usada do negócio, mas envolve decisão de operação (o número está
  compartilhado com um CRM externo) e merece projeto próprio.
- **Correção das 14 fichas técnicas faltantes e das 2 suspeitas** — trabalho de
  cadastro do dono, não de software. O sistema apenas aponta quais são.
