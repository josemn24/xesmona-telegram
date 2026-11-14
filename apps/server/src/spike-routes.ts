// Phase 0 spike: remove in Phase 1.
// Lets the Mini App check that the initData Telegram gives it (opened from a group via a
// direct link) is verifiable on the server. Results go in docs/spikes/phase-0-results.md.
import { InitDataError, validateInitData } from '@xesmona/telegram-auth';
import { Hono } from 'hono';

export interface SpikeBot {
  id: string;
  token: string;
}

export function spikeRoutes(bots: SpikeBot[]) {
  const app = new Hono();

  /** Authorization: tma <initDataRaw>. Optional ?bot=<id>; defaults to the first bot. */
  app.post('/whoami', (c) => {
    const header = c.req.header('authorization') ?? '';
    const [scheme, initData] = header.split(' ', 2);
    if (scheme !== 'tma' || !initData) {
      return c.json({ ok: false, code: 'missing_init_data' }, 401);
    }

    const botId = c.req.query('bot');
    const bot = botId ? bots.find((b) => b.id === botId) : bots[0];
    if (!bot) return c.json({ ok: false, code: 'unknown_bot' }, 404);

    try {
      const data = validateInitData(initData, bot.token);
      console.log(`[spike] whoami ok (bot ${bot.id})`, {
        userId: data.user.id,
        startParam: data.startParam,
        chatType: data.chatType,
        chatInstance: data.chatInstance,
        authDate: data.authDate.toISOString(),
      });
      return c.json({ ok: true, bot: bot.id, ...data });
    } catch (error) {
      if (error instanceof InitDataError) {
        console.warn(`[spike] whoami rejected (bot ${bot.id}): ${error.code}`);
        return c.json({ ok: false, code: error.code }, 401);
      }
      throw error;
    }
  });

  return app;
}
