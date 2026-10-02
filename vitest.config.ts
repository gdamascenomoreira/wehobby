import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const sharedSource = fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: { '@wehobby/shared': sharedSource } },
        test: { name: 'shared', root: './packages/shared', environment: 'node' },
      },
      {
        resolve: { alias: { '@wehobby/shared': sharedSource } },
        test: { name: 'api', root: './api', environment: 'node' },
      },
      './web/vite.config.ts',
    ],
  },
});
