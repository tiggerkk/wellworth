import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'WellWorth',
        short_name: 'WellWorth',
        description: 'Personal wellness & net-worth tracker',
        theme_color: '#161b28',
        background_color: '#161b28',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
        // Don't let the precached index.html shadow the OAuth return (?code=) once the
        // service worker is live in production.
        navigateFallbackDenylist: [/^\/auth/, /\?code=/],
      },
      // Keep the service worker off during `vite dev` to avoid stale-cache confusion.
      devOptions: { enabled: false },
    }),
  ],
})
