import { HealthResponseSchema } from '@wehobby/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

const WEB_ORIGIN = 'https://dev.wehobby.app';

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp(
      loadConfig({
        NODE_ENV: 'test',
        LOG_LEVEL: 'silent',
        APP_VERSION: 'test-version',
        CORS_ORIGIN: `${WEB_ORIGIN}, http://localhost:5173`,
      }),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns ok and the app version', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    const body: unknown = response.json();
    expect(HealthResponseSchema.parse(body)).toEqual({ status: 'ok', version: 'test-version' });
  });

  it('allows CORS from the configured web origin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: WEB_ORIGIN },
    });

    expect(response.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
  });

  it('does not allow CORS from other origins', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example.com' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('loadConfig', () => {
  it('requires CORS_ORIGIN', () => {
    expect(() => loadConfig({})).toThrow();
  });

  it('rejects an invalid CORS origin', () => {
    expect(() => loadConfig({ CORS_ORIGIN: 'not a url' })).toThrow();
  });
});
