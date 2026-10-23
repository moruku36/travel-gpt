// OpenStreetMap geocoding through Photon (komoot), falling back to Nominatim.
// OSM data is ODbL: results may be stored with attribution, which keeps trips exportable.
import { fetchWithTimeout, geoUserAgent } from './http';
import { haversineKm } from '@/lib/geo';

export interface GeoCandidate {
  name: string;
  lng: number;
  lat: number;
  address: string;
  countryCode: string;
  category: string;
  sourceRef: string;
}

const cache = new Map<string, { at: number; value: GeoCandidate[] }>();
const CACHE_MS = 6 * 60 * 60 * 1000;
const CACHE_MAX = 800;

function cacheGet(key: string): GeoCandidate[] | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key: string, value: GeoCandidate[]) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first !== undefined) cache.delete(first);
  }
  cache.set(key, { at: Date.now(), value });
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | number | undefined>;
}

function photonToCandidate(f: PhotonFeature): GeoCandidate {
  const p = f.properties;
  const parts = [p.street, p.district, p.city, p.state, p.country].filter(Boolean);
  return {
    name: String(p.name ?? p.street ?? p.city ?? ''),
    lng: f.geometry.coordinates[0],
    lat: f.geometry.coordinates[1],
    address: parts.join(', '),
    countryCode: String(p.countrycode ?? '').toUpperCase(),
    category: String(p.osm_value ?? p.type ?? ''),
    sourceRef: `osm:${p.osm_type ?? ''}${p.osm_id ?? ''}`,
  };
}

export async function geocode(
  query: string,
  opts: { near?: { lng: number; lat: number }; limit?: number; lang?: string } = {},
): Promise<GeoCandidate[]> {
  const q = query.trim().slice(0, 300);
  if (q.length < 2) return [];
  const limit = Math.min(opts.limit ?? 5, 10);
  const near = opts.near ? `${opts.near.lng.toFixed(2)},${opts.near.lat.toFixed(2)}` : '';
  const key = `${q}|${near}|${limit}`;
  const cached = cacheGet(key);
  if (cached) return cached;

  let result: GeoCandidate[] = [];
  try {
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', q);
    url.searchParams.set('limit', String(limit));
    if (opts.near) {
      url.searchParams.set('lat', String(opts.near.lat));
      url.searchParams.set('lon', String(opts.near.lng));
    }
    // Photon supports a few languages only; others fall back to local names.
    if (opts.lang && ['en', 'de', 'fr'].includes(opts.lang)) url.searchParams.set('lang', opts.lang);
    const res = await fetchWithTimeout(url.toString(), { headers: { 'User-Agent': geoUserAgent() }, timeoutMs: 5000 });
    if (res.ok) {
      const data = (await res.json()) as { features?: PhotonFeature[] };
      result = (data.features ?? []).map(photonToCandidate).filter((c) => c.name);
    }
  } catch {
    // fall through to Nominatim
  }

  if (result.length === 0) {
    try {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('q', q);
      url.searchParams.set('format', 'jsonv2');
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('addressdetails', '1');
      const res = await fetchWithTimeout(url.toString(), {
        headers: { 'User-Agent': geoUserAgent(), 'Accept-Language': opts.lang ?? 'ja,en' },
        timeoutMs: 6000,
      });
      if (res.ok) {
        const rows = (await res.json()) as Array<{
          name?: string;
          display_name: string;
          lat: string;
          lon: string;
          category?: string;
          type?: string;
          osm_type?: string;
          osm_id?: number;
          address?: { country_code?: string };
        }>;
        result = rows.map((r) => ({
          name: r.name || r.display_name.split(',')[0],
          lng: Number(r.lon),
          lat: Number(r.lat),
          address: r.display_name,
          countryCode: (r.address?.country_code ?? '').toUpperCase(),
          category: r.type ?? r.category ?? '',
          sourceRef: `osm:${r.osm_type ?? ''}${r.osm_id ?? ''}`,
        }));
      }
    } catch {
      // both providers failed; caller treats as unverified
    }
  }

  if (opts.near) {
    const near = opts.near;
    result.sort((a, b) => haversineKm(a, near) - haversineKm(b, near));
  }
  cacheSet(key, result);
  return result;
}

/** Accept a geocoder hit only when it lands near where the assistant said the place is. */
export function pickVerified(
  candidates: GeoCandidate[],
  hint: { lng: number; lat: number },
  maxKm = 25,
): GeoCandidate | null {
  for (const c of candidates) {
    if (haversineKm(c, hint) <= maxKm) return c;
  }
  return null;
}

export function clearGeocodeCache() {
  cache.clear();
}
