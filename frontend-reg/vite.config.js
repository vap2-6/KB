import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/register/',
  plugins: [react()],
  server: {
    port: 5176,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5050',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://127.0.0.1:5050',
        changeOrigin: true
      },
      '/generated_pdfs': {
        target: 'http://127.0.0.1:5050',
        changeOrigin: true
      }
    }
  }
});
