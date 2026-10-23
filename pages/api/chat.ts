import type { NextApiRequest, NextApiResponse } from 'next';
import { allowMethods, checkAccess, clientIp, requestId, sendError } from '@/lib/server/http';
import { envInt, hit } from '@/lib/server/rateLimit';
import { chatRequestSchema, LIMITS } from '@/lib/schema';
import { runChat } from '@/lib/server/chatService';
import { LlmError, llmMode } from '@/lib/server/llm';

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const id = requestId();
  if (!allowMethods(req, res, ['POST'])) return;
  if (!checkAccess(req, res)) return;

  const parsed = chatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_request', '入力形式が正しくありません', { id });
  }
  if (Buffer.byteLength(JSON.stringify(parsed.data.trip)) > LIMITS.contextBytes) {
    return sendError(res, 400, 'context_too_large', '旅程が大きすぎます。日数や候補を減らしてください', { id });
  }

  // Only real API calls cost money, so the demo responder is not counted.
  if (llmMode() === 'openai') {
    const perIp = hit(`chat:ip:${clientIp(req)}`, envInt('CHAT_LIMIT_PER_HOUR', 40), 60 * 60 * 1000);
    if (!perIp.ok) {
      return sendError(res, 429, 'rate_limited', '短時間の利用上限に達しました。少し待ってから再送してください', { id, retryable: true, retryAfter: perIp.retryAfterSec });
    }
    const global = hit('chat:global', envInt('CHAT_LIMIT_PER_DAY', 400), 24 * 60 * 60 * 1000);
    if (!global.ok) {
      return sendError(res, 503, 'budget_cap', '本日の AI 利用上限に達しました。手動編集は引き続き使えます', { id, retryAfter: global.retryAfterSec });
    }
  }

  try {
    const reply = await runChat(parsed.data);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(reply);
  } catch (e) {
    if (e instanceof LlmError) {
      const status = e.code === 'llm_timeout' ? 504 : e.code === 'llm_quota' ? 503 : e.code === 'llm_refused' ? 422 : 502;
      return sendError(res, status, e.code, e.message, { id, retryable: e.retryable });
    }
    console.error(`[chat ${id}] unexpected error`);
    sendError(res, 500, 'internal', '予期しないエラーが発生しました', { id, retryable: true });
  }
}
