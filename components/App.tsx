import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { ChatMessage, ID, Place, Trip } from '@/lib/types';
import { applyProposal, candidates, createTrip, findSimilarPlace, newId, placeFromSuggestion, reduceHistory, type History, type TripAction } from '@/lib/trip';
import { buildTripSummary } from '@/lib/summary';
import { api, ClientApiError } from '@/lib/client/api';
import * as store from '@/lib/client/storage';
import { useRoutes } from '@/lib/client/useRoutes';
import { DAY_COLORS } from '@/lib/geo';
import type { MapFocus, MapPin, RouteLine } from './MapView';
import ChatPanel, { type ChatMode } from './ChatPanel';
import Itinerary from './Itinerary';
import PlaceCard, { type CardItem } from './PlaceCard';
import TripSettings from './TripSettings';
import type { SearchHit } from './PlaceSearch';
import Together from './Together';
import { fetchRoom, parseJoinHash, parseSnapshotHash, rememberLink, useSync } from '@/lib/client/sync';

const MapView = dynamic(() => import('./MapView'), { ssr: false, loading: () => <div className="map-wrap map-loading">地図を読み込み中…</div> });

type Tab = 'chat' | 'plan' | 'together';

function initialHistory(): History {
  const trips = store.loadTrips();
  const active = store.activeTripId();
  const trip = (active && trips[active]) || Object.values(trips)[0] || createTrip();
  return { past: [], present: trip, future: [] };
}

