import { z } from 'zod';
import { AnchoringRefSchema, OnchainStatusSchema, OpaqueIdSchema, TxHashSchema } from './common.schema.js';

// ─── Parametri di path ───────────────────────────────────────────────────────

export const PeriodIdParamSchema = z.object({
  periodId: z.coerce.number().int().positive(),
}).strict();
export type PeriodIdParam = z.infer<typeof PeriodIdParamSchema>;

// ─── GET /batches/{periodId} ─────────────────────────────────────────────────

export const BatchUpdateSchema = z.object({
  assetId:       OpaqueIdSchema,
  viewsInPeriod: z.number().int().nonnegative(),
}).strict();
export type BatchUpdate = z.infer<typeof BatchUpdateSchema>;

export const BatchDtoSchema = z.object({
  periodId:    z.number().int().positive(),
  assetCount:  z.number().int().nonnegative(),
  viewsTotal:  z.number().int().nonnegative(),
  status:      OnchainStatusSchema,
  createdAt:   z.iso.datetime(),
  confirmedAt: z.iso.datetime().nullable(),
  txHash:      TxHashSchema.nullable(),
  anchoring:   AnchoringRefSchema,
  payload:     z.array(BatchUpdateSchema),
}).strict();
export type BatchDto = z.infer<typeof BatchDtoSchema>;
