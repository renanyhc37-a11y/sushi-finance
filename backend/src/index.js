require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { createServer } = require('http');
const { Server: SocketIO } = require('socket.io');

const ingredientesRouter = require('./routes/ingredientes');
const produtosRouter = require('./routes/produtos');
const pedidosRouter = require('./routes/pedidos');
const despesasRouter = require('./routes/despesas');
const faturamentoRouter = require('./routes/faturamento');
const relatoriosRouter = require('./routes/relatorios');
const alertasRouter = require('./routes/alertas');
const listaComprasRouter = require('./routes/listaCompras');
const boletosRouter = require('./routes/boletos');
const vendasRouter = require('./routes/vendas');
const authRouter = require('./routes/auth');
const rendimentoRouter = require('./routes/rendimento');
const insumosRouter = require('./routes/insumos');
const fluxoCaixaRouter = require('./routes/fluxoCaixa');
const notasRouter = require('./routes/notas');
const cardapioRouter = require('./routes/cardapio');
const { router: pdvRouter } = require('./routes/pdv');
const whatsappRouter = require('./routes/whatsapp');
const clientesRouter = require('./routes/clientes');
const iaRouter = require('./routes/ia');
const dashboardRouter = require('./routes/dashboard');
const unidadesRouter = require('./routes/unidades');
const importarRouter = require('./routes/importar');
const { router: promocoesRouter } = require('./routes/promocoes');
const chatRouter = require('./routes/chat');
const campanhasRouter = require('./routes/campanhas');
const caixaRouter = require('./routes/caixa');
const producaoRouter = require('./routes/producao');
const { requireAuth } = require('./middleware/requireAuth');
const wa = require('./services/whatsapp');

const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const { SECRET } = require('./middleware/requireAuth');

const app = express();
const httpServer = createServer(app);

// ── CORS: apenas origens autorizadas ──────────────────────────
const ORIGENS_PERMITIDAS = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:4173', 'http://localhost:3001'];

const io = new SocketIO(httpServer, {
  cors: { origin: ORIGENS_PERMITIDAS, methods: ['GET', 'POST'] },
  path: '/socket.io',
});

// ── Autenticação no Socket.io ──────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('Token ausente'));
  try { jwt.verify(token, SECRET); next(); }
  catch { next(new Error('Token inválido')); }
});

const PORT = Number(process.env.PORT || 3001);

// ── Headers de segurança ───────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // frontend SPA usa inline scripts; CSP custom abaixo
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: ORIGENS_PERMITIDAS,
  credentials: true,
}));
app.use(express.json());

// ── Serve o frontend buildado (antes do auth) ──
const FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');
const FRONTEND_PUBLIC = path.join(__dirname, '..', '..', 'frontend', 'public');

if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST, {
    setHeaders(res, filePath) {
      if (filePath.endsWith('sw.js') || filePath.includes('workbox')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));
  console.log('Frontend servido de:', FRONTEND_DIST);
}

// ── Serve uploads (banners, cardápio) da pasta public ─────────
// Separado do dist para sobreviver a rebuilds
if (fs.existsSync(FRONTEND_PUBLIC)) {
  app.use(express.static(FRONTEND_PUBLIC));
}

app.use('/api/auth', authRouter);
// Health REAL (Camada 4): além de "o processo está vivo", confirma que o
// BANCO responde (lê/escreve). Assim o monitor distingue "no ar de verdade"
// de "processo de pé mas banco travado". Retorna 503 se o banco falhar.
app.get('/api/health', (_, res) => {
  let dbOk = false;
  try { require('./db/database').prepare('SELECT 1 AS ok').get(); dbOk = true; } catch {}
  const body = { status: dbOk ? 'ok' : 'degradado', db: dbOk ? 'ok' : 'erro', uptime: Math.floor(process.uptime()), agora: new Date().toISOString() };
  res.status(dbOk ? 200 : 503).json(body);
});

// Serve o HTML do WhatsApp Web localmente (evita download lento do GitHub)
app.get('/wa-version.html', (req, res) => {
  const waHtml = path.join(__dirname, '..', 'wwebjs_cache', '2.3000.1041103517-alpha.html');
  if (fs.existsSync(waHtml)) res.sendFile(waHtml);
  else res.status(404).send('not found');
});

// Cardápio e criação de pedidos — públicos (sem auth)
app.use('/api/cardapio', cardapioRouter);

