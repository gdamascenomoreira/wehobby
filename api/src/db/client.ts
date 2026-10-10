import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;

export interface DatabaseConnection {
  db: Database;
  close: () => Promise<void>;
}

export function connectDatabase(url: string): DatabaseConnection {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return {
    db: drizzle({ client: pool, schema }),
    close: () => pool.end(),
  };
}
