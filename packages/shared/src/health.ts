import { z } from 'zod';

/** Response body of `GET /health` on the API. */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string().min(1),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
