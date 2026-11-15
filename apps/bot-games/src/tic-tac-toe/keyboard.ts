// Inline keyboards and callback_data (format in ADR 0006).
import { InlineKeyboard } from 'grammy';
import { BOT_LEVELS, markOf, outcome, startingSeat } from '@xesmona/games/tic-tac-toe';
import { LEVEL_CODES, LEVEL_LABELS, callbackData, toHex } from '../games/callback';
import type { Game } from './store';

export {
  CALLBACK_DATA_MAX_BYTES,
  LEVEL_BY_CODE,
  LEVEL_CODES,
  callbackData,
  fromHex,
  toHex,
} from '../games/callback';

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
