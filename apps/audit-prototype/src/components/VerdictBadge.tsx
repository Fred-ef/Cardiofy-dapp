import type { Verdict } from '../lib/verifier.js';

const VERDICT_MAP: Record<Verdict, { label: string; className: string }> = {
  MATCH: { label: '✅ Coerente API ↔ on-chain', className: 'badge badge--ok' },
  WARN: { label: '⚠️ Divergenza transiente', className: 'badge badge--warn' },
  MISMATCH: { label: '❌ Mismatch', className: 'badge badge--err' },
  NOT_ON_CHAIN: { label: '⛓️ Non presente on-chain', className: 'badge badge--neutral' },
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = VERDICT_MAP[verdict];
  return <span className={v.className}>{v.label}</span>;
}
