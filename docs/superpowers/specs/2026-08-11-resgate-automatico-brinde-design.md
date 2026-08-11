# Resgate Automático de Brinde no Cardápio — Design

## Contexto

O programa de fidelidade (cartão de selos, 1 brinde a cada 10 pedidos) já
existe, incluindo o ajuste manual em pontos implementado nesta mesma sessão
(`selos_bonus`). Hoje, quando o cliente tem um brinde disponível, o
cardápio público só mostra um aviso: *"Você tem um brinde! Informe ao
atendente ao retirar."* — o resgate é 100% manual, dependente do cliente
lembrar de avisar e do atendente lembrar de processar.

O dono pediu duas coisas, depois de ver a feature no ar:
1. O cliente poder resgatar **sem falar com o atendente**.
2. O item do brinde poder ser **trocado** (hoje é fixo: "1 Temaki Salmão
   grátis", uma constante `RECOMPENSA_DESCRICAO` em `cardapio.js`).

## Decisões (confirmadas com o usuário)

- **Mecanismo de resgate:** automático — quando o cliente monta um pedido
  no cardápio online e tem brinde disponível, o item configurado entra
  como uma linha grátis (`valor_unitario = 0`) no próprio pedido. Sem
  botão, sem confirmação extra, sem visita separada.
- **Quando aplica:** já no pedido que completa o ciclo de 10 (não precisa
  esperar o pedido seguinte). `recompensas_disponiveis` já reflete isso
  naturalmente, já que o resgate roda depois do recálculo de fidelidade do
  próprio pedido.
- **Quantos por pedido:** no máximo 1, mesmo que o cliente tenha 2+ brindes
  acumulados. O resto fica guardado pros próximos pedidos.
- **Configuração do brinde:** um único item fixo, escolhido pelo dono numa
  tela simples (seletor do cardápio). Ele troca quando quiser; o novo item
  vale pra todo resgate a partir dali. Não é uma lista de opções pro
  cliente escolher.

## Modelo de dados

Tabela nova, mesmo padrão de `cashback_config` (config single-row):

```sql
CREATE TABLE IF NOT EXISTS fidelidade_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  item_id INTEGER,
  ativo INTEGER DEFAULT 1
);
INSERT OR IGNORE INTO fidelidade_config(id) VALUES(1);
```

- `item_id` referencia `cardapio_itens.id` — sempre lido "ao vivo" (join),
  nunca snapshot. Trocar o item na config muda o que os PRÓXIMOS resgates
  entregam; resgates já feitos (linhas já gravadas em `pdv_itens`) não
  mudam retroativamente.
- `ativo`: permite desligar o resgate automático (útil se o dono quiser
  voltar ao fluxo manual temporariamente) sem apagar a configuração.
- Sem `item_id` configurado, ou item apontando pra um `cardapio_itens`
  excluído/indisponível: resgate automático não acontece nesse pedido — o
  saldo do cliente **não é decrementado**, o brinde continua guardado pro
  próximo pedido (depois que o dono configurar/reativar). O checkout nunca
  falha por causa disso.

## Backend

### `backend/src/routes/cardapio.js` — `POST /pedido`

Depois do bloco que já recalcula `fidelidade` (linha ~684/692 hoje), se
`fidelidade.recompensas_disponiveis > 0` E existe config ativa com item
válido e disponível:

1. Busca o item (`cardapio_itens` por `id`, checa `disponivel`).
2. Insere mais uma linha em `pdv_itens` pro mesmo `pedidoId`, usando o
   `insItem` já preparado: `item_nome = "<nome do item> (Brinde
   fidelidade 🎁)"`, `quantidade = 1`, `valor_unitario = 0`.
3. `UPDATE clientes SET recompensas_usadas = recompensas_usadas + 1 WHERE
   telefone = ?`.
4. Recalcula `fidelidade` mais uma vez (reflete o `recompensas_usadas`
   novo) e monta `brinde_resgatado: { item_id, nome }` pra devolver na
   resposta.

Sem alteração no cálculo de `total`/`subtotal`/`frete` — o item grátis
sempre soma 0, então não interfere com nada que já foi calculado antes.

`ganhou_recompensa` continua existindo (sinaliza "cruzou um novo múltiplo
de 10 *nesse* pedido") e passa a ser um evento **independente** de
`brinde_resgatado` (sinaliza "um item grátis foi de fato adicionado
*nesse* pedido") — na prática os dois normalmente coincidem (ganha e já
resgata no mesmo pedido), mas não são garantidos juntos: um cliente com
brinde já guardado de antes pode resgatar sem ter "ganho" nada nesse
pedido específico.

`RECOMPENSA_DESCRICAO` (constante fixa) é removida — o texto do
"parabéns, você ganhou!" passa a vir do nome do item configurado.

### `backend/src/routes/fidelidade.js` (novo — mesmo padrão de `cashback.js`)

Arquivo dedicado, não em `clientes.js` (que já está grande e essa config
não tem acoplamento com o resto do arquivo). Migração da tabela
`fidelidade_config` no topo do arquivo, mesmo estilo de `cashback.js`.
Montado em `index.js` como `app.use('/api/fidelidade', fidelidadeRouter)`.

Dois endpoints, atrás de `requireAuth`, mesmo padrão de `/cashback/config`:

- `GET /api/fidelidade/config` → `{ item_id, item_nome, ativo }` (join com
  `cardapio_itens`, `item_nome: null` se o item foi excluído).
- `PUT /api/fidelidade/config` `{ item_id, ativo }` → atualiza e devolve o
  mesmo formato.

## Frontend

### `frontend/src/pages/Clientes.jsx`

Pequeno painel de configuração no topo da página (fora da ficha
individual — é uma config global do programa), estilo consistente com o
resto da tela:
- "Brinde atual: **Temaki Salmão**" + botão "Trocar" que abre um seletor
  simples dos itens do cardápio (reaproveita busca por nome, sem
  categoria/filtro sofisticado — é só pra achar 1 item).
- Se `ativo = false` ou item indisponível: aviso visual (ex: "⚠️ Nenhum
  brinde configurado — resgate automático desligado").

### `frontend/src/pages/Cardapio.jsx` (público)

- Cartão de fidelidade: quando `recompensas_disponiveis > 0`, troca a
  mensagem atual (*"Informe ao atendente..."*) por **"🎁 Seu brinde (<nome
  do item>) entra automático no seu próximo pedido"**. Precisa que o
  cliente veja o NOME do item — então o `GET /cardapio/cliente/:telefone`
  (já usado pra montar `fid`) passa a incluir também o nome do brinde
  configurado (via o mesmo join usado no endpoint admin).
- Tela de confirmação do pedido (`pedidoFeito`): se a resposta trouxer
  `brinde_resgatado`, mostra um banner "🎁 Brinde incluso: <nome> grátis!",
  no mesmo estilo visual do banner que já existe pra `ganhou_recompensa`.

## Fora de escopo

- Múltiplas opções de brinde à escolha do cliente (decidido: fixo, um só).
- Mudar o limite de 10 pedidos por ciclo (`PEDIDOS_POR_RECOMPENSA`) —
  continua igual.
- Aplicar mais de 1 brinde por pedido, mesmo com saldo acumulado.
- Histórico/auditoria de qual item foi resgatado em qual pedido além do
  que já existe em `pdv_itens` (a linha do pedido já registra isso).
- Reverter/estornar um resgate automático depois de feito — se o dono
  precisar desfazer, isso já é possível manualmente ajustando
  `selos_bonus` pra cima (mecanismo que já existe).

## Testes / verificação

Sem framework de testes automatizados — convenção já estabelecida:
1. Configurar um item de teste via `PUT /api/fidelidade/config`.
2. Simular via curl um `POST /cardapio/pedido` pra um cliente com
   `recompensas_disponiveis > 0` (ajustar via `/fidelidade/ajustar` se
   necessário) — confirmar que a resposta traz `brinde_resgatado`, que
   `pdv_itens` ganhou a linha grátis, e que `recompensas_usadas` subiu.
2b. Confirmar que o `total` do pedido não mudou por causa do item grátis.
3. Testar o caso "sem config" (tabela vazia/`ativo=0`) — pedido segue
   normal, sem `brinde_resgatado`, saldo intacto.
4. Testar o caso "item configurado foi excluído" — mesmo resultado do
   item 3.
5. Testar 2 brindes disponíveis num único pedido — confirmar que só 1 é
   aplicado, o outro permanece disponível pro próximo.
6. Verificação visual: painel de config em `/clientes`, cartão de
   fidelidade e banner de confirmação em `/cardapio`.
