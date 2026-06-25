import type { ChainInfoDto } from '@cardiofy/shared';
import type { AppConfig } from '#infrastructure/config/index.js';

export function toChainInfoDto(config: AppConfig): ChainInfoDto {
  return {
    chainId:         config.env.NOTARY.CHAIN_ID,
    contractAddress: config.env.NOTARY.CONTRACT_ADDRESS ?? null,
    recommendedRPC:  config.env.PUBLIC_AUDIT.RPC_URL,
    explorer:        config.env.PUBLIC_AUDIT.EXPLORER_URL,
  };
}
