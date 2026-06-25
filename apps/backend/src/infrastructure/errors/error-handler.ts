import { inject, injectable } from 'tsyringe';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { BaseAppError } from '#errors/base-app.error.js';
import type { ILoggerService } from '#infrastructure/logger/interfaces/i-logger.service.js';
import type { IErrorHandler } from './interfaces/i-error-handler.js';

@injectable()
export class ErrorHandler implements IErrorHandler {
  constructor(@inject(DI_TOKENS.ILoggerService) private readonly logger: ILoggerService) {}

  async handleError(error: unknown): Promise<void> {
    if (error instanceof BaseAppError && error.isOperational) {
      this.logger.warn(error.message, { code: error.code, statusCode: error.statusCode });
      return;
    }
    this.logger.error('Unhandled error', error);
  }
}
