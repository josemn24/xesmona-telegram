import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { webhookCallback } from 'grammy';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { createBots } from './bots';
import { loadEnv } from './env';

const env = loadEnv();
const bots = createBots(process.env);
const app = new Hono();

app.use(logger());

app.get('/health', (c) => c.json({ ok: true, mode: env.BOT_MODE, bots: bots.map((b) => b.id) }));

// Webhooks: una ruta por bot. grammY valida X-Telegram-Bot-Api-Secret-Token.
if (env.BOT_MODE === 'webhook') {
  for (const { id, bot, config } of bots) {
    if (!config.WEBHOOK_SECRET) {
      console.error(`[bots] BOT_${id.toUpperCase()}_WEBHOOK_SECRET es obligatorio en modo webhook`);
      process.exit(1);
    }
    app.post(
      `/webhook/${id}`,
      webhookCallback(bot, 'hono', { secretToken: config.WEBHOOK_SECRET }),
    );
  }
}

// Mini Apps estáticas (build de Vite). En desarrollo se usa el servidor de Vite.
const miniApps = { games: '../../miniapp-games/dist' } as const;
for (const [name, relative] of Object.entries(miniApps)) {
  const dir = fileURLToPath(new URL(relative, import.meta.url));
  if (!existsSync(dir)) continue;
  const root = path.relative(process.cwd(), dir);
  const prefix = `/apps/${name}`;
  app.use(
    `${prefix}/*`,
    serveStatic({ root, rewriteRequestPath: (p) => p.slice(prefix.length) || '/' }),
  );
  app.get(`${prefix}/*`, serveStatic({ root, path: 'index.html' })); // fallback SPA
}

const server = serve({ fetch: app.fetch, port: env.PORT }, ({ port }) => {
  console.log(`[server] escuchando en http://localhost:${port} (modo ${env.BOT_MODE})`);
});

for (const { id, bot, config } of bots) {
  if (env.BOT_MODE === 'polling') {
    void bot.start({ onStart: (me) => console.log(`[bot:${id}] @${me.username} en long polling`) });
  } else {
    const url = `${env.PUBLIC_URL}/webhook/${id}`;
    await bot.api.setWebhook(url, { secret_token: config.WEBHOOK_SECRET ?? '' });
    console.log(`[bot:${id}] webhook registrado en ${url}`);
  }
}

async function shutdown(signal: string) {
  console.log(`[server] ${signal} recibido, cerrando…`);
  await Promise.all(bots.map(({ bot }) => (bot.isRunning() ? bot.stop() : undefined)));
  server.close(() => process.exit(0));
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
