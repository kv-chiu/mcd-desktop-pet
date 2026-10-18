import { Hono } from 'hono';
import { mcpGateway } from '../mcp/client.js';
import { OFFICIAL_TOOLS, TOOL_MAP } from '../mcp/tools.js';
import { wsHub } from '../ws/hub.js';

export const toolRoutes = new Hono();

// 获取所有支持的 MCP 工具列表
toolRoutes.get('/', async (c) => {
  const authHeader = c.req.header('Authorization');
  const overrideToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : undefined;

  try {
    const tools = await mcpGateway.listTools(overrideToken);
    return c.json({
      success: true,
      count: tools.length,
      data: tools,
      officialCatalog: OFFICIAL_TOOLS,
    });
  } catch (err: any) {
    return c.json({
      success: true,
      count: OFFICIAL_TOOLS.length,
      data: OFFICIAL_TOOLS,
      warning: err.message,
    });
  }
});

// 执行指定的 MCP 工具
toolRoutes.post('/:name', async (c) => {
  const toolName = c.req.param('name');
  const authHeader = c.req.header('Authorization');
  const overrideToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : undefined;

  let body = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  try {
    const result = await mcpGateway.executeTool(toolName, body, overrideToken);

    // 特殊动作联动反馈：如自动领券成功触发桌宠庆祝
    if (toolName === 'auto-bind-coupons' || toolName === 'exchange-point-coupon') {
      wsHub.emitPetAction('jump', {
        duration: 3.5,
        speech: '主人！麦当劳优惠券已全部为您自动领取好啦！🎉',
      });
    } else if (toolName === 'create-order') {
      wsHub.emitPetAction('wave', {
        duration: 4.0,
        speech: '订单已创建！麦麦美味正在加速准备中~🍔',
      });
    }

    return c.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return c.json(
      {
        success: false,
        error: err.message || '执行 MCP 工具失败',
        details: err,
      },
      500
    );
  }
});

// 快捷接口：查询可用优惠券
toolRoutes.get('/quick/coupons', async (c) => {
  try {
    const result = await mcpGateway.executeTool('available-coupons');
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || '查询优惠券失败' }, 500);
  }
});

// 快捷接口：一键自动领券并通知桌宠
toolRoutes.post('/quick/auto-bind', async (c) => {
  try {
    const result = await mcpGateway.executeTool('auto-bind-coupons');
    wsHub.emitPetAction('jump', {
      duration: 3.5,
      speech: '太棒啦！麦当劳优惠券已一键领入卡包~🎫',
    });
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || '领券失败' }, 500);
  }
});

// 快捷接口：活动日历
toolRoutes.get('/quick/calendar', async (c) => {
  const month = c.req.query('month');
  try {
    const result = await mcpGateway.executeTool('campaign-calendar', month ? { month } : {});
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || '查询日历失败' }, 500);
  }
});

// 快捷接口：营养成分查询
toolRoutes.get('/quick/nutrition', async (c) => {
  const keyword = c.req.query('keyword');
  try {
    const result = await mcpGateway.executeTool('list-nutrition-foods', keyword ? { keyword } : {});
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || '查询营养信息失败' }, 500);
  }
});
