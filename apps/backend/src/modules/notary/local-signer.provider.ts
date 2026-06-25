import { inject, injectable } from 'tsyringe';
import { NonceManager, Wallet, type JsonRpcProvider, type Signer } from 'ethers';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import type { AppConfig } from '#infrastructure/config/index.js';
import type { ISignerProvider } from './interfaces/i-signer.provider.js';

/**
 * SignerProvider locale: legge `NOTARY_PRIVATE_KEY` da env e costruisce
 * `Wallet → NonceManager`. Pronto per dev e production con `.env` controllato.
 *
 * In produzione consolidata si raccomanda il KmsSignerProvider (TB-11 follow-up):
 * stesso contratto, chiave custodita in KMS cloud, niente accesso plain-text.
 */
@injectable()
export class LocalSignerProvider implements ISignerProvider {
  private signer: Signer | null = null;

  constructor(@inject(DI_TOKENS.AppConfig) private readonly config: AppConfig) {}

  getSigner(provider: JsonRpcProvider): Signer {
    if (this.signer) return this.signer;
    const pk = this.config.env.NOTARY.PRIVATE_KEY;
    if (!pk) {
      throw new Error('LocalSignerProvider: NOTARY_PRIVATE_KEY non configurata');
    }
    const wallet = new Wallet(pk, provider);
    this.signer = new NonceManager(wallet);
    return this.signer;
  }

  describe(): string {
    return 'local:env';
  }
}
