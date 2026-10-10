import { ApiErrorSchema, type ApiErrorCode } from '@wehobby/shared';
import type { z } from 'zod';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | undefined,
    message: string,
  ) {
    super(message);
  }
}

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  token?: string;
  signal?: AbortSignal;
}

/**
 * Calls the API on the same origin (`/api/...`) and validates the response
 * with a shared schema. Errors become ApiRequestError with the API error code.
 */
export async function apiRequest<T extends z.ZodType>(
  path: string,
  schema: T,
  { method = 'GET', body, token, signal }: ApiRequestOptions = {},
): Promise<z.infer<T>> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    ...(body !== undefined && { body: JSON.stringify(body) }),
    ...(signal && { signal }),
  });

  if (!response.ok) {
    const error = ApiErrorSchema.safeParse(await response.json().catch(() => null));
    throw new ApiRequestError(
      response.status,
      error.success ? error.data.error : undefined,
      error.success ? error.data.message : `Request failed with status ${response.status}`,
    );
  }
  return schema.parse(await response.json());
}
