import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',   // relative paths — required for CrazyGames / itch.io / any iframe host
  resolve: {
    alias: {
      '@yggdrasil/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
});
