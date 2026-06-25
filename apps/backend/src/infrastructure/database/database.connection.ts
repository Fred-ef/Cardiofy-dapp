import { drizzle } from 'drizzle-orm/postgres-js';
import { inject, injectable } from 'tsyringe';
import postgres from 'postgres';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import type { AppConfig } from '#infrastructure/config/index.js';
import * as schema from '#models/schema.js';

@injectable()
export class DatabaseConnection {
  private readonly connection: ReturnType<typeof postgres>;
  private readonly db: ReturnType<typeof drizzle>;

  constructor(@inject(DI_TOKENS.AppConfig) private readonly appConfig: AppConfig) {
    this.connection = postgres(this.appConfig.env.DATABASE.DATABASE_URL, {
      max: this.appConfig.env.DATABASE.DATABASE_MAX_CONN,
    });
    this.db = drizzle(this.connection, { schema });
  }

  /** Fail-fast connectivity check (chiamato in fase di boot). */
  public async testConnection(): Promise<void> {
    await this.connection`SELECT 1`;
    console.log('Postgres DB connection successfully established.');
  }

  public getDb(): ReturnType<typeof drizzle> {
    return this.db;
  }

  /** Chiude il pool di connessioni (graceful shutdown). `timeout` in secondi. */
  public async close(timeout = 5): Promise<void> {
    await this.connection.end({ timeout });
  }
}
