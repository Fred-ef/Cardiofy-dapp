import { ApiError } from '../lib/api-client.js';

export function ErrorPanel({ error }: { error: Error | ApiError }) {
  const isApiError = error instanceof ApiError;
  return (
    <div className="error-panel">
      <p>
        <strong>Errore:</strong> {error.message}
      </p>
      {isApiError && error.statusCode === 401 && (
        <p className="hint">
          Il backend richiede un token: incollalo nel campo "Bearer token" qui sopra, oppure avvia il backend con
          <code> AUTH_ENABLED=false</code> per la demo.
        </p>
      )}
      {isApiError && error.statusCode === 404 && (
        <p className="hint">Nessuna entità trovata con questo id sul backend (non ancora notarizzata, o id errato).</p>
      )}
      {isApiError && error.statusCode === 0 && (
        <p className="hint">
          Verifica che il backend sia avviato (<code>npm run dev -w backend</code>) e raggiungibile all'URL configurato.
        </p>
      )}
      {isApiError && error.traceId && <p className="trace">traceId: {error.traceId}</p>}
    </div>
  );
}
