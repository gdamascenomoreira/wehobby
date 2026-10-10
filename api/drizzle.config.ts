import { defineConfig } from 'drizzle-kit';

// Only used to generate SQL migrations from src/db/schema.ts (npm run db:generate).
// Applying them is done by src/migrate.ts.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});
