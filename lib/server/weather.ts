// Daily forecast from Open-Meteo (no key, CC BY 4.0). Forecasts cover ~16 days ahead;
// outside that window the UI says "no forecast yet" instead of guessing.
import { fetchWithTimeout } from './http';

export interface DailyWeather {
  date: string;
  code: number;
  tMax: number;
  tMin: number;
  precipProb: number | null;
}

const cache = new Map<string, { at: number; value: DailyWeather[] }>();

export async function forecast(lat: number, lng: number, start: string, end: string): Promise<DailyWeather[]> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)},${start},${end}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 60 * 60 * 1000) return hit.value;
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', lat.toFixed(4));
  url.searchParams.set('longitude', lng.toFixed(4));
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max');
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('start_date', start);
  url.searchParams.set('end_date', end);
  const res = await fetchWithTimeout(url.toString(), { timeoutMs: 6000 });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const d = (await res.json()) as {
    daily?: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max?: (number | null)[] };
  };
  const daily = d.daily;
  const value: DailyWeather[] = daily
    ? daily.time.map((date, i) => ({
        date,
        code: daily.weather_code[i],
        tMax: daily.temperature_2m_max[i],
        tMin: daily.temperature_2m_min[i],
        precipProb: daily.precipitation_probability_max?.[i] ?? null,
      }))
    : [];
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Clamp a requested range to the forecast window (today .. today+15). */
export function forecastWindow(start: string, end: string, today = new Date()): { start: string; end: string } | null {
  const t0 = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const max = new Date(t0.getTime() + 15 * 86400000);
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  const from = s < t0 ? t0 : s;
  const to = e > max ? max : e;
  if (from > to) return null;
  return { start: from.toISOString().slice(0, 10), end: to.toISOString().slice(0, 10) };
}
