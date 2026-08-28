// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const basePath = process.env.BASE_PATH || '/';
  
  return {
    root: '.',
    base: basePath,
    server: { port: 8765, open: true },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      minify: 'esbuild'
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
    css: { devSourcemap: true },
    test: {
      globals: true,
      environment: 'jsdom',
      include: ['src/tests/**/*.test.js'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html']
      }
    }
  };
});
