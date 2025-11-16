import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    include: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Evitar referencias circulares separando vendors de forma más granular
          if (id.includes('node_modules')) {
            // React core - crítico mantener junto
            if (id.includes('react/') || id.includes('react-dom/') || id.includes('react-router')) {
              return 'react-vendor';
            }
            // Supabase - separado por tamaño
            if (id.includes('@supabase')) {
              return 'supabase-vendor';
            }
            // lucide-react - separado para evitar tree-shaking issues
            if (id.includes('lucide-react')) {
              return 'lucide-vendor';
            }
            // framer-motion - animaciones
            if (id.includes('framer-motion')) {
              return 'framer-vendor';
            }
            // Radix UI - componentes
            if (id.includes('@radix-ui')) {
              return 'radix-vendor';
            }
            // Otros vendors en chunk separado
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
    sourcemap: false,
    minify: 'esbuild',
    target: 'esnext',
    modulePreload: {
      polyfill: false,
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  preview: {
    port: 4173,
    strictPort: false,
  },
})
