import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ViewService } from './view.service.js';
import { NotFoundError } from '#errors/not-found.error.js';
import {
  makeViewRepoMock,
  makeAssetServiceMock,
  makeAppConfigMock,
} from '#tests/support/mocks.js';
import { fixtures } from '#tests/support/fixtures.js';
import type { IViewRepository } from './interfaces/i-view.repository.js';
import type { IAssetService } from '#modules/assets/interfaces/i-asset.service.js';
import type { AppConfig } from '#infrastructure/config/index.js';

describe('ViewService.register', () => {
  let repo:    IViewRepository;
  let assets:  IAssetService;
  let config:  AppConfig;
  let service: ViewService;

  const baseCommand = {
    idempotencyKey: 'idem-key-1',
    assetId:        'asset-test-1',
    occurredAt:     new Date('2026-06-22T15:30:00Z'),
  };

  beforeEach(() => {
    repo    = makeViewRepoMock();
    assets  = makeAssetServiceMock();
    config  = makeAppConfigMock();
    service = new ViewService(repo, assets, config);
  });

  it('persists a new view and returns its periodId', async () => {
    vi.mocked(assets.requireExists).mockResolvedValueOnce(fixtures.asset());
    vi.mocked(repo.findByIdempotencyKey).mockResolvedValueOnce(null);
    vi.mocked(repo.create).mockResolvedValueOnce(fixtures.view());

    const result = await service.register(baseCommand);

    expect(repo.findByIdempotencyKey).toHaveBeenCalledWith('idem-key-1');
    expect(assets.requireExists).toHaveBeenCalledWith('asset-test-1');
    expect(repo.create).toHaveBeenCalled();
    expect(result.duplicate).toBe(false);
    expect(typeof result.eventId).toBe('string');
    expect(result.periodId).toBeGreaterThan(0);
  });

  it('returns duplicate=true and does NOT call create when idempotency-key is reused', async () => {
    vi.mocked(repo.findByIdempotencyKey).mockResolvedValueOnce(fixtures.view());

    const result = await service.register(baseCommand);

    expect(result.duplicate).toBe(true);
    expect(repo.create).not.toHaveBeenCalled();
    expect(assets.requireExists).not.toHaveBeenCalled();
  });

  it('refuses to register a view for an unknown asset', async () => {
    vi.mocked(repo.findByIdempotencyKey).mockResolvedValueOnce(null);
    vi.mocked(assets.requireExists).mockRejectedValueOnce(new NotFoundError('Asset ghost not notarized'));

    await expect(service.register({ ...baseCommand, assetId: 'ghost' }))
      .rejects.toBeInstanceOf(NotFoundError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('computes the periodId based on UTC midnight of occurredAt', async () => {
    vi.mocked(assets.requireExists).mockResolvedValueOnce(fixtures.asset());
    vi.mocked(repo.findByIdempotencyKey).mockResolvedValueOnce(null);
    vi.mocked(repo.create).mockImplementationOnce(async (input) => fixtures.view({
      id:             input.id,
      idempotencyKey: input.idempotencyKey,
      assetId:        input.assetId,
      periodId:       input.periodId,
      occurredAt:     input.occurredAt,
    }));

    const result = await service.register({
      ...baseCommand,
      occurredAt: new Date('2026-06-22T23:59:00Z'),
    });
    const expectedMidnight = Math.floor(Date.UTC(2026, 5, 22) / 1000);
    expect(result.periodId).toBe(expectedMidnight);
  });

  it('honors a configured BATCH_PERIOD_SECONDS narrower than a day', async () => {
    const cfg = makeAppConfigMock();
    cfg.env.SCHEDULE.BATCH_PERIOD_SECONDS = 300; // 5 minuti
    const svc = new ViewService(repo, assets, cfg);

    vi.mocked(assets.requireExists).mockResolvedValueOnce(fixtures.asset());
    vi.mocked(repo.findByIdempotencyKey).mockResolvedValueOnce(null);
    vi.mocked(repo.create).mockImplementationOnce(async (input) => fixtures.view({
      id:             input.id,
      idempotencyKey: input.idempotencyKey,
      assetId:        input.assetId,
      periodId:       input.periodId,
      occurredAt:     input.occurredAt,
    }));

    const result = await svc.register({
      ...baseCommand,
      occurredAt: new Date('2026-06-22T12:34:56Z'),
    });
    const expectedBucket = Math.floor(Date.UTC(2026, 5, 22, 12, 30, 0) / 1000);
    expect(result.periodId).toBe(expectedBucket);
  });
});
