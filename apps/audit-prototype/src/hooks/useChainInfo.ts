import { useEffect, useState } from 'react';
import type { ApiError } from '../lib/api-client.js';
import { api, type ChainInfoDto } from '../lib/api-client.js';

export interface UseChainInfoResult {
  chainInfo: ChainInfoDto | null;
  error: ApiError | Error | null;
  loading: boolean;
}

/**
 * Carica /chain/info una sola volta: è il prerequisito di ogni verifica on-chain
 * (fornisce chainId, contractAddress, RPC consigliato, explorer).
 */
export function useChainInfo(): UseChainInfoResult {
  const [chainInfo, setChainInfo] = useState<ChainInfoDto | null>(null);
  const [error, setError] = useState<ApiError | Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .chainInfo()
      .then((data) => {
        if (!cancelled) setChainInfo(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e : new Error(String(e)));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { chainInfo, error, loading: !chainInfo && !error };
}
