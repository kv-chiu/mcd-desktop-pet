import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_BACKEND_PORT = 23301;
const backendPort = process.env.MCD_PORT || process.env.MCD_SERVER_PORT || DEFAULT_BACKEND_PORT;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    strictPort: false,
    proxy: {
      '/api': {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
});
