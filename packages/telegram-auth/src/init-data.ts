import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

/**
 * Validation of Telegram Mini Apps `initData`.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Never use the client's `initDataUnsafe` for authorization: always validate the
 * original string on the server with the token of the bot that opened the Mini App.
 */

export const telegramUserSchema = z.object({
  id: z.number().int(),
  first_name: z.string(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  language_code: z.string().optional(),
  is_premium: z.boolean().optional(),
  is_bot: z.boolean().optional(),
  photo_url: z.string().optional(),
  allows_write_to_pm: z.boolean().optional(),
});

export type TelegramUser = z.infer<typeof telegramUserSchema>;

export interface ValidatedInitData {
  user: TelegramUser;
  authDate: Date;
  startParam: string | undefined;
  chatType: string | undefined;
  chatInstance: string | undefined;
  queryId: string | undefined;
}

export type InitDataErrorCode = 'missing_hash' | 'invalid_hash' | 'expired' | 'invalid_payload';

export class InitDataError extends Error {
  constructor(
    public readonly code: InitDataErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'InitDataError';
  }
}

export interface ValidateInitDataOptions {
  /** Maximum accepted age of `auth_date`, in seconds. Defaults to 1 hour. */
  maxAgeSeconds?: number;
  /** Injectable clock for tests. */
  now?: Date;
}

/** Computes the expected hash for a set of initData fields (excluding `hash`). */
export function computeInitDataHash(params: URLSearchParams, botToken: string): string {
  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  return createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
}

export function validateInitData(
  initData: string,
  botToken: string,
  { maxAgeSeconds = 3600, now = new Date() }: ValidateInitDataOptions = {},
): ValidatedInitData {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new InitDataError('missing_hash', 'initData has no hash');

  const expected = Buffer.from(computeInitDataHash(params, botToken), 'hex');
  const received = Buffer.from(hash, 'hex');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new InitDataError('invalid_hash', 'Invalid initData signature');
  }

  const authDateSeconds = Number(params.get('auth_date'));
  if (!Number.isInteger(authDateSeconds) || authDateSeconds <= 0) {
    throw new InitDataError('invalid_payload', 'auth_date missing or invalid');
  }
  if (now.getTime() / 1000 - authDateSeconds > maxAgeSeconds) {
    throw new InitDataError('expired', 'initData expired');
  }

  let rawUser: unknown;
  try {
    rawUser = JSON.parse(params.get('user') ?? 'null');
  } catch {
    throw new InitDataError('invalid_payload', 'user field is not valid JSON');
  }
  const user = telegramUserSchema.safeParse(rawUser);
  if (!user.success) throw new InitDataError('invalid_payload', 'user field missing or invalid');

  return {
    user: user.data,
    authDate: new Date(authDateSeconds * 1000),
    startParam: params.get('start_param') ?? undefined,
    chatType: params.get('chat_type') ?? undefined,
    chatInstance: params.get('chat_instance') ?? undefined,
    queryId: params.get('query_id') ?? undefined,
  };
}
