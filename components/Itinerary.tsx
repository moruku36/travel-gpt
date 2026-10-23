import { useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Day, ID, StopKind, TransportMode, Trip } from '@/lib/types';
import type { TripAction } from '@/lib/trip';
import { candidates, fromMinutes, optimizeOrder, schedule } from '@/lib/trip';
import type { DayRoute } from '@/lib/client/useRoutes';
import { DAY_COLORS } from '@/lib/geo';
import { dayLabel, distanceLabel, durationLabel, KIND_LABEL, MODE_LABEL, money, STATUS_LABEL } from '@/lib/format';
import PlaceSearch, { type SearchHit } from './PlaceSearch';
import { votesText } from '@/lib/summary';

interface Props {
  trip: Trip;
  routes: Record<string, DayRoute>;
  activeDay: ID | 'all';
  onActiveDay: (d: ID | 'all') => void;
  selectedPlaceId: ID | null;
  onSelectPlace: (placeId: ID) => void;
  dispatch: (a: TripAction) => void;
  near?: { lng: number; lat: number };
  onAddSearchHit: (hit: SearchHit, dayId: ID | null) => void;
}

export default function Itinerary(props: Props) {
  const { trip, activeDay, onActiveDay } = props;
  const day = activeDay === 'all' ? undefined : trip.days.find((d) => d.id === activeDay);

  return (
    <section className="plan" aria-label="旅程">
      <div className="day-tabs" role="tablist">
        <button role="tab" aria-selected={activeDay === 'all'} className={activeDay === 'all' ? 'on' : ''} onClick={() => onActiveDay('all')}>
          全体
        </button>
        {trip.days.map((d, i) => (
          <button
            key={d.id}
            role="tab"
            aria-selected={activeDay === d.id}
            className={activeDay === d.id ? 'on' : ''}
            onClick={() => onActiveDay(d.id)}
            style={{ ['--day' as string]: DAY_COLORS[i % DAY_COLORS.length] }}
          >
            <span className="day-dot" />
            {dayLabel(i, d.date).replace(/^(\d+日目).*/, '$1')}
          </button>
        ))}
      </div>
      <div className="plan-body">
        {day ? <DayEditor {...props} day={day} /> : <Overview {...props} />}
        <Candidates {...props} />
      </div>
    </section>
  );
}

function Overview({ trip, routes, onActiveDay }: Props) {
  const totalCost = Object.values(trip.stops).reduce((s, x) => s + (x.cost && x.cost.currency === trip.currency ? x.cost.amount : 0), 0);
  return (
    <div className="overview">
      {trip.days.map((d, i) => {
        const sched = schedule(trip, d, routes[d.id]?.minutes);
        const end = sched.length ? sched[sched.length - 1].end : null;
        return (
          <button key={d.id} className="overview-day" onClick={() => onActiveDay(d.id)} style={{ ['--day' as string]: DAY_COLORS[i % DAY_COLORS.length] }}>
            <span className="day-dot" />
            <strong>{dayLabel(i, d.date)}</strong>
            <span className="muted">
              {d.stopIds.length ? `${d.stopIds.length}件 ・ ${d.startTime}〜${end !== null ? fromMinutes(end) : ''} ・ ${MODE_LABEL[d.mode]}` : '予定なし'}
            </span>
            <span className="overview-names">
              {d.stopIds
                .map((id) => trip.stops[id])
                .filter(Boolean)
                .map((s) => (s.placeId ? trip.places[s.placeId]?.name : KIND_LABEL[s.kind]))
                .join(' → ')}
            </span>
          </button>
        );
      })}
      <a className="btn small" href={`/print?trip=${encodeURIComponent(trip.id)}`} target="_blank" rel="noopener">
        🖨 旅のしおりを印刷 / PDF
      </a>
      {totalCost > 0 && (
        <p className="muted small">
          入力済みの費用合計: {money(totalCost, trip.currency)}
          {trip.budget ? ` / 予算 ${money(trip.budget, trip.currency)}` : ''}
        </p>
      )}
    </div>
  );
}

