interface ViewProps {
  id:             string;
  idempotencyKey: string;
  assetId:        string;
  occurredAt:     Date;
  receivedAt:     Date;
  periodId:       number;
  anchored:       boolean;
  batchPeriodId:  number | null;
}

export class View {
  public readonly id:             string;
  public readonly idempotencyKey: string;
  public readonly assetId:        string;
  public readonly occurredAt:     Date;
  public readonly receivedAt:     Date;
  public readonly periodId:       number;
  public readonly anchored:       boolean;
  public readonly batchPeriodId:  number | null;

  private constructor(p: ViewProps) {
    this.id             = p.id;
    this.idempotencyKey = p.idempotencyKey;
    this.assetId        = p.assetId;
    this.occurredAt     = p.occurredAt;
    this.receivedAt     = p.receivedAt;
    this.periodId       = p.periodId;
    this.anchored       = p.anchored;
    this.batchPeriodId  = p.batchPeriodId;
  }

  static reconstitute(p: ViewProps): View {
    return new View(p);
  }
}

/** Calcola il periodId (timestamp Unix di mezzanotte UTC del giorno di `at`). */
export function periodIdOf(at: Date): number {
  const ms = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), 0, 0, 0, 0);
  return Math.floor(ms / 1000);
}
