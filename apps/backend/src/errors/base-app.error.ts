import type { ValidationIssue } from '#types/validator.js';

/**
 * Base class per tutti gli errori applicativi del modulo.
 * isOperational discrimina errori attesi (mappati a status HTTP) da errori
 * imprevisti (mappati genericamente a 500).
 */
export abstract class BaseAppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly issues?: ValidationIssue[] | undefined;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    isOperational: boolean,
    issues?: ValidationIssue[]
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.issues = issues;
    Error.captureStackTrace(this, this.constructor);
  }
}
