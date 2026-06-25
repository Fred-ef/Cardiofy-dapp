/**
 * Asset — value object che riflette l'entità notarizzata.
 * `totalViewsMirror` è il valore mirror locale del contatore on-chain;
 * la fonte autoritativa pubblica resta sempre la blockchain.
 */

export type OnchainStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

interface AssetProps {
  assetId:           string;
  contentHash:       string;
  status:            OnchainStatus;
  txHash:            string | null;
  blockNumber:       number | null;
  notarizedAt:       Date;
  confirmedAt:       Date | null;
  totalViewsMirror:  number;
}

export class Asset {
  public readonly assetId:           string;
  public readonly contentHash:       string;
  public readonly status:            OnchainStatus;
  public readonly txHash:            string | null;
  public readonly blockNumber:       number | null;
  public readonly notarizedAt:       Date;
  public readonly confirmedAt:       Date | null;
  public readonly totalViewsMirror:  number;

  private constructor(p: AssetProps) {
    this.assetId           = p.assetId;
    this.contentHash       = p.contentHash;
    this.status            = p.status;
    this.txHash            = p.txHash;
    this.blockNumber       = p.blockNumber;
    this.notarizedAt       = p.notarizedAt;
    this.confirmedAt       = p.confirmedAt;
    this.totalViewsMirror  = p.totalViewsMirror;
  }

  static reconstitute(p: AssetProps): Asset {
    return new Asset(p);
  }
}
