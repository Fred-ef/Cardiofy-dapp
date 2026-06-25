/**
 * Tokens (Symbols) registrations for Dependency Injection.
 */

export const DI_TOKENS = {
  // Repositories
  IAssetRepository:    Symbol.for('IAssetRepository'),
  IContractRepository: Symbol.for('IContractRepository'),
  IViewRepository:     Symbol.for('IViewRepository'),
  IBatchRepository:    Symbol.for('IBatchRepository'),

  // Services
  IAssetService:          Symbol.for('IAssetService'),
  IContractService:       Symbol.for('IContractService'),
  IViewService:           Symbol.for('IViewService'),
  IBatchService:          Symbol.for('IBatchService'),
  IReconciliationService: Symbol.for('IReconciliationService'),
  IHealthService:         Symbol.for('IHealthService'),

  // On-chain gateway
  INotaryGateway:  Symbol.for('INotaryGateway'),
  ISignerProvider: Symbol.for('ISignerProvider'),

  // Infrastructure
  IErrorHandler:  Symbol.for('IErrorHandler'),
  ILoggerService: Symbol.for('ILoggerService'),
  PinoProvider:   Symbol.for('PinoProvider'),

  // Configurations
  AppConfig: Symbol.for('AppConfig'),
} as const;
