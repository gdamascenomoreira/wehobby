import { HealthResponseSchema } from '@wehobby/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { loadConfig } from '../config.js';

const WEB_ORIGIN = 'https://dev.wehobby.app';

async function createApp(env: NodeJS.ProcessEnv = {}): Promise<FastifyInstance> {
  return buildApp(
    loadConfig({ NODE_ENV: 'test', LOG_LEVEL: 'silent', APP_VERSION: 'test-version', ...env }),
  );
}

describe('GET /api/health', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    await app.close();
  });

  it('returns ok and the app version', async () => {
    app = await createApp();
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    const body: unknown = response.json();
    expect(HealthResponseSchema.parse(body)).toEqual({ status: 'ok', version: 'test-version' });
  });

  it('is not served outside the /api prefix', async () => {
    app = await createApp();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(404);
  });

  it('sends no CORS headers when CORS_ORIGIN is not set', async () => {
    app = await createApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: WEB_ORIGIN },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows CORS from the configured web origin', async () => {
    app = await createApp({ CORS_ORIGIN: `${WEB_ORIGIN}, http://localhost:5173` });
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: WEB_ORIGIN },
    });

    expect(response.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
  });

  it('does not allow CORS from other origins', async () => {
    app = await createApp({ CORS_ORIGIN: WEB_ORIGIN });
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { origin: 'https://evil.example.com' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('loadConfig', () => {
  it('works with no environment variables', () => {
    const config = loadConfig({});

    expect(config.PORT).toBe(3000);
    expect(config.CORS_ORIGIN).toBeUndefined();
  });

  it('rejects an invalid CORS origin', () => {
    expect(() => loadConfig({ CORS_ORIGIN: 'not a url' })).toThrow();
  });

  it('rejects an invalid port', () => {
    expect(() => loadConfig({ PORT: '70000' })).toThrow();
  });
});
