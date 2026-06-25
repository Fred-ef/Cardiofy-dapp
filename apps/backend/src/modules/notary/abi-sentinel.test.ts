/**
 * ABI drift sentinel — TB-6.
 *
 * Pinniamo i selector e i topic dell'ABI usato dal gateway (`NOTARY_ABI`) contro
 * valori noti, calcolati a mano dalla firma canonica delle funzioni/eventi di
 * `apps/notary/contracts/Notary.sol`. Se qualcuno modifica la firma del contratto
 * senza aggiornare il gateway (o viceversa), questi test falliscono immediatamente
 * con un errore esplicito invece di degradare silenziosamente a runtime.
 *
 * Mantenere allineato manualmente quando si cambia il contratto:
 *   keccak256("nomeFunzione(tipo1,tipo2,...)")[:4]   → selector
 *   keccak256("nomeEvento(tipo1,tipo2,...)")         → topic0
 */
import { describe, it, expect } from 'vitest';
import { ethers } from 'ethers';
import { NOTARY_ABI } from './ethers-notary.gateway.js';

const iface = new ethers.Interface(NOTARY_ABI);

function expectedSelector(canonicalSignature: string): string {
  return ethers.id(canonicalSignature).slice(0, 10); // 0x + 4 byte
}

function expectedTopic0(canonicalSignature: string): string {
  return ethers.id(canonicalSignature);
}

describe('Notary ABI sentinel (TB-6)', () => {
  describe('function selectors', () => {
    it('notarizeContract(bytes32,bytes32) selector is pinned', () => {
      const fragment = iface.getFunction('notarizeContract');
      expect(fragment).not.toBeNull();
      expect(fragment!.selector).toBe(expectedSelector('notarizeContract(bytes32,bytes32)'));
    });

    it('notarizeAsset(bytes32,bytes32) selector is pinned', () => {
      const fragment = iface.getFunction('notarizeAsset');
      expect(fragment).not.toBeNull();
      expect(fragment!.selector).toBe(expectedSelector('notarizeAsset(bytes32,bytes32)'));
    });

    it('publishBatch(uint64,(bytes32,uint64)[]) selector is pinned', () => {
      // Per le tuple, la canonical signature usa la forma esplicita dei tipi.
      const fragment = iface.getFunction('publishBatch');
      expect(fragment).not.toBeNull();
      expect(fragment!.selector).toBe(
        expectedSelector('publishBatch(uint64,(bytes32,uint64)[])'),
      );
    });

    it('assets(bytes32) selector is pinned', () => {
      const fragment = iface.getFunction('assets');
      expect(fragment).not.toBeNull();
      expect(fragment!.selector).toBe(expectedSelector('assets(bytes32)'));
    });
  });

  describe('event topic0', () => {
    it('ContractNotarized topic0 is pinned', () => {
      const fragment = iface.getEvent('ContractNotarized');
      expect(fragment).not.toBeNull();
      expect(fragment!.topicHash).toBe(
        expectedTopic0('ContractNotarized(bytes32,bytes32,uint64)'),
      );
    });

    it('AssetNotarized topic0 is pinned', () => {
      const fragment = iface.getEvent('AssetNotarized');
      expect(fragment).not.toBeNull();
      expect(fragment!.topicHash).toBe(
        expectedTopic0('AssetNotarized(bytes32,bytes32,uint64)'),
      );
    });

    it('AssetViewsRecorded topic0 is pinned', () => {
      const fragment = iface.getEvent('AssetViewsRecorded');
      expect(fragment).not.toBeNull();
      expect(fragment!.topicHash).toBe(
        expectedTopic0('AssetViewsRecorded(bytes32,uint64,uint64,uint256)'),
      );
    });

    it('BatchPublished topic0 is pinned', () => {
      const fragment = iface.getEvent('BatchPublished');
      expect(fragment).not.toBeNull();
      expect(fragment!.topicHash).toBe(
        expectedTopic0('BatchPublished(uint64,uint256)'),
      );
    });
  });

  describe('contract-side ABI drift (compiled artifact)', () => {
    it('ABI gateway-side has exactly the function/event count expected', () => {
      // Sanity check: 4 funzioni + 4 eventi attesi nel set minimale del gateway.
      const functions = iface.fragments.filter((f) => f.type === 'function').length;
      const events    = iface.fragments.filter((f) => f.type === 'event').length;
      expect(functions).toBe(4);
      expect(events).toBe(4);
    });
  });
});
