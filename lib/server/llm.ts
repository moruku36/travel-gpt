// LLM adapter. Talks to the OpenAI Responses API with Structured Outputs when
// OPENAI_API_KEY is set; otherwise uses the deterministic demo responder.
import { fetchWithTimeout } from './http';
import { contextBlock, systemPrompt } from './prompt';
import { demoReply } from './demo';
import { llmOutputJsonSchema, llmOutputSchema, type ChatRequest, type LlmOutput } from '@/lib/schema';

export class LlmError extends Error {
  constructor(
    public code: 'llm_timeout' | 'llm_unavailable' | 'llm_bad_output' | 'llm_refused' | 'llm_quota',
    message: string,
    public retryable: boolean,
  ) {
    super(message);
  }
}

export function llmMode(): 'openai' | 'demo' {
  return process.env.OPENAI_API_KEY ? 'openai' : 'demo';
}

export async function generate(req: ChatRequest): Promise<LlmOutput> {
  if (llmMode() === 'demo') return demoReply(req);
  return callOpenAI(req);
}

function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/.test(model);
}

async function callOpenAI(req: ChatRequest): Promise<LlmOutput> {
  const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
  const maxTokens = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS) || 2500;
  const webSearch = process.env.OPENAI_WEB_SEARCH === '1';

  // Only the recent turns are sent; assistant turns are reduced to their text to save tokens.
  const history = req.messages.map((m, i) => {
    const isLast = i === req.messages.length - 1;
    const prefix = isLast && req.authorName ? `[${req.authorName}] ` : '';
    return { role: m.role, content: prefix + m.text };
  });
  const input = [{ role: 'developer', content: `Current trip context:\n${contextBlock(req)}` }, ...history];

  const body: Record<string, unknown> = {
    model,
    instructions: systemPrompt(req),
    input,
    max_output_tokens: maxTokens,
    store: false,
    text: { format: { type: 'json_schema', name: 'covoyager_reply', schema: llmOutputJsonSchema, strict: true } },
  };
  if (isReasoningModel(model)) body.reasoning = { effort: 'low' };
  if (webSearch) body.tools = [{ type: 'web_search' }];

  let res: Response;
  try {
    res = await fetchWithTimeout('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify(body),
      timeoutMs: webSearch ? 45000 : 30000,
    });
  } catch {
    throw new LlmError('llm_timeout', 'AI の応答が時間内に返りませんでした', true);
  }

  if (res.status === 429) {
    const text = await res.text();
    const quota = text.includes('insufficient_quota');
    throw new LlmError('llm_quota', quota ? 'OpenAI のクレジット残高が不足しています' : 'OpenAI のレート制限に達しました', !quota);
  }
  if (!res.ok) {
    // Never forward provider bodies (may echo request data); log status only.
    console.error(`[llm] OpenAI HTTP ${res.status}`);
    throw new LlmError('llm_unavailable', `AI サービスでエラーが発生しました (${res.status})`, res.status >= 500);
  }

  const data = (await res.json()) as {
    status?: string;
    incomplete_details?: { reason?: string };
    output?: Array<{ type: string; content?: Array<{ type: string; text?: string; refusal?: string }> }>;
  };
  const parts = (data.output ?? []).filter((o) => o.type === 'message').flatMap((o) => o.content ?? []);
  const refusal = parts.find((p) => p.type === 'refusal');
  if (refusal) throw new LlmError('llm_refused', 'このリクエストには回答できません', false);
  const text = parts.find((p) => p.type === 'output_text')?.text;
  if (!text) {
    const reason = data.incomplete_details?.reason;
    throw new LlmError('llm_bad_output', reason === 'max_output_tokens' ? '回答が長すぎて途中で切れました。質問を絞ってください' : 'AI の応答が空でした', true);
  }
  return parseLlmJson(text);
}

export function parseLlmJson(text: string): LlmOutput {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new LlmError('llm_bad_output', 'AI の応答形式が不正でした', true);
  }
  const parsed = llmOutputSchema.safeParse(sanitize(raw));
  if (!parsed.success) throw new LlmError('llm_bad_output', 'AI の応答が想定の形式ではありませんでした', true);
  return parsed.data;
}

/** Clamp lengths and counts so a slightly verbose model answer still validates. */
function sanitize(v: unknown, key = ''): unknown {
  if (typeof v === 'string') return v.slice(0, key === 'reply' ? 6000 : 600);
  if (Array.isArray(v)) {
    const cap = key === 'places' ? 8 : key === 'ops' ? 20 : key === 'warnings' ? 8 : key === 'followUps' ? 4 : 50;
    return v.slice(0, cap).map((x) => sanitize(x, key));
  }
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (k === 'durationMinutes' && typeof val === 'number') out[k] = Math.max(0, Math.min(1440, Math.round(val)));
      else if ((k === 'dayIndex' || k === 'position') && typeof val === 'number') out[k] = Math.max(0, Math.round(val));
      else if (k === 'countryCode' && typeof val === 'string') out[k] = val.slice(0, 2).toUpperCase();
      else if (k === 'currency' && typeof val === 'string') out[k] = val.slice(0, 3).toUpperCase();
      else if (k === 'followUps' && Array.isArray(val)) out[k] = val.slice(0, 4).map((s) => String(s).slice(0, 80));
      else if (k === 'ref' && typeof val === 'string') out[k] = val.slice(0, 40);
      else if (k === 'name' && typeof val === 'string') out[k] = val.slice(0, 200);
      else if (k === 'bestTime' && typeof val === 'string') out[k] = val.slice(0, 120);
      else if (k === 'category' && typeof val === 'string') out[k] = val.slice(0, 60);
      else if (k === 'warnings' && Array.isArray(val)) out[k] = val.slice(0, 8).map((s) => String(s).slice(0, 300));
      else if (k === 'crowdNote' && typeof val === 'string') out[k] = val.slice(0, 300);
      else if (k === 'geocodeQuery' && typeof val === 'string') out[k] = val.slice(0, 300);
      else out[k] = sanitize(val, k);
    }
    return out;
  }
  return v;
}
