import { describe, it, expect } from 'vitest';
import {
  AssetIdParamSchema,
  NotarizeAssetBodySchema,
  AssetDtoSchema,
} from './asset.schema.js';

const HASH = '0x' + 'a'.repeat(64);

describe('Asset schemas', () => {
  describe('AssetIdParamSchema', () => {
    it('accepts a simple opaque id', () => {
      expect(AssetIdParamSchema.parse({ assetId: 'asset-1' })).toEqual({ assetId: 'asset-1' });
    });

    it('rejects empty assetId', () => {
      expect(AssetIdParamSchema.safeParse({ assetId: '' }).success).toBe(false);
    });
  });

  describe('NotarizeAssetBodySchema', () => {
    it('accepts a well-formed bytes32 hash', () => {
      expect(NotarizeAssetBodySchema.parse({ contentHash: HASH })).toEqual({ contentHash: HASH });
    });

    it('rejects a hash with wrong length / no 0x prefix', () => {
      expect(NotarizeAssetBodySchema.safeParse({ contentHash: 'a'.repeat(64) }).success).toBe(false);
      expect(NotarizeAssetBodySchema.safeParse({ contentHash: '0x' + 'a'.repeat(60) }).success).toBe(false);
    });

    it('strict mode rejects unknown properties', () => {
      expect(NotarizeAssetBodySchema.safeParse({ contentHash: HASH, extra: 'x' }).success).toBe(false);
    });
  });

  describe('AssetDtoSchema', () => {
    it('round-trips a typical response', () => {
      const dto = {
        assetId:     'asset-1',
        contentHash: HASH,
        notarizedAt: '2026-06-22T00:00:00.000Z',
        confirmedAt: null,
        status:      'PENDING' as const,
        totalViews:  0,
        anchoring: {
          txHash:      null,
          blockNumber: null,
          chainId:     11155111,
        },
      };
      expect(AssetDtoSchema.parse(dto)).toEqual(dto);
    });

    it('rejects negative totalViews', () => {
      const dto = {
        assetId: 'a', contentHash: HASH, notarizedAt: '2026-06-22T00:00:00Z',
        confirmedAt: null, status: 'CONFIRMED', totalViews: -1,
        anchoring: { txHash: null, blockNumber: null, chainId: 1 },
      };
      expect(AssetDtoSchema.safeParse(dto).success).toBe(false);
    });
  });
});
