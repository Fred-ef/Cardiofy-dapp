import { useState } from 'react';

export interface LookupFormProps {
  idLabel: string;
  idPlaceholder: string;
  onSubmit: (id: string, token: string | undefined) => void;
  loading: boolean;
}

/**
 * Form generico riusato da Asset/Contract/Batch: id da cercare + token bearer opzionale
 * (serve solo se il backend ha AUTH_ENABLED=true). Il token resta in memoria (state),
 * mai in localStorage: non è un segreto da persistere in un prototipo.
 */
export function LookupForm({ idLabel, idPlaceholder, onSubmit, loading }: LookupFormProps) {
  const [id, setId] = useState('');
  const [token, setToken] = useState('');

  return (
    <form
      className="lookup-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (id.trim()) onSubmit(id.trim(), token.trim() || undefined);
      }}
    >
      <label>
        {idLabel}
        <input
          type="text"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder={idPlaceholder}
          required
        />
      </label>
      <label className="optional">
        Bearer token (opzionale — solo se AUTH_ENABLED=true)
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="lascia vuoto se il backend non richiede auth"
        />
      </label>
      <button type="submit" disabled={loading}>
        {loading ? 'Verifica in corso…' : 'Verifica'}
      </button>
    </form>
  );
}
