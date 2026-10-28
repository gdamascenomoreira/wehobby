// Applies pending database migrations, then exits.
// On the VM: docker compose run --rm api node api/dist/migrate.js
import { z } from 'zod';
import { connectDatabase } from './db/client.js';
import { runMigrations } from './db/migrate.js';

const { DATABASE_URL } = z.object({ DATABASE_URL: z.string().min(1) }).parse(process.env);
const { db, close } = connectDatabase(DATABASE_URL);

try {
  await runMigrations(db);
  console.log('Migrations applied');
} finally {
  await close();
}
