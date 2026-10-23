// Deterministic checks of the itinerary against each traveller's conditions.
// The LLM never decides whether a required condition is met — this module does.
import type { ID, Preference, Trip } from './types';
import { schedule } from './trip';

export interface Issue {
  severity: 'error' | 'warn' | 'info';
  text: string;
  dayId?: ID;
  placeId?: ID;
  /** Shown only to this participant (their private condition). */
  privateTo?: ID;
}

const OUTDOOR = /park|garden|beach|hike|nature|walk|viewpoint|公園|庭園|海|山|展望/i;

export interface DayStats {
  dayId: ID;
  start: number | null;
  end: number | null;
  walkingMeters: number;
  cost: number;
}

export function dayStats(trip: Trip, routes: Record<ID, { minutes: (number | null)[]; distances: (number | null)[] } | undefined>): DayStats[] {
  return trip.days.map((d) => {
    const r = routes[d.id];
    const sched = schedule(trip, d, r?.minutes);
    const walkingMeters = d.mode === 'walking' ? (r?.distances ?? []).reduce<number>((s, x) => s + (x ?? 0), 0) : 0;
    const cost = d.stopIds.reduce((s, id) => {
      const c = trip.stops[id]?.cost;
      return s + (c && c.currency === trip.currency ? c.amount : 0);
    }, 0);
    return { dayId: d.id, start: sched[0]?.start ?? null, end: sched.length ? sched[sched.length - 1].end : null, walkingMeters, cost };
  });
}

