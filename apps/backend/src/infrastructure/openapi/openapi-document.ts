/**
 * OpenAPI document builder (D2).
 *
 * Genera una spec OpenAPI 3.1 a partire dagli schemi Zod di `@cardiofy/shared`,
 * via `zod-openapi`. Lo schema è single source of truth: ciò che è qui dichiarato
 * è esattamente ciò che il modulo accetta/restituisce.
 *
 * Convenzioni:
 *   - tag per famiglia (Assets, Contracts, Views, Batches, Chain, Health).
 *   - response schema validato lato runtime dai `ValidateResponse` decorator.
 *   - error shape comune (vedi `ErrorResponseSchema` in fondo).
 */
import { z } from 'zod';
import { createDocument } from 'zod-openapi';
import {
  // Asset
  AssetIdParamSchema,
  NotarizeAssetBodySchema,
  NotarizeAssetResponseSchema,
  AssetDtoSchema,
  // Contract
  ContractIdParamSchema,
  NotarizeContractBodySchema,
  NotarizeContractResponseSchema,
  ContractDtoSchema,
  // View
  ViewBodySchema,
  IdempotencyKeyHeaderSchema,
  ViewResponseSchema,
  // Batch
  PeriodIdParamSchema,
  BatchDtoSchema,
  // Chain / Health
  ChainInfoDtoSchema,
  LivenessResponseSchema,
  ReadinessReportSchema,
} from '@cardiofy/shared';

const ErrorResponseSchema = z.object({
  status:     z.literal('error'),
  statusCode: z.number().int(),
  message:    z.string(),
  code:       z.string(),
  issues:     z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  traceId:    z.string().optional(),
});

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: ErrorResponseSchema } },
});

const BearerAuth = { bearerAuth: [] as string[] };

/**
 * Costruisce il documento OpenAPI. Idempotente: chiamarlo più volte produce
 * sempre la stessa spec (gli schemi Zod sono statici).
 */
