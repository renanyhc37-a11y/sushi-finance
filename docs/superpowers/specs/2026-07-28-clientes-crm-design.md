# Clientes — CRM Poderoso (Visão de Conjunto + RFV) — Design

## Contexto

O sistema já tem uma análise comportamental rica **por cliente individual**:
abrir o modal de um cliente (`ModalCliente` em `frontend/src/pages/Clientes.jsx`,
alimentado por `GET /api/clientes/:id/perfil`) mostra segmentação, dia/hora
preferidos, forma de pagamento favorita, retirada vs entrega, itens mais
pedidos, evolução mensal de gasto, tendência (subindo/caindo) e histórico
completo de pedidos. Isso já é mais profundo que o relatório de referência
de outro PDV que motivou este pedido (que só tem contagens agregadas e uma
lista simples, sem comportamento por cliente).

O que falta é a **visão de conjunto**: hoje não há como ver, olhando pra
base inteira, quem são os melhores clientes, se a base está saudável, ou
quem vale a pena contatar agora. Cada cliente só é visto um de cada vez.

**Fora de escopo desta spec** (decidido explicitamente): "Clientes em
potencial" (quem começou um pedido no cardápio e não finalizou) — o sistema
não captura esse dado hoje (não existe carrinho/sessão rastreada no
cardápio público, que não exige login). Isso exigiria instrumentar o
cardápio público para rastrear visitante anônimo — uma peça de engenharia
e uma decisão de privacidade diferentes, tratada como projeto separado no
futuro.

## Objetivo

1. Uma pontuação **RFV (Recência/Frequência/Valor)** de verdade — nota 1-5
   por dimensão, calculada por quintil contra a base inteira — em vez da
   segmentação categórica atual (que fica, mas passa a ser derivada do RFV).
2. Uma aba nova **"Visão Geral"** na tela de Clientes, com Rankings, Saúde
   da base e Lista de ação — a lista atual de clientes vira a aba "Todos os
   Clientes".
3. O perfil individual (`ModalCliente`) ganha o RFV numérico do cliente,
   com contexto ("Valor: nota 5 — top 20% da base").

## Arquitetura

### Backend

**Novo módulo**: `backend/src/lib/clientesAnalise.js` — fonte única do
cálculo RFV, usada tanto pelo endpoint agregado quanto pelo perfil
individual (evita duas implementações do mesmo cálculo divergindo).

```
função principal: calcularBaseRFV()
  1. UMA consulta SQL agregando pdv_pedidos por cliente_telefone
     (COUNT, SUM(total), MAX(created_at)), excluindo cancelados,
     junto com os dados de `clientes`.
  2. Pra cada cliente: recência (dias desde o último pedido),
     frequência (total de pedidos), valor (soma gasta).
  3. Calcula os quintis de R, F e V sobre a base inteira (Recência
     invertida: mais recente = nota mais alta).
  4. Retorna a lista de clientes com { r, f, v, rfv_label } —
     rfv_label deriva a mesma nomenclatura amigável que já existe
     (fiel/recorrente/regular/novo/em_risco/inativo), agora calculada
     a partir da pontuação RFV em vez da regra ad-hoc atual.
```

Clientes sem nenhum pedido (só cadastro) ficam de fora do cálculo de
quintil (não têm R/F/V) e são tratados à parte como "novo/sem histórico".

**Endpoint novo**: `GET /api/clientes/analise`
```json
{
  "rankings": {
    "porGasto": [{ "id", "nome", "telefone", "total_gasto", "total_pedidos" }, "...10"],
    "porFrequencia": [{ "id", "nome", "total_pedidos", "total_gasto" }, "...10"],
    "porTicketMedio": [{ "id", "nome", "ticket_medio", "total_pedidos" }, "...10"]
  },
  "saude": {
    "segmentos": [{ "segmento": "fiel", "qtd": 12, "valor_total": 8400.50 }, "..."],
    "evolucaoBase": [{ "mes": "2025-08", "novos": 4, "ativos": 30 }, "...12 meses"],
    "totalClientes": 145,
    "totalComPedido": 98
  },
  "acao": {
    "emRisco": [{ "id", "nome", "telefone", "total_gasto", "dias_desde_ultimo" }, "..."],
    "aniversariosProximos": ["mesmo formato de /clientes/aniversarios, reaproveitado"],
    "brindesParados": [{ "id", "nome", "telefone", "recompensas_disponiveis" }, "..."]
  }
}
```

