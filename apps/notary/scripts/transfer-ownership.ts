/**
 * Trasferimento dell'owner del Notary verso una nuova address (TB-12 + D6).
 *
 * Use case di produzione: dopo il deploy, l'owner iniziale è il deployer (uguale
 * all'attester). Per hardening è raccomandato spostare la proprietà su una
 * multi-firma (es. Safe). Il contratto usa `Ownable2Step` di OpenZeppelin →
 * il trasferimento avviene in DUE fasi distinte:
 *
 *   1. `transferOwnership(newOwner)` chiamato dall'owner corrente
 *      → setta `pendingOwner = newOwner`. L'owner effettivo NON cambia ancora.
 *
 *   2. `acceptOwnership()` chiamato dal NUOVO owner
 *      → finalizza il trasferimento.
 *
 * Protegge da typo (un address sbagliato non può accettare) e dà finestra di
 * tempo per accorgersi di un compromise.
 *
 * Uso:
 *   # Step 1 — propose (chiave attualmente owner)
 *   npm run transfer-owner -w notary -- --network=sepolia --new-owner=0x<addr> [--yes]
 *
 *   # Step 2 — accept (chiave del nuovo owner)
 *   npm run transfer-owner -w notary -- --network=sepolia --accept [--yes]
 *
 * Pre-condizioni:
 *   • NOTARY_RPC_URL / NOTARY_PRIVATE_KEY configurati.
 *     - Per `propose`: la chiave dev'essere quella dell'owner CORRENTE.
 *     - Per `--accept`: la chiave dev'essere quella del pendingOwner.
 *   • L'indirizzo del contratto è letto da ignition deployments via scripts/address.ts.
 */
import { ethers } from 'ethers';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import * as dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const NOTARY_OWNER_ABI = [
  'function owner() view returns (address)',
  'function pendingOwner() view returns (address)',
  'function transferOwnership(address newOwner) external',
  'function acceptOwnership() external',
  'event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner)',
  'event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)',
] as const;

interface Args {
  network: string;
  newOwner: string;
  accept: boolean;
  skipConfirm: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const args: Args = { network: 'sepolia', newOwner: '', accept: false, skipConfirm: false };
  for (const a of argv) {
    if (a === '--yes') args.skipConfirm = true;
    else if (a === '--accept') args.accept = true;
    else if (a.startsWith('--network=')) args.network = a.slice('--network='.length);
    else if (a.startsWith('--new-owner=')) args.newOwner = a.slice('--new-owner='.length);
    else if (a === '--help' || a === '-h') {
      printUsage();
      process.exit(0);
    } else {
      console.error(`Argomento sconosciuto: ${a}`);
      printUsage();
      process.exit(1);
    }
  }
  if (!args.accept && !args.newOwner) {
    console.error('Manca --new-owner=0x<address> (per la fase di propose) o --accept (per la fase di finalize).');
    printUsage();
    process.exit(1);
  }
  if (!args.accept && !ethers.isAddress(args.newOwner)) {
    console.error(`--new-owner non è un address valido: ${args.newOwner}`);
    process.exit(1);
  }
  return args;
}

function printUsage(): void {
  console.error(`
Trasferimento ownership Notary — pattern Ownable2Step (2 fasi).

Step 1 — Propose (owner corrente):
  npm run transfer-owner -w notary -- --network=<chain> --new-owner=0x<addr> [--yes]

Step 2 — Accept (nuovo owner, con la sua chiave in NOTARY_PRIVATE_KEY):
  npm run transfer-owner -w notary -- --network=<chain> --accept [--yes]

Variabili d'ambiente richieste:
  NOTARY_RPC_URL       — RPC sulla rete target
  NOTARY_PRIVATE_KEY   — chiave del firmatario (owner corrente / pendingOwner)
`);
}

function readContractAddress(network: string): string {
  // Riutilizza lo script address per leggere da ignition deployments.
  const result = spawnSync('npx', ['tsx', resolve(__dirname, 'address.ts'), `--network=${network}`, '--json'], {
    cwd: resolve(__dirname, '..'),
    encoding: 'utf-8',
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout);
    process.exit(1);
  }
  const parsed = JSON.parse(result.stdout) as { address: string };
  return parsed.address;
}

