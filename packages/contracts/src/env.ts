import { z } from 'zod';

/** Variables globales del proceso servidor (compartidas por todos los bots). */
export const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    /** URL pública HTTPS del servidor. Obligatoria en modo webhook. */
    PUBLIC_URL: z.url().optional(),
    BOT_MODE: z.enum(['polling', 'webhook']).default('polling'),
    SUPABASE_URL: z.url().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  })
  .refine((env) => env.BOT_MODE !== 'webhook' || env.PUBLIC_URL, {
    message: 'PUBLIC_URL es obligatoria cuando BOT_MODE=webhook',
    path: ['PUBLIC_URL'],
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/** Variables de un bot concreto, leídas con el prefijo BOT_<ID>_ (p. ej. BOT_GAMES_TOKEN). */
export const botEnvSchema = z.object({
  TOKEN: z.string().regex(/^\d+:[\w-]+$/, 'Token de bot con formato inválido'),
  /** Secreto enviado por Telegram en X-Telegram-Bot-Api-Secret-Token. */
  WEBHOOK_SECRET: z
    .string()
    .regex(/^[\w-]{16,256}$/, 'Entre 16 y 256 caracteres A-Z, a-z, 0-9, _ o -')
    .optional(),
  /** Direct link de la Mini App, p. ej. https://t.me/<bot>/<app>. */
  MINIAPP_URL: z.url().optional(),
});

export type BotEnv = z.infer<typeof botEnvSchema>;

export function botEnvPrefix(botId: string): string {
  return `BOT_${botId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_`;
}

export function readBotEnv(botId: string, env: Record<string, string | undefined>): BotEnv {
  const prefix = botEnvPrefix(botId);
  const scoped = Object.fromEntries(
    Object.entries(env)
      .filter(([key, value]) => key.startsWith(prefix) && value !== '')
      .map(([key, value]) => [key.slice(prefix.length), value]),
  );
  const result = botEnvSchema.safeParse(scoped);
  if (!result.success) {
    throw new Error(
      `Configuración inválida para el bot "${botId}" (${prefix}*):\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}
