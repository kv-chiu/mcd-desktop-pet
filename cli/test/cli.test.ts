import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { isPidRunning, readPidFile, writePidFile, removePidFile } from '../src/utils/process.js';
import { readConfigPort, getPidFilePath } from '../src/utils/paths.js';
import { startServer, stopServer, restartServer, showServerStatus } from '../src/commands/server.js';

describe('【CLI 核心工具函数单元测试】', () => {
  test('1. isPidRunning 准确检测当前运行进程与不存在的进程', () => {
    assert.equal(isPidRunning(process.pid), true);
    assert.equal(isPidRunning(99999999), false);
    assert.equal(isPidRunning(0), false);
    assert.equal(isPidRunning(-1), false);
  });

  test('2. readConfigPort 能够获取默认或已配置端口', () => {
    const port = readConfigPort();
    assert.equal(typeof port, 'number');
    assert.ok(port > 0 && port <= 65535);
  });

  test('3. PID 文件写入、读取与清理生命周期', () => {
    // 备份原有 PID (如果有)
    const originalPid = readPidFile();

    const mockInfo = {
      pid: process.pid,
      port: 9999,
      startTime: new Date().toISOString(),
      entryScript: '/mock/entry.js',
    };

    writePidFile(mockInfo);
    const read = readPidFile();
    assert.ok(read);
    assert.equal(read.pid, process.pid);
    assert.equal(read.port, 9999);

    removePidFile();
    assert.equal(readPidFile(), null);

    // 恢复原有 PID
    if (originalPid) {
      writePidFile(originalPid);
    }
  });
});

describe('【CLI 服务启停集成测试】', () => {
  const TEST_PORT = 3199;

  after(async () => {
    // 确保测试结束清理测试端口服务
    await stopServer({ force: true, silent: true });
  });

  test('1. 输入无效端口应返回失败结果', async () => {
    const res = await startServer({ port: -5, silent: true });
    assert.equal(res.success, false);
    assert.match(res.message, /无效的端口号/);
  });

  test('2. 正常启动后台守护服务 (start)', async () => {
    // 确保前置停止
    await stopServer({ force: true, silent: true });

    const startRes = await startServer({ port: TEST_PORT, silent: true });
    assert.equal(startRes.success, true);
    assert.ok(startRes.data);
    const pid = (startRes.data as any).pid;
    assert.ok(pid > 0);
    assert.equal(isPidRunning(pid), true);

    // 查看状态
    const statusRes = await showServerStatus({ port: TEST_PORT, json: true, silent: true });
    assert.equal(statusRes.success, true);
    assert.equal((statusRes.data as any)?.running, true);
  });

  test('3. 重复执行 start 命令应提示服务已在运行 (幂等性)', async () => {
    const duplicateRes = await startServer({ port: TEST_PORT, silent: true });
    assert.equal(duplicateRes.success, true);
    assert.match(duplicateRes.message, /已在运行中/);
  });

  test('4. 执行 restart 命令应平滑重启服务', async () => {
    const prevPid = readPidFile()?.pid;
    assert.ok(prevPid);

    const restartRes = await restartServer({ port: TEST_PORT, silent: true });
    assert.equal(restartRes.success, true);
    assert.equal(restartRes.command, 'restart');

    const newPid = (restartRes.data as any)?.pid;
    assert.ok(newPid > 0);
    assert.equal(isPidRunning(newPid), true);
  });

  test('5. 执行 stop 命令正常关闭服务并清理 PID', async () => {
    const stopRes = await stopServer({ timeout: 5, silent: true });
    assert.equal(stopRes.success, true);
    assert.match(stopRes.message, /已成功停止/);

    // 确认 PID 文件已清理
    assert.equal(readPidFile(), null);

    // 确认状态为未运行
    const statusRes = await showServerStatus({ port: TEST_PORT, json: true, silent: true });
    assert.equal((statusRes.data as any)?.running, false);
  });

  test('6. 服务未运行时执行 stop 命令仍友好响应', async () => {
    const stopAgainRes = await stopServer({ silent: true });
    assert.equal(stopAgainRes.success, true);
    assert.match(stopAgainRes.message, /未在运行/);
  });
});
