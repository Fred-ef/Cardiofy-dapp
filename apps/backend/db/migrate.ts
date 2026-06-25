import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env['DATABASE_URL'];
if (!url) {
  console.error('DATABASE_URL must be defined');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
const db = drizzle(sql);

try {
  await migrate(db, { migrationsFolder: './db/migrations' });
  console.log('Migrations applied');
} finally {
  await sql.end();
}
