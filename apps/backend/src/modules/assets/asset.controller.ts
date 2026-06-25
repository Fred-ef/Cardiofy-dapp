import { inject, injectable } from 'tsyringe';
import { JsonController, Get, Post, HttpCode, Authorized } from 'routing-controllers';
import {
  AssetIdParamSchema,
  NotarizeAssetBodySchema,
  NotarizeAssetResponseSchema,
  AssetDtoSchema,
  type AssetIdParam,
  type NotarizeAssetBody,
  type NotarizeAssetResponse,
  type AssetDto,
} from '@cardiofy/shared';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { ValidateParams, ValidateBody, ValidateResponse } from '#decorators';
import type { AppConfig } from '#infrastructure/config/index.js';
import type { IAssetService } from './interfaces/i-asset.service.js';
import { toAssetDto, toNotarizeAssetResponse } from './asset.mapper.js';

@injectable()
@Authorized()
@JsonController('/assets')
export class AssetController {
  constructor(
    @inject(DI_TOKENS.IAssetService) private readonly service: IAssetService,
    @inject(DI_TOKENS.AppConfig)     private readonly config: AppConfig,
  ) {}

  @Post('/:assetId/notarize')
  @HttpCode(201)
  @ValidateResponse(NotarizeAssetResponseSchema)
  async notarize(
    @ValidateParams(AssetIdParamSchema) params: AssetIdParam,
    @ValidateBody(NotarizeAssetBodySchema) body: NotarizeAssetBody,
  ): Promise<NotarizeAssetResponse> {
    const result = await this.service.notarize(params.assetId, body.contentHash);
    return toNotarizeAssetResponse(result);
  }

  @Get('/:assetId')
  @ValidateResponse(AssetDtoSchema)
  async get(@ValidateParams(AssetIdParamSchema) params: AssetIdParam): Promise<AssetDto> {
    const asset = await this.service.get(params.assetId);
    return toAssetDto(asset, this.config.env.NOTARY.CHAIN_ID);
  }
}
