import type { ValidationIssue } from '#types/validator.js';
import { BaseAppError } from './base-app.error.js';

export class ValidationError extends BaseAppError {
  constructor(message = 'The provided input was invalid', issues?: ValidationIssue[]) {
    super(message, 400, 'VALIDATION_ERROR', true, issues);
  }
}
