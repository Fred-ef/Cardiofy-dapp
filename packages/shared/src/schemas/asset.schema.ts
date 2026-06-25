import { z } from 'zod';
import { AnchoringRefSchema, Bytes32HexSchema, OnchainStatusSchema, OpaqueIdSchema, TxHashSchema } from './common.schema.js';

// ─── Parametri di path ───────────────────────────────────────────────────────

export const AssetIdParamSchema = z.object({
  assetId: OpaqueIdSchema,
}).strict();
export type AssetIdParam = z.infer<typeof AssetIdParamSchema>;

// ─── POST /assets/{assetId}/notarize ─────────────────────────────────────────

export const NotarizeAssetBodySchema = z.object({
  contentHash: Bytes32HexSchema,
}).strict();
export type NotarizeAssetBody = z.infer<typeof NotarizeAssetBodySchema>;

export const NotarizeAssetResponseSchema = z.object({
  assetId:     OpaqueIdSchema,
  contentHash: Bytes32HexSchema,
  txHash:      TxHashSchema,
  chainId:     z.number().int().positive(),
}).strict();
export type NotarizeAssetResponse = z.infer<typeof NotarizeAssetResponseSchema>;

// ─── GET /assets/{assetId} ───────────────────────────────────────────────────

export const AssetDtoSchema = z.object({
  assetId:     OpaqueIdSchema,
  contentHash: Bytes32HexSchema,
  notarizedAt: z.iso.datetime(),
  confirmedAt: z.iso.datetime().nullable(),
  status:      OnchainStatusSchema,
  totalViews:  z.number().int().nonnegative(),
  anchoring:   AnchoringRefSchema,
}).strict();
export type AssetDto = z.infer<typeof AssetDtoSchema>;
