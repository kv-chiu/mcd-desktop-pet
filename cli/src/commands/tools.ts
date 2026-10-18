import pc from 'picocolors';
import { apiRequest } from '../utils/http.js';
import { outputResult } from '../utils/output.js';
import type { CliResult } from '../types.js';

export async function handleListTools(options: { json?: boolean } = {}): Promise<CliResult> {
  const isJson = Boolean(options.json);
  const response = await apiRequest('/api/tools');

  if (isJson) {
    const res: CliResult = {
      success: response.ok,
      command: 'tools',
      message: response.ok ? `成功获取 ${response.data?.count || 0} 项工具` : '获取工具列表失败',
      data: response.data,
      error: response.error,
    };
    outputResult(res, true);
    return res;
  }

  if (response.ok && response.data) {
    const list = response.data.data || response.data.officialCatalog || [];
    console.log('\n' + pc.bold(pc.yellow(`🍔 麦当劳官方 MCP 工具清单 (共 ${list.length} 项)`)));
    console.log(pc.gray('──────────────────────────────────────────────────────────────────'));
    for (const t of list) {
      console.log(`  ${pc.cyan(pc.bold(t.id.padEnd(28)))} ${pc.bold(t.name || t.id)}`);
      if (t.description) {
        console.log(`  ${pc.gray(t.description.slice(0, 70) + (t.description.length > 70 ? '...' : ''))}`);
      }
    }
    console.log(pc.gray('──────────────────────────────────────────────────────────────────\n'));
    return {
      success: true,
      command: 'tools',
      message: `成功获取 ${list.length} 项工具`,
      data: list,
    };
  } else {
    const res: CliResult = {
      success: false,
      command: 'tools',
      message: '获取工具列表失败',
      error: response.error,
    };
    outputResult(res, false);
    return res;
  }
}

export async function handleExecuteTool(
  toolName: string,
  rawParams = '{}',
  options: { json?: boolean } = {}
): Promise<CliResult> {
  const isJson = Boolean(options.json);

  let params: Record<string, any> = {};
  try {
    params = typeof rawParams === 'string' ? JSON.parse(rawParams) : rawParams;
  } catch (err: any) {
    const res: CliResult = {
      success: false,
      command: 'tool',
      message: `参数解析失败: ${err.message}`,
      error: '请传入合法的 JSON 字符串，例如 \'{"keyword":"巨无霸"}\'',
    };
    outputResult(res, isJson);
    return res;
  }

  const response = await apiRequest(`/api/tools/${toolName}`, {
    method: 'POST',
    body: JSON.stringify(params),
  });

  const res: CliResult = {
    success: response.ok && (response.data?.success !== false),
    command: `tool:${toolName}`,
    message: response.ok ? `工具 [${toolName}] 执行完成` : `工具 [${toolName}] 执行失败`,
    data: response.data,
    error: response.error || response.data?.error,
  };

  if (isJson) {
    outputResult(res, true);
  } else {
    if (res.success) {
      console.log(`${pc.green('✔')} ${pc.bold(`工具 [${toolName}] 执行成功`)}`);
      console.log(pc.gray('────────────────────────────────────────────'));
      console.log(JSON.stringify(response.data?.data || response.data, null, 2));
      console.log(pc.gray('────────────────────────────────────────────'));
    } else {
      console.error(`${pc.red('✖')} ${pc.bold(`工具 [${toolName}] 执行未成功`)}`);
      if (res.error) console.error(pc.red(`  详情: ${res.error}`));
    }
  }

  return res;
}

export async function handleQuickCoupons(options: { json?: boolean } = {}): Promise<CliResult> {
  const isJson = Boolean(options.json);
  const response = await apiRequest('/api/tools/quick/coupons');

  const res: CliResult = {
    success: response.ok && (response.data?.success !== false),
    command: 'coupon:list',
    message: response.ok ? '获取优惠券列表成功' : '获取优惠券列表失败',
    data: response.data?.data || response.data,
    error: response.error || response.data?.error,
  };

  if (isJson) {
    outputResult(res, true);
  } else {
    if (res.success) {
      console.log(`${pc.green('✔')} ${pc.bold('可用优惠券列表已获取')}`);
      console.log(pc.gray('────────────────────────────────────────────'));
      console.log(JSON.stringify(res.data, null, 2));
      console.log(pc.gray('────────────────────────────────────────────'));
    } else {
      outputResult(res, false);
    }
  }

  return res;
}

export async function handleQuickAutoBind(options: { json?: boolean } = {}): Promise<CliResult> {
  const isJson = Boolean(options.json);
  const response = await apiRequest('/api/tools/quick/auto-bind', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  const res: CliResult = {
    success: response.ok && (response.data?.success !== false),
    command: 'coupon:auto-bind',
    message: response.ok ? '一键领券执行完成' : '领券执行失败',
    data: response.data,
    error: response.error || response.data?.error,
  };

  outputResult(res, isJson);
  return res;
}

export async function handleQuickNutrition(
  keyword?: string,
  options: { json?: boolean } = {}
): Promise<CliResult> {
  const isJson = Boolean(options.json);
  const query = keyword ? `?keyword=${encodeURIComponent(keyword)}` : '';
  const response = await apiRequest(`/api/tools/quick/nutrition${query}`);

  const res: CliResult = {
    success: response.ok && (response.data?.success !== false),
    command: 'nutrition',
    message: response.ok ? `查询营养成分成功 [${keyword || '全部'}]` : '查询营养成分失败',
    data: response.data?.data || response.data,
    error: response.error || response.data?.error,
  };

  if (isJson) {
    outputResult(res, true);
  } else {
    if (res.success) {
      console.log(`${pc.green('✔')} ${pc.bold(`餐品营养成分列表 [${keyword || '全部'}]`)}`);
      console.log(pc.gray('────────────────────────────────────────────'));
      console.log(JSON.stringify(res.data, null, 2));
      console.log(pc.gray('────────────────────────────────────────────'));
    } else {
      outputResult(res, false);
    }
  }

  return res;
}

export async function handleQuickCalendar(
  month?: string,
  options: { json?: boolean } = {}
): Promise<CliResult> {
  const isJson = Boolean(options.json);
  const query = month ? `?month=${encodeURIComponent(month)}` : '';
  const response = await apiRequest(`/api/tools/quick/calendar${query}`);

  const res: CliResult = {
    success: response.ok && (response.data?.success !== false),
    command: 'calendar',
    message: response.ok ? `查询活动日历成功 [${month || '当月'}]` : '查询活动日历失败',
    data: response.data?.data || response.data,
    error: response.error || response.data?.error,
  };

  if (isJson) {
    outputResult(res, true);
  } else {
    if (res.success) {
      console.log(`${pc.green('✔')} ${pc.bold(`活动日历 [${month || '当月'}]`)}`);
      console.log(pc.gray('────────────────────────────────────────────'));
      console.log(JSON.stringify(res.data, null, 2));
      console.log(pc.gray('────────────────────────────────────────────'));
    } else {
      outputResult(res, false);
    }
  }

  return res;
}
