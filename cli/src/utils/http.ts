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
