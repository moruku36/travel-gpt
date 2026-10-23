import { describe, expect, it } from 'vitest';
import { agreement, checkTrip } from '@/lib/conflicts';
import { mergeTrips, tripSignature } from '@/lib/merge';
import { parseTrip, shareableTrip } from '@/lib/tripSchema';
import { reduceTrip } from '@/lib/trip';
import { createMemoryStore, hashToken } from '@/lib/server/syncStore';
import { forecastWindow } from '@/lib/server/weather';
import { hit, resetRateLimits } from '@/lib/server/rateLimit';
import { kyotoTrip } from './fixtures';

const noRoutes = {};

describe('condition checks', () => {
  it('flags a required walking limit and a missing rest', () => {
    let t = kyotoTrip();
    const [a, b] = t.participants;
    t = reduceTrip(t, { type: 'upsertPreference', pref: { id: 'w', ownerId: a.id, kind: 'max-walk-km', strength: 'required', value: '2', visibility: 'shared' } });
    t = reduceTrip(t, { type: 'upsertPreference', pref: { id: 'r', ownerId: b.id, kind: 'rest-every-min', strength: 'preferred', value: '90', visibility: 'shared' } });
    const routes = { [t.days[0].id]: { minutes: [30, 30, null], distances: [3000, 2500, null] } };
    const issues = checkTrip(t, routes, a.id);
    expect(issues.find((i) => i.text.includes('徒歩'))?.severity).toBe('error');
    expect(issues.find((i) => i.text.includes('休憩'))?.severity).toBe('warn');
  });

  it('shows private conditions only to their owner', () => {
    let t = kyotoTrip();
    const [a, b] = t.participants;
    t = reduceTrip(t, { type: 'upsertPreference', pref: { id: 'c', ownerId: a.id, kind: 'avoid-crowds', strength: 'preferred', value: '', visibility: 'private' } });
    expect(checkTrip(t, noRoutes, a.id).some((i) => i.text.includes('あなたの非公開条件'))).toBe(true);
    expect(checkTrip(t, noRoutes, b.id).some((i) => i.text.includes('混雑'))).toBe(false);
  });

  it('warns when someone passed on a planned place and when the budget is exceeded', () => {
    let t = kyotoTrip();
    const [, b] = t.participants;
    t = reduceTrip(t, { type: 'react', placeId: 'kiyomizu', participantId: b.id, value: 'skip' });
    t = reduceTrip(t, { type: 'meta', patch: { budget: 1000 } });
    t = reduceTrip(t, { type: 'updateStop', stopId: t.days[0].stopIds[0], patch: { cost: { amount: 800, currency: 'JPY' } } });
    const issues = checkTrip(t, noRoutes, b.id);
    expect(issues.some((i) => i.text.includes('パス'))).toBe(true);
    expect(issues.some((i) => i.text.includes('予算'))).toBe(true);
  });

  it('agreement treats a missing vote as not agreed', () => {
    let t = kyotoTrip();
    const [a, b] = t.participants;
    t = reduceTrip(t, { type: 'react', placeId: 'nanzenji', participantId: a.id, value: 'want' });
    expect(agreement(t).pending).toContain('nanzenji');
    t = reduceTrip(t, { type: 'react', placeId: 'nanzenji', participantId: b.id, value: 'ok' });
    expect(agreement(t).both).toContain('nanzenji');
  });
});

describe('sharing and sync', () => {
  it('export/share copies never contain private preferences and still validate', () => {
    let t = kyotoTrip();
    t = reduceTrip(t, { type: 'upsertPreference', pref: { id: 'p', ownerId: t.participants[0].id, kind: 'custom', strength: 'preferred', value: 'private!', visibility: 'private' } });
    const s = shareableTrip(t);
    expect(JSON.stringify(s)).not.toContain('private!');
    expect(parseTrip(JSON.parse(JSON.stringify(s))).ok).toBe(true);
  });

  it('rejects trips with dangling references', () => {
    const t = kyotoTrip();
    const broken = { ...t, days: [{ ...t.days[0], stopIds: ['missing'] }] };
    expect(parseTrip(broken).ok).toBe(false);
  });

  it('merge unions notes and reactions from both devices and keeps local private prefs', () => {
    const base = kyotoTrip();
    const [a, b] = base.participants;
    let mine = reduceTrip(base, { type: 'addNote', placeId: 'fushimi', authorId: a.id, tag: 'crowded', text: '' });
    mine = reduceTrip(mine, { type: 'upsertPreference', pref: { id: 'pv', ownerId: a.id, kind: 'custom', strength: 'preferred', value: 'x', visibility: 'private' } });
    let theirs = reduceTrip(base, { type: 'react', placeId: 'kiyomizu', participantId: b.id, value: 'want' });
    theirs = { ...theirs, updatedAt: '2999-01-01T00:00:00.000Z' };
    const merged = mergeTrips(mine, shareableTrip(theirs));
    expect(merged.notes).toHaveLength(1);
    expect(merged.reactions.kiyomizu[b.id]).toBe('want');
    expect(merged.preferences.some((p) => p.id === 'pv')).toBe(true);
  });

  it('signature ignores key order and revision', () => {
    const t = kyotoTrip();
    const shuffled = Object.fromEntries(Object.entries({ ...t, revision: 99 }).reverse()) as typeof t;
    expect(tripSignature(shuffled)).toBe(tripSignature(t));
  });

  it('memory store performs compare-and-set', async () => {
    const s = createMemoryStore();
    const rec = (v: number) => ({ version: v, tokenHash: hashToken('t'.repeat(20)), trip: {}, updatedAt: '' });
    expect((await s.cas('room-aaaaaaaaaa', 0, rec(1))).ok).toBe(true);
    const stale = await s.cas('room-aaaaaaaaaa', 0, rec(1));
    expect(stale.ok).toBe(false);
    expect((await s.cas('room-aaaaaaaaaa', 1, rec(2))).ok).toBe(true);
    expect((await s.get('room-aaaaaaaaaa'))?.version).toBe(2);
  });
});

describe('guards', () => {
  it('rate limiter blocks after the limit within the window', () => {
    resetRateLimits();
    expect(hit('k', 2, 1000, 0).ok).toBe(true);
    expect(hit('k', 2, 1000, 1).ok).toBe(true);
    expect(hit('k', 2, 1000, 2).ok).toBe(false);
    expect(hit('k', 2, 1000, 1001).ok).toBe(true);
  });

  it('weather window clamps to the 16-day forecast range', () => {
    const today = new Date('2026-10-24T03:00:00Z');
    expect(forecastWindow('2026-10-20', '2026-10-26', today)).toEqual({ start: '2026-10-24', end: '2026-10-26' });
    expect(forecastWindow('2026-12-24', '2026-12-26', today)).toBeNull();
  });
});