export default function App() {
  const [history, dispatchHistory] = useReducer(reduceHistory, undefined, initialHistory);
  const trip = history.present;
  const dispatch = useCallback((a: TripAction) => dispatchHistory(a), []);
  const [messages, setMessages] = useState<ChatMessage[]>(() => store.loadChat(trip.id));
  const [meId, setMeId] = useState<ID>(() => store.loadMe(trip.id) ?? trip.participants[0].id);
  const [selected, setSelected] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<ID | 'all'>('all');
  const [focus, setFocus] = useState<MapFocus | null>(null);
  const [tab, setTab] = useState<Tab>('chat');
  const [mapLarge, setMapLarge] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(() => Object.keys(store.loadTrips()).length === 0);
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [health, setHealth] = useState<{ llm: 'openai' | 'demo'; accessCodeRequired: boolean } | null>(null);
  const [hasCode, setHasCode] = useState(() => Boolean(store.readAccessCode()));
  const viewport = useRef<{ lng: number; lat: number; zoom: number } | undefined>(undefined);
  const [fitSeq, setFitSeq] = useState(0);
  const routes = useRoutes(trip);
  const sync = useSync({ trip, onRemote: (t) => dispatchHistory({ type: 'replace', trip: t }) });
  const me = trip.participants.find((p) => p.id === meId) ?? trip.participants[0];

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  // open a shared link: #join=room.token (live) or #trip=... (snapshot)
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const clear = () => window.history.replaceState(null, '', window.location.pathname + window.location.search);
    const join = parseJoinHash(hash);
    if (join) {
      fetchRoom(join).then((r) => {
        clear();
        if ('error' in r) return setToast(r.error);
        store.saveTrip(trip);
        rememberLink(r.trip.id, join);
        loadTrip(r.trip);
        if (r.trip.participants[1]) setMeId(store.loadMe(r.trip.id) ?? r.trip.participants[1].id);
        setTab('together');
        setToast('共有された旅に参加しました。右上で自分の名前を選んでください');
      });
      return;
    }
    parseSnapshotHash(hash).then((t) => {
      if (!t) return;
      clear();
      store.saveTrip(trip);
      loadTrip({ ...t, id: newId(), title: `${t.title}（受け取り）` });
      setToast('リンクの旅程を読み込みました');
    });
    // run once on startup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist (debounced)
  useEffect(() => {
    const t = setTimeout(() => store.saveTrip(trip), 300);
    return () => clearTimeout(t);
  }, [trip]);
  useEffect(() => store.saveChat(trip.id, messages), [trip.id, messages]);
  useEffect(() => store.saveMe(trip.id, meId), [trip.id, meId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // undo / redo shortcuts outside text fields
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest('input, textarea, select, [contenteditable]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        dispatchHistory({ type: e.shiftKey ? 'redo' : 'undo' });
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        dispatchHistory({ type: 'redo' });
      } else if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const loadTrip = (t: Trip) => {
    dispatchHistory({ type: 'load', trip: t });
    setMessages(store.loadChat(t.id));
    setMeId(store.loadMe(t.id) ?? t.participants[0].id);
    setSelected(null);
    setActiveDay('all');
    setFitSeq((s) => s + 1);
  };

  // ---- suggestions from the latest assistant answer that has places ----
  const latestWithPlaces = useMemo(() => [...messages].reverse().find((m) => m.role === 'assistant' && m.reply && m.reply.places.length > 0), [messages]);
  const suggestions = useMemo(() => {
    if (!latestWithPlaces?.reply) return [];
    return latestWithPlaces.reply.places
      .filter((p) => !findSimilarPlace(trip, p))
      .map((p) => ({ key: `sug:${latestWithPlaces.id}:${p.ref}`, place: p, messageId: latestWithPlaces.id }));
  }, [latestWithPlaces, trip]);

  // ---- map pins ----
  const pins = useMemo<MapPin[]>(() => {
    const out: MapPin[] = [];
    trip.days.forEach((d, di) => {
      const visible = activeDay === 'all' || activeDay === d.id;
      let n = 0;
      d.stopIds.forEach((sid) => {
        const s = trip.stops[sid];
        const p = s?.placeId ? trip.places[s.placeId] : undefined;
        if (!p) return;
        n += 1;
        if (out.some((x) => x.key === `place:${p.id}`)) return;
        const notes = trip.notes.filter((x) => x.placeId === p.id);
        out.push({
          key: `place:${p.id}`,
          lng: p.lng,
          lat: p.lat,
          label: String(n),
          title: `${di + 1}日目 ${n}. ${p.name}`,
          color: DAY_COLORS[di % DAY_COLORS.length],
          variant: 'stop',
          dimmed: !visible,
          badge: notes.some((x) => x.tag === 'crowded') ? '混' : notes.some((x) => x.tag === 'avoid') ? '✕' : undefined,
        });
      });
    });
    for (const p of candidates(trip)) {
      const r = trip.reactions[p.id] ?? {};
      const vals = Object.values(r);
      const allWant = vals.length >= trip.participants.length && vals.every((v) => v === 'want');
      out.push({
        key: `place:${p.id}`,
        lng: p.lng,
        lat: p.lat,
        label: allWant ? '♥' : vals.includes('skip') ? '−' : '★',
        title: `候補: ${p.name}`,
        color: allWant ? '#d6336c' : '#868e96',
        variant: p.category === 'destination' ? 'destination' : 'candidate',
        badge: trip.notes.some((x) => x.placeId === p.id && x.tag === 'crowded') ? '混' : undefined,
      });
    }
    suggestions.forEach((s, i) =>
      out.push({
        key: s.key,
        lng: s.place.lng,
        lat: s.place.lat,
        label: s.place.category === 'destination' ? s.place.name : String.fromCharCode(65 + i),
        title: `提案: ${s.place.name}`,
        color: '#7048e8',
        variant: s.place.category === 'destination' ? 'destination' : 'suggestion',
      }),
    );
    return out;
  }, [trip, activeDay, suggestions]);

  const routeLines = useMemo<RouteLine[]>(
    () =>
      trip.days.flatMap((d, di) =>
        activeDay !== 'all' && activeDay !== d.id
          ? []
          : (routes[d.id]?.geometry ?? []).map((g, i) => ({ key: `${d.id}:${i}`, color: DAY_COLORS[di % DAY_COLORS.length], coordinates: g, estimated: routes[d.id]?.estimated ?? false })),
      ),
    [trip.days, routes, activeDay],
  );

  const selectedItem: CardItem | null = useMemo(() => {
    if (!selected) return null;
    if (selected.startsWith('place:')) {
      const p = trip.places[selected.slice(6)];
      return p ? { kind: 'place', place: p } : null;
    }
    const s = suggestions.find((x) => x.key === selected);
    if (s) return { kind: 'suggestion', place: s.place, messageId: s.messageId };
    // suggestion was saved in the meantime → show the saved place
    const msg = messages.find((m) => selected.startsWith(`sug:${m.id}:`));
    const ref = selected.split(':')[2];
    const sp = msg?.reply?.places.find((p) => p.ref === ref);
    const saved = sp ? findSimilarPlace(trip, sp) : undefined;
    return saved ? { kind: 'place', place: saved } : null;
  }, [selected, trip, suggestions, messages]);

  const saveSuggestion = (item: CardItem): ID => {
    if (item.kind === 'place') return item.place.id;
    const existing = findSimilarPlace(trip, item.place);
    if (existing) return existing.id;
    const place = placeFromSuggestion(item.place);
    dispatch({ type: 'addPlace', place });
    setSelected(`place:${place.id}`);
    return place.id;
  };

  const addSearchHit = (h: SearchHit, dayId: ID | null) => {
    const existing = findSimilarPlace(trip, h);
    const place: Place = existing ?? {
      id: newId(),
      name: h.name,
      lng: h.lng,
      lat: h.lat,
      status: 'manual',
      category: h.category,
      address: h.address,
      countryCode: h.countryCode,
      source: 'osm',
      sourceRef: h.sourceRef,
      retrievedAt: new Date().toISOString(),
    };
    if (!existing) dispatch({ type: 'addPlace', place });
    if (dayId) dispatch({ type: 'addStop', placeId: place.id, dayId });
    setSelected(`place:${place.id}`);
    setFocus({ lng: place.lng, lat: place.lat, zoom: 15, seq: Date.now() });
  };

  // ---- chat ----
  const send = async (text: string, mode: ChatMode, disruption?: string) => {
    const userMsg: ChatMessage = { id: newId(), role: 'user', authorId: me.id, text, createdAt: new Date().toISOString() };
    const next = [...messages, userMsg];
    setMessages(next);
    setBusy(true);
    setChatError(null);
    const selectedName = selectedItem?.place.name;
    let userLocation: { lng: number; lat: number } | undefined;
    if (mode === 'replan' && 'geolocation' in navigator) {
      userLocation = await new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
          () => resolve(undefined),
          { timeout: 5000, maximumAge: 300000 },
        );
      });
    }
    try {
      const reply = await api.chat({
        messages: next.slice(-10).map((m) => ({ role: m.role, text: m.role === 'assistant' ? m.text : m.text })).filter((m) => m.text),
        mode,
        trip: buildTripSummary(trip),
        baseRevision: trip.revision,
        viewport: viewport.current,
        selectedPlaceName: selectedName,
        disruption,
        userLocation,
        authorName: me.name,
        privateRules: privateRulesFor(trip, me.id),
      });
      const msg: ChatMessage = { id: newId(), role: 'assistant', text: reply.reply, reply, proposalState: reply.proposal ? 'pending' : undefined, createdAt: new Date().toISOString() };
      setMessages((m) => [...m, msg]);
      if (reply.mapFocus) setFocus({ ...reply.mapFocus, seq: Date.now() });
      else if (reply.places.length) setFitSeq((s) => s + 1);
      if (window.matchMedia('(max-width: 767px)').matches && reply.places.length) setMapLarge(true);
    } catch (e) {
      const err = e as ClientApiError;
      if (err.code === 'access_code') {
        store.saveAccessCode('');
        setHasCode(false);
      }
      setChatError(`${err.message}${err.retryable ? '（もう一度送ると再試行します）' : ''}`);
      // keep the user's text visible but don't leave a dangling question in history
      setMessages((m) => m.filter((x) => x.id !== userMsg.id));
    } finally {
      setBusy(false);
    }
  };

  const apply = (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    const proposal = msg?.reply?.proposal;
    if (!msg?.reply || !proposal) return;
    const { skipped } = applyProposal(trip, proposal, msg.reply.places);
    dispatch({ type: 'applyProposal', proposal, places: msg.reply.places });
    setMessages((ms) => ms.map((m) => (m.id === messageId ? { ...m, proposalState: 'applied' } : m)));
    const firstDay = proposal.ops.find((o) => o.dayIndex !== null)?.dayIndex;
    if (firstDay !== undefined && firstDay !== null && trip.days[firstDay]) setActiveDay(trip.days[firstDay].id);
    setFitSeq((s) => s + 1);
    setToast(skipped.length ? `適用しました（旅程が変わっていたため ${skipped.length} 件をスキップ）` : '旅程に適用しました。↶ で元に戻せます');
  };

  const selectSuggestion = (messageId: string, ref: string) => {
    const msg = messages.find((m) => m.id === messageId);
    const p = msg?.reply?.places.find((x) => x.ref === ref);
    if (!p) return;
    const saved = findSimilarPlace(trip, p);
    setSelected(saved ? `place:${saved.id}` : `sug:${messageId}:${ref}`);
    setFocus({ lng: p.lng, lat: p.lat, zoom: p.category === 'destination' ? 8 : 15, seq: Date.now() });
    setMapLarge(true);
  };

  const selectPlace = (placeId: ID) => {
    const p = trip.places[placeId];
    setSelected(`place:${placeId}`);
    if (p) setFocus({ lng: p.lng, lat: p.lat, zoom: 15, seq: Date.now() });
  };

  const ask = (text: string) => {
    setTab('chat');
    send(text, 'plan');
  };

  const allTrips = Object.values(store.loadTrips());
  if (!allTrips.some((t) => t.id === trip.id)) allTrips.unshift(trip);

  return (
    <div className={`app ${mapLarge ? 'map-large' : ''}`}>
      <header className="topbar">
        <button className="brand" onClick={() => setSettingsOpen(true)} title="旅の設定">
          <span className="logo" aria-hidden>
            ◍
          </span>
          <span className="brand-text">
            <strong>{trip.title || 'CoVoyager'}</strong>
            <span className="muted small">
              {trip.destination || '行き先未定'}
              {trip.startDate ? ` ・ ${trip.startDate}${trip.endDate && trip.endDate !== trip.startDate ? `〜${trip.endDate.slice(5)}` : ''}` : ''}
            </span>
          </span>
        </button>
        <div className="topbar-actions">
          <label className="who" title="今操作している人">
            <span className="who-dot" style={{ background: me.color }} />
            <select className="input" value={me.id} onChange={(e) => setMeId(e.target.value)} aria-label="わたしは">
              {trip.participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button className="icon" onClick={() => dispatchHistory({ type: 'undo' })} disabled={history.past.length === 0} aria-label="元に戻す" title="元に戻す (Ctrl+Z)">
            ↶
          </button>
          <button className="icon" onClick={() => dispatchHistory({ type: 'redo' })} disabled={history.future.length === 0} aria-label="やり直す" title="やり直す">
            ↷
          </button>
          <button className="icon" onClick={() => setSettingsOpen(true)} aria-label="設定">
            ⚙
          </button>
        </div>
      </header>

      <main className="layout">
        <div className="map-area">
          <MapView
            pins={pins}
            routes={routeLines}
            selectedKey={selected}
            focus={focus}
            fitKey={`${activeDay}:${fitSeq}`}
            onSelect={setSelected}
            onViewport={(v) => (viewport.current = v)}
          />
          {selectedItem && (
            <PlaceCard item={selectedItem} trip={trip} me={me} dispatch={dispatch} onSave={saveSuggestion} onClose={() => setSelected(null)} onAsk={ask} />
          )}
          <button className="map-toggle" onClick={() => setMapLarge((v) => !v)} aria-label={mapLarge ? '地図を小さく' : '地図を大きく'}>
            {mapLarge ? '⌄ パネル' : '⌃ 地図'}
          </button>
        </div>

        <div className={`panel panel-chat ${tab === 'chat' ? 'active' : ''}`}>
          <ChatPanel
            trip={trip}
            messages={messages}
            me={me}
            busy={busy}
            error={chatError}
            llm={health?.llm ?? null}
            needsAccessCode={Boolean(health?.accessCodeRequired && !hasCode)}
            onAccessCode={(c) => {
              store.saveAccessCode(c);
              setHasCode(Boolean(c));
            }}
            onSend={send}
            onApply={apply}
            onReject={(id) => setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, proposalState: 'rejected' } : m)))}
            onSelectSuggestion={selectSuggestion}
            onClear={() => confirm('この旅の会話を消しますか？（旅程は残ります）') && setMessages([])}
          />
        </div>

        <div className={`panel panel-side ${tab !== 'chat' ? 'active' : ''}`}>
          <div className="side-tabs" role="tablist">
            <button role="tab" aria-selected={tab !== 'together'} className={tab !== 'together' ? 'on' : ''} onClick={() => setTab('plan')}>
              旅程
            </button>
            <button role="tab" aria-selected={tab === 'together'} className={tab === 'together' ? 'on' : ''} onClick={() => setTab('together')}>
              ふたりで
            </button>
          </div>
          {tab === 'together' ? (
            <Together trip={trip} me={me} dispatch={dispatch} routes={routes} onSelectPlace={selectPlace} sync={sync} />
          ) : (
            <Itinerary
              trip={trip}
              routes={routes}
              activeDay={activeDay}
              onActiveDay={(d) => {
                setActiveDay(d);
                setFitSeq((s) => s + 1);
              }}
              selectedPlaceId={selected?.startsWith('place:') ? selected.slice(6) : null}
              onSelectPlace={selectPlace}
              dispatch={dispatch}
              near={viewport.current}
              onAddSearchHit={addSearchHit}
            />
          )}
        </div>
      </main>

      <nav className="tabbar" aria-label="表示切替">
        {(
          [
            ['chat', '💬', 'チャット'],
            ['plan', '🗓', '旅程'],
            ['together', '👫', 'ふたりで'],
          ] as [Tab, string, string][]
        ).map(([t, icon, label]) => (
          <button
            key={t}
            className={tab === t ? 'on' : ''}
            onClick={() => {
              setTab(t);
              setMapLarge(false);
            }}
          >
            <span aria-hidden>{icon}</span>
            {label}
          </button>
        ))}
      </nav>

      {settingsOpen && (
        <TripSettings
          trip={trip}
          trips={allTrips}
          dispatch={dispatch}
          onClose={() => setSettingsOpen(false)}
          onNewTrip={() => {
            store.saveTrip(trip);
            loadTrip(createTrip());
          }}
          onSwitchTrip={(id) => {
            store.saveTrip(trip);
            const t = store.loadTrips()[id];
            if (t) loadTrip(t);
          }}
          onDeleteTrip={(id) => {
            store.deleteTrip(id);
            setToast('削除しました');
          }}
          onExport={() => store.exportTrip(trip)}
          onImport={async (f) => {
            const r = await store.importTripFile(f);
            if (!r.ok) return setToast(`読み込めませんでした: ${r.error}`);
            store.saveTrip(trip);
            loadTrip(r.trip);
            setToast(`「${r.trip.title}」を読み込みました`);
          }}
          onWipe={() => {
            store.wipeAll();
            loadTrip(createTrip());
            setSettingsOpen(false);
            setToast('端末のデータを削除しました');
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

/** Consented private rules are sent only as abstract rules, never with their owner's name. */
function privateRulesFor(trip: Trip, meId: ID): string[] {
  return trip.preferences
    .filter((p) => p.visibility === 'private' && p.ownerId === meId && p.aiConsent)
    .map((p) => `${p.strength}: ${p.kind} = ${p.value}`.slice(0, 200))
    .slice(0, 10);
}
