import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { storage } from '../src/storage/index.js';
import { wsHub } from '../src/ws/hub.js';
import { mcpGateway } from '../src/mcp/client.js';
import app from '../src/index.js';

test('【Storage 持久化写入异常与一致性测试】', async (t) => {
  // 创建独立的临时测试目录隔离真实用户环境
  const testDir = path.join(os.tmpdir(), `mcd_test_storage_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  fs.mkdirSync(testDir, { recursive: true });

  const originalBaseDir = storage.getBaseDir();
  storage.setBaseDir(testDir);

  // 初始化基础配置与状态
  storage.saveConfig({ petName: '初始麦麦宝', token: 'initial_token_123456' });
  storage.updatePetState({ favor: 50, experience: 0, currentAction: 'idle' });

  // 监听并收集 WebSocket 广播消息（实际送出到底层的 broadcast）
  const emittedBroadcasts: Array<{ type: string; payload?: any }> = [];

  const originalBroadcast = wsHub.broadcast.bind(wsHub);
  wsHub.broadcast = (msg, excludeClient) => {
    emittedBroadcasts.push(msg);
    originalBroadcast(msg, excludeClient);
  };

  t.after(() => {
    // 恢复现场
    wsHub.broadcast = originalBroadcast;
    storage.setBaseDir(originalBaseDir);
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  await t.test('1. 模拟磁盘写入异常：saveConfig 抛出错误，POST /api/config 必须返回 500 且拒绝虚假成功', async () => {
    const originalWriteFileSync = fs.writeFileSync;
    let writeFailed = false;

    // 劫持 fs.writeFileSync 模拟磁盘异常
    fs.writeFileSync = ((filePath: any, data: any, options: any) => {
      if (typeof filePath === 'string' && filePath.includes('config.json')) {
        writeFailed = true;
        throw new Error('EACCES: permission denied, simulated disk failure');
      }
      return originalWriteFileSync(filePath, data, options);
    }) as any;

    try {
      // 记录调用前 session ID
      let resetCalled = false;
      const originalResetSession = mcpGateway.resetSession.bind(mcpGateway);
      mcpGateway.resetSession = () => {
        resetCalled = true;
        originalResetSession();
      };

      const res = await app.request('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          petName: '错误修改的新名称',
          token: 'new_token_fail',
        }),
      });

      mcpGateway.resetSession = originalResetSession;

      // 验证返回状态码为 500
      assert.equal(res.status, 500, '磁盘写入异常时，接口状态码必须为 500，不得返回 200');

      const body = await res.json();
      assert.equal(body.success, false, '响应体中 success 必须为 false');
      assert.match(body.error, /保存配置失败/, '应包含清晰的保存失败错误信息');
      assert.equal(resetCalled, false, '磁盘保存失败时，严禁提前重置/更新 MCP Gateway 会话');

      // 验证磁盘上的真实配置仍为旧名称
      fs.writeFileSync = originalWriteFileSync;
      const currentConfig = storage.getConfig();
      assert.equal(currentConfig.petName, '初始麦麦宝', '磁盘上的配置必须保持原样，不被脏内存污染');
      assert.equal(writeFailed, true, '确保触发了模拟写入异常');
    } finally {
      fs.writeFileSync = originalWriteFileSync;
    }
  });

  await t.test('2. 模拟磁盘写入异常：updatePetState 抛出错误，POST /api/pet/action 必须拦截广播并返回 500', async () => {
    emittedBroadcasts.length = 0;
    const originalWriteFileSync = fs.writeFileSync;

    fs.writeFileSync = ((filePath: any, data: any, options: any) => {
      if (typeof filePath === 'string' && filePath.includes('pet_state.json')) {
        throw new Error('ENOSPC: no space left on device');
      }
      return originalWriteFileSync(filePath, data, options);
    }) as any;

    try {
      const res = await app.request('/api/pet/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'wave',
        }),
      });

      assert.equal(res.status, 500, '落盘失败时接口必须返回 500');
      const body = await res.json();
      assert.equal(body.success, false, '接口 success 必须为 false');

      // 关键断言：落盘失败严禁向桌宠客户端继续广播动作
      assert.equal(emittedBroadcasts.length, 0, '落盘失败时不得向桌宠客户端广播任何未持久化的动作');

      // 验证磁盘读取的状态动作未改变
      fs.writeFileSync = originalWriteFileSync;
      const currentState = storage.getPetState();
      assert.notEqual(currentState.currentAction, 'wave', '磁盘状态中的 currentAction 不应变为 wave');
    } finally {
      fs.writeFileSync = originalWriteFileSync;
    }
  });

  await t.test('3. 模拟磁盘写入异常：interactPet 互动持久化失败时，禁止广播状态与跳跃动作，严禁残留历史', async () => {
    emittedBroadcasts.length = 0;
    const originalWriteFileSync = fs.writeFileSync;

    fs.writeFileSync = ((filePath: any, data: any, options: any) => {
      if (typeof filePath === 'string' && (filePath.includes('pet_state.json') || filePath.includes('history.json'))) {
        throw new Error('EIO: i/o error');
      }
      return originalWriteFileSync(filePath, data, options);
    }) as any;

    try {
      const res = await app.request('/api/pet/interact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      assert.equal(res.status, 500, '互动保存失败必须返回 500');
      const body = await res.json();
      assert.equal(body.success, false, '接口 success 必须为 false');

      // 验证没有广播任何状态与跳跃动作
      assert.equal(emittedBroadcasts.length, 0, '落盘失败不得广播任何消息');

      // 恢复后验证历史没有写入这次失败的抚摸
      fs.writeFileSync = originalWriteFileSync;
      const history = storage.getHistory();
      assert.ok(
        !history.some((h) => h.summary?.includes('主人抚摸了桌宠')),
        '落盘失败时不应在历史中记录该抚摸记录'
      );
    } finally {
      fs.writeFileSync = originalWriteFileSync;
    }
  });

  await t.test('4. 模拟磁盘写入异常：recordHistory 直接抛出错误而不是仅记录日志', async () => {
    const originalWriteFileSync = fs.writeFileSync;

    fs.writeFileSync = ((filePath: any, data: any, options: any) => {
      if (typeof filePath === 'string' && filePath.includes('history.json')) {
        throw new Error('EROFS: read-only file system');
      }
      return originalWriteFileSync(filePath, data, options);
    }) as any;

    try {
      assert.throws(
        () => {
          storage.recordHistory({
            type: 'test_record',
            summary: '测试写入',
          });
        },
        /EROFS/,
        'recordHistory 在写入异常时必须抛出异常'
      );
    } finally {
      fs.writeFileSync = originalWriteFileSync;
    }
  });
});
