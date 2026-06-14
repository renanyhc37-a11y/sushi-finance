# Sushi Finance — Sistema Financeiro para Delivery

## Pré-requisito

Instale o [Node.js](https://nodejs.org/) (versão 18 ou superior).

---

## Como rodar

### 1. Backend (API)

```bash
cd backend
npm install
node src/db/seed.js   # opcional: popula com dados de demonstração
npm run dev           # inicia na porta 3001
```

### 2. Frontend (Interface)

Em outro terminal:

```bash
cd frontend
npm install
npm run dev           # abre em http://localhost:3000
```

Acesse **http://localhost:3000** no navegador.

---

## Estrutura

```
sushi-finance/
├── backend/
│   ├── src/
│   │   ├── db/           schema.sql, database.js, seed.js
│   │   ├── routes/       ingredientes, produtos, pedidos, despesas, relatorios, alertas
│   │   └── index.js      servidor Express (porta 3001)
│   └── data/sushi.db     banco SQLite (criado automaticamente)
└── frontend/
    └── src/
        ├── pages/        Dashboard, Ingredientes, FichasTecnicas, Pedidos, Despesas, Relatorios
        ├── components/   Card, Modal, AlertBanner, CmvBadge
        └── lib/fmt.js    formatação de moeda, %, datas
```

---

## Funcionalidades

| Módulo | O que faz |
|---|---|
| **Dashboard** | Faturamento, lucro, CMV%, ticket médio, DRE resumido, gráfico 12 meses |
| **Ingredientes** | Cadastro, registro de compras, custo médio ponderado automático |
| **Fichas Técnicas** | Receita por produto, custo e CMV calculados em tempo real |
| **Pedidos** | Registro por origem (iFood, Rappi, WhatsApp, etc.), custo e lucro por pedido |
| **Despesas** | Fixas e variáveis por mês, com flag de recorrência |
| **Relatórios** | DRE completo, ranking de margem, CMV por produto, evolução mensal |
| **Alertas** | CMV alto, aumento de insumo, queda de margem |

---

## Fórmulas

- **Custo médio ponderado** = (estoque × custo_atual + qtd_comprada × novo_preço) ÷ (estoque + qtd_comprada)
- **CMV%** = (custo do produto ÷ preço de venda) × 100 — ideal: abaixo de 35%
- **Lucro bruto** = Faturamento − CMV
- **Lucro líquido** = Lucro bruto − Despesas fixas − Despesas variáveis
