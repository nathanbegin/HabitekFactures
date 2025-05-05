// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  css: {
    postcss: './postcss.config.cjs'
  },
  server: {
    open: true,
    port: 5173,
    hmr: {
      // passe à false pour désactiver l'overlay d'erreur si besoin
      overlay: true
    }
  }
});
