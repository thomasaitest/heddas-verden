import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

function basePath(value: string | undefined): string {
  const raw = (value ?? '').trim();
  if (raw === '' || raw === '/') return '/';
  const lead = raw.startsWith('/') ? raw : `/${raw}`;
  return lead.endsWith('/') ? lead : `${lead}/`;
}

export default defineConfig({
  base: basePath(process.env.BASE_PATH),
  build: { chunkSizeWarningLimit: 1000 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  server: { host: '0.0.0.0', port: 4740, strictPort: true },
  preview: { host: '0.0.0.0', port: 4740, strictPort: true },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      scope: './',
      buildBase: './',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        id: './',
        name: 'Heddas Verden',
        short_name: 'Heddas Verden',
        description: 'Adopter kjæledyr, stell dem, lag din egen figur og bygg ditt eget hus.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#9fdcff',
        theme_color: '#ff8fc7',
        lang: 'nb',
        categories: ['games', 'kids'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,ico,woff,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
});
