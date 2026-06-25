import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'node:crypto';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import type { IAssetService } from '#modules/assets/interfaces/i-asset.service.js';
import { periodIdOf } from './view.domain.js';
import type { IViewRepository } from './interfaces/i-view.repository.js';
import type { IViewService, RegisterViewCommand, RegisterViewResult } from './interfaces/i-view.service.js';

@injectable()
export class ViewService implements IViewService {
  constructor(
    @inject(DI_TOKENS.IViewRepository) private readonly repo: IViewRepository,
    @inject(DI_TOKENS.IAssetService)   private readonly assets: IAssetService,
  ) {}

  async register(cmd: RegisterViewCommand): Promise<RegisterViewResult> {
    // Idempotenza applicativa: lookup + early return.
    const existing = await this.repo.findByIdempotencyKey(cmd.idempotencyKey);
    if (existing) {
      return { eventId: existing.id, periodId: existing.periodId, duplicate: true };
    }

    // Vincolo: l'asset deve essere già notarizzato (mirror dello stesso vincolo on-chain).
    await this.assets.requireExists(cmd.assetId);

    const id = randomUUID();
    const periodId = periodIdOf(cmd.occurredAt);
    const view = await this.repo.create({
      id,
      idempotencyKey: cmd.idempotencyKey,
      assetId:        cmd.assetId,
      readerHash:     cmd.readerHash,
      sessionId:      cmd.sessionId,
      occurredAt:     cmd.occurredAt,
      periodId,
      evidence:       cmd.evidence,
    });
    return { eventId: view.id, periodId: view.periodId, duplicate: false };
  }
}
