// Fixed-window counters kept in process memory. Good enough for a personal deployment;
// on serverless each instance counts separately, so the daily cap is a soft guard.

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

export interface LimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function hit(key: string, limit: number, windowMs: number, now = Date.now()): LimitResult {
  let w = buckets.get(key);
  if (!w || w.resetAt <= now) {
    w = { count: 0, resetAt: now + windowMs };
    buckets.set(key, w);
  }
  if (w.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((w.resetAt - now) / 1000) };
  }
  w.count += 1;
  if (buckets.size > 5000) prune(now);
  return { ok: true, remaining: limit - w.count, retryAfterSec: 0 };
}

function prune(now: number) {
  for (const [k, w] of buckets) if (w.resetAt <= now) buckets.delete(k);
}

export function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function resetRateLimits() {
  buckets.clear();
}
