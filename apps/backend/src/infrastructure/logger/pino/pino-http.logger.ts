import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { pinoHttp, type HttpLogger } from 'pino-http';
import { PinoProvider } from './pino.factory.js';
import { inject, injectable } from 'tsyringe';
import { randomUUID } from 'node:crypto';

@injectable()
@injectable()
export class PinoHttpLogger {
  private readonly httpLogger: HttpLogger;

  constructor(@inject(DI_TOKENS.PinoProvider) provider: PinoProvider) {
    this.httpLogger = pinoHttp({
      logger: provider.instance,
      genReqId: (req, res) => {
        // `x-request-id` è fornito dal core Cardiofy per correlare i log attraverso il
        // confine core→notary. Essendo un header esterno, lo validiamo (cap lunghezza +
        // charset ristretto) per evitare log-injection; altrimenti fallback su UUID locale.
        const incoming = req.headers['x-request-id'];
        const id =
          typeof incoming === 'string' && /^[\w-]{1,128}$/.test(incoming) ? incoming : randomUUID();
        res.setHeader('x-request-id', id);
        return id;
      },
      serializers: {
        req: (req: { id?: string; method?: string; url?: string }) =>
          ({ id: req.id, method: req.method, url: req.url }),
        res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
      },
    });
  }

  getHttpLoggerInstance(): HttpLogger {
    return this.httpLogger;
  }
}
