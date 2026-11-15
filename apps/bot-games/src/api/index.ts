// HTTP API of the games bot's Mini App, mounted by the server at /api/games (ADR 0009).
import type { BotEnv, BotServices } from '@xesmona/contracts';
import type { ApiErrorCode, SessionResponse } from '@xesmona/games/api';
import type { Bot } from 'grammy';
import { Hono } from 'hono';
import { fourInARowApi } from '../four-in-a-row/api';
import { upsertUser } from '../games/store';
import { tmaAuth, type AuthEnv } from './auth';
import { signPlayerJwt } from './session';

export function gamesApi(bot: Bot, config: BotEnv, { db, realtime }: BotServices) {
  const app = new Hono<AuthEnv>();
  app.use('*', tmaAuth(config.TOKEN));

  // Opening the Mini App: remember the player and hand out a Realtime token.
  app.post('/session', async (c) => {
    const { user, initData } = c.var;
    // M6 (Phase 0): does every user get the same chat_instance for the same group?
    console.log('[games] session', {
      userId: user.id,
      startParam: initData.startParam,
      chatType: initData.chatType,
      chatInstance: initData.chatInstance,
    });
    await upsertUser(db, user);
    if (!realtime) return c.json({ code: 'realtime_unavailable' satisfies ApiErrorCode }, 503);
    const { token, expiresAt } = signPlayerJwt(user.id, realtime.jwtSecret);
    return c.json({
      supabaseUrl: realtime.supabaseUrl,
      publishableKey: realtime.publishableKey,
      token,
      expiresAt,
    } satisfies SessionResponse);
  });

  app.route('/four-in-a-row', fourInARowApi(db, bot.api, config.MINIAPP_URL));
  // The server mounts a plain Hono app; the auth variables stay inside.
  return new Hono().route('/', app);
}
