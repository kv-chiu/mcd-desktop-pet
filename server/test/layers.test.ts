import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateToolLayers } from '@mcd/shared';
import { mcpGateway } from '../src/mcp/client.js';
import { wsHub } from '../src/ws/hub.js';
import app from '../src/index.js';

test('【分层状态与业务驱动反馈测试】', async (t) => {
  // 收集桌宠收到的事件广播
  const emittedPetActions: Array<{ action: string; speech?: string }> = [];
  const originalEmitPetAction = wsHub.emitPetAction.bind(wsHub);
  wsHub.emitPetAction = (action, options) => {
    emittedPetActions.push({ action, speech: options?.speech });
    originalEmitPetAction(action, options);
  };

  await t.test('1. 模拟工具返回 result.isError: true，文本“优惠券领取失败”', async () => {
    emittedPetActions.length = 0;

    // 发起 HTTP POST 请求到 /api/tools/auto-bind-coupons，带上模拟头
    const res = await app.request('/api/tools/auto-bind-coupons', {
      method: 'POST',
      headers: {
        'x-mock-scenario': 'coupon-tool-error',
        'Content-Type': 'application/json',
      },
    });

    // 1. 传输层状态验证
    assert.equal(res.status, 200, '传输层状态码仍为 HTTP 200 (网络通信成功)');

    const body = await res.json();

    // 2. 综合业务状态与分层验证
    assert.equal(body.success, false, '工具或业务失败时，顶级 success 必须为 false (不得误标为 true)');
    assert.ok(body.layers, '响应中必须包含四层状态模型 (layers)');

    // 传输层
    assert.equal(body.layers.transport.success, true, '四层之[传输层]: 成功');
    assert.equal(body.layers.transport.status, 200);

    // JSON-RPC 层
    assert.equal(body.layers.rpc.success, true, '四层之[JSON-RPC层]: 成功通信，无RPC级语法/解析错误');

    // 工具执行层
    assert.equal(body.layers.tool.success, false, '四层之[工具执行层]: 失败 (因为 result.isError 为 true)');
    assert.equal(body.layers.tool.isError, true, '四层之[工具执行层]: isError 标为 true');

    // 业务层
    assert.equal(body.layers.business.outcome, 'failure', '四层之[业务层]: 业务判定为 failure');
    assert.match(body.layers.business.summary, /优惠券领取失败/);

    // 3. 桌宠事件验证：核心规范【成功反馈只能由实际业务结果驱动】
    assert.ok(
      !emittedPetActions.some((e) => e.speech?.includes('优惠券已全部为您自动领取好啦')),
      '桌宠事件【绝不得】收到“优惠券已全部……领取好啦”的庆祝广播！'
    );
    assert.ok(
      !emittedPetActions.some((e) => e.action === 'jump'),
      '桌宠事件【绝不得】触发跳跃庆祝动作！'
    );

    // 验证桌宠给出的是失败/提醒反馈
    const failureSpeech = emittedPetActions.find((e) => e.speech?.includes('优惠券领取遇到问题'));
    assert.ok(failureSpeech, '桌宠应收到如实的失败/异常提示信息');
  });

  await t.test('2. 模拟业务部分成功（例如成功 2 张，失败 1 张）', async () => {
    emittedPetActions.length = 0;

    const res = await app.request('/api/tools/auto-bind-coupons', {
      method: 'POST',
      headers: {
        'x-mock-scenario': 'coupon-partial',
        'Content-Type': 'application/json',
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.equal(body.partial, true, '部分成功标识 partial 必须为 true');
    assert.equal(body.layers.transport.success, true);
    assert.equal(body.layers.rpc.success, true);
    assert.equal(body.layers.tool.success, true);
    assert.equal(body.layers.business.outcome, 'partial_success', '业务层必须识别为 partial_success');
    assert.equal(body.layers.business.successCount, 2);
    assert.equal(body.layers.business.failCount, 1);

    // 桌宠事件验证：绝不夸大为全部成功
    assert.ok(
      !emittedPetActions.some((e) => e.speech?.includes('已全部为您自动领取好啦')),
      '部分成功时桌宠绝不得宣称“全部领取好啦”'
    );
    const partialNotice = emittedPetActions.find((e) => e.speech?.includes('2 张优惠券') && e.speech?.includes('1 张未成功'));
    assert.ok(partialNotice, '桌宠应准确播报部分成功数量 (成功 2 张，1 张未成功)');
    assert.equal(partialNotice.action, 'wave');
  });

  await t.test('3. 模拟业务完全成功（例如成功 3 张，失败 0 张）', async () => {
    emittedPetActions.length = 0;

    const res = await app.request('/api/tools/auto-bind-coupons', {
      method: 'POST',
      headers: {
        'x-mock-scenario': 'coupon-full-success',
        'Content-Type': 'application/json',
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.success, true);
    assert.equal(body.partial, false);
    assert.equal(body.layers.business.outcome, 'full_success', '业务层必须判定为 full_success');
    assert.equal(body.layers.business.successCount, 3);
    assert.equal(body.layers.business.failCount, 0);

    // 此时驱动桌宠庆祝
    const celebration = emittedPetActions.find((e) => e.speech?.includes('优惠券已全部为您自动领取好啦！🎉'));
    assert.ok(celebration, '只有在实际业务完全成功时，才驱动庆祝跳跃与全成播报！');
    assert.equal(celebration.action, 'jump');
  });

  await t.test('4. 模拟业务全部失败（例如成功 0 张，失败 2 张）', async () => {
    emittedPetActions.length = 0;

    const res = await app.request('/api/tools/auto-bind-coupons', {
      method: 'POST',
      headers: {
        'x-mock-scenario': 'coupon-biz-failure',
        'Content-Type': 'application/json',
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.success, false, '业务全部失败时，success 应为 false');
    assert.equal(body.layers.business.outcome, 'failure');
    assert.equal(body.layers.tool.success, true, '虽然工具本身没有抛异常崩溃，但业务结果为 failure');

    assert.ok(
      !emittedPetActions.some((e) => e.speech?.includes('优惠券已全部为您自动领取好啦')),
      '业务全部失败时绝不得触发全部领取好啦'
    );
  });

  await t.test('5. 模拟 JSON-RPC 协议层错误', async () => {
    emittedPetActions.length = 0;

    const res = await app.request('/api/tools/auto-bind-coupons', {
      method: 'POST',
      headers: {
        'x-mock-scenario': 'rpc-error',
        'Content-Type': 'application/json',
      },
    });

    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.layers.transport.success, true);
    assert.equal(body.layers.rpc.success, false, 'JSON-RPC 层应判定为失败');
    assert.equal(body.layers.tool.success, false);
    assert.equal(body.layers.business.outcome, 'failure');
    assert.ok(!emittedPetActions.some((e) => e.action === 'jump'));
  });

  await t.test('6. 模拟传输层网络连接错误', async () => {
    emittedPetActions.length = 0;

    const res = await app.request('/api/tools/auto-bind-coupons', {
      method: 'POST',
      headers: {
        'x-mock-scenario': 'transport-error',
        'Content-Type': 'application/json',
      },
    });

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.layers.transport.success, false, '传输层应判定为失败');
    assert.equal(body.layers.rpc.success, false);
    assert.ok(!emittedPetActions.some((e) => e.action === 'jump'));
  });

  await t.test('7. 快捷接口 /api/tools/quick/auto-bind 的业务驱动检验', async () => {
    emittedPetActions.length = 0;

    const res = await app.request('/api/tools/quick/auto-bind', {
      method: 'POST',
      headers: {
        'x-mock-scenario': 'coupon-tool-error',
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, false, '快捷接口同样必须区分并返回 false');
    assert.equal(body.layers.tool.isError, true);
    assert.equal(body.layers.business.outcome, 'failure');
    assert.ok(!emittedPetActions.some((e) => e.speech?.includes('优惠券已全部为您自动领取好啦')));
    assert.ok(!emittedPetActions.some((e) => e.speech?.includes('一键领入卡包')));
  });

  // 恢复
  wsHub.emitPetAction = originalEmitPetAction;
});
