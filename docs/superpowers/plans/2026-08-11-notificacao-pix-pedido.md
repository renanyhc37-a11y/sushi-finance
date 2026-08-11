# Notificação de Pix no pedido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** quando o cliente finaliza um pedido no cardápio online com `forma_pagamento === 'pix'`, o sistema envia automaticamente uma mensagem de WhatsApp ao cliente avisando que o pedido será aprovado após a confirmação do pagamento, com o código Pix (copia e cola) e a chave Pix cadastrada.

**Architecture:** reaproveita a geração de Pix já existente (`gerarPixPayload` em `backend/src/lib/pix.js`, mesma config `pix_chave`/`pix_nome`/`pix_cidade` usada pela tela do cliente) e o transporte de WhatsApp já existente (`enviar()` em `backend/src/services/whatsapp.js`). Uma função nova, `notificarPix`, é chamada a partir de `POST /api/cardapio/pedido` logo após o pedido ser criado, apenas quando `forma_pagamento === 'pix'` e há telefone de cliente.

**Tech Stack:** Node/Express, `node:sqlite`, sem framework de testes automatizados no projeto (verificação é manual/smoke-test, seguindo o padrão já usado nas features anteriores desta sessão).

## Global Constraints

- Não alterar `pdv_pedidos.status` nem o fluxo de aceite/produção existente no PDV.
- Não implementar a segunda mensagem de "pagamento confirmado" (fora de escopo — ver spec).
- O disparo da notificação NUNCA pode impedir a criação do pedido nem atrasar a resposta do checkout: sempre fire-and-forget, sempre com try/catch.
- Se `pix_chave` não estiver configurada, não enviar nada (sem erro visível ao cliente).
- **Segurança em testes de produção:** se a verificação end-to-end (Task 2) precisar rodar contra o servidor de produção, NUNCA usar telefone/dados de um cliente real. Usar DDD inválido (ex.: `00`) e nome claramente fictício (ex.: "TESTE NOTIFICACAO PIX (ignorar)"), e apagar os dados fake ao final.

---

### Task 1: `notificarPix` em whatsapp.js + disparo em cardapio.js

**Files:**
- Modify: `backend/src/services/whatsapp.js`
- Modify: `backend/src/routes/cardapio.js`

**Interfaces:**
- Consumes: `gerarPixPayload({ chave, nome, cidade, valor, txid })` de `backend/src/lib/pix.js` (já importado em `cardapio.js` como `const { gerarPixPayload } = require('../lib/pix');`); `enviar(telefone, mensagem)` e o helper `brl(v)`, ambos já definidos em `whatsapp.js`; `getCfg(chave)` (closure local já definida dentro do handler `POST /pedido` em `cardapio.js`, linha ~593, que lê da tabela `config`); `pedidoCompleto` (objeto já montado em `cardapio.js` logo antes da chamada a `notificarWhatsApp(pedidoCompleto)`, contendo `{ id, numero, total, cliente_nome, cliente_telefone, cliente_endereco, itens }`).
- Produces: `notificarPix(pedido, codigoPix, chave)` exportado de `whatsapp.js`, usado apenas por `cardapio.js`.

- [ ] **Step 1: Adicionar o template `pixPendente` ao objeto `MENSAGENS` em `backend/src/services/whatsapp.js`**

Abra `backend/src/services/whatsapp.js` e localize o objeto `MENSAGENS` (começa na linha 57, `const MENSAGENS = {`). Adicione a nova chave `pixPendente` como a última entrada do objeto, antes do `};` de fechamento (linha 130):

```js
  pixPendente: (p, codigo, chave) =>
`🍣 *Pedido #${p.numero} recebido!*

Olá, *${p.cliente_nome}*! 😊

Recebemos seu pedido e ele será *aprovado assim que o pagamento via Pix for confirmado*.

📦 *Itens:*
${p.itens.map(i => `  • ${i.quantidade}x ${i.item_nome}`).join('\n')}

💰 *Total:* ${brl(p.total)}

💳 *Pague com Pix (copia e cola):*
${codigo}

