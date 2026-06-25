export type OnchainStatus = 'PENDING' | 'CONFIRMED' | 'FAILED';

export interface BatchUpdate {
  assetId:       string;
  viewsInPeriod: number;
}

interface BatchProps {
  periodId:    number;
  assetCount:  number;
  viewsTotal:  number;
  status:      OnchainStatus;
  txHash:      string | null;
  blockNumber: number | null;
  createdAt:   Date;
  confirmedAt: Date | null;
  payload:     BatchUpdate[];
}

export class Batch {
  public readonly periodId:    number;
  public readonly assetCount:  number;
  public readonly viewsTotal:  number;
  public readonly status:      OnchainStatus;
  public readonly txHash:      string | null;
  public readonly blockNumber: number | null;
  public readonly createdAt:   Date;
  public readonly confirmedAt: Date | null;
  public readonly payload:     BatchUpdate[];

  private constructor(p: BatchProps) {
    this.periodId    = p.periodId;
    this.assetCount  = p.assetCount;
    this.viewsTotal  = p.viewsTotal;
    this.status      = p.status;
    this.txHash      = p.txHash;
    this.blockNumber = p.blockNumber;
    this.createdAt   = p.createdAt;
    this.confirmedAt = p.confirmedAt;
    this.payload     = p.payload;
  }

  static reconstitute(p: BatchProps): Batch {
    return new Batch(p);
  }
}
