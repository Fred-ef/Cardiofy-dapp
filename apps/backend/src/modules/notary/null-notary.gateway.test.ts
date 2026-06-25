import { describe, it, expect } from 'vitest';
import { NullNotaryGateway } from './null-notary.gateway.js';

describe('NullNotaryGateway', () => {
  const gateway = new NullNotaryGateway();

  it('returns a deterministic-shape txHash for notarizeContract', async () => {
    const { txHash } = await gateway.notarizeContract('contract-x', '0xhash');
    expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('returns a txHash for notarizeAsset', async () => {
    const { txHash } = await gateway.notarizeAsset('asset-x', '0xhash');
    expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('returns a txHash for publishBatch (also with empty updates)', async () => {
    const { txHash } = await gateway.publishBatch(1, []);
    expect(txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('always returns confirmed status for confirmations()', async () => {
    const status = await gateway.confirmations('0x' + 'ab'.repeat(32));
    expect(status.confirmations).toBeGreaterThan(0);
    expect(status.blockNumber).toBeGreaterThanOrEqual(0);
  });
});
