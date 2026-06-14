const { Router } = require('express');
const db = require('../db/database');

const router = Router();
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// GET /api/producao/sugestao?dia=0..6  ou  ?data=YYYY-MM-DD
// Sugere o que preparar com base na média de vendas naquele dia da semana
// (últimos 60 dias) e explode em ingredientes via ficha técnica.
router.get('/sugestao', (req, res) => {
  let dia;
  if (req.query.data) dia = new Date(req.query.data + 'T12:00:00').getDay();
  else dia = req.query.dia != null ? Number(req.query.dia) : new Date().getDay();

  // Média de quantidade por item nas ocorrências desse dia da semana
  const itens = db.prepare(`
    SELECT pi.item_nome,
           SUM(pi.quantidade) * 1.0 / COUNT(DISTINCT date(pp.created_at)) as media,
           SUM(pi.quantidade) as total,
           COUNT(DISTINCT date(pp.created_at)) as dias
    FROM pdv_itens pi
    JOIN pdv_pedidos pp ON pp.id = pi.pedido_id
    WHERE pp.status != 'cancelado'
      AND CAST(strftime('%w', pp.created_at) AS INTEGER) = ?
      AND date(pp.created_at) >= date('now', '-60 days')
    GROUP BY pi.item_nome
    ORDER BY media DESC
  `).all(dia);

  // Explode em ingredientes via ficha técnica do cardápio (match por nome do item)
  const ingMap = {};
  for (const it of itens) {
    const ci = db.prepare('SELECT id FROM cardapio_itens WHERE nome = ? COLLATE NOCASE LIMIT 1').get(it.item_nome);
    if (!ci) continue;
    let ficha = [];
    try {
      ficha = db.prepare(`
        SELECT cft.quantidade as qtd_ficha, i.id, i.nome, i.unidade_medida, i.estoque_atual
        FROM cardapio_ficha_tecnica cft
        JOIN ingredientes i ON i.id = cft.ingrediente_id
        WHERE cft.cardapio_item_id = ?
      `).all(ci.id);
    } catch {}
    for (const f of ficha) {
      if (!ingMap[f.id]) ingMap[f.id] = { id: f.id, nome: f.nome, unidade: f.unidade_medida, qtd: 0, estoque_atual: f.estoque_atual };
      ingMap[f.id].qtd += (f.qtd_ficha || 0) * it.media;
    }
  }

  const ingredientes = Object.values(ingMap)
    .map(v => ({
      ...v,
      qtd: Math.round(v.qtd * 100) / 100,
      falta: v.estoque_atual != null ? Math.max(0, Math.round((v.qtd - v.estoque_atual) * 100) / 100) : null,
    }))
    .sort((a, b) => b.qtd - a.qtd);

  res.json({
    dia,
    dia_nome: DIAS[dia],
    tem_dados: itens.length > 0,
    itens: itens.slice(0, 25).map(i => ({
      nome: i.item_nome,
      sugestao: Math.ceil(i.media),
      media: Math.round(i.media * 10) / 10,
      dias_analisados: i.dias,
    })),
    ingredientes,
  });
});

module.exports = router;
