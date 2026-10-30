import { z } from 'zod';

export const NOT_READY_REASONS = ['database_unreachable', 'migrations_pending'] as const;
export const NotReadyReasonSchema = z.enum(NOT_READY_REASONS);
export type NotReadyReason = z.infer<typeof NotReadyReasonSchema>;

/** Response body of `GET /api/ready`: 200 when ready, 503 when not. */
export const ReadyResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ready') }),
  z.object({ status: z.literal('not_ready'), reason: NotReadyReasonSchema }),
]);

export type ReadyResponse = z.infer<typeof ReadyResponseSchema>;
