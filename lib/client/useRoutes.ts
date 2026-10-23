// Fetches routed legs per day, only when a day's ordered coordinates or mode change.
import { useEffect, useMemo, useState } from 'react';
import type { Trip } from '@/lib/types';
import { api } from './api';
import { placeOf } from '@/lib/trip';

export interface DayRoute {
  /** travel minutes from stop i to i+1, aligned with day.stopIds (null = rest/no location) */
  minutes: (number | null)[];
  distances: (number | null)[];
  geometry: [number, number][][];
  estimated: boolean;
  warning?: string;
}

const cache = new Map<string, DayRoute>();

export function useRoutes(trip: Trip): Record<string, DayRoute> {
  const keys = useMemo(
    () =>
      trip.days.map((d) => {
        const pts = d.stopIds.map((id) => placeOf(trip, id)).map((p) => (p ? `${p.lng.toFixed(5)},${p.lat.toFixed(5)}` : '-'));
        return { dayId: d.id, key: `${d.mode}|${pts.join(';')}` };
      }),
    [trip],
  );
  const [routes, setRoutes] = useState<Record<string, DayRoute>>({});

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const next: Record<string, DayRoute> = {};
      await Promise.all(
        keys.map(async ({ dayId, key }) => {
          const day = trip.days.find((d) => d.id === dayId);
          if (!day) return;
          if (cache.has(key)) {
            next[dayId] = cache.get(key)!;
            return;
          }
          // Only stops with a place take part; rest blocks keep their slot with 0 travel.
          const located = day.stopIds.map((id, i) => ({ i, p: placeOf(trip, id) })).filter((x) => x.p);
          const minutes: (number | null)[] = day.stopIds.map(() => null);
          const distances: (number | null)[] = day.stopIds.map(() => null);
          if (located.length < 2) {
            next[dayId] = { minutes, distances, geometry: [], estimated: false };
            return;
          }
          try {
            const res = await api.route(
              located.map((x) => [x.p!.lng, x.p!.lat]),
              day.mode,
            );
            const geometry: [number, number][][] = [];
            res.legs.forEach((leg, li) => {
              const from = located[li].i;
              minutes[from] = Math.round(leg.durationSeconds / 60);
              distances[from] = leg.distanceMeters;
              // Rest blocks between two located stops do not move you: travel is attributed to the last one before the next place.
              geometry.push(leg.geometry);
            });
            const r: DayRoute = { minutes: shiftForRests(day.stopIds.length, located.map((x) => x.i), minutes), distances, geometry, estimated: res.legs.some((l) => l.estimated), warning: res.warning };
            cache.set(key, r);
            next[dayId] = r;
          } catch {
            next[dayId] = { minutes, distances, geometry: [], estimated: true, warning: '経路を取得できませんでした（概算表示）' };
          }
        }),
      );
      if (!cancelled) setRoutes(next);
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.map((k) => k.key).join('#')]);

  return routes;
}

/** Travel happens right before the next located stop, so a rest in between keeps 0 travel. */
function shiftForRests(len: number, locatedIdx: number[], minutes: (number | null)[]): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: len }, () => 0);
  for (let k = 0; k < locatedIdx.length - 1; k++) {
    const from = locatedIdx[k];
    const to = locatedIdx[k + 1];
    out[to - 1] = minutes[from];
  }
  return out;
}
