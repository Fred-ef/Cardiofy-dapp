import { z } from 'zod';
import { OpaqueIdSchema } from './common.schema.js';

// ─── POST /views ─────────────────────────────────────────────────────────────

export const IdempotencyKeyHeaderSchema = z.object({
  'idempotency-key': z.string().min(1).max(128),
}).loose();
export type IdempotencyKeyHeader = z.infer<typeof IdempotencyKeyHeaderSchema>;

/**
 * Body atteso da POST /views. `evidence` è opaque al modulo: lo memorizziamo
 * come JSON ma non lo interpretiamo — è prova diagnostica per dispute future.
 */
export const ViewBodySchema = z.object({
  assetId:    OpaqueIdSchema,
  readerHash: z.string().min(1).max(128),
  sessionId:  z.string().min(1).max(128).optional(),
  occurredAt: z.iso.datetime(),
  evidence:   z.record(z.string(), z.unknown()).optional(),
}).strict();
export type ViewBody = z.infer<typeof ViewBodySchema>;

export const ViewResponseSchema = z.object({
  eventId:   z.string().min(1),
  periodId:  z.number().int().positive(),
  duplicate: z.boolean(),
}).strict();
export type ViewResponse = z.infer<typeof ViewResponseSchema>;
