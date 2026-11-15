// Inline keyboards for Four in a row in the chat. Joining happens here (ADR 0006); the game is
// played in the Mini App, opened with a `url` button and the direct link (ADR 0007).
import { BOT_LEVELS } from '@xesmona/games';
import type { State } from '@xesmona/games/four-in-a-row';
import { InlineKeyboard } from 'grammy';
import { LEVEL_CODES, LEVEL_LABELS, callbackData, toHex } from '../games/callback';
import type { Game } from '../games/store';

/** Direct link that opens this game in the Mini App (`startapp` = game id, ADR 0007). */
export const gameLink = (miniAppUrl: string, gameId: string) =>
  `${miniAppUrl}?startapp=${toHex(gameId)}`;

/** Waiting invitation from /four. */
export function invitationKeyboard(game: Game<State>): InlineKeyboard {
  const id = toHex(game.id);
  return new InlineKeyboard()
    .text('✋ Join', callbackData('c4j', id, game.version))
    .text('🤖 Play vs bot', callbackData('c4b', id, game.version));
}

export function levelKeyboard(game: Game<State>): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const level of BOT_LEVELS) {
    keyboard.text(
      LEVEL_LABELS[level],
      callbackData('c4l', toHex(game.id), LEVEL_CODES[level], game.version),
    );
  }
  return keyboard;
}

/** Inline messages have no game until the first tap (ADR 0006): buttons carry the creator. */
export function inlineInvitationKeyboard(creatorId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text('✋ Join', callbackData('c4i', 'j', creatorId))
    .text('🤖 Play vs bot', callbackData('c4i', 'b', creatorId));
}

export function inlineLevelKeyboard(creatorId: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const level of BOT_LEVELS) {
    keyboard.text(LEVEL_LABELS[level], callbackData('c4i', LEVEL_CODES[level], creatorId));
  }
  return keyboard;
}

/** A started game: open it in the Mini App; once finished, also a rematch. */
export function gameKeyboard(game: Game<State>, miniAppUrl: string): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  if (game.status === 'finished') {
    keyboard.text('🔁 Rematch', callbackData('c4r', toHex(game.id), game.version)).row();
  }
  return keyboard.url(
    game.status === 'finished' ? '🎮 See the board' : '🎮 Open game',
    gameLink(miniAppUrl, game.id),
  );
}
