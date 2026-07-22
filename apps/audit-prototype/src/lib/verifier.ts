import type { AssetDto, ContractDto, ChainInfoDto } from '@cardiofy/shared';
import { api } from './api-client.js';
import { readAssetOnchain, readContractOnchain, type OnchainAsset, type OnchainContract } from './onchain-client.js';

export type Verdict = 'MATCH' | 'WARN' | 'MISMATCH' | 'NOT_ON_CHAIN';

export interface FieldCheck {
  label: string;
  apiValue: string;
  /** null = non leggibile on-chain (es. batch: nessun mapping read nel contratto). */
  chainValue: string | null;
  verdict: Verdict;
  note?: string;
}

export interface VerifyResult<TApi> {
  api: TApi;
  overall: Verdict;
  checks: FieldCheck[];
}

const eqHash = (a?: string | null, b?: string | null): boolean =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

export async function verifyAsset(info: ChainInfoDto, assetId: string, token?: string): Promise<VerifyResult<AssetDto>> {
  const apiDto = await api.asset(assetId, token);
  const chain: OnchainAsset = await readAssetOnchain(info, assetId);

  if (!chain.exists) {
    return {
      api: apiDto,
      overall: 'NOT_ON_CHAIN',
      checks: [
        {
          label: 'Notarizzazione',
          apiValue: apiDto.status,
          chainValue: 'assente',
          verdict: 'NOT_ON_CHAIN',
          note: "L'asset non risulta notarizzato on-chain (notarizedAt=0).",
        },
      ],
    };
  }

  const hashOk = eqHash(apiDto.contentHash, chain.contentHash);
  const viewsOk = chain.totalViews === BigInt(apiDto.totalViews);

  const checks: FieldCheck[] = [
    {
      label: 'Content hash',
      apiValue: apiDto.contentHash,
      chainValue: chain.contentHash,
      verdict: hashOk ? 'MATCH' : 'MISMATCH',
    },
    {
      label: 'Total views',
      apiValue: String(apiDto.totalViews),
      chainValue: chain.totalViews.toString(),
      verdict: viewsOk ? 'MATCH' : 'WARN',
      ...(viewsOk ? {} : { note: 'Divergenza possibile se il batch del periodo non è ancora confermato.' }),
    },
  ];

  // Hash mismatch = allarme rosso; solo views diverse = warning giallo (transiente).
  const overall: Verdict = !hashOk ? 'MISMATCH' : viewsOk ? 'MATCH' : 'WARN';
  return { api: apiDto, overall, checks };
}

export async function verifyContract(
  info: ChainInfoDto,
  contractId: string,
  token?: string,
): Promise<VerifyResult<ContractDto>> {
  const apiDto = await api.contract(contractId, token);
  const chain: OnchainContract = await readContractOnchain(info, contractId);

  if (!chain.exists) {
    return {
      api: apiDto,
      overall: 'NOT_ON_CHAIN',
      checks: [
        {
          label: 'Notarizzazione',
          apiValue: apiDto.status,
          chainValue: 'assente',
          verdict: 'NOT_ON_CHAIN',
          note: 'Il contratto non risulta notarizzato on-chain (hash zero).',
        },
      ],
    };
  }

  const hashOk = eqHash(apiDto.contentHash, chain.contentHash);
  return {
    api: apiDto,
    overall: hashOk ? 'MATCH' : 'MISMATCH',
    checks: [
      {
        label: 'Content hash',
        apiValue: apiDto.contentHash,
        chainValue: chain.contentHash,
        verdict: hashOk ? 'MATCH' : 'MISMATCH',
      },
    ],
  };
}
