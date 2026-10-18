#!/usr/bin/env node

import { Command } from 'commander';
import {
  startServer,
  stopServer,
  restartServer,
  showServerStatus,
  showServerLogs,
} from './commands/server.js';
import type {
  StartOptions,
  StopOptions,
  RestartOptions,
  StatusOptions,
  LogsOptions,
} from './types.js';

const program = new Command();

program
  .name('mcd')
  .description('🍔 麦当劳桌宠命令行工具 (McDonald\'s Desktop Pet CLI) - 服务启停与 Agent 控制中枢')
  .version('1.0.0');

// ===================== 顶层服务启停快捷指令 =====================

program
  .command('start')
  .description('启动桌宠中枢服务 (默认在后台守护进程运行)')
  .option('-p, --port <port>', '指定服务监听端口 (默认读取配置或 3001)')
  .option('--foreground', '以附着在前台终端的方式运行服务')
  .option('--json', '以结构化 JSON 格式输出结果 (供 Agent/Skill 集成)')
  .action(async (options: StartOptions) => {
    await startServer(options);
  });

program
  .command('stop')
  .description('停止桌宠中枢服务')
  .option('-f, --force', '强制立即终止服务进程 (SIGKILL)')
  .option('-t, --timeout <seconds>', '等待优雅退出的超时时间（秒）', '5')
  .option('--json', '以结构化 JSON 格式输出结果')
  .action(async (options: StopOptions) => {
    await stopServer(options);
  });

program
  .command('restart')
  .description('重启桌宠中枢服务')
  .option('-p, --port <port>', '指定新服务监听端口')
  .option('-f, --force', '强制停止旧服务进程')
  .option('-t, --timeout <seconds>', '停止服务超时时间（秒）', '5')
  .option('--json', '以结构化 JSON 格式输出结果')
  .action(async (options: RestartOptions) => {
    await restartServer(options);
  });

program
  .command('status')
  .description('查看桌宠中枢服务运行状态、端口与连接信息')
  .option('-p, --port <port>', '指定要检查的端口号')
  .option('--json', '以结构化 JSON 格式输出状态信息')
  .action(async (options: StatusOptions) => {
    await showServerStatus(options);
  });

program
  .command('logs')
  .description('查看桌宠中枢服务的运行日志')
  .option('-n, --lines <number>', '输出日志末尾的行数', '30')
  .option('-f, --follow', '持续追踪最新日志输出')
  .action(async (options: LogsOptions) => {
    await showServerLogs(options);
  });

// ===================== server 命名空间分组指令 =====================

const serverGroup = program
  .command('server')
  .description('中枢服务生命周期与状态管理命令组 (start / stop / restart / status / logs)');

serverGroup
  .command('start')
  .description('启动桌宠中枢服务')
  .option('-p, --port <port>', '指定服务监听端口')
  .option('--foreground', '以附着在前台终端的方式运行服务')
  .option('--json', '以结构化 JSON 格式输出结果')
  .action(async (options: StartOptions) => {
    await startServer(options);
  });

serverGroup
  .command('stop')
  .description('停止桌宠中枢服务')
  .option('-f, --force', '强制立即终止服务进程')
  .option('-t, --timeout <seconds>', '等待优雅退出的超时时间（秒）', '5')
  .option('--json', '以结构化 JSON 格式输出结果')
  .action(async (options: StopOptions) => {
    await stopServer(options);
  });

serverGroup
  .command('restart')
  .description('重启桌宠中枢服务')
  .option('-p, --port <port>', '指定新服务监听端口')
  .option('-f, --force', '强制停止旧服务进程')
  .option('--json', '以结构化 JSON 格式输出结果')
  .action(async (options: RestartOptions) => {
    await restartServer(options);
  });

serverGroup
  .command('status')
  .description('查看中枢服务状态')
  .option('-p, --port <port>', '指定检查端口')
  .option('--json', '以结构化 JSON 格式输出')
  .action(async (options: StatusOptions) => {
    await showServerStatus(options);
  });

serverGroup
  .command('logs')
  .description('查看中枢服务日志')
  .option('-n, --lines <number>', '输出日志末尾的行数', '30')
  .option('-f, --follow', '持续追踪最新日志输出')
  .action(async (options: LogsOptions) => {
    await showServerLogs(options);
  });

// 解析命令行参数
program.parse(process.argv);
