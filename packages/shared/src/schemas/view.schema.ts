import { z } from 'zod';
import { OpaqueIdSchema } from './common.schema.js';

// ─── POST /views ─────────────────────────────────────────────────────────────

export const IdempotencyKeyHeaderSchema = z.object({
  'idempotency-key': z.string().min(1).max(128),
}).loose();
export type IdempotencyKeyHeader = z.infer<typeof IdempotencyKeyHeaderSchema>;

/**
 * Body atteso da POST /views. Per minimizzazione del dato (GDPR) e coerenza con il
 * ruolo del modulo (integrità dei conteggi, non anagrafica), il modulo riceve solo
 * ciò che gli serve: l'asset, il momento della view e l'Idempotency-Key (header).
 * Identità pseudonima del lettore ed evidence forense restano nel core, loro owner.
 */
export const ViewBodySchema = z.object({
  assetId:    OpaqueIdSchema,
  occurredAt: z.iso.datetime(),
}).strict();
export type ViewBody = z.infer<typeof ViewBodySchema>;

export const ViewResponseSchema = z.object({
  eventId:   z.string().min(1),
  periodId:  z.number().int().positive(),
  duplicate: z.boolean(),
}).strict();
export type ViewResponse = z.infer<typeof ViewResponseSchema>;
