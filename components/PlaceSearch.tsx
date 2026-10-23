import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';

export interface SearchHit {
  name: string;
  lng: number;
  lat: number;
  address: string;
  countryCode: string;
  category: string;
  sourceRef: string;
}

interface Props {
  near?: { lng: number; lat: number };
  onPick: (hit: SearchHit) => void;
  placeholder?: string;
}

/** OpenStreetMap search with debounce: requests start after 2 characters and 350 ms idle. */
export default function PlaceSearch({ near, onPick, placeholder }: Props) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'empty' | 'error'>('idle');

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      setState('idle');
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setState('loading');
      try {
        const r = await api.geocode(query, near);
        if (cancelled) return;
        setHits(r.candidates);
        setState(r.candidates.length ? 'idle' : 'empty');
      } catch {
        if (!cancelled) setState('error');
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // near changes on every map move; only the text should trigger a search
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="search">
      <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder ?? '場所を検索して追加（例: 金閣寺）'} aria-label="場所を検索" />
      {state === 'loading' && <div className="search-note">検索中…</div>}
      {state === 'empty' && <div className="search-note">見つかりませんでした</div>}
      {state === 'error' && <div className="search-note">検索サービスに接続できません</div>}
      {hits.length > 0 && (
        <ul className="search-results" role="listbox">
          {hits.map((h) => (
            <li key={h.sourceRef + h.lng}>
              <button
                onClick={() => {
                  onPick(h);
                  setQ('');
                  setHits([]);
                }}
              >
                <strong>{h.name}</strong>
                <span>{h.address}</span>
              </button>
            </li>
          ))}
          <li className="search-attrib">© OpenStreetMap contributors</li>
        </ul>
      )}
    </div>
  );
}
