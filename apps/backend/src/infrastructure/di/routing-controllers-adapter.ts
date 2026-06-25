import { container, type DependencyContainer, type InjectionToken } from 'tsyringe';

/**
 * Adapter between routing-controllers `useContainer` API and tsyringe.
 * routing-controllers calls `get(ControllerClass)` to instantiate each controller.
 * We delegate to tsyringe container, which applies @inject() to constructor parameters.
 */
export const routingControllersTsyringeAdapter = {
  get<T>(someClass: InjectionToken<T>): T {
    return container.resolve(someClass);
  },
};

/**
 * Factory che produce un adapter risolvendo dal container indicato (utile nei test
 * per puntare ad un child container con servizi mockati).
 */
export const makeRoutingControllersAdapter = (c: DependencyContainer) => ({
  get<T>(someClass: InjectionToken<T>): T {
    return c.resolve(someClass);
  },
});
