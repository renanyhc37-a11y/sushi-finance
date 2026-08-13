# Emissão de Nota Fiscal (NFC-e) sob demanda — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o operador do PDV emita a NFC-e de um pedido específico com um clique (via API da Focus NFe), sem depender do contador para cada emissão individual, com envio automático do link da nota ao cliente por WhatsApp quando autorizada.

**Architecture:** Nova tabela `notas_fiscais` ligada a `pdv_pedidos`. Um service puro `focusNfe.js` fala com a API REST da Focus NFe (autenticação HTTP Basic, token como usuário). Uma rota `POST /api/pdv/pedidos/:id/nota-fiscal` monta o payload a partir do pedido, chama a Focus NFe **de forma síncrona** (a API de NFC-e da Focus NFe é toda síncrona — a resposta HTTP já vem com o resultado final, autorizado ou rejeitado, sem webhook), grava o resultado e, se autorizada, dispara o WhatsApp na hora. O card do pedido no PDV ganha um botão "Emitir nota".

**Tech Stack:** Node 24 (`fetch` global nativo, `node:sqlite`, `node:test` para testes — sem dependências novas), Express, React 18.

## Nota sobre a spec original

A spec (`docs/superpowers/specs/2026-08-13-nota-fiscal-nfce-design.md`) assumia um fluxo assíncrono com webhook, por analogia com NF-e. Ao consultar a documentação oficial da Focus NFe (`doc.focusnfe.com.br/reference/emitir_nfce`) durante o planejamento, confirmei que **a emissão de NFC-e é 100% síncrona**: a chamada HTTP de emissão já devolve `status: autorizado` ou `status: erro_autorizacao` na mesma resposta. Isso elimina a necessidade do endpoint de webhook, do registro de rota antes do `requireAuth`, e do broadcast SSE — a rota de emissão simplesmente responde ao frontend com o resultado final. Mantém-se tudo o mais do desenho aprovado (tabela, service, botão no PDV, envio por WhatsApp).

## Global Constraints

- Só **NFC-e** (CPF, consumidor final) — nunca CNPJ/NF-e neste projeto.
- Emissão **sob demanda**, por pedido — nunca automática ou em massa.
- Provedor: **Focus NFe**. Auth: HTTP Basic, token da conta como usuário, senha vazia.
- Endpoints reais (confirmados na doc oficial):
  - Emitir: `POST https://homologacao.focusnfe.com.br/v2/nfce?ref={ref}` (homologação) / `https://api.focusnfe.com.br/v2/nfce?ref={ref}` (produção)
  - Consultar: `GET .../v2/nfce/{ref}?completa=1`
- **Nunca reprocessar automaticamente** uma nota já `autorizada`. Rejeição permite nova tentativa (novo `ref`).
- DB: SQLite via `node:sqlite`. Tabelas novas em `backend/src/db/database.js`, sempre `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN`. **Nunca `DROP TABLE`.**
- WhatsApp: reaproveitar `enviar()` de `backend/src/services/whatsapp.js` — nunca reimplementar o envio.
- **Assunções fiscais que precisam confirmação do contador antes de produção** (documentadas no código com comentário, não são "TBD" — são defaults reais e funcionais, mas assumidos para Simples Nacional, o regime mais comum para este porte de empresa):
  - CSOSN/`icms_situacao_tributaria`: `102` (tributada pelo Simples, sem crédito) — é literalmente o exemplo padrão da própria doc da Focus NFe para este campo.
  - `pis_situacao_tributaria` / `cofins_situacao_tributaria`: `99` (outras operações) — padrão de mercado para Simples Nacional.
  - NCM padrão dos itens: `21069090` ("outras preparações alimentícias") — padrão de mercado para refeição pronta de restaurante/delivery.
  - Forma de pagamento PIX mapeada para código `99` (outros) na Focus NFe — a doc oficial consultada não listava um código dedicado para Pix na tabela de formas de pagamento; confirmar com o contador/Focus NFe se existe código mais específico antes de produção.
- Sem framework de testes no projeto (nenhum `jest`/`vitest` instalado). Usar `node:test` (nativo do Node 24, zero dependência nova) — adicionar `"test": "node --test"` ao `backend/package.json`. **Atenção:** `node --test src` (com o diretório como argumento posicional) faz o Node resolver `src` como módulo (`src/index.js`) em vez de escanear recursivamente — sobe o servidor de verdade e trava/derruba em `EADDRINUSE`. Sem argumento, `node --test` faz a descoberta recursiva correta a partir do cwd (`backend/`). Corrigido durante a Task 1 (commit `f9579bd`) depois de descoberto ao vivo — documentado aqui pra quem reler o plano.
- Sem certificado/conta Focus NFe configurados ainda neste momento (dono/contador precisa criar a conta e vincular o certificado A1 — fora do escopo deste plano). Por isso, a verificação **ao vivo contra a Focus NFe real** fica para depois que a conta existir; as tarefas abaixo verificam tudo o que dá pra verificar sem ela (testes unitários com `fetch` mockado, e um stub HTTP local que imita o formato de resposta da Focus NFe para exercitar o fluxo ponta a ponta).

