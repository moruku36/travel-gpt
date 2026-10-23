import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { allowMethods, checkAccess, clientIp, sendError } from '@/lib/server/http';
import { hit } from '@/lib/server/rateLimit';
import { forecast, forecastWindow } from '@/lib/server/weather';

const query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!allowMethods(req, res, ['GET'])) return;
  if (!checkAccess(req, res)) return;
  const q = query.safeParse(req.query);
  if (!q.success) return sendError(res, 400, 'invalid_request', '位置と日付が必要です');
  const limit = hit(`wx:${clientIp(req)}`, 120, 60 * 60 * 1000);
  if (!limit.ok) return sendError(res, 429, 'rate_limited', '天気の取得回数の上限です', { retryable: true, retryAfter: limit.retryAfterSec });

  const win = forecastWindow(q.data.start, q.data.end);
  if (!win) return res.status(200).json({ days: [], note: 'out_of_range', retrievedAt: new Date().toISOString() });
  try {
    const days = await forecast(q.data.lat, q.data.lng, win.start, win.end);
    res.setHeader('Cache-Control', 'private, max-age=1800');
    res.status(200).json({ days, retrievedAt: new Date().toISOString(), attribution: 'Weather data by Open-Meteo.com (CC BY 4.0)' });
  } catch {
    sendError(res, 503, 'weather_unavailable', '天気予報を取得できませんでした', { retryable: true });
  }
}
