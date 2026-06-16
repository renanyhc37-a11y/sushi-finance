const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'sushi.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const raw = new DatabaseSync(DB_PATH);

// ── Blindagem contra queda/corrupção (Camada 1) ──────────────
// WAL: cada escrita vai primeiro para um log à parte e só depois é integrada
//   ao banco → se o processo/energia cair NO MEIO de uma escrita, o banco
//   nunca corrompe (rola de volta a transação incompleta). É o que evita o
//   pesadelo "voltou e estava tudo errado".
// synchronous=NORMAL: equilíbrio seguro entre durabilidade e velocidade no WAL.
// busy_timeout: se duas escritas coincidirem no pico, espera em vez de dar erro.
try {
  raw.exec('PRAGMA journal_mode = WAL;');
  raw.exec('PRAGMA synchronous = NORMAL;');
  raw.exec('PRAGMA busy_timeout = 5000;');
  console.log('[db] WAL ativo (resiliente a queda) · synchronous=NORMAL');
} catch (e) {
  console.error('[db] Falha ao aplicar PRAGMAs de resiliência:', e.message);
}

const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
raw.exec(schema);

// Migrações incrementais — adiciona colunas novas sem apagar dados
// Cria tabelas novas que podem não existir em bancos antigos
const newTables = `
  CREATE TABLE IF NOT EXISTS vendas_produto (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL DEFAULT (date('now')),
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    quantidade INTEGER NOT NULL DEFAULT 1,
    preco_venda REAL NOT NULL,
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
`;
try { raw.exec(newTables); } catch(e) { console.error('newTables migration:', e.message); }

// ── Chat / WhatsApp conversas ─────────────────────────────────
const chatTables = `
  CREATE TABLE IF NOT EXISTS wa_conversas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telefone TEXT NOT NULL UNIQUE,
    nome TEXT,
    foto_url TEXT,
    ultima_mensagem TEXT,
    ultima_em TEXT,
    nao_lidas INTEGER NOT NULL DEFAULT 0,
    ia_ativa INTEGER NOT NULL DEFAULT 1,
    arquivada INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS wa_mensagens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversa_id INTEGER NOT NULL REFERENCES wa_conversas(id) ON DELETE CASCADE,
    wa_id TEXT,
    de TEXT NOT NULL,
    corpo TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'texto',
    de_mim INTEGER NOT NULL DEFAULT 0,
    ia INTEGER NOT NULL DEFAULT 0,
    lida INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS wa_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    ia_global INTEGER NOT NULL DEFAULT 1,
    prompt_sistema TEXT,
    horario_atendimento TEXT NOT NULL DEFAULT '08:00-22:00',
    mensagem_fora_horario TEXT NOT NULL DEFAULT 'Olá! Estamos fora do horário de atendimento. Retornaremos em breve 🍣',
    mensagem_boas_vindas TEXT NOT NULL DEFAULT 'Olá! 🍣 Bem-vindo ao Sushi Control! Como posso ajudar?'
  );
  INSERT OR IGNORE INTO wa_config(id) VALUES(1);
`;
try { raw.exec(chatTables); } catch(e) { console.error('chatTables migration:', e.message); }

// ── Novas tabelas WhatsApp ────────────────────────────────────
const waTables2 = `
  CREATE TABLE IF NOT EXISTS wa_respostas_rapidas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    corpo TEXT NOT NULL,
    atalho TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS wa_broadcasts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    corpo TEXT NOT NULL,
    total INTEGER NOT NULL DEFAULT 0,
    enviados INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pendente',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  INSERT OR IGNORE INTO wa_respostas_rapidas(titulo, corpo, atalho) VALUES
    ('Prazo de entrega', 'Nosso prazo de entrega é de 40 a 60 minutos. Assim que seu pedido sair, você recebe uma notificação.', '/prazo'),
    ('Horário de funcionamento', 'Funcionamos de segunda a domingo, das 18h às 23h.', '/horario'),
    ('Forma de pagamento', 'Aceitamos cartão de crédito, débito, Pix e dinheiro na entrega.', '/pagamento'),
    ('Área de entrega', 'Entregamos em toda a cidade. Consulte o cardápio para ver se seu endereço está na área de cobertura.', '/area');
`;
try { raw.exec(waTables2); } catch(e) { console.error('waTables2:', e.message); }

