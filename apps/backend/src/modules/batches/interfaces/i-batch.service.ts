import type { Batch } from '../batch.domain.js';

export interface IBatchService {
  /** Costruisce e pubblica il batch del periodo indicato. Null se non c'è nulla da pubblicare. */
  publishBatchFor(periodId: number): Promise<Batch | null>;
  /** Calcola il periodId dell'ultimo periodo chiuso (ampiezza da BATCH_PERIOD_SECONDS). */
  previousPeriodId(): number;
  /** Recupera lo stato di un batch. */
  get(periodId: number): Promise<Batch>;
}
