import { ethers } from 'ethers';
import type { ChainInfoDto } from '@cardiofy/shared';
import { NOTARY_READ_ABI, RPC_URL_OVERRIDE } from '../config.js';

/** id opaco → bytes32 (stessa regola di apps/notary/scripts/verify.ts). */
export const toBytes32 = (id: string): string => (/^0x[0-9a-fA-F]{64}$/.test(id) ? id : ethers.id(id));

function makeContract(info: ChainInfoDto): ethers.Contract {
  if (!info.contractAddress) {
    throw new Error('Nessun contractAddress in /chain/info: il Notary non è configurato sul backend.');
  }
  const rpc = RPC_URL_OVERRIDE ?? info.recommendedRPC;
  const provider = new ethers.JsonRpcProvider(rpc, info.chainId);
  return new ethers.Contract(info.contractAddress, NOTARY_READ_ABI, provider);
}

export interface OnchainAsset {
  exists: boolean;
  contentHash: string;
  notarizedAt: bigint;
  totalViews: bigint;
}

export interface OnchainContract {
  exists: boolean;
  contentHash: string;
}

export async function readAssetOnchain(info: ChainInfoDto, assetId: string): Promise<OnchainAsset> {
  const contract = makeContract(info);
  const fn = contract['assets'] as (id: string) => Promise<[string, bigint, bigint]>;
  const [contentHash, notarizedAt, totalViews] = await fn(toBytes32(assetId));
  return { exists: notarizedAt !== 0n, contentHash, notarizedAt, totalViews };
}

export async function readContractOnchain(info: ChainInfoDto, contractId: string): Promise<OnchainContract> {
  const contract = makeContract(info);
  const fn = contract['contracts'] as (id: string) => Promise<string>;
  const contentHash = await fn(toBytes32(contractId));
  return { exists: contentHash !== ethers.ZeroHash, contentHash };
}
