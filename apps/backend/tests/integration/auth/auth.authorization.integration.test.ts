/**
 * Test "secure-by-default" dell'enforcement di autorizzazione (mitigazione #2 del refactor auth).
 *
 * Con AUTH abilitata verifica che:
 *  - una route **protetta** (`@Authorized()`) senza bearer token → 401;
 *  - la stessa route con token valido → NON 401 (il token è accettato);
 *  - una route **pubblica** (nessun `@Authorized()`) resta accessibile senza token.
 *
 * Se un controller di business venisse aggiunto dimenticando `@Authorized()`, il primo
 * assert fallirebbe → la dimenticanza è intercettata in CI invece che a runtime.
 *
 * HTTP integration → gira in serie (vedi nota in test-support/test-app.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { makeTestApp, type TestApp } from '#tests/support/test-app.js';
import { makeAssetServiceMock, makeHealthServiceMock } from '#tests/support/mocks.js';

const TOKEN = 'a'.repeat(32);
const AUTH_ON = { AUTH: { ENABLED: true as const, TOKEN } };

describe('Authorization enforcement (AUTH enabled)', () => {
  let app: TestApp;

  beforeAll(() => {
    app = makeTestApp(
      { assetService: makeAssetServiceMock(), healthService: makeHealthServiceMock() },
      AUTH_ON,
    );
  });

  afterAll(() => app.restore());

  it('protected route without token → 401', async () => {
    const res = await request(app.app).get('/api/v1/assets/asset-1');
    expect(res.status).toBe(401);
  });

  it('protected route with wrong token → 401', async () => {
    const res = await request(app.app)
      .get('/api/v1/assets/asset-1')
      .set('Authorization', `Bearer ${'b'.repeat(32)}`);
    expect(res.status).toBe(401);
  });

  it('protected route with valid token → not 401 (token accepted)', async () => {
    const res = await request(app.app)
      .get('/api/v1/assets/asset-1')
      .set('Authorization', `Bearer ${TOKEN}`);
    expect(res.status).not.toBe(401);
  });

  it('public route stays reachable without token', async () => {
    const res = await request(app.app).get('/api/v1/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
