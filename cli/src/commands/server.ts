import fs from 'node:fs';
import { spawn } from 'node:child_process';
import {
  findServerEntry,
  getLogFilePath,
  readConfigPort,
} from '../utils/paths.js';
import {
  isPidRunning,
  readPidFile,
  removePidFile,
  sleep,
  tailFile,
  writePidFile,
} from '../utils/process.js';
import { checkServerHealth } from '../utils/http.js';
import { outputResult, printStatusCard } from '../utils/output.js';
import type {
  CliResult,
  LogsOptions,
  RestartOptions,
  StartOptions,
  StatusOptions,
  StopOptions,
} from '../types.js';

export async function startServer(options: StartOptions = {}): Promise<CliResult> {
  const isJson = Boolean(options.json);
  const port = options.port ? Number(options.port) : readConfigPort();

  if (isNaN(port) || port <= 0 || port > 65535) {
    const res: CliResult = {
      success: false,
      command: 'start',
      message: `无效的端口号: ${options.port}`,
    };
    if (!options.silent) outputResult(res, isJson);
    return res;
  }

  // 1. 检查是否已有运行中的进程
  const existingPid = readPidFile();
  if (existingPid && isPidRunning(existingPid.pid)) {
    const health = await checkServerHealth(existingPid.port);
    const res: CliResult = {
      success: true,
      command: 'start',
      message: `中枢服务已在运行中 (PID: ${existingPid.pid}, Port: ${existingPid.port})`,
      data: {
        pid: existingPid.pid,
        port: existingPid.port,
        healthy: health.ok,
      },
    };
    if (!options.silent) outputResult(res, isJson);
    return res;
  }

  // 若 PID 文件存在但进程已死，清理残留
  if (existingPid) {
    removePidFile();
  }

  // 检查目标端口是否已被其他进程占用
  const portCheck = await checkServerHealth(port, 500);
  if (portCheck.ok) {
    const res: CliResult = {
      success: true,
      command: 'start',
      message: `端口 ${port} 已有服务在响应，可能由外部手动启动`,
      data: { port, health: portCheck.data },
    };
    if (!options.silent) outputResult(res, isJson);
    return res;
  }

  // 2. 定位 server 入口文件
  const location = findServerEntry();
  if (!location) {
    const res: CliResult = {
      success: false,
      command: 'start',
      message: '未找到 server 服务入口文件 (server/dist/index.js 或 server/src/index.ts)',
      error: '请确认在项目根目录下执行，或配置 MCD_SERVER_DIR 环境变量',
    };
    if (!options.silent) outputResult(res, isJson);
    return res;
  }

  // 3. 前台运行模式
  if (options.foreground) {
    if (!isJson) {
      console.log(`以[前台模式]启动中枢服务 (Port: ${port})... 按 Ctrl+C 退出\n`);
    }

    const cmd = location.isTypeScript ? 'npx' : process.execPath;
    const args = location.isTypeScript ? ['tsx', location.entryScript] : [location.entryScript];

    const child = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: location.serverDir,
      env: {
        ...process.env,
        PORT: String(port),
      },
    });

    writePidFile({
      pid: child.pid!,
      port,
      startTime: new Date().toISOString(),
      entryScript: location.entryScript,
    });

    const cleanup = () => {
      removePidFile();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    return new Promise((resolve) => {
      child.on('exit', (code) => {
        removePidFile();
        resolve({
          success: code === 0,
          command: 'start',
          message: `前台服务已退出，退出码: ${code}`,
        });
      });
    });
  }

  // 4. 后台守护进程模式 (Daemon)
  const logFile = getLogFilePath();
  const logFd = fs.openSync(logFile, 'a');

  const cmd = location.isTypeScript ? 'npx' : process.execPath;
  const args = location.isTypeScript ? ['tsx', location.entryScript] : [location.entryScript];

  const child = spawn(cmd, args, {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    cwd: location.serverDir,
    env: {
      ...process.env,
      PORT: String(port),
    },
  });

  const pid = child.pid!;
  child.unref();
  fs.closeSync(logFd);

  // 记录 PID 信息
  writePidFile({
    pid,
    port,
    startTime: new Date().toISOString(),
    entryScript: location.entryScript,
  });

  // 5. 轮询健康检查，验证进程是否启动成功 (最长约 4 秒)
  let isReady = false;
  let hasDied = false;

  for (let i = 0; i < 12; i++) {
    await sleep(300);

    if (!isPidRunning(pid)) {
      hasDied = true;
      break;
    }

    const health = await checkServerHealth(port, 400);
    if (health.ok) {
      isReady = true;
      break;
    }
  }

  if (hasDied) {
    removePidFile();
    const recentLogs = tailFile(logFile, 15).join('\n');
    const res: CliResult = {
      success: false,
      command: 'start',
      message: '中枢服务启动后异常退出',
      error: recentLogs || '未能获取到错误日志，请检查端口是否被占用',
    };
    if (!options.silent) outputResult(res, isJson);
    return res;
  }

  const res: CliResult = {
    success: true,
    command: 'start',
    message: isReady
      ? `麦当劳桌宠中枢服务已启动就绪 (PID: ${pid}, Port: ${port})`
      : `麦当劳桌宠中枢服务进程已创建 (PID: ${pid}, Port: ${port})，等待监听就绪`,
    data: {
      pid,
      port,
      ready: isReady,
      api: `http://localhost:${port}`,
      ws: `ws://localhost:${port}/ws`,
      logFile,
    },
  };

  if (!options.silent) outputResult(res, isJson);
  return res;
}

