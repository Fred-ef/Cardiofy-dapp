/**
 * Verifier CLI — verifica indipendente dei dati Cardiofy on-chain
 *
 * Uso:
 *   npm run verify -w notary -- asset      <BACKEND_API_URL> <assetId>
 *   npm run verify -w notary -- contract   <BACKEND_API_URL> <contractId>
 *   npm run verify -w notary -- info       <BACKEND_API_URL>
 *
 * Il verificatore NON si fida della risposta dell'API: per ogni richiesta:
 *   1. legge dall'API i metadati dichiarati (contentHash, totalViews, txHash);
 *   2. legge gli stessi valori direttamente dalla blockchain (via NOTARY_RPC_URL +
 *      NOTARY_CONTRACT_ADDRESS) usando l'ABI canonico del contratto Notary;
 *   3. confronta — un mismatch è un alert.
 *
 * Variabili d'ambiente richieste:
 *   NOTARY_RPC_URL           — RPC della chain (es. https://rpc.sepolia.org)
 *   NOTARY_CONTRACT_ADDRESS  — address del Notary deployato
 *   CARDIOFY_API_TOKEN       — (opzionale) Bearer token se l'API ha AUTH_ENABLED=true
 */

import { ethers } from 'ethers';

const NOTARY_READ_ABI = [
  'function contracts(bytes32 contractId) view returns (bytes32 contentHash)',
  'function assets(bytes32 assetId) view returns (bytes32 contentHash, uint64 notarizedAt, uint256 totalViews)',
] as const;

const API_TOKEN = process.env['CARDIOFY_API_TOKEN'];

interface AssetApiDto {
  assetId:     string;
  contentHash: string;
  notarizedAt: string;
  confirmedAt: string | null;
  status:      string;
  totalViews:  number;
  anchoring:   { txHash: string | null; blockNumber: number | null; chainId: number };
}

interface ContractApiDto {
  contractId:  string;
  contentHash: string;
  notarizedAt: string;
  confirmedAt: string | null;
  status:      string;
  anchoring:   { txHash: string | null; blockNumber: number | null; chainId: number };
}

interface ChainInfoDto {
  chainId:         number;
  contractAddress: string | null;
  recommendedRPC:  string;
  explorer:        string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (API_TOKEN) headers['authorization'] = `Bearer ${API_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`API ${url} → HTTP ${res.status}: ${await res.text()}`);
  return await res.json() as T;
}

function requireOnChainEnv(): { rpcUrl: string; contractAddress: string } {
  const rpcUrl = process.env['NOTARY_RPC_URL'];
  const contractAddress = process.env['NOTARY_CONTRACT_ADDRESS'];
  if (!rpcUrl || !contractAddress) {
    throw new Error('NOTARY_RPC_URL e NOTARY_CONTRACT_ADDRESS sono richiesti');
  }
  return { rpcUrl, contractAddress };
}

function toBytes32(id: string): string {
  if (/^0x[0-9a-fA-F]{64}$/.test(id)) return id;
  return ethers.id(id);
}

// ─── Comandi ──────────────────────────────────────────────────────────────────

async function verifyAsset(apiUrl: string, assetId: string): Promise<void> {
  console.log(`\n=== Verifica asset ${assetId} ===\n`);
  const { rpcUrl, contractAddress } = requireOnChainEnv();

  const api = await fetchJson<AssetApiDto>(`${apiUrl}/api/v1/assets/${encodeURIComponent(assetId)}`);
  console.log(`Asset ID:       ${api.assetId}`);
  console.log(`Content hash:   ${api.contentHash}     (da API)`);
  console.log(`Total views:    ${api.totalViews}     (da API mirror)`);
  console.log(`Status:         ${api.status}`);
  console.log(`TX hash:        ${api.anchoring.txHash ?? '(non ancora inviata)'}`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, NOTARY_READ_ABI, provider);
  const fn = contract['assets'] as (id: string) => Promise<[string, bigint, bigint]>;
  const [onchainHash, notarizedAt, onchainTotal] = await fn(toBytes32(assetId));

  if (notarizedAt === 0n) {
    console.error('\n❌ FAIL: l\'asset non risulta notarizzato on-chain');
    process.exit(1);
  }

  console.log('');
  console.log(`On-chain hash:  ${onchainHash}`);
  console.log(`On-chain total: ${onchainTotal.toString()}`);

  let ok = true;
  if (onchainHash.toLowerCase() !== api.contentHash.toLowerCase()) {
    console.error('\n❌ MISMATCH: contentHash API ≠ on-chain');
    ok = false;
  }
  if (onchainTotal !== BigInt(api.totalViews)) {
    console.error(`\n⚠️  MISMATCH: totalViews API=${api.totalViews} ≠ on-chain=${onchainTotal}`);
    console.error('   (può essere transiente se il batch del periodo non è ancora confermato)');
    ok = false;
  }
  if (ok) console.log('\n✅ OK: asset coerente fra API e blockchain');
  else process.exit(1);
}

async function verifyContract(apiUrl: string, contractId: string): Promise<void> {
  console.log(`\n=== Verifica contratto ${contractId} ===\n`);
  const { rpcUrl, contractAddress } = requireOnChainEnv();

  const api = await fetchJson<ContractApiDto>(`${apiUrl}/api/v1/contracts/${encodeURIComponent(contractId)}`);
  console.log(`Contract ID:    ${api.contractId}`);
  console.log(`Content hash:   ${api.contentHash}     (da API)`);
  console.log(`Status:         ${api.status}`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(contractAddress, NOTARY_READ_ABI, provider);
  const fn = contract['contracts'] as (id: string) => Promise<string>;
  const onchainHash = await fn(toBytes32(contractId));

  if (onchainHash === ethers.ZeroHash) {
    console.error('\n❌ FAIL: il contratto non risulta notarizzato on-chain');
    process.exit(1);
  }

  console.log(`\nOn-chain hash:  ${onchainHash}`);
  if (onchainHash.toLowerCase() !== api.contentHash.toLowerCase()) {
    console.error('\n❌ MISMATCH: contentHash API ≠ on-chain');
    process.exit(1);
  }
  console.log('\n✅ OK: contratto coerente fra API e blockchain');
}

async function chainInfo(apiUrl: string): Promise<void> {
  const info = await fetchJson<ChainInfoDto>(`${apiUrl}/api/v1/chain/info`);
  console.log('\n=== Chain info (dichiarata dall\'API) ===\n');
  console.log(JSON.stringify(info, null, 2));
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const [, , cmd, apiUrl, ...rest] = process.argv;

if (!cmd || !apiUrl) {
  console.error('Uso: verify.ts <asset|contract|info> <BACKEND_API_URL> [args...]');
  process.exit(1);
}

(async () => {
  try {
    if (cmd === 'asset')        await verifyAsset(apiUrl, requireArg(rest[0], 'assetId'));
    else if (cmd === 'contract')await verifyContract(apiUrl, requireArg(rest[0], 'contractId'));
    else if (cmd === 'info')    await chainInfo(apiUrl);
    else {
      console.error(`Comando sconosciuto: ${cmd}`);
      process.exit(1);
    }
  } catch (err) {
    console.error('Errore:', err instanceof Error ? err.message : err);
    process.exit(1);
  }
})();

function requireArg(value: string | undefined, name: string): string {
  if (!value) {
    console.error(`Argomento mancante: ${name}`);
    process.exit(1);
  }
  return value;
}
