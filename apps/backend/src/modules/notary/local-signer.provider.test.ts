import { describe, it, expect } from 'vitest';
import { JsonRpcProvider, NonceManager } from 'ethers';
import { LocalSignerProvider } from './local-signer.provider.js';
import { makeAppConfigMock } from '#tests/support/mocks.js';

describe('LocalSignerProvider', () => {
  const dummyProvider = new JsonRpcProvider('http://127.0.0.1:9999');

  it('returns a NonceManager-wrapped Wallet built from NOTARY_PRIVATE_KEY', () => {
    const cfg = makeAppConfigMock();
    const provider = new LocalSignerProvider(cfg);
    const signer = provider.getSigner(dummyProvider);
    expect(signer).toBeInstanceOf(NonceManager);
  });

  it('returns the same instance on subsequent calls (idempotent)', () => {
    const cfg = makeAppConfigMock();
    const provider = new LocalSignerProvider(cfg);
    const a = provider.getSigner(dummyProvider);
    const b = provider.getSigner(dummyProvider);
    expect(a).toBe(b);
  });

  it('throws when NOTARY_PRIVATE_KEY is not configured', () => {
    const cfg = makeAppConfigMock();
    cfg.env.NOTARY = { ...cfg.env.NOTARY, PRIVATE_KEY: undefined };
    const provider = new LocalSignerProvider(cfg);
    expect(() => provider.getSigner(dummyProvider)).toThrowError(/NOTARY_PRIVATE_KEY/);
  });

  it('describe() returns a stable identifier', () => {
    expect(new LocalSignerProvider(makeAppConfigMock()).describe()).toBe('local:env');
  });
});
