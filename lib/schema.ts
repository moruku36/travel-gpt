import { z } from 'zod';

// ---- /api/chat request ----------------------------------------------------

export const LIMITS = {
  messageChars: 4000,
  historyMessages: 10,
  contextBytes: 32 * 1024,
  places: 8,
  ops: 20,
};

const lng = z.number().min(-180).max(180);
const lat = z.number().min(-90).max(90);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const tripSummarySchema = z.object({
  title: z.string().max(200),
  destination: z.string().max(200),
  startDate: z.string().max(10).optional(),
  endDate: z.string().max(10).optional(),
  currency: z.string().max(3),
  budget: z.number().nonnegative().optional(),
  pace: z.enum(['relaxed', 'normal', 'packed']),
  interests: z.array(z.string().max(60)).max(20),
  participants: z.array(z.object({ id: z.string().max(64), name: z.string().max(40) })).max(8),
  sharedPreferences: z
    .array(
      z.object({
        owner: z.string().max(40),
        kind: z.string().max(40),
        strength: z.enum(['required', 'preferred']),
        value: z.string().max(200),
      }),
    )
    .max(40),
  days: z
    .array(
      z.object({
        index: z.number().int().min(0),
        date: z.string().max(10).optional(),
        mode: z.enum(['walking', 'driving', 'cycling', 'transit']),
        stops: z
          .array(
            z.object({
              id: z.string().max(64),
              name: z.string().max(200),
              kind: z.string().max(20),
              start: z.string().max(5).optional(),
              durationMinutes: z.number().int().min(0).max(24 * 60),
              locked: z.boolean(),
              lng: lng.optional(),
              lat: lat.optional(),
              votes: z.string().max(200).optional(),
              notes: z.string().max(400).optional(),
            }),
          )
          .max(30),
      }),
    )
    .max(31),
  candidates: z.array(z.object({ name: z.string().max(200), votes: z.string().max(200).optional() })).max(30),
});

export type TripSummary = z.infer<typeof tripSummarySchema>;

export const chatRequestSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().min(1).max(LIMITS.messageChars) }))
    .min(1)
    .max(LIMITS.historyMessages),
  mode: z.enum(['plan', 'recommend', 'replan']).default('plan'),
  trip: tripSummarySchema,
  baseRevision: z.number().int().min(0),
  viewport: z.object({ lng, lat, zoom: z.number().min(0).max(24) }).optional(),
  selectedPlaceName: z.string().max(200).optional(),
  disruption: z.string().max(400).optional(),
  userLocation: z.object({ lng, lat }).optional(),
  authorName: z.string().max(40).optional(),
  privateRules: z.array(z.string().max(200)).max(10).optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

// ---- LLM output ------------------------------------------------------------

export const llmPlaceSchema = z.object({
  ref: z.string().max(40),
  name: z.string().max(200),
  geocodeQuery: z.string().max(300),
  lng,
  lat,
  category: z.string().max(60),
  countryCode: z.string().max(2),
  why: z.string().max(600),
  durationMinutes: z.number().int().min(0).max(24 * 60),
  cost: z.number().nonnegative().nullable(),
  currency: z.string().max(3).nullable(),
  crowd: z.enum(['low', 'medium', 'high', 'unknown']),
  crowdNote: z.string().max(300),
  bestTime: z.string().max(120),
});

export const llmOpSchema = z.object({
  type: z.enum(['add_stop', 'remove_stop', 'move_stop', 'set_time', 'add_rest']),
  placeRef: z.string().max(40).nullable(),
  stopId: z.string().max(64).nullable(),
  dayIndex: z.number().int().min(0).max(30).nullable(),
  position: z.number().int().min(0).max(50).nullable(),
  startTime: hhmm.nullable(),
  durationMinutes: z.number().int().min(0).max(24 * 60).nullable(),
});

export const llmOutputSchema = z.object({
  reply: z.string().max(6000),
  mapFocus: z.object({ lng, lat, zoom: z.number().min(0).max(20) }).nullable(),
  places: z.array(llmPlaceSchema).max(LIMITS.places),
  proposal: z.object({ summary: z.string().max(600), ops: z.array(llmOpSchema).max(LIMITS.ops) }).nullable(),
  warnings: z.array(z.string().max(300)).max(8),
  followUps: z.array(z.string().max(80)).max(4),
});

export type LlmOutput = z.infer<typeof llmOutputSchema>;

/**
 * Hand-written JSON Schema for OpenAI Structured Outputs (strict mode needs every key
 * required and additionalProperties:false; optional values are expressed as nullable).
 */
const nullable = (type: string) => ({ type: [type, 'null'] });
const str = { type: 'string' };
const num = { type: 'number' };
const int = { type: 'integer' };

export const llmOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'mapFocus', 'places', 'proposal', 'warnings', 'followUps'],
  properties: {
    reply: str,
    mapFocus: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['lng', 'lat', 'zoom'],
          properties: { lng: num, lat: num, zoom: num },
        },
        { type: 'null' },
      ],
    },
    places: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'ref',
          'name',
          'geocodeQuery',
          'lng',
          'lat',
          'category',
          'countryCode',
          'why',
          'durationMinutes',
          'cost',
          'currency',
          'crowd',
          'crowdNote',
          'bestTime',
        ],
        properties: {
          ref: str,
          name: str,
          geocodeQuery: str,
          lng: num,
          lat: num,
          category: str,
          countryCode: str,
          why: str,
          durationMinutes: int,
          cost: nullable('number'),
          currency: nullable('string'),
          crowd: { type: 'string', enum: ['low', 'medium', 'high', 'unknown'] },
          crowdNote: str,
          bestTime: str,
        },
      },
    },
    proposal: {
      anyOf: [
        {
          type: 'object',
          additionalProperties: false,
          required: ['summary', 'ops'],
          properties: {
            summary: str,
            ops: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['type', 'placeRef', 'stopId', 'dayIndex', 'position', 'startTime', 'durationMinutes'],
                properties: {
                  type: { type: 'string', enum: ['add_stop', 'remove_stop', 'move_stop', 'set_time', 'add_rest'] },
                  placeRef: nullable('string'),
                  stopId: nullable('string'),
                  dayIndex: nullable('integer'),
                  position: nullable('integer'),
                  startTime: nullable('string'),
                  durationMinutes: nullable('integer'),
                },
              },
            },
          },
        },
        { type: 'null' },
      ],
    },
    warnings: { type: 'array', items: str },
    followUps: { type: 'array', items: str },
  },
} as const;
