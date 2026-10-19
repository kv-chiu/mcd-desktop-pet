import { Hono } from 'hono';
import { storage } from '../storage/index.js';
import { mcpGateway } from '../mcp/client.js';

export const configRoutes = new Hono();

// 获取当前配置（Token 脱敏）
configRoutes.get('/', (c) => {
  const cfg = storage.getConfig();
  const maskedToken = cfg.token
    ? `${cfg.token.slice(0, 6)}...${cfg.token.slice(-4)}`
    : '';

  return c.json({
    success: true,
    data: {
      ...cfg,
      token: maskedToken,
      hasToken: Boolean(cfg.token),
    },
  });
});

// 更新配置
configRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const updateData: Record<string, any> = {};
  if (typeof body.token === 'string') {
    updateData.token = body.token.trim();
  }
  if (typeof body.mcpEndpoint === 'string' && body.mcpEndpoint.trim()) {
    updateData.mcpEndpoint = body.mcpEndpoint.trim();
  }
  if (typeof body.petName === 'string' && body.petName.trim()) {
    updateData.petName = body.petName.trim();
  }
  if (typeof body.soundEnabled === 'boolean') {
    updateData.soundEnabled = body.soundEnabled;
  }
  if (typeof body.autoStart === 'boolean') {
    updateData.autoStart = body.autoStart;
  }
  if (typeof body.lunchTime === 'string' && body.lunchTime.trim()) {
    updateData.lunchTime = body.lunchTime.trim();
  }
  if (typeof body.lunchReminderEnabled === 'boolean') {
    updateData.lunchReminderEnabled = body.lunchReminderEnabled;
  }
  if (typeof body.lunchAdvanceMinutes === 'number' && body.lunchAdvanceMinutes > 0) {
    updateData.lunchAdvanceMinutes = Math.round(body.lunchAdvanceMinutes);
  }

  try {
    const updated = storage.saveConfig(updateData);

    // 仅在配置成功持久化后，若更新了 Token 则重置 MCP Gateway 会话
    if (typeof body.token === 'string') {
      mcpGateway.resetSession();
    }

    const maskedToken = updated.token
      ? `${updated.token.slice(0, 6)}...${updated.token.slice(-4)}`
      : '';

    return c.json({
      success: true,
      message: '配置已更新保存',
      data: {
        ...updated,
        token: maskedToken,
        hasToken: Boolean(updated.token),
      },
    });
  } catch (err: any) {
    console.error('[ConfigRoute] 保存配置失败:', err);
    return c.json(
      {
        success: false,
        error: `保存配置失败: ${err.message || '磁盘写入异常'}`,
      },
      500
    );
  }
});

// 获取历史操作记录
configRoutes.get('/history', (c) => {
  const limit = Number(c.req.query('limit')) || 50;
  const list = storage.getHistory(limit);
  return c.json({
    success: true,
    count: list.length,
    data: list,
  });
});
