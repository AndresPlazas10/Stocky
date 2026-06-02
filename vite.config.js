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
                  maxEntries: 10,
                  maxAgeSeconds: 60,
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
                  maxEntries: 10,
                  maxAgeSeconds: 60,
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
      esbuildOptions: {
        target: 'es2020',
      },
    },
    build: {
      chunkSizeWarningLimit: 500,
      sourcemap: 'hidden',
      minify: 'terser',
      target: 'es2020',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-animation': ['framer-motion'],
            'vendor-icons': ['lucide-react'],
            'vendor-supabase': ['@supabase/supabase-js'],
            'vendor-radix': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-avatar'],
          },
        },
        onwarn(warning, warn) {
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
