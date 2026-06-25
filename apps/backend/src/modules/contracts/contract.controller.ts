import { inject, injectable } from 'tsyringe';
import { JsonController, Get, Post, HttpCode, Authorized } from 'routing-controllers';
import {
  ContractIdParamSchema,
  NotarizeContractBodySchema,
  NotarizeContractResponseSchema,
  ContractDtoSchema,
  type ContractIdParam,
  type NotarizeContractBody,
  type NotarizeContractResponse,
  type ContractDto,
} from '@cardiofy/shared';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { ValidateParams, ValidateBody, ValidateResponse } from '#decorators';
import type { AppConfig } from '#infrastructure/config/index.js';
import type { IContractService } from './interfaces/i-contract.service.js';
import { toContractDto, toNotarizeContractResponse } from './contract.mapper.js';

@injectable()
@Authorized()
@JsonController('/contracts')
export class ContractController {
  constructor(
    @inject(DI_TOKENS.IContractService) private readonly service: IContractService,
    @inject(DI_TOKENS.AppConfig)        private readonly config: AppConfig,
  ) {}

  @Post('/:contractId/notarize')
  @HttpCode(201)
  @ValidateResponse(NotarizeContractResponseSchema)
  async notarize(
    @ValidateParams(ContractIdParamSchema) params: ContractIdParam,
    @ValidateBody(NotarizeContractBodySchema) body: NotarizeContractBody,
  ): Promise<NotarizeContractResponse> {
    const result = await this.service.notarize(params.contractId, body.contentHash);
    return toNotarizeContractResponse(result);
  }

  @Get('/:contractId')
  @ValidateResponse(ContractDtoSchema)
  async get(@ValidateParams(ContractIdParamSchema) params: ContractIdParam): Promise<ContractDto> {
    const contract = await this.service.get(params.contractId);
    return toContractDto(contract, this.config.env.NOTARY.CHAIN_ID);
  }
}
