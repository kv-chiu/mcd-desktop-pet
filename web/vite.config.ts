import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8080,
    proxy: {
      '/mcp': {
        target: 'https://mcp.mcd.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/mcp/, '/mcp-servers/mcd-mcp'),
        secure: true,
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
