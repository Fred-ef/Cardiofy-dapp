/**
 * Mock builders riusabili per gli unit test.
 * Convenzione: `make<X>Mock()` restituisce un'implementazione vi.fn-based dell'interfaccia,
 * con default sensati che ogni test può sovrascrivere via mockResolvedValueOnce / mockImplementationOnce.
 */
import { vi } from 'vitest';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';
import type { IAssetRepository } from '#modules/assets/interfaces/i-asset.repository.js';
import type { IContractRepository } from '#modules/contracts/interfaces/i-contract.repository.js';
import type { IViewRepository } from '#modules/views/interfaces/i-view.repository.js';
import type { IBatchRepository } from '#modules/batches/interfaces/i-batch.repository.js';
import type { INotaryGateway } from '#modules/notary/interfaces/i-notary.gateway.js';
import type { IAssetService } from '#modules/assets/interfaces/i-asset.service.js';
import type { IContractService } from '#modules/contracts/interfaces/i-contract.service.js';
import type { IViewService } from '#modules/views/interfaces/i-view.service.js';
import type { IBatchService } from '#modules/batches/interfaces/i-batch.service.js';
import type { IHealthService } from '#modules/health/interfaces/i-health.service.js';
import type { AppConfig } from '#infrastructure/config/index.js';

export function makeLoggerMock(): ILoggerService {
  return {
    info:  vi.fn(),
    warn:  vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
}

export function makeAssetRepoMock(): IAssetRepository {
  return {
    findById:               vi.fn().mockResolvedValue(null),
    create:                 vi.fn(),
    markSubmitted:          vi.fn().mockResolvedValue(undefined),
    markConfirmed:          vi.fn().mockResolvedValue(undefined),
    markFailed:             vi.fn().mockResolvedValue(undefined),
    incrementMirrorViews:   vi.fn().mockResolvedValue(undefined),
    findPendingWithTx:      vi.fn().mockResolvedValue([]),
  };
}

export function makeContractRepoMock(): IContractRepository {
  return {
    findById:          vi.fn().mockResolvedValue(null),
    create:            vi.fn(),
    markSubmitted:     vi.fn().mockResolvedValue(undefined),
    markConfirmed:     vi.fn().mockResolvedValue(undefined),
    markFailed:        vi.fn().mockResolvedValue(undefined),
    findPendingWithTx: vi.fn().mockResolvedValue([]),
  };
}

export function makeViewRepoMock(): IViewRepository {
  return {
    findByIdempotencyKey:  vi.fn().mockResolvedValue(null),
    create:                vi.fn(),
    aggregatesForPeriod:   vi.fn().mockResolvedValue([]),
    markPeriodAnchored:    vi.fn().mockResolvedValue(0),
  };
}

export function makeBatchRepoMock(): IBatchRepository {
  return {
    findByPeriodId:    vi.fn().mockResolvedValue(null),
    createPending:     vi.fn(),
    markSubmitted:     vi.fn().mockResolvedValue(undefined),
    markConfirmed:     vi.fn().mockResolvedValue(undefined),
    markFailed:        vi.fn().mockResolvedValue(undefined),
    findPendingWithTx: vi.fn().mockResolvedValue([]),
  };
}

export function makeNotaryGatewayMock(): INotaryGateway {
  return {
    notarizeContract:    vi.fn().mockResolvedValue({ txHash: '0xtxcontract' }),
    notarizeAsset:       vi.fn().mockResolvedValue({ txHash: '0xtxasset'    }),
    publishBatch:        vi.fn().mockResolvedValue({ txHash: '0xtxbatch'    }),
    confirmations:       vi.fn().mockResolvedValue({ confirmations: 0, blockNumber: null }),
    getAssetTotalViews:  vi.fn().mockResolvedValue(null),
  };
}

export function makeAssetServiceMock(): IAssetService {
  return {
    notarize:      vi.fn(),
    get:           vi.fn(),
    requireExists: vi.fn(),
  };
}

export function makeContractServiceMock(): IContractService {
  return {
    notarize: vi.fn(),
    get:      vi.fn(),
  };
}

export function makeViewServiceMock(): IViewService {
  return {
    register: vi.fn(),
  };
}

export function makeBatchServiceMock(): IBatchService {
  return {
    publishBatchFor:    vi.fn(),
    yesterdayPeriodId:  vi.fn().mockReturnValue(0),
    get:                vi.fn(),
  };
}

export function makeHealthServiceMock(): IHealthService {
  return {
    checkReadiness: vi.fn().mockResolvedValue({ ready: true, checks: [] }),
  };
}

export function makeAppConfigMock(overrides?: Partial<AppConfig['env']>): AppConfig {
  return {
    env: {
      SERVER: {
        PORT: 3001,
        NODE_ENV: 'test',
        SHUTDOWN_TIMEOUT_MS: 5_000,
      },
      DATABASE: {
        DATABASE_URL: 'postgres://test:test@localhost:5432/test',
        DATABASE_MAX_CONN: 5,
      },
      NOTARY: {
        RPC_URL: 'http://localhost:8545',
        PRIVATE_KEY: '0x' + '11'.repeat(32),
        CONTRACT_ADDRESS: '0x' + '22'.repeat(20),
        DEPLOY_BLOCK: 0,
        CHAIN_ID: 11155111,
        CONFIRMATIONS: 1,
      },
      SCHEDULE: {
        BATCH_CRON:      '0 0 * * *',
        RECONCILE_CRON:  '*/5 * * * *',
        BATCH_MAX_CHUNK: 300,
      },
      PUBLIC_AUDIT: {
        RPC_URL: 'https://rpc.sepolia.org',
        EXPLORER_URL: 'https://sepolia.etherscan.io',
      },
      ...overrides,
    },
  } as AppConfig;
}
