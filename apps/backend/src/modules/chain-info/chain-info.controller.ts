import { inject, injectable } from 'tsyringe';
import { JsonController, Get } from 'routing-controllers';
import { ChainInfoDtoSchema, type ChainInfoDto } from '@cardiofy/shared';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { ValidateResponse } from '#decorators';
import type { AppConfig } from '#infrastructure/config/index.js';
import { toChainInfoDto } from './chain-info.mapper.js';

@injectable()
@JsonController('/chain')
export class ChainInfoController {
  constructor(@inject(DI_TOKENS.AppConfig) private readonly config: AppConfig) {}

  /**
   * Espone le informazioni necessarie a condurre l'audit indipendente direttamente
   * dalla blockchain, senza intermediazione del modulo.
   */
  @Get('/info')
  @ValidateResponse(ChainInfoDtoSchema)
  info(): ChainInfoDto {
    return toChainInfoDto(this.config);
  }
}
