import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import type { ChainInfoDto } from '@cardiofy/shared';
import { toBytes32, readAssetOnchain, readContractOnchain } from './onchain-client.js';

describe('toBytes32', () => {
  it('lascia invariato un id già in forma bytes32', () => {
    const hash = ethers.id('some-content');
    expect(toBytes32(hash)).toBe(hash);
  });

  it('converte una stringa opaca con keccak256 (come ethers.id)', () => {
    expect(toBytes32('asset-123')).toBe(ethers.id('asset-123'));
  });

  it('è case-insensitive per la regex ma non normalizza il case dell\'input già-hash', () => {
    const hash = '0x' + 'AB'.repeat(32);
    expect(toBytes32(hash)).toBe(hash);
  });
});

describe('degrado con contractAddress assente', () => {
  const chainInfoNoContract: ChainInfoDto = {
    chainId: 11155111,
    contractAddress: null,
    recommendedRPC: 'https://rpc.sepolia.org',
    explorer: 'https://sepolia.etherscan.io',
  };

  it('readAssetOnchain lancia un errore chiaro invece di crashare', async () => {
    await expect(readAssetOnchain(chainInfoNoContract, 'asset-1')).rejects.toThrow(
      /contractAddress in \/chain\/info/,
    );
  });

  it('readContractOnchain lancia un errore chiaro invece di crashare', async () => {
    await expect(readContractOnchain(chainInfoNoContract, 'contract-1')).rejects.toThrow(
      /contractAddress in \/chain\/info/,
    );
  });
});