function DayEditor(props: Props & { day: Day }) {
  const { trip, day, routes, dispatch } = props;
  const index = trip.days.findIndex((d) => d.id === day.id);
  const route = routes[day.id];
  const sched = useMemo(() => schedule(trip, day, route?.minutes), [trip, day, route]);
  const byId = new Map(sched.map((s) => [s.stopId, s]));
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const to = day.stopIds.indexOf(String(e.over.id));
    dispatch({ type: 'moveStop', stopId: String(e.active.id), dayId: day.id, index: to });
  };

  const end = sched.length ? sched[sched.length - 1].end : null;
  const first = sched.length ? fromMinutes(sched[0].start) : day.startTime;
  const travelTotal = sched.reduce((s, x) => s + x.travelToNext, 0);
  const lateCount = sched.filter((s) => s.late).length;
  const longWalk = day.mode === 'walking' && (route?.distances ?? []).some((m) => (m ?? 0) > 3000);
  const optimized = optimizeOrder(trip, day);
  const canOptimize = optimized.some((id, i) => id !== day.stopIds[i]);

  return (
    <div className="day-editor">
      <div className="day-head">
        <h3 style={{ color: DAY_COLORS[index % DAY_COLORS.length] }}>{dayLabel(index, day.date)}</h3>
        <label className="field-inline">
          開始
          <input className="input time" type="time" value={day.startTime} onChange={(e) => e.target.value && dispatch({ type: 'updateDay', dayId: day.id, patch: { startTime: e.target.value } })} />
        </label>
        <label className="field-inline">
          移動
          <select className="input" value={day.mode} onChange={(e) => dispatch({ type: 'updateDay', dayId: day.id, patch: { mode: e.target.value as TransportMode } })}>
            {Object.entries(MODE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="muted small">
        {day.stopIds.length ? `${first}〜${end !== null ? fromMinutes(end) : ''} ・ 移動 ${durationLabel(travelTotal)}` : 'まだ予定がありません。チャットで相談するか、下で検索して追加してください。'}
        {route?.warning ? ` ・ ${route.warning}` : ''}
      </p>
      {lateCount > 0 && <p className="warn small">⚠ 開始時刻を指定した予定に間に合わない箇所が {lateCount} 件あります</p>}
      {end !== null && end > 22 * 60 && <p className="warn small">⚠ 22時を過ぎます。予定を減らすか別の日へ移しましょう</p>}
      {longWalk && (
        <p className="warn small">
          ⚠ 3km を超える徒歩移動があります。{' '}
          <button className="link" onClick={() => dispatch({ type: 'updateDay', dayId: day.id, patch: { mode: 'transit' } })}>
            電車・バスに切り替える
          </button>
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={day.stopIds} strategy={verticalListSortingStrategy}>
          <ol className="stops">
            {day.stopIds.map((id, i) => {
              const s = byId.get(id);
              const dist = route?.distances[i];
              return (
                <StopRow
                  key={id}
                  {...props}
                  stopId={id}
                  order={i + 1}
                  timeLabel={s ? `${fromMinutes(s.start)}–${fromMinutes(s.end)}` : ''}
                  late={s?.late ?? false}
                  branch={s?.branch ?? false}
                  rejoin={s?.rejoin ?? false}
                  travel={
                    s && s.travelToNext > 0
                      ? `${MODE_LABEL[day.mode]} ${durationLabel(s.travelToNext)}${dist ? ` ・ ${distanceLabel(dist)}` : ''}${s.travelEstimated || route?.estimated ? '（概算）' : ''}`
                      : null
                  }
                />
              );
            })}
          </ol>
        </SortableContext>
      </DndContext>

      <div className="day-actions">
        <button className="btn" onClick={() => dispatch({ type: 'addStop', placeId: null, dayId: day.id, kind: 'rest', durationMinutes: 30 })}>
          ☕ 休憩を追加
        </button>
        {canOptimize && (
          <button className="btn" onClick={() => dispatch({ type: 'setDayOrder', dayId: day.id, stopIds: optimized })} title="ロック・時刻指定・休憩は動かしません">
            🧭 回る順番を最適化
          </button>
        )}
      </div>
      <PlaceSearch near={props.near} onPick={(h) => props.onAddSearchHit(h, day.id)} />
    </div>
  );
}

function StopRow(props: Props & { day: Day; stopId: ID; order: number; timeLabel: string; late: boolean; branch: boolean; rejoin: boolean; travel: string | null }) {
  const { trip, day, stopId, dispatch } = props;
  const stop = trip.stops[stopId];
  const place = stop?.placeId ? trip.places[stop.placeId] : undefined;
  const [open, setOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stopId, disabled: stop?.locked });
  if (!stop) return null;
  const selected = place && place.id === props.selectedPlaceId;
  const votes = place ? votesText(trip, place.id) : undefined;
  const dayIndex = trip.days.findIndex((d) => d.id === day.id);
  const members = stop.participantIds?.length ? trip.participants.filter((p) => stop.participantIds!.includes(p.id)) : trip.participants;
  const toggleMember = (pid: ID) => {
    const current = stop.participantIds?.length ? stop.participantIds : trip.participants.map((p) => p.id);
    const next = current.includes(pid) ? current.filter((x) => x !== pid) : [...current, pid];
    if (next.length === 0) return; // someone has to go
    dispatch({ type: 'updateStop', stopId, patch: { participantIds: next.length === trip.participants.length ? undefined : next } });
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, ['--day' as string]: DAY_COLORS[dayIndex % DAY_COLORS.length] }}
      className={`stop ${isDragging ? 'dragging' : ''} ${selected ? 'selected' : ''} kind-${stop.kind} ${props.branch ? 'branch' : ''}`}
    >
      {props.rejoin && <div className="rejoin">🤝 ここで全員合流</div>}
      <div className="stop-main">
        <button className="handle" {...attributes} {...listeners} aria-label="ドラッグして並べ替え" disabled={stop.locked}>
          {stop.locked ? '🔒' : '⋮⋮'}
        </button>
        <span className="stop-num">{stop.kind === 'rest' ? '☕' : props.order}</span>
        <button className="stop-name" onClick={() => (place ? props.onSelectPlace(place.id) : setOpen((o) => !o))}>
          <span className={`stop-time ${props.late ? 'late' : ''}`}>{props.timeLabel}</span>
          <span className="stop-title">{place?.name ?? KIND_LABEL[stop.kind]}</span>
          {place && (
            <span className={`status status-${place.status}`} title={STATUS_LABEL[place.status].hint}>
              {STATUS_LABEL[place.status].text}
            </span>
          )}
          {votes && <span className="votes">{votes}</span>}
          {props.branch && (
            <span className="members-chip" title="別行動">
              👥 {members.map((m) => (
                <span key={m.id} style={{ color: m.color }}>
                  {m.name}
                </span>
              ))}
            </span>
          )}
        </button>
        <button className="icon" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="詳細を編集">
          ✎
        </button>
      </div>
      {open && (
        <div className="stop-edit">
          <label>
            開始時刻（固定）
            <input
              className="input time"
              type="time"
              value={stop.startTime ?? ''}
              onChange={(e) => dispatch({ type: 'updateStop', stopId, patch: { startTime: e.target.value || undefined } })}
            />
          </label>
          <label>
            滞在
            <select className="input" value={stop.durationMinutes} onChange={(e) => dispatch({ type: 'updateStop', stopId, patch: { durationMinutes: Number(e.target.value) } })}>
              {[15, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300, 480, stop.durationMinutes]
                .filter((v, i, a) => a.indexOf(v) === i)
                .sort((a, b) => a - b)
                .map((m) => (
                  <option key={m} value={m}>
                    {durationLabel(m)}
                  </option>
                ))}
            </select>
          </label>
          <label>
            種類
            <select className="input" value={stop.kind} onChange={(e) => dispatch({ type: 'updateStop', stopId, patch: { kind: e.target.value as StopKind } })}>
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            費用（1人）
            <input
              className="input"
              type="number"
              min={0}
              inputMode="numeric"
              value={stop.cost?.amount ?? ''}
              onChange={(e) =>
                dispatch({ type: 'updateStop', stopId, patch: { cost: e.target.value === '' ? undefined : { amount: Math.max(0, Number(e.target.value)), currency: trip.currency } } })
              }
            />
          </label>
          <label>
            移動先
            <select
              className="input"
              value={day.id}
              onChange={(e) => {
                const target = trip.days.find((d) => d.id === e.target.value);
                if (target) dispatch({ type: 'moveStop', stopId, dayId: target.id, index: target.stopIds.length });
              }}
            >
              {trip.days.map((d, i) => (
                <option key={d.id} value={d.id}>
                  {dayLabel(i, d.date)}
                </option>
              ))}
            </select>
          </label>
          <div className="wide">
            <span>行く人（外すと別行動）</span>
            <div className="chips compact">
              {trip.participants.map((p) => {
                const on = members.some((m) => m.id === p.id);
                return (
                  <button key={p.id} type="button" className={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggleMember(p.id)}>
                    {on ? '✓ ' : ''}
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="wide">
            メモ
            <input className="input" value={stop.note ?? ''} maxLength={500} onChange={(e) => dispatch({ type: 'updateStop', stopId, patch: { note: e.target.value || undefined } })} />
          </label>
          <div className="row wide">
            <button className="btn" onClick={() => dispatch({ type: 'updateStop', stopId, patch: { locked: !stop.locked } })}>
              {stop.locked ? '🔓 ロック解除' : '🔒 ロック（AI が変更しない）'}
            </button>
            <button className="btn danger" onClick={() => dispatch({ type: 'removeStop', stopId })}>
              旅程から外す
            </button>
          </div>
        </div>
      )}
      {stop.note && !open && <p className="stop-note">{stop.note}</p>}
      {props.travel && <div className="travel">↓ {props.travel}</div>}
    </li>
  );
}

function Candidates({ trip, activeDay, dispatch, onSelectPlace, selectedPlaceId, near, onAddSearchHit }: Props) {
  const list = candidates(trip);
  const targetDay = activeDay === 'all' ? trip.days[0] : trip.days.find((d) => d.id === activeDay);
  return (
    <div className="candidates">
      <h4>候補リスト（{list.length}）</h4>
      {list.length === 0 && <p className="muted small">地図のピンやチャットの候補を「候補に保存」するとここに並びます。</p>}
      <ul>
        {list.map((p) => (
          <li key={p.id} className={p.id === selectedPlaceId ? 'selected' : ''}>
            <button className="cand-name" onClick={() => onSelectPlace(p.id)}>
              {p.name}
              {votesText(trip, p.id) && <span className="votes">{votesText(trip, p.id)}</span>}
            </button>
            {targetDay && (
              <button className="btn small" onClick={() => dispatch({ type: 'addStop', placeId: p.id, dayId: targetDay.id })}>
                ＋{trip.days.indexOf(targetDay) + 1}日目
              </button>
            )}
            <button className="icon" aria-label="候補から削除" onClick={() => dispatch({ type: 'removePlace', placeId: p.id })}>
              ×
            </button>
          </li>
        ))}
      </ul>
      {activeDay === 'all' && <PlaceSearch near={near} onPick={(h) => onAddSearchHit(h, null)} placeholder="場所を検索して候補に追加" />}
    </div>
  );
}
