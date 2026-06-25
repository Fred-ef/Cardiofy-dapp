import { z } from 'zod';
import { AnchoringRefSchema, Bytes32HexSchema, OnchainStatusSchema, OpaqueIdSchema, TxHashSchema } from './common.schema.js';

// ─── Parametri di path ───────────────────────────────────────────────────────

export const ContractIdParamSchema = z.object({
  contractId: OpaqueIdSchema,
}).strict();
export type ContractIdParam = z.infer<typeof ContractIdParamSchema>;

// ─── POST /contracts/{contractId}/notarize ───────────────────────────────────

export const NotarizeContractBodySchema = z.object({
  contentHash: Bytes32HexSchema,
}).strict();
export type NotarizeContractBody = z.infer<typeof NotarizeContractBodySchema>;

export const NotarizeContractResponseSchema = z.object({
  contractId:  OpaqueIdSchema,
  contentHash: Bytes32HexSchema,
  txHash:      TxHashSchema,
  chainId:     z.number().int().positive(),
}).strict();
export type NotarizeContractResponse = z.infer<typeof NotarizeContractResponseSchema>;

// ─── GET /contracts/{contractId} ─────────────────────────────────────────────

export const ContractDtoSchema = z.object({
  contractId:  OpaqueIdSchema,
  contentHash: Bytes32HexSchema,
  notarizedAt: z.iso.datetime(),
  confirmedAt: z.iso.datetime().nullable(),
  status:      OnchainStatusSchema,
  anchoring:   AnchoringRefSchema,
}).strict();
export type ContractDto = z.infer<typeof ContractDtoSchema>;
