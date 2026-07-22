import { useState } from 'react';
import type { ChainInfoDto } from '@cardiofy/shared';
import { verifyContract, type VerifyResult } from '../lib/verifier.js';
import type { ApiError } from '../lib/api-client.js';
import { type ContractDto } from '../lib/api-client.js';
import { LookupForm } from './LookupForm.js';
import { VerdictBadge } from './VerdictBadge.js';
import { CompareTable } from './CompareTable.js';
import { ErrorPanel } from './ErrorPanel.js';
import { fmtDate, txLink } from '../lib/format.js';

export function ContractResult({ chainInfo }: { chainInfo: ChainInfoDto }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult<ContractDto> | null>(null);
  const [error, setError] = useState<Error | ApiError | null>(null);

  async function onVerify(id: string, token: string | undefined) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await verifyContract(chainInfo, id, token));
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }

  const anchorTxLink = result ? txLink(chainInfo, result.api.anchoring.txHash) : null;

  return (
    <section className="result-panel">
      <LookupForm idLabel="Contract ID" idPlaceholder="es. contract-123" onSubmit={onVerify} loading={loading} />
      {error && <ErrorPanel error={error} />}
      {result && (
        <div className="result">
          <h3>
            Contratto <span className="mono">{result.api.contractId}</span> <VerdictBadge verdict={result.overall} />
          </h3>
          <CompareTable checks={result.checks} />
          <div className="anchoring">
            <h4>Ancoraggio on-chain</h4>
            <p>Status: {result.api.status}</p>
            <p>Notarizzato il: {fmtDate(result.api.notarizedAt)}</p>
            <p>Confermato il: {fmtDate(result.api.confirmedAt)}</p>
            <p>Block: {result.api.anchoring.blockNumber ?? '—'}</p>
            <p>
              Tx:{' '}
              {anchorTxLink ? (
                <a href={anchorTxLink} target="_blank" rel="noreferrer" className="mono">
                  {result.api.anchoring.txHash}
                </a>
              ) : (
                '—'
              )}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
