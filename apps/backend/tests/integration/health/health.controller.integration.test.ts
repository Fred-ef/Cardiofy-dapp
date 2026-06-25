import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { makeTestApp, type TestApp } from '#tests/support/test-app.js';
import { makeHealthServiceMock } from '#tests/support/mocks.js';
import type { IHealthService } from '#modules/health/interfaces/i-health.service.js';

describe('HealthController (HTTP integration)', () => {
  let app: TestApp;
  let svc: IHealthService;

  beforeAll(() => {
    svc = makeHealthServiceMock();
    app = makeTestApp({ healthService: svc });
  });

  afterAll(() => app.restore());

  it('GET /health/live → 200 { status: "ok" }', async () => {
    const res = await request(app.app).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('GET /health/ready → 200 with report when ready', async () => {
    vi.mocked(svc.checkReadiness).mockResolvedValueOnce({
      ready: true,
      checks: [{ name: 'database', status: 'ok', durationMs: 5 }],
    });
    const res = await request(app.app).get('/api/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
  });

  it('GET /health/ready → 503 when not ready', async () => {
    vi.mocked(svc.checkReadiness).mockResolvedValueOnce({
      ready: false,
      checks: [{ name: 'database', status: 'fail', durationMs: 1, error: 'down' }],
    });
    const res = await request(app.app).get('/api/v1/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.ready).toBe(false);
  });
});
