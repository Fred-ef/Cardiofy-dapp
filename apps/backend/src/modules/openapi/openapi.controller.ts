import { inject, injectable } from 'tsyringe';
import { JsonController, Get } from 'routing-controllers';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import type { AppConfig } from '#infrastructure/config/index.js';
import { buildOpenApiDocument } from '#infrastructure/openapi/openapi-document.js';

/**
 * Espone la spec OpenAPI auto-generata dagli schemi Zod di `@cardiofy/shared`.
 * Endpoint pubblico (in skip-list dell'auth) per facilitare la consultazione
 * da parte degli sviluppatori del core e di chiunque debba integrarsi.
 *
 * Lo Swagger UI è servito da Express direttamente in `ExpressApi`
 * (non tramite routing-controllers, perché swagger-ui-express richiede una
 * forma specifica di middleware mount).
 */
@injectable()
@JsonController('/openapi')
export class OpenApiController {
  constructor(@inject(DI_TOKENS.AppConfig) private readonly config: AppConfig) {}

  @Get('.json')
  json(): ReturnType<typeof buildOpenApiDocument> {
    const port = this.config.env.SERVER.PORT;
    return buildOpenApiDocument(`http://localhost:${port}`);
  }
}
