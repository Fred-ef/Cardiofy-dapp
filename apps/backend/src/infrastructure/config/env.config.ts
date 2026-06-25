import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Tratta stringhe vuote come "non valorizzato" per i campi opzionali.
 * Necessario perché un `.env` può legittimamente contenere `FOO=` per indicare
 * "non configurato"; Zod altrimenti rifiuta la stringa vuota su tipi come `z.url()`.
 */
const optionalString = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().optional(),
  );
const optionalUrl = () =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.url().optional(),
  );

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  DATABASE_URL: z.url(),
  DATABASE_MAX_CONN: z.coerce.number().default(10),

  // Notary on-chain — RPC/KEY/CONTRACT opzionali: se assenti il batch job è disabilitato
  // e il gateway è una NoOp (sviluppo locale senza chain).
  NOTARY_RPC_URL: optionalUrl(),
  NOTARY_PRIVATE_KEY: optionalString(),
  NOTARY_CONTRACT_ADDRESS: optionalString(),
  NOTARY_DEPLOY_BLOCK: z.coerce.number().int().nonnegative().optional(),
  NOTARY_CHAIN_ID: z.coerce.number().int().positive().default(11155111),
  NOTARY_CONFIRMATIONS: z.coerce.number().int().positive().default(3),

  // Schedule cron (croner format)
  BATCH_CRON: z.string().default('0 0 * * *'),
  RECONCILE_CRON: z.string().default('*/5 * * * *'),

  // Auth between core and module — token condiviso (Bearer). Opzionale: se assente,
  // l'auth è disabilitata (utile per dev locale). OBBLIGATORIO in production.
  CORE_AUTH_TOKEN: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().min(32).optional(),
  ),
  // NB: `z.coerce.boolean()` produrrebbe `true` per la stringa 'false' (Boolean('false') === true).
  // Confronto esplicito con la rappresentazione lowercase per evitare il bug.
  AUTH_ENABLED: z
    .preprocess(
      (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
      z.enum(['true', 'false']).default('false'),
    )
    .transform((v) => v === 'true'),

  // Esposti via GET /chain/info per audit indipendente
  PUBLIC_RPC_URL: z.url().default('https://rpc.sepolia.org'),
  PUBLIC_EXPLORER_URL: z.url().default('https://sepolia.etherscan.io'),
});

export const createEnvConfig = (rawProcessEnv: unknown) => {
  const parsed = envSchema.safeParse(rawProcessEnv);

  if (!parsed.success) {
    console.error('Invalid environment configuration', parsed.error);
    parsed.error.issues.forEach((issue) => {
      console.error(`   - ${issue.path.join('.')} ${issue.message}`);
    });
    process.exit(1);
  }

  return {
    SERVER: {
      PORT: parsed.data.PORT,
      NODE_ENV: parsed.data.NODE_ENV,
      SHUTDOWN_TIMEOUT_MS: parsed.data.SHUTDOWN_TIMEOUT_MS,
    },
    DATABASE: {
      DATABASE_URL: parsed.data.DATABASE_URL,
      DATABASE_MAX_CONN: parsed.data.DATABASE_MAX_CONN,
    },
    NOTARY: {
      RPC_URL: parsed.data.NOTARY_RPC_URL,
      PRIVATE_KEY: parsed.data.NOTARY_PRIVATE_KEY,
      CONTRACT_ADDRESS: parsed.data.NOTARY_CONTRACT_ADDRESS,
      DEPLOY_BLOCK: parsed.data.NOTARY_DEPLOY_BLOCK,
      CHAIN_ID: parsed.data.NOTARY_CHAIN_ID,
      CONFIRMATIONS: parsed.data.NOTARY_CONFIRMATIONS,
    },
    SCHEDULE: {
      BATCH_CRON: parsed.data.BATCH_CRON,
      RECONCILE_CRON: parsed.data.RECONCILE_CRON,
    },
    AUTH: {
      ENABLED: parsed.data.AUTH_ENABLED,
      TOKEN: parsed.data.CORE_AUTH_TOKEN,
    },
    PUBLIC_AUDIT: {
      RPC_URL: parsed.data.PUBLIC_RPC_URL,
      EXPLORER_URL: parsed.data.PUBLIC_EXPLORER_URL,
    },
  };
};

export type EnvConfig = ReturnType<typeof createEnvConfig>;
