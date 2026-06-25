import { z } from 'zod';
import { ONCHAIN_STATUS_VALUES } from '../enums/index.js';

/** Identificatore opaco lato core (contract/asset id). */
export const OpaqueIdSchema = z.string().min(1).max(128);

/** Hash bytes32 0x-prefixed (64 hex). */
export const Bytes32HexSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'must be 0x-prefixed bytes32 (66 chars incl. 0x)');

/** Address Ethereum 0x-prefixed (40 hex). */
export const AddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'must be a 0x-prefixed Ethereum address');

/** Tx hash bytes32 0x-prefixed (alias di Bytes32HexSchema, ma esposto come tipo distinto per leggibilità). */
export const TxHashSchema = Bytes32HexSchema;

/** Stato on-chain di un'entità (PENDING / CONFIRMED / FAILED). */
export const OnchainStatusSchema = z.enum(ONCHAIN_STATUS_VALUES);

/** Riferimenti on-chain comuni a entity status. */
export const AnchoringRefSchema = z
  .object({
    txHash:      TxHashSchema.nullable(),
    blockNumber: z.number().int().nonnegative().nullable(),
    chainId:     z.number().int().positive(),
  })
  .strict();

export type AnchoringRef = z.infer<typeof AnchoringRefSchema>;
