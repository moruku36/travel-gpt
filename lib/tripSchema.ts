// Validation for imported / synced trips. Imported JSON is data, never instructions:
// anything that does not match is rejected rather than partially trusted.
import { z } from 'zod';
import type { Trip } from './types';

const id = z.string().min(1).max(64);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const money = z.object({ amount: z.number().nonnegative(), currency: z.string().length(3) });

const place = z.object({
  id,
  name: z.string().min(1).max(200),
  lng: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
  status: z.enum(['verified', 'estimated', 'manual']),
  category: z.string().max(60).optional(),
  address: z.string().max(400).optional(),
  countryCode: z.string().max(2).optional(),
  why: z.string().max(600).optional(),
  crowd: z.enum(['low', 'medium', 'high', 'unknown']).optional(),
  crowdNote: z.string().max(300).optional(),
  bestTime: z.string().max(120).optional(),
  source: z.enum(['osm', 'llm', 'demo', 'manual']).optional(),
  sourceRef: z.string().max(80).optional(),
  retrievedAt: z.string().max(40).optional(),
});

const stop = z.object({
  id,
  placeId: id.nullable(),
  kind: z.enum(['visit', 'meal', 'rest', 'stay', 'transfer']),
  startTime: hhmm.optional(),
  durationMinutes: z.number().int().min(0).max(1440),
  locked: z.boolean(),
  note: z.string().max(500).optional(),
  cost: money.optional(),
  participantIds: z.array(id).max(8).optional(),
});

const day = z.object({
  id,
  date: date.optional(),
  title: z.string().max(100).optional(),
  stopIds: z.array(id).max(40),
  mode: z.enum(['walking', 'driving', 'cycling', 'transit']),
  startTime: hhmm,
});

export const tripSchema = z.object({
  schemaVersion: z.literal(1),
  id,
  title: z.string().max(200),
  destination: z.string().max(200),
  startDate: date.optional(),
  endDate: date.optional(),
  currency: z.string().length(3),
  budget: z.number().nonnegative().optional(),
  pace: z.enum(['relaxed', 'normal', 'packed']),
  interests: z.array(z.string().max(60)).max(20),
  participants: z.array(z.object({ id, name: z.string().min(1).max(40), color: z.string().max(20) })).min(1).max(8),
  days: z.array(day).min(1).max(31),
  stops: z.record(z.string(), stop),
  places: z.record(z.string(), place),
  reactions: z.record(z.string(), z.record(z.string(), z.enum(['want', 'ok', 'skip']))),
  notes: z
    .array(
      z.object({
        id,
        placeId: id,
        authorId: id,
        tag: z.enum(['crowded', 'quiet', 'reserve', 'rainy-ok', 'must', 'avoid', 'memo']),
        text: z.string().max(300),
        createdAt: z.string().max(40),
      }),
    )
    .max(500),
  preferences: z
    .array(
      z.object({
        id,
        ownerId: id,
        kind: z.enum(['max-walk-km', 'rest-every-min', 'budget-per-day', 'avoid-crowds', 'avoid-heat', 'early-bird', 'night-owl', 'food', 'custom']),
        strength: z.enum(['required', 'preferred']),
        value: z.string().max(200),
        visibility: z.enum(['private', 'shared']),
        aiConsent: z.boolean().optional(),
      }),
    )
    .max(100),
  revision: z.number().int().min(0),
  updatedAt: z.string().max(40),
});

export function parseTrip(raw: unknown): { ok: true; trip: Trip } | { ok: false; error: string } {
  const r = tripSchema.safeParse(raw);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.path.join('.') || 'invalid' };
  const trip = r.data as Trip;
  // Referential integrity: every day stop must exist, every stop place must exist.
  for (const d of trip.days) for (const sid of d.stopIds) if (!trip.stops[sid]) return { ok: false, error: `missing stop ${sid}` };
  for (const s of Object.values(trip.stops)) if (s.placeId && !trip.places[s.placeId]) return { ok: false, error: `missing place ${s.placeId}` };
  if (Object.keys(trip.places).length > 400 || Object.keys(trip.stops).length > 600) return { ok: false, error: 'too large' };
  return { ok: true, trip };
}

/** Copy without private preferences: used for export, share links and sync. */
export function shareableTrip(trip: Trip): Trip {
  return { ...trip, preferences: trip.preferences.filter((p) => p.visibility === 'shared') };
}
