import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { makeTestApp, type TestApp } from '#tests/support/test-app.js';
import { makeBatchServiceMock } from '#tests/support/mocks.js';
import { fixtures } from '#tests/support/fixtures.js';
import { NotFoundError } from '#errors/not-found.error.js';
import type { IBatchService } from '#modules/batches/interfaces/i-batch.service.js';

describe('BatchController (HTTP integration)', () => {
  let app: TestApp;
  let svc: IBatchService;

  beforeAll(() => {
    svc = makeBatchServiceMock();
    app = makeTestApp({ batchService: svc });
  });

  afterAll(() => app.restore());

  it('returns 200 with DTO when batch is found', async () => {
    vi.mocked(svc.get).mockResolvedValueOnce(fixtures.batch({ periodId: 1_750_636_800 }));
    const res = await request(app.app).get('/api/v1/batches/1750636800');
    expect(res.status).toBe(200);
    expect(res.body.periodId).toBe(1_750_636_800);
    expect(res.body.anchoring.chainId).toBe(11155111);
  });

  it('returns 404 when the batch is not found', async () => {
    vi.mocked(svc.get).mockRejectedValueOnce(new NotFoundError('not found'));
    const res = await request(app.app).get('/api/v1/batches/1750636800');
    expect(res.status).toBe(404);
  });

  it('returns 400 if periodId is not a valid integer', async () => {
    const res = await request(app.app).get('/api/v1/batches/not-a-number');
    expect(res.status).toBe(400);
  });
});
