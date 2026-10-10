import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const THEME_COLOR = '#c2553a';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    resolve: {
      alias: {
        // Use the shared package from source so web never needs a prebuilt dist.
        '@wehobby/shared': fileURLToPath(
          new URL('../packages/shared/src/index.ts', import.meta.url),
        ),
      },
    },
    server: {
      // Same origin as in production, where Caddy proxies /api to the API.
      proxy: {
        '/api': env.API_PROXY_TARGET ?? 'http://localhost:3000',
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        workbox: {
          // API responses must never be answered with the cached app shell.
          navigateFallbackDenylist: [/^\/api\//],
        },
        manifest: {
          name: 'WeHobby',
          short_name: 'WeHobby',
          description: 'A hobby only social network.',
          theme_color: THEME_COLOR,
          background_color: '#fffaf6',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      }),
    ],
    test: {
      name: 'web',
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
