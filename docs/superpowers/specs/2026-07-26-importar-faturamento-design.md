# Importar Faturamento (planilha de outro PDV)

## Contexto
O dono operou (ou opera em paralelo) outro sistema de PDV que exporta um `.xlsx` com o movimento financeiro por dia. Ele quer trazer esse histórico para dentro do `faturamento_diario` do sushi-finance, na mesma tabela que a página `FaturamentoDiario` já usa — sem depender de digitar tudo manualmente. Segue o mesmo padrão de import já existente para Cardápio (`ImportarCardapio.jsx` + `routes/importar.js`) e Clientes (`ImportarClientes.jsx`).

## Formato de origem (confirmado com o arquivo real do usuário)
Arquivo `.xlsx` com 3 abas. Duas interessam:

**Aba "Movimentação Financeira"** (uma linha por dia):
`(vazio) | Online | Cartão de Crédito | PIX | Dinheiro | Pagamento no fechamento | Débito | Delivery | Retirada | No local | Subtotal | Frete | Líquido`
- Primeira coluna é a data, formato `DD/MM/AAAA`.
- **"Líquido" é o total do dia** (bate com "Delivery" quando o negócio é 100% delivery; ~R$8/dia menor que Subtotal+Frete — desconhecido/irrelevante, não usar Subtotal+Frete).
- As colunas de forma de pagamento **não somam o total do dia** (cobrem só uma parte das vendas — o resto do valor deve vir por fora, ex. app de entrega). Usar mesmo assim como aproximação; não travar a importação por causa disso.

**Aba "Geral"** (uma linha por dia): inclui `Nᵒ de Pedidos` — usado para `quantidade_pedidos`.

A aba "Ticket" (ticket mínimo/médio/máximo) é ignorada — o sistema já calcula ticket médio a partir de total/pedidos.

## Mapeamento → `faturamento_diario`
| Coluna destino | Origem |
|---|---|
| `data` | 1ª coluna da aba Movimentação Financeira, `DD/MM/AAAA` → `AAAA-MM-DD` |
| `total_bruto` | "Líquido" |
| `quantidade_pedidos` | "Nᵒ de Pedidos" (aba Geral, mesma data) |
| `pix` | "PIX" |
| `dinheiro` | "Dinheiro" |
| `credito` | "Cartão de Crédito" + "Online" (somados — ambos eletrônico, útil pra depois estimar taxa de cartão) |
| `debito` | "Débito" |

"Pagamento no fechamento" e "Retirada"/"No local"/"Subtotal"/"Frete" não são gravados — servem só de contexto no preview se precisar depurar.

`taxa_cartao` (coluna que já existe em `faturamento_diario`, usada nos lançamentos manuais) fica em `0` na importação — a planilha de origem não traz taxa de cartão, e não é papel desta importação estimar isso.

## Backend (`backend/src/routes/importar.js`)
Duas rotas novas, mesmo padrão de multer + XLSX já usado no arquivo:

- **`POST /api/importar/faturamento/preview`** (multipart `arquivo`)
  - Lê as abas "Movimentação Financeira" e "Geral" pelo nome exato (se não encontrar, erro claro: "Aba 'Movimentação Financeira' não encontrada").
  - Junta as duas por data (parse `DD/MM/AAAA`).
  - Para cada dia já existente em `faturamento_diario`, marca `ja_existe: true` no preview (compara valor atual vs. novo).
  - Retorna `{ dias: [{data, total_bruto, quantidade_pedidos, pix, dinheiro, credito, debito, ja_existe, valor_atual}], total_dias, periodo: {inicio, fim} }`.

- **`POST /api/importar/faturamento/confirmar`** (multipart `arquivo` + campo `modo`: `'pular'` | `'sobrescrever'`)
  - Reprocessa o arquivo (mesma extração do preview — não depende de estado em memória entre preview e confirmar).
  - Para cada dia: se não existe em `faturamento_diario`, insere. Se existe e `modo==='sobrescrever'`, faz `UPDATE`. Se existe e `modo==='pular'`, ignora (conta em `ignorados`).
  - Retorna `{ ok: true, criados, sobrescritos, ignorados, total }`.
  - Roda tudo dentro de uma `db.transaction()`.

Reaproveita o parser de data `DD/MM/AAAA` e o normalizador de moeda (`parseFloat(String(v).replace(',','.'))`) já usados nas outras rotas de import deste arquivo.

## Frontend
- **Nova página `frontend/src/pages/ImportarFaturamento.jsx`**, mesmo layout/fluxo de `ImportarClientes.jsx`: dropzone de arquivo → chama `/preview` → mostra tabela (data | pedidos | total | pix | dinheiro | cartão | débito), com linhas já-existentes destacadas (ex. badge amarelo "já tem lançamento") → escolha de modo (pular/sobrescrever, só relevante se houver `ja_existe`) → botão confirmar → chama `/confirmar` → mostra resumo (`X criados, Y sobrescritos, Z ignorados`).
- Rota `/importar-faturamento` em `App.jsx`, lazy-loaded como as demais.
- Entrada de menu no grupo **Financeiro**, ao lado de "Faturamento", ícone `Upload` ou `FileSpreadsheet` (lucide-react, já usado em `ImportarClientes`).

## Fora de escopo
- Suporte a outros formatos/planilhas de outros PDVs (mapeamento de colunas configurável como em Importar Clientes) — só o formato confirmado acima. Se aparecer outro formato no futuro, é uma segunda tarefa.
- Reconciliar automaticamente com `pdv_pedidos` (essa importação só afeta `faturamento_diario`, que já é a fonte que "vence" na tela Faturamento/Dashboard quando há lançamento manual pro dia — ver `faturamentoDia.js`).
- Importar as abas "Geral" (canais/pedidos por canal) e "Ticket" como dados próprios — só usamos `Nᵒ de Pedidos` da aba Geral como apoio.

## Teste manual
1. `cd backend && npm run dev` + `cd frontend && npm run dev`, login `sushi123`.
2. `/importar-faturamento` → upload do arquivo real de teste → preview mostra ~24 dias (01/07 a 25/07/2026), valores batendo com a aba Movimentação Financeira.
3. Confirmar → checar em `/faturamento` que os dias aparecem com os valores certos.
4. Rodar a importação de novo com o mesmo arquivo → preview deve marcar todos os dias como `ja_existe` → escolher "pular" → confirma → `ignorados` = total de dias, nada duplicado.
5. Escolher "sobrescrever" numa segunda rodada → valores continuam os mesmos (idempotente).
