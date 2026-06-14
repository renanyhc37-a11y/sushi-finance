/**
 * Seed de demonstração — rode: node src/db/seed.js
 * Popula o banco com ingredientes, produtos, pedidos e despesas de exemplo.
 */
const db = require('./database');

// Ingredientes
const ings = [
  { nome: 'Salmão', unidade_medida: 'g', fornecedor: 'Peixaria Central', custo_unitario: 0.08, estoque: 2000 },
  { nome: 'Cream Cheese', unidade_medida: 'g', fornecedor: 'Laticínios Sul', custo_unitario: 0.025, estoque: 1000 },
  { nome: 'Arroz para Sushi', unidade_medida: 'g', fornecedor: 'Atacadão', custo_unitario: 0.006, estoque: 5000 },
  { nome: 'Nori', unidade_medida: 'unidade', fornecedor: 'Importadora Japonesa', custo_unitario: 0.45, estoque: 200 },
  { nome: 'Gergelim', unidade_medida: 'g', fornecedor: 'Atacadão', custo_unitario: 0.012, estoque: 500 },
  { nome: 'Cebolinha', unidade_medida: 'g', fornecedor: 'Hortifrúti', custo_unitario: 0.015, estoque: 300 },
  { nome: 'Molho Tarê', unidade_medida: 'ml', fornecedor: 'Importadora Japonesa', custo_unitario: 0.02, estoque: 1000 },
  { nome: 'Pepino', unidade_medida: 'g', fornecedor: 'Hortifrúti', custo_unitario: 0.005, estoque: 500 },
  { nome: 'Abacate', unidade_medida: 'g', fornecedor: 'Hortifrúti', custo_unitario: 0.018, estoque: 400 },
  { nome: 'Atum', unidade_medida: 'g', fornecedor: 'Peixaria Central', custo_unitario: 0.065, estoque: 1500 },
];

const ingIds = {};
for (const ing of ings) {
  const r = db.prepare('INSERT OR IGNORE INTO ingredientes (nome, unidade_medida, fornecedor, custo_unitario, estoque_atual) VALUES (?,?,?,?,?)')
    .run(ing.nome, ing.unidade_medida, ing.fornecedor, ing.custo_unitario, ing.estoque);
  ingIds[ing.nome] = r.lastInsertRowid || db.prepare('SELECT id FROM ingredientes WHERE nome=?').get(ing.nome).id;
}

// Produtos
const prods = [
  {
    nome: 'Hot Philadelphia 10un', categoria_id: 1, preco_venda: 32.90,
    ficha: [['Salmão', 80], ['Cream Cheese', 40], ['Arroz para Sushi', 120], ['Nori', 1], ['Gergelim', 5]],
  },
  {
    nome: 'Uramaki Salmão 10un', categoria_id: 5, preco_venda: 28.90,
    ficha: [['Salmão', 70], ['Arroz para Sushi', 130], ['Pepino', 20], ['Gergelim', 5]],
  },
  {
    nome: 'Temaki Salmão', categoria_id: 2, preco_venda: 22.00,
    ficha: [['Salmão', 60], ['Cream Cheese', 30], ['Arroz para Sushi', 100], ['Nori', 1]],
  },
  {
    nome: 'Sashimi Salmão 10un', categoria_id: 4, preco_venda: 38.00,
    ficha: [['Salmão', 150]],
  },
  {
    nome: 'Hot Atum 10un', categoria_id: 1, preco_venda: 30.90,
    ficha: [['Atum', 80], ['Cream Cheese', 40], ['Arroz para Sushi', 120], ['Nori', 1], ['Gergelim', 5]],
  },
  {
    nome: 'Combinado 30 Peças', categoria_id: 3, preco_venda: 89.90,
    ficha: [['Salmão', 120], ['Atum', 80], ['Arroz para Sushi', 350], ['Nori', 3], ['Cream Cheese', 60], ['Gergelim', 10]],
  },
];

