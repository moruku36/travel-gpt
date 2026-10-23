import { useState } from 'react';
import type { Trip } from '@/lib/types';
import { joinUrl, snapshotUrl, type SyncLink, type SyncStatus } from '@/lib/client/sync';

export interface SyncControls {
  link: SyncLink | null;
  status: SyncStatus;
  start: () => SyncLink;
  stop: () => void;
}

const STATUS: Record<SyncStatus, string> = {
  off: '共有していません',
  syncing: '同期を開始しています…',
  live: '● 同期中（数秒ごとに相手の変更を反映）',
  offline: 'オフライン（端末に保存し、つながったら送ります）',
  error: '同期できません。リンクを作り直してください',
};

async function shareOrCopy(url: string, title: string): Promise<string> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return '共有しました';
    } catch {
      // cancelled → fall back to copy
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'リンクをコピーしました';
  } catch {
    window.prompt('このリンクをコピーしてください', url);
    return '';
  }
}

export default function SharePanel({ trip, sync }: { trip: Trip; sync: SyncControls }) {
  const [msg, setMsg] = useState('');
  return (
    <div className="card share">
      <h4>相手と共有</h4>
      <p className={`sync-status ${sync.status}`}>{STATUS[sync.status]}</p>
      <div className="row wrap">
        {sync.link ? (
          <>
            <button className="btn primary" onClick={async () => setMsg(await shareOrCopy(joinUrl(sync.link!), trip.title))}>
              招待リンクを送る
            </button>
            <button className="btn" onClick={() => confirm('この端末での同期を止めますか？（相手の旅程は残ります）') && sync.stop()}>
              同期を止める
            </button>
          </>
        ) : (
          <button
            className="btn primary"
            onClick={async () => {
              const l = sync.start();
              setMsg(await shareOrCopy(joinUrl(l), trip.title));
            }}
          >
            ライブ共有を始める
          </button>
        )}
        <button className="btn" onClick={async () => setMsg(await shareOrCopy(await snapshotUrl(trip), trip.title))}>
          今の旅程をリンクで送る
        </button>
      </div>
      {msg && <p className="small ok">{msg}</p>}
      <p className="muted small">
        リンクを知っている人は旅程を見て編集できます。「自分だけ」の条件はどちらの方法でも送られません。ライブ共有の保存期間は最後の更新から 60 日です。
      </p>
    </div>
  );
}
