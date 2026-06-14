PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS ingredientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  unidade_medida TEXT NOT NULL CHECK(unidade_medida IN ('kg','g','litro','ml','unidade')),
  fornecedor TEXT,
  custo_unitario REAL NOT NULL DEFAULT 0,
  estoque_atual REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS compras_ingredientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ingrediente_id INTEGER NOT NULL REFERENCES ingredientes(id) ON DELETE CASCADE,
  data TEXT NOT NULL DEFAULT (date('now')),
  quantidade REAL NOT NULL,
  preco_total REAL NOT NULL,
  custo_unitario REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categorias_produto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  categoria_id INTEGER REFERENCES categorias_produto(id),
  preco_venda REAL NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ficha_tecnica (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  ingrediente_id INTEGER NOT NULL REFERENCES ingredientes(id),
  quantidade_usada REAL NOT NULL,
  UNIQUE(produto_id, ingrediente_id)
);

CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL DEFAULT (date('now')),
  origem TEXT DEFAULT 'manual',
  total_bruto REAL NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS itens_pedido (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_unitario REAL NOT NULL,
  custo_unitario REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS despesas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK(categoria IN ('fixo','variavel')),
  tipo TEXT NOT NULL,
  valor REAL NOT NULL,
  data_competencia TEXT NOT NULL,
  recorrente INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS faturamento_diario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL,
  total_bruto REAL NOT NULL DEFAULT 0,
  pix REAL NOT NULL DEFAULT 0,
  dinheiro REAL NOT NULL DEFAULT 0,
  credito REAL NOT NULL DEFAULT 0,
  debito REAL NOT NULL DEFAULT 0,
  taxa_cartao REAL NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS catalogo_compras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  quantidade REAL NOT NULL DEFAULT 1,
  unidade TEXT NOT NULL DEFAULT 'unidade',
  observacao TEXT,
  ultimo_preco REAL,
  ultimo_preco_em TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lista_compras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  quantidade REAL NOT NULL DEFAULT 1,
  unidade TEXT NOT NULL DEFAULT 'unidade',
  ingrediente_id INTEGER REFERENCES ingredientes(id) ON DELETE SET NULL,
  comprado INTEGER NOT NULL DEFAULT 0,
  valor_pago REAL,
  observacao TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS boletos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fornecedor TEXT NOT NULL,
  descricao TEXT,
  valor_total REAL NOT NULL DEFAULT 0,
  data_chegada TEXT NOT NULL DEFAULT (date('now')),
  data_vencimento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','pago','vencido')),
  data_pagamento TEXT,
  despesa_id INTEGER REFERENCES despesas(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS boleto_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boleto_id INTEGER NOT NULL REFERENCES boletos(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  quantidade REAL NOT NULL DEFAULT 1,
  unidade TEXT NOT NULL DEFAULT 'unidade',
  valor_unitario REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS vendas_produto (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data TEXT NOT NULL DEFAULT (date('now')),
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  quantidade INTEGER NOT NULL DEFAULT 1,
  preco_venda REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed categorias
INSERT OR IGNORE INTO categorias_produto (nome) VALUES
  ('Hot Roll'),
  ('Temaki'),
  ('Combinado'),
  ('Sashimi'),
  ('Uramaki'),
  ('Bebidas'),
  ('Sobremesas');
