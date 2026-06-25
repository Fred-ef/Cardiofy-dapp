import type { Batch } from '../batch.domain.js';

export interface IBatchService {
  /** Costruisce e pubblica il batch del periodo indicato. Null se non c'è nulla da pubblicare. */
  publishBatchFor(periodId: number): Promise<Batch | null>;
  /** Calcola il periodId del giorno precedente (UTC). */
  yesterdayPeriodId(): number;
  /** Recupera lo stato di un batch. */
  get(periodId: number): Promise<Batch>;
}
