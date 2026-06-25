/**
 * Test-support: deploy del contratto `Notary` su un provider arbitrario.
 *
 * Carica l'artifact compilato (`apps/notary/artifacts/contracts/Notary.sol/Notary.json`)
 * — non eseguiamo `hardhat compile` qui per non rallentare i test: il file deve esistere,
 * altrimenti lo segnaliamo con un'eccezione esplicativa.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ethers, type InterfaceAbi, type Wallet } from 'ethers';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../..');
const ARTIFACT_PATH = resolve(REPO_ROOT, 'apps/notary/artifacts/contracts/Notary.sol/Notary.json');

interface NotaryArtifact {
  abi: InterfaceAbi;
  bytecode: string;
}

let cachedArtifact: NotaryArtifact | null = null;
function loadArtifact(): NotaryArtifact {
  if (cachedArtifact) return cachedArtifact;
  if (!existsSync(ARTIFACT_PATH)) {
    throw new Error(
      `Artifact Notary non trovato: ${ARTIFACT_PATH}\n` +
      `Esegui prima: npm run compile -w notary`,
    );
  }
  cachedArtifact = JSON.parse(readFileSync(ARTIFACT_PATH, 'utf-8')) as NotaryArtifact;
  return cachedArtifact;
}

export interface DeployedNotary {
  address: string;
  signer: Wallet;
}

export async function deployNotary(rpcUrl: string, privateKey: string): Promise<DeployedNotary> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);
  const { abi, bytecode } = loadArtifact();
  const factory = new ethers.ContractFactory(abi, bytecode, signer);
  // attester = owner = signer (V1 single-key)
  const contract = await factory.deploy(signer.address, signer.address);
  await contract.waitForDeployment();
  return { address: await contract.getAddress(), signer };
}
