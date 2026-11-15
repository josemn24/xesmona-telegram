// Mini App requests carry the raw initData (`Authorization: tma <initData>`, ADR 0007). It's
// validated on every request with the token of the bot that opened the Mini App; the client's
// initDataUnsafe is never used.
import {
  InitDataError,
  validateInitData,
  type TelegramUser,
  type ValidatedInitData,
} from '@xesmona/telegram-auth';
import { createMiddleware } from 'hono/factory';

/**
 * Accepted initData age. Telegram signs it once, when the Mini App opens, so a long session
 * (refreshing its Realtime token every hour) still needs it.
 */
export const INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;

export interface AuthEnv {
  Variables: { user: TelegramUser; initData: ValidatedInitData };
}

export const tmaAuth = (botToken: string) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const header = c.req.header('authorization') ?? '';
    const [scheme, raw] = header.split(' ', 2);
    if (scheme !== 'tma' || !raw) return c.json({ code: 'missing_init_data' }, 401);
    try {
      const initData = validateInitData(raw, botToken, {
        maxAgeSeconds: INIT_DATA_MAX_AGE_SECONDS,
      });
      c.set('initData', initData);
      c.set('user', initData.user);
    } catch (error) {
      if (error instanceof InitDataError) return c.json({ code: error.code }, 401);
      throw error;
    }
    await next();
  });
