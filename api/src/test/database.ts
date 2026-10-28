import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { connectDatabase, type DatabaseConnection } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';

/**
 * Admin connection string of a PostgreSQL server used only for tests, for
 * example the local `docker compose` PostGIS or the CI service container.
 * Database tests are skipped when it is not set.
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

if (process.env.CI === 'true' && !TEST_DATABASE_URL) {
  // Never let CI pass by silently skipping the database tests.
  throw new Error('TEST_DATABASE_URL must be set in CI');
}

export interface TestDatabase extends DatabaseConnection {
  drop: () => Promise<void>;
}

/** Creates a fresh, migrated database for one test file, so files can run in parallel. */
export async function createTestDatabase(): Promise<TestDatabase> {
  if (!TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL is not set');
  }
  const name = `wehobby_test_${randomBytes(6).toString('hex')}`;
  const admin = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${name}`);

  const url = new URL(TEST_DATABASE_URL);
  url.pathname = `/${name}`;
  const connection = connectDatabase(url.toString());
  await runMigrations(connection.db);

  return {
    ...connection,
    drop: async () => {
      await connection.close();
      await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
      await admin.end();
    },
  };
}