---

### Task 1: Validador de CPF

**Files:**
- Create: `backend/src/utils/cpf.js`
- Create: `frontend/src/lib/cpf.js`
- Test: `backend/src/utils/cpf.test.js`

**Interfaces:**
- Produces: `cpfValido(cpf: string): boolean` (backend, `backend/src/utils/cpf.js`, `module.exports = { cpfValido, formatarCpf }`)
- Produces: `cpfValido(cpf: string): boolean`, `formatarCpf(cpf: string): string` (frontend, `frontend/src/lib/cpf.js`, named exports)

- [ ] **Step 1: Escrever o teste que falha**

Crie `backend/src/utils/cpf.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cpfValido, formatarCpf } = require('./cpf');

test('aceita CPF válido com pontuação', () => {
  assert.equal(cpfValido('111.444.777-35'), true);
});

test('aceita CPF válido sem pontuação', () => {
  assert.equal(cpfValido('11144477735'), true);
});

test('rejeita CPF com dígito verificador errado', () => {
  assert.equal(cpfValido('111.444.777-30'), false);
});

test('rejeita CPF com todos os dígitos iguais', () => {
  assert.equal(cpfValido('111.111.111-11'), false);
});

test('rejeita CPF com menos de 11 dígitos', () => {
  assert.equal(cpfValido('123456789'), false);
});

test('rejeita vazio/undefined', () => {
  assert.equal(cpfValido(''), false);
  assert.equal(cpfValido(undefined), false);
});

test('formatarCpf aplica a máscara padrão', () => {
  assert.equal(formatarCpf('11144477735'), '111.444.777-35');
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && node --test src/utils/cpf.test.js`
Expected: FAIL — `Cannot find module './cpf'`

- [ ] **Step 3: Implementar**

Crie `backend/src/utils/cpf.js`:

```js
function cpfValido(cpf) {
  const d = String(cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  const digitoVerificador = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digitoVerificador(9) === Number(d[9]) && digitoVerificador(10) === Number(d[10]);
}

function formatarCpf(cpf) {
  const d = String(cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

module.exports = { cpfValido, formatarCpf };
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && node --test src/utils/cpf.test.js`
Expected: PASS — 7/7 testes

- [ ] **Step 5: Criar a versão frontend (mesma lógica, ESM)**

Crie `frontend/src/lib/cpf.js`:

```js
export function cpfValido(cpf) {
  const d = String(cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  const digitoVerificador = (tamanho) => {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += Number(d[i]) * (tamanho + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digitoVerificador(9) === Number(d[9]) && digitoVerificador(10) === Number(d[10]);
}

export function formatarCpf(cpf) {
  const d = String(cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}
```

- [ ] **Step 6: Adicionar script de teste ao backend**

Edite `backend/package.json`, adicione ao objeto `"scripts"`:

```json
    "test": "node --test",
```

- [ ] **Step 7: Rodar a suíte inteira (só este arquivo existe por enquanto) e commitar**

Run: `cd backend && npm test`
Expected: PASS — 7/7 testes

```bash
git add backend/src/utils/cpf.js backend/src/utils/cpf.test.js backend/package.json frontend/src/lib/cpf.js
git commit -m "feat(nota-fiscal): validador de CPF (backend + frontend)"
```

---

### Task 2: Cliente HTTP da Focus NFe + montagem do payload

**Files:**
- Create: `backend/src/services/focusNfe.js`
- Test: `backend/src/services/focusNfe.test.js`

**Interfaces:**
- Consumes: nada de tasks anteriores (service independente).
- Produces:
  - `emitirNfce(ref: string, payload: object): Promise<object>` — retorna o JSON de resposta da Focus NFe (contém `status`, `chave_nfe`, `numero`, `caminho_danfe`, `mensagem_sefaz`, `qrcode_url`, `erros`, etc, conforme o que a API devolver).
  - `linkCompleto(caminho: string|null): string|null` — prefixa `caminho_danfe`/similares (paths relativos) com a base URL configurada.
  - `montarPayloadNfce({ pedido, itens, cpf, cnpjEmitente }): object` — `pedido` é uma linha de `pdv_pedidos`, `itens` é um array de `{ item_nome, quantidade, valor_unitario, ncm }` (o campo `ncm` já resolvido pelo chamador — ver Task 3), `cpf` já limpo (só dígitos).
  - `mapaFormaPagamento: { dinheiro: '01', cartao_cred: '03', cartao_deb: '04', pix: '99' }`
  - `NCM_PADRAO = '21069090'`

- [ ] **Step 1: Escrever os testes que falham**

