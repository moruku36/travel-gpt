// Fictional trips for tests. Names are well-known public landmarks; no real personal data.
import type { Place, Trip } from '@/lib/types';
import { createTrip, reduceTrip } from '@/lib/trip';

export function place(id: string, name: string, lng: number, lat: number, extra: Partial<Place> = {}): Place {
  return { id, name, lng, lat, status: 'verified', ...extra };
}

/** Kyoto, 2 days, 3 stops on day 1. */
export function kyotoTrip(): Trip {
  let t = createTrip({ title: 'テスト京都', destination: '京都', startDate: '2026-11-20', endDate: '2026-11-21' });
  t = reduceTrip(t, { type: 'meta', patch: { startDate: '2026-11-20', endDate: '2026-11-21' } });
  const places = [
    place('fushimi', '伏見稲荷大社', 135.7727, 34.9671, { category: 'shrine', crowd: 'high' }),
    place('kiyomizu', '清水寺', 135.785, 34.9949, { category: 'temple' }),
    place('nanzenji', '南禅寺', 135.7944, 35.0113, { category: 'temple' }),
  ];
  for (const p of places) t = reduceTrip(t, { type: 'addPlace', place: p });
  for (const p of places) t = reduceTrip(t, { type: 'addStop', placeId: p.id, dayId: t.days[0].id, durationMinutes: 60 });
  return t;
}

/** Paris abroad fixture: different currency and time zone. */
export function parisTrip(): Trip {
  let t = createTrip({ title: 'Test Paris', destination: 'Paris', currency: 'EUR', startDate: '2027-03-27', endDate: '2027-03-29' });
  t = reduceTrip(t, { type: 'meta', patch: { startDate: '2027-03-27', endDate: '2027-03-29' } });
  t = reduceTrip(t, { type: 'addPlace', place: place('eiffel', 'Tour Eiffel', 2.2945, 48.8584) });
  t = reduceTrip(t, { type: 'addStop', placeId: 'eiffel', dayId: t.days[1].id });
  return t;
}
