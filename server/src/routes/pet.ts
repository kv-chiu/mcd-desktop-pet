import { Hono } from 'hono';
import { storage, PetActionType } from '../storage/index.js';
import { wsHub } from '../ws/hub.js';

export const petRoutes = new Hono();

// 获取当前桌宠状态
petRoutes.get('/state', (c) => {
  const state = storage.getPetState();
  return c.json({ success: true, data: state });
});

// 触发桌宠特定动作并广播
petRoutes.post('/action', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const action = (body.action || 'idle') as PetActionType;
  const duration = Number(body.duration) || 3.0;
  const speech = body.speech as string | undefined;
  const sound = body.sound as string | undefined;

  const validActions: PetActionType[] = [
    'idle',
    'eat_burger',
    'drink_coke',
    'celebrate',
    'sleep',
    'wave',
    'speak',
  ];

  if (!validActions.includes(action)) {
    return c.json(
      {
        success: false,
        error: `未知动作类型: ${action}。支持的动作: ${validActions.join(', ')}`,
      },
      400
    );
  }

  // 广播给桌宠播放动画
  wsHub.emitPetAction(action, { duration, speech, sound });

  return c.json({
    success: true,
    message: `已触发动作: ${action}`,
    data: { action, duration, speech },
  });
});

// 喂食桌宠
petRoutes.post('/feed', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const foodType = (body.food || 'burger') as 'burger' | 'coke' | 'sundae' | 'fries';

  const { state, message } = storage.feedPet(foodType);

  // 广播状态更新
  wsHub.emitStateUpdate(state);

  // 广播桌宠进食动作
  const actionType: PetActionType = foodType === 'coke' ? 'drink_coke' : 'eat_burger';
  wsHub.emitPetAction(actionType, {
    duration: 3.5,
    speech: message,
  });

  return c.json({
    success: true,
    message,
    data: state,
  });
});

// 让桌宠说话（显示对话气泡）
petRoutes.post('/speak', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const text = (body.text || '').trim();
  const duration = Number(body.duration) || 4.0;

  if (!text) {
    return c.json({ success: false, error: '请提供要让桌宠说的内容 (text)' }, 400);
  }

  wsHub.emitPetSpeech(text, duration);

  return c.json({
    success: true,
    message: '对话气泡已推送',
    data: { text, duration },
  });
});

// 与桌宠抚摸互动
petRoutes.post('/interact', (c) => {
  const { state, message } = storage.interactPet();
  wsHub.emitStateUpdate(state);
  wsHub.emitPetAction('celebrate', {
    duration: 2.5,
    speech: message,
  });

  return c.json({
    success: true,
    message,
    data: state,
  });
});
