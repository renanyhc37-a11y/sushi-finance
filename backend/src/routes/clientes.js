const { Router } = require('express');
const db = require('../db/database');

const router = Router();

const PEDIDOS_POR_RECOMPENSA = 10;

function calcFidelidade(total_pedidos, recompensas_ganhas, recompensas_usadas) {
  const recompensas_disponiveis = recompensas_ganhas - recompensas_usadas;
  const pedidos_no_ciclo = total_pedidos % PEDIDOS_POR_RECOMPENSA;
  const proximo_em = PEDIDOS_POR_RECOMPENSA - pedidos_no_ciclo;
  return { total_pedidos, recompensas_ganhas, recompensas_usadas, recompensas_disponiveis, pedidos_no_ciclo, proximo_em };
}

function comFidelidade(c) {
  return { ...c, fidelidade: calcFidelidade(c.total_pedidos, c.recompensas_ganhas, c.recompensas_usadas) };
}

// GET /api/clientes — lista todos
router.get('/', (req, res) => {
  const clientes = db.prepare('SELECT * FROM clientes ORDER BY updated_at DESC').all();
  res.json(clientes.map(comFidelidade));
});

// GET /api/clientes/aniversarios?dias=30 — próximos aniversários
// aniversario é armazenado como 'MM-DD'. Calcula dias até a próxima
// ocorrência e devolve ordenado, dentro da janela pedida.
router.get('/aniversarios', (req, res) => {
  const dias = Math.min(366, Math.max(1, Number(req.query.dias) || 30));
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const rows = db.prepare(
    "SELECT id, nome, telefone, aniversario, total_pedidos FROM clientes WHERE aniversario IS NOT NULL AND aniversario <> ''"
  ).all();

  const lista = [];
  for (const c of rows) {
    const m = /^(\d{2})-(\d{2})$/.exec(c.aniversario);
    if (!m) continue;
    const mes = Number(m[1]) - 1, dia = Number(m[2]);
    let prox = new Date(hoje.getFullYear(), mes, dia);
    if (prox < hoje) prox = new Date(hoje.getFullYear() + 1, mes, dia);
    const faltam = Math.round((prox - hoje) / 86400000);
    if (faltam <= dias) {
      lista.push({
        id: c.id, nome: c.nome, telefone: c.telefone, total_pedidos: c.total_pedidos,
        aniversario: c.aniversario, dia, mes: mes + 1, dias_para: faltam,
        hoje: faltam === 0,
        data_label: `${String(dia).padStart(2, '0')}/${String(mes + 1).padStart(2, '0')}`,
      });
    }
  }
  lista.sort((a, b) => a.dias_para - b.dias_para);
  res.json(lista);
});

// GET /api/clientes/:id/pedidos — histórico de pedidos do cliente
router.get('/:id/pedidos', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

  const pedidos = db.prepare(`
    SELECT p.*, GROUP_CONCAT(i.quantidade || 'x ' || i.item_nome, ', ') as itens_resumo
    FROM pdv_pedidos p
    LEFT JOIN pdv_itens i ON i.pedido_id = p.id
    WHERE p.cliente_telefone = ?
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT 50
  `).all(cliente.telefone);

  res.json(pedidos);
});

// POST /api/clientes/:id/resgatar — marca um brinde como usado
router.post('/:id/resgatar', (req, res) => {
  const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(req.params.id);
  if (!cliente) return res.status(404).json({ erro: 'Cliente não encontrado' });

  const disponiveis = cliente.recompensas_ganhas - cliente.recompensas_usadas;
  if (disponiveis <= 0) return res.status(400).json({ erro: 'Nenhum brinde disponível' });

  db.prepare('UPDATE clientes SET recompensas_usadas = recompensas_usadas + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(cliente.id);

  const atualizado = db.prepare('SELECT * FROM clientes WHERE id = ?').get(cliente.id);
  res.json({ ok: true, cliente: comFidelidade(atualizado) });
});

module.exports = router;
