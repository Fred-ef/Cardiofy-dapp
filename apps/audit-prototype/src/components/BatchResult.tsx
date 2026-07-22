import { useState } from 'react';
import type { ChainInfoDto } from '@cardiofy/shared';
import type { ApiError } from '../lib/api-client.js';
import { api, type BatchDto } from '../lib/api-client.js';
import { LookupForm } from './LookupForm.js';
import { ErrorPanel } from './ErrorPanel.js';
import { fmtDate, txLink } from '../lib/format.js';

/**
 * A differenza di asset/contratti, il Notary NON espone un mapping di lettura per i
 * batch (solo l'evento `BatchPublished`): niente confronto API↔on-chain automatico.
 * Il revisore verifica manualmente aprendo la tx sull'explorer.
 */
export function BatchResult({ chainInfo }: { chainInfo: ChainInfoDto }) {
  const [loading, setLoading] = useState(false);
  const [batch, setBatch] = useState<BatchDto | null>(null);
  const [error, setError] = useState<Error | ApiError | null>(null);

  async function onVerify(id: string, token: string | undefined) {
    const periodId = Number(id);
    if (!Number.isInteger(periodId) || periodId <= 0) {
      setError(new Error('Il periodId deve essere un intero positivo (es. 20260701).'));
      return;
    }
    setLoading(true);
    setError(null);
    setBatch(null);
    try {
      setBatch(await api.batch(periodId, token));
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }

  const anchorTxLink = batch ? txLink(chainInfo, batch.txHash) : null;

  return (
    <section className="result-panel">
      <LookupForm idLabel="Period ID" idPlaceholder="es. 20260701" onSubmit={onVerify} loading={loading} />
      {error && <ErrorPanel error={error} />}
      {batch && (
        <div className="result">
          <h3>
            Batch periodo <span className="mono">{batch.periodId}</span>{' '}
            <span className="badge badge--neutral">⛓️ verifica manuale via explorer</span>
          </h3>
          <div className="anchoring">
            <p>Status: {batch.status}</p>
            <p>Asset coinvolti: {batch.assetCount}</p>
            <p>Views totali nel periodo: {batch.viewsTotal}</p>
            <p>Creato il: {fmtDate(batch.createdAt)}</p>
            <p>Confermato il: {fmtDate(batch.confirmedAt)}</p>
            <p>Block: {batch.anchoring.blockNumber ?? '—'}</p>
            <p>
              Tx:{' '}
              {anchorTxLink ? (
                <a href={anchorTxLink} target="_blank" rel="noreferrer" className="mono">
                  {batch.txHash}
                </a>
              ) : (
                '—'
              )}
            </p>
          </div>
          <table className="compare">
            <thead>
              <tr>
                <th>Asset ID</th>
                <th>Views nel periodo</th>
              </tr>
            </thead>
            <tbody>
              {batch.payload.map((u) => (
                <tr key={u.assetId}>
                  <td className="mono">{u.assetId}</td>
                  <td>{u.viewsInPeriod}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
