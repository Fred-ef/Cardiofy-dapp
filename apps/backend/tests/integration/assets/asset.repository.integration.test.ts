import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startTestDb, type TestDb } from '#tests/support/test-db.js';
import { DrizzleAssetRepository } from '#modules/assets/asset.repository.js';

const HASH_A = '0x' + 'aa'.repeat(32);
const HASH_B = '0x' + 'bb'.repeat(32);
const TX     = '0x' + 'cc'.repeat(32);

describe('DrizzleAssetRepository (integration)', () => {
  let db: TestDb;
  let repo: DrizzleAssetRepository;

  beforeAll(async () => {
    db = await startTestDb();
    repo = new DrizzleAssetRepository(db.connection);
  });

  afterAll(async () => {
    await db.stop();
  });

  beforeEach(async () => {
    await db.truncateAll();
  });

  describe('create + findById', () => {
    it('persists a new asset in PENDING with totalViewsMirror=0', async () => {
      const created = await repo.create({ assetId: 'asset-1', contentHash: HASH_A });
      expect(created.assetId).toBe('asset-1');
      expect(created.status).toBe('PENDING');
      expect(created.totalViewsMirror).toBe(0);
      expect(created.txHash).toBeNull();
      expect(created.confirmedAt).toBeNull();

      const fetched = await repo.findById('asset-1');
      expect(fetched).not.toBeNull();
      expect(fetched!.contentHash).toBe(HASH_A);
    });

    it('returns null on unknown assetId', async () => {
      expect(await repo.findById('ghost')).toBeNull();
    });

    it('rejects duplicate assetId at the database level', async () => {
      await repo.create({ assetId: 'asset-1', contentHash: HASH_A });
      await expect(repo.create({ assetId: 'asset-1', contentHash: HASH_B }))
        .rejects.toThrow();
    });
  });

  describe('status transitions', () => {
    it('markSubmitted writes the tx hash without changing status', async () => {
      await repo.create({ assetId: 'asset-1', contentHash: HASH_A });
      await repo.markSubmitted('asset-1', TX);
      const fetched = await repo.findById('asset-1');
      expect(fetched!.status).toBe('PENDING');
      expect(fetched!.txHash).toBe(TX);
    });

    it('markConfirmed flips to CONFIRMED and stores blockNumber + confirmedAt', async () => {
      await repo.create({ assetId: 'asset-1', contentHash: HASH_A });
      await repo.markSubmitted('asset-1', TX);
      const when = new Date('2026-06-22T01:00:00Z');
      await repo.markConfirmed('asset-1', 1234, when);

      const fetched = await repo.findById('asset-1');
      expect(fetched!.status).toBe('CONFIRMED');
      expect(fetched!.blockNumber).toBe(1234);
      expect(fetched!.confirmedAt?.toISOString()).toBe(when.toISOString());
    });

    it('markFailed flips to FAILED', async () => {
      await repo.create({ assetId: 'asset-1', contentHash: HASH_A });
      await repo.markFailed('asset-1');
      const fetched = await repo.findById('asset-1');
      expect(fetched!.status).toBe('FAILED');
    });
  });

  describe('incrementMirrorViews', () => {
    it('adds the delta atomically (idempotent for non-overlapping updates)', async () => {
      await repo.create({ assetId: 'asset-1', contentHash: HASH_A });
      await repo.incrementMirrorViews('asset-1', 3);
      await repo.incrementMirrorViews('asset-1', 5);
      const fetched = await repo.findById('asset-1');
      expect(fetched!.totalViewsMirror).toBe(8);
    });
  });

  describe('findPendingWithTx', () => {
    it('returns only PENDING rows that have a tx hash set', async () => {
      // No tx: not returned.
      await repo.create({ assetId: 'asset-1', contentHash: HASH_A });
      // PENDING + tx: returned.
      await repo.create({ assetId: 'asset-2', contentHash: HASH_A });
      await repo.markSubmitted('asset-2', TX);
      // CONFIRMED + tx: not returned.
      await repo.create({ assetId: 'asset-3', contentHash: HASH_A });
      await repo.markSubmitted('asset-3', TX);
      await repo.markConfirmed('asset-3', 1, new Date());
      // FAILED + tx: not returned.
      await repo.create({ assetId: 'asset-4', contentHash: HASH_A });
      await repo.markSubmitted('asset-4', TX);
      await repo.markFailed('asset-4');

      const pending = await repo.findPendingWithTx();
      const ids = pending.map((a) => a.assetId).sort();
      expect(ids).toEqual(['asset-2']);
    });
  });
});
