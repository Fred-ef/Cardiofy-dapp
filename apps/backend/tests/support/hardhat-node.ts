/**
 * Test-support: avvia/ferma un nodo Hardhat in-process come subprocess.
 *
 * Pattern: lanciamo `npm run node -w notary` dal workspace, attendiamo che l'RPC
 * risponda, poi restituiamo l'URL. Cleanup ordinato del processo + degli account
 * Hardhat noti.
 *
 * NB: il primo account Hardhat è deterministico (mnemonic standard "test test ...
 * junk"). Lo usiamo come `attester` per i test: la sua chiave privata è pubblicamente
 * nota — VA USATA SOLO SU NODI LOCALI EFFIMERI.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers } from 'ethers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');

/** Account 0 noto di Hardhat — solo per nodi locali effimeri. */
export const HARDHAT_ACCOUNT_0 = {
  address:    '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
};

export interface HardhatNode {
  url: string;
  chainId: number;
  /** Termina il subprocess; idempotente. */
  stop(): Promise<void>;
}

interface StartOptions {
  port?: number;
  readinessTimeoutMs?: number;
}

export async function startHardhatNode(options: StartOptions = {}): Promise<HardhatNode> {
  const port = options.port ?? pickPort();
  const readinessTimeoutMs = options.readinessTimeoutMs ?? 30_000;
  const url = `http://127.0.0.1:${port}`;

  // `hardhat node` viene lanciato dal workspace notary perché lì vive `hardhat.config.ts`.
  const child: ChildProcess = spawn(
    'npx',
    ['hardhat', 'node', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      cwd: resolve(REPO_ROOT, 'apps/notary'),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test' },
    },
  );

  child.stderr?.on('data', (chunk: Buffer) => {
    // utile in CI per diagnosi rapida; gli unit test silenziano comunque l'output
    process.stderr.write(`[hardhat node] ${chunk.toString()}`);
  });

  let stopped = false;
  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    if (child.exitCode !== null) return;
    child.kill('SIGTERM');
    await new Promise<void>((resolveExit) => {
      const force = setTimeout(() => {
        child.kill('SIGKILL');
        resolveExit();
      }, 5_000);
      child.once('exit', () => { clearTimeout(force); resolveExit(); });
    });
  };

  try {
    const chainId = await waitForReadiness(url, readinessTimeoutMs);
    return { url, chainId, stop };
  } catch (err) {
    await stop();
    throw err;
  }
}

function pickPort(): number {
  return 18545 + Math.floor(Math.random() * 1000);
}

async function waitForReadiness(url: string, timeoutMs: number): Promise<number> {
  const provider = new ethers.JsonRpcProvider(url);
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      const network = await provider.getNetwork();
      return Number(network.chainId);
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(
    `Hardhat node non pronto su ${url} entro ${timeoutMs}ms: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}
