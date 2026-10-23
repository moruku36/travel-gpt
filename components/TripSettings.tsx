import { useRef, useState } from 'react';
import type { Pace, Trip } from '@/lib/types';
import type { TripAction } from '@/lib/trip';

const INTERESTS = ['グルメ', 'カフェ', '寺社・歴史', '美術館', '自然・絶景', '温泉', '海・ビーチ', '買い物', '夜景', 'テーマパーク', '写真映え', 'のんびり'];
const CURRENCIES = ['JPY', 'USD', 'EUR', 'KRW', 'TWD', 'THB', 'GBP', 'AUD', 'CNY', 'SGD', 'HKD', 'VND'];

interface Props {
  trip: Trip;
  trips: Trip[];
  dispatch: (a: TripAction) => void;
  onClose: () => void;
  onNewTrip: () => void;
  onSwitchTrip: (id: string) => void;
  onDeleteTrip: (id: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onWipe: () => void;
}

export default function TripSettings({ trip, trips, dispatch, onClose, onNewTrip, onSwitchTrip, onDeleteTrip, onExport, onImport, onWipe }: Props) {
  const [custom, setCustom] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const meta = (patch: Extract<TripAction, { type: 'meta' }>['patch']) => dispatch({ type: 'meta', patch });
  const toggle = (i: string) => meta({ interests: trip.interests.includes(i) ? trip.interests.filter((x) => x !== i) : [...trip.interests, i].slice(0, 20) });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="旅の設定" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>旅の設定</h2>
          <button className="icon close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className="form-grid">
          <label className="wide">
            タイトル
            <input className="input" value={trip.title} maxLength={200} onChange={(e) => meta({ title: e.target.value })} />
          </label>
          <label className="wide">
            行き先（未定なら空欄でOK。チャットの「行き先探し」で相談できます）
            <input className="input" value={trip.destination} maxLength={200} placeholder="例: 京都 / ソウル / パリとロンドン" onChange={(e) => meta({ destination: e.target.value })} />
          </label>
          <label>
            出発日
            <input className="input" type="date" value={trip.startDate ?? ''} onChange={(e) => meta({ startDate: e.target.value || undefined, endDate: trip.endDate && e.target.value > trip.endDate ? e.target.value : trip.endDate })} />
          </label>
          <label>
            最終日
            <input className="input" type="date" value={trip.endDate ?? ''} min={trip.startDate} onChange={(e) => meta({ endDate: e.target.value || undefined })} />
          </label>
          <label>
            予算（ふたり合計）
            <input className="input" type="number" min={0} inputMode="numeric" value={trip.budget ?? ''} onChange={(e) => meta({ budget: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} />
          </label>
          <label>
            通貨
            <select className="input" value={trip.currency} onChange={(e) => meta({ currency: e.target.value })}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="wide">
            ペース
            <div className="segmented">
              {(
                [
                  ['relaxed', 'ゆったり'],
                  ['normal', 'ふつう'],
                  ['packed', 'たくさん回る'],
                ] as [Pace, string][]
              ).map(([v, l]) => (
                <button key={v} type="button" className={trip.pace === v ? 'on' : ''} onClick={() => meta({ pace: v })}>
                  {l}
                </button>
              ))}
            </div>
          </label>
          <div className="wide">
            <span className="label">ふたりの興味</span>
            <div className="chips">
              {[...INTERESTS, ...trip.interests.filter((i) => !INTERESTS.includes(i))].map((i) => (
                <button key={i} type="button" className={`chip ${trip.interests.includes(i) ? 'on' : ''}`} onClick={() => toggle(i)} aria-pressed={trip.interests.includes(i)}>
                  {i}
                </button>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = custom.trim().slice(0, 60);
                  if (v && !trip.interests.includes(v)) toggle(v);
                  setCustom('');
                }}
              >
                <input className="input chip-input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="＋追加" aria-label="興味を追加" />
              </form>
            </div>
          </div>
        </div>

        <h3>保存した旅</h3>
        <ul className="trip-list">
          {trips.map((t) => (
            <li key={t.id} className={t.id === trip.id ? 'on' : ''}>
              <button onClick={() => onSwitchTrip(t.id)}>
                {t.title || '(無題)'} <span className="muted small">{t.startDate ?? ''}</span>
              </button>
              {t.id !== trip.id && (
                <button className="icon" aria-label="この旅を削除" onClick={() => confirm(`「${t.title}」を削除しますか？`) && onDeleteTrip(t.id)}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="row wrap">
          <button className="btn" onClick={onNewTrip}>
            ＋ 新しい旅
          </button>
          <button className="btn" onClick={onExport}>
            JSON で書き出す
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            JSON を読み込む
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImport(f);
              e.target.value = '';
            }}
          />
          <button className="btn danger" onClick={() => confirm('この端末に保存した旅・会話・設定をすべて削除します。よろしいですか？') && onWipe()}>
            端末のデータを全削除
          </button>
        </div>
        <p className="muted small">
          旅程はこの端末のブラウザに保存されます。書き出し・共有には「自分だけ」の条件は含まれません。
        </p>
      </div>
    </div>
  );
}
