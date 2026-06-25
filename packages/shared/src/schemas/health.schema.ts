import { z } from 'zod';

// ─── GET /health/live ─────────────────────────────────────────────────────────

export const LivenessResponseSchema = z.object({
  status: z.literal('ok'),
}).strict();
export type LivenessResponse = z.infer<typeof LivenessResponseSchema>;

// ─── GET /health/ready ────────────────────────────────────────────────────────

export const HealthCheckSchema = z.object({
  name:       z.string(),
  status:     z.enum(['ok', 'fail', 'skip']),
  durationMs: z.number().int().nonnegative(),
  error:      z.string().optional(),
}).strict();
export type HealthCheck = z.infer<typeof HealthCheckSchema>;

export const ReadinessReportSchema = z.object({
  ready:  z.boolean(),
  checks: z.array(HealthCheckSchema),
}).strict();
export type ReadinessReport = z.infer<typeof ReadinessReportSchema>;
