/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      // trailing slash: must not swallow the SPA route /api-logs
      '/api/': { target: 'http://localhost:5080', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          ui: ['radix-ui', 'cmdk', 'sonner', 'lucide-react', 'react-day-picker', 'next-themes'],
          charts: ['recharts'],
          vendor: ['@tanstack/react-query', '@tanstack/react-table', 'axios', 'zustand', 'react-hook-form', 'zod', 'dayjs'],
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
