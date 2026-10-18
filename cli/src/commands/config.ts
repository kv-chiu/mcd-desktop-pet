import pc from 'picocolors';
import { apiRequest } from '../utils/http.js';
import { outputResult } from '../utils/output.js';
import type { CliResult } from '../types.js';

export async function handleGetConfig(options: { json?: boolean } = {}): Promise<CliResult> {
  const isJson = Boolean(options.json);
  const response = await apiRequest('/api/config');

  const res: CliResult = {
    success: response.ok,
    command: 'config:get',
    message: response.ok ? '获取配置成功' : '获取配置失败',
    data: response.data?.data,
    error: response.error,
  };

  if (isJson) {
    outputResult(res, true);
  } else {
    if (response.ok && response.data?.data) {
      const cfg = response.data.data;
      console.log('\n' + pc.bold(pc.yellow('⚙️ 麦当劳桌宠系统配置')));
      console.log(pc.gray('────────────────────────────────────────────'));
      console.log(`${pc.bold('MCP Token:')}        ${cfg.hasToken ? pc.green(`已配置 (${cfg.token})`) : pc.red('未配置')}`);
      console.log(`${pc.bold('服务端口 (Port):')}   ${cfg.port}`);
      console.log(`${pc.bold('网关地址 (MCP):')}    ${cfg.mcpEndpoint || '默认'}`);
      console.log(pc.gray('────────────────────────────────────────────\n'));
    } else {
      outputResult(res, false);
    }
  }

  return res;
}

export async function handleSetToken(token: string, options: { json?: boolean } = {}): Promise<CliResult> {
  const isJson = Boolean(options.json);

  if (!token || !token.trim()) {
    const res: CliResult = {
      success: false,
      command: 'config:set-token',
      message: '请提供有效的 Token',
    };
    outputResult(res, isJson);
    return res;
  }

  const response = await apiRequest('/api/config', {
    method: 'POST',
    body: JSON.stringify({ token: token.trim() }),
  });

  const res: CliResult = {
    success: response.ok,
    command: 'config:set-token',
    message: response.ok ? 'MCP Token 配置已保存更新' : 'Token 配置保存失败',
    data: response.data,
    error: response.error,
  };

  outputResult(res, isJson);
  return res;
}
