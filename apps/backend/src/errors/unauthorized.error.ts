import { BaseAppError } from './base-app.error.js';

export class UnauthorizedError extends BaseAppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED', true);
  }
}