Crie `backend/src/services/focusNfe.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');

test('emitirNfce faz POST com Basic Auth e devolve o JSON da resposta', async () => {
  process.env.FOCUS_NFE_TOKEN = 'token-de-teste';
  process.env.FOCUS_NFE_AMBIENTE = 'homologacao';
  delete require.cache[require.resolve('./focusNfe')];
  const { emitirNfce } = require('./focusNfe');

  const original = global.fetch;
  let urlChamada, optsChamados;
  global.fetch = async (url, opts) => {
    urlChamada = url; optsChamados = opts;
    return { status: 201, json: async () => ({ status: 'autorizado', ref: 'ref-1', chave_nfe: 'abc', caminho_danfe: '/notas/x.html' }) };
  };

  try {
    const r = await emitirNfce('ref-1', { natureza_operacao: 'VENDA AO CONSUMIDOR' });
    assert.equal(r.status, 'autorizado');
    assert.equal(r.chave_nfe, 'abc');
    assert.equal(urlChamada, 'https://homologacao.focusnfe.com.br/v2/nfce?ref=ref-1');
    assert.equal(optsChamados.method, 'POST');
    assert.equal(optsChamados.headers.Authorization, `Basic ${Buffer.from('token-de-teste:').toString('base64')}`);
    assert.equal(optsChamados.headers['Content-Type'], 'application/json');
  } finally {
    global.fetch = original;
  }
});

test('linkCompleto prefixa caminho relativo com a base URL de homologação', () => {
  process.env.FOCUS_NFE_AMBIENTE = 'homologacao';
  delete require.cache[require.resolve('./focusNfe')];
  const { linkCompleto } = require('./focusNfe');
  assert.equal(linkCompleto('/notas/x.html'), 'https://homologacao.focusnfe.com.br/notas/x.html');
});

test('linkCompleto devolve null quando não há caminho', () => {
  const { linkCompleto } = require('./focusNfe');
  assert.equal(linkCompleto(null), null);
  assert.equal(linkCompleto(undefined), null);
});

test('montarPayloadNfce monta natureza, destinatário e formas de pagamento', () => {
  const { montarPayloadNfce } = require('./focusNfe');
  const pedido = { cliente_nome: 'Renan Teste', tipo_entrega: 'entrega', forma_pagamento: 'pix', total: 45.9 };
  const itens = [{ item_nome: 'Combinado 20 peças', quantidade: 1, valor_unitario: 45.9, ncm: '21069090' }];
  const payload = montarPayloadNfce({ pedido, itens, cpf: '11144477735', cnpjEmitente: '12345678000123' });

  assert.equal(payload.cnpj_emitente, '12345678000123');
  assert.equal(payload.cpf_destinatario, '11144477735');
  assert.equal(payload.nome_destinatario, 'Renan Teste');
  assert.equal(payload.presenca_comprador, '4');
  assert.equal(payload.formas_pagamento[0].forma_pagamento, '99');
  assert.equal(payload.formas_pagamento[0].valor_pagamento, 45.9);
  assert.equal(payload.items.length, 1);
  assert.equal(payload.items[0].descricao, 'Combinado 20 peças');
  assert.equal(payload.items[0].codigo_ncm, '21069090');
  assert.equal(payload.items[0].cfop, '5102');
  assert.equal(payload.items[0].icms_situacao_tributaria, '102');
  assert.equal(payload.items[0].valor_bruto, 45.9);
});

test('montarPayloadNfce usa presenca_comprador "1" pra retirada', () => {
  const { montarPayloadNfce } = require('./focusNfe');
  const pedido = { cliente_nome: 'Cliente', tipo_entrega: 'retirada', forma_pagamento: 'dinheiro', total: 10 };
  const itens = [{ item_nome: 'Item', quantidade: 1, valor_unitario: 10, ncm: '21069090' }];
  const payload = montarPayloadNfce({ pedido, itens, cpf: '11144477735', cnpjEmitente: '123' });
  assert.equal(payload.presenca_comprador, '1');
  assert.equal(payload.formas_pagamento[0].forma_pagamento, '01');
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && node --test src/services/focusNfe.test.js`
Expected: FAIL — `Cannot find module './focusNfe'`

- [ ] **Step 3: Implementar**

Crie `backend/src/services/focusNfe.js`:

