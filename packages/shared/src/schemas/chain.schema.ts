import { z } from 'zod';
import { AddressSchema } from './common.schema.js';

// ─── GET /chain/info — endpoint pubblico per audit indipendente ──────────────

export const ChainInfoDtoSchema = z.object({
  chainId:         z.number().int().positive(),
  contractAddress: AddressSchema.nullable(),
  recommendedRPC:  z.url(),
  explorer:        z.url(),
}).strict();
export type ChainInfoDto = z.infer<typeof ChainInfoDtoSchema>;
