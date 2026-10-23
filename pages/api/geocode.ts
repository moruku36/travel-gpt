import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { allowMethods, checkAccess, clientIp, sendError } from '@/lib/server/http';
import { hit } from '@/lib/server/rateLimit';
import { geocode } from '@/lib/server/geocode';

const query = z.object({
  q: z.string().trim().min(2).max(200),
  lng: z.coerce.number().min(-180).max(180).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!allowMethods(req, res, ['GET'])) return;
  if (!checkAccess(req, res)) return;
  const parsed = query.safeParse(req.query);
  if (!parsed.success) return sendError(res, 400, 'invalid_request', '検索語は 2〜200 文字で入力してください');
  const limit = hit(`geo:${clientIp(req)}`, 120, 60 * 60 * 1000);
  if (!limit.ok) return sendError(res, 429, 'rate_limited', '検索回数の上限です', { retryable: true, retryAfter: limit.retryAfterSec });

  const { q, lng, lat } = parsed.data;
  const near = lng !== undefined && lat !== undefined ? { lng, lat } : undefined;
  const candidates = await geocode(q, { near, limit: 8 });
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.status(200).json({ candidates, attribution: '© OpenStreetMap contributors' });
}
