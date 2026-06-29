export interface RegisterViewCommand {
  idempotencyKey: string;
  assetId:        string;
  occurredAt:     Date;
}

export interface RegisterViewResult {
  eventId:  string;
  periodId: number;
  /** true se la chiave era già stata vista (no-op semantico). */
  duplicate: boolean;
}

export interface IViewService {
  register(cmd: RegisterViewCommand): Promise<RegisterViewResult>;
}