async function promptConfirm(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolveAnswer) => {
    rl.question(`${message} [y/N] `, (answer) => {
      rl.close();
      resolveAnswer(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function propose(
  contract: ethers.Contract,
  wallet: ethers.Wallet,
  contractAddress: string,
  network: string,
  newOwner: string,
  skipConfirm: boolean,
): Promise<void> {
  const currentOwner   = await (contract['owner']        as () => Promise<string>)();
  const currentPending = await (contract['pendingOwner'] as () => Promise<string>)();
  console.log('\n=== Step 1/2 — Propose ownership transfer ===\n');
  console.log(`Network:        ${network}`);
  console.log(`Contract:       ${contractAddress}`);
  console.log(`Current owner:  ${currentOwner}`);
  console.log(`Current pending:${currentPending === ethers.ZeroAddress ? '(none)' : currentPending}`);
  console.log(`Signer:         ${wallet.address}`);
  console.log(`New owner:      ${newOwner}`);
  console.log('');

  if (currentOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(`❌ Il signer (${wallet.address}) non è l'owner corrente (${currentOwner}). Aborto.`);
    process.exit(1);
  }
  if (currentOwner.toLowerCase() === newOwner.toLowerCase()) {
    console.log('⚠️  newOwner === currentOwner — nulla da fare.');
    process.exit(0);
  }
  if (currentPending.toLowerCase() === newOwner.toLowerCase()) {
    console.log('ℹ️  Il pendingOwner è già impostato a questo address: niente nuova proposta necessaria.');
    console.log(`   Passo 2: chiamare "npm run transfer-owner -- --accept" con la chiave di ${newOwner}.`);
    process.exit(0);
  }

  if (!skipConfirm) {
    const ok = await promptConfirm('Confermi la proposta di transferOwnership?');
    if (!ok) { console.log('Annullato.'); process.exit(0); }
  }

  console.log('\nInvio transazione transferOwnership…');
  const fn = contract['transferOwnership'] as (newOwner: string) => Promise<ethers.TransactionResponse>;
  const tx = await fn(newOwner);
  console.log(`TX hash: ${tx.hash}`);
  console.log('Attendo conferma…');
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    console.error('❌ Transazione fallita.'); process.exit(1);
  }
  console.log(`Confermata nel blocco ${receipt.blockNumber} (gas usato: ${receipt.gasUsed})`);

  const newPending = await (contract['pendingOwner'] as () => Promise<string>)();
  if (newPending.toLowerCase() !== newOwner.toLowerCase()) {
    console.error(`❌ Sanity check fallito: pendingOwner on-chain = ${newPending}, atteso ${newOwner}`);
    process.exit(1);
  }
  console.log(`\n✅ Step 1 completato: pendingOwner = ${newPending}`);
  console.log('');
  console.log(`Prossimo passo (NUOVO owner, con la chiave di ${newOwner}):`);
  console.log(`   npm run transfer-owner -w notary -- --network=${network} --accept`);
}

async function accept(
  contract: ethers.Contract,
  wallet: ethers.Wallet,
  contractAddress: string,
  network: string,
  skipConfirm: boolean,
): Promise<void> {
  const currentOwner   = await (contract['owner']        as () => Promise<string>)();
  const currentPending = await (contract['pendingOwner'] as () => Promise<string>)();
  console.log('\n=== Step 2/2 — Accept ownership ===\n');
  console.log(`Network:        ${network}`);
  console.log(`Contract:       ${contractAddress}`);
  console.log(`Current owner:  ${currentOwner}`);
  console.log(`Pending owner:  ${currentPending === ethers.ZeroAddress ? '(none)' : currentPending}`);
  console.log(`Signer:         ${wallet.address}`);
  console.log('');

  if (currentPending === ethers.ZeroAddress) {
    console.error('❌ Nessun pendingOwner impostato. Lancia prima lo step 1 (propose).');
    process.exit(1);
  }
  if (currentPending.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(`❌ Il signer (${wallet.address}) non è il pendingOwner (${currentPending}).`);
    console.error('   Usa la chiave del pendingOwner per accettare.');
    process.exit(1);
  }

  if (!skipConfirm) {
    const ok = await promptConfirm('Confermi l\'acceptOwnership? Diventerai owner del contratto.');
    if (!ok) { console.log('Annullato.'); process.exit(0); }
  }

  console.log('\nInvio transazione acceptOwnership…');
  const fn = contract['acceptOwnership'] as () => Promise<ethers.TransactionResponse>;
  const tx = await fn();
  console.log(`TX hash: ${tx.hash}`);
  console.log('Attendo conferma…');
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    console.error('❌ Transazione fallita.'); process.exit(1);
  }
  console.log(`Confermata nel blocco ${receipt.blockNumber} (gas usato: ${receipt.gasUsed})`);

  const newOwner   = await (contract['owner']        as () => Promise<string>)();
  const newPending = await (contract['pendingOwner'] as () => Promise<string>)();
  if (newOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(`❌ Sanity check fallito: owner on-chain = ${newOwner}, atteso ${wallet.address}`);
    process.exit(1);
  }
  if (newPending !== ethers.ZeroAddress) {
    console.error(`❌ Sanity check fallito: pendingOwner non azzerato (${newPending})`);
    process.exit(1);
  }
  console.log(`\n✅ Ownership trasferita con successo. Nuovo owner: ${newOwner}`);
}

async function main(): Promise<void> {
  const args   = parseArgs();
  const rpcUrl = process.env['NOTARY_RPC_URL'];
  const pk     = process.env['NOTARY_PRIVATE_KEY'];
  if (!rpcUrl || !pk) {
    console.error('NOTARY_RPC_URL e NOTARY_PRIVATE_KEY sono richiesti');
    process.exit(1);
  }

  const contractAddress = readContractAddress(args.network);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet   = new ethers.Wallet(pk, provider);
  const contract = new ethers.Contract(contractAddress, NOTARY_OWNER_ABI, wallet);

  if (args.accept) {
    await accept(contract, wallet, contractAddress, args.network, args.skipConfirm);
  } else {
    await propose(contract, wallet, contractAddress, args.network, args.newOwner, args.skipConfirm);
  }
}

void main().catch((err: unknown) => {
  console.error('Errore:', err instanceof Error ? err.message : err);
  process.exit(1);
});
