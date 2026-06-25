/**
 * Test-support: helper per integration test che richiedono un PostgreSQL reale.
 *
 * Avvia un container Postgres effimero via testcontainers, applica le migrazioni
 * Drizzle, e restituisce una `DatabaseConnection` configurata. Cleanup ordinato:
 * chiusura pool → stop container.
 *
 * Per ridurre il tempo dei test, il container può essere riusato fra molte suite
 * dello stesso process (tipico per vitest che condivide i worker). La pulizia
 * inter-test è demandata a `truncateAll()`.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { container, type DependencyContainer } from 'tsyringe';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { DatabaseConnection } from '#infrastructure/database/database.connection.js';
import { appConfig, type AppConfig } from '#infrastructure/config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = resolve(__dirname, '../../db/migrations');

export interface TestDb {
  /** Connessione Drizzle istanziata sul container. */
  connection: DatabaseConnection;
  /** Cancella tutte le righe da tutte le tabelle (resta lo schema). */
  truncateAll(): Promise<void>;
  /** Tear-down completo: chiude il pool e ferma il container. */
  stop(): Promise<void>;
}

const TABLES = ['views', 'batches', 'assets', 'contracts'];

export async function startTestDb(): Promise<TestDb> {
  const pgContainer: StartedPostgreSqlContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withUsername('test')
    .withPassword('test')
    .withDatabase('cardiofy_test')
    .start();

  const url = pgContainer.getConnectionUri();
  // Applica le migrazioni con una connessione dedicata (max 1) — chiusa subito dopo.
  const migrator = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(migrator), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await migrator.end();
  }

  // La DatabaseConnection di produzione legge da AppConfig: configuriamo una variante
  // su misura per il test (URL del container, niente verbose).
  const testConfig: AppConfig = {
    ...appConfig,
    env: {
      ...appConfig.env,
      DATABASE: {
        DATABASE_URL: url,
        DATABASE_MAX_CONN: 5,
      },
    },
  };
  const childContainer = container.createChildContainer();
  childContainer.registerInstance<AppConfig>(DI_TOKENS.AppConfig, testConfig);
  childContainer.registerSingleton(DatabaseConnection);
  const connection = childContainer.resolve(DatabaseConnection);
  await connection.testConnection();

  const truncateAll = async (): Promise<void> => {
    const sql = postgres(url, { max: 1, onnotice: () => {} });
    try {
      // RESTART IDENTITY per resettare le sequenze (no impatto qui, ma futuro-proof).
      await sql.unsafe(`TRUNCATE TABLE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`);
    } finally {
      await sql.end();
    }
  };

  const stop = async (): Promise<void> => {
    await connection.close();
    await pgContainer.stop();
  };

  return { connection, truncateAll, stop };
}

/** Crea un child container con la `DatabaseConnection` di test registrata. */
export function makeChildContainerWithDb(db: DatabaseConnection): DependencyContainer {
  const child = container.createChildContainer();
  child.registerInstance(DatabaseConnection, db);
  return child;
}
