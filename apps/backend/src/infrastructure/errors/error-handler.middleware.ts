import { inject, injectable } from 'tsyringe';
import type { ErrorRequestHandler } from 'express';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { BaseAppError } from '#errors/base-app.error.js';
import { getTraceId } from '#utils/trace-id.js';
import type { IErrorHandler } from './interfaces/i-error-handler.js';

@injectable()
export class ErrorHandlerMiddleware {
  constructor(@inject(DI_TOKENS.IErrorHandler) private readonly errorHandler: IErrorHandler) {}

  public handle: ErrorRequestHandler = async (err, req, res, _next) => {
    await this.errorHandler.handleError(err);

    const traceId = getTraceId(req);

    if (err instanceof BaseAppError) {
      res.status(err.statusCode).json({
        status: 'error',
        statusCode: err.statusCode,
        message: err.message,
        code: err.code,
        issues: err.issues,
        traceId,
      });
      return;
    }

    res.status(500).json({
      status: 'error',
      statusCode: 500,
      message: 'Internal Server Error',
      code: 'INTERNAL_SERVER_ERROR',
      traceId,
      stack: process.env['NODE_ENV'] === 'development' && err instanceof Error ? err.stack : undefined,
    });
  };
}
