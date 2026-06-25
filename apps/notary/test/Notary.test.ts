import { expect } from 'chai';
import { ethers } from 'hardhat';
import { keccak256, toUtf8Bytes } from 'ethers';

const id = (s: string) => keccak256(toUtf8Bytes(s));

describe('Notary', () => {
  async function deploy() {
    const [attester, owner, stranger, newOwner] = await ethers.getSigners();
    const Notary = await ethers.getContractFactory('Notary');
    const notary = await Notary.deploy(attester!.address, owner!.address);
    await notary.waitForDeployment();
    return { notary, attester, owner, stranger, newOwner };
  }

  describe('constructor', () => {
    it('reverts when deployed with a zero-address attester', async () => {
      const [, owner] = await ethers.getSigners();
      const Notary = await ethers.getContractFactory('Notary');
      await expect(Notary.deploy(ethers.ZeroAddress, owner!.address))
        .to.be.revertedWithCustomError(Notary, 'ZeroAddress');
    });

    it('sets attester and owner on successful deploy', async () => {
      const { notary, attester, owner } = await deploy();
      expect(await notary.attester()).to.equal(attester!.address);
      expect(await notary.owner()).to.equal(owner!.address);
    });
  });

  describe('notarizeContract', () => {
    it('registers a new contract and rejects duplicates', async () => {
      const { notary } = await deploy();
      const cid = id('contract-1');
      const h   = id('hash-1');
      await expect(notary.notarizeContract(cid, h))
        .to.emit(notary, 'ContractNotarized');
      expect(await notary.contracts(cid)).to.equal(h);
      await expect(notary.notarizeContract(cid, h))
        .to.be.revertedWithCustomError(notary, 'AlreadyExists');
    });

    it('rejects empty hash and non-attester callers', async () => {
      const { notary, stranger } = await deploy();
      await expect(notary.notarizeContract(id('c'), ethers.ZeroHash))
        .to.be.revertedWithCustomError(notary, 'EmptyHash');
      await expect(notary.connect(stranger!).notarizeContract(id('c'), id('h')))
        .to.be.revertedWithCustomError(notary, 'NotAttester');
    });
  });

  describe('notarizeAsset', () => {
    it('initializes totalViews to zero and emits AssetNotarized', async () => {
      const { notary } = await deploy();
      const aid = id('asset-1');
      await expect(notary.notarizeAsset(aid, id('content-1')))
        .to.emit(notary, 'AssetNotarized');
      const a = await notary.assets(aid);
      expect(a.totalViews).to.equal(0n);
      expect(a.notarizedAt).to.be.greaterThan(0n);
    });

    it('rejects empty hash, duplicates and non-attester callers', async () => {
      const { notary, stranger } = await deploy();
      const aid = id('asset-dup');
      await expect(notary.notarizeAsset(aid, ethers.ZeroHash))
        .to.be.revertedWithCustomError(notary, 'EmptyHash');
      await notary.notarizeAsset(aid, id('content'));
      await expect(notary.notarizeAsset(aid, id('content-2')))
        .to.be.revertedWithCustomError(notary, 'AlreadyExists');
      await expect(notary.connect(stranger!).notarizeAsset(id('asset-2'), id('content')))
        .to.be.revertedWithCustomError(notary, 'NotAttester');
    });
  });

  describe('publishBatch', () => {
    it('increments cumulative views and emits events', async () => {
      const { notary } = await deploy();
      const a1 = id('asset-A');
      const a2 = id('asset-B');
      await notary.notarizeAsset(a1, id('hA'));
      await notary.notarizeAsset(a2, id('hB'));

      const periodId = 1_700_000_000n;
      await expect(notary.publishBatch(periodId, [
        { assetId: a1, viewsInPeriod: 12n },
        { assetId: a2, viewsInPeriod: 5n  },
      ]))
        .to.emit(notary, 'AssetViewsRecorded')
        .and.to.emit(notary, 'BatchPublished').withArgs(periodId, 2n);

      expect((await notary.assets(a1)).totalViews).to.equal(12n);
      expect((await notary.assets(a2)).totalViews).to.equal(5n);

      // Secondo batch: accumulo additivo.
      await notary.publishBatch(periodId + 86_400n, [
        { assetId: a1, viewsInPeriod: 8n },
      ]);
      expect((await notary.assets(a1)).totalViews).to.equal(20n);
    });

    it('rejects empty batch, unknown asset and non-attester callers', async () => {
      const { notary, stranger } = await deploy();
      await expect(notary.publishBatch(1n, []))
        .to.be.revertedWithCustomError(notary, 'EmptyBatch');
      await expect(notary.publishBatch(1n, [{ assetId: id('ghost'), viewsInPeriod: 1n }]))
        .to.be.revertedWithCustomError(notary, 'UnknownAsset')
        .withArgs(id('ghost'));
      await expect(notary.connect(stranger!).publishBatch(1n, [{ assetId: id('ghost'), viewsInPeriod: 1n }]))
        .to.be.revertedWithCustomError(notary, 'NotAttester');
    });

    it('accumulates additively when the same periodId is published more than once', async () => {
      const { notary } = await deploy();
      const a1 = id('asset-same-period');
      await notary.notarizeAsset(a1, id('h'));
      const periodId = 1_700_000_000n;
      await notary.publishBatch(periodId, [{ assetId: a1, viewsInPeriod: 3n }]);
      await expect(notary.publishBatch(periodId, [{ assetId: a1, viewsInPeriod: 4n }]))
        .to.emit(notary, 'AssetViewsRecorded')
        .withArgs(a1, periodId, 4n, 7n);
      expect((await notary.assets(a1)).totalViews).to.equal(7n);
    });
  });

  describe('governance', () => {
    it('rotates attester only when called by owner', async () => {
      const { notary, attester, owner, stranger } = await deploy();
      // OpenZeppelin Ownable: caller non-owner solleva OwnableUnauthorizedAccount(address).
      await expect(notary.connect(stranger!).rotateAttester(stranger!.address))
        .to.be.revertedWithCustomError(notary, 'OwnableUnauthorizedAccount');
      await expect(notary.connect(owner!).rotateAttester(stranger!.address))
        .to.emit(notary, 'AttesterRotated').withArgs(attester!.address, stranger!.address);
      expect(await notary.attester()).to.equal(stranger!.address);
    });

    it('rejects rotating the attester to the zero address', async () => {
      const { notary, owner } = await deploy();
      await expect(notary.connect(owner!).rotateAttester(ethers.ZeroAddress))
        .to.be.revertedWithCustomError(notary, 'ZeroAddress');
    });

    describe('Ownable2Step', () => {
      it('transferOwnership does not finalize until acceptOwnership is called', async () => {
        const { notary, owner, newOwner } = await deploy();

        // 1. transferOwnership setta pendingOwner ma NON cambia owner.
        await expect(notary.connect(owner!).transferOwnership(newOwner!.address))
          .to.emit(notary, 'OwnershipTransferStarted')
          .withArgs(owner!.address, newOwner!.address);

        expect(await notary.owner()).to.equal(owner!.address);
        expect(await notary.pendingOwner()).to.equal(newOwner!.address);

        // 2. acceptOwnership chiamato dal pendingOwner finalizza.
        await expect(notary.connect(newOwner!).acceptOwnership())
          .to.emit(notary, 'OwnershipTransferred')
          .withArgs(owner!.address, newOwner!.address);

        expect(await notary.owner()).to.equal(newOwner!.address);
        expect(await notary.pendingOwner()).to.equal(ethers.ZeroAddress);
      });

      it('acceptOwnership reverts when called by a non-pending account', async () => {
        const { notary, owner, newOwner, stranger } = await deploy();
        await notary.connect(owner!).transferOwnership(newOwner!.address);

        // L'owner attuale non può accettare (non è il pending).
        await expect(notary.connect(owner!).acceptOwnership())
          .to.be.revertedWithCustomError(notary, 'OwnableUnauthorizedAccount');

        // Uno stranger non può accettare.
        await expect(notary.connect(stranger!).acceptOwnership())
          .to.be.revertedWithCustomError(notary, 'OwnableUnauthorizedAccount');

        // L'owner non è cambiato dopo i tentativi falliti.
        expect(await notary.owner()).to.equal(owner!.address);
      });

      it('rotateAttester non viene autorizzato per il pendingOwner finché non accetta', async () => {
        const { notary, owner, newOwner, stranger } = await deploy();
        await notary.connect(owner!).transferOwnership(newOwner!.address);

        // pendingOwner non è ancora owner: non può ruotare l'attester.
        await expect(notary.connect(newOwner!).rotateAttester(stranger!.address))
          .to.be.revertedWithCustomError(notary, 'OwnableUnauthorizedAccount');
      });
    });
  });
});
