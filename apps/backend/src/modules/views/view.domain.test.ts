import { describe, it, expect } from 'vitest';
import { periodIdOf } from './view.domain.js';

describe('periodIdOf', () => {
  it('returns midnight UTC seconds for any moment within the day', () => {
    const midnight  = new Date('2026-06-22T00:00:00.000Z');
    const midday    = new Date('2026-06-22T12:34:56.789Z');
    const endOfDay  = new Date('2026-06-22T23:59:59.999Z');
    const expected  = Math.floor(Date.UTC(2026, 5, 22) / 1000);
    expect(periodIdOf(midnight)).toBe(expected);
    expect(periodIdOf(midday)).toBe(expected);
    expect(periodIdOf(endOfDay)).toBe(expected);
  });

  it('produces different periodIds for different UTC days', () => {
    const dayA = periodIdOf(new Date('2026-06-22T23:59:59Z'));
    const dayB = periodIdOf(new Date('2026-06-23T00:00:00Z'));
    expect(dayB - dayA).toBe(86_400);
  });

  it('ignores local-timezone interpretation: same UTC moment → same periodId', () => {
    const utc       = new Date('2026-06-22T05:00:00Z');
    const sameMoment = new Date(utc.getTime());
    expect(periodIdOf(utc)).toBe(periodIdOf(sameMoment));
  });
});
