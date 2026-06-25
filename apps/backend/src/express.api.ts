import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { inject, injectable } from 'tsyringe';
import { useContainer, useExpressServer, type Action } from 'routing-controllers';
import { DI_TOKENS } from '#infrastructure/di/tokens.js';
import { UnauthorizedError } from '#errors/unauthorized.error.js';
import type { AppConfig } from '#infrastructure/config/index.js';
import { routingControllersTsyringeAdapter } from '#infrastructure/di/routing-controllers-adapter.js';
import { ErrorHandlerMiddleware } from '#infrastructure/errors/error-handler.middleware.js';
import { PinoHttpLogger } from '#infrastructure/logger/pino/pino-http.logger.js';
import { PayloadTooLargeError } from '#errors/payload-too-large.error.js';
import { NotFoundError } from '#errors/not-found.error.js';
import { AssetController } from '#modules/assets/asset.controller.js';
import { ContractController } from '#modules/contracts/contract.controller.js';
import { ViewController } from '#modules/views/view.controller.js';
import { BatchController } from '#modules/batches/batch.controller.js';
import { ChainInfoController } from '#modules/chain-info/chain-info.controller.js';
import { HealthController } from '#modules/health/health.controller.js';
import { OpenApiController } from '#modules/openapi/openapi.controller.js';
import { AuthMiddleware } from '#infrastructure/auth/auth.middleware.js';
import { buildOpenApiDocument } from '#infrastructure/openapi/openapi-document.js';

@injectable()
export class ExpressApi {
  public readonly app: Express;

  constructor(
    @inject(ErrorHandlerMiddleware) private readonly errorHandler: ErrorHandlerMiddleware,
    @inject(PinoHttpLogger)         private readonly pinoHttpLogger: PinoHttpLogger,
    @inject(DI_TOKENS.AppConfig)    private readonly appConfig: AppConfig,
  ) {
    this.app = express();
    useContainer(routingControllersTsyringeAdapter);

    this.setupGlobalMiddlewares();
    this.setupSwaggerUi();
    this.setupRoutes();
    this.setupErrorHandlers();
  }

  private setupGlobalMiddlewares(): void {
    this.app.use(this.pinoHttpLogger.getHttpLoggerInstance());
    this.app.use(helmet());
    this.app.use(cors());

    // Body parser con limite (può produrre 413).
    const jsonParser = express.json({ limit: '64kb' });
    this.app.use((req, res, next) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jsonParser(req, res, (err: any) => {
        if (err?.statusCode === 413) {
          return next(new PayloadTooLargeError());
        }
        next(err);
      });
    });
  }

  /**
   * Swagger UI montato direttamente da Express (non via routing-controllers).
   * `swagger-ui-express` richiede `app.use(path, serve, setup)`; non si presta
   * a un controller decorato. Path pubblico, in skip-list dell'AuthMiddleware.
   */
  private setupSwaggerUi(): void {
    const document = buildOpenApiDocument(`http://localhost:${this.appConfig.env.SERVER.PORT}`);
    this.app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(document, {
      customSiteTitle: 'Cardiofy Blockchain Module — API docs',
    }));
  }

  private setupRoutes(): void {
    useExpressServer(this.app, {
      controllers: [
        AssetController,
        ContractController,
        ViewController,
        BatchController,
        ChainInfoController,
        HealthController,
        OpenApiController,
      ],
      middlewares: [AuthMiddleware],
      routePrefix: '/api/v1',
      defaultErrorHandler: false,
      // Authorization: i controller protetti dichiarano `@Authorized()`; questo checker
      // viene invocato solo su quelle route. Lancia `UnauthorizedError` (BaseAppError → 401)
      // invece di restituire `false`: così l'errore passa dal nostro ErrorHandlerMiddleware
      // come 401 pulito, evitando l'AuthorizationRequiredError di routing-controllers (→ 500).
      authorizationChecker: (action: Action): boolean => {
        if (action.request.principal) return true;
        throw new UnauthorizedError('Invalid or missing bearer token');
      },
      // Abilita l'iniezione di `@CurrentUser()` (audit / uso futuro).
      currentUserChecker: (action: Action) => action.request.principal,
    });
  }

  private setupErrorHandlers(): void {
    const notFound: express.RequestHandler = (req) => {
      throw new NotFoundError(`Couldn't find route ${req.originalUrl}`);
    };
    this.app.use(notFound);
    this.app.use(this.errorHandler.handle);
  }
}
