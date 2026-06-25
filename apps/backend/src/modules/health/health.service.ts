import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { DatabaseConnection } from '#infrastructure/database/database.connection.js';
import type { AppConfig } from '#infrastructure/config/index.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';
import type { HealthCheck, IHealthService, ReadinessReport } from './interfaces/i-health.service.js';

@injectable()
export class HealthService implements IHealthService {
  constructor(
    @inject(DatabaseConnection)       private readonly db: DatabaseConnection,
    @inject(DI_TOKENS.AppConfig)      private readonly config: AppConfig,
    @inject(DI_TOKENS.ILoggerService) private readonly logger: ILoggerService,
  ) {}

  async checkReadiness(): Promise<ReadinessReport> {
    const checks: HealthCheck[] = [];
    checks.push(await this.timed('database', () => this.db.testConnection()));

    const rpc = this.config.env.NOTARY.RPC_URL;
    if (rpc) {
      checks.push(await this.timed('notary-rpc', () => this.pingRpc(rpc)));
    } else {
      checks.push({ name: 'notary-rpc', status: 'skip', durationMs: 0 });
    }

    const ready = checks.every((c) => c.status !== 'fail');
    return { ready, checks };
  }

  private async timed(name: string, fn: () => Promise<void>): Promise<HealthCheck> {
    const start = Date.now();
    try {
      await fn();
      return { name, status: 'ok', durationMs: Date.now() - start };
    } catch (err) {
      this.logger.warn(`[Health] check ${name} failed`, { error: err instanceof Error ? err.message : String(err) });
      return {
        name,
        status: 'fail',
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Verifica leggera del provider RPC: chiama `eth_chainId` via fetch JSON-RPC.
   * Niente dipendenze extra (ethers non serve qui).
   */
  private async pingRpc(rpcUrl: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    try {
      const res = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
      const payload = (await res.json()) as { result?: string; error?: { message: string } };
      if (payload.error) throw new Error(`RPC error: ${payload.error.message}`);
      if (typeof payload.result !== 'string') throw new Error('RPC malformed response');
    } finally {
      clearTimeout(timeout);
    }
  }
}
