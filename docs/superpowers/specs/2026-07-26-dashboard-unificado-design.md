# Dashboard Unificado — Design

## Problema

O sistema acumulou 12 páginas diferentes tentando mostrar visão do negócio ao
dono: `Dashboard`, `Dashboard Central`, `Painel do Dono`, `Centro de Comando`,
`Análise Produto`, `Rentabilidade`, `Movimentações`, `Relatórios`, `Relatório
de Pedidos`, `Fluxo de Caixa`, `Caixa`, `Vendas do Dia`. Metade nunca foi
commitada. Cada tentativa de "melhorar o dashboard" virou mais uma página ao
lado das outras, em vez de aprofundar uma só — o dono nunca teve, em nenhuma
delas, uma ferramenta de análise que ajudasse a decidir de verdade.

Levantamento das necessidades reais (não "mais um gráfico"): o dono precisa
que o sistema responda, com regularidade semanal:
1. Saúde financeira do mês (entrou/saiu/sobrou, margem, tendência, meta)
2. Lucro por produto do cardápio (o que vale manter, o que não vale)
3. Para onde o dinheiro está indo (despesas por categoria/fornecedor, tendência)
4. Pulso operacional do dia a dia (horário de pico, ticket médio, volume)

## Objetivo

Uma página única e profissional — **Dashboard** (rota `/dashboard`, substitui
a atual) — organizada em 5 abas, cada uma tratando uma área a fundo. Sai do
menu tudo que hoje é redundante; o código antigo permanece no repositório
(nada é apagado), só deixa de aparecer na navegação.

## Escopo desta spec

Este documento cobre a página `Dashboard` e suas 5 abas. Não cobre telas de
CRUD (Despesas, Faturamento Diário, PDV) que continuam existindo como estão
— essas abas são de **análise**, não de lançamento de dados.

## Arquitetura

- `frontend/src/pages/Dashboard.jsx` — casca da página: cabeçalho, navegação
  por abas, renderiza a aba ativa. Substitui o conteúdo do `Dashboard.jsx`
  atual (o antigo era simples demais; deixa de existir como está).
- `frontend/src/pages/dashboard/VisaoGeral.jsx`
- `frontend/src/pages/dashboard/Financeiro.jsx`
- `frontend/src/pages/dashboard/Produtos.jsx`
- `frontend/src/pages/dashboard/Despesas.jsx`
- `frontend/src/pages/dashboard/Operacao.jsx`
- `frontend/src/pages/dashboard/_shared.jsx` — componentes reaproveitados
  entre abas (Card, CardHeader, KpiCard, tooltip de gráfico, formatação
  brl/brlK) — hoje duplicados entre `DashboardCentral.jsx` e `PainelDono.jsx`;
  esta spec consolida numa base só.

Cada aba busca seus próprios dados (React Query, uma query por aba, só a aba
ativa busca) — evita uma tela inicial lenta carregando tudo de uma vez.

### Navegação (`App.jsx`)
- Mantém `{ to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' }`.
- Remove do menu: Dashboard Central, Painel do Dono, Centro de Comando,
  Análise Produto, Rentabilidade, Movimentações. Os arquivos `.jsx` continuam
  no repositório (não são apagados) — só saem das rotas navegáveis.
- `App.jsx` já carrega bastante WIP não relacionado (confirmado em sessão
  anterior) — a implementação usa a mesma técnica de isolar só as linhas
  desta mudança do restante do arquivo.

## Abas

### 1. Visão Geral (aba padrão ao abrir)
A porta de entrada — "tô bem ou mal esse mês", em poucos segundos.
- **Hero Entrou/Saiu/Sobrou** do mês (reconciliado — reaproveita a lógica já
  corrigida de `resumoCaixaMes` via `GET /api/relatorios/painel-dono`), com
  seletor de mês e frase-resumo em linguagem direta.
- **KPIs do período** (Hoje/7 dias/30 dias): pedidos, faturamento, ticket
  médio, clientes — reaproveita o componente já corrigido nesta sessão
  (sem alarme falso de variação no "Hoje", aviso quando não há pedido ainda).
- **Gráfico de tendência** Pedidos × Faturamento (linha dupla, já existente).
- **Melhor dia do mês** e **dias com venda** (do Painel do Dono).
- Atalhos "ver mais" para as abas Financeiro/Produtos/Despesas/Operação.
- Fonte: `GET /api/dashboard`, `GET /api/relatorios/painel-dono`,
  `GET /api/pdv/pedidos` (pedidos recentes) — todos já existem.

