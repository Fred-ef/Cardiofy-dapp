import type { HealthCheck, ReadinessReport } from '@cardiofy/shared';

export type { HealthCheck, ReadinessReport };

export interface IHealthService {
  /** Verifica readiness (DB raggiungibile, RPC raggiungibile se configurato). */
  checkReadiness(): Promise<ReadinessReport>;
}
