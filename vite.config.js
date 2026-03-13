import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiBaseUrl = String(env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
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
    plugins: [
      react({
        babel: {
          plugins: [],
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
