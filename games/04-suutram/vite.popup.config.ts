import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
    plugins: [react()],

        define: {
        'process.env.NODE_ENV': JSON.stringify('production')
    },
    build: {
        outDir: fileURLToPath(
            new URL('../shared/popup-built/', import.meta.url)
        ),

        emptyOutDir: false,

        lib: {
            entry: fileURLToPath(
                new URL('./src/score-popup.tsx', import.meta.url)
            ),
            formats: ['es'],
            fileName: () => 'score-popup.js'
        }
    }
});