export async function stopServer(options: StopOptions = {}): Promise<CliResult> {
  const isJson = Boolean(options.json);
  const force = Boolean(options.force);
  const timeoutSec = options.timeout ? Number(options.timeout) : 5;

  const pidInfo = readPidFile();

  if (!pidInfo) {
    const res: CliResult = {
      success: true,
      command: 'stop',
      message: '中枢服务未在运行 (Server is not running)',
    };
    if (!options.silent) outputResult(res, isJson);
    return res;
  }

  const pid = pidInfo.pid;

  if (!isPidRunning(pid)) {
    removePidFile();
    const res: CliResult = {
      success: true,
      command: 'stop',
      message: '中枢服务未在运行 (已清理残留的过期 PID 文件)',
      data: { cleanedPid: pid },
    };
    if (!options.silent) outputResult(res, isJson);
    return res;
  }

  // 执行终止
  if (force) {
    try {
      process.kill(pid, 'SIGKILL');
    } catch (e: any) {
      if (e.code !== 'ESRCH') throw e;
    }
    removePidFile();
    const res: CliResult = {
      success: true,
      command: 'stop',
      message: `已强制终止中枢服务进程 (PID: ${pid})`,
      data: { pid, forced: true },
    };
    if (!options.silent) outputResult(res, isJson);
    return res;
  }

  // 正常优雅终止 (SIGTERM)
  try {
    process.kill(pid, 'SIGTERM');
  } catch (e: any) {
    if (e.code === 'ESRCH') {
      removePidFile();
      const res: CliResult = {
        success: true,
        command: 'stop',
        message: '中枢服务已退出',
      };
      if (!options.silent) outputResult(res, isJson);
      return res;
    }
  }

  // 等待进程退出
  const startTime = Date.now();
  let stopped = false;

  while (Date.now() - startTime < timeoutSec * 1000) {
    await sleep(200);
    if (!isPidRunning(pid)) {
      stopped = true;
      break;
    }
  }

  if (!stopped) {
    // 超时强制杀死
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // ignore
    }
    removePidFile();
    const res: CliResult = {
      success: true,
      command: 'stop',
      message: `中枢服务未在 ${timeoutSec} 秒内正常退出，已强制终止 (PID: ${pid})`,
      data: { pid, forced: true },
    };
    if (!options.silent) outputResult(res, isJson);
    return res;
  }

  removePidFile();
  const res: CliResult = {
    success: true,
    command: 'stop',
    message: `中枢服务已成功停止 (PID: ${pid})`,
    data: { pid },
  };
  if (!options.silent) outputResult(res, isJson);
  return res;
}

