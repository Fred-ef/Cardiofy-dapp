import { inject, injectable } from 'tsyringe';
import {
  NonceManager, Wallet,
  type JsonRpcProvider, type Signer, type TransactionRequest, type TransactionResponse,
} from 'ethers';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import type { AppConfig } from '#infrastructure/config/index.js';
import type { ISignerProvider } from './interfaces/i-signer.provider.js';

/**
 * Migliora `ethers.NonceManager.sendTransaction` con:
 *
 * 1. Nonce atteso per intero PRIMA di avviare populateTransaction, e passato già
 *    valorizzato così questa non ne rifà uno suo.
 * 2. Se la tx non raggiunge la mempool, reset() scarta la cache locale — il prossimo
 *    getNonce('pending') rilegge lo stato reale dalla chain invece di fidarsi di un contatore
 *    locale potenzialmente disallineato.
 * 3. Se invece la tx viene accettata in mempool (anche se poi reverte in esecuzione), sendTransaction
 *    non lancia: nessun reset, il contatore locale resta correttamente allineato.
 */
export class SequentialNonceManager extends NonceManager {
  override async sendTransaction(tx: TransactionRequest): Promise<TransactionResponse> {
    const nonce = await this.getNonce('pending');
    this.increment();
    try {
      const populated = await this.signer.populateTransaction({ ...tx, nonce });
      return await this.signer.sendTransaction(populated);
    } catch (e) {
      this.reset();
      throw e;
    }
  }
}

/**
 * SignerProvider locale: legge `NOTARY_PRIVATE_KEY` da env e costruisce
 * `Wallet → SequentialNonceManager`. Pronto per dev e production con `.env` controllato.
 *
 * In produzione consolidata si raccomanda il KmsSignerProvider (TB-11 follow-up):
 * stesso contratto, chiave custodita in KMS cloud, niente accesso plain-text.
 */
@injectable()
export class LocalSignerProvider implements ISignerProvider {
  private signer: Signer | null = null;

  constructor(@inject(DI_TOKENS.AppConfig) private readonly config: AppConfig) { }

  getSigner(provider: JsonRpcProvider): Signer {
    if (this.signer) return this.signer;
    const pk = this.config.env.NOTARY.PRIVATE_KEY;
    if (!pk) {
      throw new Error('LocalSignerProvider: NOTARY_PRIVATE_KEY non configurata');
    }
    const wallet = new Wallet(pk, provider);
    this.signer = new SequentialNonceManager(wallet);
    return this.signer;
  }

  describe(): string {
    return 'local:env';
  }
}