```js
// Cliente HTTP da API da Focus NFe (emissão de NFC-e). A emissão de NFC-e é
// SÍNCRONA nessa API: a resposta do POST já vem com o resultado final
// (autorizado/erro_autorizacao), sem necessidade de webhook.
// Doc oficial: https://doc.focusnfe.com.br/reference/emitir_nfce

function baseUrl() {
  if (process.env.FOCUS_NFE_BASE_URL) return process.env.FOCUS_NFE_BASE_URL;
  return process.env.FOCUS_NFE_AMBIENTE === 'producao'
    ? 'https://api.focusnfe.com.br'
    : 'https://homologacao.focusnfe.com.br';
}

function authHeader() {
  const token = process.env.FOCUS_NFE_TOKEN || '';
  return `Basic ${Buffer.from(`${token}:`).toString('base64')}`;
}

async function emitirNfce(ref, payload) {
  const r = await fetch(`${baseUrl()}/v2/nfce?ref=${encodeURIComponent(ref)}`, {
    method: 'POST',
    headers: { Authorization: authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  return { httpStatus: r.status, ...data };
}

async function consultarNfce(ref) {
  const r = await fetch(`${baseUrl()}/v2/nfce/${encodeURIComponent(ref)}?completa=1`, {
    headers: { Authorization: authHeader() },
  });
  const data = await r.json();
  return { httpStatus: r.status, ...data };
}

function linkCompleto(caminho) {
  if (!caminho) return null;
  return `${baseUrl()}${caminho}`;
}

// ── Defaults fiscais assumidos para Simples Nacional (confirmar com o
// contador antes de produção — ver Global Constraints do plano) ──────────
const NCM_PADRAO = '21069090'; // "outras preparações alimentícias"
const CFOP_VENDA = '5102';     // venda dentro do estado, consumidor final
const ICMS_ORIGEM = '0';
const ICMS_SITUACAO_TRIBUTARIA = '102'; // CSOSN 102 — tributada pelo Simples, sem crédito
const PIS_SITUACAO_TRIBUTARIA = '99';
const COFINS_SITUACAO_TRIBUTARIA = '99';

const mapaFormaPagamento = {
  dinheiro: '01',
  cartao_cred: '03',
  cartao_deb: '04',
  pix: '99', // Focus NFe não documentava código dedicado p/ Pix — confirmar
};

function montarPayloadNfce({ pedido, itens, cpf, cnpjEmitente }) {
  return {
    natureza_operacao: 'VENDA AO CONSUMIDOR',
    data_emissao: new Date().toISOString(),
    presenca_comprador: pedido.tipo_entrega === 'retirada' ? '1' : '4',
    modalidade_frete: '9',
    local_destino: '1',
    cnpj_emitente: cnpjEmitente,
    cpf_destinatario: cpf,
    nome_destinatario: pedido.cliente_nome,
    items: itens.map((item, i) => {
      const valorBruto = Number((item.valor_unitario * item.quantidade).toFixed(2));
      return {
        numero_item: String(i + 1),
        codigo_produto: String(item.id ?? i + 1),
        codigo_ncm: item.ncm || NCM_PADRAO,
        descricao: item.item_nome,
        cfop: CFOP_VENDA,
        unidade_comercial: 'un',
        unidade_tributavel: 'un',
        quantidade_comercial: item.quantidade,
        quantidade_tributavel: item.quantidade,
        valor_unitario_comercial: item.valor_unitario,
        valor_unitario_tributavel: item.valor_unitario,
        valor_bruto: valorBruto,
        icms_origem: ICMS_ORIGEM,
        icms_situacao_tributaria: ICMS_SITUACAO_TRIBUTARIA,
        pis_situacao_tributaria: PIS_SITUACAO_TRIBUTARIA,
        cofins_situacao_tributaria: COFINS_SITUACAO_TRIBUTARIA,
      };
    }),
    formas_pagamento: [{
      forma_pagamento: mapaFormaPagamento[pedido.forma_pagamento] || '99',
      valor_pagamento: pedido.total,
    }],
  };
}

module.exports = {
  emitirNfce,
  consultarNfce,
  linkCompleto,
  montarPayloadNfce,
  mapaFormaPagamento,
  NCM_PADRAO,
};
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && node --test src/services/focusNfe.test.js`
Expected: PASS — 5/5 testes

- [ ] **Step 5: Rodar a suíte inteira e commitar**

Run: `cd backend && npm test`
Expected: PASS — 12/12 testes (7 de cpf + 5 de focusNfe)

```bash
git add backend/src/services/focusNfe.js backend/src/services/focusNfe.test.js
git commit -m "feat(nota-fiscal): cliente HTTP da Focus NFe + montagem do payload de NFC-e"
```

---

### Task 3: Tabela `notas_fiscais`, coluna NCM, rotas e notificação WhatsApp

**Files:**
- Modify: `backend/src/db/database.js` (adicionar bloco de migração)
- Modify: `backend/src/services/whatsapp.js` (adicionar `notificarNotaFiscalAutorizada`)
- Modify: `backend/src/routes/pdv.js` (rotas + embutir nota no `pedidoComItens`)

**Interfaces:**
- Consumes: `cpfValido` de `../utils/cpf` (Task 1); `emitirNfce`, `linkCompleto`, `montarPayloadNfce` de `../services/focusNfe` (Task 2).
- Produces:
  - `POST /api/pdv/pedidos/:id/nota-fiscal` — body `{ cpf }` → `201 { id, status: 'autorizada'|'rejeitada'|'erro_comunicacao', link_danfe, mensagem_sefaz }` ou `400`/`404`/`500`/`502` com `{ erro }`.
  - `GET /api/pdv/pedidos/:id/nota-fiscal` — retorna a linha mais recente de `notas_fiscais` para o pedido, ou `null`.
  - `pedidoComItens(pedido)` passa a incluir `nota_fiscal: { status, link_danfe } | null`.
  - `notificarNotaFiscalAutorizada(pedido, linkDanfe): Promise<void>` exportada de `services/whatsapp.js`.

