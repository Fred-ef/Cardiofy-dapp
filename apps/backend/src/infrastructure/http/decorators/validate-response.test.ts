import { describe, it, expect } from 'vitest';
import { assertValidResponse } from './validate-response.js';
import { LivenessResponseSchema, NotarizeAssetResponseSchema } from '@cardiofy/shared';

describe('assertValidResponse', () => {
  it('returns the parsed data when the content matches the schema', () => {
    const out = assertValidResponse(LivenessResponseSchema, { status: 'ok' });
    expect(out).toEqual({ status: 'ok' });
  });

  it('throws when a required field violates a refinement (server-side bug)', () => {
    // txHash non in formato Bytes32Hex → lo schema rifiuta a runtime ciò che il
    // tipo statico (string) non intercetterebbe.
    expect(() =>
      assertValidResponse(NotarizeAssetResponseSchema, {
        assetId:     'asset-1',
        contentHash: '0x' + 'a'.repeat(64),
        txHash:      'not-a-hash',
        chainId:     11155111,
      }),
    ).toThrowError(/Response schema validation failed/);
  });

  it('throws and reports the offending path on a malformed response', () => {
    expect(() => assertValidResponse(LivenessResponseSchema, { status: 'broken' }))
      .toThrowError(/status/);
  });
});
