import { z } from 'zod';
import {
  ChainInfoDtoSchema,
  AssetDtoSchema,
  ContractDtoSchema,
  BatchDtoSchema,
  type ChainInfoDto,
  type AssetDto,
  type ContractDto,
  type BatchDto,
} from '@cardiofy/shared';
import { API_BASE_URL, API_PREFIX } from '../config.js';

/** Errore ricco che porta con sé i campi del formato d'errore del backend (vedi ErrorHandlerMiddleware). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: string,
    readonly traceId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const ApiErrorBodySchema = z
  .object({
    message: z.string(),
    statusCode: z.number(),
    code: z.string().optional(),
    traceId: z.string().optional(),
  })
  .partial({ message: true });

async function getJson<T>(path: string, schema: z.ZodType<T>, token?: string): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, { headers });
  } catch (e) {
    // fetch fallito prima di ricevere una risposta = rete/CORS/backend giù.
    throw new ApiError(`Backend irraggiungibile (${API_BASE_URL}). ${(e as Error).message}`, 0);
  }

  const raw: unknown = await res.json().catch(() => ({}));

  if (!res.ok) {
    const parsed = ApiErrorBodySchema.safeParse(raw);
    const body: Partial<z.infer<typeof ApiErrorBodySchema>> = parsed.success ? parsed.data : {};
    throw new ApiError(body.message ?? res.statusText, body.statusCode ?? res.status, body.code, body.traceId);
  }

  // Il backend valida già in uscita; qui ci proteggiamo da drift di schema/versione.
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(`Risposta API non conforme allo schema atteso: ${parsed.error.message}`, res.status);
  }
  return parsed.data;
}

export const api = {
  chainInfo: (): Promise<ChainInfoDto> => getJson('/chain/info', ChainInfoDtoSchema),

  healthLive: async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE_URL}${API_PREFIX}/health/live`);
      return res.ok;
    } catch {
      return false;
    }
  },

  asset: (id: string, token?: string): Promise<AssetDto> =>
    getJson(`/assets/${encodeURIComponent(id)}`, AssetDtoSchema, token),

  contract: (id: string, token?: string): Promise<ContractDto> =>
    getJson(`/contracts/${encodeURIComponent(id)}`, ContractDtoSchema, token),

  batch: (periodId: number, token?: string): Promise<BatchDto> =>
    getJson(`/batches/${periodId}`, BatchDtoSchema, token),
};

export type { ChainInfoDto, AssetDto, ContractDto, BatchDto };
