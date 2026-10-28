import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

const sharedSource = fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url));

// Database tests read TEST_DATABASE_URL from the environment (CI) or api/.env.local.
const apiEnv = loadEnv('test', fileURLToPath(new URL('./api', import.meta.url)), 'TEST_');

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: { '@wehobby/shared': sharedSource } },
        test: { name: 'shared', root: './packages/shared', environment: 'node' },
      },
      {
        resolve: { alias: { '@wehobby/shared': sharedSource } },
        test: { name: 'api', root: './api', environment: 'node', env: apiEnv },
      },
      './web/vite.config.ts',
    ],
  },
});