- [ ] **Step 1: Migração — tabela `notas_fiscais` e coluna `cardapio_itens.ncm`**

Em `backend/src/db/database.js`, logo após o bloco `chatTables` (linha ~123, depois do `try { raw.exec(chatTables); } ...`), adicione:

```js
// ── Nota fiscal (NFC-e) ────────────────────────────────────────
const notaFiscalTables = `
  CREATE TABLE IF NOT EXISTS notas_fiscais (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL REFERENCES pdv_pedidos(id),
    cpf_cliente TEXT NOT NULL,
    status TEXT NOT NULL,
    ref TEXT NOT NULL UNIQUE,
    numero TEXT,
    chave_nfe TEXT,
    link_danfe TEXT,
    qrcode_url TEXT,
    mensagem_sefaz TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_notas_fiscais_pedido ON notas_fiscais(pedido_id);
`;
try { raw.exec(notaFiscalTables); } catch(e) { console.error('notaFiscalTables migration:', e.message); }
```

Na lista `migrations` (array `const migrations = [...]`, linha ~170), adicione ao final, antes do `];`:

```js
  `ALTER TABLE cardapio_itens ADD COLUMN ncm TEXT`,
```

- [ ] **Step 2: Verificar a migração manualmente**

Run: `cd backend && node -e "require('./src/db/database'); console.log('ok')"`
Expected: imprime `ok` sem erro (a migração roda no `require`, no boot do módulo).

Run: `cd backend && node -e "const db=require('./src/db/database'); console.log(db.prepare(\"SELECT sql FROM sqlite_master WHERE name='notas_fiscais'\").get())"`
Expected: imprime o `CREATE TABLE` de `notas_fiscais`.

- [ ] **Step 3: `notificarNotaFiscalAutorizada` em `whatsapp.js`**

Em `backend/src/services/whatsapp.js`, logo após `notificarPixConfirmado` (antes do `module.exports`), adicione:

```js
async function notificarNotaFiscalAutorizada(pedido, linkDanfe) {
  if (!pedido.cliente_telefone) return;
  try {
    await enviar(pedido.cliente_telefone, `🧾 Sua nota fiscal do pedido #${pedido.numero} foi emitida!\n\n${linkDanfe}`);
  } catch (err) {
    console.error('[WhatsApp] Erro em notificarNotaFiscalAutorizada:', err.message);
  }
}
```

No `module.exports` (linha ~798), adicione a chave `notificarNotaFiscalAutorizada,` junto das outras `notificar*` (ex.: logo abaixo de `notificarPixConfirmado,`).

- [ ] **Step 4: Rotas em `pdv.js`**

Em `backend/src/routes/pdv.js`, adicione o `require` no topo (junto de `const db = require('../db/database');`):

```js
const { cpfValido } = require('../utils/cpf');
const { emitirNfce, linkCompleto, montarPayloadNfce } = require('../services/focusNfe');
```

Modifique `pedidoComItens` (linha ~70) para embutir a nota fiscal mais recente:

```js
function pedidoComItens(pedido) {
  const itens = db.prepare('SELECT * FROM pdv_itens WHERE pedido_id = ? ORDER BY id').all(pedido.id);
  let cliente_total_pedidos = 0;
  if (pedido.cliente_telefone) {
    try {
      const r = db.prepare('SELECT COUNT(*) c FROM pdv_pedidos WHERE cliente_telefone = ? AND id <= ?').get(pedido.cliente_telefone, pedido.id);
      cliente_total_pedidos = r?.c || 0;
    } catch {}
  }
  const nota_fiscal = db.prepare(
    'SELECT status, link_danfe, mensagem_sefaz FROM notas_fiscais WHERE pedido_id = ? ORDER BY id DESC LIMIT 1'
  ).get(pedido.id) || null;
  return { ...pedido, itens, cliente_total_pedidos, nota_fiscal };
}
```

(Só a linha do `nota_fiscal` e o campo a mais no `return` são novos — o resto da função permanece igual.)

Adicione as duas rotas novas logo após a rota `GET /pedidos/:id` (linha ~115, antes do comentário `// ── Auto-deducao de estoque`):

