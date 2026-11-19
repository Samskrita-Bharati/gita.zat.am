import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const gameDirectory = fileURLToPath(new URL('.', import.meta.url));
const portalDirectory = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig({
  root: portalDirectory,
  cacheDir: `${gameDirectory}node_modules/.vite`,
  publicDir: `${gameDirectory}public`,
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      react: `${gameDirectory}node_modules/react`,
      'react-dom': `${gameDirectory}node_modules/react-dom`,
    },
  },
  optimizeDeps: { entries: [`${gameDirectory}index.html`] },
  server: { port: 8443, open: '/games/strands/' },
  build: {
    outDir: `${gameDirectory}dist`,
    emptyOutDir: true,
    rollupOptions: {
      input: `${gameDirectory}index.html`,
    },
  },
  preview: { port: 8443, open: '/games/strands/' },
});
