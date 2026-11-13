import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'assets/aistudio/Logo_Soundly_b8420ae4.svg',
        ],
        manifest: {
          id: '/',
          name: 'Soundly - Âm nhạc theo cách riêng',
          short_name: 'Soundly',
          description:
            'Ứng dụng nghe nhạc trực tuyến hoàn toàn miễn phí, không quảng cáo, với kho nhạc đa thể loại và lời bài hát đồng bộ mượt mà.',
          theme_color: '#070b1a',
          background_color: '#070b1a',
          display: 'standalone',
          orientation: 'any',
          start_url: '/',
          scope: '/',
          lang: 'vi',
          categories: ['music', 'entertainment'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/__\//],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'google-fonts-stylesheets',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-webfonts',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: ({ url, request }) =>
                request.destination === 'image' &&
                !url.pathname.startsWith('/api/') &&
                !url.pathname.startsWith('/__/'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'soundly-images-cache',
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 14 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
          type: 'module',
        },
      }),
      {
        name: 'disable-vite-hmr-ws',
        enforce: 'post',
        transform(code, id) {
          if (id.includes('vite/dist/client/client.mjs')) {
            return code
              .replace(
                /transport\.connect\(createHMRHandler\(handleMessage\)\);/g,
                '/* HMR WebSocket disabled in middleware mode */'
              )
              .replace(
                /reject\(\/\* @__PURE__ \*\/ new Error\("WebSocket closed without opened\."\)\);/g,
                'resolve();'
              );
          }
          return null;
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio to prevent WebSocket connection errors in middleware mode.
      hmr: false,
      ws: false,
      watch: null,
    },
  };
});
