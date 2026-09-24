import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy only needed for optional Ruby trace (backend not required for CFG)
    proxy: {
      '/api/trace': 'http://localhost:3001',
      '/api/health': 'http://localhost:3001',
    },
  },
  // Allow Vite to serve .wasm files from public/
  assetsInclude: ['**/*.wasm'],
});
