# Notificação de Pix no pedido — Design

**Goal:** quando o cliente finaliza um pedido no cardápio online com forma de pagamento "Pix", o sistema envia automaticamente uma mensagem de WhatsApp para o cliente informando que o pedido será aprovado após a confirmação do pagamento, e enviando o código Pix (copia e cola) + a chave Pix cadastrada.

## Contexto atual

- `POST /api/cardapio/pedido` (`backend/src/routes/cardapio.js`) já recebe `forma_pagamento` (valores: `pix`, `dinheiro`, `cartao_cred`, `cartao_deb`) e persiste em `pdv_pedidos.forma_pagamento`. Não há validação de enum no backend.
- Já existe geração de Pix "copia e cola" (BR Code/EMV) sem gateway: `backend/src/lib/pix.js` (`gerarPixPayload({ chave, nome, cidade, valor, txid })`), usada hoje pelo endpoint público `GET /api/cardapio/pix` (`cardapio.js:57-78`) que a tela do cliente chama para mostrar QR code + botão "copiar código" na tela de confirmação (`frontend/src/pages/Cardapio.jsx:1006-1010, 1199-1210`).
- A chave/nome/cidade do Pix são configuráveis pelo dono em Configurações (`frontend/src/pages/CardapioAdmin.jsx:2680-2689`), salvos na tabela genérica `config` (chaves `pix_chave`, `pix_nome`, `pix_cidade`).
- O envio de WhatsApp para o cliente já existe e funciona por `enviar(telefone, texto)` em `backend/src/services/whatsapp.js`, hoje disparado automaticamente apenas em **mudanças de status** do pedido (aceito, saiu para entrega, entregue, cancelado — `notificarMudancaStatus`, `whatsapp.js:675-693`).
- No momento em que o pedido é **criado**, hoje não é enviada nenhuma mensagem ao cliente: `notificarWhatsApp()` (`cardapio.js:42-47`) apenas chama `notificarNovoPedido()`, que é um stub vazio (`whatsapp.js:750`, `async () => {}`).
- Não existe hoje nenhum estado "aguardando pagamento" no fluxo de status do pedido (`pdv_pedidos.status` segue `novo → espera/preparando → pronto → entregue`). A confirmação manual do Pix já existe como uma ação independente no PDV (`PATCH /api/pdv/pedidos/:id/pix-confirmado`, `pdv.js:214-219`) que só marca um timestamp — não dispara mensagem nem muda `status`.

## Escopo desta feature

Apenas a **mensagem inicial**, disparada no momento da criação do pedido. (Uma segunda mensagem de "pagamento confirmado", disparada quando o atendente marcar "Pix conferido" no PDV, foi avaliada e descartada por ora — fica como possível evolução futura, não faz parte deste plano.)

## Design

### 1. Nova função `notificarPix` em `backend/src/services/whatsapp.js`

Função dedicada (não reaproveita `notificarNovoPedido`, cujo nome sugere aviso ao dono/PDV, não ao cliente):

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

Novo template em `MENSAGENS` (mesmo objeto onde já vivem `espera`, `preparando`, `saindo`, `entregue`, `cancelado`), usando o helper `brl()` já existente no arquivo:

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

Exportar `notificarPix` em `module.exports`.

### 2. Disparo em `POST /api/cardapio/pedido` (`backend/src/routes/cardapio.js`)

Logo após o bloco que já monta `pedidoCompleto`/chama `notificarWhatsApp(pedidoCompleto)` (linha ~744), adicionar, usando o `getCfg` já definido nesse handler (linha ~593) e o `gerarPixPayload` já importado no topo do arquivo:

```js
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
```

- `pedidoCompleto` já contém `itens` (com o brinde de fidelidade incluso, se houver) — reaproveitado tal qual.
- Chamada não é `await`ada — mesmo padrão fire-and-forget do `notificarWhatsApp(pedidoCompleto)` logo acima, para não atrasar a resposta do checkout.
- Se `pix_chave` não estiver configurada (`getCfg('pix_chave')` retorna undefined/vazio), a mensagem simplesmente não é enviada — sem erro para o cliente, sem quebrar o pedido.

## Casos de borda

- **Sem telefone do cliente:** não envia (mesma guarda usada em todo o resto do arquivo — pedido sem telefone é permitido, ex. pedidos feitos no balcão via link).
- **Chave Pix não configurada:** não envia, loga aviso implícito (o `if (chavePix)` simplesmente não entra).
- **Bot do WhatsApp desconectado / erro de envio:** capturado pelo try/catch interno de `notificarPix` (mesmo padrão de `notificarMudancaStatus`) — nunca derruba a criação do pedido, que já foi persistida antes desse bloco rodar.
- **Pedido agendado (`agendado_para` no futuro):** a mensagem é enviada normalmente no momento da criação do pedido (não no horário agendado) — o pagamento via Pix é sobre o pedido em si, não sobre a hora de entrega. Sem mudança necessária aqui.
- **Cupom/desconto aplicado:** `total` já é o valor final (com desconto e frete), igual ao que a tela usa para gerar o QR — o valor do Pix bate com o total cobrado.

## Fora de escopo

- Segunda mensagem de "pagamento confirmado" ao marcar "Pix conferido" no PDV.
- Qualquer mudança em `pdv_pedidos.status` ou no fluxo de aceite/produção existente.
- Validação de enum de `forma_pagamento` no backend (não é necessária para esta feature — o valor `'pix'` já é usado hoje pelo frontend e por outras partes do sistema).
- Envio de QR code como imagem via WhatsApp (a mensagem envia só o código copia-e-cola em texto, como a própria tela do cliente já faz com o botão "copiar código").
