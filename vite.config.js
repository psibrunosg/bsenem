// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  server: { port: 8765, open: true },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: { vendor: ['lucide'] }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@styles': '/src/assets/styles',
      '@components': '/src/components',
      '@pages': '/src/pages',
      '@services': '/src/services',
      '@utils': '/src/utils'
    }
  },
  css: { devSourcemap: true }
});