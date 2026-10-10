import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { TEST_ENV } from './test/config.js';

describe('loadConfig', () => {
  it('derives the Entra External ID endpoints from the tenant settings', () => {
    const { auth } = loadConfig(TEST_ENV);

    expect(auth.issuer).toBe(
      `https://${TEST_ENV.AUTH_TENANT_ID}.ciamlogin.com/${TEST_ENV.AUTH_TENANT_ID}/v2.0`,
    );
    expect(auth.jwksUri).toBe(
      `https://wehobbytest.ciamlogin.com/${TEST_ENV.AUTH_TENANT_ID}/discovery/v2.0/keys`,
    );
    expect(auth.audience).toBe(TEST_ENV.AUTH_API_CLIENT_ID);
  });

  it('applies defaults and leaves CORS and the proxy trust off', () => {
    const config = loadConfig(TEST_ENV);

    expect(config.PORT).toBe(3000);
    expect(config.CORS_ORIGIN).toBeUndefined();
    expect(config.TRUST_PROXY).toBe(false);
  });

  it('requires the database and auth settings', () => {
    const withoutDatabase = { ...TEST_ENV, DATABASE_URL: undefined };
    const withoutAudience = { ...TEST_ENV, AUTH_API_CLIENT_ID: undefined };

    expect(() => loadConfig(withoutDatabase)).toThrow();
    expect(() => loadConfig(withoutAudience)).toThrow();
  });

  it.each([
    ['CORS_ORIGIN', 'not a url'],
    ['PORT', '70000'],
    ['DATABASE_URL', 'mysql://localhost/wehobby'],
    ['AUTH_TENANT_SUBDOMAIN', 'evil.example.com/'],
  ])('rejects an invalid %s', (key, value) => {
    expect(() => loadConfig({ ...TEST_ENV, [key]: value })).toThrow();
  });
});
