import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { makeTestApp, type TestApp } from '#tests/support/test-app.js';
import { makeViewServiceMock } from '#tests/support/mocks.js';
import type { IViewService } from '#modules/views/interfaces/i-view.service.js';

const validBody = {
  assetId:    'asset-1',
  occurredAt: '2026-06-22T14:00:00Z',
};

describe('ViewController (HTTP integration)', () => {
  let app: TestApp;
  let svc: IViewService;

  beforeAll(() => {
    svc = makeViewServiceMock();
    app = makeTestApp({ viewService: svc });
  });

  afterAll(() => app.restore());

  it('returns 202 with eventId + periodId on happy path', async () => {
    vi.mocked(svc.register).mockResolvedValueOnce({
      eventId:   'evt-1',
      periodId:  1_750_636_800,
      duplicate: false,
    });

    const res = await request(app.app)
      .post('/api/v1/views')
      .set('Idempotency-Key', 'idem-' + 'x'.repeat(20))
      .send(validBody);

    expect(res.status).toBe(202);
    expect(res.body).toEqual({ eventId: 'evt-1', periodId: 1_750_636_800, duplicate: false });
  });

  it('replays idempotently (202 + duplicate:true) when the key was already seen', async () => {
    vi.mocked(svc.register).mockResolvedValueOnce({
      eventId:   'evt-1',
      periodId:  1_750_636_800,
      duplicate: true,
    });

    const res = await request(app.app)
      .post('/api/v1/views')
      .set('Idempotency-Key', 'idem-' + 'x'.repeat(20))
      .send(validBody);
    expect(res.status).toBe(202);
    expect(res.body).toEqual({ eventId: 'evt-1', periodId: 1_750_636_800, duplicate: true });
  });

  it('returns 400 if Idempotency-Key is missing', async () => {
    const res = await request(app.app)
      .post('/api/v1/views')
      .send(validBody);
    expect(res.status).toBe(400);
  });

  it('returns 400 if body is malformed (no assetId)', async () => {
    const res = await request(app.app)
      .post('/api/v1/views')
      .set('Idempotency-Key', 'idem-' + 'x'.repeat(20))
      .send({ occurredAt: '2026-06-22T14:00:00Z' });
    expect(res.status).toBe(400);
  });
});
