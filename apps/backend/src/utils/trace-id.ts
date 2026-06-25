import type { Request } from 'express';

/**
 * Restituisce un identificativo di trace stabile per la richiesta.
 * Pino-HTTP imposta `req.id`; fallback all'header `x-request-id` se assente.
 */
export function getTraceId(req: Request): string | undefined {
  const reqId = (req as Request & { id?: string }).id;
  if (typeof reqId === 'string') return reqId;
  const header = req.headers['x-request-id'];
  return typeof header === 'string' ? header : undefined;
}