// ── Treinamento do bot ────────────────────────────────────────
const waTreinamento = `
  CREATE TABLE IF NOT EXISTS wa_exemplos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria TEXT NOT NULL DEFAULT 'geral',
    pergunta TEXT NOT NULL,
    resposta TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  INSERT OR IGNORE INTO wa_exemplos(id, categoria, pergunta, resposta) VALUES
    (1, 'pedido',    'Vocês entregam até o centro?', 'Sim! Entregamos em toda a cidade. É só fazer seu pedido pelo cardápio online.'),
    (2, 'pedido',    'Qual o tempo de entrega?', 'Em média 40 a 60 minutos. Assim que sair pra entrega você recebe uma mensagem.'),
    (3, 'cardapio',  'Tem combinado pra 2 pessoas?', 'Temos sim! Acesse o cardápio e veja nossas opções de combinados. Tem pra 2, 4 e 6 pessoas.'),
    (4, 'pagamento', 'Aceitam cartão?', 'Aceitamos cartão de crédito, débito, Pix e dinheiro na entrega.'),
    (5, 'horario',   'Até que horas funciona?', 'Funcionamos de segunda a domingo, das 18h às 23h.');
`;
try { raw.exec(waTreinamento); } catch(e) { console.error('waTreinamento:', e.message); }

const migrations = [
  `ALTER TABLE wa_conversas ADD COLUMN chat_id TEXT`,
  `ALTER TABLE wa_conversas ADD COLUMN tags TEXT DEFAULT '[]'`,
  `ALTER TABLE wa_conversas ADD COLUMN assumida INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE wa_conversas ADD COLUMN assumida_em TEXT`,
  `ALTER TABLE lista_compras ADD COLUMN valor_pago REAL`,
  `ALTER TABLE lista_compras ADD COLUMN qtd_comprada REAL`,
  `ALTER TABLE lista_compras ADD COLUMN unidade_comprada TEXT`,
  `ALTER TABLE catalogo_compras ADD COLUMN ultimo_preco REAL`,
  `ALTER TABLE catalogo_compras ADD COLUMN ultimo_preco_em TEXT`,
  `ALTER TABLE cardapio_itens ADD COLUMN is_sugestao INTEGER NOT NULL DEFAULT 0`,
];
for (const sql of migrations) {
  try { raw.exec(sql); } catch (_) { /* coluna já existe */ }
}

// Converte BigInt para Number em qualquer objeto/array retornado pelo SQLite
function sanitize(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'bigint') return Number(val);
  if (Array.isArray(val)) return val.map(sanitize);
  if (typeof val === 'object') {
    const out = {};
    for (const k of Object.keys(val)) out[k] = sanitize(val[k]);
    return out;
  }
  return val;
}

function wrapStmt(stmt) {
  return {
    all(...args)  { return sanitize(stmt.all(...args)); },
    get(...args)  { return sanitize(stmt.get(...args)); },
    run(...args)  {
      const r = stmt.run(...args);
      return {
        changes: Number(r.changes ?? 0),
        lastInsertRowid: Number(r.lastInsertRowid ?? r.lastInsertRowId ?? 0),
      };
    },
  };
}

const db = {
  exec(sql) { return raw.exec(sql); },
  prepare(sql) { return wrapStmt(raw.prepare(sql)); },
  // Integra o WAL ao arquivo principal do banco. Chamado ANTES de copiar o
  // arquivo no backup — senão a cópia ficaria sem as últimas escritas (que
  // ainda estariam só no log WAL).
  checkpoint() { try { raw.exec('PRAGMA wal_checkpoint(TRUNCATE);'); return true; } catch { return false; } },
  transaction(fn) {
    return (...args) => {
      raw.exec('BEGIN');
      try {
        const result = fn(...args);
        raw.exec('COMMIT');
        return result;
      } catch (e) {
        try { raw.exec('ROLLBACK'); } catch (_) {}
        throw e;
      }
    };
  },
};

module.exports = db;
