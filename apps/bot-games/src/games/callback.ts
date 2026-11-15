// callback_data helpers shared by the in-chat parts of every game (format in ADR 0006).
import type { BotLevel } from '@xesmona/games';

/** Telegram's limit for callback_data, in bytes. */
export const CALLBACK_DATA_MAX_BYTES = 64;

/** Builds callback_data and fails loudly if it would exceed Telegram's limit. */
export function callbackData(...parts: (string | number)[]): string {
  const data = parts.join(':');
  const bytes = Buffer.byteLength(data, 'utf8');
  if (bytes > CALLBACK_DATA_MAX_BYTES) {
    throw new Error(`callback_data is ${bytes} bytes (max ${CALLBACK_DATA_MAX_BYTES}): ${data}`);
  }
  return data;
}

/** Game ids travel as 32 hex chars (a UUID without dashes), also in `startapp` (ADR 0007). */
export const toHex = (id: string) => id.replaceAll('-', '');

export function fromHex(hex: string): string {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const LEVEL_CODES: Record<BotLevel, string> = { easy: 'e', normal: 'n', hard: 'h' };
export const LEVEL_BY_CODE: Record<string, BotLevel> = { e: 'easy', n: 'normal', h: 'hard' };
export const LEVEL_LABELS: Record<BotLevel, string> = {
  easy: '🙂 Easy',
  normal: '😐 Normal',
  hard: '😈 Hard',
};
export const LEVEL_NAMES: Record<BotLevel, string> = {
  easy: 'Easy',
  normal: 'Normal',
  hard: 'Hard',
};
