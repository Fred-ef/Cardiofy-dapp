import { useEffect, useState } from 'react';
import { api } from '../lib/api-client.js';

type Status = 'checking' | 'up' | 'down';

export function HealthPill() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    let cancelled = false;
    api.healthLive().then((ok) => {
      if (!cancelled) setStatus(ok ? 'up' : 'down');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const label = status === 'checking' ? '⏳ verifica backend…' : status === 'up' ? '🟢 backend up' : '🔴 backend down';
  const className = status === 'up' ? 'pill pill--ok' : status === 'down' ? 'pill pill--err' : 'pill';

  return <span className={className}>{label}</span>;
}