🔑 *Chave Pix:* ${chave}

Assim que o pagamento cair, seu pedido entra em produção! 🙏`,
```

Não esqueça da vírgula após a entrada anterior (`cancelado: (p) => ...`) para manter a sintaxe do objeto válida.

- [ ] **Step 2: Adicionar a função `notificarPix` em `backend/src/services/whatsapp.js`**

Logo abaixo da função `notificarCashback` (termina na linha 728, `}`), adicione:

```js
async function notificarPix(pedido, codigoPix, chave) {
  if (!pedido.cliente_telefone) return;
  try {
    await enviar(pedido.cliente_telefone, MENSAGENS.pixPendente(pedido, codigoPix, chave));
  } catch (err) {
    console.error('[WhatsApp] Erro em notificarPix:', err.message);
  }
}
```

- [ ] **Step 3: Exportar `notificarPix` em `module.exports`**

No bloco `module.exports = { ... }` (linha 730), adicione `notificarPix,` logo após a linha `notificarCashback,`:

```js
  notificarCashback,
  notificarPix,
```

- [ ] **Step 4: Verificar sintaxe do arquivo**

Run: `cd backend && node -e "require('./src/services/whatsapp.js'); console.log('OK: whatsapp.js carrega sem erro e exporta', typeof require('./src/services/whatsapp.js').notificarPix)"`

Expected: `OK: whatsapp.js carrega sem erro e exporta function`

(Isso só valida sintaxe/require — o módulo tem efeitos colaterais como `setInterval`, mas não faz chamadas de rede no require. Se o comando travar sem retornar, mate o processo com Ctrl+C — não é um erro do código, é o `setInterval` de rate-limit mantendo o processo Node vivo; a mensagem "OK" já terá sido impressa antes disso.)

- [ ] **Step 5: Disparar `notificarPix` em `POST /api/cardapio/pedido` (`backend/src/routes/cardapio.js`)**

Localize o bloco que já existe (por volta da linha 744):

```js
  notificarWhatsApp(pedidoCompleto);

  res.status(201).json({ id: pedidoId, numero, total, fidelidade, ganhou_recompensa, brinde_resgatado });
```

Substitua por (adiciona o novo bloco entre a chamada existente e o `res.status`):

```js
  notificarWhatsApp(pedidoCompleto);

  if (forma_pagamento === 'pix' && cliente_telefone?.trim()) {
    try {
      const chavePix = getCfg('pix_chave');
      if (chavePix) {
        const codigoPix = gerarPixPayload({
          chave: chavePix,
          nome: getCfg('pix_nome') || getCfg('nome_restaurante') || 'Recebedor',
          cidade: getCfg('pix_cidade') || 'Cidade',
          valor: total,
          txid: `PED${numero}`,
        });
        require('../services/whatsapp').notificarPix(pedidoCompleto, codigoPix, chavePix);
      }
    } catch (err) {
      console.error('[cardapio] Falha ao notificar Pix:', err.message);
    }
  }

  res.status(201).json({ id: pedidoId, numero, total, fidelidade, ganhou_recompensa, brinde_resgatado });
```

- [ ] **Step 6: Verificar sintaxe do arquivo**

Run: `cd backend && node -e "require('./src/routes/cardapio.js'); console.log('OK: cardapio.js carrega sem erro')"`

Expected: `OK: cardapio.js carrega sem erro`

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/whatsapp.js backend/src/routes/cardapio.js
git commit -m "feat: notifica cliente via WhatsApp com chave Pix ao criar pedido"
```

---

### Task 2: Verificação end-to-end e deploy

**Files:** nenhum arquivo novo — apenas execução e verificação manual.

**Interfaces:**
- Consumes: `notificarPix` e o disparo adicionados na Task 1.
- Produces: confirmação de que a feature funciona local e em produção; deploy concluído.

- [ ] **Step 1: Verificação local — sem chave Pix configurada (caso "não deve enviar nada")**

Suba o backend local (`cd backend && npm run dev`) e confirme, via `sqlite3 backend/data/sushi.db "SELECT valor FROM config WHERE chave='pix_chave'"` (ou a config local equivalente), se há chave configurada.

Se **não houver** chave: crie um pedido de teste local com `forma_pagamento: 'pix'` via `curl` contra `http://localhost:3001/api/cardapio/pedido` (payload mínimo: `cliente_nome`, `cliente_telefone` fictício tipo `00900000099`, `cliente_endereco`, `tipo_entrega: 'entrega'`, `bairro`, `itens: [{item_id: <um id válido do cardápio>, quantidade: 1}]`, `forma_pagamento: 'pix'`).

