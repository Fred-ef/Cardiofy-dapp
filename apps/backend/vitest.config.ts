import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcAlias = (p: string) => resolve(__dirname, 'src', p);

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts'],
    },
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
