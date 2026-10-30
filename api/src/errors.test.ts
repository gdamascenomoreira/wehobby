import { ApiErrorSchema } from '@wehobby/shared';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import type { FastifyInstance } from 'fastify';
import pg from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { connectDatabase } from './db/client.js';
import { bearer, createTestTokens } from './test/auth.js';
import { testConfig } from './test/config.js';

/** Nothing listens on port 1, so every query fails with ECONNREFUSED. */
const UNREACHABLE_DATABASE_URL = 'postgres://nobody:none@127.0.0.1:1/none';

const missingTable = () =>
  new DrizzleQueryError(
    'select "id" from "users" where "oid" = $1',
    ['secret-oid'],
    new pg.DatabaseError('relation "users" does not exist', 0, 'error'),
  );

describe('error handler', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  async function appThrowing(error: Error) {
    app = await buildApp(testConfig(), { db: connectDatabase(UNREACHABLE_DATABASE_URL).db });
    app.get('/api/boom', () => {
      throw error;
    });
    return app.inject({ method: 'GET', url: '/api/boom' });
  }

  it('answers 503 without SQL details for database errors', async () => {
    const response = await appThrowing(missingTable());

    expect(response.statusCode).toBe(503);
    expect(ApiErrorSchema.parse(response.json()).error).toBe('service_unavailable');
    expect(response.body).not.toMatch(/users|select|secret-oid|stack/i);
  });

  it('still answers 500 for other errors', async () => {
    const response = await appThrowing(new Error('a bug'));

    expect(response.statusCode).toBe(500);
    expect(ApiErrorSchema.parse(response.json()).error).toBe('internal');
    expect(response.body).not.toContain('a bug');
  });

  it('answers 503 on GET /api/me when the database is unreachable', async () => {
    const config = testConfig();
    const { sign, getSigningKey } = await createTestTokens(config);
    const { db, close } = connectDatabase(UNREACHABLE_DATABASE_URL);
    app = await buildApp(config, { db, getSigningKey });

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: bearer(await sign({ oid: crypto.randomUUID() })),
    });
    await close();

    expect(response.statusCode).toBe(503);
    expect(ApiErrorSchema.parse(response.json()).error).toBe('service_unavailable');
  });
});
