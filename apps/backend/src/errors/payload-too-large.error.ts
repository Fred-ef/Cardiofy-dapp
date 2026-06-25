import { BaseAppError } from './base-app.error.js';

export class PayloadTooLargeError extends BaseAppError {
  constructor(message = 'Request body too large') {
    super(message, 413, 'PAYLOAD_TOO_LARGE', true);
  }
}
