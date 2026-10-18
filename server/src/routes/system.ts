import { Hono } from 'hono';
import { wsHub } from '../ws/hub.js';
import { mcpGateway } from '../mcp/client.js';
import { storage } from '../storage/index.js';

export const systemRoutes = new Hono();

const startTime = Date.now();

systemRoutes.get('/health', (c) => {
  const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
  const wsStats = wsHub.getConnectedCount();
  const cfg = storage.getConfig();

  return c.json({
    status: 'ok',
    uptimeSeconds: uptimeSec,
    timestamp: new Date().toISOString(),
    websocket: wsStats,
    mcp: {
      hasToken: Boolean(cfg.token),
      hasActiveSession: Boolean(mcpGateway.getSessionId()),
      sessionId: mcpGateway.getSessionId(),
    },
  });
});

systemRoutes.get('/version', (c) => {
  return c.json({
    name: 'mcd-pet-server',
    version: '1.0.0',
    description: '麦当劳桌宠核心中枢服务 (Hono)',
    protocolVersion: '2024-11-05',
  });
});
