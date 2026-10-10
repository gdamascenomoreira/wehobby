import type { ApiError, ApiErrorCode } from '@wehobby/shared';
import type { FastifyReply } from 'fastify';
import type { z } from 'zod';

const STATUS_CODES: Record<ApiErrorCode, number> = {
  validation: 400,
  unauthorized: 401,
  not_found: 404,
  profile_exists: 409,
  username_taken: 409,
  rate_limited: 429,
  internal: 500,
};

export function sendError(reply: FastifyReply, error: ApiErrorCode, message: string) {
  const body: ApiError = { error, message };
  return reply.code(STATUS_CODES[error]).send(body);
}

/** Validates a request part with a shared Zod schema, or answers 400 and returns undefined. */
export function parseOrReply<T extends z.ZodType>(
  schema: T,
  value: unknown,
  reply: FastifyReply,
): z.infer<T> | undefined {
  const result = schema.safeParse(value);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');
    void sendError(reply, 'validation', message);
    return undefined;
  }
  return result.data;
}
