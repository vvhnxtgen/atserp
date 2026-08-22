import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// In dev, /api and /media are proxied to the Django server on :8000
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/media': 'http://127.0.0.1:8000',
    },
  },
});
