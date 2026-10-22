import pc from 'picocolors';
import { apiRequest } from '../utils/http.js';
import { outputResult } from '../utils/output.js';
import type { CliResult } from '../types.js';

export interface PetActionOptions {
  speech?: string;
  duration?: string | number;
  json?: boolean;
}

export interface PetSpeakOptions {
  duration?: string | number;
  json?: boolean;
}

export async function handlePetAction(
  action: string,
  options: PetActionOptions = {}
): Promise<CliResult> {
  const isJson = Boolean(options.json);
  const duration = options.duration ? Number(options.duration) : 3.0;

  const validActions = ['idle', 'wave', 'jump', 'speak'];
  if (!validActions.includes(action)) {
    const res: CliResult = {
      success: false,
      command: 'pet',
      message: `未知动作: ${action}。支持的动作: ${validActions.join(', ')}`,
    };
    outputResult(res, isJson);
    return res;
  }

  const payload: Record<string, any> = { action, duration };
  if (options.speech) {
    payload.speech = options.speech;
  }

  const response = await apiRequest('/api/pet/action', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const res: CliResult = {
    success: response.ok,
    command: 'pet',
    message: response.ok ? `桌宠已执行动作: ${action}${options.speech ? ` (气泡: "${options.speech}")` : ''}` : '触发动作失败',
    data: response.data,
    error: response.error,
  };

  outputResult(res, isJson);
  return res;
}

export async function handlePetSpeak(
  text: string,
  options: PetSpeakOptions = {}
): Promise<CliResult> {
  const isJson = Boolean(options.json);
  const duration = options.duration ? Number(options.duration) : 4.0;

  if (!text || !text.trim()) {
    const res: CliResult = {
      success: false,
      command: 'speak',
      message: '请提供说话文本内容',
    };
    outputResult(res, isJson);
    return res;
  }

  const response = await apiRequest('/api/pet/speak', {
    method: 'POST',
    body: JSON.stringify({ text: text.trim(), duration }),
  });

  const res: CliResult = {
    success: response.ok,
    command: 'speak',
    message: response.ok ? `桌宠已说话: "${text.trim()}"` : '推送气泡失败',
    data: response.data,
    error: response.error,
  };

  outputResult(res, isJson);
  return res;
}

export async function handlePetInteract(options: { json?: boolean } = {}): Promise<CliResult> {
  const isJson = Boolean(options.json);

  const response = await apiRequest('/api/pet/interact', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  const res: CliResult = {
    success: response.ok,
    command: 'interact',
    message: response.ok ? `与桌宠互动成功: ${response.data?.message || '主人摸摸头，今天也要开心鸭！'}` : '互动失败',
    data: response.data,
    error: response.error,
  };

  outputResult(res, isJson);
  return res;
}

export async function handlePetState(options: { json?: boolean } = {}): Promise<CliResult> {
  const isJson = Boolean(options.json);

  const response = await apiRequest('/api/pet/state');

  if (isJson) {
    const res: CliResult = {
      success: response.ok,
      command: 'pet-state',
      message: response.ok ? '获取桌宠状态成功' : '获取桌宠状态失败',
      data: response.data?.data,
      error: response.error,
    };
    outputResult(res, true);
    return res;
  }

  if (response.ok && response.data?.data) {
    const pet = response.data.data;
    console.log('\n' + pc.bold(pc.yellow(`🐾 桌面宠物当前状态 (${pet.name || '麦麦小宠'})`)));
    console.log(pc.gray('────────────────────────────────────────────'));
    console.log(`${pc.bold('当前动作 (Action):')}  ${pet.currentAction || 'idle'}`);
    console.log(pc.gray('────────────────────────────────────────────\n'));
    return {
      success: true,
      command: 'pet-state',
      message: '成功',
      data: pet,
    };
  } else {
    const res: CliResult = {
      success: false,
      command: 'pet-state',
      message: '获取桌宠状态失败',
      error: response.error,
    };
    outputResult(res, false);
    return res;
  }
}
