import type { ViewResponse } from '@cardiofy/shared';
import type { RegisterViewResult } from './interfaces/i-view.service.js';

export function toViewResponse(result: RegisterViewResult): ViewResponse {
  return {
    eventId:   result.eventId,
    periodId:  result.periodId,
    duplicate: result.duplicate,
  };
}
