import type { FieldCheck } from '../lib/verifier.js';
import { VerdictBadge } from './VerdictBadge.js';

export function CompareTable({ checks }: { checks: FieldCheck[] }) {
  return (
    <table className="compare">
      <thead>
        <tr>
          <th>Campo</th>
          <th>Valore API</th>
          <th>Valore on-chain</th>
          <th>Esito</th>
        </tr>
      </thead>
      <tbody>
        {checks.map((c) => (
          <tr key={c.label}>
            <td>{c.label}</td>
            <td className="mono">{c.apiValue}</td>
            <td className="mono">{c.chainValue ?? '—'}</td>
            <td>
              <VerdictBadge verdict={c.verdict} />
              {c.note && <div className="note">{c.note}</div>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
