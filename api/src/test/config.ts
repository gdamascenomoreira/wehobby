import { loadConfig, type Config } from '../config.js';

/** Placeholder values only: tests never call Entra or this database URL. */
export const TEST_ENV = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  APP_VERSION: 'test-version',
  DATABASE_URL: 'postgres://wehobby:unused@localhost:5432/unused',
  AUTH_TENANT_ID: '00000000-0000-4000-8000-000000000001',
  AUTH_TENANT_SUBDOMAIN: 'wehobbytest',
  AUTH_API_CLIENT_ID: '00000000-0000-4000-8000-000000000002',
  AUTH_WEB_CLIENT_ID: '00000000-0000-4000-8000-000000000003',
} as const;

export function testConfig(overrides: NodeJS.ProcessEnv = {}): Config {
  return loadConfig({ ...TEST_ENV, ...overrides });
}
