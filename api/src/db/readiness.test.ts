import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, TEST_DATABASE_URL, type TestDatabase } from '../test/database.js';
import { connectDatabase } from './client.js';
import { createReadinessCheck } from './readiness.js';

/** A migrations folder whose journal claims a migration newer than any applied one. */
function folderWithNewerMigration(): string {
  const folder = mkdtempSync(join(tmpdir(), 'wehobby-journal-'));
  mkdirSync(join(folder, 'meta'));
  const journal = { entries: [{ when: Number.MAX_SAFE_INTEGER, tag: '9999_future' }] };
  writeFileSync(join(folder, 'meta', '_journal.json'), JSON.stringify(journal));
  return folder;
}

describe('createReadinessCheck', () => {
  it('reports an unreachable database', async () => {
    const { db, close } = connectDatabase('postgres://nobody:none@127.0.0.1:1/none');
    const check = createReadinessCheck(db);

    await expect(check()).resolves.toEqual({
      status: 'not_ready',
      reason: 'database_unreachable',
    });
    await close();
  });
});

describe.skipIf(!TEST_DATABASE_URL)('createReadinessCheck with a database', () => {
  let database: TestDatabase;

  beforeAll(async () => {
    database = await createTestDatabase();
  });

  afterAll(async () => {
    await database.drop();
  });

  it('is ready when the latest migration is applied', async () => {
    await expect(createReadinessCheck(database.db)()).resolves.toEqual({ status: 'ready' });
  });

  it('reports pending migrations', async () => {
    const check = createReadinessCheck(database.db, folderWithNewerMigration());

    await expect(check()).resolves.toEqual({ status: 'not_ready', reason: 'migrations_pending' });
  });
});
