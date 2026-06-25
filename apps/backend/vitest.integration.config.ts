import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcAlias = (p: string) => resolve(__dirname, 'src', p);

/**
 * Vitest configuration per i test di integrazione (suffisso `.integration.test.ts`).
 * - Avvia container Postgres ephemeral via testcontainers → tempo di setup nell'ordine
 *   di 10-30s per file. Per questo i test sono eseguiti in serie (`fileParallelism: false`)
 *   e con timeout maggiorati.
 * - Niente cache: ogni run è isolato per evitare false positive.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/integration/**/*.integration.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      '#src':            srcAlias(''),
      '#modules':        srcAlias('modules'),
      '#errors':         srcAlias('errors'),
      '#infrastructure': srcAlias('infrastructure'),
      '#models':         srcAlias('models'),
      '#utils':          srcAlias('utils'),
      '#types':          srcAlias('types'),
      '#tests':          resolve(__dirname, 'tests'),
      '#decorators':     srcAlias('infrastructure/http/decorators/index.ts'),
    },
  },
});
