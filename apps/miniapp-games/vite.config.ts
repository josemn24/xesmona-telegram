/// <reference types="node" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3000';
// Local Supabase, for Realtime through the tunnel (see src/realtime.ts).
const supabaseUrl = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';

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
      // Inside Telegram the page comes through the HTTPS tunnel, so it can't reach Supabase
      // at 127.0.0.1 (a phone's own loopback, or mixed content on desktop): the Realtime
      // WebSocket goes through the tunnel too.
      '/realtime/v1': { target: supabaseUrl, ws: true, changeOrigin: true },
    },
  },
});
