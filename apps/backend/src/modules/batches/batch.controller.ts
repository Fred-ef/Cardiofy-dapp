import { inject, injectable } from 'tsyringe';
import { JsonController, Get, Authorized } from 'routing-controllers';
import { PeriodIdParamSchema, BatchDtoSchema, type PeriodIdParam, type BatchDto } from '@cardiofy/shared';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { ValidateParams, ValidateResponse } from '#decorators';
import type { AppConfig } from '#infrastructure/config/index.js';
import type { IBatchService } from './interfaces/i-batch.service.js';
import { toBatchDto } from './batch.mapper.js';

@injectable()
@Authorized()
@JsonController('/batches')
export class BatchController {
  constructor(
    @inject(DI_TOKENS.IBatchService) private readonly service: IBatchService,
    @inject(DI_TOKENS.AppConfig)     private readonly config: AppConfig,
  ) {}

  @Get('/:periodId')
  @ValidateResponse(BatchDtoSchema)
  async get(@ValidateParams(PeriodIdParamSchema) params: PeriodIdParam): Promise<BatchDto> {
    const batch = await this.service.get(params.periodId);
    return toBatchDto(batch, this.config.env.NOTARY.CHAIN_ID);
  }
}
