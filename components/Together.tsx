import { useMemo, useState } from 'react';
import type { ID, Participant, Preference, PreferenceKind, Trip } from '@/lib/types';
import type { TripAction } from '@/lib/trip';
import { newId, PARTICIPANT_COLORS } from '@/lib/trip';
import { agreement, checkTrip } from '@/lib/conflicts';
import type { DayRoute } from '@/lib/client/useRoutes';
import SharePanel, { type SyncControls } from './SharePanel';
import WeatherStrip from './WeatherStrip';

export const PREF_KINDS: Record<PreferenceKind, { label: string; unit?: string; numeric?: boolean }> = {
  'max-walk-km': { label: '1日の徒歩上限', unit: 'km', numeric: true },
  'rest-every-min': { label: '休憩の間隔', unit: '分ごと', numeric: true },
  'budget-per-day': { label: '1日の予算（1人）', numeric: true },
  'avoid-crowds': { label: '混雑は避けたい' },
  'avoid-heat': { label: '暑い時間の屋外は避けたい' },
  'early-bird': { label: '朝型' },
  'night-owl': { label: '夜型' },
  food: { label: '食の好み・苦手' },
  custom: { label: 'その他' },
};

interface Props {
  trip: Trip;
  me: Participant;
  dispatch: (a: TripAction) => void;
  routes: Record<string, DayRoute>;
  onSelectPlace: (id: ID) => void;
  sync: SyncControls;
}

export default function Together({ trip, me, dispatch, routes, onSelectPlace, sync }: Props) {
  const issues = useMemo(() => checkTrip(trip, routes, me.id), [trip, routes, me.id]);
  const board = useMemo(() => agreement(trip), [trip]);

  return (
    <section className="together" aria-label="ふたりで">
      <SharePanel trip={trip} sync={sync} />

      <div className="card">
        <h4>チェック結果 {issues.length === 0 && <span className="ok">✓ 問題なし</span>}</h4>
        <ul className="issues">
          {issues.map((i, k) => (
            <li key={k} className={`issue ${i.severity}`}>
              {i.placeId ? (
                <button className="link" onClick={() => onSelectPlace(i.placeId!)}>
                  {i.text}
                </button>
              ) : (
                i.text
              )}
            </li>
          ))}
        </ul>
        <p className="muted small">必須条件は自動で緩めません。外すか、条件を変えて相談してください。</p>
      </div>

      <div className="card">
        <h4>行きたい度ボード</h4>
        <Board title="♥ ふたりとも OK" ids={board.both} trip={trip} onSelect={onSelectPlace} />
        <Board title="⚖ 意見が分かれた" ids={board.split} trip={trip} onSelect={onSelectPlace} />
        <Board title="… まだ答えていない人がいる" ids={board.pending} trip={trip} onSelect={onSelectPlace} />
        <Board title="✕ 全員パス" ids={board.skipped} trip={trip} onSelect={onSelectPlace} />
        <p className="muted small">地図のピンを選んで「行きたい / どちらでも / パス」を押すとここに集まります。未回答は賛成として扱いません。</p>
      </div>

      <WeatherStrip trip={trip} />

      <Participants trip={trip} me={me} dispatch={dispatch} />
      <Preferences trip={trip} me={me} dispatch={dispatch} />
    </section>
  );
}

