// Pure trip operations shared by the UI reducer, sync merge and tests.
import type {
  Day,
  ID,
  NoteTag,
  Pace,
  Participant,
  Place,
  PlaceNote,
  Preference,
  Proposal,
  ReactionValue,
  Stop,
  StopKind,
  SuggestedPlace,
  TransportMode,
  Trip,
} from './types';
import { haversineKm } from './geo';

export function newId(): ID {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '').slice(0, 10);
  return Math.random().toString(36).slice(2, 12);
}

export const PARTICIPANT_COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9'];

export function createTrip(partial: Partial<Trip> = {}): Trip {
  const me: Participant = { id: newId(), name: 'わたし', color: PARTICIPANT_COLORS[0] };
  const partner: Participant = { id: newId(), name: 'パートナー', color: PARTICIPANT_COLORS[1] };
  return {
    schemaVersion: 1,
    id: newId(),
    title: '新しい旅',
    destination: '',
    currency: 'JPY',
    pace: 'normal',
    interests: [],
    participants: [me, partner],
    days: [newDay()],
    stops: {},
    places: {},
    reactions: {},
    notes: [],
    preferences: [],
    revision: 0,
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

export function newDay(date?: string, mode: TransportMode = 'walking'): Day {
  return { id: newId(), date, stopIds: [], mode, startTime: '09:00' };
}

// ---- dates -------------------------------------------------------------------

export function dateRange(start?: string, end?: string, max = 31): string[] {
  if (!start) return [];
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${(end && end >= start ? end : start)}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return [];
  const out: string[] = [];
  for (let d = s; d <= e && out.length < max; d = new Date(d.getTime() + 86400000)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Resize days to the date range, keeping stops: removed days' stops move to the last day. */
export function syncDays(trip: Trip): Trip {
  const dates = dateRange(trip.startDate, trip.endDate);
  if (dates.length === 0) return trip;
  const days = trip.days.slice(0, dates.length).map((d, i) => ({ ...d, date: dates[i] }));
  while (days.length < dates.length) days.push(newDay(dates[days.length], trip.days[0]?.mode));
  const overflow = trip.days.slice(dates.length).flatMap((d) => d.stopIds);
  if (overflow.length) {
    const last = days[days.length - 1];
    days[days.length - 1] = { ...last, stopIds: [...last.stopIds, ...overflow] };
  }
  return { ...trip, days };
}

// ---- time --------------------------------------------------------------------

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export interface ScheduledStop {
  stopId: ID;
  start: number;
  end: number;
  travelToNext: number; // minutes
  travelEstimated: boolean;
  late: boolean; // fixed startTime cannot be reached
}

/**
 * Compute start/end for each stop. legMinutes[i] is the travel time from stop i to i+1
 * (from the router) — when missing, a straight-line estimate is used.
 */
export function schedule(trip: Trip, day: Day, legMinutes?: (number | null)[]): ScheduledStop[] {
  let t = toMinutes(day.startTime || '09:00');
  const out: ScheduledStop[] = [];
  day.stopIds.forEach((id, i) => {
    const stop = trip.stops[id];
    if (!stop) return;
    let late = false;
    if (stop.startTime) {
      const fixed = toMinutes(stop.startTime);
      if (fixed >= t) t = fixed;
      else late = i > 0;
      if (i === 0) t = fixed;
    }
    const start = t;
    const end = start + stop.durationMinutes;
    const nextId = day.stopIds[i + 1];
    let travel = 0;
    let estimated = false;
    if (nextId) {
      const routed = legMinutes?.[i];
      if (routed !== undefined && routed !== null) travel = routed;
      else {
        travel = estimateTravel(trip, id, nextId, day.mode);
        estimated = true;
      }
    }
    out.push({ stopId: id, start, end, travelToNext: travel, travelEstimated: estimated, late });
    t = end + travel;
  });
  return out;
}

function estimateTravel(trip: Trip, aId: ID, bId: ID, mode: TransportMode): number {
  const a = placeOf(trip, aId);
  const b = placeOf(trip, bId);
  if (!a || !b) return 0;
  const km = haversineKm(a, b);
  const speed = { walking: 4.5, cycling: 14, driving: 30, transit: 22 }[mode];
  return Math.round(((km * 1.3) / speed) * 60 + (mode === 'transit' && km > 0.8 ? 10 : 0));
}

export function placeOf(trip: Trip, stopId: ID): Place | undefined {
  const s = trip.stops[stopId];
  return s?.placeId ? trip.places[s.placeId] : undefined;
}

/** Places that are on the map but not in any day. */
export function candidates(trip: Trip): Place[] {
  const used = new Set(Object.values(trip.stops).map((s) => s.placeId));
  return Object.values(trip.places).filter((p) => !used.has(p.id));
}

export function dayOfStop(trip: Trip, stopId: ID): Day | undefined {
  return trip.days.find((d) => d.stopIds.includes(stopId));
}

// ---- mutations -----------------------------------------------------------------

export type TripAction =
  | { type: 'meta'; patch: Partial<Pick<Trip, 'title' | 'destination' | 'startDate' | 'endDate' | 'currency' | 'budget' | 'pace' | 'interests'>> }
  | { type: 'addPlace'; place: Place }
  | { type: 'removePlace'; placeId: ID }
  | { type: 'addStop'; placeId: ID | null; dayId: ID; position?: number; kind?: StopKind; durationMinutes?: number; startTime?: string }
  | { type: 'removeStop'; stopId: ID }
  | { type: 'moveStop'; stopId: ID; dayId: ID; index: number }
  | { type: 'updateStop'; stopId: ID; patch: Partial<Omit<Stop, 'id'>> }
  | { type: 'updateDay'; dayId: ID; patch: Partial<Pick<Day, 'mode' | 'startTime' | 'title'>> }
  | { type: 'applyProposal'; proposal: Proposal; places: SuggestedPlace[] }
  | { type: 'react'; placeId: ID; participantId: ID; value: ReactionValue | null }
  | { type: 'addNote'; placeId: ID; authorId: ID; tag: NoteTag; text: string }
  | { type: 'removeNote'; noteId: ID }
  | { type: 'upsertPreference'; pref: Preference }
  | { type: 'removePreference'; prefId: ID }
  | { type: 'upsertParticipant'; participant: Participant }
  | { type: 'removeParticipant'; participantId: ID }
  | { type: 'replace'; trip: Trip };

const PACE_DEFAULT: Record<Pace, number> = { relaxed: 90, normal: 75, packed: 60 };

export function reduceTrip(trip: Trip, action: TripAction): Trip {
  const next = apply(trip, action);
  if (next === trip || action.type === 'replace') return next;
  return { ...next, revision: trip.revision + 1, updatedAt: new Date().toISOString() };
}

function apply(trip: Trip, a: TripAction): Trip {
  switch (a.type) {
    case 'meta':
      return syncDays({ ...trip, ...a.patch });
    case 'addPlace':
      return { ...trip, places: { ...trip.places, [a.place.id]: a.place } };
    case 'removePlace': {
      const places = { ...trip.places };
      delete places[a.placeId];
      const dropped = new Set(Object.values(trip.stops).filter((s) => s.placeId === a.placeId).map((s) => s.id));
      const stops = Object.fromEntries(Object.entries(trip.stops).filter(([id]) => !dropped.has(id)));
      const reactions = { ...trip.reactions };
      delete reactions[a.placeId];
      return {
        ...trip,
        places,
        stops,
        reactions,
        notes: trip.notes.filter((n) => n.placeId !== a.placeId),
        days: trip.days.map((d) => ({ ...d, stopIds: d.stopIds.filter((id) => !dropped.has(id)) })),
      };
    }
    case 'addStop': {
      const day = trip.days.find((d) => d.id === a.dayId);
      if (!day) return trip;
      const stop: Stop = {
        id: newId(),
        placeId: a.placeId,
        kind: a.kind ?? (a.placeId ? 'visit' : 'rest'),
        durationMinutes: a.durationMinutes ?? (a.placeId ? PACE_DEFAULT[trip.pace] : 30),
        startTime: a.startTime,
        locked: false,
      };
      const ids = [...day.stopIds];
      ids.splice(a.position ?? ids.length, 0, stop.id);
      return {
        ...trip,
        stops: { ...trip.stops, [stop.id]: stop },
        days: trip.days.map((d) => (d.id === day.id ? { ...d, stopIds: ids } : d)),
      };
    }
    case 'removeStop': {
      if (!trip.stops[a.stopId]) return trip;
      const stops = { ...trip.stops };
      delete stops[a.stopId];
      return { ...trip, stops, days: trip.days.map((d) => ({ ...d, stopIds: d.stopIds.filter((id) => id !== a.stopId) })) };
    }
    case 'moveStop': {
      if (!trip.stops[a.stopId] || !trip.days.some((d) => d.id === a.dayId)) return trip;
      const days = trip.days.map((d) => ({ ...d, stopIds: d.stopIds.filter((id) => id !== a.stopId) }));
      return {
        ...trip,
        days: days.map((d) => {
          if (d.id !== a.dayId) return d;
          const ids = [...d.stopIds];
          ids.splice(Math.max(0, Math.min(a.index, ids.length)), 0, a.stopId);
          return { ...d, stopIds: ids };
        }),
      };
    }
    case 'updateStop': {
      const s = trip.stops[a.stopId];
      if (!s) return trip;
      return { ...trip, stops: { ...trip.stops, [s.id]: { ...s, ...a.patch } } };
    }
    case 'updateDay':
      return { ...trip, days: trip.days.map((d) => (d.id === a.dayId ? { ...d, ...a.patch } : d)) };
    case 'applyProposal':
      return applyProposal(trip, a.proposal, a.places).trip;
    case 'react': {
      const forPlace = { ...(trip.reactions[a.placeId] ?? {}) };
      if (a.value) forPlace[a.participantId] = a.value;
      else delete forPlace[a.participantId];
      return { ...trip, reactions: { ...trip.reactions, [a.placeId]: forPlace } };
    }
    case 'addNote': {
      const note: PlaceNote = { id: newId(), placeId: a.placeId, authorId: a.authorId, tag: a.tag, text: a.text.slice(0, 300), createdAt: new Date().toISOString() };
      return { ...trip, notes: [...trip.notes, note] };
    }
    case 'removeNote':
      return { ...trip, notes: trip.notes.filter((n) => n.id !== a.noteId) };
    case 'upsertPreference': {
      const exists = trip.preferences.some((p) => p.id === a.pref.id);
      return { ...trip, preferences: exists ? trip.preferences.map((p) => (p.id === a.pref.id ? a.pref : p)) : [...trip.preferences, a.pref] };
    }
    case 'removePreference':
      return { ...trip, preferences: trip.preferences.filter((p) => p.id !== a.prefId) };
    case 'upsertParticipant': {
      const exists = trip.participants.some((p) => p.id === a.participant.id);
      return {
        ...trip,
        participants: exists ? trip.participants.map((p) => (p.id === a.participant.id ? a.participant : p)) : [...trip.participants, a.participant],
      };
    }
    case 'removeParticipant': {
      if (trip.participants.length <= 1) return trip;
      const reactions = Object.fromEntries(
        Object.entries(trip.reactions).map(([pid, r]) => {
          const copy = { ...r };
          delete copy[a.participantId];
          return [pid, copy];
        }),
      );
      return {
        ...trip,
        participants: trip.participants.filter((p) => p.id !== a.participantId),
        preferences: trip.preferences.filter((p) => p.ownerId !== a.participantId),
        reactions,
      };
    }
    case 'replace':
      return a.trip;
  }
}

/** Find an existing place with the same name close by, so repeated suggestions do not duplicate pins. */
export function findSimilarPlace(trip: Trip, p: { name: string; lng: number; lat: number }): Place | undefined {
  return Object.values(trip.places).find((x) => x.name === p.name && haversineKm(x, p) < 1);
}

export function placeFromSuggestion(s: SuggestedPlace): Place {
  return {
    id: newId(),
    name: s.name,
    lng: s.lng,
    lat: s.lat,
    status: s.status,
    category: s.category,
    address: s.address,
    countryCode: s.countryCode,
    why: s.why,
    crowd: s.crowd,
    crowdNote: s.crowdNote,
    bestTime: s.bestTime,
    source: s.status === 'verified' ? 'osm' : 'llm',
    retrievedAt: new Date().toISOString(),
  };
}

export interface ApplyResult {
  trip: Trip;
  skipped: string[];
}

/** Apply an assistant proposal atomically. Ops that no longer fit (stale revision, locked stop) are skipped. */
export function applyProposal(trip: Trip, proposal: Proposal, suggested: SuggestedPlace[]): ApplyResult {
  let t = trip;
  const skipped: string[] = [];
  const byRef = new Map(suggested.map((s) => [s.ref, s]));
  const placeIdByRef = new Map<string, ID>();

  const ensurePlace = (ref: string): ID | null => {
    if (placeIdByRef.has(ref)) return placeIdByRef.get(ref)!;
    const s = byRef.get(ref);
    if (!s) return null;
    const existing = findSimilarPlace(t, s);
    const place = existing ?? placeFromSuggestion(s);
    if (!existing) t = apply(t, { type: 'addPlace', place });
    placeIdByRef.set(ref, place.id);
    return place.id;
  };

  for (const op of proposal.ops) {
    const day = op.dayIndex !== null ? t.days[op.dayIndex] : undefined;
    const stop = op.stopId ? t.stops[op.stopId] : undefined;
    switch (op.type) {
      case 'add_stop': {
        const placeId = op.placeRef ? ensurePlace(op.placeRef) : null;
        if (!day || !placeId) {
          skipped.push('add_stop');
          break;
        }
        const s = byRef.get(op.placeRef!);
        t = apply(t, {
          type: 'addStop',
          placeId,
          dayId: day.id,
          position: op.position ?? undefined,
          durationMinutes: op.durationMinutes ?? s?.durationMinutes,
          startTime: op.startTime ?? undefined,
          kind: s?.category === 'food' || s?.category === 'restaurant' ? 'meal' : 'visit',
        });
        break;
      }
      case 'add_rest':
        if (!day) skipped.push('add_rest');
        else t = apply(t, { type: 'addStop', placeId: null, dayId: day.id, position: op.position ?? undefined, kind: 'rest', durationMinutes: op.durationMinutes ?? 30 });
        break;
      case 'remove_stop':
        if (!stop || stop.locked) skipped.push('remove_stop');
        else t = apply(t, { type: 'removeStop', stopId: stop.id });
        break;
      case 'move_stop':
        if (!stop || stop.locked || !day) skipped.push('move_stop');
        else t = apply(t, { type: 'moveStop', stopId: stop.id, dayId: day.id, index: op.position ?? day.stopIds.length });
        break;
      case 'set_time':
        if (!stop || stop.locked) skipped.push('set_time');
        else
          t = apply(t, {
            type: 'updateStop',
            stopId: stop.id,
            patch: {
              ...(op.startTime ? { startTime: op.startTime } : {}),
              ...(op.durationMinutes !== null ? { durationMinutes: op.durationMinutes } : {}),
            },
          });
        break;
    }
  }
  return { trip: t, skipped };
}

// ---- history (undo / redo) -------------------------------------------------

export interface History {
  past: Trip[];
  present: Trip;
  future: Trip[];
}

export type HistoryAction = TripAction | { type: 'undo' } | { type: 'redo' } | { type: 'load'; trip: Trip };

const HISTORY_MAX = 50;

export function reduceHistory(h: History, a: HistoryAction): History {
  if (a.type === 'undo') {
    if (h.past.length === 0) return h;
    const prev = h.past[h.past.length - 1];
    return { past: h.past.slice(0, -1), present: { ...prev, revision: h.present.revision + 1 }, future: [h.present, ...h.future] };
  }
  if (a.type === 'redo') {
    if (h.future.length === 0) return h;
    const [next, ...rest] = h.future;
    return { past: [...h.past, h.present], present: { ...next, revision: h.present.revision + 1 }, future: rest };
  }
  if (a.type === 'load') return { past: [], present: a.trip, future: [] };
  const present = reduceTrip(h.present, a);
  if (present === h.present) return h;
  // Remote replacements are not undoable locally (they are someone else's edit).
  if (a.type === 'replace') return { past: [], present, future: [] };
  return { past: [...h.past, h.present].slice(-HISTORY_MAX), present, future: [] };
}
