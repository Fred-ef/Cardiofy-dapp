// Vite espone solo le var con prefisso VITE_ (import.meta.env). Nessun segreto qui:
// il bearer token (se il backend ha AUTH_ENABLED=true) è inserito a runtime
// dall'utente nel form, non buildato nel bundle.

export const API_BASE_URL: string = import.meta.env['VITE_API_BASE_URL'] ?? 'http://localhost:3001';

export const API_PREFIX = '/api/v1';

/** Se valorizzato, sovrascrive il recommendedRPC di /chain/info (utile per CORS). */
export const RPC_URL_OVERRIDE: string | undefined =
  import.meta.env['VITE_RPC_URL_OVERRIDE'] || undefined;

/**
 * ABI di sola lettura del Notary — solo le funzioni `view` che servono per
 * la verifica indipendente (stesso ABI minimale usato da apps/notary/scripts/verify.ts).
 */
export const NOTARY_READ_ABI = [
  'function contracts(bytes32 contractId) view returns (bytes32 contentHash)',
  'function assets(bytes32 assetId) view returns (bytes32 contentHash, uint64 notarizedAt, uint256 totalViews)',
] as const;
