import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { makeTestApp, type TestApp } from '#tests/support/test-app.js';
import { makeContractServiceMock } from '#tests/support/mocks.js';
import { fixtures } from '#tests/support/fixtures.js';
import { ConflictError } from '#errors/conflict.error.js';
import { NotFoundError } from '#errors/not-found.error.js';
import type { IContractService } from '#modules/contracts/interfaces/i-contract.service.js';

const VALID_HASH = '0x' + 'aa'.repeat(32);

describe('ContractController (HTTP integration)', () => {
  let app: TestApp;
  let contractService: IContractService;

  beforeAll(() => {
    contractService = makeContractServiceMock();
    app = makeTestApp({ contractService });
  });

  afterAll(() => app.restore());

  it('POST /contracts/:id/notarize → 201 with txHash on happy path', async () => {
    vi.mocked(contractService.notarize).mockResolvedValueOnce({
      contract: fixtures.contract({ contractId: 'c1', contentHash: VALID_HASH }),
      txHash:   fixtures.txHash,
      chainId:  11155111,
    });

    const res = await request(app.app)
      .post('/api/v1/contracts/c1/notarize')
      .send({ contentHash: VALID_HASH });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ contractId: 'c1', txHash: fixtures.txHash });
  });

  it('POST /contracts/:id/notarize → 400 on malformed hash', async () => {
    const res = await request(app.app)
      .post('/api/v1/contracts/c1/notarize')
      .send({ contentHash: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /contracts/:id/notarize → 409 when service throws ConflictError', async () => {
    vi.mocked(contractService.notarize).mockRejectedValueOnce(
      new ConflictError('Contract already notarized'),
    );
    const res = await request(app.app)
      .post('/api/v1/contracts/c1/notarize')
      .send({ contentHash: VALID_HASH });
    expect(res.status).toBe(409);
  });

  it('GET /contracts/:id → 200 with DTO when found', async () => {
    vi.mocked(contractService.get).mockResolvedValueOnce(
      fixtures.contract({ contractId: 'c1', contentHash: VALID_HASH }),
    );
    const res = await request(app.app).get('/api/v1/contracts/c1');
    expect(res.status).toBe(200);
    expect(res.body.contractId).toBe('c1');
    expect(res.body.contentHash).toBe(VALID_HASH);
    expect(res.body.anchoring.chainId).toBe(11155111);
  });

  it('GET /contracts/:id → 404 when service throws NotFoundError', async () => {
    vi.mocked(contractService.get).mockRejectedValueOnce(new NotFoundError('ghost'));
    const res = await request(app.app).get('/api/v1/contracts/ghost');
    expect(res.status).toBe(404);
  });
});
