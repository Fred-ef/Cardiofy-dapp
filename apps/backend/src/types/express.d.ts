import type { Principal } from './principal.js';

/**
 * Augmentation di Express: l'AuthMiddleware popola `req.principal` quando la richiesta
 * presenta credenziali valide. L'enforcement (chi può accedere a quale route) avviene
 * a valle nell'`authorizationChecker` di routing-controllers + `@Authorized()`.
 */
declare global {
  namespace Express {
    interface Request {
      principal?: Principal;
    }
  }
}