// SSE registrados ANTES do requireAuth (EventSource não suporta headers)
const { sseHandler } = require('./routes/pdv');
app.get('/api/pdv/eventos', sseHandler);
app.get('/api/whatsapp/sse', (req, res) => {
  const jwt = require('jsonwebtoken');
  const { SECRET } = require('./middleware/requireAuth');
  const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');
  try { jwt.verify(token, SECRET); } catch { return res.status(401).end(); }
  wa.sseStatus(req, res);
});

// Todas as rotas de API abaixo exigem autenticação
app.use('/api', requireAuth);

app.use('/api/ingredientes', ingredientesRouter);
app.use('/api/produtos', produtosRouter);
app.use('/api/pedidos', pedidosRouter);
app.use('/api/faturamento', faturamentoRouter);
app.use('/api/despesas', despesasRouter);
app.use('/api/relatorios', relatoriosRouter);
app.use('/api/alertas', alertasRouter);
app.use('/api/lista-compras', listaComprasRouter);
app.use('/api/boletos', boletosRouter);
app.use('/api/vendas', vendasRouter);
app.use('/api/rendimento', rendimentoRouter);
app.use('/api/insumos', insumosRouter);
app.use('/api/fluxo-caixa', fluxoCaixaRouter);
app.use('/api/notas', notasRouter);
app.use('/api/pdv', pdvRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/ia', iaRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/unidades', unidadesRouter);
app.use('/api/importar', importarRouter);
app.use('/api/promocoes', promocoesRouter);
app.use('/api/chat', chatRouter);
app.use('/api/campanhas', campanhasRouter);
app.use('/api/caixa', caixaRouter);
app.use('/api/producao', producaoRouter);

// SPA fallback
if (fs.existsSync(FRONTEND_DIST)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error('Erro na rota:', req.method, req.path, '\n', err);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(500).json({ erro: isProd ? 'Erro interno do servidor' : (err.message || 'Erro interno') });
});

process.on('uncaughtException', (err) => { console.error('uncaughtException:', err); });
process.on('unhandledRejection', (err) => { console.error('unhandledRejection:', err); });

// Encerramento gracioso: fecha o Chrome do WhatsApp ao parar o servidor
// (evita deixar processos zumbis travando a sessão no próximo boot)
let encerrando = false;
async function encerrar() {
  if (encerrando) return; encerrando = true;
  try { await wa.desconectar(); } catch {}
  process.exit(0);
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);

// ─────────────────────────────────────────────────────────
// Inicia servidores: HTTP na porta 3001 (PC) +
//                   HTTPS na mesma porta já liberada no firewall
// ─────────────────────────────────────────────────────────
// ── Socket.io — passa instância pro serviço WhatsApp ──────────
wa.setIo(io);
io.on('connection', (socket) => {
  console.log('[Socket.io] Cliente conectado:', socket.id);
  socket.on('disconnect', () => console.log('[Socket.io] Cliente desconectado:', socket.id));
});

httpServer.listen(PORT, async () => {
  console.log(`\n  ✅  http://localhost:${PORT}      (PC)`);
  console.log(`  ✅  http://192.168.15.4:${PORT}  (celular)\n`);

  // Detecta URL do ngrok automaticamente (se estiver rodando)
  try {
    const http = require('http');
    await new Promise((resolve) => {
      const req = http.get('http://localhost:4040/api/tunnels', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const tunnels = JSON.parse(data).tunnels || [];
            const https = tunnels.find(t => t.proto === 'https') || tunnels[0];
            if (https?.public_url) {
              process.env.APP_URL = https.public_url;
              console.log(`  🌐  Ngrok detectado: ${https.public_url}\n`);
            }
          } catch {}
          resolve();
        });
      });
      req.on('error', () => resolve()); // ngrok não está rodando — sem problema
      req.setTimeout(2000, () => { req.destroy(); resolve(); });
    });
  } catch {}

  wa.iniciar();

  // Backup automático diário do banco de dados
  try { require('./services/backup').iniciarBackupAutomatico(); } catch (e) { console.error('[backup] não iniciado:', e.message); }

  // Cupom automático de aniversário (envio via WhatsApp)
  try { require('./services/aniversarios').iniciarAniversarios(); } catch (e) { console.error('[aniversário] não iniciado:', e.message); }
});
