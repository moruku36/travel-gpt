// Live sync of one trip between devices through /api/sync/[room].
// The room id and secret token travel only in the URL fragment (#join=...), which browsers
// do not send to servers, and are stored per trip on the device.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Trip } from '@/lib/types';
import { mergeTrips, tripSignature } from '@/lib/merge';
import { parseTrip, shareableTrip } from '@/lib/tripSchema';
import { readAccessCode } from './storage';

export interface SyncLink {
  room: string;
  token: string;
}

export type SyncStatus = 'off' | 'syncing' | 'live' | 'offline' | 'error';

const KEY = (tripId: string) => `covoyager:v1:sync:${tripId}`;

function randomToken(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'[b % 64]).join('');
}

export function loadLink(tripId: string): SyncLink | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY(tripId)) ?? 'null');
    return v && typeof v.room === 'string' && typeof v.token === 'string' ? v : null;
  } catch {
    return null;
  }
}

function saveLink(tripId: string, link: SyncLink | null) {
  try {
    if (link) localStorage.setItem(KEY(tripId), JSON.stringify(link));
    else localStorage.removeItem(KEY(tripId));
  } catch {
    // ignore
  }
}

export function joinUrl(link: SyncLink): string {
  return `${location.origin}${location.pathname}#join=${link.room}.${link.token}`;
}

export function parseJoinHash(hash: string): SyncLink | null {
  const m = /join=([A-Za-z0-9_-]{12,40})\.([A-Za-z0-9_-]{16,80})/.exec(hash);
  return m ? { room: m[1], token: m[2] } : null;
}

function headers(link: SyncLink): HeadersInit {
  const code = readAccessCode();
  return { 'Content-Type': 'application/json', 'x-room-token': link.token, ...(code ? { 'x-access-code': code } : {}) };
}

export async function fetchRoom(link: SyncLink): Promise<{ version: number; trip: Trip } | { error: string }> {
  try {
    const res = await fetch(`/api/sync/${link.room}`, { headers: headers(link) });
    const body = await res.json();
    if (!res.ok) return { error: body?.error?.message ?? `エラー (${res.status})` };
    const parsed = parseTrip(body.trip);
    if (!parsed.ok) return { error: '共有データが壊れています' };
    return { version: body.version, trip: parsed.trip };
  } catch {
    return { error: 'ネットワークに接続できません' };
  }
}

interface Options {
  trip: Trip;
  onRemote: (merged: Trip) => void;
  intervalMs?: number;
}

export function useSync({ trip, onRemote, intervalMs = 4000 }: Options) {
  const [link, setLink] = useState<SyncLink | null>(() => loadLink(trip.id));
  const [status, setStatus] = useState<SyncStatus>(link ? 'syncing' : 'off');
  const version = useRef(0);
  const lastSent = useRef<string>('');
  const tripRef = useRef(trip);
  tripRef.current = trip;
  const onRemoteRef = useRef(onRemote);
  onRemoteRef.current = onRemote;
  const pushing = useRef(false);

  // trip switched → pick up that trip's link
  useEffect(() => {
    const l = loadLink(trip.id);
    setLink(l);
    setStatus(l ? 'syncing' : 'off');
    version.current = 0;
    lastSent.current = '';
  }, [trip.id]);

  const applyRemote = useCallback((remote: Trip, v: number) => {
    version.current = v;
    const merged = mergeTrips(tripRef.current, remote);
    // Compare against what the server has, so a merge that added local data gets pushed back.
    lastSent.current = tripSignature(shareableTrip({ ...remote, id: merged.id }));
    onRemoteRef.current(merged);
  }, []);

  const push = useCallback(async () => {
    if (!link || pushing.current) return;
    const payload = shareableTrip(tripRef.current);
    const sig = tripSignature(payload);
    if (sig === lastSent.current) return;
    pushing.current = true;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const res = await fetch(`/api/sync/${link.room}`, {
          method: 'PUT',
          headers: headers(link),
          body: JSON.stringify({ baseVersion: version.current, trip: payload }),
        });
        const body = await res.json().catch(() => null);
        if (res.ok) {
          version.current = body.version;
          lastSent.current = sig;
          setStatus('live');
          return;
        }
        if (res.status === 409 && body?.trip) {
          const parsed = parseTrip(body.trip);
          if (parsed.ok) applyRemote(parsed.trip, body.version);
          else version.current = body.version;
          continue;
        }
        setStatus(res.status >= 500 ? 'offline' : 'error');
        return;
      }
    } catch {
      setStatus('offline');
    } finally {
      pushing.current = false;
    }
  }, [link, applyRemote]);

  // push local edits (debounced)
  useEffect(() => {
    if (!link) return;
    const t = setTimeout(push, 700);
    return () => clearTimeout(t);
  }, [trip, link, push]);

  // poll for the partner's edits
  useEffect(() => {
    if (!link) return;
    let stopped = false;
    const tick = async () => {
      if (document.hidden || pushing.current) return;
      try {
        const res = await fetch(`/api/sync/${link.room}?since=${version.current}`, { headers: headers(link) });
        const body = await res.json().catch(() => null);
        if (stopped) return;
        if (!res.ok) {
          setStatus(res.status === 404 && version.current === 0 ? 'syncing' : res.status >= 500 ? 'offline' : 'error');
          if (res.status === 404 && version.current === 0) push();
          return;
        }
        setStatus('live');
        if (body.unchanged) return;
        const parsed = parseTrip(body.trip);
        if (parsed.ok) applyRemote(parsed.trip, body.version);
      } catch {
        if (!stopped) setStatus('offline');
      }
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [link, intervalMs, applyRemote, push]);

  const start = useCallback((): SyncLink => {
    const l = { room: randomToken(20), token: randomToken(32) };
    saveLink(tripRef.current.id, l);
    version.current = 0;
    lastSent.current = '';
    setLink(l);
    setStatus('syncing');
    return l;
  }, []);

  const stop = useCallback(() => {
    saveLink(tripRef.current.id, null);
    setLink(null);
    setStatus('off');
  }, []);

  return { link, status, start, stop };
}

/** Remember a joined room for a trip id (used right after joining from a link). */
export function rememberLink(tripId: string, link: SyncLink) {
  saveLink(tripId, link);
}

// ---- snapshot links (no server storage) ---------------------------------------

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function snapshotUrl(trip: Trip): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(shareableTrip(trip)));
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return `${location.origin}${location.pathname}#trip=${toBase64Url(bytes)}`;
}

export async function parseSnapshotHash(hash: string): Promise<Trip | null> {
  const m = /trip=([A-Za-z0-9_-]+)/.exec(hash);
  if (!m || m[1].length > 200000) return null;
  try {
    const stream = new Blob([fromBase64Url(m[1])]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    const text = await new Response(stream).text();
    const r = parseTrip(JSON.parse(text));
    return r.ok ? r.trip : null;
  } catch {
    return null;
  }
}
