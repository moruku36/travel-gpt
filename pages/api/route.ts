import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { allowMethods, checkAccess, clientIp, sendError } from '@/lib/server/http';
import { hit } from '@/lib/server/rateLimit';
import { routeLegs } from '@/lib/server/route';

const body = z.object({
  points: z
    .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
    .min(2)
    .max(25),
  mode: z.enum(['walking', 'driving', 'cycling', 'transit']),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!allowMethods(req, res, ['POST'])) return;
  if (!checkAccess(req, res)) return;
  const parsed = body.safeParse(req.body);
  if (!parsed.success) return sendError(res, 400, 'invalid_request', '経路は 2〜25 地点で指定してください');
  const limit = hit(`route:${clientIp(req)}`, 200, 60 * 60 * 1000);
  if (!limit.ok) return sendError(res, 429, 'rate_limited', '経路計算の上限です', { retryable: true, retryAfter: limit.retryAfterSec });

  const result = await routeLegs(parsed.data.points as [number, number][], parsed.data.mode);
  res.status(200).json({ ...result, attribution: '© OpenStreetMap contributors, OSRM (FOSSGIS)' });
}
