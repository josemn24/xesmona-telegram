import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

/**
 * Validación de `initData` de Telegram Mini Apps.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Nunca uses `initDataUnsafe` del cliente para autorizar: valida siempre la cadena
 * original en el servidor con el token del bot que abrió la Mini App.
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
  /** Antigüedad máxima aceptada de `auth_date`, en segundos. Por defecto 1 hora. */
  maxAgeSeconds?: number;
  /** Reloj inyectable para tests. */
  now?: Date;
}

/** Calcula el hash esperado de un conjunto de campos de initData (sin `hash`). */
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
  if (!hash) throw new InitDataError('missing_hash', 'initData no contiene hash');

  const expected = Buffer.from(computeInitDataHash(params, botToken), 'hex');
  const received = Buffer.from(hash, 'hex');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new InitDataError('invalid_hash', 'Firma de initData inválida');
  }

  const authDateSeconds = Number(params.get('auth_date'));
  if (!Number.isInteger(authDateSeconds) || authDateSeconds <= 0) {
    throw new InitDataError('invalid_payload', 'auth_date ausente o inválido');
  }
  if (now.getTime() / 1000 - authDateSeconds > maxAgeSeconds) {
    throw new InitDataError('expired', 'initData caducado');
  }

  let rawUser: unknown;
  try {
    rawUser = JSON.parse(params.get('user') ?? 'null');
  } catch {
    throw new InitDataError('invalid_payload', 'Campo user no es JSON válido');
  }
  const user = telegramUserSchema.safeParse(rawUser);
  if (!user.success) throw new InitDataError('invalid_payload', 'Campo user ausente o inválido');

  return {
    user: user.data,
    authDate: new Date(authDateSeconds * 1000),
    startParam: params.get('start_param') ?? undefined,
    chatType: params.get('chat_type') ?? undefined,
    chatInstance: params.get('chat_instance') ?? undefined,
    queryId: params.get('query_id') ?? undefined,
  };
}
