import { inject, injectable } from 'tsyringe';
import pino, { type Logger, type LoggerOptions } from 'pino';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import type { AppConfig } from '#infrastructure/config/index.js';

@injectable()
export class PinoProvider {
  public readonly instance: Logger;

  constructor(@inject(DI_TOKENS.AppConfig) appConfig: AppConfig) {
    const isDev = appConfig.env.SERVER.NODE_ENV !== 'production';
    const options: LoggerOptions = {
      level: isDev ? 'debug' : 'info',
      // Difesa in profondità per i log applicativi: gli header sensibili sono già
      // esclusi a monte dalla whitelist nei serializer di pino-http, ma un
      // `logger.info('...', { token })` arbitrario non avrebbe altra rete.
      redact: ['password', '*.password', 'token', '*.token', 'authorization', '*.authorization'],
    };
    if (isDev) {
      options.transport = {
        target: 'pino-pretty',
        // pid/hostname sono rumore in deployment containerizzato (1 processo per container,
        // l'orchestratore li allega già come metadata). Ignorati solo nel pretty (dev).
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
      };
    }
    this.instance = pino(options);
  }
}
