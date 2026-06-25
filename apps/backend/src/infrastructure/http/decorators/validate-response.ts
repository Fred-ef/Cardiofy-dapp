import { UseInterceptor, type Action } from 'routing-controllers';
import type { Validator } from '#types/validator.js';

/**
 * Logica pura (framework-agnostic, quindi unit-testabile) della validazione di response:
 * valida `content` contro lo schema e ritorna i dati parsati, oppure lancia un Error
 * generico in caso di violazione (bug server-side: mapper rotto, schema disallineato).
 */
export function assertValidResponse<T>(schema: Validator<T>, content: unknown): T {
  const result = schema.safeParse(content);
  if (!result.success) {
    throw new Error(
      `Response schema validation failed: ${JSON.stringify(
        result.error.issues.map((i) => ({
          path: i.path.map((p) => String(p)).join('.'),
          message: i.message,
        })),
      )}`,
    );
  }
  return result.data;
}

/**
 * Valida la response del controller contro lo schema dichiarato prima della
 * serializzazione JSON. Un fallimento implica bug server-side → Error generico →
 * 500 dal global handler.
 */
export function ValidateResponse<T>(schema: Validator<T>) {
  return UseInterceptor((_action: Action, content: unknown) => assertValidResponse(schema, content));
}
