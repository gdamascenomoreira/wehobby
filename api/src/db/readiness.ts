import type { ReadyResponse } from '@wehobby/shared';
import type { Database } from './client.js';
import { latestAppliedMigration, latestMigration } from './migrate.js';

export type ReadinessCheck = () => Promise<ReadyResponse>;

/**
 * Ready means the database answers and the newest migration shipped with this
 * build is recorded in `drizzle.__drizzle_migrations`.
 */
export function createReadinessCheck(db: Database, migrationsFolder?: string): ReadinessCheck {
  const expected = latestMigration(migrationsFolder)?.when ?? 0;
  return async () => {
    let applied: number | null;
    try {
      applied = await latestAppliedMigration(db);
    } catch {
      return { status: 'not_ready', reason: 'database_unreachable' };
    }
    if (expected > 0 && (applied === null || applied < expected)) {
      return { status: 'not_ready', reason: 'migrations_pending' };
    }
    return { status: 'ready' };
  };
}
