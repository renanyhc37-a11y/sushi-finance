# Importar Faturamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a page/endpoint pair that imports the `.xlsx` export of another POS system into `faturamento_diario`, following the same upload → preview → confirm pattern already used by Importar Cardápio/Clientes.

**Architecture:** Two new routes in the existing `backend/src/routes/importar.js` (no new file — this file already owns all `.xlsx` import logic), sharing one extraction helper between preview and confirm. One new frontend page `ImportarFaturamento.jsx`, wired into the sidebar under **Financeiro**.

**Tech Stack:** `xlsx` (already a backend dependency), `multer` memoryStorage (already used in this file), React + `fetch` (no new frontend dependency — matches `ImportarClientes.jsx`'s existing pattern of raw `fetch`+`authH()` rather than the `api` client).

## Global Constraints
- Source format is fixed to the two sheets confirmed with the real file: **"Movimentação Financeira"** (values) and **"Geral"** (order count). No generic column-mapping UI (that's `ImportarClientes`'s job for a different problem) — out of scope per spec.
- `faturamento_diario` columns being written: `data, total_bruto, quantidade_pedidos, pix, dinheiro, credito, debito`. `taxa_cartao` stays `0` (default) — never estimated.
- `total_bruto` = "Líquido" column. `credito` = "Cartão de Crédito" + "Online" columns summed.
- No automated test framework exists in this repo (checked: no jest/vitest/mocha, no `*.test.js` anywhere, `npm run test` doesn't exist in either package.json). Verification in this plan is **manual** — real curl calls against the real sample file, and manual browser checks — matching how every other feature in this codebase has been verified.
- This codebase's global auth: `app.use('/api', requireAuth)` in `backend/src/index.js:189` already covers everything mounted after it, including `/api/importar` (mounted at line 212). **Do not** add a per-route `requireAuth` in `importar.js` — none of the existing routes in that file have it, and adding one would be inconsistent with the file's own convention.

---

### Task 1: Backend — rotas de import de faturamento

**Files:**
- Modify: `backend/src/routes/importar.js` (add to the end, before `module.exports = router;`)

**Interfaces:**
- Consumes: `db` (already imported at top of file, `better-sqlite3`-style `.prepare()/.exec()/.transaction()`), `XLSX` (already imported), `upload` (multer instance, already defined at top of file with `memoryStorage`).
- Produces: `POST /api/importar/faturamento/preview` and `POST /api/importar/faturamento/confirmar`, consumed by Task 2's frontend page. Response shapes are defined in Step 3 and Step 5 below — Task 2 depends on these exact field names.

- [ ] **Step 1: Add the shared extraction helper**

Open `backend/src/routes/importar.js`. Add this block right before the final `module.exports = router;` line (after the existing "Importação de CLIENTES via XLSX" section):

```js
// ── Importação de FATURAMENTO via XLSX (planilha de outro PDV) ──────────

const ABA_FATURAMENTO_FINANCEIRA = 'Movimentação Financeira';
const ABA_FATURAMENTO_GERAL = 'Geral';

// Remove acentos, baixa a caixa e tira tudo que não for letra/número —
// assim "Nᵒ de Pedidos", "N° de Pedidos" e "No de Pedidos" batem igual
// contra o alvo "N de Pedidos" (o símbolo entre N e "de" é sempre removido).
function normalizarHeaderFaturamento(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function acharColunaFaturamento(headerRow, alvo) {
  const alvoNorm = normalizarHeaderFaturamento(alvo);
  return headerRow.findIndex(h => normalizarHeaderFaturamento(h) === alvoNorm);
}

// "01/07/2026" → "2026-07-01". Retorna null se não bater o formato
// (usado também para pular a linha em branco entre cabeçalho e dados,
// e uma eventual linha de "Total" no fim da planilha).
function parseDataBRFaturamento(str) {
  const m = String(str || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// Aceita tanto número puro (a maioria das células da aba "Geral") quanto
// texto (a aba "Movimentação Financeira" vem com células formatadas como
// texto, ex. "464.50" como string) — com ou sem vírgula decimal.
function parseMoedaFaturamento(v) {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim();
  if (!s) return 0;
  const n = s.includes(',') ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// Lê o buffer do .xlsx e devolve um array de dias:
// [{ data, total_bruto, quantidade_pedidos, pix, dinheiro, credito, debito }]
// Lança Error com mensagem amigável se a aba/coluna esperada não existir.
function extrairDiasFaturamento(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' });

  if (!wb.SheetNames.includes(ABA_FATURAMENTO_FINANCEIRA)) {
    throw new Error(`Aba "${ABA_FATURAMENTO_FINANCEIRA}" não encontrada. Abas no arquivo: ${wb.SheetNames.join(', ')}`);
  }

  const wsFin = wb.Sheets[ABA_FATURAMENTO_FINANCEIRA];
  const rowsFin = XLSX.utils.sheet_to_json(wsFin, { header: 1, defval: '' });
  if (!rowsFin.length) throw new Error(`Aba "${ABA_FATURAMENTO_FINANCEIRA}" está vazia.`);
  const headerFin = rowsFin[0].map(h => String(h || ''));

  const iLiquido  = acharColunaFaturamento(headerFin, 'Líquido');
  const iPix      = acharColunaFaturamento(headerFin, 'PIX');
  const iDinheiro = acharColunaFaturamento(headerFin, 'Dinheiro');
  const iCartao   = acharColunaFaturamento(headerFin, 'Cartão de Crédito');
  const iOnline   = acharColunaFaturamento(headerFin, 'Online');
  const iDebito   = acharColunaFaturamento(headerFin, 'Débito');

  if (iLiquido === -1) {
    throw new Error(`Coluna "Líquido" não encontrada na aba "${ABA_FATURAMENTO_FINANCEIRA}".`);
  }

  // Mapa data → nº de pedidos, a partir da aba "Geral" (opcional — se não
  // existir ou não tiver a coluna, quantidade_pedidos fica 0 pra todo mundo).
  const pedidosPorData = new Map();
  if (wb.SheetNames.includes(ABA_FATURAMENTO_GERAL)) {
    const wsGeral = wb.Sheets[ABA_FATURAMENTO_GERAL];
    const rowsGeral = XLSX.utils.sheet_to_json(wsGeral, { header: 1, defval: '' });
    if (rowsGeral.length) {
      const headerGeral = rowsGeral[0].map(h => String(h || ''));
      const iPedidos = acharColunaFaturamento(headerGeral, 'N de Pedidos');
      if (iPedidos !== -1) {
        for (const row of rowsGeral.slice(1)) {
          if (!Array.isArray(row)) continue;
          const data = parseDataBRFaturamento(row[0]);
          if (data) pedidosPorData.set(data, Number(row[iPedidos]) || 0);
        }
      }
    }
  }

  const dias = [];
  for (const row of rowsFin.slice(1)) {
    if (!Array.isArray(row)) continue;
    const data = parseDataBRFaturamento(row[0]);
    if (!data) continue; // pula linha em branco / linha de total, se houver

    dias.push({
      data,
      total_bruto: parseMoedaFaturamento(row[iLiquido]),
      quantidade_pedidos: pedidosPorData.get(data) || 0,
      pix:      iPix      >= 0 ? parseMoedaFaturamento(row[iPix])      : 0,
      dinheiro: iDinheiro  >= 0 ? parseMoedaFaturamento(row[iDinheiro]) : 0,
      credito: (iCartao >= 0 ? parseMoedaFaturamento(row[iCartao]) : 0)
             + (iOnline >= 0 ? parseMoedaFaturamento(row[iOnline]) : 0),
      debito:   iDebito   >= 0 ? parseMoedaFaturamento(row[iDebito])   : 0,
    });
  }

  if (!dias.length) throw new Error('Nenhum dia com data válida encontrado na planilha.');
  return dias;
}
```

- [ ] **Step 2: Verify the helper in isolation before wiring the routes**

Run this from `backend/`, pointing at the real sample file (adjust the path if your copy is elsewhere):

```bash
node -e "
const { extrairDiasFaturamento } = (() => {
  // re-require the router module's internals isn't possible (not exported yet) —
  // this quick check just proves XLSX.read/sheet_to_json see the two sheets and
  // headers we expect, using the same library the router uses.
  const XLSX = require('./node_modules/xlsx');
  const fs = require('fs');
  const buf = fs.readFileSync('C:/Users/User/Downloads/Entradas- consulta gerada em 26_07_2026, 12_36_20.xlsx');
  const wb = XLSX.read(buf, {type:'buffer'});
  console.log('Sheets:', wb.SheetNames);
  return {};
})();
"
```

Expected output: `Sheets: [ 'Geral', 'Ticket', 'Movimentação Financeira' ]`

- [ ] **Step 3: Add the preview route**

Immediately after the helper block from Step 1, still before `module.exports = router;`:

```js
// POST /api/importar/faturamento/preview
router.post('/faturamento/preview', upload.single('arquivo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

    const dias = extrairDiasFaturamento(req.file.buffer);

    const datas = dias.map(d => d.data);
    const placeholders = datas.map(() => '?').join(',');
    const existentes = db.prepare(
      `SELECT data, total_bruto FROM faturamento_diario WHERE data IN (${placeholders})`
    ).all(...datas);
    const existentesPorData = new Map(existentes.map(e => [e.data, e.total_bruto]));

    const diasComStatus = dias.map(d => ({
      ...d,
      ja_existe: existentesPorData.has(d.data),
      valor_atual: existentesPorData.has(d.data) ? existentesPorData.get(d.data) : null,
    }));

    res.json({
      dias: diasComStatus,
      total_dias: diasComStatus.length,
      qtd_conflitos: diasComStatus.filter(d => d.ja_existe).length,
      periodo: { inicio: dias[0].data, fim: dias[dias.length - 1].data },
    });
  } catch (e) {
    console.error('[importar faturamento preview]', e.message);
    res.status(400).json({ erro: e.message });
  }
});
```

- [ ] **Step 4: Verify the preview route with curl, against the real file**

Start the backend (`cd backend && npm run dev`), then in another terminal (replace `SEU_TOKEN` with a real JWT — log in on the running frontend and copy `localStorage.token`, or use whatever token generation the project already documents):

```bash
curl -s -X POST http://localhost:3001/api/importar/faturamento/preview \
  -H "Authorization: Bearer SEU_TOKEN" \
  -F "arquivo=@C:/Users/User/Downloads/Entradas- consulta gerada em 26_07_2026, 12_36_20.xlsx"
```

Expected: JSON with `"total_dias"` around 22-24, `"periodo": {"inicio":"2026-07-01","fim":"2026-07-25"}`, and the first entry in `"dias"` matching `{"data":"2026-07-01","total_bruto":2762.48,"quantidade_pedidos":27,"pix":0,"dinheiro":0,"credito":464.5,"debito":0,...}`. `"qtd_conflitos"` should be `0` the first time (no existing `faturamento_diario` rows for July 2026 yet, since that table was wiped earlier this month).

- [ ] **Step 5: Add the confirm route**

Right after the preview route, still before `module.exports = router;`:

```js
// POST /api/importar/faturamento/confirmar
router.post('/faturamento/confirmar', upload.single('arquivo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo' });
    const modo = req.body.modo === 'sobrescrever' ? 'sobrescrever' : 'pular';

    const dias = extrairDiasFaturamento(req.file.buffer);

    const stmtBuscar = db.prepare('SELECT id FROM faturamento_diario WHERE data = ?');
    const stmtInserir = db.prepare(`
      INSERT INTO faturamento_diario (data, total_bruto, quantidade_pedidos, pix, dinheiro, credito, debito, taxa_cartao, observacao)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'Importado de planilha')
    `);
    const stmtAtualizar = db.prepare(`
      UPDATE faturamento_diario
      SET total_bruto = ?, quantidade_pedidos = ?, pix = ?, dinheiro = ?, credito = ?, debito = ?
      WHERE data = ?
    `);

    let criados = 0, sobrescritos = 0, ignorados = 0;

    db.transaction(() => {
      for (const d of dias) {
        const existente = stmtBuscar.get(d.data);
        if (existente) {
          if (modo === 'sobrescrever') {
            stmtAtualizar.run(d.total_bruto, d.quantidade_pedidos, d.pix, d.dinheiro, d.credito, d.debito, d.data);
            sobrescritos++;
          } else {
            ignorados++;
          }
        } else {
          stmtInserir.run(d.data, d.total_bruto, d.quantidade_pedidos, d.pix, d.dinheiro, d.credito, d.debito);
          criados++;
        }
      }
    })();

    res.json({ ok: true, criados, sobrescritos, ignorados, total: dias.length });
  } catch (e) {
    console.error('[importar faturamento confirmar]', e.message);
    res.status(400).json({ erro: e.message });
  }
});
```

- [ ] **Step 6: Verify confirm — first pass creates, second pass with "pular" skips, third with "sobrescrever" updates**

```bash
# 1ª vez — modo pular (default), tabela vazia pra julho/2026 → tudo criado
curl -s -X POST http://localhost:3001/api/importar/faturamento/confirmar \
  -H "Authorization: Bearer SEU_TOKEN" \
  -F "arquivo=@C:/Users/User/Downloads/Entradas- consulta gerada em 26_07_2026, 12_36_20.xlsx" \
  -F "modo=pular"
```
Expected: `{"ok":true,"criados":22,"sobrescritos":0,"ignorados":0,"total":22}` (o número exato de `criados` deve bater com `total_dias` do preview no Step 4).

```bash
# 2ª vez — mesmo arquivo, modo pular → tudo já existe, nada duplica
curl -s -X POST http://localhost:3001/api/importar/faturamento/confirmar \
  -H "Authorization: Bearer SEU_TOKEN" \
  -F "arquivo=@C:/Users/User/Downloads/Entradas- consulta gerada em 26_07_2026, 12_36_20.xlsx" \
  -F "modo=pular"
```
Expected: `{"ok":true,"criados":0,"sobrescritos":0,"ignorados":22,"total":22}`

```bash
# 3ª vez — modo sobrescrever → atualiza os mesmos dias (idempotente, valores iguais)
curl -s -X POST http://localhost:3001/api/importar/faturamento/confirmar \
  -H "Authorization: Bearer SEU_TOKEN" \
  -F "arquivo=@C:/Users/User/Downloads/Entradas- consulta gerada em 26_07_2026, 12_36_20.xlsx" \
  -F "modo=sobrescrever"
```
Expected: `{"ok":true,"criados":0,"sobrescritos":22,"ignorados":0,"total":22}`

Then confirm in sqlite directly:
```bash
sqlite3 backend/data/sushi.db "SELECT data, total_bruto, quantidade_pedidos, pix, dinheiro, credito, debito FROM faturamento_diario WHERE data BETWEEN '2026-07-01' AND '2026-07-25' ORDER BY data;"
```
Expected: 22 rows, `2026-07-01|2762.48|27|0.0|0.0|464.5|0.0`, matching the spreadsheet.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/importar.js
git commit -m "feat: importar faturamento diário de planilha de outro PDV

Duas rotas novas em routes/importar.js: preview e confirmar, seguindo o
mesmo padrão de Importar Cardápio/Clientes. Lê as abas 'Movimentação
Financeira' (Líquido/PIX/Dinheiro/Cartão/Online/Débito) e 'Geral' (nº de
pedidos), grava em faturamento_diario com detecção de conflito por data."
```

---

### Task 2: Frontend — página Importar Faturamento

**Files:**
- Create: `frontend/src/pages/ImportarFaturamento.jsx`

**Interfaces:**
- Consumes: `POST /api/importar/faturamento/preview` → `{ dias: [{data, total_bruto, quantidade_pedidos, pix, dinheiro, credito, debito, ja_existe, valor_atual}], total_dias, qtd_conflitos, periodo }` and `POST /api/importar/faturamento/confirmar` → `{ ok, criados, sobrescritos, ignorados, total }` (both from Task 1). `getToken` from `../hooks/useAuth` (existing).
- Produces: default export `ImportarFaturamento` React component, consumed by Task 3's route registration.

- [ ] **Step 1: Write the component**

Create `frontend/src/pages/ImportarFaturamento.jsx`:

```jsx
import React, { useState, useRef } from 'react';
import { getToken } from '../hooks/useAuth';
import toast, { Toaster } from 'react-hot-toast';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Wallet,
  RefreshCw, ArrowRight,
} from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || '/api';
const authH = () => ({ Authorization: `Bearer ${getToken()}` });

