import { DrizzleQueryError } from 'drizzle-orm/errors';
import pg from 'pg';

/** Node socket errors that mean PostgreSQL could not be reached. */
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EHOSTUNREACH',
]);

/**
 * True for errors raised by PostgreSQL or the pg driver (a missing table, a
 * refused connection...), also when Drizzle wraps them in a DrizzleQueryError.
 */
export function isDatabaseError(error: unknown): boolean {
  if (error instanceof DrizzleQueryError || error instanceof pg.DatabaseError) {
    return true;
  }
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    return CONNECTION_ERROR_CODES.has(error.code);
  }
  return false;
}
