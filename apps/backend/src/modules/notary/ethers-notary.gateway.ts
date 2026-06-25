import { inject, injectable } from 'tsyringe';
import { ethers } from 'ethers';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import type { AppConfig } from '#infrastructure/config/index.js';
import type { INotaryGateway, OnchainReceipt, TxStatus, AssetUpdate } from './interfaces/i-notary.gateway.js';
import type { ISignerProvider } from './interfaces/i-signer.provider.js';

// ABI minimale del Notary contract — scritto a mano e tenuto in sync con contracts/Notary.sol.
// Un test (TODO) dovrà pinnare i selector per intercettare drift accidentali.
export const NOTARY_ABI = [
  'function notarizeContract(bytes32 contractId, bytes32 contentHash) external',
  'function notarizeAsset(bytes32 assetId, bytes32 contentHash) external',
  'function publishBatch(uint64 periodId, (bytes32 assetId, uint64 viewsInPeriod)[] updates) external',
  'function assets(bytes32 assetId) view returns (bytes32 contentHash, uint64 notarizedAt, uint256 totalViews)',
  'event ContractNotarized(bytes32 indexed contractId, bytes32 contentHash, uint64 timestamp)',
  'event AssetNotarized(bytes32 indexed assetId, bytes32 contentHash, uint64 timestamp)',
  'event AssetViewsRecorded(bytes32 indexed assetId, uint64 indexed periodId, uint64 viewsInPeriod, uint256 newCumulative)',
  'event BatchPublished(uint64 indexed periodId, uint256 assetCount)',
] as const;

@injectable()
export class EthersNotaryGateway implements INotaryGateway {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly signer: ethers.Signer;
  private readonly contract: ethers.Contract;

  constructor(
    @inject(DI_TOKENS.AppConfig)        config: AppConfig,
    @inject(DI_TOKENS.ISignerProvider)  signerProvider: ISignerProvider,
  ) {
    const { RPC_URL, CONTRACT_ADDRESS } = config.env.NOTARY;
    if (!RPC_URL || !CONTRACT_ADDRESS) {
      throw new Error(
        'EthersNotaryGateway: NOTARY_RPC_URL e NOTARY_CONTRACT_ADDRESS sono richiesti'
      );
    }
    this.provider = new ethers.JsonRpcProvider(RPC_URL);
    // Il signer viene fornito via ISignerProvider — TB-11. Per V0 è
    // LocalSignerProvider (chiave da env, wrappata in NonceManager); in
    // produzione consolidata si sostituisce con KmsSignerProvider senza modifiche qui.
    this.signer = signerProvider.getSigner(this.provider);
    this.contract = new ethers.Contract(CONTRACT_ADDRESS, NOTARY_ABI, this.signer);
  }

  async notarizeContract(contractId: string, contentHash: string): Promise<OnchainReceipt> {
    const fn = this.contract['notarizeContract'] as (id: string, hash: string) => Promise<ethers.TransactionResponse>;
    const tx = await fn(this.asBytes32(contractId), this.asBytes32(contentHash));
    return { txHash: tx.hash };
  }

  async notarizeAsset(assetId: string, contentHash: string): Promise<OnchainReceipt> {
    const fn = this.contract['notarizeAsset'] as (id: string, hash: string) => Promise<ethers.TransactionResponse>;
    const tx = await fn(this.asBytes32(assetId), this.asBytes32(contentHash));
    return { txHash: tx.hash };
  }

  async publishBatch(periodId: number, updates: AssetUpdate[]): Promise<OnchainReceipt> {
    const fn = this.contract['publishBatch'] as (
      p: bigint,
      u: { assetId: string; viewsInPeriod: bigint }[]
    ) => Promise<ethers.TransactionResponse>;
    const payload = updates.map((u) => ({
      assetId:       this.asBytes32(u.assetId),
      viewsInPeriod: BigInt(u.viewsInPeriod),
    }));
    const tx = await fn(BigInt(periodId), payload);
    return { txHash: tx.hash };
  }

  async confirmations(txHash: string): Promise<TxStatus> {
    const receipt = await this.provider.getTransactionReceipt(txHash);
    if (!receipt) return { confirmations: 0, blockNumber: null };
    const latest = await this.provider.getBlockNumber();
    return {
      confirmations: Math.max(0, latest - receipt.blockNumber + 1),
      blockNumber: receipt.blockNumber,
    };
  }

  async getAssetTotalViews(assetId: string): Promise<bigint | null> {
    const fn = this.contract['assets'] as (id: string) => Promise<[string, bigint, bigint]>;
    const tuple = await fn(this.asBytes32(assetId));
    const [contentHash, notarizedAt, totalViews] = tuple;
    void contentHash;
    // notarizedAt === 0 ⇒ asset non registrato on-chain (struct con valori default).
    if (notarizedAt === 0n) return null;
    return totalViews;
  }

  /**
   * Normalizza un identificativo in bytes32. Se è già 0x-hex di 32 byte lo restituisce;
   * altrimenti calcola keccak256(utf8) → 32 byte. Strategia da rivedere se i contractId/assetId
   * del core sono già 32 byte canonici (in quel caso passare opt-in deterministico).
   */
  private asBytes32(value: string): string {
    if (/^0x[0-9a-fA-F]{64}$/.test(value)) return value;
    return ethers.id(value);
  }
}
