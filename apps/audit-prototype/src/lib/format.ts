import type { ChainInfoDto } from '@cardiofy/shared';

export const shortHash = (h?: string | null, n = 6): string => {
  if (!h) return '—';
  return h.length <= 2 * n + 2 ? h : `${h.slice(0, n + 2)}…${h.slice(-n)}`;
};

export const txLink = (info: ChainInfoDto, tx?: string | null): string | null =>
  tx ? `${info.explorer}/tx/${tx}` : null;

export const addrLink = (info: ChainInfoDto, address?: string | null): string | null =>
  address ? `${info.explorer}/address/${address}` : null;

export const fmtDate = (iso?: string | null): string => (iso ? new Date(iso).toLocaleString('it-IT') : '—');