### 2. Financeiro
A visão profissional — DRE de verdade, não só números soltos.
- **DRE em cascata (waterfall)**: Faturamento bruto → (−) taxa de cartão →
  Faturamento líquido → (−) CMV → Lucro bruto → (−) despesas fixas/variáveis
  → Lucro líquido. Fonte: `GET /api/relatorios/dre` (já calcula tudo isso).
- **Evolução 12 meses**: faturamento e lucro líquido por mês (barras ou
  linha) — fonte: `GET /api/relatorios/evolucao` (já existe, retorna 12
  meses).
- **Composição por forma de pagamento** (pix/dinheiro/crédito/débito) —
  donut. Fonte: já vem em `pagamentos` de `/api/relatorios/dre`.
- **Meta do mês vs realizado**: barra de progresso. Fonte:
  `GET /api/relatorios/meta` (já existe).
- Caveat visível: CMV é calculado só sobre pedidos reais do PDV/cardápio
  (mesma limitação já documentada no Painel do Dono) — texto fixo, sem
  fingir precisão que os dados não sustentam.

### 3. Produtos
A análise de lucratividade por item — o que faltava de verdade.
- **Tabela ordenável**: nome, qtd vendida, receita, custo total, margem R$,
  margem %, CMV %, comparação vs mês anterior (▲/▼). Fonte:
  `GET /api/relatorios/itens-comp` (já traz a comparação mês a mês pronta).
- **Itens sem ficha técnica** (custo desconhecido) em destaque — lista
  acionável, não estatística enterrada. Fonte: já vem em `sem_ficha` nos
  itens de `itens-comp` / `cardapio-fichas`.
- **Ranking**: top 5 e bottom 5 por margem — barras horizontais.
- **Drill-down**: clicar num produto expande (sem navegar) histórico mensal
  e composição de insumos — fonte: `GET /api/relatorios/produto?nome=X`
  (já existe, já traz `por_dia`, `composicao`, `insumos`).

### 4. Despesas
Pra onde o dinheiro está indo.
- **Breakdown do mês** por categoria (fixo/variável) e por tipo/fornecedor —
  donut ou barras.
- **Evolução mensal** (últimos 12 meses), fixas vs variáveis empilhadas.
- **Maior gasto do mês** e comparação vs mês anterior — já existe em
  `saiu.maior_gasto` do Painel do Dono.
- Fonte: **novo endpoint** `GET /api/relatorios/despesas-analise?mes=YYYY-MM`
  — retorna breakdown do mês (categoria, tipo) + evolução dos últimos 12
  meses (fixas/variáveis/total por mês). Não existe hoje; a tela Despesas
  atual só lista lançamentos, não agrega para análise.
- Não duplica o CRUD da tela Despesas — só análise. Lançar/editar despesa
  continua em `/despesas`.

### 5. Operação
O pulso do dia a dia — decisão de escala e capacidade.
- **Mapa de calor** dia da semana × hora, contagem de pedidos — pra decisão
  de escala/equipe. Fonte: **novo endpoint**
  `GET /api/relatorios/pico-semanal?dias=90` (dia da semana × hora, últimos
  90 dias, só pedidos reais do PDV — não existe hoje; `horario_pico` atual
  só olha 7 dias e não separa por dia da semana).
- **Pedidos ativos agora**, por status (novo/preparando/pronto/entregue) —
  fonte: `GET /api/dashboard` (`pedidos_ativos`, já existe).
- **Tendência de volume e ticket médio** (7/30 dias) — reaproveita o mesmo
  gráfico de tendência da Visão Geral, com foco em pedidos/ticket em vez de
  faturamento.
- Mesmo caveat: reflete só pedidos reais do PDV (não há "horário de pico" de
  faturamento importado, que não tem timestamp).

## Estados vazios e honestidade dos dados

Regra herdada da correção desta sessão: nunca mostrar zero/queda sem
contexto. Sempre que um período não tiver dado real ainda (ex.: "Hoje" sem
pedido), mostrar uma frase explicando o motivo em vez de números alarmantes
sem explicação. Sempre que uma métrica só refletir pedidos reais do PDV
(CMV, Top Produtos, horário de pico) e não faturamento importado de outro
sistema, isso fica dito na tela, não escondido.

## Fora de escopo (YAGNI)

- Exportar relatórios em PDF/Excel.
- Comparação entre unidades (só existe 1 unidade ativa hoje).
- Metas por produto/categoria (só existe meta de faturamento total).
- Edição de dados dentro do Dashboard (é só leitura/análise).
