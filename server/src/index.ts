import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createNodeWebSocket } from '@hono/node-ws';
import { storage } from './storage/index.js';
import { wsHub } from './ws/hub.js';
import { petRoutes } from './routes/pet.js';
import { toolRoutes } from './routes/tools.js';
import { configRoutes } from './routes/config.js';
import { systemRoutes } from './routes/system.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findWebDistDir(): string | null {
  if (process.env.MCD_WEB_DIR && fs.existsSync(process.env.MCD_WEB_DIR)) {
    return path.resolve(process.env.MCD_WEB_DIR);
  }
  const candidates = [
    path.resolve(__dirname, 'web'),
    path.resolve(__dirname, 'public'),
    path.resolve(__dirname, '../web/dist'),
    path.resolve(__dirname, '../../web/dist'),
    path.resolve(process.cwd(), 'web/dist'),
    path.resolve(process.cwd(), 'dist/web'),
    path.resolve(process.cwd(), 'public'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return null;
}

const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id'],
  })
);

// WebSocket Setup
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.get(
  '/ws',
  upgradeWebSocket(() => {
    let clientId: string;
    return {
      onOpen(event, ws) {
        clientId = `client_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        wsHub.registerClient(clientId, ws, 'desktop');
      },
      onMessage(event, ws) {
        const raw = event.data.toString();
        wsHub.handleIncomingMessage(clientId, raw);
      },
      onClose() {
        wsHub.unregisterClient(clientId);
      },
      onError(event) {
        console.warn(`[WebSocket] Error for client ${clientId}:`, event);
        wsHub.unregisterClient(clientId);
      },
    };
  })
);

// API Routes
app.route('/api/pet', petRoutes);
app.route('/api/tools', toolRoutes);
app.route('/api/config', configRoutes);
app.route('/api', systemRoutes);

// Web UI 静态资源托管与单页应用 (SPA) 路由回退
const webDistDir = findWebDistDir();
if (webDistDir) {
  const relPath = path.relative(process.cwd(), webDistDir) || '.';
  app.use('/*', serveStatic({ root: relPath }));
  app.get('*', (c, next) => {
    if (c.req.path.startsWith('/api') || c.req.path.startsWith('/ws')) {
      return next();
    }
    const html = fs.readFileSync(path.join(webDistDir, 'index.html'), 'utf-8');
    return c.html(html);
  });
} else {
  // 当未构建前端静态资源时回退至 JSON API 问候
  app.get('/', (c) => {
    return c.json({
      name: 'McDonalds Desktop Pet Central Server',
      status: 'running',
      docs: {
        health: '/api/health',
        petState: '/api/pet/state',
        tools: '/api/tools',
        config: '/api/config',
        ws: 'ws://localhost:3001/ws',
      },
    });
  });
}

// Start Server (only when not running automated tests)
const isTest = process.env.NODE_ENV === 'test' || process.argv.some((arg) => arg.includes('test'));

if (!isTest) {
  const config = storage.getConfig();
  const port = Number(process.env.PORT) || config.port || 3001;

  const server = serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`\n======================================================`);
      console.log(`🍔 麦当劳桌宠中枢服务 (MCD Pet Server) 已就绪!`);
      console.log(`🌐 HTTP API 地址: http://localhost:${info.port}`);
      console.log(`🔌 WebSocket 地址: ws://localhost:${info.port}/ws`);
      console.log(`======================================================\n`);
    }
  );

  injectWebSocket(server);
}

export default app;
