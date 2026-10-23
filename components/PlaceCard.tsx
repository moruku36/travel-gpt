import { useState } from 'react';
import type { ID, NoteTag, Participant, Place, ReactionValue, SuggestedPlace, Trip } from '@/lib/types';
import type { TripAction } from '@/lib/trip';
import { dayOfStop } from '@/lib/trip';
import { CROWD_LABEL, dayLabel, durationLabel, money, STATUS_LABEL } from '@/lib/format';

export const NOTE_TAGS: Record<NoteTag, string> = {
  crowded: '😵 混んでた/混みそう',
  quiet: '🍃 静か',
  reserve: '📅 要予約',
  'rainy-ok': '☔ 雨でもOK',
  must: '⭐ 絶対行きたい',
  avoid: '🙅 行かない方がいい',
  memo: '📝 メモ',
};

const REACTIONS: [ReactionValue, string][] = [
  ['want', '行きたい'],
  ['ok', 'どちらでも'],
  ['skip', 'パス'],
];

export type CardItem = { kind: 'place'; place: Place } | { kind: 'suggestion'; place: SuggestedPlace; messageId: string };

interface Props {
  item: CardItem;
  trip: Trip;
  me: Participant | undefined;
  dispatch: (a: TripAction) => void;
  /** Save a suggestion as a candidate and return its place id. */
  onSave: (item: CardItem) => ID;
  onClose: () => void;
  onAsk: (text: string) => void;
}

export default function PlaceCard({ item, trip, me, dispatch, onSave, onClose, onAsk }: Props) {
  const [noteTag, setNoteTag] = useState<NoteTag>('memo');
  const [noteText, setNoteText] = useState('');
  const p = item.place;
  const placeId = item.kind === 'place' ? item.place.id : null;
  const stops = placeId ? Object.values(trip.stops).filter((s) => s.placeId === placeId) : [];
  const notes = placeId ? trip.notes.filter((n) => n.placeId === placeId) : [];
  const reactions = placeId ? trip.reactions[placeId] ?? {} : {};
  const cost = item.kind === 'suggestion' && item.place.cost !== null ? money(item.place.cost, item.place.currency ?? trip.currency) : null;

  const ensureId = () => placeId ?? onSave(item);

  return (
    <div className="place-card" role="dialog" aria-label={p.name}>
      <button className="icon close" onClick={onClose} aria-label="閉じる">
        ×
      </button>
      <h3>{p.name}</h3>
      <div className="badges">
        <span className={`status status-${p.status}`} title={STATUS_LABEL[p.status].hint}>
          {STATUS_LABEL[p.status].text}
        </span>
        {p.category && <span className="badge">{p.category}</span>}
        {p.crowd && <span className={`badge crowd-${p.crowd}`}>{CROWD_LABEL[p.crowd]}</span>}
        {item.kind === 'suggestion' && item.place.durationMinutes > 0 && item.place.category !== 'destination' && (
          <span className="badge">目安 {durationLabel(item.place.durationMinutes)}</span>
        )}
        {cost && <span className="badge">約 {cost}</span>}
      </div>
      {p.why && <p className="why">{p.why}</p>}
      {p.crowdNote && <p className="small">👥 {p.crowdNote}</p>}
      {p.address && <p className="muted small">{p.address}</p>}
      {p.status === 'estimated' && <p className="warn small">位置は AI の推定です。地図上の位置と実在を確認してください。</p>}

      <div className="reactions" role="group" aria-label="意見">
        {trip.participants.map((pt) => (
          <span key={pt.id} className="reaction-who" style={{ color: pt.color }}>
            {pt.name}: {REACTIONS.find(([v]) => v === reactions[pt.id])?.[1] ?? '—'}
          </span>
        ))}
        {me && (
          <div className="segmented small">
            {REACTIONS.map(([v, label]) => (
              <button
                key={v}
                className={reactions[me.id] === v ? 'on' : ''}
                onClick={() => {
                  const id = ensureId();
                  dispatch({ type: 'react', placeId: id, participantId: me.id, value: reactions[me.id] === v ? null : v });
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {notes.length > 0 && (
        <ul className="notes">
          {notes.map((n) => {
            const author = trip.participants.find((x) => x.id === n.authorId);
            return (
              <li key={n.id}>
                <span>{NOTE_TAGS[n.tag]}</span> {n.text} <span className="muted small" style={{ color: author?.color }}>— {author?.name ?? '?'}</span>
                {me?.id === n.authorId && (
                  <button className="icon" aria-label="メモを削除" onClick={() => dispatch({ type: 'removeNote', noteId: n.id })}>
                    ×
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {me && (
        <form
          className="note-form"
          onSubmit={(e) => {
            e.preventDefault();
            const id = ensureId();
            dispatch({ type: 'addNote', placeId: id, authorId: me.id, tag: noteTag, text: noteText.trim() });
            setNoteText('');
          }}
        >
          <select className="input" value={noteTag} onChange={(e) => setNoteTag(e.target.value as NoteTag)} aria-label="メモの種類">
            {Object.entries(NOTE_TAGS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <input className="input" value={noteText} maxLength={300} onChange={(e) => setNoteText(e.target.value)} placeholder="ひとこと（例: 土日は行列）" />
          <button className="btn small">共有</button>
        </form>
      )}

      <div className="row wrap">
        {item.kind === 'suggestion' && (
          <button className="btn" onClick={() => onSave(item)}>
            ☆ 候補に保存
          </button>
        )}
        {trip.days.map((d, i) => (
          <button key={d.id} className="btn small" onClick={() => dispatch({ type: 'addStop', placeId: ensureId(), dayId: d.id, durationMinutes: item.kind === 'suggestion' ? item.place.durationMinutes || undefined : undefined })}>
            ＋{dayLabel(i, d.date).split(' ')[0]}
          </button>
        ))}
        <button className="btn small ghost" onClick={() => onAsk(`「${p.name}」について、行く時間帯や近くで一緒に回れる所を教えて`)}>
          💬 AI に聞く
        </button>
      </div>
      {stops.length > 0 && (
        <p className="muted small">
          旅程: {stops.map((s) => {
            const d = dayOfStop(trip, s.id);
            return d ? `${trip.days.indexOf(d) + 1}日目` : '';
          }).join('・')}
        </p>
      )}
      <p className="attrib">
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.lat},${p.lng}`)}`} target="_blank" rel="noopener noreferrer">
          Google マップで確認
        </a>
        {' ・ '}
        <a href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`} target="_blank" rel="noopener noreferrer">
          OSM
        </a>
      </p>
    </div>
  );
}
