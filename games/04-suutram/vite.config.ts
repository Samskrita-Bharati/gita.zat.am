import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const gameDirectory = fileURLToPath(new URL('.', import.meta.url));
const devEntry = '/games/04-suutram/index.dev.html';
const portalDirectory = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  root: portalDirectory,
  cacheDir: `${gameDirectory}node_modules/.vite`,
  publicDir: `${gameDirectory}public`,
  plugins: [
    react(),
    {
      name: 'strands-development-entry',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const url = new URL(req.url ?? '/', 'http://localhost');
          if (['/games/04-suutram', '/games/04-suutram/', '/games/04-suutram/index.html'].includes(url.pathname)) {
            req.url = devEntry + url.search;
          }
          next();
        });
      },
    },
  ],
  base: './',
  resolve: {
    alias: {
      react: `${gameDirectory}node_modules/react`,
      'react-dom': `${gameDirectory}node_modules/react-dom`,
    },
  },
  optimizeDeps: { entries: [`${gameDirectory}index.dev.html`] },
  server: { port: 8443, open: '/games/04-suutram/' },
  build: {
    outDir: `${gameDirectory}dist`,
    emptyOutDir: true,
    assetsDir: 'games/04-suutram/built',
    rollupOptions: {
      input: `${gameDirectory}index.dev.html`,
    },
  },
  preview: { port: 8443, open: '/games/04-suutram/' },
});
