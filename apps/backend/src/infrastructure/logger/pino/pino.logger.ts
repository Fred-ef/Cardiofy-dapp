import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { PinoProvider } from './pino.factory.js';
import type { ILoggerService } from '../interfaces/i-logger.service.js';

@injectable()
export class PinoLogger implements ILoggerService {
  constructor(@inject(DI_TOKENS.PinoProvider) private readonly provider: PinoProvider) {}

  info(msg: string, meta?: Record<string, unknown>): void {
    this.provider.instance.info(meta ?? {}, msg);
  }

  warn(msg: string, meta?: Record<string, unknown>): void {
    this.provider.instance.warn(meta ?? {}, msg);
  }

  error(msg: string, err?: unknown, meta?: Record<string, unknown>): void {
    const payload: Record<string, unknown> = { ...(meta ?? {}) };
    if (err instanceof Error) {
      payload['err'] = { message: err.message, stack: err.stack, name: err.name };
    } else if (err !== undefined) {
      payload['err'] = err;
    }
    this.provider.instance.error(payload, msg);
  }

  debug(msg: string, meta?: Record<string, unknown>): void {
    this.provider.instance.debug(meta ?? {}, msg);
  }
}
