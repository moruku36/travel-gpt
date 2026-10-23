import type { NextApiRequest, NextApiResponse } from 'next';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import type { ApiError } from '@/lib/types';

export function requestId(): string {
  return randomUUID().slice(0, 8);
}

export function sendError(
  res: NextApiResponse,
  status: number,
  code: string,
  message: string,
  opts: { retryable?: boolean; id?: string; retryAfter?: number } = {},
): void {
  if (opts.retryAfter) res.setHeader('Retry-After', String(opts.retryAfter));
  const body: ApiError = {
    error: { code, message, retryable: opts.retryable ?? false, requestId: opts.id ?? requestId() },
  };
  res.status(status).json(body);
}

export function clientIp(req: NextApiRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || 'unknown';
}

/** Optional shared access code so a public deployment cannot spend the API budget. */
export function checkAccess(req: NextApiRequest, res: NextApiResponse): boolean {
  const expected = process.env.APP_ACCESS_CODE;
  if (!expected) return true;
  const got = req.headers['x-access-code'];
  const value = Array.isArray(got) ? got[0] : got;
  const a = Buffer.from(value ?? '');
  const b = Buffer.from(expected);
  if (a.length === b.length && timingSafeEqual(a, b)) return true;
  sendError(res, 401, 'access_code', 'アクセスコードが必要です / Access code required');
  return false;
}

export function allowMethods(req: NextApiRequest, res: NextApiResponse, methods: string[]): boolean {
  if (methods.includes(req.method ?? '')) return true;
  res.setHeader('Allow', methods.join(', '));
  sendError(res, 405, 'method_not_allowed', `Use ${methods.join('/')}`);
  return false;
}

export async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 8000, ...rest } = init;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export function geoUserAgent(): string {
  return process.env.GEO_CONTACT || 'covoyager-travel-chat (github.com/moruku36/covoyager-travel-chat)';
}