Expected: pedido criado normalmente (HTTP 201), sem erro nos logs do backend, e nenhuma tentativa de `enviar()` no log (procure por `[WhatsApp]` no console do backend — não deve aparecer nada relacionado a esse pedido).

- [ ] **Step 2: Verificação local — com chave Pix configurada (caso "deve enviar")**

Configure uma chave Pix de teste local (via UI em Configurações do CardapioAdmin, ou diretamente: `INSERT OR REPLACE INTO config (chave,valor) VALUES ('pix_chave','11999999999')` no banco local — **nunca faça isso em produção**, apenas local).

Repita a criação do pedido de teste (Step 1) com `forma_pagamento: 'pix'`.

Expected: nos logs do backend aparece `[WhatsApp] ✅ Enviado para 00900000099` ou `[WhatsApp] ❌ Falha ao enviar para 00900000099: ...` (falha é esperada se o bot local não estiver conectado — o importante é confirmar que `enviar()` foi chamado, ou seja, que o código do Step 5 da Task 1 disparou). Se o bot estiver conectado localmente a um número de teste, confirme visualmente que a mensagem chegou com o texto do template `pixPendente` e o código Pix.

Se você configurou a chave de teste apenas para este teste, restaure o valor original (ou remova a linha) ao final: `DELETE FROM config WHERE chave='pix_chave'` (ou restaure o valor que estava antes, se local já tinha uma configuração).

- [ ] **Step 3: Deploy para produção**

Siga o processo de deploy manual já estabelecido neste projeto: `scp` dos arquivos alterados (`backend/src/services/whatsapp.js`, `backend/src/routes/cardapio.js`) para o VPS (`root@2.25.207.3`, path `/opt/37sushi/paranavaí/app/backend/src/...`), depois `pm2 restart` do processo backend.

Expected: `pm2 status` mostra o processo backend `online` sem restart-loop; `pm2 logs` sem erros de `MODULE_NOT_FOUND` ou sintaxe.

- [ ] **Step 4: Smoke test em produção (dados 100% fictícios)**

**Somente se `WHATSAPP_ENABLED=true` em produção e uma chave Pix real já estiver configurada** (confirme antes: `grep WHATSAPP_ENABLED backend/.env` no servidor). Se `WHATSAPP_ENABLED=false`, pule este step — não há como verificar o envio de fato, e não faz sentido forçar o bot ligado só para este teste.

Crie um pedido de teste em produção via `curl` contra a API de produção, usando **telefone com DDD inválido (`00`)** e nome claramente marcado como teste, ex.: `cliente_nome: "TESTE NOTIFICACAO PIX (ignorar)"`, `cliente_telefone: "00900000099"`, `forma_pagamento: "pix"`.

Expected: HTTP 201; logs do backend em produção (`pm2 logs`) mostram a tentativa de envio via `[WhatsApp]`.

- [ ] **Step 5: Limpeza dos dados de teste em produção**

Se o Step 4 foi executado, delete o pedido fake criado (e o cliente fake, se foi criado em `clientes`) diretamente no banco de produção via SQL, filtrando exatamente pelo telefone fictício usado (`00900000099`) — nunca um `DELETE` sem filtro. Confirme depois que a contagem de linhas em `pdv_pedidos` e `clientes` voltou ao valor anterior ao teste.

- [ ] **Step 6: Atualizar o ledger de progresso**

Append no `.superpowers/sdd/progress.md`: `Task 2: complete (deploy em produção, smoke test <ok/pulado>, dados de teste removidos)`.
