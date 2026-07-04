import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0 so it works inside Docker
    port: 5173,
    proxy: {
      // Forward API calls to the backend during development.
      // In Docker (dev compose) the backend is reachable at http://backend:3000.
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
