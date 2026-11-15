// Inline keyboards and callback_data (format in ADR 0006).
import { InlineKeyboard } from 'grammy';
import { BOT_LEVELS, type BotLevel } from './ai';
import { markOf, outcome, startingSeat } from './engine';
import type { Game } from './store';

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

/** Game ids travel as 32 hex chars (a UUID without dashes). */
export const toHex = (id: string) => id.replaceAll('-', '');

export function fromHex(hex: string): string {
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const LEVEL_CODES: Record<BotLevel, string> = { easy: 'e', normal: 'n', hard: 'h' };
export const LEVEL_BY_CODE: Record<string, BotLevel> = { e: 'easy', n: 'normal', h: 'hard' };
const LEVEL_LABELS: Record<BotLevel, string> = {
  easy: '🙂 Easy',
  normal: '😐 Normal',
  hard: '😈 Hard',
};

export const MARK_EMOJI = { X: '❌', O: '⭕' } as const;

/** Waiting invitation from /play. */
export function invitationKeyboard(game: Game): InlineKeyboard {
  const id = toHex(game.id);
  return new InlineKeyboard()
    .text('✋ Join', callbackData('ttj', id, game.version))
    .text('🤖 Play vs bot', callbackData('ttb', id, game.version));
}

export function levelKeyboard(game: Game): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const level of BOT_LEVELS) {
    keyboard.text(
      LEVEL_LABELS[level],
      callbackData('ttl', toHex(game.id), LEVEL_CODES[level], game.version),
    );
  }
  return keyboard;
}

/**
 * Inline messages have no game until the first tap (ADR 0006), so their buttons carry the
 * creator's Telegram id instead of a game id.
 */
export function inlineInvitationKeyboard(creatorId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✋ Join', callbackData('tti', 'j', creatorId))
    .text('🤖 Play vs bot', callbackData('tti', 'b', creatorId));
}

export function inlineLevelKeyboard(creatorId: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const level of BOT_LEVELS) {
    keyboard.text(LEVEL_LABELS[level], callbackData('tti', LEVEL_CODES[level], creatorId));
  }
  return keyboard;
}

export function boardKeyboard(game: Game): InlineKeyboard {
  const starting = startingSeat(game.mode ?? 'pvp', game.round);
  const keyboard = new InlineKeyboard();
  game.state.cells.forEach((seat, cell) => {
    const label = seat === null ? '·' : MARK_EMOJI[markOf(seat, starting)];
    keyboard.text(label, callbackData('ttt', toHex(game.id), cell, game.version));
    if (cell % 3 === 2) keyboard.row();
  });
  if (outcome(game.state)) {
    keyboard.text('🔁 Rematch', callbackData('ttr', toHex(game.id), game.version));
  }
  return keyboard;
}
