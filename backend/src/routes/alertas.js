const { Router } = require('express');
const db = require('../db/database');

const router = Router();

router.get('/', (req, res) => {
  try {
    const alertas = [];

    // CMV por produto acima de 35%
    const produtos = db.prepare(`SELECT id, nome, preco_venda FROM produtos WHERE ativo = 1`).all();

    for (const p of produtos) {
      const row = db.prepare(`
        SELECT COALESCE(SUM(ft.quantidade_usada * i.custo_unitario), 0) as custo_total
        FROM ficha_tecnica ft JOIN ingredientes i ON i.id = ft.ingrediente_id
        WHERE ft.produto_id = ?
      `).get(p.id);

      const cmv = p.preco_venda > 0 ? (row.custo_total / p.preco_venda) * 100 : 0;
      if (cmv > 35) {
        alertas.push({
          tipo: 'cmv_alto',
          nivel: 'vermelho',
          mensagem: `${p.nome} com CMV de ${cmv.toFixed(1)}% (acima de 35%)`,
          produto_id: p.id,
          valor: cmv,
        });
      }
    }

    // Ingredientes com aumento > 10% na última compra
    const ingredientes = db.prepare('SELECT id, nome FROM ingredientes').all();
    for (const ing of ingredientes) {
      const ultimas = db.prepare(
        'SELECT custo_unitario FROM compras_ingredientes WHERE ingrediente_id=? ORDER BY data DESC LIMIT 2'
      ).all(ing.id);

      if (ultimas.length === 2) {
        const aumento = ((ultimas[0].custo_unitario - ultimas[1].custo_unitario) / ultimas[1].custo_unitario) * 100;
        if (aumento > 10) {
          alertas.push({
            tipo: 'aumento_insumo',
            nivel: 'amarelo',
            mensagem: `${ing.nome} com aumento de ${aumento.toFixed(1)}% na última compra`,
            ingrediente_id: ing.id,
            valor: aumento,
          });
        }
      }
    }

    res.json(alertas);
  } catch (e) {
    console.error('alertas error:', e);
    res.status(500).json({ erro: e.message });
  }
});

module.exports = router;
