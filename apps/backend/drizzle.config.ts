import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL must be defined');
}

export default defineConfig({
  schema: './src/models/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL'],
  },
  verbose: true,
  strict: true,
});
