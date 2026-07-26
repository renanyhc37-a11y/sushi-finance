const { Router } = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db/database');

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /api/importar/xlsx — preview sem salvar
router.post('/xlsx/preview', upload.single('arquivo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    // Encontra linha de header (contém "Nome" e "Categoria")
    let headerIdx = rows.findIndex(r =>
      Array.isArray(r) && r.some(c => String(c).toLowerCase().includes('nome')) &&
      r.some(c => String(c).toLowerCase().includes('categoria'))
    );
    if (headerIdx === -1) return res.status(400).json({ erro: 'Formato não reconhecido. Certifique-se que o arquivo tem colunas Nome e Categoria.' });

    const header = rows[headerIdx].map(h => String(h || '').toLowerCase().trim());
    const iNome    = header.findIndex(h => h === 'nome');
    const iCat     = header.findIndex(h => h === 'categoria');
    const iDesc    = header.findIndex(h => h.includes('descri'));
    const iPreco   = header.findIndex(h => h.includes('pre') && h.includes('o') || h === 'preço' || h === 'preco' || h === 'price');
    const iStatus  = header.findIndex(h => h === 'status');
    const iTipo    = header.findIndex(h => h === 'tipo');

    const itens = rows.slice(headerIdx + 1)
      .filter(r => Array.isArray(r) && r.length > iNome && r[iNome])
      .filter(r => !iTipo || !r[iTipo] || String(r[iTipo]).toLowerCase() === 'item')
      .map(r => ({
        nome:      String(r[iNome] || '').trim(),
        categoria: String(r[iCat]  || 'Sem categoria').trim(),
        descricao: iDesc   >= 0 ? String(r[iDesc]  || '').trim() : '',
        preco:     iPreco  >= 0 ? parseFloat(String(r[iPreco] || '0').replace(',', '.')) || 0 : 0,
        status:    iStatus >= 0 ? String(r[iStatus] || 'Ativo').trim() : 'Ativo',
        disponivel: iStatus >= 0 ? String(r[iStatus]).toLowerCase() === 'ativo' : true,
      }))
      .filter(i => i.nome.length > 0);

    const categorias = [...new Set(itens.map(i => i.categoria))];
    const resumo = categorias.map(cat => ({
      categoria: cat,
      qtd: itens.filter(i => i.categoria === cat).length,
      itens: itens.filter(i => i.categoria === cat),
    }));

    res.json({
      total: itens.length,
      categorias: categorias.length,
      resumo,
      header_detectado: header,
    });
  } catch (e) {
    console.error('[importar]', e);
    res.status(500).json({ erro: e.message });
  }
});

