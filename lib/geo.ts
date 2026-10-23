// Small geo helpers shared by client and server. Coordinates are [lng, lat].

export function haversineKm(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function bounds(points: { lng: number; lat: number }[]): [[number, number], [number, number]] | null {
  if (points.length === 0) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const p of points) {
    minLng = Math.min(minLng, p.lng);
    minLat = Math.min(minLat, p.lat);
    maxLng = Math.max(maxLng, p.lng);
    maxLat = Math.max(maxLat, p.lat);
  }
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

export function isValidLngLat(lng: unknown, lat: unknown): boolean {
  return (
    typeof lng === 'number' &&
    typeof lat === 'number' &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    Math.abs(lng) <= 180 &&
    Math.abs(lat) <= 90 &&
    !(lng === 0 && lat === 0)
  );
}

/** Rough door-to-door estimate when no router supports the mode (e.g. public transit). */
export function estimateMinutes(km: number, mode: 'walking' | 'driving' | 'cycling' | 'transit'): number {
  const speeds = { walking: 4.5, cycling: 14, driving: 30, transit: 22 };
  const overhead = mode === 'transit' ? 10 : mode === 'driving' ? 5 : 0;
  // Straight-line distance understates real paths; 1.3 is a common detour factor.
  return Math.round(((km * 1.3) / speeds[mode]) * 60 + overhead);
}

export const DAY_COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#f08c00', '#0c8599', '#d6336c', '#5c940d'];