```js
// POST /api/pdv/pedidos/:id/nota-fiscal — emite a NFC-e do pedido (síncrono)
router.post('/pedidos/:id/nota-fiscal', async (req, res) => {
  const { cpf } = req.body || {};
  if (!cpfValido(cpf)) return res.status(400).json({ erro: 'CPF inválido' });

  const pedido = db.prepare('SELECT * FROM pdv_pedidos WHERE id = ?').get(req.params.id);
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado' });

  const cnpjEmitente = process.env.FOCUS_NFE_CNPJ;
  if (!process.env.FOCUS_NFE_TOKEN || !cnpjEmitente) {
    return res.status(500).json({ erro: 'Integração fiscal não configurada (defina FOCUS_NFE_TOKEN e FOCUS_NFE_CNPJ no .env)' });
  }

  const itensPedido = db.prepare('SELECT * FROM pdv_itens WHERE pedido_id = ?').all(pedido.id);
  const { NCM_PADRAO } = require('../services/focusNfe');
  const itens = itensPedido.map(item => {
    const cItem = db.prepare('SELECT ncm FROM cardapio_itens WHERE nome = ? LIMIT 1').get(item.item_nome);
    return { ...item, ncm: cItem?.ncm || NCM_PADRAO };
  });

  const cpfLimpo = String(cpf).replace(/\D/g, '');
  const ref = `pedido-${pedido.id}-${Date.now()}`;
  const payload = montarPayloadNfce({ pedido, itens, cpf: cpfLimpo, cnpjEmitente });

  let resultado;
  try {
    resultado = await emitirNfce(ref, payload);
  } catch (e) {
    return res.status(502).json({ erro: 'Falha ao comunicar com a Focus NFe: ' + e.message });
  }

  const status = resultado.status === 'autorizado' ? 'autorizada'
    : resultado.status === 'erro_autorizacao' ? 'rejeitada'
    : (resultado.status || 'erro_comunicacao');
  const linkDanfe = linkCompleto(resultado.caminho_danfe);

  const row = db.prepare(`
    INSERT INTO notas_fiscais (pedido_id, cpf_cliente, status, ref, numero, chave_nfe, link_danfe, qrcode_url, mensagem_sefaz)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(pedido.id, cpfLimpo, status, ref, resultado.numero || null, resultado.chave_nfe || null, linkDanfe, resultado.qrcode_url || null, resultado.mensagem_sefaz || null);

  if (status === 'autorizada' && pedido.cliente_telefone) {
    const { notificarNotaFiscalAutorizada } = require('../services/whatsapp');
    notificarNotaFiscalAutorizada(pedido, linkDanfe).catch(() => {});
  }

  res.status(201).json({ id: row.lastInsertRowid, status, link_danfe: linkDanfe, mensagem_sefaz: resultado.mensagem_sefaz || null });
});

// GET /api/pdv/pedidos/:id/nota-fiscal — última nota emitida pra esse pedido (ou null)
router.get('/pedidos/:id/nota-fiscal', (req, res) => {
  const nota = db.prepare('SELECT * FROM notas_fiscais WHERE pedido_id = ? ORDER BY id DESC LIMIT 1').get(req.params.id);
  res.json(nota || null);
});
```

- [ ] **Step 5: Verificar o caminho de erro "não configurado" (não precisa de conta Focus NFe)**

Suba o backend (`cd backend && npm run dev`) e, em outro terminal, pegue um `pedido_id` real e um JWT válido (ex.: via login) — ou, mais simples, confirme que a variável de ambiente está ausente e teste o 500:

Run:
```bash
cd backend
grep -q FOCUS_NFE_TOKEN .env || echo "FOCUS_NFE_TOKEN ausente — esperado neste ponto"
```
Expected: imprime a mensagem — confirma que a integração ainda não está configurada, então a rota deve responder 500. Faça uma chamada real com curl usando um token JWT válido do seu `.env`/login e um `pedido_id` existente:

```bash
curl -s -X POST http://localhost:3001/api/pdv/pedidos/1/nota-fiscal \
  -H "Authorization: Bearer SEU_JWT_AQUI" -H "Content-Type: application/json" \
  -d '{"cpf":"11144477735"}'
```
Expected: `{"erro":"Integração fiscal não configurada (defina FOCUS_NFE_TOKEN e FOCUS_NFE_CNPJ no .env)"}` com status 500.

- [ ] **Step 6: Verificar o fluxo completo com um stub HTTP local (sem precisar de conta Focus NFe real)**

Crie um arquivo temporário `backend/stub-focus-nfe.js` (não commitar — é só pra verificação manual):

```js
// Stub temporário que imita a resposta da Focus NFe, só para verificar o
// fluxo ponta a ponta antes de existir uma conta real. Rode em paralelo ao
// backend, com FOCUS_NFE_BASE_URL=http://localhost:9999 apontando pra cá.
const http = require('http');
http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    console.log('[stub focus nfe] recebido:', req.method, req.url, body);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'autorizado', ref: 'ref-stub', chave_nfe: 'NFe-STUB-123',
      numero: '1', serie: '1', caminho_danfe: '/stub/danfe.html',
      qrcode_url: 'http://stub/qrcode', mensagem_sefaz: 'Autorizado (stub)',
    }));
  });
}).listen(9999, () => console.log('stub Focus NFe ouvindo em :9999'));
```

Rode em paralelo:
```bash
cd backend && node stub-focus-nfe.js
```

Em outro terminal, com o backend já rodando (`npm run dev`) e as variáveis `FOCUS_NFE_TOKEN=stub`, `FOCUS_NFE_CNPJ=12345678000123`, `FOCUS_NFE_BASE_URL=http://localhost:9999` definidas no `.env` (temporariamente), repita a chamada curl do Step 5 com um `pedido_id` que tenha itens e `cliente_telefone` preenchidos.

