/**
 * Integration test del gateway on-chain reale (TB-3).
 *
 * Avvia un nodo Hardhat effimero, deploya il contratto `Notary` con l'account 0 noto
 * (che è anche `attester` + `owner`), istanzia `EthersNotaryGateway` puntato a quel
 * nodo e ne esercita i metodi end-to-end. Copre encoding/decoding ABI reale (in
 * particolare la tupla `assets()` e il payload `publishBatch`) che gli unit test
 * non possono coprire.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ethers } from 'ethers';
import { container } from 'tsyringe';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { appConfig, type AppConfig } from '#infrastructure/config/index.js';
import {
  startHardhatNode,
  HARDHAT_ACCOUNT_0,
  type HardhatNode,
} from '#tests/support/hardhat-node.js';
import { deployNotary } from '#tests/support/deploy-notary.js';
import { EthersNotaryGateway } from '#modules/notary/ethers-notary.gateway.js';
import { LocalSignerProvider } from '#modules/notary/local-signer.provider.js';
import type { ISignerProvider } from '#modules/notary/interfaces/i-signer.provider.js';

describe('EthersNotaryGateway (integration, Hardhat node)', () => {
  let node: HardhatNode;
  let gateway: EthersNotaryGateway;
  let contractAddress: string;

  beforeAll(async () => {
    node = await startHardhatNode({ readinessTimeoutMs: 30_000 });
    const deployed = await deployNotary(node.url, HARDHAT_ACCOUNT_0.privateKey);
    contractAddress = deployed.address;

    // Inietta un AppConfig fresco con le credenziali del nodo locale, poi risolve
    // il gateway via DI in modo identico alla produzione.
    const testConfig: AppConfig = {
      ...appConfig,
      env: {
        ...appConfig.env,
        NOTARY: {
          ...appConfig.env.NOTARY,
          RPC_URL:          node.url,
          PRIVATE_KEY:      HARDHAT_ACCOUNT_0.privateKey,
          CONTRACT_ADDRESS: contractAddress,
          CHAIN_ID:         node.chainId,
          CONFIRMATIONS:    1,
        },
      },
    };
    container.clearInstances();
    container.registerInstance<AppConfig>(DI_TOKENS.AppConfig, testConfig);
    container.registerSingleton<ISignerProvider>(DI_TOKENS.ISignerProvider, LocalSignerProvider);
    gateway = container.resolve(EthersNotaryGateway);
  }, 90_000);

  afterAll(async () => {
    await node?.stop();
  });

  describe('notarizeAsset + getAssetTotalViews + publishBatch', () => {
    it('end-to-end: registra asset → publishBatch → totalViews on-chain aggiornato', async () => {
      const assetId      = 'asset-e2e-1';
      const contentHash  = ethers.id('content-of-asset-1');

      // 1. Notarize asset on-chain.
      const notarizeReceipt = await gateway.notarizeAsset(assetId, contentHash);
      expect(notarizeReceipt.txHash).toMatch(/^0x[0-9a-f]{64}$/);

      // 2. Subito dopo deve essere visibile come totalViews = 0.
      const totalAfterNotarize = await gateway.getAssetTotalViews(assetId);
      expect(totalAfterNotarize).toBe(0n);

      // 3. Publish batch con 5 view per quell'asset.
      const periodId = 1_750_636_800;
      const batchReceipt = await gateway.publishBatch(periodId, [
        { assetId, viewsInPeriod: 5 },
      ]);
      expect(batchReceipt.txHash).toMatch(/^0x[0-9a-f]{64}$/);

      // 4. totalViews on-chain = 5 (additivo da 0).
      const totalAfterBatch = await gateway.getAssetTotalViews(assetId);
      expect(totalAfterBatch).toBe(5n);

      // 5. Un secondo batch è additivo: 5 + 7 = 12.
      await gateway.publishBatch(periodId + 86_400, [
        { assetId, viewsInPeriod: 7 },
      ]);
      expect(await gateway.getAssetTotalViews(assetId)).toBe(12n);
    });

    it('getAssetTotalViews ritorna null per un asset non notarizzato', async () => {
      const onchain = await gateway.getAssetTotalViews('ghost-asset');
      expect(onchain).toBeNull();
    });
  });

  describe('notarizeContract', () => {
    it('registra un contratto on-chain e rifiuta i duplicati', async () => {
      const contractId  = 'contract-e2e-1';
      const contentHash = ethers.id('content-of-contract-1');

      const receipt = await gateway.notarizeContract(contractId, contentHash);
      expect(receipt.txHash).toMatch(/^0x[0-9a-f]{64}$/);

      // Secondo notarize sullo stesso contractId deve revertare (AlreadyExists).
      await expect(gateway.notarizeContract(contractId, contentHash)).rejects.toThrow();
    });
  });

  describe('confirmations', () => {
    it('ritorna conferme > 0 dopo che la tx è stata minata', async () => {
      const assetId     = 'asset-conf-1';
      const contentHash = ethers.id('content-of-asset-conf');
      const { txHash }  = await gateway.notarizeAsset(assetId, contentHash);

      // Il gateway è intenzionalmente fire-and-forget: il caller (ReconcileJob)
      // attende il mining via polling. Nel test simuliamo il polling sullo stesso
      // gateway, finché la tx non è confermata.
      let status = await gateway.confirmations(txHash);
      const deadline = Date.now() + 5_000;
      while (status.confirmations < 1 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 100));
        status = await gateway.confirmations(txHash);
      }
      expect(status.confirmations).toBeGreaterThanOrEqual(1);
      expect(status.blockNumber).not.toBeNull();
    });

    it('ritorna {confirmations: 0, blockNumber: null} per un txHash inesistente', async () => {
      const fakeTx = '0x' + 'aa'.repeat(32);
      const status = await gateway.confirmations(fakeTx);
      expect(status.confirmations).toBe(0);
      expect(status.blockNumber).toBeNull();
    });
  });
});
