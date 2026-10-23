// Device-local persistence. localStorage can be unavailable (private mode, blocked storage),
// so every access is guarded and the app keeps working in memory.
import type { ChatMessage, Trip } from '@/lib/types';
import { parseTrip, shareableTrip } from '@/lib/tripSchema';

const KEY_TRIPS = 'covoyager:v1:trips';
const KEY_ACTIVE = 'covoyager:v1:active';
const KEY_CHAT = (id: string) => `covoyager:v1:chat:${id}`;
const KEY_ME = (id: string) => `covoyager:v1:me:${id}`;
const KEY_ACCESS = 'covoyager:v1:access';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // storage full or blocked: in-memory only
  }
}

export function loadTrips(): Record<string, Trip> {
  const raw = read(KEY_TRIPS);
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, Trip> = {};
    for (const [id, t] of Object.entries(obj)) {
      const r = parseTrip(t);
      if (r.ok) out[id] = r.trip;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveTrip(trip: Trip) {
  const all = loadTrips();
  all[trip.id] = trip;
  write(KEY_TRIPS, JSON.stringify(all));
  write(KEY_ACTIVE, trip.id);
}

export function deleteTrip(id: string) {
  const all = loadTrips();
  delete all[id];
  write(KEY_TRIPS, JSON.stringify(all));
  write(KEY_CHAT(id), null);
  write(KEY_ME(id), null);
}

export function activeTripId(): string | null {
  return read(KEY_ACTIVE);
}

export function loadChat(tripId: string): ChatMessage[] {
  try {
    const v = JSON.parse(read(KEY_CHAT(tripId)) ?? '[]');
    return Array.isArray(v) ? (v as ChatMessage[]).slice(-60) : [];
  } catch {
    return [];
  }
}

export function saveChat(tripId: string, messages: ChatMessage[]) {
  write(KEY_CHAT(tripId), JSON.stringify(messages.slice(-60)));
}

export function loadMe(tripId: string): string | null {
  return read(KEY_ME(tripId));
}

export function saveMe(tripId: string, participantId: string) {
  write(KEY_ME(tripId), participantId);
}

export function readAccessCode(): string | null {
  if (typeof window === 'undefined') return null;
  return read(KEY_ACCESS);
}

export function saveAccessCode(code: string) {
  write(KEY_ACCESS, code || null);
}

/** Delete everything this app stored on the device. */
export function wipeAll() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith('covoyager:')) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // nothing stored
  }
}

export function exportTrip(trip: Trip) {
  const blob = new Blob([JSON.stringify(shareableTrip(trip), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${trip.title.replace(/[\\/:*?"<>|]/g, '_') || 'trip'}.covoyager.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importTripFile(file: File): Promise<{ ok: true; trip: Trip } | { ok: false; error: string }> {
  if (file.size > 1024 * 1024) return { ok: false, error: 'ファイルが大きすぎます (1MB まで)' };
  try {
    return parseTrip(JSON.parse(await file.text()));
  } catch {
    return { ok: false, error: 'JSON として読み込めませんでした' };
  }
}
