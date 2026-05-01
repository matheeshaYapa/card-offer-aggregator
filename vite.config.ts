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
          globPatterns: ['**/*.{js,css,html,svg,json}'],
          runtimeCaching: [],
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
