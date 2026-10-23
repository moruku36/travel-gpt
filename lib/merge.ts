// Merge two copies of the same trip edited on different devices.
// The newer copy wins for structure (days/stops order); additive data (places, notes,
// reactions, shared preferences) is unioned so neither person's input disappears.
// The local device's private preferences are always kept and never come from remote.
import type { Trip } from './types';

export function mergeTrips(local: Trip, remote: Trip): Trip {
  const newer = remote.updatedAt >= local.updatedAt ? remote : local;
  const older = newer === remote ? local : remote;

  const places = { ...older.places, ...newer.places };
  const stops = { ...newer.stops };
  // A stop only in the older copy that is not placed in any newer day stays dropped (it was removed or not yet seen).
  const notes = [...newer.notes, ...older.notes.filter((n) => !newer.notes.some((m) => m.id === n.id))];

  const reactions: Trip['reactions'] = {};
  for (const pid of new Set([...Object.keys(older.reactions), ...Object.keys(newer.reactions)])) {
    reactions[pid] = { ...(older.reactions[pid] ?? {}), ...(newer.reactions[pid] ?? {}) };
  }

  const sharedNewer = newer.preferences.filter((p) => p.visibility === 'shared');
  const sharedOlder = older.preferences.filter((p) => p.visibility === 'shared' && !sharedNewer.some((q) => q.id === p.id));
  const localPrivate = local.preferences.filter((p) => p.visibility === 'private');

  const participants = [...newer.participants, ...older.participants.filter((p) => !newer.participants.some((q) => q.id === p.id))].slice(0, 8);

  return {
    ...newer,
    id: local.id,
    places,
    stops,
    notes,
    reactions,
    participants,
    preferences: [...sharedNewer, ...sharedOlder, ...localPrivate],
    revision: Math.max(local.revision, remote.revision) + 1,
    updatedAt: newer.updatedAt,
  };
}

/** JSON with sorted object keys, so equal trips always produce the same signature. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as Record<string, unknown>)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

/** Content signature used by sync to skip no-op pushes. */
export function tripSignature(t: Trip): string {
  return stableStringify({ ...t, revision: 0, updatedAt: '' });
}