Expected: resposta `201` com `"status":"autorizada"` e `"link_danfe":"http://localhost:9999/stub/danfe.html"`; no log do stub aparece o payload recebido (confirme visualmente que `items`, `cpf_destinatario`, `formas_pagamento` estão preenchidos); no log do backend aparece a tentativa de `[WhatsApp] ... Falha ao enviar` (esperado — o `whatsapp-service` não está rodando neste teste, e isso não deve quebrar a resposta HTTP, que já foi enviada antes).

Depois de verificar, remova o `.env` temporário (volte `FOCUS_NFE_*` ao estado anterior) e apague `backend/stub-focus-nfe.js` — ele não deve ser commitado.

- [ ] **Step 7: Commit**

```bash
git add backend/src/db/database.js backend/src/services/whatsapp.js backend/src/routes/pdv.js
git commit -m "feat(nota-fiscal): tabela notas_fiscais, rotas de emissão/consulta e aviso por WhatsApp"
```

---

### Task 4: Botão "Emitir nota" no PDV

**Files:**
- Modify: `frontend/src/pages/PDV.jsx`

**Interfaces:**
- Consumes: `cpfValido`, `formatarCpf` de `../lib/cpf` (Task 1); `POST /api/pdv/pedidos/:id/nota-fiscal` e o campo `pedido.nota_fiscal` (Task 3).

- [ ] **Step 1: Import e estado**

No topo de `frontend/src/pages/PDV.jsx`, junto dos outros imports (linha ~1-16), adicione:

```js
import { cpfValido, formatarCpf } from '../lib/cpf';
```

Dentro do componente principal do PDV (mesmo escopo onde vivem `pedidoAberto`/`pedidoModal`, próximo à declaração desses estados), adicione:

```js
const [notaEmCpf, setNotaEmCpf] = useState(null);   // pedido cujo prompt de CPF está aberto
const [cpfDigitado, setCpfDigitado] = useState('');
const [emitindoNota, setEmitindoNota] = useState(false);
```

- [ ] **Step 2: Handler de emissão**

Logo após a função `confirmarPix` (linha ~1841 em `frontend/src/pages/PDV.jsx`), adicione:

```js
async function emitirNotaFiscal(pedido, cpf) {
  setEmitindoNota(true);
  try {
    const r = await fetch(`${BASE}/pdv/pedidos/${pedido.id}/nota-fiscal`, {
      method: 'POST', headers: authH(), body: JSON.stringify({ cpf: cpf.replace(/\D/g, '') }),
    });
    const data = await r.json();
    if (!r.ok) { toast.error(data.erro || 'Erro ao emitir nota'); return; }
    if (data.status === 'autorizada') toast.success(`Nota fiscal do pedido #${pedido.numero} autorizada ✓`);
    else toast.error(`Nota rejeitada: ${data.mensagem_sefaz || 'erro na SEFAZ'}`);
    setNotaEmCpf(null);
    setCpfDigitado('');
    carregar(true);
  } catch {
    toast.error('Erro ao emitir nota');
  } finally {
    setEmitindoNota(false);
  }
}
```

- [ ] **Step 3: UI no card do pedido**

Em `renderCard`, logo após o bloco `{/* ── Troco ── */}` (linha ~2161, antes de `{/* ── Ações ── */}`), adicione o bloco de nota fiscal:

```jsx
{/* ── Nota fiscal ── */}
{!['cancelado'].includes(pedido.status) && (
  <div className="px-3 pb-2.5 -mt-1">
    {pedido.nota_fiscal?.status === 'autorizada' ? (
      <a href={pedido.nota_fiscal.link_danfe} target="_blank" rel="noreferrer"
        className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-black"
        style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.3)', color: '#15803d' }}>
        🧾 Ver nota fiscal
      </a>
    ) : notaEmCpf?.id === pedido.id ? (
      <div className="flex items-center gap-1.5">
        <input autoFocus type="text" placeholder="CPF do cliente" value={cpfDigitado}
          onChange={e => setCpfDigitado(formatarCpf(e.target.value.replace(/\D/g, '').slice(0, 11)))}
          className="flex-1 text-xs rounded-lg px-2 py-1.5 outline-none"
          style={{ background: 'var(--space-elev)', color: 'var(--txt)', border: '1px solid var(--hairline)' }} />
        <button disabled={!cpfValido(cpfDigitado) || emitindoNota}
          onClick={() => emitirNotaFiscal(pedido, cpfDigitado)}
          className="px-2.5 py-1.5 rounded-lg text-[11px] font-black text-white disabled:opacity-40"
          style={{ background: '#16a34a' }}>
          {emitindoNota ? '...' : 'Emitir'}
        </button>
        <button onClick={() => { setNotaEmCpf(null); setCpfDigitado(''); }}
          className="px-2 py-1.5 rounded-lg text-[11px] font-bold" style={{ color: 'var(--txt-dim)' }}>
          ✕
        </button>
      </div>
    ) : (
      <button onClick={() => { setNotaEmCpf(pedido); setCpfDigitado(''); }}
        className="w-full flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-black"
        style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', color: '#2563eb' }}>
        🧾 {pedido.nota_fiscal?.status === 'rejeitada' ? 'Nota rejeitada — tentar de novo' : 'Emitir nota'}
      </button>
    )}
  </div>
)}
```

- [ ] **Step 4: Verificar no navegador**

Suba os dois servidores (backend `npm run dev` na 3001, frontend `npm run dev` na 3000). Abra o PDV no navegador, clique em "Emitir nota" num pedido com telefone/itens preenchidos, digite um CPF válido pra teste (`111.444.777-35`) e clique em "Emitir".

Expected (sem `FOCUS_NFE_TOKEN` configurado ainda): toast de erro "Integração fiscal não configurada...". Isso confirma que o botão, o formulário de CPF e a chamada estão ligados corretamente — a falha esperada é só a ausência de credenciais reais, não um bug de UI.

Se quiser confirmar o caminho de sucesso, repita com o stub do Task 3 Step 6 rodando e as variáveis `FOCUS_NFE_*` apontando pra ele: o botão deve virar "🧾 Ver nota fiscal" após o clique.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/PDV.jsx
git commit -m "feat(nota-fiscal): botão 'Emitir nota' no card do pedido do PDV"
```

