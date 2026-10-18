import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { createNodeWebSocket } from '@hono/node-ws';
import { storage } from './storage/index.js';
import { wsHub } from './ws/hub.js';
import { petRoutes } from './routes/pet.js';
import { toolRoutes } from './routes/tools.js';
import { configRoutes } from './routes/config.js';
import { systemRoutes } from './routes/system.js';

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

// Root greeting
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

// Start Server
const config = storage.getConfig();
const port = config.port || 3001;

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

export default app;
