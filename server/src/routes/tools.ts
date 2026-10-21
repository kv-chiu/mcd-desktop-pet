import { Hono } from 'hono';
import { isBusinessSuccess } from '@mcd/shared';
import { mcpGateway } from '../mcp/client.js';
import { OFFICIAL_TOOLS, TOOL_MAP } from '../mcp/tools.js';
import { wsHub } from '../ws/hub.js';

export const toolRoutes = new Hono();

export function evaluateToolSuccess(result: any) {
  const isToolSuccess = !result?.isError && (result?.layers ? result.layers.tool.success : true);
  const isBizSuccess = result?.layers ? isBusinessSuccess(result.layers.business?.outcome) : true;
  const isPartialSuccess = result?.layers?.business?.outcome === 'partial_success';
  const overallSuccess = Boolean(isToolSuccess && isBizSuccess);

  return {
    isToolSuccess,
    isBusinessSuccess: isBizSuccess,
    isPartialSuccess,
    overallSuccess,
  };
}

export function formatToolResponse(
  result: any,
  defaultErrorMsg = '执行未成功',
  extraFields: Record<string, any> = {}
) {
  const { isPartialSuccess, overallSuccess } = evaluateToolSuccess(result);
  return {
    success: overallSuccess,
    partial: isPartialSuccess,
    ...extraFields,
    layers: result?.layers,
    data: result,
    error: !overallSuccess
      ? (result?.layers?.business?.summary || result?.layers?.tool?.error || result?.error || defaultErrorMsg)
      : undefined,
  };
}

export function handlePetFeedback(result: any) {
  if (result?.petFeedback?.shouldFeedback) {
    try {
      wsHub.emitPetAction(result.petFeedback.action, {
        duration: result.petFeedback.duration,
        speech: result.petFeedback.speech,
      });
    } catch (err) {
      console.error('[Tools] 桌宠反馈动作更新或广播失败:', err);
    }
  }
}

export function getHttpErrorStatus(err: any): number {
  return err?.layers?.transport?.status && err.layers.transport.status >= 400
    ? err.layers.transport.status
    : 500;
}

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

toolRoutes.post('/initialize', async (c) => {
  const authHeader = c.req.header('Authorization');
  const overrideToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : undefined;

  try {
    const result = await mcpGateway.initialize(overrideToken);
    return c.json({
      success: true,
      sessionId: mcpGateway.getSessionId(),
      data: result,
    });
  } catch (err: any) {
    return c.json(
      {
        success: false,
        error: err.message || 'MCP 握手失败',
      },
      400
    );
  }
});

toolRoutes.post('/simulate', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const scenario = body.scenario || c.req.header('x-mock-scenario') || c.req.query('mock') || 'coupon-tool-error';
  const toolName = body.toolName || 'auto-bind-coupons';
  const notifyPet = body.notifyPet !== false && c.req.query('notifyPet') !== 'false';

  try {
    const result = await mcpGateway.executeTool(toolName, body.args || {}, undefined, { mockScenario: scenario });
    if (notifyPet) {
      handlePetFeedback(result);
    }
    return c.json(formatToolResponse(result, '模拟执行未成功', { scenario }));
  } catch (err: any) {
    return c.json(
      {
        success: false,
        scenario,
        error: err.message || '模拟执行失败',
        layers: err.layers,
      },
      getHttpErrorStatus(err) as any
    );
  }
});

toolRoutes.get('/quick/coupons', async (c) => {
  const mockScenario = c.req.header('x-mock-scenario') || c.req.query('mock');
  try {
    const result = await mcpGateway.executeTool('available-coupons', {}, undefined, { mockScenario });
    handlePetFeedback(result);
    return c.json(formatToolResponse(result, '查询优惠券未成功'));
  } catch (err: any) {
    return c.json(
      { success: false, error: err.message || '查询优惠券失败', layers: err.layers },
      getHttpErrorStatus(err) as any
    );
  }
});

toolRoutes.post('/quick/auto-bind', async (c) => {
  const mockScenario = c.req.header('x-mock-scenario') || c.req.query('mock');
  try {
    const result = await mcpGateway.executeTool('auto-bind-coupons', {}, undefined, { mockScenario });
    handlePetFeedback(result);
    return c.json(formatToolResponse(result, '领券未成功'));
  } catch (err: any) {
    return c.json(
      { success: false, error: err.message || '领券失败', layers: err.layers },
      getHttpErrorStatus(err) as any
    );
  }
});

toolRoutes.get('/quick/calendar', async (c) => {
  const month = c.req.query('month');
  const mockScenario = c.req.header('x-mock-scenario') || c.req.query('mock');
  try {
    const result = await mcpGateway.executeTool('campaign-calendar', month ? { month } : {}, undefined, {
      mockScenario,
    });
    handlePetFeedback(result);
    return c.json(formatToolResponse(result, '查询日历未成功'));
  } catch (err: any) {
    return c.json(
      { success: false, error: err.message || '查询日历失败', layers: err.layers },
      getHttpErrorStatus(err) as any
    );
  }
});

toolRoutes.get('/quick/nutrition', async (c) => {
  const keyword = c.req.query('keyword');
  const mockScenario = c.req.header('x-mock-scenario') || c.req.query('mock');
  try {
    const result = await mcpGateway.executeTool('list-nutrition-foods', keyword ? { keyword } : {}, undefined, {
      mockScenario,
    });
    handlePetFeedback(result);
    return c.json(formatToolResponse(result, '查询营养信息未成功'));
  } catch (err: any) {
    return c.json(
      { success: false, error: err.message || '查询营养信息失败', layers: err.layers },
      getHttpErrorStatus(err) as any
    );
  }
});

toolRoutes.post('/:name', async (c) => {
  const toolName = c.req.param('name');
  const authHeader = c.req.header('Authorization');
  const overrideToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : undefined;
  const mockScenario = c.req.header('x-mock-scenario') || c.req.query('mock');

  let body = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const notifyPet = (body as any)?.notifyPet !== false && c.req.query('notifyPet') !== 'false';

  try {
    const result = await mcpGateway.executeTool(toolName, body, overrideToken, { mockScenario });
    if (notifyPet) {
      handlePetFeedback(result);
    }
    return c.json(formatToolResponse(result, '执行未成功'));
  } catch (err: any) {
    return c.json(
      {
        success: false,
        error: err.message || '执行 MCP 工具失败',
        layers: err.layers,
        details: err,
      },
      getHttpErrorStatus(err) as any
    );
  }
});

