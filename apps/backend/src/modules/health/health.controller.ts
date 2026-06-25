import { inject, injectable } from 'tsyringe';
import { JsonController, Get, Res } from 'routing-controllers';
import type { Response } from 'express';
import {
  LivenessResponseSchema,
  ReadinessReportSchema,
  type LivenessResponse,
  type ReadinessReport,
} from '@cardiofy/shared';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { ValidateResponse } from '#decorators';
import type { IHealthService } from './interfaces/i-health.service.js';

@injectable()
@JsonController('/health')
export class HealthController {
  constructor(@inject(DI_TOKENS.IHealthService) private readonly health: IHealthService) {}

  /** Liveness probe: il processo è in esecuzione e risponde. Niente dipendenze esterne. */
  @Get('/live')
  @ValidateResponse(LivenessResponseSchema)
  live(): LivenessResponse {
    return { status: 'ok' };
  }

  /** Readiness probe: il servizio è pronto a ricevere traffico (DB up, RPC reachable). */
  @Get('/ready')
  @ValidateResponse(ReadinessReportSchema)
  async ready(@Res() res: Response): Promise<ReadinessReport> {
    const report = await this.health.checkReadiness();
    if (!report.ready) {
      res.status(503);
    }
    return report;
  }
}
