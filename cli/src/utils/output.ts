import pc from 'picocolors';
import type { CliResult, HealthResponse, ServerProcessInfo } from '../types.js';

export function outputResult<T>(result: CliResult<T>, isJson = false): void {
  if (isJson) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success) {
    console.log(`${pc.green('✔')} ${pc.bold(result.message)}`);
  } else {
    console.error(`${pc.red('✖')} ${pc.bold(result.message)}`);
    if (result.error) {
      console.error(pc.red(`  详情: ${result.error}`));
    }
  }
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) {
    return `${mins} 分 ${secs} 秒`;
  }
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours} 小时 ${remainingMins} 分 ${secs} 秒`;
}

export function printStatusCard(params: {
  running: boolean;
  pidInfo?: ServerProcessInfo | null;
  health?: HealthResponse | null;
  port: number;
  logFile: string;
}): void {
  const { running, pidInfo, health, port, logFile } = params;

  console.log('\n' + pc.bold(pc.yellow('🍔 麦当劳桌宠中枢服务 (MCD Pet Server)')));
  console.log(pc.gray('────────────────────────────────────────────'));

  if (running) {
    console.log(`${pc.bold('状态 (Status):')}      ${pc.green('🟢 运行中 (Running)')}`);
    if (pidInfo?.pid) {
      console.log(`${pc.bold('进程 (PID):')}         ${pc.cyan(String(pidInfo.pid))}`);
    }
    console.log(`${pc.bold('监听端口 (Port):')}    ${pc.cyan(String(port))}`);

    if (health) {
      console.log(`${pc.bold('运行时长 (Uptime):')}  ${formatUptime(health.uptimeSeconds)}`);
      const ws = health.websocket;
      console.log(
        `${pc.bold('WebSocket 连接:')}   ${ws.total} (桌宠: ${ws.desktop}, 控制台: ${ws.web}, 其他: ${ws.other})`
      );
      const mcpTokenStr = health.mcp.hasToken ? pc.green('已配置') : pc.yellow('未配置');
      const mcpSessionStr = health.mcp.hasActiveSession ? pc.green('活跃') : pc.gray('无活跃会话');
      console.log(`${pc.bold('MCP 状态:')}          Token: ${mcpTokenStr} | 会话: ${mcpSessionStr}`);
    } else {
      console.log(
        `${pc.bold('HTTP 状态:')}        ${pc.yellow('⚠️ 进程存活但 HTTP 健康检查无响应')}`
      );
    }

    console.log(`${pc.bold('HTTP API 地址:')}     ${pc.underline(`http://localhost:${port}`)}`);
    console.log(`${pc.bold('WebSocket 地址:')}    ${pc.underline(`ws://localhost:${port}/ws`)}`);
    console.log(`${pc.bold('日志路径 (Log):')}     ${pc.gray(logFile)}`);
  } else {
    console.log(`${pc.bold('状态 (Status):')}      ${pc.red('🔴 未运行 (Stopped)')}`);
    console.log(`${pc.bold('默认端口 (Port):')}    ${port}`);
    console.log(pc.gray(`\n提示: 可使用 ${pc.cyan('mcd start')} 命令启动中枢服务。`));
  }

  console.log(pc.gray('────────────────────────────────────────────\n'));
}
