import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { makeTestApp, type TestApp } from '#tests/support/test-app.js';
import { makeAssetServiceMock } from '#tests/support/mocks.js';
import { fixtures } from '#tests/support/fixtures.js';
import { ConflictError } from '#errors/conflict.error.js';
import { NotFoundError } from '#errors/not-found.error.js';
import type { IAssetService } from '#modules/assets/interfaces/i-asset.service.js';

const VALID_HASH = '0x' + 'aa'.repeat(32);

describe('AssetController (HTTP integration)', () => {
  let app: TestApp;
  let assetService: IAssetService;

  beforeAll(() => {
    assetService = makeAssetServiceMock();
    app = makeTestApp({ assetService });
  });

  afterAll(() => {
    app.restore();
  });

  describe('POST /api/v1/assets/:assetId/notarize', () => {
    it('returns 201 with txHash on happy path', async () => {
      const expected = fixtures.asset({ assetId: 'asset-1', contentHash: VALID_HASH });
      vi.mocked(assetService.notarize).mockResolvedValueOnce({
        asset:   expected,
        txHash:  fixtures.txHash,
        chainId: 11155111,
      });

      const res = await request(app.app)
        .post('/api/v1/assets/asset-1/notarize')
        .send({ contentHash: VALID_HASH });

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        assetId:     'asset-1',
        contentHash: VALID_HASH,
        txHash:      fixtures.txHash,
        chainId:     11155111,
      });
    });

    it('returns 400 on malformed contentHash', async () => {
      const res = await request(app.app)
        .post('/api/v1/assets/asset-1/notarize')
        .send({ contentHash: 'not-hex' });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.issues).toBeInstanceOf(Array);
    });

    it('returns 409 when service throws ConflictError', async () => {
      vi.mocked(assetService.notarize).mockRejectedValueOnce(
        new ConflictError('Asset already notarized'),
      );

      const res = await request(app.app)
        .post('/api/v1/assets/asset-1/notarize')
        .send({ contentHash: VALID_HASH });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT');
    });
  });

  describe('GET /api/v1/assets/:assetId', () => {
    it('returns 200 with asset DTO when found', async () => {
      const asset = fixtures.asset({
        assetId: 'asset-1',
        contentHash: VALID_HASH,
        totalViewsMirror: 42,
        status: 'CONFIRMED',
      });
      vi.mocked(assetService.get).mockResolvedValueOnce(asset);

      const res = await request(app.app).get('/api/v1/assets/asset-1');
      expect(res.status).toBe(200);
      expect(res.body.assetId).toBe('asset-1');
      expect(res.body.totalViews).toBe(42);
      expect(res.body.status).toBe('CONFIRMED');
      expect(res.body.anchoring.chainId).toBe(11155111);
    });

    it('returns 404 when service throws NotFoundError', async () => {
      vi.mocked(assetService.get).mockRejectedValueOnce(
        new NotFoundError('Asset ghost not notarized'),
      );

      const res = await request(app.app).get('/api/v1/assets/ghost');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });
  });
});
