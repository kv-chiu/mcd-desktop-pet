#!/usr/bin/env node

import { Command } from 'commander';
import {
  startServer,
  stopServer,
  restartServer,
  showServerStatus,
  showServerLogs,
} from './commands/server.js';
import {
  handlePetAction,
  handlePetSpeak,
  handlePetInteract,
  handlePetState,
} from './commands/pet.js';
import {
  handleListTools,
  handleExecuteTool,
  handleQuickCoupons,
  handleQuickAutoBind,
  handleQuickNutrition,
  handleQuickCalendar,
} from './commands/tools.js';
import {
  handleGetConfig,
  handleSetToken,
} from './commands/config.js';
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
  .description('🍔 麦当劳桌宠命令行工具 (McDonald\'s Desktop Pet CLI) - 桌面宠物与 MCP 工具统一控制中枢')
  .version('0.1.0');


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


const petCmd = program
  .command('pet [action]')
  .description('操控桌面宠物动作 (wave, jump, idle, speak) 与气泡对话')
  .option('-s, --speech <text>', '伴随动作显示的气泡文字')
  .option('-d, --duration <seconds>', '动作/气泡持续时间（秒）', '3.0')
  .option('--json', '以结构化 JSON 格式输出结果')
  .action(async (action = 'wave', options) => {
    await handlePetAction(action, options);
  });

petCmd
  .command('speak <text>')
  .description('让桌宠弹出说话气泡')
  .option('-d, --duration <seconds>', '气泡停留时间（秒）', '4.0')
  .option('--json', '以结构化 JSON 格式输出结果')
  .action(async (text, options) => {
    await handlePetSpeak(text, options);
  });

petCmd
  .command('interact')
  .description('与桌宠进行亲密互动 (抚摸并提升好感度)')
  .option('--json', '以结构化 JSON 格式输出结果')
  .action(async (options) => {
    await handlePetInteract(options);
  });

petCmd
  .command('state')
  .description('查看桌宠当前好感度、心情与等级')
  .option('--json', '以结构化 JSON 格式输出结果')
  .action(async (options) => {
    await handlePetState(options);
  });

program
  .command('speak <text>')
  .description('让桌宠弹出说话气泡 (快捷指令)')
  .option('-d, --duration <seconds>', '气泡停留时间（秒）', '4.0')
  .option('--json', '以结构化 JSON 格式输出')
  .action(async (text, options) => {
    await handlePetSpeak(text, options);
  });

program
  .command('interact')
  .description('与桌宠互动 (抚摸并提升好感度)')
  .option('--json', '以结构化 JSON 格式输出')
  .action(async (options) => {
    await handlePetInteract(options);
  });


const couponCmd = program
  .command('coupon')
  .description('麦当劳优惠券管理命令组 (查看可用券、一键自动领券)');

couponCmd
  .command('list')
  .description('查询当前账户可用的优惠券列表')
  .option('--json', '以结构化 JSON 格式输出')
  .action(async (options) => {
    await handleQuickCoupons(options);
  });

couponCmd
  .command('auto-bind')
  .description('一键自动领取/绑定所有可领取的优惠券')
  .option('--json', '以结构化 JSON 格式输出')
  .action(async (options) => {
    await handleQuickAutoBind(options);
  });


program
  .command('nutrition [keyword]')
  .description('查询麦当劳餐品营养成分与热量数据 (例如: mcd nutrition 巨无霸)')
  .option('--json', '以结构化 JSON 格式输出')
  .action(async (keyword, options) => {
    await handleQuickNutrition(keyword, options);
  });

program
  .command('calendar [month]')
  .description('查询麦当劳官方当月活动日历 (例如: mcd calendar 2026-10)')
  .option('--json', '以结构化 JSON 格式输出')
  .action(async (month, options) => {
    await handleQuickCalendar(month, options);
  });


program
  .command('tools')
  .description('查询麦当劳 33 项官方 MCP 工具清单与参数定义')
  .option('--json', '以结构化 JSON 格式输出')
  .action(async (options) => {
    await handleListTools(options);
  });

program
  .command('tool <name> [params]')
  .description('执行指定的 MCP 工具 (例如: mcd tool list-nutrition-foods \'{"keyword":"汉堡"}\')')
  .option('--json', '以结构化 JSON 格式输出')
  .action(async (name, params, options) => {
    await handleExecuteTool(name, params, options);
  });


const configCmd = program
  .command('config')
  .description('桌宠与 MCP 服务配置管理');

configCmd
  .command('get')
  .description('查看当前配置')
  .option('--json', '以结构化 JSON 格式输出')
  .action(async (options) => {
    await handleGetConfig(options);
  });

configCmd
  .command('set-token <token>')
  .description('设置麦当劳 MCP Authorization Token')
  .option('--json', '以结构化 JSON 格式输出')
  .action(async (token, options) => {
    await handleSetToken(token, options);
  });


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

program.parse(process.argv);