function Board({ title, ids, trip, onSelect }: { title: string; ids: ID[]; trip: Trip; onSelect: (id: ID) => void }) {
  if (ids.length === 0) return null;
  return (
    <div className="board">
      <div className="board-title">{title}</div>
      <div className="chips">
        {ids.map((id) => (
          <button key={id} className="chip" onClick={() => onSelect(id)}>
            {trip.places[id]?.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function Participants({ trip, me, dispatch }: { trip: Trip; me: Participant; dispatch: (a: TripAction) => void }) {
  return (
    <div className="card">
      <h4>メンバー</h4>
      <ul className="members">
        {trip.participants.map((p) => (
          <li key={p.id}>
            <input type="color" value={p.color} onChange={(e) => dispatch({ type: 'upsertParticipant', participant: { ...p, color: e.target.value } })} aria-label={`${p.name}の色`} />
            <input className="input" value={p.name} maxLength={40} onChange={(e) => dispatch({ type: 'upsertParticipant', participant: { ...p, name: e.target.value || '?' } })} aria-label="名前" />
            {p.id === me.id && <span className="badge">あなた</span>}
            {trip.participants.length > 1 && p.id !== me.id && (
              <button className="icon" aria-label={`${p.name}を外す`} onClick={() => confirm(`${p.name}をメンバーから外しますか？（その人の条件と意見も消えます）`) && dispatch({ type: 'removeParticipant', participantId: p.id })}>
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {trip.participants.length < 8 && (
        <button
          className="btn small"
          onClick={() =>
            dispatch({ type: 'upsertParticipant', participant: { id: newId(), name: `メンバー${trip.participants.length + 1}`, color: PARTICIPANT_COLORS[trip.participants.length % PARTICIPANT_COLORS.length] } })
          }
        >
          ＋ メンバーを追加
        </button>
      )}
    </div>
  );
}

function Preferences({ trip, me, dispatch }: { trip: Trip; me: Participant; dispatch: (a: TripAction) => void }) {
  const [kind, setKind] = useState<PreferenceKind>('max-walk-km');
  const [value, setValue] = useState('');
  const [strength, setStrength] = useState<Preference['strength']>('preferred');
  const [visibility, setVisibility] = useState<Preference['visibility']>('shared');
  const [aiConsent, setAiConsent] = useState(false);
  const meta = PREF_KINDS[kind];
  const names = new Map(trip.participants.map((p) => [p.id, p.name]));
  const mine = trip.preferences.filter((p) => p.ownerId === me.id);
  const othersShared = trip.preferences.filter((p) => p.ownerId !== me.id && p.visibility === 'shared');
  const othersPrivate = trip.preferences.filter((p) => p.ownerId !== me.id && p.visibility === 'private').length;

  const add = () => {
    const v = meta.numeric ? String(Math.max(0, Number(value) || 0)) : value.trim() || meta.label;
    if (meta.numeric && !Number(value)) return;
    dispatch({ type: 'upsertPreference', pref: { id: newId(), ownerId: me.id, kind, strength, value: v.slice(0, 200), visibility, aiConsent: visibility === 'private' ? aiConsent : undefined } });
    setValue('');
  };

  const row = (p: Preference, editable: boolean) => (
    <li key={p.id} className={`pref ${p.strength}`}>
      <span className="pref-strength">{p.strength === 'required' ? '必須' : '希望'}</span>
      <span>
        {PREF_KINDS[p.kind].label}
        {PREF_KINDS[p.kind].numeric || p.kind === 'food' || p.kind === 'custom' ? `: ${p.value}${PREF_KINDS[p.kind].unit ?? ''}` : ''}
      </span>
      {!editable && <span className="muted small">— {names.get(p.ownerId)}</span>}
      {editable && <span className="badge">{p.visibility === 'private' ? (p.aiConsent ? '🔒 自分だけ・AIに抽象化して渡す' : '🔒 自分だけ') : '共有'}</span>}
      {editable && (
        <button className="icon" aria-label="条件を削除" onClick={() => dispatch({ type: 'removePreference', prefId: p.id })}>
          ×
        </button>
      )}
    </li>
  );

  return (
    <div className="card">
      <h4>条件・希望</h4>
      <p className="muted small">理由は書かなくて大丈夫です。「自分だけ」の条件は相手の画面・共有リンク・書き出しに出ません。</p>
      <h5>{me.name}（あなた）</h5>
      <ul className="prefs">{mine.map((p) => row(p, true))}</ul>
      <div className="pref-form">
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value as PreferenceKind)} aria-label="条件の種類">
          {Object.entries(PREF_KINDS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        {(meta.numeric || kind === 'food' || kind === 'custom') && (
          <input
            className="input"
            value={value}
            inputMode={meta.numeric ? 'numeric' : 'text'}
            maxLength={200}
            onChange={(e) => setValue(e.target.value)}
            placeholder={meta.numeric ? `数値${meta.unit ? `（${meta.unit}）` : ''}` : '内容'}
          />
        )}
        <select className="input" value={strength} onChange={(e) => setStrength(e.target.value as Preference['strength'])} aria-label="強さ">
          <option value="preferred">希望</option>
          <option value="required">必須</option>
        </select>
        <select className="input" value={visibility} onChange={(e) => setVisibility(e.target.value as Preference['visibility'])} aria-label="公開範囲">
          <option value="shared">ふたりで共有</option>
          <option value="private">自分だけ</option>
        </select>
        {visibility === 'private' && (
          <label className="consent small">
            <input type="checkbox" checked={aiConsent} onChange={(e) => setAiConsent(e.target.checked)} />
            名前を伏せて AI の提案に反映してよい（いつでも取り消せます）
          </label>
        )}
        <button className="btn small primary" onClick={add}>
          追加
        </button>
      </div>
      {othersShared.length > 0 && (
        <>
          <h5>相手の共有条件</h5>
          <ul className="prefs">{othersShared.map((p) => row(p, false))}</ul>
        </>
      )}
      {othersPrivate > 0 && <p className="muted small">ほかのメンバーの非公開条件が {othersPrivate} 件あります（内容は表示されません）。</p>}
    </div>
  );
}