export async function restartServer(options: RestartOptions = {}): Promise<CliResult> {
  const isJson = Boolean(options.json);

  if (!isJson && !options.silent) {
    console.log('正在重启麦当劳桌宠中枢服务...');
  }

  // 1. 停止旧服务
  await stopServer({
    force: options.force,
    timeout: options.timeout,
    silent: true,
  });

  // 稍作停顿，等待端口释放
  await sleep(600);

  // 2. 启动新服务
  const startRes = await startServer({
    port: options.port,
    silent: true,
  });

  const res: CliResult = {
    ...startRes,
    command: 'restart',
    message: startRes.success
      ? `麦当劳桌宠中枢服务已重启就绪 (PID: ${(startRes.data as any)?.pid}, Port: ${(startRes.data as any)?.port})`
      : startRes.message,
  };

  if (!options.silent) outputResult(res, isJson);
  return res;
}

export async function showServerStatus(options: StatusOptions = {}): Promise<CliResult> {
  const isJson = Boolean(options.json);
  const defaultPort = readConfigPort();
  const pidInfo = readPidFile();
  const port = options.port ? Number(options.port) : pidInfo?.port || defaultPort;
  const logFile = getLogFilePath();

  const isRunning = Boolean(pidInfo && isPidRunning(pidInfo.pid));

  if (!isRunning && pidInfo) {
    // 清理无效 PID 文件
    removePidFile();
  }

  // 尝试健康检查
  const healthRes = await checkServerHealth(port, 1000);

  if (isJson) {
    const res: CliResult = {
      success: true,
      command: 'status',
      message: isRunning || healthRes.ok ? '服务正在运行' : '服务未运行',
      data: {
        running: isRunning || healthRes.ok,
        pid: pidInfo?.pid || null,
        port,
        healthy: healthRes.ok,
        health: healthRes.data || null,
        logFile,
      },
    };
    if (!options.silent) outputResult(res, true);
    return res;
  }

  if (!options.silent) {
    printStatusCard({
      running: isRunning || healthRes.ok,
      pidInfo: isRunning ? pidInfo : null,
      health: healthRes.data || null,
      port,
      logFile,
    });
  }

  return {
    success: true,
    command: 'status',
    message: isRunning || healthRes.ok ? '服务正在运行' : '服务未运行',
  };
}

export async function showServerLogs(options: LogsOptions = {}): Promise<void> {
  const logFile = getLogFilePath();
  const linesCount = options.lines ? Number(options.lines) : 30;

  if (!fs.existsSync(logFile)) {
    console.log(`暂无日志文件: ${logFile}`);
    return;
  }

  const lines = tailFile(logFile, linesCount);
  console.log(`\n--- 日志最新 ${lines.length} 行 (${logFile}) ---`);
  console.log(lines.join('\n'));
  console.log('--- 日志末尾 ---\n');

  if (options.follow) {
    console.log('持续监听日志输出 (按 Ctrl+C 退出)...');
    let fileSize = fs.statSync(logFile).size;

    const interval = setInterval(() => {
      try {
        const currentStat = fs.statSync(logFile);
        if (currentStat.size > fileSize) {
          const stream = fs.createReadStream(logFile, {
            start: fileSize,
            end: currentStat.size,
            encoding: 'utf-8',
          });
          stream.on('data', (chunk) => process.stdout.write(chunk));
          fileSize = currentStat.size;
        }
      } catch {
        // file could be truncated or rotated
      }
    }, 500);

    process.on('SIGINT', () => {
      clearInterval(interval);
      process.exit(0);
    });
  }
}
