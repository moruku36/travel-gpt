import type { NextApiRequest, NextApiResponse } from 'next';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { allowMethods, checkAccess, clientIp, sendError } from '@/lib/server/http';
import { hit } from '@/lib/server/rateLimit';
import { hashToken, syncStore } from '@/lib/server/syncStore';
import { parseTrip, shareableTrip } from '@/lib/tripSchema';

export const config = { api: { bodyParser: { sizeLimit: '512kb' } } };

const roomId = z.string().regex(/^[A-Za-z0-9_-]{12,40}$/);
const putBody = z.object({ baseVersion: z.number().int().min(0), trip: z.unknown() });

function tokenOk(header: string | string[] | undefined, expectedHash: string): boolean {
  const t = Array.isArray(header) ? header[0] : header;
  if (!t || t.length < 16 || t.length > 80) return false;
  const a = Buffer.from(hashToken(t));
  const b = Buffer.from(expectedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!allowMethods(req, res, ['GET', 'PUT'])) return;
  if (!checkAccess(req, res)) return;
  const room = roomId.safeParse(req.query.room);
  if (!room.success) return sendError(res, 400, 'invalid_room', 'ルーム ID が不正です');
  const limit = hit(`sync:${clientIp(req)}`, 2400, 60 * 60 * 1000);
  if (!limit.ok) return sendError(res, 429, 'rate_limited', '同期の回数が多すぎます', { retryable: true, retryAfter: limit.retryAfterSec });
  res.setHeader('Cache-Control', 'no-store');

  const token = req.headers['x-room-token'];
  const store = syncStore();
  try {
    const current = await store.get(room.data);

    if (req.method === 'GET') {
      if (!current || !tokenOk(token, current.tokenHash)) return sendError(res, 404, 'not_found', '共有された旅が見つかりません（期限切れかリンクが違います）');
      const since = Number(req.query.since);
      if (Number.isFinite(since) && since === current.version) return res.status(200).json({ version: current.version, unchanged: true });
      return res.status(200).json({ version: current.version, trip: current.trip, updatedAt: current.updatedAt });
    }

    const body = putBody.safeParse(req.body);
    if (!body.success) return sendError(res, 400, 'invalid_request', '形式が不正です');
    const parsed = parseTrip(body.data.trip);
    if (!parsed.ok) return sendError(res, 400, 'invalid_trip', `旅程データが不正です: ${parsed.error}`);
    const t = Array.isArray(token) ? token[0] : token;
    if (current && !tokenOk(token, current.tokenHash)) return sendError(res, 403, 'forbidden', 'この旅を編集する権限がありません');
    if (!current && (!t || t.length < 16 || t.length > 80)) return sendError(res, 400, 'invalid_token', 'トークンが不正です');

    const next = {
      version: (current?.version ?? 0) + 1,
      tokenHash: current?.tokenHash ?? hashToken(t!),
      // Defence in depth: private conditions are stripped again on the server.
      trip: shareableTrip(parsed.trip),
      updatedAt: new Date().toISOString(),
    };
    const r = await store.cas(room.data, body.data.baseVersion, next);
    if (!r.ok) {
      return res.status(409).json({
        error: { code: 'conflict', message: '相手の更新と重なりました', retryable: true, requestId: '' },
        version: r.current?.version ?? 0,
        trip: r.current?.trip ?? null,
      });
    }
    return res.status(200).json({ version: next.version });
  } catch {
    return sendError(res, 503, 'sync_unavailable', '同期サービスに接続できません。端末内の編集は保存されています', { retryable: true });
  }
}
