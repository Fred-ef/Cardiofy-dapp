import type { View } from '../view.domain.js';

export interface RegisterViewInput {
  id:             string;
  idempotencyKey: string;
  assetId:        string;
  occurredAt:     Date;
  periodId:       number;
}

export interface AssetAggregate {
  assetId:       string;
  viewsInPeriod: number;
}

export interface IViewRepository {
  findByIdempotencyKey(key: string): Promise<View | null>;
  create(input: RegisterViewInput): Promise<View>;

  // Usate dal BatchService al cron giornaliero.
  aggregatesForPeriod(periodId: number): Promise<AssetAggregate[]>;
  markPeriodAnchored(periodId: number): Promise<number>;
}