const brl = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brDate = s => s.split('-').reverse().join('/');

export default function ImportarFaturamento() {
  const [arquivo, setArquivo] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [modo, setModo] = useState('pular');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  async function carregarPreview(file) {
    setPreview(null);
    setResultado(null);
    setLoading(true);
    const fd = new FormData();
    fd.append('arquivo', file);
    try {
      const r = await fetch(`${BASE}/importar/faturamento/preview`, {
        method: 'POST', headers: authH(), body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro ao ler arquivo');
      setPreview(d);
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  function onFile(file) {
    if (!file) return;
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Use um arquivo .xlsx ou .xls');
      return;
    }
    setArquivo(file);
    carregarPreview(file);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    onFile(e.dataTransfer.files?.[0]);
  }

  async function confirmar() {
    if (!arquivo) return;
    setConfirmando(true);
    const fd = new FormData();
    fd.append('arquivo', arquivo);
    fd.append('modo', modo);
    try {
      const r = await fetch(`${BASE}/importar/faturamento/confirmar`, {
        method: 'POST', headers: authH(), body: fd,
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro || 'Erro');
      setResultado(d);
      toast.success(`Importação concluída! ${d.criados} criados, ${d.sobrescritos} sobrescritos.`);
    } catch (e) { toast.error(e.message); }
    finally { setConfirmando(false); }
  }

  function resetar() {
    setArquivo(null);
    setPreview(null);
    setResultado(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155' } }} />

      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
          <Wallet size={20} className="text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-100">Importar Faturamento</h1>
          <p className="text-sm text-slate-400">Traga o histórico de outro PDV para o Faturamento Diário</p>
        </div>
        {(arquivo || resultado) && (
          <button onClick={resetar} className="ml-auto flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg">
            <RefreshCw size={14} /> Nova importação
          </button>
        )}
      </div>

      {resultado && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={20} className="text-emerald-400" />
            <span className="font-semibold text-emerald-300">Importação concluída</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total processado', val: resultado.total, color: 'text-slate-200' },
              { label: 'Criados',       val: resultado.criados,     color: 'text-emerald-400' },
              { label: 'Sobrescritos',  val: resultado.sobrescritos, color: 'text-amber-400' },
              { label: 'Ignorados',     val: resultado.ignorados,    color: 'text-slate-400' },
            ].map(({ label, val, color }) => (
              <div key={label} className="bg-slate-800/60 rounded-xl p-3 text-center">
                <div className={`text-2xl font-bold ${color}`}>{val}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!preview && !loading && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed transition-all p-12 text-center mb-6
            ${dragging ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-900/50'}`}
        >
          <FileSpreadsheet size={40} className={`mx-auto mb-3 ${dragging ? 'text-emerald-400' : 'text-slate-500'}`} />
          <p className="text-slate-300 font-medium mb-1">Arraste o arquivo ou clique para selecionar</p>
          <p className="text-sm text-slate-500">Exportação de outro PDV com as abas "Movimentação Financeira" e "Geral" — .xlsx</p>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-10 text-center mb-6">
          <RefreshCw size={32} className="mx-auto text-emerald-400 animate-spin mb-3" />
          <p className="text-slate-400">Lendo planilha…</p>
        </div>
      )}

      {preview && !resultado && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <FileSpreadsheet size={16} className="text-emerald-400" />
              <span className="font-medium text-slate-200">{arquivo?.name}</span>
            </div>
            <div className="flex gap-3 text-sm text-slate-400">
              <span><strong className="text-slate-200">{preview.total_dias}</strong> dias</span>
              <span>{brDate(preview.periodo.inicio)} a {brDate(preview.periodo.fim)}</span>
              {preview.qtd_conflitos > 0 && (
                <span className="flex items-center gap-1 text-amber-400">
                  <AlertTriangle size={14} /> {preview.qtd_conflitos} já têm lançamento
                </span>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-400">Data</th>
                    <th className="px-3 py-2 text-right text-slate-400">Pedidos</th>
                    <th className="px-3 py-2 text-right text-slate-400">Total</th>
                    <th className="px-3 py-2 text-right text-slate-400">PIX</th>
                    <th className="px-3 py-2 text-right text-slate-400">Dinheiro</th>
                    <th className="px-3 py-2 text-right text-slate-400">Cartão</th>
                    <th className="px-3 py-2 text-right text-slate-400">Débito</th>
                    <th className="px-3 py-2 text-left text-slate-400"></th>
                  </tr>
                </thead>
                <tbody>
                  {preview.dias.map(d => (
                    <tr key={d.data} className="border-t border-slate-800/60 hover:bg-slate-800/30">
                      <td className="px-3 py-1.5 text-slate-300 whitespace-nowrap">{brDate(d.data)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-300">{d.quantidade_pedidos}</td>
                      <td className="px-3 py-1.5 text-right font-medium text-slate-100">{brl(d.total_bruto)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{brl(d.pix)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{brl(d.dinheiro)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{brl(d.credito)}</td>
                      <td className="px-3 py-1.5 text-right text-slate-400">{brl(d.debito)}</td>
                      <td className="px-3 py-1.5">
                        {d.ja_existe && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-400 whitespace-nowrap">
                            já existe ({brl(d.valor_atual)})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex flex-wrap items-center gap-4">
            {preview.qtd_conflitos > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-300 mb-2">Dias que já têm lançamento:</p>
                <div className="flex gap-2">
                  {[
                    { val: 'pular',        label: 'Pular',        desc: 'Mantém o lançamento existente' },
                    { val: 'sobrescrever', label: 'Sobrescrever', desc: 'Substitui pelo valor da planilha' },
                  ].map(({ val, label, desc }) => (
                    <button
                      key={val}
                      onClick={() => setModo(val)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                        modo === val
                          ? 'bg-emerald-500 text-slate-900 border-emerald-400'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {label}
                      <span className={`block text-[10px] font-normal ${modo === val ? 'text-slate-800' : 'text-slate-500'}`}>{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="ml-auto flex gap-3">
              <button onClick={resetar} className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 text-sm transition-colors">
                Cancelar
              </button>
              <button
                onClick={confirmar}
                disabled={confirmando}
                className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-semibold text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {confirmando ? <><RefreshCw size={14} className="animate-spin" /> Importando…</> : <><Upload size={14} /> Importar {preview.total_dias} dias</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manual verification (needs Task 3 done to be reachable — do this step after Task 3's Step 2 instead if working strictly in order)**

Skip standalone verification here; Task 3 Step 2 covers it end-to-end (this page has no route until Task 3 wires it in).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ImportarFaturamento.jsx
git commit -m "feat: página Importar Faturamento (upload, preview, confirmar)"
```

---

### Task 3: Wire into App.jsx (rota + menu)

**Files:**
- Modify: `frontend/src/App.jsx`

**Interfaces:**
- Consumes: `ImportarFaturamento` default export from Task 2 (`./pages/ImportarFaturamento`).
- Produces: reachable route `/importar-faturamento`, sidebar entry under **Financeiro**.

- [ ] **Step 1: Add the icon import, lazy import, nav entry, and route**

In `frontend/src/App.jsx`, find the lucide-react import block (starts at line 3) and add `FileSpreadsheet` to it:

```js
import {
  MessageCircle, Users, UtensilsCrossed, ShoppingCart, LayoutDashboard,
  Megaphone, Percent, Image as ImageIcon, Wallet, TrendingDown, Receipt,
  TrendingUp, FileBarChart, ClipboardList, Beef, FileText, Fish, Upload, Boxes,
  Smartphone, ConciergeBell, Bot, StickyNote, Sun, Moon, Palette, KeyRound,
  LogOut, Menu, ChevronDown, Circle, Calculator, ChefHat, Pin, Plus, Check, ArrowDownUp, PieChart, Coins, Sparkles, X, Landmark, Truck,
  FileSpreadsheet,
```
(add `FileSpreadsheet,` as its own line right after `Truck,` — check the exact closing of this import block first since it may span further lines; just add the name anywhere inside the `{ ... }` list, comma-separated.)

Find this line (near the other `React.lazy` page imports, right after `ImportarClientes`):
```js
const ImportarClientes = React.lazy(() => import('./pages/ImportarClientes'));
```
Add immediately after it:
```js
const ImportarFaturamento = React.lazy(() => import('./pages/ImportarFaturamento'));
```

Find the **Financeiro** nav group (`grupo: 'Financeiro'`), specifically this line:
```js
{ to: '/faturamento',       icon: Wallet,        label: 'Faturamento' },
```
Add immediately after it:
```js
{ to: '/importar-faturamento', icon: FileSpreadsheet, label: 'Importar Faturamento' },
```

Find the route registrations (near `<Route path="/importar-clientes" element={<ImportarClientes />} />`) and add immediately after:
```js
<Route path="/importar-faturamento" element={<ImportarFaturamento />} />
```

- [ ] **Step 2: Manual end-to-end verification**

```bash
cd backend && npm run dev
```
(new terminal)
```bash
cd frontend && npm run dev
```

Open `http://localhost:3000`, log in (`sushi123`), then:
1. Sidebar → **Financeiro** → confirm "Importar Faturamento" appears right after "Faturamento", with a spreadsheet icon.
2. Click it → confirm the dropzone page loads at `/importar-faturamento` with no console errors.
3. Upload `C:\Users\User\Downloads\Entradas- consulta gerada em 26_07_2026, 12_36_20.xlsx` → confirm the preview table renders ~22 rows, dates `01/07` to `25/07`, first row total `R$ 2.762,48` / 27 pedidos.
4. If Task 1's curl verification (Step 6) already ran confirm for this file, every row should show the amber "já existe" badge and `qtd_conflitos` banner. Click "Sobrescrever" then "Importar" → toast success → click "Faturamento" in the sidebar → confirm July 2026 days show the imported values.
5. If Task 1's curl verification was skipped/reset, confirm with default "pular" modo instead, then reload `/importar-faturamento` and re-upload the same file → now it should show all as "já existe".

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.jsx
git commit -m "feat: adiciona Importar Faturamento ao menu Financeiro"
```

---

## Self-Review Notes

- **Spec coverage:** Column mapping table (spec) ↔ `extrairDiasFaturamento` (Task 1 Step 1) — covered. Preview/confirm endpoints (spec) ↔ Task 1 Steps 3/5 — covered, field names match spec's `{data, total_bruto, quantidade_pedidos, pix, dinheiro, credito, debito, ja_existe, valor_atual}`. Frontend page + nav entry under Financeiro (spec) ↔ Tasks 2/3 — covered. `taxa_cartao` stays 0 (spec) ↔ Task 1 Step 5's INSERT hardcodes `0` — covered.
- **Type consistency:** `modo` values are `'pular'` | `'sobrescrever'` consistently across backend (Step 5) and frontend (Step 1's `useState('pular')` and the two button values) — no mismatch with `ImportarClientes`'s different pair (`'pular'`/`'atualizar'`), which is fine since these are independent endpoints.
- **No placeholders:** every step has real, complete code and real expected curl/UI output — no "add error handling" or "similar to Task N" left in.
