import { describe, it, expect } from 'vitest';
import { periodIdOf } from './view.domain.js';

describe('periodIdOf', () => {
  describe('con periodSeconds=86400 (default giornaliero)', () => {
    const DAY = 86_400;

    it('returns midnight UTC seconds for any moment within the day', () => {
      const midnight  = new Date('2026-06-22T00:00:00.000Z');
      const midday    = new Date('2026-06-22T12:34:56.789Z');
      const endOfDay  = new Date('2026-06-22T23:59:59.999Z');
      const expected  = Math.floor(Date.UTC(2026, 5, 22) / 1000);
      expect(periodIdOf(midnight, DAY)).toBe(expected);
      expect(periodIdOf(midday, DAY)).toBe(expected);
      expect(periodIdOf(endOfDay, DAY)).toBe(expected);
    });

    it('produces different periodIds for different UTC days', () => {
      const dayA = periodIdOf(new Date('2026-06-22T23:59:59Z'), DAY);
      const dayB = periodIdOf(new Date('2026-06-23T00:00:00Z'), DAY);
      expect(dayB - dayA).toBe(86_400);
    });

    it('ignores local-timezone interpretation: same UTC moment → same periodId', () => {
      const utc        = new Date('2026-06-22T05:00:00Z');
      const sameMoment = new Date(utc.getTime());
      expect(periodIdOf(utc, DAY)).toBe(periodIdOf(sameMoment, DAY));
    });
  });

  describe('con periodSeconds più fine (es. 300 = 5 minuti)', () => {
    const FIVE_MIN = 300;

    it('bucketizza sul multiplo di periodSeconds più vicino (arrotondato per difetto)', () => {
      // 12:34:56 UTC → il bucket dei 5 minuti inizia alle 12:30:00.
      const at       = new Date('2026-06-22T12:34:56Z');
      const expected = Math.floor(Date.UTC(2026, 5, 22, 12, 30, 0) / 1000);
      expect(periodIdOf(at, FIVE_MIN)).toBe(expected);
    });

    it('produce periodId consecutivi distanti esattamente periodSeconds per bucket adiacenti', () => {
      const bucketA = periodIdOf(new Date('2026-06-22T12:29:59Z'), FIVE_MIN);
      const bucketB = periodIdOf(new Date('2026-06-22T12:30:00Z'), FIVE_MIN);
      expect(bucketB - bucketA).toBe(FIVE_MIN);
    });

    it('è indipendente da periodSeconds=86400: stesso istante, bucket diversi', () => {
      const at = new Date('2026-06-22T12:34:56Z');
      expect(periodIdOf(at, FIVE_MIN)).not.toBe(periodIdOf(at, 86_400));
    });
  });
});
