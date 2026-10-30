// Applies pending database migrations, then exits: 0 on success (also when
// there is nothing to apply), 1 on failure.
// On the VM this runs as the one-shot `migrate` Compose service.
// Manual fallback: docker compose run --rm migrate
import { z } from 'zod';
import { connectDatabase } from './db/client.js';
import { latestAppliedMigration, latestMigration, runMigrations } from './db/migrate.js';

const { DATABASE_URL } = z.object({ DATABASE_URL: z.string().min(1) }).parse(process.env);
const { db, close } = connectDatabase(DATABASE_URL);

try {
  const before = await latestAppliedMigration(db);
  if (before !== null && before >= (latestMigration()?.when ?? 0)) {
    console.log('Migrations: nothing to apply, the database is up to date');
  } else {
    await runMigrations(db);
    console.log(`Migrations applied, latest is ${latestMigration()?.tag ?? 'none'}`);
  }
} catch (error) {
  console.error('Migration failed:', error instanceof Error ? error.message : error);
  console.error(error);
  process.exitCode = 1;
} finally {
  await close();
}
