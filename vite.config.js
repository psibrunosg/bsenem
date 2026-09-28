// vite.config.js
import { defineConfig } from 'vite';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';

export default defineConfig(() => {
  const basePath = process.env.BASE_PATH || '/';
  
  const questionAssetRoot = resolve('content/enem');
  const questionAssetPlugin = {
    name: 'bsestudos-question-assets',
    configureServer(server) {
      server.middlewares.use('/question-assets/enem', (req, res, next) => {
        const relative = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '');
        const file = resolve(questionAssetRoot, relative);
        if (file !== questionAssetRoot && !file.startsWith(questionAssetRoot + sep)) {
          res.statusCode = 403;
          res.end('Forbidden');
          return;
        }
        if (!existsSync(file) || !statSync(file).isFile()) return next();
        const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[extname(file).toLowerCase()];
        if (mime) res.setHeader('Content-Type', mime);
        createReadStream(file).pipe(res);
      });
    }
  };

  return {
    root: '.',
    plugins: [questionAssetPlugin],
    base: basePath,
    server: {
      port: 8765,
      open: true,
      // Keep Vite's experimental agent console forwarding disabled. Explicit
      // configuration also prevents an unresolved client placeholder in Vite 8.
      forwardConsole: false,
      // O front chama /api na mesma origem (em produção quem resolve é o
      // nginx). No dev server isso cairia no próprio Vite, então encaminha
      // para o PHP embutido — `npm run dev:api`.
      // Preserve the browser-facing Host header so the API's same-origin
      // protection can validate requests exactly as they arrived at Vite.
      proxy: { '/api': { target: 'http://localhost:8000', changeOrigin: false } }
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false
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
