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
  createdAt:     Date;
  confirmedAt:   Date | null;
  payload:       BatchUpdate[];
  mirrorApplied: boolean;
}

export class Batch {
  public readonly periodId:      number;
  public readonly assetCount:    number;
  public readonly viewsTotal:    number;
  public readonly status:        OnchainStatus;
  public readonly txHash:        string | null;
  public readonly blockNumber:   number | null;
  public readonly createdAt:     Date;
  public readonly confirmedAt:   Date | null;
  public readonly payload:       BatchUpdate[];
  public readonly mirrorApplied: boolean;

  private constructor(p: BatchProps) {
    this.periodId      = p.periodId;
    this.assetCount    = p.assetCount;
    this.viewsTotal    = p.viewsTotal;
    this.status        = p.status;
    this.txHash        = p.txHash;
    this.blockNumber   = p.blockNumber;
    this.createdAt     = p.createdAt;
    this.confirmedAt   = p.confirmedAt;
    this.payload       = p.payload;
    this.mirrorApplied = p.mirrorApplied;
  }

  static reconstitute(p: BatchProps): Batch {
    return new Batch(p);
  }
}

/**
 * Un chunk è l'unità transazionale di un batch: lo slice di asset pubblicato in una
 * singola `publishBatch`. Identità composta (periodId, chunkIndex), stato on-chain proprio.
 */
interface BatchChunkProps {
  periodId:    number;
  chunkIndex:  number;
  payload:     BatchUpdate[];
  status:      OnchainStatus;
  txHash:      string | null;
  blockNumber: number | null;
  createdAt:   Date;
  confirmedAt: Date | null;
}

export class BatchChunk {
  public readonly periodId:    number;
  public readonly chunkIndex:  number;
  public readonly payload:     BatchUpdate[];
  public readonly status:      OnchainStatus;
  public readonly txHash:      string | null;
  public readonly blockNumber: number | null;
  public readonly createdAt:   Date;
  public readonly confirmedAt: Date | null;

  private constructor(p: BatchChunkProps) {
    this.periodId    = p.periodId;
    this.chunkIndex  = p.chunkIndex;
    this.payload     = p.payload;
    this.status      = p.status;
    this.txHash      = p.txHash;
    this.blockNumber = p.blockNumber;
    this.createdAt   = p.createdAt;
    this.confirmedAt = p.confirmedAt;
  }

  static reconstitute(p: BatchChunkProps): BatchChunk {
    return new BatchChunk(p);
  }
}