---

### Task 5: Deploy e nota final para o usuário

**Files:** nenhum arquivo novo — build e deploy usando a receita já estabelecida do projeto.

- [ ] **Step 1: Rodar a suíte completa uma última vez**

Run: `cd backend && npm test`
Expected: PASS — 12/12 testes

- [ ] **Step 2: Lint**

Run: `cd backend && npm run lint && cd ../frontend && npm run lint`
Expected: 0 erros (warnings pré-existentes são aceitáveis, ver CLAUDE.md)

- [ ] **Step 3: Deploy (backend + frontend) seguindo a receita do projeto**

Build do frontend, isolar os commits deste plano do restante do WIP não relacionado no working tree (git-surgery, se necessário), e fazer o deploy pro VPS conforme o processo já documentado no projeto (scp + pm2 restart do processo principal, nunca do `whatsapp-service`).

- [ ] **Step 4: Nota final pro usuário — nenhuma nota real será emitida ainda**

Depois do deploy, o botão "Emitir nota" vai aparecer no PDV mas retornará "Integração fiscal não configurada" até que:
1. O dono/contador crie a conta na Focus NFe e vincule o certificado A1 da empresa;
2. As variáveis `FOCUS_NFE_TOKEN`, `FOCUS_NFE_CNPJ` (e `FOCUS_NFE_AMBIENTE=homologacao` pros primeiros testes) sejam adicionadas ao `backend/.env` do servidor e o processo reiniciado (`pm2 restart 0`);
3. Seja feito um teste real em **homologação** (nota sem valor fiscal) antes de trocar `FOCUS_NFE_AMBIENTE` para `producao`.

Comunicar isso claramente ao usuário ao final da implementação.

---

## Self-Review

**Cobertura da spec:** emissão sob demanda ✅ (Task 3-4), só CPF/NFC-e ✅ (payload só tem `cpf_destinatario`), Focus NFe ✅, homologação antes de produção ✅ (Global Constraints + Task 5), botão no PDV ✅ (Task 4), WhatsApp automático quando autorizada ✅ (Task 3 Step 3). O webhook da spec original foi substituído por resposta síncrona — mudança de arquitetura documentada e justificada na seção "Nota sobre a spec original", mantém o mesmo resultado observável (cliente recebe o link, operador vê o status).

**Placeholders:** nenhum "TBD"/"implementar depois" — os únicos valores "assumidos" (CSOSN, PIS/COFINS, NCM padrão) são código real e funcional, com comentário explícito de que precisam confirmação do contador antes de produção, não blocos vazios.

**Consistência de tipos:** `nota_fiscal` no card sempre `{ status, link_danfe, mensagem_sefaz } | null`, igual entre `pedidoComItens` (Task 3) e o uso no frontend (Task 4). `montarPayloadNfce` espera `itens[].ncm` já resolvido — resolvido pelo chamador (rota, Task 3) antes de chamar o service (Task 2), não dentro do service.
