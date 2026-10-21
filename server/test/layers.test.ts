import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { evaluateToolLayers } from '@mcd/shared';
import { storage } from '../src/storage/index.js';
import { wsHub } from '../src/ws/hub.js';
import app from '../src/index.js';

test('【分层状态与业务驱动反馈测试】', async (t) => {
  const testDir = path.join(os.tmpdir(), `mcd_test_layers_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  fs.mkdirSync(testDir, { recursive: true });

  const originalBaseDir = storage.getBaseDir();
  storage.setBaseDir(testDir);

  storage.saveConfig({ petName: '测试麦麦宝', token: 'test_token_layers_123' });
  storage.updatePetState({ favor: 60, experience: 0, currentAction: 'idle' });

  const emittedPetActions: Array<{ action: string; speech?: string }> = [];
  const originalEmitPetAction = wsHub.emitPetAction.bind(wsHub);
  wsHub.emitPetAction = (action, options) => {
    emittedPetActions.push({ action, speech: options?.speech });
  };

  t.after(() => {
    wsHub.emitPetAction = originalEmitPetAction;
    storage.setBaseDir(originalBaseDir);
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
    }
  });

  await t.test('1. 模拟工具返回 result.isError: true，文本“优惠券领取失败”', async () => {
    emittedPetActions.length = 0;

    const res = await app.request('/api/tools/auto-bind-coupons', {
      method: 'POST',
      headers: {
        'x-mock-scenario': 'coupon-tool-error',
        'Content-Type': 'application/json',
      },
    });

    assert.equal(res.status, 200, '传输层状态码仍为 HTTP 200 (网络通信成功)');

    const body = await res.json();

    assert.equal(body.success, false, '工具或业务失败时，顶级 success 必须为 false (不得误标为 true)');
    assert.ok(body.layers, '响应中必须包含四层状态模型 (layers)');

    assert.equal(body.layers.transport.success, true, '四层之[传输层]: 成功');
    assert.equal(body.layers.transport.status, 200);

    assert.equal(body.layers.rpc.success, true, '四层之[JSON-RPC层]: 成功通信，无RPC级语法/解析错误');

    assert.equal(body.layers.tool.success, false, '四层之[工具执行层]: 失败 (因为 result.isError 为 true)');
    assert.equal(body.layers.tool.isError, true, '四层之[工具执行层]: isError 标为 true');

    assert.equal(body.layers.business.outcome, 'failure', '四层之[业务层]: 业务判定为 failure');
    assert.match(body.layers.business.summary, /优惠券领取失败/);

    assert.ok(
      !emittedPetActions.some((e) => e.speech?.includes('优惠券已全部为您自动领取好啦')),
      '桌宠事件【绝不得】收到“优惠券已全部……领取好啦”的庆祝广播！'
    );
    assert.ok(
      !emittedPetActions.some((e) => e.action === 'jump'),
      '桌宠事件【绝不得】触发跳跃庆祝动作！'
    );

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

  await t.test('8. 模拟上游返回 HTTP 400 与响应体 {}：保留状态码 400，拒绝虚假 success，桌宠严禁播报“订单已创建”', async () => {
    emittedPetActions.length = 0;

    const res = await app.request('/api/tools/create-order', {
      method: 'POST',
      headers: {
        'x-mock-scenario': 'http-400-empty',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ storeId: '1001', meals: [{ id: 'm1', count: 1 }] }),
    });

    assert.equal(res.status, 400, '必须保留真实的 HTTP 400 状态码，不得误标为 200');
    const body = await res.json();

    assert.equal(body.success, false, '上游 400 时 success 必须为 false');
    assert.ok(body.layers, '必须包含四层状态');
    assert.equal(body.layers.transport.status, 400, '传输层状态码必须保留为 400');
    assert.equal(body.layers.transport.success, false, '传输层必须标为失败');
    assert.equal(body.layers.rpc.success, false, 'RPC 层必须标为失败');
    assert.equal(body.layers.tool.success, false, '工具层必须标为失败');
    assert.equal(body.layers.business.outcome, 'failure', '业务层必须判定为 failure');

    assert.ok(
      !emittedPetActions.some((e) => e.speech?.includes('订单已创建')),
      '桌宠绝不得在 400 失败时播报“订单已创建”！'
    );
  });

  await t.test('9. 模拟上游返回 HTTP 404 与响应体 {}：保留状态码 404，拒绝虚假 success，桌宠严禁播报“订单已创建”', async () => {
    emittedPetActions.length = 0;

    const res = await app.request('/api/tools/create-order', {
      method: 'POST',
      headers: {
        'x-mock-scenario': 'http-404-empty',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ storeId: '9999', meals: [{ id: 'm1', count: 1 }] }),
    });

    assert.equal(res.status, 404, '必须保留真实的 HTTP 404 状态码');
    const body = await res.json();

    assert.equal(body.success, false);
    assert.equal(body.layers.transport.status, 404);
    assert.equal(body.layers.transport.success, false);
    assert.equal(body.layers.rpc.success, false);
    assert.equal(body.layers.tool.success, false);
    assert.equal(body.layers.business.outcome, 'failure');

    assert.ok(
      !emittedPetActions.some((e) => e.speech?.includes('订单已创建')),
      '桌宠绝不得在 404 时播报“订单已创建”！'
    );
  });

  await t.test('10. 模拟上游返回 HTTP 200 但响应体为 {}（RPC/result 结构缺失）：拒绝虚假 success，桌宠严禁播报“订单已创建”', async () => {
    emittedPetActions.length = 0;

    const res = await app.request('/api/tools/create-order', {
      method: 'POST',
      headers: {
        'x-mock-scenario': 'rpc-empty-body',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ storeId: '1001' }),
    });

    const body = await res.json();
    assert.equal(body.success, false, '响应体为 {} 时缺少 RPC 结构，success 必须为 false');
    assert.equal(body.layers.transport.success, true, '传输层虽为 200');
    assert.equal(body.layers.rpc.success, false, 'RPC 层结构校验失败');
    assert.equal(body.layers.tool.success, false, '工具层未有效执行');
    assert.equal(body.layers.business.outcome, 'failure', '业务层判定为失败');

    assert.ok(
      !emittedPetActions.some((e) => e.speech?.includes('订单已创建')),
      '桌宠绝不得在响应体为空对象时误播报“订单已创建”！'
    );
  });

  await t.test('11. evaluateToolLayers 单独校验：HTTP 状态与 RPC/result 结构有效性', () => {
    const eval400 = evaluateToolLayers({
      toolName: 'create-order',
      httpStatus: 400,
      rpcResponse: {} as any,
    });
    assert.equal(eval400.transport.success, false);
    assert.equal(eval400.transport.status, 400);
    assert.equal(eval400.rpc.success, false);
    assert.equal(eval400.tool.success, false);
    assert.equal(eval400.business.outcome, 'failure');
    assert.ok(!eval400.petFeedback?.speech.includes('订单已创建'));

    const evalEmptyBody = evaluateToolLayers({
      toolName: 'create-order',
      httpStatus: 200,
      rpcResponse: {} as any,
    });
    assert.equal(evalEmptyBody.transport.success, true);
    assert.equal(evalEmptyBody.rpc.success, false);
    assert.equal(evalEmptyBody.tool.success, false);
    assert.equal(evalEmptyBody.business.outcome, 'failure');
    assert.ok(!evalEmptyBody.petFeedback?.speech.includes('订单已创建'));

    const evalNoContent = evaluateToolLayers({
      toolName: 'create-order',
      httpStatus: 200,
      rpcResponse: {
        jsonrpc: '2.0',
        id: 1,
        result: {} as any,
      },
    });
    assert.equal(evalNoContent.transport.success, true);
    assert.equal(evalNoContent.rpc.success, true);
    assert.equal(evalNoContent.tool.success, false, '缺少 content 数组时工具层应失败');
    assert.equal(evalNoContent.business.outcome, 'failure');
    assert.ok(!evalNoContent.petFeedback?.speech.includes('订单已创建'));
  });

  await t.test('12. 业务显式字段解析：工具返回 {"success":false,"message":"请先登录"} 时，严格判定为失败，严禁播报成功', async () => {
    emittedPetActions.length = 0;

    const resOrder = await app.request('/api/tools/create-order', {
      method: 'POST',
      headers: {
        'x-mock-scenario': 'login-required',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ storeId: '1001' }),
    });

    const bodyOrder = await resOrder.json();
    assert.equal(bodyOrder.success, false, '返回 {"success":false} 时顶级 success 必须为 false');
    assert.equal(bodyOrder.layers.business.outcome, 'failure', '业务层必须判定为 failure');
    assert.equal(bodyOrder.layers.business.summary, '请先登录', '业务层应提取出明确的 message 字段');
    assert.ok(
      !emittedPetActions.some((e) => e.speech?.includes('订单已创建')),
      '桌宠绝不得播报“订单已创建”！'
    );
    assert.ok(
      emittedPetActions.some((e) => e.speech?.includes('请先登录')),
      '桌宠应提示未登录'
    );

    const evalMall = evaluateToolLayers({
      toolName: 'mall-create-order',
      httpStatus: 200,
      rpcResponse: {
        jsonrpc: '2.0',
        id: 2,
        result: {
          content: [{ type: 'text', text: '{"success":false,"message":"请先登录"}' }],
          isError: false,
        },
      },
    });
    assert.equal(evalMall.business.outcome, 'failure');
    assert.equal(evalMall.business.summary, '请先登录');
    assert.ok(!evalMall.petFeedback?.speech.includes('积分商品兑换成功啦'));
    assert.equal(evalMall.petFeedback?.action, 'idle');

    const evalLottery = evaluateToolLayers({
      toolName: 'draw-lottery',
      httpStatus: 200,
      rpcResponse: {
        jsonrpc: '2.0',
        id: 3,
        result: {
          content: [{ type: 'text', text: '{"success":false,"message":"请先登录"}' }],
          isError: false,
        },
      },
    });
    assert.equal(evalLottery.business.outcome, 'failure');
    assert.equal(evalLottery.business.summary, '请先登录');
    assert.ok(!evalLottery.petFeedback?.speech.includes('抽奖完成'));
    assert.equal(evalLottery.petFeedback?.action, 'idle');

    const evalCoupon = evaluateToolLayers({
      toolName: 'auto-bind-coupons',
      httpStatus: 200,
      rpcResponse: {
        jsonrpc: '2.0',
        id: 4,
        result: {
          content: [{ type: 'text', text: '{"success":false,"message":"请先登录"}' }],
          isError: false,
        },
      },
    });
    assert.equal(evalCoupon.business.outcome, 'failure');
    assert.equal(evalCoupon.business.summary, '请先登录');
    assert.ok(!evalCoupon.petFeedback?.speech.includes('自动领取好啦'));
  });

  await t.test('13. 无法确认业务结果时保留未知状态 (unknown)：绝不误判为完全成功，严禁触发跳跃与庆祝', async () => {
    emittedPetActions.length = 0;

    const res = await app.request('/api/tools/create-order', {
      method: 'POST',
      headers: {
        'x-mock-scenario': 'unknown-unconfirmed',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ storeId: '1001' }),
    });

    const body = await res.json();
    assert.equal(body.success, false, '状态为 unknown 时顶级 success 必须为 false (不得误判为 true)');
    assert.equal(body.layers.business.outcome, 'unknown', '业务层必须保留为 unknown 状态');
    assert.ok(
      !emittedPetActions.some((e) => e.action === 'jump' || e.action === 'wave'),
      '绝不得触发庆祝动作 (jump / wave)'
    );
    assert.ok(
      !emittedPetActions.some((e) => e.speech?.includes('订单已创建')),
      '绝不得播报“订单已创建”'
    );
  });

  await t.test('14. 显式业务成功凭证解析：包含 orderId 时确认为完全成功', () => {
    const evalSuccess = evaluateToolLayers({
      toolName: 'create-order',
      httpStatus: 200,
      rpcResponse: {
        jsonrpc: '2.0',
        id: 5,
        result: {
          content: [{ type: 'text', text: '{"success":true,"orderId":"MCD20261019001","takeCode":"A102"}' }],
          isError: false,
        },
      },
    });
    assert.equal(evalSuccess.business.outcome, 'full_success');
    assert.equal(evalSuccess.petFeedback?.action, 'wave');
    assert.ok(evalSuccess.petFeedback?.speech.includes('订单已创建'));
  });

  await t.test('15. 快捷接口 /api/tools/quick/calendar 失败时（layers.tool.success=false、业务为 failure），顶层 success 必须为 false 且包含 error', async () => {
    const res = await app.request('/api/tools/quick/calendar', {
      method: 'GET',
      headers: {
        'x-mock-scenario': 'calendar-tool-error',
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, false, '日历快捷接口在工具失败时顶层 success 必须为 false');
    assert.equal(body.layers.tool.success, false);
    assert.equal(body.layers.business.outcome, 'failure');
    assert.ok(body.error, '失败时必须返回具体错误信息');
    assert.ok(body.error.includes('获取活动日历失败'));
  });

  await t.test('16. 快捷接口 /api/tools/quick/nutrition 失败时（layers.tool.success=false、业务为 failure），顶层 success 必须为 false 且包含 error', async () => {
    const res = await app.request('/api/tools/quick/nutrition?keyword=汉堡', {
      method: 'GET',
      headers: {
        'x-mock-scenario': 'nutrition-tool-error',
      },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, false, '营养快捷接口在工具失败时顶层 success 必须为 false');
    assert.equal(body.layers.tool.success, false);
    assert.equal(body.layers.business.outcome, 'failure');
    assert.ok(body.error, '失败时必须返回具体错误信息');
    assert.ok(body.error.includes('查询营养成分失败'));
  });

  await t.test('17. 快捷接口 /api/tools/quick/calendar 与 /quick/nutrition 成功时，顶层 success 为 true', async () => {
    const resCal = await app.request('/api/tools/quick/calendar', {
      method: 'GET',
      headers: {
        'x-mock-scenario': 'calendar-success',
      },
    });
    const bodyCal = await resCal.json();
    assert.equal(bodyCal.success, true);
    assert.equal(bodyCal.layers.tool.success, true);

    const resNut = await app.request('/api/tools/quick/nutrition?keyword=巨无霸', {
      method: 'GET',
      headers: {
        'x-mock-scenario': 'nutrition-success',
      },
    });
    const bodyNut = await resNut.json();
    assert.equal(bodyNut.success, true);
    assert.equal(bodyNut.layers.tool.success, true);
  });

  await t.test('18. 验证固定路由优先级：POST /api/tools/simulate 必须命中模拟处理器，不得被通配路由 /:name 遮挡误当成 simulate 工具调用', async () => {
    const res = await app.request('/api/tools/simulate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scenario: 'coupon-tool-error',
        toolName: 'auto-bind-coupons',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.scenario, 'coupon-tool-error', '响应必须包含 simulate 处理器特有的 scenario 字段');
    assert.equal(body.data.toolName, 'auto-bind-coupons', '实际执行的工具必须是 body 中指定的 auto-bind-coupons，绝不是名为 simulate 的虚假工具');
    assert.equal(body.success, false);
    assert.equal(body.layers.tool.success, false);
    assert.equal(body.layers.business.outcome, 'failure');
  });
});

