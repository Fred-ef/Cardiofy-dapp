import type { ContractDto, NotarizeContractResponse } from '@cardiofy/shared';
import type { Contract } from './contract.domain.js';
import type { NotarizeContractResult } from './interfaces/i-contract.service.js';

export function toNotarizeContractResponse(result: NotarizeContractResult): NotarizeContractResponse {
  return {
    contractId:  result.contract.contractId,
    contentHash: result.contract.contentHash,
    txHash:      result.txHash,
    chainId:     result.chainId,
  };
}

export function toContractDto(contract: Contract, chainId: number): ContractDto {
  return {
    contractId:  contract.contractId,
    contentHash: contract.contentHash,
    notarizedAt: contract.notarizedAt.toISOString(),
    confirmedAt: contract.confirmedAt?.toISOString() ?? null,
    status:      contract.status,
    anchoring: {
      txHash:      contract.txHash,
      blockNumber: contract.blockNumber,
      chainId,
    },
  };
}
