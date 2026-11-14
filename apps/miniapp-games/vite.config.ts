/// <reference types="node" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3000';

export default defineConfig({
  // Servida por apps/server en /apps/games/ (un único servicio en Railway).
  base: '/apps/games/',
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.PORT) || 5173,
    // Permite abrir la Mini App a través de un túnel HTTPS (cloudflared, ngrok…).
    allowedHosts: true,
    proxy: {
      '/health': serverUrl,
      '/api': serverUrl,
    },
  },
});
