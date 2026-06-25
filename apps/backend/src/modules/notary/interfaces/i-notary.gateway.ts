export interface OnchainReceipt {
  txHash: string;
}

export interface TxStatus {
  confirmations: number;
  blockNumber: number | null;
}

export interface AssetUpdate {
  assetId: string;       // 0x-prefixed bytes32 (oppure stringa convertita lato gateway)
  viewsInPeriod: number;
}

/**
 * Gateway swappable verso lo smart contract Notary.
 * - In sviluppo: NullNotaryGateway (no-op).
 * - In esercizio: EthersNotaryGateway (firma con la chiave attester).
 */
export interface INotaryGateway {
  notarizeContract(contractId: string, contentHash: string): Promise<OnchainReceipt>;
  notarizeAsset(assetId: string, contentHash: string): Promise<OnchainReceipt>;
  publishBatch(periodId: number, updates: AssetUpdate[]): Promise<OnchainReceipt>;
  confirmations(txHash: string): Promise<TxStatus>;
  /**
   * Legge il contatore on-chain `assets[assetId].totalViews`. Usato dalla
   * riconciliazione difensiva: dopo la conferma di un batch, il valore on-chain
   * deve combaciare con il mirror locale. In caso di mismatch, il batch resta
   * PENDING e viene loggato un alert (pattern CMP `onchainRoot !== anchor.rootHash`).
   * Ritorna null se l'asset non è notarizzato on-chain.
   */
  getAssetTotalViews(assetId: string): Promise<bigint | null>;
}
