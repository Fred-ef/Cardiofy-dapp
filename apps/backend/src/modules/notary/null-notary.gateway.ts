import { injectable } from 'tsyringe';
import { randomBytes } from 'node:crypto';
import type { INotaryGateway, OnchainReceipt, TxStatus, AssetUpdate } from './interfaces/i-notary.gateway.js';

/**
 * No-op gateway: usato quando le credenziali on-chain non sono configurate (sviluppo locale).
 * Risponde con txHash random hex (formato bytes32 standard) e conferme istantanee, in modo
 * che il resto del codice di produzione non possa distinguere il NoOp da un gateway reale.
 */
@injectable()
export class NullNotaryGateway implements INotaryGateway {
  async notarizeContract(_contractId: string, _contentHash: string): Promise<OnchainReceipt> {
    return { txHash: this.fakeTxHash() };
  }

  async notarizeAsset(_assetId: string, _contentHash: string): Promise<OnchainReceipt> {
    return { txHash: this.fakeTxHash() };
  }

  async publishBatch(_periodId: number, _updates: AssetUpdate[]): Promise<OnchainReceipt> {
    return { txHash: this.fakeTxHash() };
  }

  async confirmations(_txHash: string): Promise<TxStatus> {
    return { confirmations: 99, blockNumber: 0 };
  }

  async getAssetTotalViews(_assetId: string): Promise<bigint | null> {
    // In sviluppo locale non c'è uno stato on-chain reale; ritorniamo null
    // per disabilitare la verifica difensiva, lasciando il batch confermare.
    return null;
  }

  private fakeTxHash(): string {
    return `0x${randomBytes(32).toString('hex')}`;
  }
}