export function checkTrip(
  trip: Trip,
  routes: Record<ID, { minutes: (number | null)[]; distances: (number | null)[] } | undefined>,
  viewerId: ID,
): Issue[] {
  const issues: Issue[] = [];
  const names = new Map(trip.participants.map((p) => [p.id, p.name]));
  const stats = dayStats(trip, routes);
  const people = trip.participants.length;

  // Preferences visible to this viewer: everyone's shared ones + the viewer's own private ones.
  const prefs = trip.preferences.filter((p) => p.visibility === 'shared' || p.ownerId === viewerId);
  const label = (p: Preference) => (p.visibility === 'private' ? 'あなたの非公開条件' : `${names.get(p.ownerId) ?? '?'}の${p.strength === 'required' ? '必須' : '希望'}`);
  const sev = (p: Preference): Issue['severity'] => (p.strength === 'required' ? 'error' : 'warn');
  const priv = (p: Preference) => (p.visibility === 'private' ? p.ownerId : undefined);

  trip.days.forEach((d, i) => {
    const st = stats[i];
    const dayName = `${i + 1}日目`;
    const sched = schedule(trip, d, routes[d.id]?.minutes);
    if (st.end !== null && st.end > 22 * 60) issues.push({ severity: 'warn', dayId: d.id, text: `${dayName}は22時を過ぎます` });
    if (sched.some((s) => s.late)) issues.push({ severity: 'warn', dayId: d.id, text: `${dayName}に時刻指定へ間に合わない予定があります` });

    for (const p of prefs) {
      const num = Number(p.value);
      if (p.kind === 'max-walk-km' && Number.isFinite(num) && st.walkingMeters > num * 1000) {
        issues.push({ severity: sev(p), dayId: d.id, privateTo: priv(p), text: `${dayName}の徒歩 ${(st.walkingMeters / 1000).toFixed(1)}km が${label(p)}（${num}km まで）を超えています` });
      }
      if (p.kind === 'rest-every-min' && Number.isFinite(num) && num > 0) {
        let run = 0;
        let worst = 0;
        for (const s of sched) {
          const stop = trip.stops[s.stopId];
          if (stop?.kind === 'rest' || stop?.kind === 'meal') run = 0;
          else run += s.end - s.start + s.travelToNext;
          worst = Math.max(worst, run);
        }
        if (worst > num) issues.push({ severity: sev(p), dayId: d.id, privateTo: priv(p), text: `${dayName}は休憩なしで ${Math.round(worst)}分続きます（${label(p)}: ${num}分ごとに休憩）` });
      }
      if (p.kind === 'budget-per-day' && Number.isFinite(num) && st.cost > num) {
        issues.push({ severity: sev(p), dayId: d.id, privateTo: priv(p), text: `${dayName}の費用（1人 ${st.cost}）が${label(p)}（${num}）を超えています` });
      }
      if (p.kind === 'night-owl' && st.start !== null && st.start < 8 * 60) {
        issues.push({ severity: sev(p), dayId: d.id, privateTo: priv(p), text: `${dayName}は朝が早めです（${label(p)}: 夜型）` });
      }
      if (p.kind === 'early-bird' && st.end !== null && st.end > 21 * 60) {
        issues.push({ severity: sev(p), dayId: d.id, privateTo: priv(p), text: `${dayName}は夜遅くまで続きます（${label(p)}: 朝型）` });
      }
      if (p.kind === 'avoid-crowds' || p.kind === 'avoid-heat') {
        for (const s of sched) {
          const stop = trip.stops[s.stopId];
          const place = stop?.placeId ? trip.places[stop.placeId] : undefined;
          if (!place) continue;
          const crowded = place.crowd === 'high' || trip.notes.some((n) => n.placeId === place.id && n.tag === 'crowded');
          if (p.kind === 'avoid-crowds' && crowded) issues.push({ severity: sev(p) === 'error' ? 'warn' : 'info', dayId: d.id, placeId: place.id, privateTo: priv(p), text: `「${place.name}」は混みやすい場所です（${label(p)}: 混雑回避）${place.crowdNote ? ` → ${place.crowdNote}` : ''}` });
          const midday = s.start < 15 * 60 && s.end > 12 * 60;
          if (p.kind === 'avoid-heat' && midday && OUTDOOR.test(`${place.category ?? ''} ${place.name}`)) issues.push({ severity: sev(p) === 'error' ? 'warn' : 'info', dayId: d.id, placeId: place.id, privateTo: priv(p), text: `「${place.name}」が日中の屋外です（${label(p)}: 暑さ回避）` });
        }
      }
    }

    // someone said "pass" but it is still on the plan
    for (const id of d.stopIds) {
      const placeId = trip.stops[id]?.placeId;
      if (!placeId) continue;
      const r = trip.reactions[placeId] ?? {};
      const skippers = Object.entries(r).filter(([, v]) => v === 'skip').map(([pid]) => names.get(pid) ?? '?');
      if (skippers.length) issues.push({ severity: 'warn', dayId: d.id, placeId, text: `「${trip.places[placeId]?.name}」は${skippers.join('・')}がパス。別行動か差し替えを相談しましょう` });
      const avoid = trip.notes.find((n) => n.placeId === placeId && n.tag === 'avoid');
      if (avoid) issues.push({ severity: 'warn', dayId: d.id, placeId, text: `「${trip.places[placeId]?.name}」に「行かない方がいい」メモがあります${avoid.text ? `: ${avoid.text}` : ''}` });
    }
  });

  if (trip.budget) {
    const total = stats.reduce((s, x) => s + x.cost, 0) * people;
    if (total > trip.budget) issues.push({ severity: 'error', text: `入力済み費用の合計（${people}人分 ${Math.round(total)} ${trip.currency}）が予算 ${trip.budget} を超えています` });
  }

  return issues.filter((i) => !i.privateTo || i.privateTo === viewerId);
}

/** Group places by agreement state for the "ふたりで" board. */
export function agreement(trip: Trip): { both: ID[]; split: ID[]; pending: ID[]; skipped: ID[] } {
  const out = { both: [] as ID[], split: [] as ID[], pending: [] as ID[], skipped: [] as ID[] };
  const ids = trip.participants.map((p) => p.id);
  for (const place of Object.values(trip.places)) {
    if (place.category === 'destination') continue;
    const r = trip.reactions[place.id] ?? {};
    const vals = ids.map((id) => r[id]);
    if (vals.every((v) => v === 'skip')) out.skipped.push(place.id);
    else if (vals.some((v) => v === undefined)) out.pending.push(place.id);
    else if (vals.includes('skip')) out.split.push(place.id);
    else out.both.push(place.id);
  }
  return out;
}
