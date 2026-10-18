import { readConfigPort } from './paths.js';
import type { HealthResponse } from '../types.js';

export async function checkServerHealth(
  port: number,
  timeoutMs = 1500
): Promise<{ ok: boolean; data?: HealthResponse; error?: string }> {
  const url = `http://localhost:${port}/api/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      return {
        ok: false,
        error: `HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = (await res.json()) as HealthResponse;
    return {
      ok: true,
      data,
    };
  } catch (err: any) {
    clearTimeout(timer);
    return {
      ok: false,
      error: err.name === 'AbortError' ? '请求超时 (Connection timeout)' : err.message,
    };
  }
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {},
  port = readConfigPort()
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const url = `http://localhost:${port}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      status: res.status,
      data,
      error: !res.ok ? (data?.error || `HTTP ${res.status}`) : undefined,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      error: `中枢服务连接失败 (${url}): ${err.message}。请先执行 mcd start 启动服务。`,
    };
  }
}