// POST /api/importar/xlsx/confirmar — salva de verdade
router.post('/xlsx/confirmar', upload.single('arquivo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo' });

    const { modo = 'adicionar', somente_ativos = 'true' } = req.body;
    const apenasAtivos = somente_ativos === 'true';

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

    let headerIdx = rows.findIndex(r =>
      Array.isArray(r) && r.some(c => String(c).toLowerCase().includes('nome')) &&
      r.some(c => String(c).toLowerCase().includes('categoria'))
    );
    if (headerIdx === -1) return res.status(400).json({ erro: 'Formato não reconhecido' });

    const header = rows[headerIdx].map(h => String(h || '').toLowerCase().trim());
    const iNome   = header.findIndex(h => h === 'nome');
    const iCat    = header.findIndex(h => h === 'categoria');
    const iDesc   = header.findIndex(h => h.includes('descri'));
    const iPreco  = header.findIndex(h => h.includes('pre') && (h.includes('o') || h.includes('ç')) || h === 'preço' || h === 'preco' || h === 'price');
    const iStatus = header.findIndex(h => h === 'status');
    const iTipo   = header.findIndex(h => h === 'tipo');

    const itens = rows.slice(headerIdx + 1)
      .filter(r => Array.isArray(r) && r.length > iNome && r[iNome])
      .filter(r => !iTipo || !r[iTipo] || String(r[iTipo]).toLowerCase() === 'item')
      .map(r => ({
        nome:      String(r[iNome] || '').trim(),
        categoria: String(r[iCat]  || 'Sem categoria').trim(),
        descricao: iDesc   >= 0 ? String(r[iDesc]  || '').trim() : '',
        preco:     iPreco  >= 0 ? parseFloat(String(r[iPreco] || '0').replace(',', '.')) || 0 : 0,
        disponivel: iStatus >= 0 ? String(r[iStatus]).toLowerCase() === 'ativo' : true,
      }))
      .filter(i => i.nome.length > 0)
      .filter(i => !apenasAtivos || i.disponivel);

    let criadas = 0, criados = 0, ignorados = 0, atualizados = 0;

    db.transaction(() => {
      // Se modo === 'substituir', limpa tudo primeiro
      if (modo === 'substituir') {
        db.prepare('DELETE FROM cardapio_itens').run();
        db.prepare('DELETE FROM cardapio_categorias').run();
      }

      for (const item of itens) {
        // Garante que a categoria existe
        let cat = db.prepare('SELECT id FROM cardapio_categorias WHERE nome = ?').get(item.categoria);
        if (!cat) {
          const ordem = db.prepare('SELECT COALESCE(MAX(ordem),0)+1 as n FROM cardapio_categorias').get().n;
          const r = db.prepare(
            'INSERT INTO cardapio_categorias (nome, emoji, ativo, ordem) VALUES (?, ?, 1, ?)'
          ).run(item.categoria, '🍱', ordem);
          cat = { id: r.lastInsertRowid };
          criadas++;
        }

        // Verifica se item já existe (por nome + categoria)
        const existing = db.prepare(
          'SELECT id FROM cardapio_itens WHERE nome = ? AND categoria_id = ?'
        ).get(item.nome, cat.id);

        if (existing) {
          if (modo === 'atualizar' || modo === 'substituir') {
            db.prepare(`
              UPDATE cardapio_itens SET descricao = ?, preco = ?, disponivel = ? WHERE id = ?
            `).run(item.descricao, item.preco, item.disponivel ? 1 : 0, existing.id);
            atualizados++;
          } else {
            ignorados++;
          }
        } else {
          const ordem = db.prepare(
            'SELECT COALESCE(MAX(ordem),0)+1 as n FROM cardapio_itens WHERE categoria_id = ?'
          ).get(cat.id).n;
          db.prepare(`
            INSERT INTO cardapio_itens (categoria_id, nome, descricao, preco, disponivel, ordem)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(cat.id, item.nome, item.descricao, item.preco, item.disponivel ? 1 : 0, ordem);
          criados++;
        }
      }
    })();

    res.json({
      ok: true,
      categorias_criadas: criadas,
      itens_criados: criados,
      itens_atualizados: atualizados,
      itens_ignorados: ignorados,
      total_processado: itens.length,
    });
  } catch (e) {
    console.error('[importar confirmar]', e);
    res.status(500).json({ erro: e.message });
  }
});

// ── Importação de CLIENTES via XLSX ──────────────────────────

// Normaliza telefone: mantém apenas dígitos, adiciona 55 se necessário
function normalizarTel(raw) {
  if (!raw) return null;
  const d = String(raw).replace(/\D/g, '');
  if (d.length === 0) return null;
  // Remove DDI 55 se já tiver 13 dígitos (55 + 11 dígitos)
  if (d.length === 13 && d.startsWith('55')) return d.slice(2);
  return d;
}

// Detecta coluna pelo nome (parcial, case-insensitive)
function col(header, ...termos) {
  return header.findIndex(h => termos.some(t => h.includes(t)));
}

// POST /api/importar/clientes/preview — analisa arquivo, retorna preview + mapeamento detectado
router.post('/clientes/preview', upload.single('arquivo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    // Detecta linha de cabeçalho (primeira linha com pelo menos 2 células preenchidas)
    const headerIdx = rows.findIndex(r => Array.isArray(r) && r.filter(c => String(c).trim()).length >= 2);
    if (headerIdx === -1) return res.status(400).json({ erro: 'Arquivo vazio ou sem cabeçalho detectável' });

    const header = rows[headerIdx].map(h => String(h || '').toLowerCase().trim());
    const colunas = rows[headerIdx].map(h => String(h || '').trim()); // original

    // Mapeamento automático
    const mapa = {
      nome:        col(header, 'nome', 'name', 'cliente', 'razão', 'razao'),
      telefone:    col(header, 'telefone', 'fone', 'phone', 'celular', 'whatsapp', 'contato', 'tel'),
      endereco:    col(header, 'enderec', 'address', 'logradouro', 'rua', 'endereço'),
      bairro:      col(header, 'bairro', 'neighborhood', 'distrito'),
      email:       col(header, 'email', 'e-mail', 'mail'),
      aniversario: col(header, 'aniversar', 'nasciment', 'birth', 'data'),
      obs:         col(header, 'observ', 'obs', 'nota', 'note', 'anotac'),
      pedidos:     col(header, 'pedido', 'order', 'total_pedido', 'qtd'),
    };

    const dataRows = rows.slice(headerIdx + 1).filter(r => Array.isArray(r) && r.some(c => String(c).trim()));

    // Preview das primeiras 10 linhas
    const preview = dataRows.slice(0, 10).map(r => {
      const obj = {};
      colunas.forEach((c, i) => { obj[c] = String(r[i] ?? '').trim(); });
      return obj;
    });

    // Estatísticas rápidas
    const comTelefone = dataRows.filter(r => mapa.telefone >= 0 && String(r[mapa.telefone] ?? '').replace(/\D/g, '').length >= 8).length;

    res.json({
      total_linhas: dataRows.length,
      com_telefone: comTelefone,
      colunas,
      mapa,
      preview,
      sheets: wb.SheetNames,
    });
  } catch (e) {
    console.error('[importar clientes preview]', e);
    res.status(500).json({ erro: e.message });
  }
});

// POST /api/importar/clientes/confirmar — importa com o mapeamento escolhido
router.post('/clientes/confirmar', upload.single('arquivo'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo' });

    const mapa    = JSON.parse(req.body.mapa || '{}');      // { nome: 0, telefone: 1, ... }
    const modo    = req.body.modo || 'pular';               // 'pular' | 'atualizar'
    const sheet   = req.body.sheet || null;
    console.log('[importar clientes] mapa recebido:', JSON.stringify(mapa), '| modo:', modo);

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = sheet && wb.SheetNames.includes(sheet) ? sheet : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    const headerIdx = rows.findIndex(r => Array.isArray(r) && r.filter(c => String(c).trim()).length >= 2);
    const dataRows  = rows.slice(headerIdx + 1).filter(r => Array.isArray(r) && r.some(c => String(c).trim()));

    console.log('[importar clientes] headerIdx:', headerIdx, '| dataRows:', dataRows.length);
    console.log('[importar clientes] header row:', JSON.stringify(rows[headerIdx]?.slice(0,5)));
    console.log('[importar clientes] primeira linha:', JSON.stringify(dataRows[0]?.slice(0,5)));

    function get(row, campo) {
      const idx = mapa[campo];
      return idx !== undefined && idx >= 0 ? String(row[idx] ?? '').trim() : '';
    }

    // Migração: garante colunas extras
    const colsMigrar = ['email TEXT', 'bairro TEXT', 'observacao TEXT', 'recompensas_ganhas INTEGER DEFAULT 0', 'recompensas_usadas INTEGER DEFAULT 0', 'aniversario TEXT', 'updated_at TEXT'];
    for (const col of colsMigrar) {
      try { db.exec(`ALTER TABLE clientes ADD COLUMN ${col}`); } catch {}
    }

    // Prepara statements fora da transação para evitar SQL logic error
    const stmtBuscar  = db.prepare('SELECT id FROM clientes WHERE telefone = ?');
    const stmtInserir = db.prepare(`INSERT INTO clientes (telefone, nome, endereco, bairro, email, observacao, aniversario, total_pedidos, recompensas_ganhas, recompensas_usadas) VALUES (?,?,?,?,?,?,?,?,0,0)`);
    const stmtAtualizar = db.prepare(`UPDATE clientes SET nome = COALESCE(NULLIF(?, ''), nome), endereco = COALESCE(NULLIF(?, ''), endereco), bairro = COALESCE(NULLIF(?, ''), bairro), email = COALESCE(NULLIF(?, ''), email), observacao = COALESCE(NULLIF(?, ''), observacao), aniversario = COALESCE(NULLIF(?, ''), aniversario), total_pedidos = MAX(total_pedidos, ?), updated_at = CURRENT_TIMESTAMP WHERE telefone = ?`);

    let criados = 0, atualizados = 0, ignorados = 0, erros = 0;
    const detalhes = [];

    for (const row of dataRows) {
      try {
        const nome   = get(row, 'nome');
        const telRaw = get(row, 'telefone');
        const tel    = normalizarTel(telRaw);

        if (!nome && !tel) { ignorados++; continue; }
        if (!tel) { erros++; detalhes.push({ nome, erro: 'Sem telefone' }); continue; }
        if (tel.length < 8) { erros++; detalhes.push({ nome, tel, erro: 'Telefone inválido' }); continue; }

        const endereco   = get(row, 'endereco');
        const bairro     = get(row, 'bairro');
        const email      = get(row, 'email');
        const observacao = get(row, 'obs');
        const pedidos    = parseInt(get(row, 'pedidos')) || 0;

        let aniversario = null;
        const aniRaw = get(row, 'aniversario');
        if (aniRaw) {
          const m = aniRaw.match(/(\d{1,2})[/-](\d{1,2})/);
          if (m) aniversario = `${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;
        }

        const existing = stmtBuscar.get(tel);

        if (existing) {
          if (modo === 'atualizar') {
            stmtAtualizar.run(nome || null, endereco || null, bairro || null, email || null, observacao || null, aniversario || null, pedidos, tel);
            atualizados++;
            detalhes.push({ nome, tel, status: 'atualizado' });
          } else {
            ignorados++;
          }
        } else {
          stmtInserir.run(tel, nome || 'Cliente', endereco || null, bairro || null, email || null, observacao || null, aniversario || null, pedidos);
          criados++;
          detalhes.push({ nome, tel, status: 'criado' });
        }
      } catch (err) {
        console.error('[importar clientes row error]', err.message);
        erros++;
      }
    }

    res.json({ ok: true, criados, atualizados, ignorados, erros, total: dataRows.length, detalhes: detalhes.slice(0, 50) });
  } catch (e) {
    console.error('[importar clientes confirmar]', e);
    res.status(500).json({ erro: e.message });
  }
});

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

module.exports = router;
