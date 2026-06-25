/**
 * Validator: surface comune per schemi di validazione (zod o equivalente).
 * Mantenuta minimale per non legarsi a un singolo motore.
 */
export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationFailure {
  success: false;
  // PropertyKey[] perché Zod 4 ammette anche symbol nei path (raro ma tipato).
  error: { issues: { path: PropertyKey[]; message: string }[] };
}

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface Validator<T> {
  safeParse(input: unknown): ValidationSuccess<T> | ValidationFailure;
}
