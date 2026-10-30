import { ReadyResponseSchema, type ReadyResponse } from '@wehobby/shared';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { connectDatabase } from '../db/client.js';
import { testConfig, TEST_ENV } from '../test/config.js';

// The fake readiness checks below never touch the database.
const unusedDb = connectDatabase(TEST_ENV.DATABASE_URL).db;

async function getReady(result: ReadyResponse) {
  const app = await buildApp(testConfig(), {
    db: unusedDb,
    checkReadiness: () => Promise.resolve(result),
  });
  const response = await app.inject({ method: 'GET', url: '/api/ready' });
  await app.close();
  return response;
}

describe('GET /api/ready', () => {
  it('returns 200 when the API is ready', async () => {
    const response = await getReady({ status: 'ready' });

    expect(response.statusCode).toBe(200);
    expect(ReadyResponseSchema.parse(response.json())).toEqual({ status: 'ready' });
  });

  it.each(['database_unreachable', 'migrations_pending'] as const)(
    'returns 503 with the reason when %s',
    async (reason) => {
      const response = await getReady({ status: 'not_ready', reason });

      expect(response.statusCode).toBe(503);
      expect(ReadyResponseSchema.parse(response.json())).toEqual({ status: 'not_ready', reason });
    },
  );
});