export function buildOpenApiDocument(serverUrl: string): ReturnType<typeof createDocument> {
  return createDocument({
    openapi: '3.1.0',
    info: {
      title:   'Cardiofy — Blockchain Module API',
      version: '0.1.0',
      description:
        'Modulo blockchain di Cardiofy: REST API verso lo smart contract Notary. ' +
        'Notarizzazione di contratti e asset, registrazione di view, pubblicazione ' +
        'batch giornaliero, lettura stato e prove indipendenti.',
    },
    servers: [{ url: serverUrl }],
    tags: [
      { name: 'Assets',    description: 'Notarizzazione e stato degli asset' },
      { name: 'Contracts', description: 'Notarizzazione e stato dei contratti' },
      { name: 'Views',     description: 'Registrazione delle view valide' },
      { name: 'Batches',   description: 'Metadati dei batch giornalieri pubblicati' },
      { name: 'Chain',     description: 'Endpoint pubblico per audit indipendente' },
      { name: 'Health',    description: 'Liveness / readiness probes' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type:   'http',
          scheme: 'bearer',
          description:
            'Bearer token condiviso fra core Cardiofy e modulo blockchain. ' +
            'Configurato lato server con env `CORE_AUTH_TOKEN`.',
        },
      },
    },
    paths: {
      // ─── Assets ─────────────────────────────────────────────────────────────
      '/api/v1/assets/{assetId}/notarize': {
        post: {
          tags: ['Assets'],
          summary: 'Notarizza un nuovo asset on-chain',
          security: [BearerAuth],
          requestParams: { path: AssetIdParamSchema },
          requestBody:   { content: { 'application/json': { schema: NotarizeAssetBodySchema } } },
          responses: {
            '201': {
              description: 'Asset notarizzato (transazione inviata, in attesa di conferma)',
              content: { 'application/json': { schema: NotarizeAssetResponseSchema } },
            },
            '400': errorResponse('Body invalido'),
            '401': errorResponse('Bearer token mancante o invalido'),
            '409': errorResponse('Asset già notarizzato'),
          },
        },
      },
      '/api/v1/assets/{assetId}': {
        get: {
          tags: ['Assets'],
          summary: 'Stato di un asset (compreso totalViews cumulativo)',
          security: [BearerAuth],
          requestParams: { path: AssetIdParamSchema },
          responses: {
            '200': {
              description: 'Asset trovato',
              content: { 'application/json': { schema: AssetDtoSchema } },
            },
            '401': errorResponse('Bearer token mancante o invalido'),
            '404': errorResponse('Asset non notarizzato'),
          },
        },
      },

      // ─── Contracts ──────────────────────────────────────────────────────────
      '/api/v1/contracts/{contractId}/notarize': {
        post: {
          tags: ['Contracts'],
          summary: 'Notarizza un nuovo contratto on-chain',
          security: [BearerAuth],
          requestParams: { path: ContractIdParamSchema },
          requestBody:   { content: { 'application/json': { schema: NotarizeContractBodySchema } } },
          responses: {
            '201': {
              description: 'Contratto notarizzato (transazione inviata)',
              content: { 'application/json': { schema: NotarizeContractResponseSchema } },
            },
            '400': errorResponse('Body invalido'),
            '401': errorResponse('Bearer token mancante o invalido'),
            '409': errorResponse('Contratto già notarizzato'),
          },
        },
      },
      '/api/v1/contracts/{contractId}': {
        get: {
          tags: ['Contracts'],
          summary: 'Stato di un contratto',
          security: [BearerAuth],
          requestParams: { path: ContractIdParamSchema },
          responses: {
            '200': {
              description: 'Contratto trovato',
              content: { 'application/json': { schema: ContractDtoSchema } },
            },
            '401': errorResponse('Bearer token mancante o invalido'),
            '404': errorResponse('Contratto non notarizzato'),
          },
        },
      },

      // ─── Views ──────────────────────────────────────────────────────────────
      '/api/v1/views': {
        post: {
          tags: ['Views'],
          summary: 'Registra una view valida (idempotente via Idempotency-Key)',
          security: [BearerAuth],
          requestParams: { header: IdempotencyKeyHeaderSchema },
          requestBody:   { content: { 'application/json': { schema: ViewBodySchema } } },
          responses: {
            '202': {
              description: 'View accettata',
              content: { 'application/json': { schema: ViewResponseSchema } },
            },
            '400': errorResponse('Body invalido o Idempotency-Key mancante'),
            '401': errorResponse('Bearer token mancante o invalido'),
            '409': errorResponse('Idempotency-Key già vista (duplicate)'),
          },
        },
      },

      // ─── Batches ────────────────────────────────────────────────────────────
      '/api/v1/batches/{periodId}': {
        get: {
          tags: ['Batches'],
          summary: 'Metadati del batch giornaliero pubblicato per il periodo',
          security: [BearerAuth],
          requestParams: { path: PeriodIdParamSchema },
          responses: {
            '200': {
              description: 'Batch trovato',
              content: { 'application/json': { schema: BatchDtoSchema } },
            },
            '401': errorResponse('Bearer token mancante o invalido'),
            '404': errorResponse('Batch non trovato per il periodo'),
          },
        },
      },

      // ─── Chain (pubblico) ──────────────────────────────────────────────────
      '/api/v1/chain/info': {
        get: {
          tags: ['Chain'],
          summary: 'Informazioni per audit indipendente (chainId, contract address, RPC pubblico)',
          // niente security: endpoint pubblico
          responses: {
            '200': {
              description: 'Info chain',
              content: { 'application/json': { schema: ChainInfoDtoSchema } },
            },
          },
        },
      },

      // ─── Health (pubblico) ─────────────────────────────────────────────────
      '/api/v1/health/live': {
        get: {
          tags: ['Health'],
          summary: 'Liveness probe (200 sempre se il processo risponde)',
          responses: {
            '200': {
              description: 'Servizio vivo',
              content: { 'application/json': { schema: LivenessResponseSchema } },
            },
          },
        },
      },
      '/api/v1/health/ready': {
        get: {
          tags: ['Health'],
          summary: 'Readiness probe (DB raggiungibile + RPC reachable se configurato)',
          responses: {
            '200': {
              description: 'Pronto',
              content: { 'application/json': { schema: ReadinessReportSchema } },
            },
            '503': {
              description: 'Non pronto (uno o più check falliti)',
              content: { 'application/json': { schema: ReadinessReportSchema } },
            },
          },
        },
      },
    },
  });
}
