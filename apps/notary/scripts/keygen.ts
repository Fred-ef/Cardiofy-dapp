/**
 * Keygen CLI — genera una nuova chiave random per il deployer / attester.
 *
 * Pattern (allineato a CMP, ispirato a `cast wallet new`):
 *   • Una sola hot key viene generata e custodita in `NOTARY_PRIVATE_KEY`.
 *   • L'address pubblico (= deployer = anchorer per costruzione, via
 *     `m.getAccount(0)` nel modulo Ignition) viene derivato automaticamente;
 *     non lo configuriamo a parte (eviteremmo un mismatch silenzioso —
 *     stesso anti-pattern che CMP elimina rimuovendo `ANCHOR_WALLET_ADDRESS`).
 *
 * Uso:
 *   npm run keygen -w notary                  — stampa nuova chiave + address (NIENTE scrittura)
 *   npm run keygen -w notary -- --json        — output JSON pulito (CI / wrapping)
 *   npm run keygen -w notary -- --write-env   — scrive in apps/notary/.env
 *                                                (con backup .env.bak se NOTARY_PRIVATE_KEY è
 *                                                già impostata a un valore non-placeholder)
 *
 * Considerazioni di sicurezza:
 *   • La chiave compare in chiaro sullo stdout: NON loggarla, NON copiarla in chat.
 *   • Hot wallet: finanzialo solo con il gas necessario alle operazioni; tienilo
 *     "a basso valore" (pattern CMP: furto = DoS, mai alterazione del passato).
 *   • Per produzione consolidata: post-deploy `transferOwnership` a una Safe
 *     multi-firma (vedi docs/runbooks/deploy-and-go-live.md sez. 7) e, quando
 *     disponibile, migrazione a KMS custom (ISignerProvider è già lo slot pronto).
 */
import { Wallet } from 'ethers';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NOTARY_ENV_PATH = resolve(__dirname, '..', '.env');

const PLACEHOLDER_KEY = `0x${'0'.repeat(64)}`;

interface Args {
  json: boolean;
  writeEnv: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { json: false, writeEnv: false };
  for (const a of argv) {
    if (a === '--json') args.json = true;
    else if (a === '--write-env') args.writeEnv = true;
    else if (a === '--help' || a === '-h') { printUsage(); process.exit(0); }
    else {
      console.error(`Argomento sconosciuto: ${a}`);
      printUsage();
      process.exit(1);
    }
  }
  return args;
}

function printUsage(): void {
  console.error(`
Uso:
  npm run keygen -w notary [-- --json] [-- --write-env]

Genera una nuova hot key per il deployer/attester del Notary.
L'address è derivato dalla chiave; non serve configurarlo separatamente.
`);
}

function writeEnv(privateKey: string): void {
  const exists = existsSync(NOTARY_ENV_PATH);
  if (!exists) {
    const template = [
      '# Generato automaticamente da scripts/keygen.ts',
      `NOTARY_PRIVATE_KEY=${privateKey}`,
      'NOTARY_RPC_URL=https://rpc.sepolia.org',
      'ETHERSCAN_API_KEY=',
      '',
    ].join('\n');
    writeFileSync(NOTARY_ENV_PATH, template);
    console.error(`✅ Scritto nuovo file: ${NOTARY_ENV_PATH}`);
    return;
  }

  const original = readFileSync(NOTARY_ENV_PATH, 'utf-8');
  const lines = original.split('\n');
  const existing = lines.find((l) => l.startsWith('NOTARY_PRIVATE_KEY='));
  const existingValue = existing?.slice('NOTARY_PRIVATE_KEY='.length).trim() ?? '';
  const hasRealKey = existingValue !== '' && existingValue !== PLACEHOLDER_KEY;

  if (hasRealKey) {
    // Backup esplicito prima di sovrascrivere — protezione contro perdita accidentale.
    const backupPath = `${NOTARY_ENV_PATH}.bak`;
    copyFileSync(NOTARY_ENV_PATH, backupPath);
    console.error(`⚠️  NOTARY_PRIVATE_KEY già impostata — backup in ${backupPath}`);
  }

  let replaced = false;
  const updated = lines.map((line) => {
    if (line.startsWith('NOTARY_PRIVATE_KEY=')) {
      replaced = true;
      return `NOTARY_PRIVATE_KEY=${privateKey}`;
    }
    return line;
  });
  if (!replaced) updated.push(`NOTARY_PRIVATE_KEY=${privateKey}`);

  writeFileSync(NOTARY_ENV_PATH, updated.join('\n'));
  console.error(`✅ ${NOTARY_ENV_PATH} aggiornato (NOTARY_PRIVATE_KEY).`);
}

function main(): void {
  const args = parseArgs();
  const wallet = Wallet.createRandom();
  // ethers v6: createRandom() ritorna un HDNodeWallet con privateKey 0x-prefixed.
  const privateKey = wallet.privateKey;
  const address    = wallet.address;

  if (args.writeEnv) {
    writeEnv(privateKey);
  }

  if (args.json) {
    process.stdout.write(JSON.stringify({ address, privateKey }) + '\n');
    return;
  }

  // Output testuale: address su stdout (programmaticamente catturabile), chiave + warning su stderr.
  process.stdout.write(`${address}\n`);
  console.error('');
  console.error('=== Nuova hot key generata ===');
  console.error('');
  console.error(`Address (pubblico — finanziare con gas):`);
  console.error(`  ${address}`);
  console.error('');
  console.error(`Private key (SEGRETA — NON committare, NON loggare):`);
  console.error(`  ${privateKey}`);
  console.error('');
  if (!args.writeEnv) {
    console.error(`Per scriverla in apps/notary/.env: aggiungi --write-env.`);
  }
  console.error('Prossimi passi:');
  console.error('  1. finanziare l\'address sulla chain target (testnet → faucet; mainnet → bonifico interno);');
  console.error('  2. configurare NOTARY_RPC_URL in apps/notary/.env;');
  console.error('  3. npm run deploy:sepolia -w notary (o :gnosis);');
  console.error('  4. npm run notary:address:sync per propagare il contract address al backend.');
}

main();
