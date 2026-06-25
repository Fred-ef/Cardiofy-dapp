/**
 * Composition Root & IoC Bootstrap.
 * Side-effect file: tutti i bindings vivono qui per single point of registration.
 */

import { container, instanceCachingFactory } from 'tsyringe';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { appConfig, type AppConfig } from '#infrastructure/config/index.js';
import { DatabaseConnection } from '#infrastructure/database/database.connection.js';
import { ErrorHandler } from '#infrastructure/errors/error-handler.js';
import { ErrorHandlerMiddleware } from '#infrastructure/errors/error-handler.middleware.js';
import { PinoProvider } from '#infrastructure/logger/pino/pino.factory.js';
import { PinoHttpLogger } from '#infrastructure/logger/pino/pino-http.logger.js';
import { PinoLogger } from '#infrastructure/logger/pino/pino.logger.js';
import type { IErrorHandler } from '#infrastructure/errors/interfaces/i-error-handler.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';

// Application & API shell
import { Application } from '#src/application.js';
import { ExpressApi } from '#src/express.api.js';

// Notary gateway + signer provider
import { NullNotaryGateway } from '#modules/notary/null-notary.gateway.js';
import { EthersNotaryGateway } from '#modules/notary/ethers-notary.gateway.js';
import { LocalSignerProvider } from '#modules/notary/local-signer.provider.js';
import type { INotaryGateway } from '#modules/notary/interfaces/i-notary.gateway.js';
import type { ISignerProvider } from '#modules/notary/interfaces/i-signer.provider.js';

// Modules — Assets
import { DrizzleAssetRepository } from '#modules/assets/asset.repository.js';
import { AssetService } from '#modules/assets/asset.service.js';
import { AssetController } from '#modules/assets/asset.controller.js';
import type { IAssetRepository } from '#modules/assets/interfaces/i-asset.repository.js';
import type { IAssetService } from '#modules/assets/interfaces/i-asset.service.js';

// Modules — Contracts
import { DrizzleContractRepository } from '#modules/contracts/contract.repository.js';
import { ContractService } from '#modules/contracts/contract.service.js';
import { ContractController } from '#modules/contracts/contract.controller.js';
import type { IContractRepository } from '#modules/contracts/interfaces/i-contract.repository.js';
import type { IContractService } from '#modules/contracts/interfaces/i-contract.service.js';

// Modules — Views
import { DrizzleViewRepository } from '#modules/views/view.repository.js';
import { ViewService } from '#modules/views/view.service.js';
import { ViewController } from '#modules/views/view.controller.js';
import type { IViewRepository } from '#modules/views/interfaces/i-view.repository.js';
import type { IViewService } from '#modules/views/interfaces/i-view.service.js';

// Modules — Batches
import { DrizzleBatchRepository } from '#modules/batches/batch.repository.js';
import { BatchService } from '#modules/batches/batch.service.js';
import { BatchController } from '#modules/batches/batch.controller.js';
import { BatchJob } from '#modules/batches/batch.job.js';
import type { IBatchRepository } from '#modules/batches/interfaces/i-batch.repository.js';
import type { IBatchService } from '#modules/batches/interfaces/i-batch.service.js';

// Modules — Chain info
import { ChainInfoController } from '#modules/chain-info/chain-info.controller.js';

// Modules — OpenAPI
import { OpenApiController } from '#modules/openapi/openapi.controller.js';

// Modules — Reconciliation
import { ReconciliationService } from '#modules/reconciliation/reconciliation.service.js';
import { ReconcileJob } from '#modules/reconciliation/reconciliation.job.js';
import type { IReconciliationService } from '#modules/reconciliation/interfaces/i-reconciliation.service.js';

// Modules — Health
import { HealthService } from '#modules/health/health.service.js';
import { HealthController } from '#modules/health/health.controller.js';
import type { IHealthService } from '#modules/health/interfaces/i-health.service.js';

// Auth middleware
import { AuthMiddleware } from '#infrastructure/auth/auth.middleware.js';

console.log("[TSyringe] 🚀 Setup dell'IoC Container...");

// ########## Configurations ##########
container.registerInstance<AppConfig>(DI_TOKENS.AppConfig, appConfig);

// ########## Infrastructure ##########
container.registerSingleton(DatabaseConnection);
container.registerSingleton(PinoProvider);
container.registerSingleton(DI_TOKENS.PinoProvider, PinoProvider);
container.registerSingleton<ILoggerService>(DI_TOKENS.ILoggerService, PinoLogger);
container.registerSingleton<IErrorHandler>(DI_TOKENS.IErrorHandler, ErrorHandler);
container.registerSingleton(ErrorHandlerMiddleware);
container.registerSingleton(PinoHttpLogger);

// ########## On-chain gateway + signer provider ##########
// SignerProvider: per V0 sempre Local (chiave da env). KmsSignerProvider sarà un
// future-work: stesso token, implementazione diversa.
container.registerSingleton<ISignerProvider>(DI_TOKENS.ISignerProvider, LocalSignerProvider);

// Notary gateway: se le credenziali NOTARY_* mancano, il binding usa la NoOp.
container.register<INotaryGateway>(DI_TOKENS.INotaryGateway, {
  useFactory: instanceCachingFactory((c) => {
    const cfg = c.resolve<AppConfig>(DI_TOKENS.AppConfig);
    const { RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS } = cfg.env.NOTARY;
    if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
      return new NullNotaryGateway();
    }
    return c.resolve(EthersNotaryGateway);
  }),
});

// ########## Repositories ##########
container.registerSingleton<IAssetRepository>(DI_TOKENS.IAssetRepository, DrizzleAssetRepository);
container.registerSingleton<IContractRepository>(DI_TOKENS.IContractRepository, DrizzleContractRepository);
container.registerSingleton<IViewRepository>(DI_TOKENS.IViewRepository, DrizzleViewRepository);
container.registerSingleton<IBatchRepository>(DI_TOKENS.IBatchRepository, DrizzleBatchRepository);

// ########## Services ##########
container.registerSingleton<IAssetService>(DI_TOKENS.IAssetService, AssetService);
container.registerSingleton<IContractService>(DI_TOKENS.IContractService, ContractService);
container.registerSingleton<IViewService>(DI_TOKENS.IViewService, ViewService);
container.registerSingleton<IBatchService>(DI_TOKENS.IBatchService, BatchService);
container.registerSingleton<IReconciliationService>(DI_TOKENS.IReconciliationService, ReconciliationService);
container.registerSingleton<IHealthService>(DI_TOKENS.IHealthService, HealthService);

// ########## Controllers ##########
container.registerSingleton(AssetController);
container.registerSingleton(ContractController);
container.registerSingleton(ViewController);
container.registerSingleton(BatchController);
container.registerSingleton(ChainInfoController);
container.registerSingleton(OpenApiController);
container.registerSingleton(HealthController);

// ########## Middlewares ##########
container.registerSingleton(AuthMiddleware);

// ########## Jobs ##########
container.registerSingleton(BatchJob);
container.registerSingleton(ReconcileJob);

// ########## Application shell ##########
container.registerSingleton(ExpressApi);
container.registerSingleton(Application);

console.log('[TSyringe] ✅ IoC Container Setup completato');
