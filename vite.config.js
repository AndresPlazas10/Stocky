import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = String(env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
  const isDesktopBuild = String(process.env.VITE_DESKTOP_BUILD || '').trim() === 'true'
  const apiProxy = apiBaseUrl
    ? {
        '/api': {
          target: apiBaseUrl,
          changeOrigin: true,
          secure: true,
        },
      }
    : undefined

  return {
    base: isDesktopBuild ? './' : '/',
    plugins: [
      react({
        babel: {
          plugins: [],
        },
      }),
      !isDesktopBuild && VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        includeAssets: [
          'pwa/apple-touch-icon.png',
          'pwa/icon-192.png',
          'pwa/icon-512.png',
          'pwa/maskable-512.png',
        ],
        manifest: {
          id: '/?source=pwa',
          name: 'Stocky POS',
          short_name: 'Stocky',
          description: 'Sistema POS para restaurantes y bares',
          theme_color: '#6d28d9',
          background_color: '#f8f5ff',
          display: 'standalone',
          lang: 'es',
          scope: '/',
          start_url: '/?source=pwa',
          icons: [
            {
              src: '/pwa/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/pwa/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/pwa/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          importScripts: ['pwa/sw-push.js'],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg}'],
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.supabase\.co\/.*$/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'supabase-runtime',
                networkTimeoutSeconds: 8,
                expiration: {
                  maxEntries: 40,
                  maxAgeSeconds: 60 * 60,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/www\.stockypos\.app\/api\/.*$/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-runtime',
                networkTimeoutSeconds: 8,
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      include: ['lucide-react', 'react', 'react-dom', 'react-router-dom'],
      // PGlite usa import.meta.url para cargar pglite.data; si Vite lo prebundlea
      // puede romper la ruta del bundle y caer en "Invalid FS bundle size".
      exclude: ['@electric-sql/pglite'],
      esbuildOptions: {
        target: 'es2020',
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      sourcemap: false,
      minify: 'terser',
      target: 'es2020',
      rollupOptions: {
        onwarn(warning, warn) {
          const message = String(warning?.message || '')
          const id = String(warning?.id || '')
          const code = String(warning?.code || '')

          // Known upstream browser-build noise from @electric-sql/pglite:
          // - Dynamic NodeFS path in a browser target
          // - internal eval emitted by wasm runtime bundle
          if (
            id.includes('@electric-sql/pglite/dist/fs/nodefs.js')
            || (code === 'EVAL' && id.includes('@electric-sql/pglite/dist/index.js'))
            || (id.includes('@electric-sql/pglite/dist/fs/nodefs.js') && message.includes('__vite-browser-external'))
          ) {
            return
          }

          warn(warning)
        },
      },
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
    },
    server: {
      port: 5173,
      strictPort: false,
      proxy: apiProxy,
    },
    preview: {
      port: 4173,
      strictPort: false,
      proxy: apiProxy,
    },
  }
})
