import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { makeTestApp, type TestApp } from '#tests/support/test-app.js';

describe('ChainInfoController (HTTP integration)', () => {
  let app: TestApp;

  beforeAll(() => {
    app = makeTestApp();
  });

  afterAll(() => app.restore());

  it('GET /chain/info → 200 with chainId + RPC pointers', async () => {
    const res = await request(app.app).get('/api/v1/chain/info');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      chainId: 11155111,
      recommendedRPC: expect.stringMatching(/^https?:\/\//),
      explorer:       expect.stringMatching(/^https?:\/\//),
    });
    // contractAddress può essere null in dev locale (NOTARY_CONTRACT_ADDRESS vuoto).
    expect(['string', 'object']).toContain(typeof res.body.contractAddress);
  });
});
