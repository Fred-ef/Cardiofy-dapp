import { BaseAppError } from './base-app.error.js';

export class NotFoundError extends BaseAppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND', true);
  }
}
