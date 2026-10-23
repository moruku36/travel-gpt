// Printable "旅のしおり": the active trip as a day-by-day booklet (browser print → PDF).
import { useEffect, useState } from 'react';
import type { Trip } from '@/lib/types';
import * as store from '@/lib/client/storage';
import { fromMinutes, isEveryone, schedule } from '@/lib/trip';
import { dayLabel, durationLabel, KIND_LABEL, MODE_LABEL, money } from '@/lib/format';
import { NOTE_TAGS } from './PlaceCard';
import { PREF_KINDS } from './Together';

export default function Booklet() {
  const [trip, setTrip] = useState<Trip | null>(null);
  useEffect(() => {
    const trips = store.loadTrips();
    const id = new URLSearchParams(window.location.search).get('trip') ?? store.activeTripId();
    setTrip((id && trips[id]) || Object.values(trips)[0] || null);
  }, []);

  if (!trip) return <p className="boot">保存された旅がありません。</p>;
  const names = new Map(trip.participants.map((p) => [p.id, p.name]));
  const total = Object.values(trip.stops).reduce((s, x) => s + (x.cost && x.cost.currency === trip.currency ? x.cost.amount : 0), 0);
  const shared = trip.preferences.filter((p) => p.visibility === 'shared');

  return (
    <main className="booklet">
      <div className="no-print row">
        <button className="btn primary" onClick={() => window.print()}>
          印刷 / PDF に保存
        </button>
        <a className="btn" href="/">
          ← 戻る
        </a>
      </div>
      <header>
        <h1>{trip.title}</h1>
        <p>
          {trip.destination}
          {trip.startDate ? ` ・ ${trip.startDate}${trip.endDate && trip.endDate !== trip.startDate ? ` 〜 ${trip.endDate}` : ''}` : ''}
          {' ・ '}
          {trip.participants.map((p) => p.name).join('、')}
        </p>
        {(trip.budget || total > 0) && (
          <p>
            費用（入力分・1人）: {money(total, trip.currency)}
            {trip.budget ? ` ／ 予算（全員）: ${money(trip.budget, trip.currency)}` : ''}
          </p>
        )}
      </header>

      {trip.days.map((d, i) => {
        const sched = schedule(trip, d);
        return (
          <section key={d.id} className="booklet-day">
            <h2>
              {dayLabel(i, d.date)} <small>{MODE_LABEL[d.mode]}</small>
            </h2>
            {sched.length === 0 && <p className="muted">予定なし</p>}
            <table>
              <tbody>
                {sched.map((s) => {
                  const stop = trip.stops[s.stopId];
                  const place = stop.placeId ? trip.places[stop.placeId] : undefined;
                  const notes = place ? trip.notes.filter((n) => n.placeId === place.id) : [];
                  return (
                    <tr key={s.stopId} className={s.branch ? 'branch' : ''}>
                      <td className="time">
                        {fromMinutes(s.start)}
                        <br />
                        <small>{durationLabel(s.end - s.start)}</small>
                      </td>
                      <td>
                        {s.rejoin && <div className="small">🤝 全員合流</div>}
                        <strong>{place?.name ?? KIND_LABEL[stop.kind]}</strong>
                        {!isEveryone(trip, stop) && <span className="small"> （{stop.participantIds!.map((id) => names.get(id)).join('・')}）</span>}
                        {place?.address && <div className="small muted">{place.address}</div>}
                        {place?.crowdNote && <div className="small">👥 {place.crowdNote}</div>}
                        {stop.note && <div className="small">📝 {stop.note}</div>}
                        {notes.map((n) => (
                          <div key={n.id} className="small">
                            {NOTE_TAGS[n.tag]} {n.text} — {names.get(n.authorId)}
                          </div>
                        ))}
                        {s.travelToNext > 0 && <div className="small muted">↓ 移動 約{durationLabel(s.travelToNext)}</div>}
                      </td>
                      <td className="cost">{stop.cost ? money(stop.cost.amount, stop.cost.currency) : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}

      {shared.length > 0 && (
        <section className="booklet-day">
          <h2>ふたりの約束ごと</h2>
          <ul>
            {shared.map((p) => (
              <li key={p.id}>
                {names.get(p.ownerId)}（{p.strength === 'required' ? '必須' : '希望'}）: {PREF_KINDS[p.kind].label}
                {PREF_KINDS[p.kind].numeric || p.kind === 'food' || p.kind === 'custom' ? ` ${p.value}${PREF_KINDS[p.kind].unit ?? ''}` : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
      <footer className="small muted">
        CoVoyager Travel Chat ・ 時刻と移動時間は概算です。営業時間・料金は公式情報で確認してください。地図データ © OpenStreetMap contributors
      </footer>
    </main>
  );
}
