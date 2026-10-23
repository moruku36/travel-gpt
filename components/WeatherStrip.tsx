import { useEffect, useState } from 'react';
import type { Trip } from '@/lib/types';
import { readAccessCode } from '@/lib/client/storage';
import { dayLabel } from '@/lib/format';

interface Day {
  date: string;
  code: number;
  tMax: number;
  tMin: number;
  precipProb: number | null;
}

function icon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 2) return '🌤';
  if (code === 3) return '☁️';
  if (code <= 48) return '🌫';
  if (code <= 67 || (code >= 80 && code <= 82)) return '🌧';
  if (code <= 77 || code === 85 || code === 86) return '❄️';
  return '⛈';
}

function center(trip: Trip): { lat: number; lng: number } | null {
  const ps = Object.values(trip.places).filter((p) => p.category !== 'destination');
  if (ps.length === 0) return null;
  return { lat: ps.reduce((s, p) => s + p.lat, 0) / ps.length, lng: ps.reduce((s, p) => s + p.lng, 0) / ps.length };
}

export default function WeatherStrip({ trip }: { trip: Trip }) {
  const [days, setDays] = useState<Day[] | null>(null);
  const [note, setNote] = useState<string>('');
  const c = center(trip);
  const key = c && trip.startDate ? `${c.lat.toFixed(1)},${c.lng.toFixed(1)},${trip.startDate},${trip.endDate ?? trip.startDate}` : '';

  useEffect(() => {
    if (!key || !c || !trip.startDate) return;
    let cancelled = false;
    const p = new URLSearchParams({ lat: String(c.lat), lng: String(c.lng), start: trip.startDate, end: trip.endDate ?? trip.startDate });
    const code = readAccessCode();
    fetch(`/api/weather?${p}`, { headers: code ? { 'x-access-code': code } : {} })
      .then((r) => r.json())
      .then((b) => {
        if (cancelled) return;
        setDays(b.days ?? []);
        setNote(b.note === 'out_of_range' ? '出発の約 16 日前から予報が表示されます' : b.error ? b.error.message : '');
      })
      .catch(() => !cancelled && setNote('天気予報を取得できませんでした'));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!trip.startDate) return null;
  return (
    <div className="card">
      <h4>天気予報</h4>
      {!c && <p className="muted small">場所を追加すると現地の予報を表示します。</p>}
      {note && <p className="muted small">{note}</p>}
      {days && days.length > 0 && (
        <ul className="weather">
          {days.map((d) => {
            const idx = trip.days.findIndex((x) => x.date === d.date);
            return (
              <li key={d.date} className={d.tMax >= 32 ? 'hot' : (d.precipProb ?? 0) >= 60 ? 'rainy' : ''}>
                <span className="wx-day">{idx >= 0 ? dayLabel(idx, d.date).split(' ')[1] : d.date.slice(5)}</span>
                <span className="wx-icon" aria-hidden>
                  {icon(d.code)}
                </span>
                <span>
                  {Math.round(d.tMax)}° / {Math.round(d.tMin)}°
                </span>
                {d.precipProb !== null && <span className="muted small">☔{d.precipProb}%</span>}
              </li>
            );
          })}
        </ul>
      )}
      {days?.some((d) => d.tMax >= 32 || (d.precipProb ?? 0) >= 60) && (
        <p className="small warn">暑い日・雨の日があります。チャットで「雨の日の屋内案」や「昼に休憩を入れて」と相談できます。</p>
      )}
      <p className="attrib">Weather data by Open-Meteo.com</p>
    </div>
  );
}
