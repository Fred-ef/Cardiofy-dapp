import type { Signer, JsonRpcProvider } from 'ethers';

/**
 * Astrazione del provider della chiave attester (TB-11).
 *
 * Permette di sostituire la sorgente della chiave senza toccare il gateway:
 * - `LocalSignerProvider`: legge `NOTARY_PRIVATE_KEY` da env. Usabile in dev e (con
 *   cautela) anche in produzione; soluzione di partenza.
 * - `KmsSignerProvider` (future-work): la chiave non lascia mai il KMS, il backend
 *   ottiene solo firme su digest specifici via API IAM. Pattern enterprise standard
 *   per chiavi di produzione (AWS KMS, GCP KMS, Azure Key Vault, Fireblocks).
 *
 * L'implementazione deve restituire un `ethers.Signer` collegato al provider RPC
 * passato, in modo che il gateway possa istanziare `Contract(addr, abi, signer)`
 * trasparentemente.
 */
export interface ISignerProvider {
  /** Crea/recupera un signer collegato al provider dato. Idempotente per istanza. */
  getSigner(provider: JsonRpcProvider): Signer;
  /** Identificativo human-readable (es. "local:env", "aws-kms:keyId=abc123"). */
  describe(): string;
}
