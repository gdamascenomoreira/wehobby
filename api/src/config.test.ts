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
      const production = {
        ...TEST_ENV,
        NODE_ENV: 'production',
        STORAGE_ACCOUNT_NAME: 'stwehobbytest',
      };
      expect(() => loadConfig(production)).toThrow(/AZURE_MAPS_CLIENT_ID/);
      expect(loadConfig({ ...production, AZURE_MAPS_CLIENT_ID: MAPS_CLIENT_ID }).geocoder).toEqual({
        kind: 'azure',
        mapsClientId: MAPS_CLIENT_ID,
      });
    });

    it('lets GEOCODER override the default', () => {
      expect(
        loadConfig({
          ...TEST_ENV,
          NODE_ENV: 'production',
          GEOCODER: 'fake',
          STORAGE_ACCOUNT_NAME: 'stwehobbytest',
        }).geocoder,
      ).toEqual({ kind: 'fake' });
      expect(() => loadConfig({ ...TEST_ENV, GEOCODER: 'azure' })).toThrow();
      expect(() => loadConfig({ ...TEST_ENV, GEOCODER: 'google' })).toThrow();
    });
  });

  describe('storage', () => {
    const MAPS_CLIENT_ID = '00000000-0000-4000-8000-000000000004';
    const production = {
      ...TEST_ENV,
      NODE_ENV: 'production',
      AZURE_MAPS_CLIENT_ID: MAPS_CLIENT_ID,
    };

    it('uses a local folder outside production', () => {
      expect(loadConfig(TEST_ENV).storage).toEqual({ kind: 'fake', directory: '.storage' });
      expect(loadConfig({ ...TEST_ENV, FAKE_STORAGE_DIR: '/tmp/photos' }).storage).toEqual({
        kind: 'fake',
        directory: '/tmp/photos',
      });
    });

    it('uses Blob Storage in production and then needs the account name', () => {
      expect(() => loadConfig(production)).toThrow(/STORAGE_ACCOUNT_NAME/);
      expect(loadConfig({ ...production, STORAGE_ACCOUNT_NAME: 'stwehobbydev' }).storage).toEqual({
        kind: 'azure',
        accountName: 'stwehobbydev',
        container: 'photos',
      });
    });

    it('never allows the fake storage in production', () => {
      expect(() => loadConfig({ ...production, STORAGE: 'fake' })).toThrow(/not allowed/);
    });

    it('rejects invalid account and container names', () => {
      expect(() =>
        loadConfig({ ...production, STORAGE_ACCOUNT_NAME: 'st-wehobby.blob.core.windows.net' }),
      ).toThrow();
      expect(() =>
        loadConfig({
          ...production,
          STORAGE_ACCOUNT_NAME: 'stwehobbydev',
          PHOTOS_CONTAINER: '../x',
        }),
      ).toThrow();
    });

    it('keeps storage settings out of the top level config', () => {
      const config = loadConfig(TEST_ENV);
      expect(config).not.toHaveProperty('STORAGE');
      expect(config).not.toHaveProperty('FAKE_STORAGE_DIR');
    });
  });
});
