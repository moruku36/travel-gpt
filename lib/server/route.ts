// Routing through the FOSSGIS OSRM instances (car / bike / foot, OSM data, no key).
// Public transit has no free global router, so it is estimated from straight-line distance
// and labelled as such in the UI.
import { fetchWithTimeout, geoUserAgent } from './http';
import { estimateMinutes, haversineKm } from '@/lib/geo';
import type { TransportMode } from '@/lib/types';

export interface Leg {
  distanceMeters: number;
  durationSeconds: number;
  geometry: [number, number][];
  estimated: boolean;
}

const PROFILE: Record<Exclude<TransportMode, 'transit'>, string> = {
  driving: 'routed-car',
  cycling: 'routed-bike',
  walking: 'routed-foot',
};

export function estimatedLegs(points: [number, number][], mode: TransportMode): Leg[] {
  const legs: Leg[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = { lng: points[i][0], lat: points[i][1] };
    const b = { lng: points[i + 1][0], lat: points[i + 1][1] };
    const km = haversineKm(a, b);
    legs.push({
      distanceMeters: Math.round(km * 1000),
      durationSeconds: estimateMinutes(km, mode) * 60,
      geometry: [points[i], points[i + 1]],
      estimated: true,
    });
  }
  return legs;
}

export async function routeLegs(points: [number, number][], mode: TransportMode): Promise<{ legs: Leg[]; warning?: string }> {
  if (points.length < 2) return { legs: [] };
  if (mode === 'transit') {
    return { legs: estimatedLegs(points, mode), warning: '公共交通は時刻表を使わない概算です' };
  }
  const coords = points.map(([lng, lat]) => `${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
  const url = `https://routing.openstreetmap.de/${PROFILE[mode]}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
  try {
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': geoUserAgent() }, timeoutMs: 8000 });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as {
      code: string;
      routes?: Array<{ geometry: { coordinates: [number, number][] }; legs: Array<{ distance: number; duration: number }> }>;
    };
    const route = data.routes?.[0];
    if (data.code !== 'Ok' || !route) throw new Error(data.code);
    // Split the full geometry by nearest vertex to each waypoint so every leg can be drawn.
    const geom = route.geometry.coordinates;
    const cut = points.map((p) => nearestIndex(geom, p));
    const legs = route.legs.map((l, i) => ({
      distanceMeters: Math.round(l.distance),
      durationSeconds: Math.round(l.duration),
      geometry: geom.slice(Math.min(cut[i], cut[i + 1]), Math.max(cut[i], cut[i + 1]) + 1),
      estimated: false,
    }));
    return { legs };
  } catch {
    return { legs: estimatedLegs(points, mode), warning: '経路サービスに接続できないため直線距離からの概算です' };
  }
}

function nearestIndex(geom: [number, number][], p: [number, number]): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < geom.length; i++) {
    const d = (geom[i][0] - p[0]) ** 2 + (geom[i][1] - p[1]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}
