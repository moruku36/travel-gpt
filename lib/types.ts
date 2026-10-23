// Core trip model. One JSON document per trip (schemaVersion 1), stored on the device
// and optionally mirrored to the sync store. Coordinates are always [lng, lat] order.

export type ID = string;

export type TransportMode = 'walking' | 'driving' | 'cycling' | 'transit';
export type Pace = 'relaxed' | 'normal' | 'packed';
export type StopKind = 'visit' | 'meal' | 'rest' | 'stay' | 'transfer';

/** verified: matched by an OSM geocoder near the suggested spot. estimated: LLM/demo coordinates only. */
export type PlaceStatus = 'verified' | 'estimated' | 'manual';
export type Crowd = 'low' | 'medium' | 'high' | 'unknown';

export interface Money {
  amount: number;
  currency: string; // ISO 4217
}

export interface Place {
  id: ID;
  name: string;
  lng: number;
  lat: number;
  status: PlaceStatus;
  category?: string;
  address?: string;
  countryCode?: string;
  /** Why the assistant suggested it. */
  why?: string;
  crowd?: Crowd;
  crowdNote?: string;
  bestTime?: string;
  source?: 'osm' | 'llm' | 'demo' | 'manual';
  sourceRef?: string;
  retrievedAt?: string;
}

export interface Stop {
  id: ID;
  placeId: ID | null; // null for a rest block without a location
  kind: StopKind;
  /** Local wall time "HH:MM"; when absent the schedule is derived from the previous stop. */
  startTime?: string;
  durationMinutes: number;
  locked: boolean;
  note?: string;
  cost?: Money;
  /** Empty or undefined = everyone. Used for split plans in Phase 2. */
  participantIds?: ID[];
}

export interface Day {
  id: ID;
  date?: string; // YYYY-MM-DD local date
  title?: string;
  stopIds: ID[];
  mode: TransportMode;
  startTime: string; // default "09:00"
}

export interface Participant {
  id: ID;
  name: string;
  color: string;
}

export type ReactionValue = 'want' | 'ok' | 'skip';

export type NoteTag = 'crowded' | 'quiet' | 'reserve' | 'rainy-ok' | 'must' | 'avoid' | 'memo';

export interface PlaceNote {
  id: ID;
  placeId: ID;
  authorId: ID;
  tag: NoteTag;
  text: string;
  createdAt: string;
}

export type PreferenceKind =
  | 'max-walk-km'
  | 'rest-every-min'
  | 'budget-per-day'
  | 'avoid-crowds'
  | 'avoid-heat'
  | 'early-bird'
  | 'night-owl'
  | 'food'
  | 'custom';

export interface Preference {
  id: ID;
  ownerId: ID;
  kind: PreferenceKind;
  strength: 'required' | 'preferred';
  /** Number for numeric kinds, free text otherwise. */
  value: string;
  /** private = never shared, exported or sent to the assistant. */
  visibility: 'private' | 'shared';
  /** Private only: the owner allowed this rule to be sent to the assistant (without their name). */
  aiConsent?: boolean;
}

export interface Trip {
  schemaVersion: 1;
  id: ID;
  title: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  currency: string;
  budget?: number;
  pace: Pace;
  interests: string[];
  participants: Participant[];
  days: Day[];
  stops: Record<ID, Stop>;
  places: Record<ID, Place>;
  /** placeId -> participantId -> reaction */
  reactions: Record<ID, Record<ID, ReactionValue>>;
  notes: PlaceNote[];
  preferences: Preference[];
  revision: number;
  updatedAt: string;
}

// ---- Assistant contract -------------------------------------------------

export type ProposalOpType = 'add_stop' | 'remove_stop' | 'move_stop' | 'set_time' | 'add_rest';

export interface ProposalOp {
  type: ProposalOpType;
  placeRef: string | null; // refers to SuggestedPlace.ref
  stopId: string | null;
  dayIndex: number | null; // 0-based
  position: number | null; // 0-based insert index; null = append
  startTime: string | null;
  durationMinutes: number | null;
}

export interface SuggestedPlace {
  ref: string;
  name: string;
  lng: number;
  lat: number;
  status: PlaceStatus;
  category: string;
  countryCode: string;
  address?: string;
  why: string;
  durationMinutes: number;
  cost: number | null;
  currency: string | null;
  crowd: Crowd;
  crowdNote: string;
  bestTime: string;
}

export interface Proposal {
  id: ID;
  summary: string;
  ops: ProposalOp[];
  baseRevision: number;
}

export interface ChatReply {
  reply: string;
  places: SuggestedPlace[];
  proposal: Proposal | null;
  mapFocus: { lng: number; lat: number; zoom: number } | null;
  warnings: string[];
  followUps: string[];
  mode: 'openai' | 'demo';
}

export interface ChatMessage {
  id: ID;
  role: 'user' | 'assistant';
  authorId?: ID;
  text: string;
  reply?: ChatReply;
  proposalState?: 'pending' | 'applied' | 'rejected';
  createdAt: string;
}

export interface ApiError {
  error: { code: string; message: string; retryable: boolean; requestId: string };
}
