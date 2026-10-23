import { randomUUID } from 'node:crypto';
import { generate, llmMode } from './llm';
import { geocode, pickVerified } from './geocode';
import { isValidLngLat } from '@/lib/geo';
import type { ChatRequest, LlmOutput } from '@/lib/schema';
import type { ChatReply, ProposalOp, SuggestedPlace } from '@/lib/types';

export interface ChatDeps {
  generate: (req: ChatRequest) => Promise<LlmOutput>;
  geocode: typeof geocode;
  verify: boolean;
}

const defaultDeps = (): ChatDeps => ({ generate, geocode, verify: llmMode() === 'openai' });

export async function runChat(req: ChatRequest, deps: ChatDeps = defaultDeps()): Promise<ChatReply> {
  const out = await deps.generate(req);
  const warnings = [...out.warnings];

  const places = await Promise.all(
    out.places.map(async (p): Promise<SuggestedPlace | null> => {
      if (!isValidLngLat(p.lng, p.lat)) {
        warnings.push(`「${p.name}」の位置が分からないため地図に表示していません`);
        return null;
      }
      const base: SuggestedPlace = {
        ref: p.ref,
        name: p.name,
        lng: p.lng,
        lat: p.lat,
        status: 'estimated',
        category: p.category,
        countryCode: p.countryCode,
        why: p.why,
        durationMinutes: p.durationMinutes,
        cost: p.cost,
        currency: p.currency,
        crowd: p.crowd,
        crowdNote: p.crowdNote,
        bestTime: p.bestTime,
      };
      if (!deps.verify) return base;
      const radius = p.category === 'destination' ? 60 : 25;
      const hits = await deps.geocode(p.geocodeQuery || p.name, { near: { lng: p.lng, lat: p.lat }, limit: 3 });
      const match = pickVerified(hits, p, radius);
      if (!match) return base;
      return { ...base, lng: match.lng, lat: match.lat, status: 'verified', address: match.address, countryCode: match.countryCode || base.countryCode };
    }),
  );
  const kept = places.filter((p): p is SuggestedPlace => p !== null);
  const refs = new Set(kept.map((p) => p.ref));

  // Deterministic checks: an op that points to a missing day, stop or place is dropped.
  const stopIds = new Map<string, boolean>();
  for (const d of req.trip.days) for (const s of d.stops) stopIds.set(s.id, s.locked);
  const dayCount = req.trip.days.length;
  const ops: ProposalOp[] = [];
  for (const op of out.proposal?.ops ?? []) {
    const reason = invalidReason(op, { refs, stopIds, dayCount });
    if (reason) warnings.push(`提案の一部を除外しました: ${reason}`);
    else ops.push(op);
  }

  return {
    reply: out.reply,
    places: kept,
    proposal:
      out.proposal && ops.length > 0
        ? { id: randomUUID(), summary: out.proposal.summary, ops, baseRevision: req.baseRevision }
        : null,
    mapFocus: out.mapFocus && isValidLngLat(out.mapFocus.lng, out.mapFocus.lat) ? out.mapFocus : null,
    warnings: [...new Set(warnings)].slice(0, 10),
    followUps: out.followUps,
    mode: llmMode(),
  };
}

export function invalidReason(
  op: ProposalOp,
  ctx: { refs: Set<string>; stopIds: Map<string, boolean>; dayCount: number },
): string | null {
  const needsDay = op.type === 'add_stop' || op.type === 'add_rest' || op.type === 'move_stop';
  if (needsDay && (op.dayIndex === null || op.dayIndex >= ctx.dayCount)) return `存在しない日 (${op.dayIndex ?? '-'}) への変更`;
  if (op.type === 'add_stop' && (!op.placeRef || !ctx.refs.has(op.placeRef))) return '位置を確認できない場所の追加';
  if (op.type === 'remove_stop' || op.type === 'move_stop' || op.type === 'set_time') {
    if (!op.stopId || !ctx.stopIds.has(op.stopId)) return '旅程にない予定の変更';
    if (ctx.stopIds.get(op.stopId)) return 'ロック中の予定の変更';
  }
  if (op.type === 'set_time' && op.startTime === null && op.durationMinutes === null) return '変更内容のない時刻変更';
  return null;
}
