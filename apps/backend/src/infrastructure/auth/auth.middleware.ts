import { inject, injectable } from 'tsyringe';
import { Middleware, type ExpressMiddlewareInterface } from 'routing-controllers';
import type { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import type { AppConfig } from '#infrastructure/config/index.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';

/**
 * Middleware di **autenticazione** fra core Cardiofy e modulo blockchain.
 *
 * Responsabilità unica: verificare il bearer token condiviso (CORE_AUTH_TOKEN, confronto
 * in tempo costante) e, se valido, marcare la richiesta con `req.principal`. **Non decide
 * la policy di accesso e non conosce le route**: l'enforcement (quali route richiedono
 * autenticazione) avviene a valle nell'`authorizationChecker` di routing-controllers
 * combinato con `@Authorized()` sui controller protetti.
 *
 * Se AUTH_ENABLED=false il principal è sempre presente (dev/test trusted).
 * Pattern compatibile con eventuale upgrade a mTLS o JWT firmato dal core
 * (sostituibile cambiando solo questa classe + l'authorizationChecker).
 */
@injectable()
@Middleware({ type: 'before' })
export class AuthMiddleware implements ExpressMiddlewareInterface {
  constructor(
    @inject(DI_TOKENS.AppConfig)      private readonly config: AppConfig,
    @inject(DI_TOKENS.ILoggerService) private readonly logger: ILoggerService,
  ) {
    if (this.config.env.AUTH.ENABLED && !this.config.env.AUTH.TOKEN) {
      throw new Error(
        '[AuthMiddleware] AUTH_ENABLED=true ma CORE_AUTH_TOKEN non è configurato'
      );
    }
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    if (!this.config.env.AUTH.ENABLED) {
      req.principal = { kind: 'core-service' };
      return next();
    }

    const expected = this.config.env.AUTH.TOKEN;
    const presented = this.extractBearer(req);
    if (expected && presented && this.constantTimeEqual(presented, expected)) {
      req.principal = { kind: 'core-service' };
    } else if (presented) {
      // Token presentato ma non valido: utile loggarlo. L'assenza di principal verrà
      // poi rifiutata (401) dall'authorizationChecker sulle route protette.
      this.logger.warn('[AuthMiddleware] invalid bearer token', { path: req.path });
    }
    return next();
  }

  private extractBearer(req: Request): string | null {
    const header = req.headers.authorization;
    if (typeof header !== 'string') return null;
    const [scheme, value] = header.split(' ', 2);
    if (scheme !== 'Bearer' || !value) return null;
    return value;
  }

  /** Confronto in tempo costante per evitare timing attack sul token. */
  private constantTimeEqual(a: string, b: string): boolean {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  }
}
