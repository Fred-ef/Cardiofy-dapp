import { describe, it, expect, vi } from 'vitest';
import { JsonRpcProvider, NonceManager } from 'ethers';
import type { Signer, TransactionRequest, TransactionResponse } from 'ethers';
import { LocalSignerProvider, SequentialNonceManager } from './local-signer.provider.js';
import { makeAppConfigMock } from '#tests/support/mocks.js';

describe('LocalSignerProvider', () => {
  const dummyProvider = new JsonRpcProvider('http://127.0.0.1:9999');

  it('returns a NonceManager-wrapped Wallet built from NOTARY_PRIVATE_KEY', () => {
    const cfg = makeAppConfigMock();
    const provider = new LocalSignerProvider(cfg);
    const signer = provider.getSigner(dummyProvider);
    expect(signer).toBeInstanceOf(NonceManager);
  });

  it('returns the same instance on subsequent calls (idempotent)', () => {
    const cfg = makeAppConfigMock();
    const provider = new LocalSignerProvider(cfg);
    const a = provider.getSigner(dummyProvider);
    const b = provider.getSigner(dummyProvider);
    expect(a).toBe(b);
  });

  it('throws when NOTARY_PRIVATE_KEY is not configured', () => {
    const cfg = makeAppConfigMock();
    cfg.env.NOTARY = { ...cfg.env.NOTARY, PRIVATE_KEY: undefined };
    const provider = new LocalSignerProvider(cfg);
    expect(() => provider.getSigner(dummyProvider)).toThrowError(/NOTARY_PRIVATE_KEY/);
  });

  it('describe() returns a stable identifier', () => {
    expect(new LocalSignerProvider(makeAppConfigMock()).describe()).toBe('local:env');
  });
});

/**
 * Copre i due limiti di `ethers.NonceManager.sendTransaction` corretti da
 * `SequentialNonceManager` (vedi commento sulla classe per il dettaglio):
 *
 * 1. Il nonce va atteso per intero PRIMA di avviare `populateTransaction` — altrimenti,
 *    se quest'ultima fallisce per prima, la nonce promise resta orfana e, se fallisce
 *    anch'essa, produce un unhandled rejection (osservato live contro Sepolia: un timeout
 *    RPC transitorio ha fatto abbattere l'intero processo).
 * 2. Se la transazione non raggiunge mai la mempool (populate/send falliscono prima del
 *    broadcast), il contatore locale del nonce va resettato — altrimenti resta avanzato
 *    rispetto al nonce reale on-chain e il PROSSIMO invio fallisce con "nonce too high"
 *    (riprodotto contro un nodo Hardhat reale: un tentativo di duplicare una notarizzazione
 *    già esistente, seguito da un invio genuino, che infatti falliva prima di questo fix).
 */
