/// <reference types="node" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3000';

export default defineConfig({
  // Served by apps/server at /apps/games/ (a single service on Railway).
  base: '/apps/games/',
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.PORT) || 5173,
    // Allows opening the Mini App through an HTTPS tunnel (cloudflared, ngrok…).
    allowedHosts: true,
    proxy: {
      '/health': serverUrl,
      '/api': serverUrl,
    },
  },
});
