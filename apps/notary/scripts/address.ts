/**
 * Recupera l'indirizzo del contratto `Notary` deployato dalla cartella Ignition
 * (`ignition/deployments/chain-<id>/deployed_addresses.json`) e lo stampa.
 *
 * Uso:
 *   npm run address -w notary                       — stampa { network, chainId, address }
 *   npm run address -w notary -- --json             — output JSON pulito (CI friendly)
 *   npm run address -w notary -- --network=sepolia  — forza la rete (default: sepolia)
 *   npm run address -w notary -- --update-backend-env
 *                                                   — scrive `NOTARY_CONTRACT_ADDRESS=...`
 *                                                     in apps/backend/.env (sovrascrive
 *                                                     o aggiunge la riga corrispondente).
 *
 * NB: Ignition organizza i deployment per chainId, non per network name. Usiamo una
 * mappa nota (sepolia=11155111, gnosis=100) per risolvere il nome a chainId.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CHAIN_IDS: Record<string, number> = {
  sepolia: 11155111,
  gnosis:  100,
  chiado:  10200,
  hardhat: 31337,
  localhost: 31337,
};

interface Args {
  network: string;
  json: boolean;
  updateBackendEnv: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { network: 'sepolia', json: false, updateBackendEnv: false };
  for (const a of argv) {
    if (a === '--json') args.json = true;
    else if (a === '--update-backend-env') args.updateBackendEnv = true;
    else if (a.startsWith('--network=')) args.network = a.slice('--network='.length);
    else {
      console.error(`Argomento sconosciuto: ${a}`);
      process.exit(1);
    }
  }
  return args;
}

function readAddress(network: string): { chainId: number; address: string } {
  const chainId = CHAIN_IDS[network];
  if (!chainId) {
    console.error(`Network sconosciuta: '${network}'. Supportate: ${Object.keys(CHAIN_IDS).join(', ')}`);
    process.exit(1);
  }
  const file = resolve(__dirname, '..', 'ignition', 'deployments', `chain-${chainId}`, 'deployed_addresses.json');
  if (!existsSync(file)) {
    console.error(`File Ignition non trovato: ${file}`);
    console.error(`Lancia prima il deploy (es. npm run deploy:${network} -w notary).`);
    process.exit(1);
  }
  const json = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, string>;
  const address = json['NotaryModule#Notary'] ?? Object.values(json)[0];
  if (!address) {
    console.error(`Address non trovato in ${file}`);
    process.exit(1);
  }
  return { chainId, address };
}

function updateBackendEnv(address: string, chainId: number): void {
  const envPath = resolve(__dirname, '..', '..', 'backend', '.env');
  if (!existsSync(envPath)) {
    console.error(`apps/backend/.env non trovato (atteso in ${envPath}).`);
    console.error(`Crealo con \`cp apps/backend/.env.example apps/backend/.env\`.`);
    process.exit(1);
  }
  const original = readFileSync(envPath, 'utf-8');
  const lines = original.split('\n');
  const map: Record<string, string> = {
    NOTARY_CONTRACT_ADDRESS: address,
    NOTARY_CHAIN_ID:         String(chainId),
  };
  const seen = new Set<string>();
  const updated = lines.map((line) => {
    for (const key of Object.keys(map)) {
      if (line.startsWith(`${key}=`)) {
        seen.add(key);
        return `${key}=${map[key]}`;
      }
    }
    return line;
  });
  for (const key of Object.keys(map)) {
    if (!seen.has(key)) updated.push(`${key}=${map[key]}`);
  }
  writeFileSync(envPath, updated.join('\n'));
  console.log(`✅ apps/backend/.env aggiornato:`);
  for (const [k, v] of Object.entries(map)) console.log(`   ${k}=${v}`);
}

function main(): void {
  const args = parseArgs();
  const { chainId, address } = readAddress(args.network);

  if (args.json) {
    process.stdout.write(JSON.stringify({ network: args.network, chainId, address }) + '\n');
  } else {
    console.log(`Network:  ${args.network}`);
    console.log(`Chain ID: ${chainId}`);
    console.log(`Address:  ${address}`);
  }

  if (args.updateBackendEnv) updateBackendEnv(address, chainId);
}

main();
