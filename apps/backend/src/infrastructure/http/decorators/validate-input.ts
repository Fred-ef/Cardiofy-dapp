import { createParamDecorator, type Action } from 'routing-controllers';
import { ValidationError } from '#errors/validation.error.js';
import type { Validator } from '#types/validator.js';

const sources = {
  body:    (a: Action) => a.request.body,
  query:   (a: Action) => a.request.query,
  params:  (a: Action) => a.request.params,
  headers: (a: Action) => a.request.headers,
} as const;

type Location = keyof typeof sources;

function makeValidationDecorator(location: Location) {
  return <T>(schema: Validator<T>) =>
    createParamDecorator({
      value: (action: Action) => {
        const result = schema.safeParse(sources[location](action));
        if (!result.success) {
          throw new ValidationError(
            `Invalid ${location}`,
            result.error.issues.map((i) => ({
              path: i.path.map((p) => String(p)).join('.'),
              message: i.message,
            })),
          );
        }
        return result.data;
      },
    });
}

export const ValidateBody    = makeValidationDecorator('body');
export const ValidateQuery   = makeValidationDecorator('query');
export const ValidateParams  = makeValidationDecorator('params');
export const ValidateHeaders = makeValidationDecorator('headers');
