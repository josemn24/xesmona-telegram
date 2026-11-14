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

// Webhooks: one route per bot. grammY validates X-Telegram-Bot-Api-Secret-Token.
if (env.BOT_MODE === 'webhook') {
  for (const { id, bot, config } of bots) {
    if (!config.WEBHOOK_SECRET) {
      console.error(`[bots] BOT_${id.toUpperCase()}_WEBHOOK_SECRET is required in webhook mode`);
      process.exit(1);
    }
    app.post(
      `/webhook/${id}`,
      webhookCallback(bot, 'hono', { secretToken: config.WEBHOOK_SECRET }),
    );
  }
}

// Static Mini Apps (Vite build). In development the Vite dev server is used.
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
  console.log(`[server] listening on http://localhost:${port} (${env.BOT_MODE} mode)`);
});

for (const { id, bot, config } of bots) {
  if (env.BOT_MODE === 'polling') {
    void bot.start({
      onStart: (me) => console.log(`[bot:${id}] @${me.username} running in long polling`),
    });
  } else {
    const url = `${env.PUBLIC_URL}/webhook/${id}`;
    await bot.api.setWebhook(url, { secret_token: config.WEBHOOK_SECRET ?? '' });
    console.log(`[bot:${id}] webhook registered at ${url}`);
  }
}

async function shutdown(signal: string) {
  console.log(`[server] ${signal} received, shutting down…`);
  await Promise.all(bots.map(({ bot }) => (bot.isRunning() ? bot.stop() : undefined)));
  server.close(() => process.exit(0));
}
process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