const prodIds = {};
for (const p of prods) {
  const r = db.prepare('INSERT OR IGNORE INTO produtos (nome, categoria_id, preco_venda) VALUES (?,?,?)')
    .run(p.nome, p.categoria_id, p.preco_venda);
  const id = r.lastInsertRowid || db.prepare('SELECT id FROM produtos WHERE nome=?').get(p.nome).id;
  prodIds[p.nome] = id;

  db.prepare('DELETE FROM ficha_tecnica WHERE produto_id=?').run(id);
  for (const [ingNome, qtd] of p.ficha) {
    const ingId = ingIds[ingNome];
    if (ingId) db.prepare('INSERT OR IGNORE INTO ficha_tecnica (produto_id, ingrediente_id, quantidade_usada) VALUES (?,?,?)').run(id, ingId, qtd);
  }
}

// Pedidos dos últimos 3 meses
const hoje = new Date();
for (let m = 0; m < 3; m++) {
  const numPedidos = 40 + Math.floor(Math.random() * 20);
  for (let d = 0; d < numPedidos; d++) {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - m, 1 + Math.floor(Math.random() * 28));
    const dataStr = data.toISOString().slice(0, 10);
    const origens = ['ifood', 'ifood', 'rappi', 'whatsapp', 'balcao'];
    const origem = origens[Math.floor(Math.random() * origens.length)];

    const numItens = 1 + Math.floor(Math.random() * 3);
    const itensPedido = [];
    const prodNomes = Object.keys(prodIds);
    for (let i = 0; i < numItens; i++) {
      const nome = prodNomes[Math.floor(Math.random() * prodNomes.length)];
      const prod = prods.find(p => p.nome === nome);
      itensPedido.push({ produto_id: prodIds[nome], quantidade: 1, preco_unitario: prod.preco_venda });
    }

    const total = itensPedido.reduce((acc, i) => acc + i.preco_unitario * i.quantidade, 0);
    const { lastInsertRowid: pedidoId } = db.prepare(
      'INSERT INTO pedidos (data, origem, total_bruto) VALUES (?,?,?)'
    ).run(dataStr, origem, total);

    for (const item of itensPedido) {
      const custo = db.prepare(`
        SELECT COALESCE(SUM(ft.quantidade_usada * i.custo_unitario), 0) as c
        FROM ficha_tecnica ft JOIN ingredientes i ON i.id = ft.ingrediente_id
        WHERE ft.produto_id = ?
      `).get(item.produto_id).c;
      db.prepare('INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario, custo_unitario) VALUES (?,?,?,?,?)')
        .run(pedidoId, item.produto_id, item.quantidade, item.preco_unitario, custo);
    }
  }
}

// Despesas dos últimos 3 meses
for (let m = 0; m < 3; m++) {
  const comp = new Date(hoje.getFullYear(), hoje.getMonth() - m, 1).toISOString().slice(0, 10);
  const despesas = [
    { descricao: 'Aluguel', categoria: 'fixo', tipo: 'Aluguel', valor: 2500 },
    { descricao: 'Energia', categoria: 'fixo', tipo: 'Energia', valor: 380 },
    { descricao: 'Internet', categoria: 'fixo', tipo: 'Internet', valor: 150 },
    { descricao: 'Funcionário 1', categoria: 'fixo', tipo: 'Funcionários', valor: 1800 },
    { descricao: 'Contador', categoria: 'fixo', tipo: 'Contador', valor: 350 },
    { descricao: 'Taxa iFood', categoria: 'variavel', tipo: 'Taxa iFood', valor: 800 + Math.random() * 200 },
    { descricao: 'Marketing Instagram', categoria: 'variavel', tipo: 'Marketing', valor: 300 + Math.random() * 100 },
    { descricao: 'Embalagens', categoria: 'variavel', tipo: 'Embalagens', valor: 200 + Math.random() * 80 },
  ];
  for (const d of despesas) {
    db.prepare('INSERT INTO despesas (descricao, categoria, tipo, valor, data_competencia) VALUES (?,?,?,?,?)')
      .run(d.descricao, d.categoria, d.tipo, d.valor, comp);
  }
}

console.log('Seed concluído com sucesso!');
