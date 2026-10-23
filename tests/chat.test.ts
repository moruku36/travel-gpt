import { describe, expect, it } from 'vitest';
import { runChat, invalidReason } from '@/lib/server/chatService';
import { parseLlmJson, LlmError } from '@/lib/server/llm';
import { demoReply } from '@/lib/server/demo';
import { chatRequestSchema, type ChatRequest, type LlmOutput } from '@/lib/schema';
import { buildTripSummary } from '@/lib/summary';
import { systemPrompt, contextBlock } from '@/lib/server/prompt';
import { reduceTrip } from '@/lib/trip';
import { kyotoTrip } from './fixtures';

function request(text: string, mode: ChatRequest['mode'] = 'plan'): ChatRequest {
  const t = kyotoTrip();
  return chatRequestSchema.parse({ messages: [{ role: 'user', text }], mode, trip: buildTripSummary(t), baseRevision: t.revision });
}

const output = (over: Partial<LlmOutput> = {}): LlmOutput => ({
  reply: 'ok',
  mapFocus: { lng: 135.77, lat: 35.0, zoom: 12 },
  places: [
    {
      ref: 'p1',
      name: '銀閣寺',
      geocodeQuery: '銀閣寺 京都',
      lng: 135.798,
      lat: 35.027,
      category: 'temple',
      countryCode: 'JP',
      why: '静か',
      durationMinutes: 45,
      cost: 500,
      currency: 'JPY',
      crowd: 'medium',
      crowdNote: '',
      bestTime: '朝',
    },
  ],
  proposal: { summary: 'add', ops: [{ type: 'add_stop', placeRef: 'p1', stopId: null, dayIndex: 1, position: null, startTime: null, durationMinutes: 45 }] },
  warnings: [],
  followUps: [],
  ...over,
});

describe('runChat', () => {
  it('marks a place verified when the geocoder finds it nearby and snaps coordinates', async () => {
    const reply = await runChat(request('銀閣寺に行きたい'), {
      generate: async () => output(),
      geocode: async () => [{ name: '慈照寺', lng: 135.7983, lat: 35.027, address: '京都市', countryCode: 'JP', category: 'temple', sourceRef: 'osm:W1' }],
      verify: true,
    });
    expect(reply.places[0].status).toBe('verified');
    expect(reply.places[0].lng).toBe(135.7983);
    expect(reply.proposal?.ops).toHaveLength(1);
  });

  it('keeps far-away geocoder hits out (stays estimated) and drops invalid coordinates', async () => {
    const bad = output();
    bad.places.push({ ...bad.places[0], ref: 'p2', name: 'どこか', lng: 0, lat: 0 });
    const reply = await runChat(request('x'), {
      generate: async () => bad,
      geocode: async () => [{ name: '銀閣寺', lng: 139.7, lat: 35.6, address: '', countryCode: 'JP', category: '', sourceRef: '' }],
      verify: true,
    });
    expect(reply.places).toHaveLength(1);
    expect(reply.places[0].status).toBe('estimated');
    expect(reply.warnings.some((w) => w.includes('どこか'))).toBe(true);
  });

  it('drops ops that reference missing days, unknown stops or locked stops', async () => {
    const t = reduceTrip(kyotoTrip(), { type: 'updateStop', stopId: kyotoTrip().days[0].stopIds[0], patch: {} });
    const req = chatRequestSchema.parse({ messages: [{ role: 'user', text: 'x' }], trip: buildTripSummary(t), baseRevision: 0 });
    const reply = await runChat(req, {
      generate: async () =>
        output({
          proposal: {
            summary: 's',
            ops: [
              { type: 'add_stop', placeRef: 'p1', stopId: null, dayIndex: 7, position: null, startTime: null, durationMinutes: null },
              { type: 'remove_stop', placeRef: null, stopId: 'nope', dayIndex: null, position: null, startTime: null, durationMinutes: null },
            ],
          },
        }),
      geocode: async () => [],
      verify: false,
    });
    expect(reply.proposal).toBeNull();
    expect(reply.warnings.filter((w) => w.startsWith('提案の一部'))).toHaveLength(2);
  });

  it('invalidReason refuses locked stops', () => {
    const r = invalidReason(
      { type: 'set_time', placeRef: null, stopId: 's1', dayIndex: null, position: null, startTime: '10:00', durationMinutes: null },
      { refs: new Set(), stopIds: new Map([['s1', true]]), dayCount: 1 },
    );
    expect(r).toContain('ロック');
  });
});

describe('LLM output parsing', () => {
  it('rejects non-JSON and wrong shapes without throwing raw errors', () => {
    expect(() => parseLlmJson('not json')).toThrow(LlmError);
    expect(() => parseLlmJson('{"reply": 1}')).toThrow(LlmError);
  });

  it('clamps over-long fields instead of failing', () => {
    const o = output();
    const long = { ...o, reply: 'あ'.repeat(9000), followUps: ['a', 'b', 'c', 'd', 'e', 'f'], places: [{ ...o.places[0], name: 'x'.repeat(500), countryCode: 'jpn' }] };
    const parsed = parseLlmJson(JSON.stringify(long));
    expect(parsed.reply.length).toBe(6000);
    expect(parsed.followUps).toHaveLength(4);
    expect(parsed.places[0].countryCode).toBe('JP');
  });
});

describe('demo responder', () => {
  it('suggests fixture places and a proposal for a known city', () => {
    const out = demoReply(request('京都で紅葉'));
    expect(out.places.length).toBeGreaterThan(0);
    expect(out.places.every((p) => p.name !== '伏見稲荷大社')).toBe(true); // already on the plan
    expect(out.proposal?.ops[0].type).toBe('add_stop');
  });

  it('recommends destinations worldwide in recommend mode', () => {
    const out = demoReply(request('どこか行きたい', 'recommend'));
    expect(out.places.some((p) => p.countryCode === 'FR')).toBe(true);
    expect(out.proposal).toBeNull();
  });
});

describe('prompt context', () => {
  it('includes stop ids and never private preferences', () => {
    let t = kyotoTrip();
    const me = t.participants[0].id;
    t = reduceTrip(t, { type: 'upsertPreference', pref: { id: 'a', ownerId: me, kind: 'custom', strength: 'required', value: 'SECRET-NOTE', visibility: 'private' } });
    t = reduceTrip(t, { type: 'upsertPreference', pref: { id: 'b', ownerId: me, kind: 'max-walk-km', strength: 'required', value: '8', visibility: 'shared' } });
    const req = chatRequestSchema.parse({ messages: [{ role: 'user', text: 'x' }], trip: buildTripSummary(t), baseRevision: 0 });
    const ctx = contextBlock(req);
    expect(ctx).toContain(t.days[0].stopIds[0]);
    expect(ctx).toContain('max walking km');
    expect(ctx).not.toContain('SECRET-NOTE');
    expect(systemPrompt(req)).toContain('MODE=plan');
  });
});
