import type { NextApiRequest, NextApiResponse } from 'next';
import { llmMode } from '@/lib/server/llm';

/** Lets the UI show whether the assistant runs on OpenAI or the demo responder. */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    llm: llmMode(),
    model: llmMode() === 'openai' ? process.env.OPENAI_MODEL || 'gpt-5-mini' : null,
    accessCodeRequired: Boolean(process.env.APP_ACCESS_CODE),
    sync: process.env.UPSTASH_REDIS_REST_URL ? 'upstash' : 'memory',
  });
}
