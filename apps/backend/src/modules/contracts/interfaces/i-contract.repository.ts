import type { Contract } from '../contract.domain.js';

export interface NotarizeContractInput {
  contractId: string;
  contentHash: string;
}

export interface IContractRepository {
  findById(contractId: string): Promise<Contract | null>;
  create(input: NotarizeContractInput): Promise<Contract>;
  markSubmitted(contractId: string, txHash: string): Promise<void>;
  markConfirmed(contractId: string, blockNumber: number, confirmedAt: Date): Promise<void>;
  markFailed(contractId: string): Promise<void>;
  /** Notarizzazioni in attesa di conferma on-chain (PENDING con txHash valorizzato). */
  findPendingWithTx(): Promise<Contract[]>;
}
