import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      selfDestroying: false,
      disable: false,
      includeAssets: ['favicon.ico', 'pwa-icon.svg', 'apple-touch-icon-180x180.png'],

      manifest: {
        name: 'Sushi Control',
        short_name: 'Sushi Control',
        description: 'Sistema financeiro para delivery de sushi',
        theme_color: '#f97316',
        background_color: '#0a0a0a',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        lang: 'pt-BR',
        icons: [
          { src: 'pwa-64x64.png',             sizes: '64x64',   type: 'image/png' },
          { src: 'pwa-192x192.png',           sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png',           sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },

      workbox: {
        // Ativa o novo SW imediatamente (sem esperar fechar outras abas)
        skipWaiting: true,
        clientsClaim: true,

        // Cache todos os assets do build (JS, CSS, HTML, imagens, fontes)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2,ttf,webp}'],

        // Não fazer cache de rotas de navegação — sempre busca do servidor primeiro
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          // API: NetworkOnly — nunca cacheia, sempre busca do servidor
          // Evita o bug de servir HTML em vez de JSON para rotas /api/
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api/') ||
              url.href.includes('localhost:3001/api/') ||
              url.href.includes('192.168.15.4:3001/api/'),
            handler: 'NetworkOnly',
          },
          // Google Fonts: CacheFirst (raramente muda)
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },

      // Desenvolvimento: desativa SW para não interferir no HMR
      devOptions: {
        enabled: false,
      },
    }),
  ],

  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
