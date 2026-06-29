import { inject, injectable } from 'tsyringe';
import { JsonController, Post, HttpCode, Authorized } from 'routing-controllers';
import {
  ViewBodySchema,
  IdempotencyKeyHeaderSchema,
  ViewResponseSchema,
  type ViewBody,
  type IdempotencyKeyHeader,
  type ViewResponse,
} from '@cardiofy/shared';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { ValidateBody, ValidateHeaders, ValidateResponse } from '#decorators';
import type { IViewService } from './interfaces/i-view.service.js';
import { toViewResponse } from './view.mapper.js';

@injectable()
@Authorized()
@JsonController('/views')
export class ViewController {
  constructor(
    @inject(DI_TOKENS.IViewService) private readonly service: IViewService,
  ) {}

  @Post('/')
  @HttpCode(202)
  @ValidateResponse(ViewResponseSchema)
  async register(
    @ValidateBody(ViewBodySchema) body: ViewBody,
    @ValidateHeaders(IdempotencyKeyHeaderSchema) headers: IdempotencyKeyHeader,
  ): Promise<ViewResponse> {
    // Idempotenza: un retry con la stessa Idempotency-Key è un replay sicuro → 202 con
    // l'esito originale (`duplicate: true` nel body), non un errore. La presenza
    // dell'header è già garantita da `@ValidateHeaders(IdempotencyKeyHeaderSchema)`.
    const result = await this.service.register({
      idempotencyKey: headers['idempotency-key'],
      assetId:        body.assetId,
      occurredAt:     new Date(body.occurredAt),
    });
    return toViewResponse(result);
  }
}
