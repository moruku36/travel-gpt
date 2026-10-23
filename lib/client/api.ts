import type { ApiError, ChatReply, TransportMode } from '@/lib/types';
import type { ChatRequest } from '@/lib/schema';
import { readAccessCode } from './storage';

export class ClientApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public retryable: boolean,
    public status: number,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}, timeoutMs = 40000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const code = readAccessCode();
  try {
    const res = await fetch(path, {
      ...init,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(code ? { 'x-access-code': code } : {}), ...(init.headers ?? {}) },
    });
    const body = (await res.json().catch(() => null)) as (T & Partial<ApiError>) | null;
    if (!res.ok || !body) {
      const err = body?.error;
      throw new ClientApiError(err?.code ?? 'http_error', err?.message ?? `通信エラー (${res.status})`, err?.retryable ?? res.status >= 500, res.status);
    }
    return body;
  } catch (e) {
    if (e instanceof ClientApiError) throw e;
    if ((e as Error).name === 'AbortError') throw new ClientApiError('timeout', '応答に時間がかかりすぎました', true, 0);
    throw new ClientApiError('network', 'ネットワークに接続できません', true, 0);
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  health: () => call<{ llm: 'openai' | 'demo'; model: string | null; accessCodeRequired: boolean; sync: string }>('/api/health'),
  chat: (body: ChatRequest) => call<ChatReply>('/api/chat', { method: 'POST', body: JSON.stringify(body) }, 60000),
  geocode: (q: string, near?: { lng: number; lat: number }) => {
    const p = new URLSearchParams({ q });
    if (near) {
      p.set('lng', String(near.lng));
      p.set('lat', String(near.lat));
    }
    return call<{ candidates: Array<{ name: string; lng: number; lat: number; address: string; countryCode: string; category: string; sourceRef: string }> }>(
      `/api/geocode?${p.toString()}`,
    );
  },
  route: (points: [number, number][], mode: TransportMode) =>
    call<{ legs: Array<{ distanceMeters: number; durationSeconds: number; geometry: [number, number][]; estimated: boolean }>; warning?: string }>(
      '/api/route',
      { method: 'POST', body: JSON.stringify({ points, mode }) },
    ),
};
