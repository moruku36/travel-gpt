// Shared trip rooms for two devices. Upstash Redis (REST) when configured, otherwise process
// memory (fine for `npm run dev` / one `npm start`; not shared between serverless instances).
import { createHash } from 'node:crypto';
import { fetchWithTimeout } from './http';

export interface RoomRecord {
  version: number;
  tokenHash: string;
  trip: unknown;
  updatedAt: string;
}

export const ROOM_TTL_SEC = 60 * 24 * 60 * 60;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export interface SyncStore {
  get(room: string): Promise<RoomRecord | null>;
  /** Compare-and-set: writes only when the stored version equals expectedVersion (0 = create). */
  cas(room: string, expectedVersion: number, next: RoomRecord): Promise<{ ok: true } | { ok: false; current: RoomRecord | null }>;
}

class MemoryStore implements SyncStore {
  private rooms = new Map<string, { rec: RoomRecord; expires: number }>();
  async get(room: string) {
    const r = this.rooms.get(room);
    if (!r || r.expires < Date.now()) return null;
    return r.rec;
  }
  async cas(room: string, expected: number, next: RoomRecord) {
    const cur = await this.get(room);
    if ((cur?.version ?? 0) !== expected) return { ok: false as const, current: cur };
    this.rooms.set(room, { rec: next, expires: Date.now() + ROOM_TTL_SEC * 1000 });
    if (this.rooms.size > 1000) {
      const first = this.rooms.keys().next().value;
      if (first) this.rooms.delete(first);
    }
    return { ok: true as const };
  }
}

const CAS_SCRIPT = `
local cur = redis.call('GET', KEYS[1])
local v = 0
if cur then v = cjson.decode(cur).version end
if tostring(v) ~= ARGV[1] then return cur or '' end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 'OK'
`;

class UpstashStore implements SyncStore {
  constructor(
    private url: string,
    private token: string,
  ) {}
  private async cmd(args: (string | number)[]): Promise<unknown> {
    const res = await fetchWithTimeout(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      timeoutMs: 5000,
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    return ((await res.json()) as { result: unknown }).result;
  }
  async get(room: string) {
    const v = await this.cmd(['GET', `covoyager:room:${room}`]);
    return typeof v === 'string' && v ? (JSON.parse(v) as RoomRecord) : null;
  }
  async cas(room: string, expected: number, next: RoomRecord) {
    const r = await this.cmd(['EVAL', CAS_SCRIPT, 1, `covoyager:room:${room}`, String(expected), JSON.stringify(next), ROOM_TTL_SEC]);
    if (r === 'OK') return { ok: true as const };
    return { ok: false as const, current: typeof r === 'string' && r ? (JSON.parse(r) as RoomRecord) : null };
  }
}

let store: SyncStore | null = null;

export function syncStore(): SyncStore {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  store = url && token ? new UpstashStore(url, token) : new MemoryStore();
  return store;
}

export function setSyncStoreForTests(s: SyncStore | null) {
  store = s;
}

export function createMemoryStore(): SyncStore {
  return new MemoryStore();
}
