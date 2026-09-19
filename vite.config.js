// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const basePath = process.env.BASE_PATH || '/';
  
  return {
    root: '.',
    base: basePath,
    server: {
      port: 8765,
      open: true,
      // O front chama /api na mesma origem (em produção quem resolve é o
      // nginx). No dev server isso cairia no próprio Vite, então encaminha
      // para o PHP embutido — `npm run dev:api`.
      proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: true } }
    },
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
      setupFiles: ['src/tests/setup.js'],
      include: ['src/tests/**/*.test.js'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html']
      }
    }
  };
});
