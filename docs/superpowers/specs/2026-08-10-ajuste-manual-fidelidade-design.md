# Ajuste manual de fidelidade (selos e cashback) — Design

## Contexto

O dono quer poder somar ou remover "pontos" no plano de fidelidade de qualquer
cliente, direto pela ficha do cliente. O sistema hoje tem **dois programas de
fidelidade separados e sem relação entre si**:

1. **Cartão de selos** — a cada 10 pedidos reais, o cliente ganha 1 brinde
   (`clientes.recompensas_ganhas`, `recompensas_usadas`, `total_pedidos`).
2. **Cashback** — % do valor do pedido volta como saldo em R$
   (`cashback_saldo`, `cashback_transacoes`).

Nenhum dos dois tem hoje um jeito de ajustar manualmente por engano corrigido,
cortesia, ou compensação — só o fluxo automático (pedido real) e, no caso do
cashback, um crédito manual global (sem UI de remoção).

## Armadilha descoberta durante o design

`clientes.recompensas_ganhas` **não é um contador independente** — é
recalculado do zero a cada pedido real, em `pdv.js`:

```js
recompensas_ganhas = Math.floor(novo_total_pedidos / PEDIDOS_POR_RECOMPENSA)
```

Editar essa coluna diretamente seria apagado silenciosamente no próximo
pedido do cliente. A solução precisa desacoplar o ajuste manual do cálculo
automático.

## Modelo de dados

### `clientes` — coluna nova
```sql
ALTER TABLE clientes ADD COLUMN recompensas_bonus INTEGER DEFAULT 0;
```
Saldo manual que **soma** por cima do que foi ganho organicamente. Nunca é
tocado pelo fluxo de pedido real (`pdv.js`) — só pelo endpoint de ajuste.
Pode ficar negativo internamente (revogação líquida), mas a API garante que
o total disponível nunca fique negativo.

`recompensas_disponiveis` passa a ser calculado em todo lugar como:
```
(recompensas_ganhas + recompensas_bonus) - recompensas_usadas
```

### Tabela nova — auditoria dos ajustes de selos
```sql
CREATE TABLE IF NOT EXISTS clientes_fidelidade_ajustes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL,
  delta INTEGER NOT NULL,
  motivo TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
```
Mesmo padrão do `cashback_transacoes` já existente. Sem coluna de "quem fez"
— o sistema não tem múltiplos usuários/login por pessoa hoje, só um dono.

### Cashback — nenhuma mudança de schema
`cashback_saldo`, `cashback_transacoes`, `POST /cashback/creditar` e
`POST /cashback/estornar` já existem e já fazem exatamente o que precisa.
Só falta interface.

## Backend

### `backend/src/routes/clientes.js`

**`calcFidelidade`** passa a receber `recompensas_bonus` e somá-lo:
```js
function calcFidelidade(total_pedidos, recompensas_ganhas, recompensas_usadas, recompensas_bonus = 0) {
  const recompensas_disponiveis = (recompensas_ganhas + recompensas_bonus) - recompensas_usadas;
  ...
}
```
`comFidelidade` passa `c.recompensas_bonus` no lugar certo.

**`POST /:id/resgatar`** — o guard de "nenhum brinde disponível" passa a
considerar o bônus:
```js
const disponiveis = (cliente.recompensas_ganhas + cliente.recompensas_bonus) - cliente.recompensas_usadas;
```
Nada mais muda nesse endpoint — resgatar continua só incrementando
`recompensas_usadas`, então funciona igual para brinde ganho ou concedido.

**`POST /:id/fidelidade/ajustar`** (novo) — body `{ delta, motivo }`:
- `delta` inteiro, não-zero. Positivo concede brindes, negativo revoga.
- `motivo` obrigatório (string não vazia).
- Calcula `novoBonus = recompensas_bonus + delta` e valida:
  `(recompensas_ganhas + novoBonus) - recompensas_usadas >= 0` — senão,
  400 com mensagem clara ("Isso deixaria o saldo de brindes negativo").
- Atualiza `clientes.recompensas_bonus`, insere log em
  `clientes_fidelidade_ajustes`, devolve `comFidelidade(cliente)`.

**`GET /:id/fidelidade/ajustes`** (novo) — histórico do cliente, últimos 50,
mais recente primeiro.

### `backend/src/routes/cashback.js`
Nenhuma rota nova. `POST /creditar` e `POST /estornar` já cobrem o caso.

## Frontend

### `frontend/src/pages/Clientes.jsx` — aba Fidelidade da ficha do cliente

Abaixo do card "CARTÃO FIDELIDADE" existente:

- **Bloco "Ajuste manual"**: input numérico (quantidade), input de texto
  (motivo, obrigatório), dois botões — **Conceder brinde(s)** (verde) e
  **Revogar brinde(s)** (vermelho, desabilitado se não houver saldo
  suficiente pra revogar). Chama `POST /fidelidade/ajustar` com delta
  positivo/negativo conforme o botão.
- **Card "Cashback"**: busca `GET /cashback/saldo/:telefone` ao abrir a
  aba, mostra saldo atual. Mesmo padrão de input+motivo, dois botões
  chamando `POST /cashback/creditar` e `POST /cashback/estornar` (telefone
  já preenchido — sem digitar).
- **Histórico colapsável**: uma lista compacta abaixo, junta os ajustes de
  `GET /fidelidade/ajustes` e o histórico de cashback já disponível em
  `GET /cashback/historico/:telefone`, ordenados por data.

**Correção lateral necessária**: `Clientes.jsx:917` hoje calcula
`temBrinde = (c.recompensas_ganhas - c.recompensas_usadas) > 0` direto nos
campos crus, ignorando bônus. Troca para usar `c.fidelidade.recompensas_disponiveis`
(que a API já devolve pronto em `GET /clientes`), senão o selo "Brinde" na
lista fica errado pra quem só tem saldo via bônus.

### `frontend/src/pages/Cashback.jsx` — tela global
O botão "Creditar manual" + modal viram um seletor **Creditar / Remover**
no topo do mesmo modal (não duplica tela). "Remover" chama
`POST /cashback/estornar` com o mesmo formulário (telefone, valor, motivo).

## Validação e guardrails

- Motivo obrigatório nos dois ajustes manuais (selos e cashback) — é o que
  explica o ajuste depois, no histórico.
- Nenhum ajuste pode deixar saldo disponível negativo — validado no
  backend (fonte da verdade), refletido na UI (botão desabilitado +
  mensagem de erro se a race condition acontecer).
- `delta`/`valor` sempre número, sempre não-zero.

## Testes / verificação

Rodar local (backend real, não mock):
1. Conceder 1 brinde manualmente num cliente sem saldo → aparece disponível.
2. Fechar um pedido real desse cliente no PDV → confirmar que o bônus
   sobrevive (não foi sobrescrito pelo recálculo de `recompensas_ganhas`).
3. Revogar brinde além do disponível → API rejeita, UI mostra erro.
4. Resgatar um brinde concedido manualmente → consome normalmente.
5. Cashback: creditar e remover pela ficha do cliente, conferir saldo e
   histórico batem com a tela global.
6. Lint (`npm run lint` nos dois pacotes) e checagem visual das duas telas
   antes do deploy.

## Fora de escopo

- Não mexe em `pdv.js` nem no fluxo automático de pedido real.
- Não cria um terceiro sistema de pontos — só dá controle manual sobre os
  dois que já existem.
- Sem campo de "quem ajustou" — não há múltiplos usuários no sistema hoje.
