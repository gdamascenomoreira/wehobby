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

  describe('geocoder', () => {
    const MAPS_CLIENT_ID = '00000000-0000-4000-8000-000000000004';

    it('uses the fake geocoder outside production', () => {
      expect(loadConfig(TEST_ENV).geocoder).toEqual({ kind: 'fake' });
      expect(loadConfig({ ...TEST_ENV, NODE_ENV: 'development' }).geocoder).toEqual({
        kind: 'fake',
      });
    });

    it('uses Azure Maps in production and then needs the client id', () => {
      const production = { ...TEST_ENV, NODE_ENV: 'production' };
      expect(() => loadConfig(production)).toThrow(/AZURE_MAPS_CLIENT_ID/);
      expect(loadConfig({ ...production, AZURE_MAPS_CLIENT_ID: MAPS_CLIENT_ID }).geocoder).toEqual({
        kind: 'azure',
        mapsClientId: MAPS_CLIENT_ID,
      });
    });

    it('lets GEOCODER override the default', () => {
      expect(
        loadConfig({ ...TEST_ENV, NODE_ENV: 'production', GEOCODER: 'fake' }).geocoder,
      ).toEqual({ kind: 'fake' });
      expect(() => loadConfig({ ...TEST_ENV, GEOCODER: 'azure' })).toThrow();
      expect(() => loadConfig({ ...TEST_ENV, GEOCODER: 'google' })).toThrow();
    });
  });
});
