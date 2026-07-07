import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AssetDto, ContractDto, ChainInfoDto } from '@cardiofy/shared';

vi.mock('./api-client.js', () => ({
  api: {
    asset: vi.fn(),
    contract: vi.fn(),
  },
}));
vi.mock('./onchain-client.js', () => ({
  readAssetOnchain: vi.fn(),
  readContractOnchain: vi.fn(),
}));

const { api } = await import('./api-client.js');
const { readAssetOnchain, readContractOnchain } = await import('./onchain-client.js');
const { verifyAsset, verifyContract } = await import('./verifier.js');

const chainInfo: ChainInfoDto = {
  chainId: 11155111,
  contractAddress: '0x' + '1'.repeat(40),
  recommendedRPC: 'https://rpc.sepolia.org',
  explorer: 'https://sepolia.etherscan.io',
};

const HASH = '0x' + 'ab'.repeat(32);
const OTHER_HASH = '0x' + 'cd'.repeat(32);

function makeAssetDto(overrides: Partial<AssetDto> = {}): AssetDto {
  return {
    assetId: 'asset-1',
    contentHash: HASH,
    notarizedAt: '2026-07-01T00:00:00.000Z',
    confirmedAt: null,
    status: 'CONFIRMED',
    totalViews: 10,
    anchoring: { txHash: '0x' + '9'.repeat(64), blockNumber: 100, chainId: 11155111 },
    ...overrides,
  };
}

function makeContractDto(overrides: Partial<ContractDto> = {}): ContractDto {
  return {
    contractId: 'contract-1',
    contentHash: HASH,
    notarizedAt: '2026-07-01T00:00:00.000Z',
    confirmedAt: null,
    status: 'CONFIRMED',
    anchoring: { txHash: '0x' + '9'.repeat(64), blockNumber: 100, chainId: 11155111 },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('verifyAsset', () => {
  it('MATCH quando hash e totalViews coincidono fra API e on-chain', async () => {
    vi.mocked(api.asset).mockResolvedValueOnce(makeAssetDto());
    vi.mocked(readAssetOnchain).mockResolvedValueOnce({
      exists: true,
      contentHash: HASH,
      notarizedAt: 1n,
      totalViews: 10n,
    });

    const result = await verifyAsset(chainInfo, 'asset-1');

    expect(result.overall).toBe('MATCH');
    expect(result.checks).toHaveLength(2);
    expect(result.checks[0]?.verdict).toBe('MATCH');
    expect(result.checks[1]?.verdict).toBe('MATCH');
  });

  it('MISMATCH quando il contentHash diverge', async () => {
    vi.mocked(api.asset).mockResolvedValueOnce(makeAssetDto({ contentHash: HASH }));
    vi.mocked(readAssetOnchain).mockResolvedValueOnce({
      exists: true,
      contentHash: OTHER_HASH,
      notarizedAt: 1n,
      totalViews: 10n,
    });

    const result = await verifyAsset(chainInfo, 'asset-1');

    expect(result.overall).toBe('MISMATCH');
  });

  it('WARN quando solo totalViews diverge (hash coerente)', async () => {
    vi.mocked(api.asset).mockResolvedValueOnce(makeAssetDto({ totalViews: 10 }));
    vi.mocked(readAssetOnchain).mockResolvedValueOnce({
      exists: true,
      contentHash: HASH,
      notarizedAt: 1n,
      totalViews: 7n,
    });

    const result = await verifyAsset(chainInfo, 'asset-1');

    expect(result.overall).toBe('WARN');
  });

  it('NOT_ON_CHAIN quando notarizedAt è zero', async () => {
    vi.mocked(api.asset).mockResolvedValueOnce(makeAssetDto());
    vi.mocked(readAssetOnchain).mockResolvedValueOnce({
      exists: false,
      contentHash: '0x' + '0'.repeat(64),
      notarizedAt: 0n,
      totalViews: 0n,
    });

    const result = await verifyAsset(chainInfo, 'asset-1');

    expect(result.overall).toBe('NOT_ON_CHAIN');
  });
});

describe('verifyContract', () => {
  it('MATCH quando il contentHash coincide', async () => {
    vi.mocked(api.contract).mockResolvedValueOnce(makeContractDto());
    vi.mocked(readContractOnchain).mockResolvedValueOnce({ exists: true, contentHash: HASH });

    const result = await verifyContract(chainInfo, 'contract-1');

    expect(result.overall).toBe('MATCH');
  });

  it('MISMATCH quando il contentHash diverge', async () => {
    vi.mocked(api.contract).mockResolvedValueOnce(makeContractDto({ contentHash: HASH }));
    vi.mocked(readContractOnchain).mockResolvedValueOnce({ exists: true, contentHash: OTHER_HASH });

    const result = await verifyContract(chainInfo, 'contract-1');

    expect(result.overall).toBe('MISMATCH');
  });

  it('NOT_ON_CHAIN quando il contratto non è notarizzato (hash zero)', async () => {
    vi.mocked(api.contract).mockResolvedValueOnce(makeContractDto());
    vi.mocked(readContractOnchain).mockResolvedValueOnce({ exists: false, contentHash: '0x' + '0'.repeat(64) });

    const result = await verifyContract(chainInfo, 'contract-1');

    expect(result.overall).toBe('NOT_ON_CHAIN');
  });
});
