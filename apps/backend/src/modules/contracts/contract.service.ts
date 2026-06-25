import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { NotFoundError } from '#errors/not-found.error.js';
import { ConflictError } from '#errors/conflict.error.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';
import type { AppConfig } from '#infrastructure/config/index.js';
import type { INotaryGateway } from '#modules/notary/interfaces/i-notary.gateway.js';
import type { Contract } from './contract.domain.js';
import type { IContractRepository } from './interfaces/i-contract.repository.js';
import type { IContractService, NotarizeContractResult } from './interfaces/i-contract.service.js';

@injectable()
export class ContractService implements IContractService {
  constructor(
    @inject(DI_TOKENS.IContractRepository) private readonly repo: IContractRepository,
    @inject(DI_TOKENS.INotaryGateway)      private readonly gateway: INotaryGateway,
    @inject(DI_TOKENS.AppConfig)           private readonly config: AppConfig,
    @inject(DI_TOKENS.ILoggerService)      private readonly logger: ILoggerService,
  ) {}

  async notarize(contractId: string, contentHash: string): Promise<NotarizeContractResult> {
    const existing = await this.repo.findById(contractId);
    if (existing) throw new ConflictError(`Contract ${contractId} already notarized`);

    const created = await this.repo.create({ contractId, contentHash });
    try {
      const { txHash } = await this.gateway.notarizeContract(contractId, contentHash);
      await this.repo.markSubmitted(contractId, txHash);
      return {
        contract: created,
        txHash,
        chainId:  this.config.env.NOTARY.CHAIN_ID,
      };
    } catch (err) {
      await this.repo.markFailed(contractId);
      this.logger.error('[ContractService] notarize on-chain failed', err, { contractId });
      throw err;
    }
  }

  async get(contractId: string): Promise<Contract> {
    const c = await this.repo.findById(contractId);
    if (!c) throw new NotFoundError(`Contract ${contractId} not notarized`);
    return c;
  }
}
