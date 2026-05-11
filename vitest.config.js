import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./testing/setup.js'],
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}', 'testing/cambio.test.js', 'testing/formatters.test.js', 'testing/receiptTemplate.test.js', 'testing/printTemplates.test.js'],
    exclude: ['node_modules', 'dist', 'testing/k6', 'testing/sql', 'testing/perf'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/main.jsx', 'src/**/*.test.*', 'src/**/*.spec.*'],
    },
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
