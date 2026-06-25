/**
 * Test-support: helper per HTTP integration test via supertest.
 *
 * Avvia container.setup, sovrascrive i service token specificati con i mock forniti
 * e restituisce un'istanza Express pronta per essere passata a supertest. Ripristina
 * i binding originali in `restore()` per non lasciare leak fra suite.
 *
 * IMPORTANTE: routing-controllers/`useContainer` è globale per il processo. I test
 * integration HTTP devono girare in serie (vitest.integration.config.ts ha
 * `fileParallelism: false`).
 */
import 'reflect-metadata';
import '#infrastructure/di/container.setup.js';
import { container } from 'tsyringe';
import type { Express } from 'express';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { appConfig, type AppConfig } from '#infrastructure/config/index.js';
import { ExpressApi } from '#src/express.api.js';
import type { IAssetService } from '#modules/assets/interfaces/i-asset.service.js';
import type { IContractService } from '#modules/contracts/interfaces/i-contract.service.js';
import type { IViewService } from '#modules/views/interfaces/i-view.service.js';
import type { IBatchService } from '#modules/batches/interfaces/i-batch.service.js';
import type { IHealthService } from '#modules/health/interfaces/i-health.service.js';

export interface ServiceOverrides {
  assetService?:    IAssetService;
  contractService?: IContractService;
  viewService?:     IViewService;
  batchService?:    IBatchService;
  healthService?:   IHealthService;
}

const TOKEN_OF: Record<keyof ServiceOverrides, symbol> = {
  assetService:    DI_TOKENS.IAssetService,
  contractService: DI_TOKENS.IContractService,
  viewService:     DI_TOKENS.IViewService,
  batchService:    DI_TOKENS.IBatchService,
  healthService:   DI_TOKENS.IHealthService,
};

export interface TestApp {
  app: Express;
  restore(): void;
}

/**
 * @param overrides service mock da iniettare al posto delle implementazioni reali.
 * @param envOverride override (shallow) della config `env`, es. `{ AUTH: { ENABLED: true, TOKEN } }`
 *   per esercitare il percorso di autenticazione negli integration test.
 */
export function makeTestApp(
  overrides: ServiceOverrides = {},
  envOverride?: Partial<AppConfig['env']>,
): TestApp {
  const cfg: AppConfig = envOverride ? { env: { ...appConfig.env, ...envOverride } } : appConfig;

  // `clearInstances()` rimuove ANCHE le registerInstance precedenti: dopo il clear
  // dobbiamo ri-registrare AppConfig (e successivamente i nostri mock service)
  // prima di risolvere alcunché.
  container.clearInstances();
  container.registerInstance<AppConfig>(DI_TOKENS.AppConfig, cfg);

  for (const [key, instance] of Object.entries(overrides)) {
    if (instance === undefined) continue;
    container.registerInstance(TOKEN_OF[key as keyof ServiceOverrides], instance);
  }

  const api = container.resolve(ExpressApi);

  return {
    app: api.app,
    restore: () => {
      // Reset puro: il prossimo `makeTestApp` ri-registrerà ciò che serve.
      container.clearInstances();
      container.registerInstance<AppConfig>(DI_TOKENS.AppConfig, appConfig);
    },
  };
}
