import type { Crowd, PlaceStatus, ProposalOp, StopKind, SuggestedPlace, TransportMode, Trip } from './types';

export function durationLabel(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m}分`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}時間${r}分` : `${h}時間`;
}

export function distanceLabel(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)}km`;
}

export function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

export function dayLabel(index: number, date?: string): string {
  if (!date) return `${index + 1}日目`;
  const d = new Date(`${date}T00:00:00Z`);
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getUTCDay()];
  return `${index + 1}日目 ${d.getUTCMonth() + 1}/${d.getUTCDate()}(${w})`;
}

export const MODE_LABEL: Record<TransportMode, string> = {
  walking: '徒歩',
  transit: '電車・バス',
  driving: '車',
  cycling: '自転車',
};

export const KIND_LABEL: Record<StopKind, string> = {
  visit: '観光',
  meal: '食事',
  rest: '休憩',
  stay: '宿泊',
  transfer: '移動',
};

export const STATUS_LABEL: Record<PlaceStatus, { text: string; hint: string }> = {
  verified: { text: '位置確認済み', hint: 'OpenStreetMap で近くに同名の場所が見つかりました' },
  estimated: { text: 'AI 推定', hint: 'AI の推定位置です。実在・位置を確認してください' },
  manual: { text: '手動追加', hint: '自分で検索して追加した場所です' },
};

export const CROWD_LABEL: Record<Crowd, string> = {
  low: '空いている傾向',
  medium: 'ふつう',
  high: '混みやすい',
  unknown: '混雑不明',
};

export function describeOp(op: ProposalOp, trip: Trip, places: SuggestedPlace[]): string {
  const day = op.dayIndex !== null ? `${op.dayIndex + 1}日目` : '';
  const stop = op.stopId ? trip.stops[op.stopId] : undefined;
  const stopName = stop ? (stop.placeId ? trip.places[stop.placeId]?.name : '休憩') ?? '予定' : '予定';
  switch (op.type) {
    case 'add_stop': {
      const p = places.find((x) => x.ref === op.placeRef);
      return `＋ ${day}に「${p?.name ?? '?'}」${op.startTime ? ` ${op.startTime}〜` : ''}${op.durationMinutes ? `（${durationLabel(op.durationMinutes)}）` : ''}`;
    }
    case 'add_rest':
      return `＋ ${day}に休憩 ${durationLabel(op.durationMinutes ?? 30)}`;
    case 'remove_stop':
      return `− 「${stopName}」を外す`;
    case 'move_stop':
      return `↕ 「${stopName}」を${day}へ`;
    case 'set_time':
      return `🕒 「${stopName}」${op.startTime ? ` ${op.startTime}開始` : ''}${op.durationMinutes ? ` ${durationLabel(op.durationMinutes)}` : ''}`;
  }
}
