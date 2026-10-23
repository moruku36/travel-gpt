import { describe, expect, it } from 'vitest';
import { applyProposal, candidates, dateRange, fromMinutes, reduceHistory, reduceTrip, schedule, syncDays } from '@/lib/trip';
import type { Proposal, SuggestedPlace } from '@/lib/types';
import { kyotoTrip, parisTrip } from './fixtures';

const sug = (ref: string, name: string, lng: number, lat: number): SuggestedPlace => ({
  ref,
  name,
  lng,
  lat,
  status: 'verified',
  category: 'temple',
  countryCode: 'JP',
  why: '',
  durationMinutes: 45,
  cost: null,
  currency: null,
  crowd: 'low',
  crowdNote: '',
  bestTime: '',
});

describe('dates', () => {
  it('builds inclusive ranges and survives DST changes', () => {
    expect(dateRange('2026-11-20', '2026-11-22')).toEqual(['2026-11-20', '2026-11-21', '2026-11-22']);
    // Europe switches to summer time on 2027-03-28; dates are computed in UTC so no day is lost.
    expect(dateRange('2027-03-27', '2027-03-29')).toHaveLength(3);
    expect(dateRange('2026-11-20', '2026-11-19')).toEqual(['2026-11-20']);
    expect(dateRange(undefined, '2026-01-01')).toEqual([]);
  });

  it('shrinking the range keeps stops by moving them to the last day', () => {
    const t = kyotoTrip();
    const moved = reduceTrip(t, { type: 'moveStop', stopId: t.days[0].stopIds[2], dayId: t.days[1].id, index: 0 });
    const shrunk = syncDays({ ...moved, endDate: '2026-11-20' });
    expect(shrunk.days).toHaveLength(1);
    expect(shrunk.days[0].stopIds).toHaveLength(3);
  });

  it('abroad fixture uses its own currency', () => {
    const t = parisTrip();
    expect(t.currency).toBe('EUR');
    expect(t.days).toHaveLength(3);
    expect(t.days[1].stopIds).toHaveLength(1);
  });
});

describe('schedule', () => {
  it('chains durations and travel, honouring fixed start times', () => {
    let t = kyotoTrip();
    const day = t.days[0];
    const s = schedule(t, day, [20, 15]);
    expect(fromMinutes(s[0].start)).toBe('09:00');
    expect(fromMinutes(s[1].start)).toBe('10:20');
    expect(fromMinutes(s[2].start)).toBe('11:35');

    t = reduceTrip(t, { type: 'updateStop', stopId: day.stopIds[1], patch: { startTime: '13:00' } });
    const s2 = schedule(t, t.days[0], [20, 15]);
    expect(fromMinutes(s2[1].start)).toBe('13:00');
    expect(s2[1].late).toBe(false);

    t = reduceTrip(t, { type: 'updateStop', stopId: day.stopIds[1], patch: { startTime: '09:30' } });
    expect(schedule(t, t.days[0], [20, 15])[1].late).toBe(true);
  });

  it('estimates travel when no route is known', () => {
    const t = kyotoTrip();
    const s = schedule(t, t.days[0]);
    expect(s[0].travelEstimated).toBe(true);
    expect(s[0].travelToNext).toBeGreaterThan(10);
  });
});

describe('mutations', () => {
  it('bumps revision once per action and keeps candidates separate', () => {
    const t = kyotoTrip();
    const r = t.revision;
    const t2 = reduceTrip(t, { type: 'removeStop', stopId: t.days[0].stopIds[0] });
    expect(t2.revision).toBe(r + 1);
    expect(candidates(t2).map((p) => p.id)).toEqual(['fushimi']);
  });

  it('removing a place removes its stops, reactions and notes', () => {
    let t = kyotoTrip();
    const me = t.participants[0].id;
    t = reduceTrip(t, { type: 'react', placeId: 'kiyomizu', participantId: me, value: 'want' });
    t = reduceTrip(t, { type: 'addNote', placeId: 'kiyomizu', authorId: me, tag: 'crowded', text: '朝は空いてた' });
    t = reduceTrip(t, { type: 'removePlace', placeId: 'kiyomizu' });
    expect(t.days[0].stopIds).toHaveLength(2);
    expect(t.reactions.kiyomizu).toBeUndefined();
    expect(t.notes).toHaveLength(0);
  });

  it('undo / redo restore previous trips without losing manual edits', () => {
    const t = kyotoTrip();
    let h = reduceHistory({ past: [], present: t, future: [] }, { type: 'updateDay', dayId: t.days[0].id, patch: { startTime: '08:00' } });
    h = reduceHistory(h, { type: 'removeStop', stopId: t.days[0].stopIds[0] });
    h = reduceHistory(h, { type: 'undo' });
    expect(h.present.days[0].stopIds).toHaveLength(3);
    expect(h.present.days[0].startTime).toBe('08:00');
    h = reduceHistory(h, { type: 'redo' });
    expect(h.present.days[0].stopIds).toHaveLength(2);
  });
});

describe('applyProposal', () => {
  it('adds suggested places and reuses an existing one with the same name nearby', () => {
    const t = kyotoTrip();
    const proposal: Proposal = {
      id: 'x',
      summary: '',
      baseRevision: t.revision,
      ops: [
        { type: 'add_stop', placeRef: 'p1', stopId: null, dayIndex: 1, position: null, startTime: '10:00', durationMinutes: 50 },
        { type: 'add_stop', placeRef: 'p2', stopId: null, dayIndex: 1, position: 0, startTime: null, durationMinutes: null },
        { type: 'add_rest', placeRef: null, stopId: null, dayIndex: 1, position: null, startTime: null, durationMinutes: 30 },
      ],
    };
    const { trip, skipped } = applyProposal(t, proposal, [sug('p1', '銀閣寺', 135.7983, 35.027), sug('p2', '清水寺', 135.7851, 34.995)]);
    expect(skipped).toEqual([]);
    const day = trip.days[1];
    expect(day.stopIds).toHaveLength(3);
    expect(trip.stops[day.stopIds[0]].placeId).toBe('kiyomizu');
    expect(trip.stops[day.stopIds[1]].startTime).toBe('10:00');
    expect(trip.stops[day.stopIds[2]].kind).toBe('rest');
    expect(Object.keys(trip.places)).toHaveLength(4);
  });

  it('skips ops on locked or missing stops (stale proposal)', () => {
    let t = kyotoTrip();
    const locked = t.days[0].stopIds[0];
    t = reduceTrip(t, { type: 'updateStop', stopId: locked, patch: { locked: true } });
    const proposal: Proposal = {
      id: 'x',
      summary: '',
      baseRevision: 0,
      ops: [
        { type: 'remove_stop', placeRef: null, stopId: locked, dayIndex: null, position: null, startTime: null, durationMinutes: null },
        { type: 'remove_stop', placeRef: null, stopId: 'gone', dayIndex: null, position: null, startTime: null, durationMinutes: null },
        { type: 'add_stop', placeRef: 'nope', stopId: null, dayIndex: 9, position: null, startTime: null, durationMinutes: null },
      ],
    };
    const { trip, skipped } = applyProposal(t, proposal, []);
    expect(skipped).toHaveLength(3);
    expect(trip.days[0].stopIds).toContain(locked);
  });
});
