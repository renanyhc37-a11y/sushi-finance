# Emissão de Nota Fiscal (NFC-e) sob demanda — Design

## Contexto

A 37 Sushi emite hoje entre R$30.000 e R$40.000/mês em notas fiscais, sobre um
faturamento de R$80.000-90.000/mês. A emissão é sob demanda (quando o cliente
pede nota), feita manualmente pelo contador, fora do sushi-finance. As notas
são NFC-e (consumidor final, CPF) — não há caso de nota para empresa (CNPJ)
neste momento. A empresa já possui certificado digital A1 vinculado ao CNPJ,
usado hoje pelo contador para emitir manualmente.

**Objetivo:** permitir que o operador do PDV emita a NFC-e de um pedido
específico com um clique, sem depender do contador para cada emissão
individual, e que o cliente receba o link da nota automaticamente pelo
WhatsApp assim que ela for autorizada.

## Escopo

- Emissão **sob demanda**, por pedido — não há emissão automática em massa
  nem emissão obrigatória para todo pedido.
- Apenas **NFC-e** (CPF, consumidor final). Nota para CNPJ fica fora de
  escopo — se surgir demanda futura, é um projeto separado.
- Provedor de integração fiscal: **Focus NFe**. Justificativa: API madura,
  documentação extensa para integrações customizadas, ambiente de
  homologação isolado para testes sem valor fiscal, e é o provedor mais
  comumente usado para esse tipo de integração direta (vs. ERPs completos
  como Bling, que trariam funcionalidade não pedida). Vincular o certificado
  A1 da empresa à conta Focus NFe é uma ação administrativa que cabe ao
  dono/contador da empresa, fora do escopo deste projeto de software.
- Ambiente de **homologação primeiro**: todo o fluxo (botão, emissão, status,
  envio por WhatsApp) é validado em homologação antes de qualquer chave de
  produção ser configurada. Isso evita gerar uma nota fiscal real por engano
  durante o desenvolvimento.

## Arquitetura

### Banco de dados

Nova tabela `notas_fiscais`, uma linha por tentativa de emissão, ligada ao
pedido:

```sql
CREATE TABLE notas_fiscais (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pdv_pedidos(id),
  cpf_cliente TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processando',
    -- 'processando' | 'autorizada' | 'rejeitada' | 'cancelada'
  ref TEXT NOT NULL,           -- identificador único enviado à Focus NFe (idempotência)
  numero INTEGER,
  chave_acesso TEXT,
  link_danfe TEXT,
  motivo_erro TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

`pdv_pedidos` não precisa de colunas novas — a nota é uma entidade à parte,
consultada pelo `pedido_id`. Um pedido pode ter mais de uma linha em
`notas_fiscais` se a primeira tentativa for rejeitada e o operador tentar de
novo (ex.: CPF corrigido).

### Backend

**`backend/src/services/focusNfe.js`** — cliente HTTP para a API da Focus
NFe. Responsabilidades:
- `emitirNfce({ ref, cliente, itens, formaPagamento, total })` → monta o
  payload no formato da Focus NFe e faz o POST de emissão.
- `consultarNfce(ref)` → GET de status por referência.
- Lê `FOCUS_NFE_TOKEN` e `FOCUS_NFE_AMBIENTE` (`homologacao`/`producao`) de
  variáveis de ambiente — nunca hardcoded.

**Rotas novas em `backend/src/routes/pdv.js`** (mesmo arquivo que já trata
pedidos do PDV):
- `POST /pedidos/:id/nota-fiscal` — recebe `{ cpf }` no corpo. Busca o
  pedido e seus itens (`pdv_pedidos` + `pdv_itens`), monta o payload, chama
  `emitirNfce`, grava uma linha em `notas_fiscais` com status `processando`
  e a `ref` gerada (ex.: `pedido-${id}-${timestamp}`). Responde imediatamente
  com o registro criado — a emissão na SEFAZ é assíncrona.
- `GET /pedidos/:id/nota-fiscal` — retorna a linha mais recente de
  `notas_fiscais` para aquele pedido (ou `null` se nunca foi emitida).
- `POST /nota-fiscal/webhook` — endpoint público (autenticado por segredo
  compartilhado na URL ou header, conforme suportado pela Focus NFe) que
  recebe a notificação de mudança de status (autorizada/rejeitada) e
  atualiza a linha correspondente em `notas_fiscais` pela `ref`. É esse
  webhook que dispara o envio da mensagem de WhatsApp quando o status vira
  `autorizada`.

**Envio por WhatsApp:** ao processar o webhook e detectar status
`autorizada`, reaproveita `salvarMensagemEnviada`/`enviar` (já existentes em
`backend/src/services/whatsapp.js`) para mandar ao `pdv_pedidos.cliente_telefone`
uma mensagem com o link do DANFE. Se `status` vier `rejeitada`, não envia
nada ao cliente — o erro fica visível só para o operador no PDV.

### Frontend (PDV.jsx)

No card do pedido (mesmo componente onde já existe a borda de status),
adicionar um botão "Emitir nota":
1. Clique abre um pequeno formulário inline pedindo o CPF (campo único,
   validação básica de 11 dígitos).
2. Ao confirmar, `POST /pedidos/:id/nota-fiscal` e o botão muda para
   "Processando...".
3. Polling simples (reaproveitando o padrão de intervalo já usado em outras
   telas do PDV) em `GET /pedidos/:id/nota-fiscal` até status sair de
   `processando`.
4. Quando `autorizada`: botão vira link "Ver nota" (abre `link_danfe`).
   Quando `rejeitada`: mostra o `motivo_erro` e permite tentar de novo.

## Tratamento de erros

- CPF inválido: validado no frontend antes de enviar (11 dígitos, checagem
  de dígito verificador) — evita rodada desnecessária à API.
- Falha de rede/timeout ao chamar a Focus NFe: a rota `POST` responde com
  erro e não grava linha em `notas_fiscais` (nada fica "processando" para
  sempre por causa de um erro síncrono).
- Rejeição pela SEFAZ (dados incorretos, contingência etc.): chega via
  webhook como `rejeitada` com `motivo_erro` preenchido — o operador vê o
  motivo e decide se corrige e tenta de novo.
- Nunca reprocessar uma nota já `autorizada` automaticamente — cancelamento
  de NFC-e é operação manual, fora de escopo deste projeto.

## Testes

- Testes de unidade para `focusNfe.js` mockando a chamada HTTP (payload
  montado corretamente a partir de um pedido de exemplo).
- Teste de integração da rota `POST /pedidos/:id/nota-fiscal` contra o
  ambiente de **homologação** real da Focus NFe (não mockado) — é o único
  jeito de validar o payload contra o formato real esperado pela SEFAZ.
- Teste manual do fluxo completo em homologação: emitir → aguardar
  autorização → confirmar que a mensagem de WhatsApp chega ao número de
  teste.

## Pré-requisito fora do código

Antes da fase de produção (não bloqueia o desenvolvimento em homologação):
o dono/contador da 37 Sushi precisa criar a conta na Focus NFe e vincular o
certificado A1 existente a ela. Isso é administrativo, não é uma tarefa de
implementação.
