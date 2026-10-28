import { z } from 'zod';

export const API_ERROR_CODES = [
  'validation',
  'unauthorized',
  'not_found',
  'profile_exists',
  'username_taken',
  'rate_limited',
  'internal',
] as const;
export const ApiErrorCodeSchema = z.enum(API_ERROR_CODES);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

/** Body of every error response from the API. */
export const ApiErrorSchema = z.object({
  error: ApiErrorCodeSchema,
  message: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Response body of `GET /api/config`: public settings the web app needs at
 * runtime, so the same web image runs in every environment.
 */
export const PublicConfigSchema = z.object({
  auth: z.object({
    /** Client id of the web app registration in Entra External ID. */
    clientId: z.string().min(1),
    /** For example https://<tenant>.ciamlogin.com/ */
    authority: z.url(),
    /** Scope of the API, for example api://<api client id>/access_as_user */
    apiScope: z.string().min(1),
  }),
});
export type PublicConfig = z.infer<typeof PublicConfigSchema>;
