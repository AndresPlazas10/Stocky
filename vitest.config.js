import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./testing/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}', 'testing/*.vitest.{js,jsx}'],
    exclude: ['node_modules', 'dist', 'testing/k6', 'testing/sql', 'testing/perf'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/main.jsx', 'src/**/*.test.*', 'src/**/*.spec.*'],
    },
    css: false,
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_APP_URL: 'http://localhost:5173',
      VITE_ENABLE_OFFLINE_SNAPSHOT: 'true',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
