import type { Contract } from '../contract.domain.js';

export interface NotarizeContractResult {
  contract: Contract;
  txHash:   string;
  chainId:  number;
}

export interface IContractService {
  notarize(contractId: string, contentHash: string): Promise<NotarizeContractResult>;
  get(contractId: string): Promise<Contract>;
}
