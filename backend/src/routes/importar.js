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

module.exports = router;
