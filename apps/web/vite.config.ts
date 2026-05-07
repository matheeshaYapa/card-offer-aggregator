import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // Skip PWA plugin during SSR build
    !isSsrBuild &&
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icons/icon.svg'],
        manifest: {
          name: 'CardPromo LK',
          short_name: 'CardPromo',
          description:
            'Find promotions for your Sri Lankan credit and debit cards.',
          theme_color: '#0F766E',
          background_color: '#F8FAFC',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: '/icons/icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          // Precache the full app shell + all SSG-prerendered HTML pages
          globPatterns: ['**/*.{js,css,html,svg,png,jpg,webp,woff2}'],
          // Serve offline.html for any navigation request that isn't in the cache
          navigateFallback: '/offline.html',
          // Don't apply the fallback to admin routes (they're not precached)
          navigateFallbackDenylist: [/^\/admin/],
          runtimeCaching: [
            // Cache Supabase API responses — serve stale while revalidating
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'supabase-api',
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }, // 24 h
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Cache Google Fonts and external fonts
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            // Cache remote images (bank logos, merchant logos)
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images',
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 d
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
        },
      }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: isSsrBuild
    ? {
        ssr: true,
        outDir: 'dist/.ssr',
        rollupOptions: {
          input: 'src/entry-server.tsx',
          output: { format: 'es' },
        },
      }
    : {
        outDir: 'dist',
        rollupOptions: {
          input: 'index.html',
        },
      },
  ssr: {
    // Bundle CJS packages that don't have proper ESM exports
    noExternal: ['react-helmet-async', 'react-fast-compare', 'invariant', 'shallowequal'],
  },
}))
