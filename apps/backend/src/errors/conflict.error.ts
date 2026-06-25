import { BaseAppError } from './base-app.error.js';

export class ConflictError extends BaseAppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT', true);
  }
}
