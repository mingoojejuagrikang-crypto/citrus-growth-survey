import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      registerType: 'prompt',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/sheets\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/oauth2\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      manifest: {
        name: '감귤 생육조사',
        short_name: '감귤조사',
        description: '감귤 생육 데이터 현장 입력 PWA',
        theme_color: '#2e7d32',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env['npm_package_version'] ?? '1.0.0'),
  },
});
