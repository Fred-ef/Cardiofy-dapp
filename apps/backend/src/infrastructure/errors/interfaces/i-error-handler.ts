export interface IErrorHandler {
  handleError(error: unknown): Promise<void>;
}
