/**
 * Seed script — placeholder operativo.
 *
 * Allo stato attuale (V0), il modulo blockchain non ha dati di seed: tutte le entità
 * (contracts, assets, views, batches) vengono popolate runtime via API o job
 * giornaliero. Lo script esiste per coerenza col workflow `npm run db:seed`
 * tipico dei progetti Drizzle (riprodotto da CMP).
 *
 * Quando emergerà la necessità di seed (es. fixture deterministiche per dev/staging),
 * questo file deve aprire la connessione, inserire le righe e chiudere.
 */
import * as dotenv from 'dotenv';

dotenv.config();

async function main(): Promise<void> {
  console.log('[seed] nessun seed da applicare per il V0 — exit 0');
}

main().catch((err: unknown) => {
  console.error('[seed] errore:', err);
  process.exit(1);
});
