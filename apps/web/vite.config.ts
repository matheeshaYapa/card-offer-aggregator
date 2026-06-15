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
        // Inject the SW registration as a deferred script so it stays out of
        // the critical render path (fixes the "render-blocking requests" /
        // critical-chain PageSpeed audits for registerSW.js).
        injectRegister: 'script-defer',
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
          // Precache the full app shell + all SSG-prerendered HTML pages.
          // NOTE: navigateFallback is intentionally NOT set.
          //
          // With SSG, every public route has its own prerendered /route/index.html
          // file in the precache. Setting navigateFallback to anything (including
          // offline.html) causes Workbox to serve that file for ALL navigations
          // that don't produce an exact cache key match — which shows "You're
          // offline" even when the user is online.
          //
          // Without navigateFallback, Workbox serves precached HTML when available
          // and falls through to the network for anything else. The offline.html
          // file in public/ is still served by Cloudflare when accessed directly.
          globPatterns: ['**/*.{js,css,html,svg,png,jpg,webp,woff2}'],
          cleanupOutdatedCaches: true,
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
