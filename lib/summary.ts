// Builds the compact trip context sent to /api/chat. Private preferences never leave the device.
import type { TripSummary } from './schema';
import type { Trip } from './types';
import { candidates, schedule, fromMinutes } from './trip';

const PREF_LABEL: Record<string, string> = {
  'max-walk-km': 'max walking km per day',
  'rest-every-min': 'rest every N minutes',
  'budget-per-day': 'budget per day',
  'avoid-crowds': 'avoid crowds',
  'avoid-heat': 'avoid heat / midday sun',
  'early-bird': 'likes early starts',
  'night-owl': 'likes evenings / nightlife',
  food: 'food preference',
  custom: 'note',
};

export function votesText(trip: Trip, placeId: string): string | undefined {
  const r = trip.reactions[placeId];
  if (!r) return undefined;
  const parts = trip.participants.filter((p) => r[p.id]).map((p) => `${p.name}:${r[p.id]}`);
  return parts.length ? parts.join(', ') : undefined;
}

export function buildTripSummary(trip: Trip): TripSummary {
  const names = new Map(trip.participants.map((p) => [p.id, p.name]));
  return {
    title: trip.title.slice(0, 200),
    destination: trip.destination.slice(0, 200),
    startDate: trip.startDate,
    endDate: trip.endDate,
    currency: trip.currency,
    budget: trip.budget,
    pace: trip.pace,
    interests: trip.interests.slice(0, 20),
    participants: trip.participants.map((p) => ({ id: p.id, name: p.name })),
    sharedPreferences: trip.preferences
      .filter((p) => p.visibility === 'shared')
      .slice(0, 40)
      .map((p) => ({ owner: names.get(p.ownerId) ?? '?', kind: PREF_LABEL[p.kind] ?? p.kind, strength: p.strength, value: p.value.slice(0, 200) })),
    days: trip.days.map((d, index) => {
      const sched = new Map(schedule(trip, d).map((s) => [s.stopId, s]));
      return {
        index,
        date: d.date,
        mode: d.mode,
        stops: d.stopIds.slice(0, 30).flatMap((id) => {
          const s = trip.stops[id];
          if (!s) return [];
          const place = s.placeId ? trip.places[s.placeId] : undefined;
          const notes = place ? trip.notes.filter((n) => n.placeId === place.id).map((n) => `${n.tag}${n.text ? `:${n.text}` : ''}`).join('; ') : '';
          const at = sched.get(id);
          return [
            {
              id,
              name: (place?.name ?? (s.kind === 'rest' ? 'rest' : s.kind)).slice(0, 200),
              kind: s.kind,
              start: at ? fromMinutes(at.start) : undefined,
              durationMinutes: s.durationMinutes,
              locked: s.locked,
              lng: place?.lng,
              lat: place?.lat,
              votes: place ? votesText(trip, place.id)?.slice(0, 200) : undefined,
              notes: notes ? notes.slice(0, 400) : undefined,
              who: s.participantIds?.length && s.participantIds.length < trip.participants.length ? s.participantIds.map((id) => names.get(id) ?? '?').join('+').slice(0, 200) : undefined,
            },
          ];
        }),
      };
    }),
    candidates: candidates(trip)
      .slice(0, 30)
      .map((p) => ({ name: p.name.slice(0, 200), votes: votesText(trip, p.id)?.slice(0, 200) })),
  };
}