describe('SequentialNonceManager', () => {
  interface FakeInnerSigner {
    provider: { getTransactionCount: ReturnType<typeof vi.fn> };
    populateTransaction: ReturnType<typeof vi.fn>;
    sendTransaction: ReturnType<typeof vi.fn>;
  }

  function makeFakeInnerSigner(overrides?: {
    getTransactionCount?: ReturnType<typeof vi.fn>;
    populateTransaction?: ReturnType<typeof vi.fn>;
    sendTransaction?: ReturnType<typeof vi.fn>;
  }): FakeInnerSigner {
    return {
      provider: { getTransactionCount: overrides?.getTransactionCount ?? vi.fn().mockResolvedValue(7) },
      getAddress: vi.fn().mockResolvedValue('0x' + '1'.repeat(40)),
      populateTransaction: overrides?.populateTransaction ?? vi.fn().mockImplementation(async (tx: TransactionRequest) => tx),
      sendTransaction: overrides?.sendTransaction ?? vi.fn().mockResolvedValue({ hash: '0x' + '9'.repeat(64) } as TransactionResponse),
      connect: vi.fn(),
      signTransaction: vi.fn(),
      signMessage: vi.fn(),
      signTypedData: vi.fn(),
    } as unknown as FakeInnerSigner;
  }

  it('awaits the nonce fully before calling populateTransaction (no parallel dispatch)', async () => {
    const order: string[] = [];
    const inner = makeFakeInnerSigner({
      getTransactionCount: vi.fn().mockImplementation(async () => {
        order.push('nonce');
        return 7;
      }),
      populateTransaction: vi.fn().mockImplementation(async (tx: TransactionRequest) => {
        order.push('populate');
        return tx;
      }),
    });
    const manager = new SequentialNonceManager(inner as unknown as Signer);

    await manager.sendTransaction({});

    expect(order).toEqual(['nonce', 'populate']);
  });

  it('passes the already-resolved nonce into populateTransaction (no redundant internal fetch)', async () => {
    const inner = makeFakeInnerSigner();
    const manager = new SequentialNonceManager(inner as unknown as Signer);

    await manager.sendTransaction({ to: '0xdead' });

    expect(inner.populateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ to: '0xdead', nonce: 7 }),
    );
  });

  it('if populateTransaction fails, the nonce fetch has already settled — nothing left dangling', async () => {
    const inner = makeFakeInnerSigner({
      populateTransaction: vi.fn().mockRejectedValue(new Error('RPC timeout on populate')),
    });
    const manager = new SequentialNonceManager(inner as unknown as Signer);

    await expect(manager.sendTransaction({})).rejects.toThrow('RPC timeout on populate');
    // Se il nonce non fosse già stato atteso per intero prima di questo punto,
    // la sua promise sarebbe ancora "in volo" e orfana dopo il reject qui sopra.
    expect(inner.provider.getTransactionCount).toHaveBeenCalledTimes(1);
  });

  it('if the nonce fetch fails, populateTransaction is never called (fail-fast, no wasted work)', async () => {
    const inner = makeFakeInnerSigner({
      getTransactionCount: vi.fn().mockRejectedValue(new Error('RPC timeout on nonce')),
    });
    const manager = new SequentialNonceManager(inner as unknown as Signer);

    await expect(manager.sendTransaction({})).rejects.toThrow('RPC timeout on nonce');
    expect(inner.populateTransaction).not.toHaveBeenCalled();
  });

  it('resets the local nonce cache when populateTransaction fails (avoids drifting from on-chain nonce)', async () => {
    const getTransactionCount = vi.fn().mockResolvedValueOnce(7).mockResolvedValueOnce(7);
    const populateTransaction = vi.fn()
      .mockRejectedValueOnce(new Error('revert: AlreadyExists'))
      .mockImplementationOnce(async (tx: TransactionRequest) => tx);
    const inner = makeFakeInnerSigner({ getTransactionCount, populateTransaction });
    const manager = new SequentialNonceManager(inner as unknown as Signer);

    await expect(manager.sendTransaction({})).rejects.toThrow('AlreadyExists');
    await manager.sendTransaction({});

    // Senza reset(), la seconda chiamata userebbe il nonce cache (7 + delta locale, ormai
    // disallineato dal reale nonce on-chain, che non è mai avanzato). Con reset(), rilegge
    // dalla chain una seconda volta: ecco perché getTransactionCount è invocato 2 volte.
    expect(getTransactionCount).toHaveBeenCalledTimes(2);
  });

  it('resets the local nonce cache when the broadcast itself fails (e.g. rejected before mempool)', async () => {
    const getTransactionCount = vi.fn().mockResolvedValueOnce(7).mockResolvedValueOnce(7);
    const sendTransaction = vi.fn()
      .mockRejectedValueOnce(new Error('nonce too low'))
      .mockResolvedValueOnce({ hash: '0x' + '9'.repeat(64) } as TransactionResponse);
    const inner = makeFakeInnerSigner({ getTransactionCount, sendTransaction });
    const manager = new SequentialNonceManager(inner as unknown as Signer);

    await expect(manager.sendTransaction({})).rejects.toThrow('nonce too low');
    await manager.sendTransaction({});

    expect(getTransactionCount).toHaveBeenCalledTimes(2);
  });

  it('does NOT reset the nonce cache when sendTransaction succeeds (stays in sync, no wasted re-fetch)', async () => {
    const getTransactionCount = vi.fn().mockResolvedValue(7);
    const inner = makeFakeInnerSigner({ getTransactionCount });
    const manager = new SequentialNonceManager(inner as unknown as Signer);

    await manager.sendTransaction({});
    await manager.sendTransaction({});

    // Nessun fallimento, nessun reset: il nonce "pending" viene fetchato dalla chain una
    // sola volta; il delta locale (via increment()) lo tiene aggiornato da lì in poi —
    // comportamento standard di NonceManager, preservato quando non c'è nulla da correggere.
    expect(getTransactionCount).toHaveBeenCalledTimes(1);
  });
});
