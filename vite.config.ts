import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@core': path.resolve(__dirname, './src/core'),
      '@scenes': path.resolve(__dirname, './src/scenes'),
      '@systems': path.resolve(__dirname, './src/systems'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@entities': path.resolve(__dirname, './src/entities'),
      '@data': path.resolve(__dirname, './src/data'),
      '@assets': path.resolve(__dirname, './assets'),
    },
  },
  server: {
    port: 3000,
    open: true,
    watch: { ignored: ['**/src-tauri/**','**/android/**'] },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});

