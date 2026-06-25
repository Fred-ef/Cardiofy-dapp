export interface ReconciliationCounters {
  scanned:      number;
  confirmed:    number;
  stillPending: number;
  failed:       number;
}

export interface ReconciliationRunSummary {
  contracts: ReconciliationCounters;
  assets:    ReconciliationCounters;
  batches:   ReconciliationCounters;
}

export interface IReconciliationService {
  /** Esegue un ciclo completo di riconciliazione e ritorna il riepilogo. */
  reconcileAll(): Promise<ReconciliationRunSummary>;
}
