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
    'wave',
    'jump',
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

  try {
    // 广播给桌宠播放动画（内部持久化当前动作，若落盘失败则抛错并中止广播）
    wsHub.emitPetAction(action, { duration, speech, sound });

    return c.json({
      success: true,
      message: `已触发动作: ${action}`,
      data: { action, duration, speech },
    });
  } catch (err: any) {
    console.error('[PetRoute] 触发动作持久化或广播失败:', err);
    return c.json(
      {
        success: false,
        error: `触发动作失败: ${err.message || '状态落盘异常'}`,
      },
      500
    );
  }
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
  try {
    const { state, message } = storage.interactPet();
    wsHub.emitStateUpdate(state);
    wsHub.emitPetAction('jump', {
      duration: 2.5,
      speech: message,
    });

    return c.json({
      success: true,
      message,
      data: state,
    });
  } catch (err: any) {
    console.error('[PetRoute] 桌宠互动持久化失败:', err);
    return c.json(
      {
        success: false,
        error: `桌宠互动失败: ${err.message || '状态落盘异常'}`,
      },
      500
    );
  }
});