**Modificado**: `GET /api/clientes/:id/perfil` — adiciona ao `perfil` já
existente:
```json
"rfv": { "r": 4, "f": 5, "v": 3, "percentil_valor": 68 }
```
Reaproveita `clientesAnalise.js` (calcula a base inteira uma vez, localiza
o cliente pedido no resultado) — não duplica a lógica de quintil.

### Frontend

`frontend/src/pages/Clientes.jsx` ganha uma navegação por abas no topo,
antes do que hoje é a lista direta:
- **Visão Geral** (nova, aba padrão): Rankings, Saúde da base, Lista de ação.
- **Todos os Clientes**: o que já existe hoje (cards resumo, aniversários,
  chips de segmento, busca, lista) — sem mudanças de comportamento, só
  passa a viver dentro de uma aba.

Novo componente: `frontend/src/pages/clientes/VisaoGeralClientes.jsx`,
seguindo o estilo visual já estabelecido em `Clientes.jsx` (fundo `#111`,
borda `#1a1a1a`, tokens `var(--accent)`) — não introduz um design system
novo, usa o que a própria tela já usa.

- **Rankings**: 3 mini-listas lado a lado (ou empilhadas em mobile) — top
  10 por gasto, por frequência, por ticket médio. Clicar num nome abre o
  `ModalCliente` já existente (reaproveitado, não duplicado).
- **Saúde da base**: cards por segmento (mesma paleta `SEGMENTO_CFG` já
  definida em `Clientes.jsx`) mostrando quantidade e valor total; gráfico
  de evolução (novos clientes por mês, últimos 12 meses) usando Recharts
  (já é dependência do frontend).
- **Lista de ação**: 3 seções — em risco (ordenados por valor em jogo,
  maior primeiro), aniversários próximos (reaproveita o carrossel que já
  existe em "Todos os Clientes", só que aqui em formato de lista), brindes
  parados. Cada item tem um atalho pra abrir o WhatsApp (mesmo padrão já
  usado em outras telas do sistema).

O `ModalCliente` (perfil individual) ganha uma linha com os 3 números RFV
e o percentil de valor, posicionada perto do resumo que já existe
(total gasto, ticket médio, pedidos, tendência).

## Regras / decisões

- RFV é calculado sob demanda (não fica salvo em coluna nova em `clientes`)
  — a base é pequena o suficiente (algumas centenas a poucos milhares de
  clientes) pra uma agregação SQL + cálculo em memória ser rápido a cada
  request. Se isso mudar no futuro, dá pra cachear.
- A nomenclatura de segmento amigável (fiel/recorrente/regular/novo/em_risco/inativo)
  continua existindo — é o que já aparece em toda a tela hoje — mas passa a
  ser **derivada da pontuação RFV**, não de uma regra separada como hoje.
  Isso substitui a lógica de segmentação hoje duplicada entre
  `clientes.js` (`/:id/perfil`) e `Clientes.jsx` (chips `SEGMENTOS` da
  lista) — ambas passam a vir do mesmo lugar.
- "Clientes em risco" pra Lista de ação = mesma definição de `em_risco` do
  RFV (recência baixa + frequência/valor historicamente altos), não uma
  regra nova.
- Base pequena (poucos clientes com pedido, ex.: ambiente de dev com 2):
  quintil sobre poucos pontos degenera (todo mundo cai na mesma nota) —
  aceitável, não é tratado como erro. Em produção a base é grande o
  suficiente pra isso não ser problema.

## Fora de escopo (YAGNI)

- Clientes em potencial (carrinho abandonado) — projeto separado, futuro.
- Exportar/imprimir a Visão Geral (a lista de "Todos os Clientes" já não
  tem isso hoje; não é pedido explícito).
- Ações em massa (enviar campanha pra todos os "em risco" de uma vez) — já
  existe uma tela de Campanhas separada para isso; a Lista de ação aqui é
  só de consulta + atalho individual de WhatsApp.
