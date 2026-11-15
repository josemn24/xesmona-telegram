// Supabase JWT for a Mini App player, used only to subscribe to Realtime (ADR 0009).
// HS256 with the project's JWT secret: Supabase verifies it like its own tokens, and RLS on
// realtime.messages reads `sub` (the Telegram user id).
import { createHmac } from 'node:crypto';

export const SESSION_TTL_SECONDS = 60 * 60;

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function signPlayerJwt(
  telegramUserId: number,
  secret: string,
  now: Date = new Date(),
): { token: string; expiresAt: number } {
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + SESSION_TTL_SECONDS;
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    role: 'authenticated',
    aud: 'authenticated',
    sub: String(telegramUserId),
    iat,
    exp,
  })}`;
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return { token: `${body}.${signature}`, expiresAt: exp };
}
