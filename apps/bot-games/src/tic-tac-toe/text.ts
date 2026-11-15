// User-facing texts (English for now; i18n will use Telegram's language_code).
import { markOf, outcome, startingSeat, type Seat } from '@xesmona/games/tic-tac-toe';
import { InlineKeyboard } from 'grammy';
import { LEVEL_NAMES } from '../games/callback';
import type { GameView } from '../games/render';
import { MARK_EMOJI, boardKeyboard, invitationKeyboard } from './keyboard';
import type { Game } from './store';

export const invitationText = (name: string) =>
  `${name} wants to play tic-tac-toe. Who's in?\n\nOr play against the bot.`;

export const EXPIRED_INVITATION_TEXT =
  'This tic-tac-toe invitation expired: nobody joined. Send /play for a new one.';

export const levelText = (name: string) =>
  `${name} is playing tic-tac-toe vs the bot.\nPick a level:`;

export function boardText(game: Game): string {
  const starting = startingSeat(game.mode ?? 'pvp', game.round);
  const label = (seat: Seat) => {
    const player = game.players.find((p) => p.seat === seat);
    const name = player?.displayName ?? '…';
    const level = player?.kind === 'bot' && game.botLevel ? ` (${LEVEL_NAMES[game.botLevel]})` : '';
    return `${MARK_EMOJI[markOf(seat, starting)]} ${name}${level}`;
  };
  const round = game.round > 0 ? ` · round ${game.round + 1}` : '';
  const header = `${label(starting)} vs ${label(starting === 0 ? 1 : 0)}${round}`;

  if (game.status === 'expired') return `${header}\n\nThis game expired: nobody played for a week.`;
  const result = outcome(game.state);
  if (result === 'draw') return `${header}\n\nDraw! 🤝`;
  if (result) {
    const winner = game.players.find((p) => p.seat === result.winner);
    return winner?.kind === 'bot'
      ? `${header}\n\nThe bot wins! 🤖`
      : `${header}\n\n${winner?.displayName ?? '?'} wins! 🎉`;
  }
  return `${header}\n\nTurn: ${label(game.state.turn)}`;
}

/** The game's chat message for its current state (also used by the render worker). */
export function gameView(game: Game): GameView {
  if (game.status === 'waiting') {
    return {
      text: invitationText(game.players[0]?.displayName ?? '?'),
      keyboard: invitationKeyboard(game),
    };
  }
  if (game.status === 'expired' && game.mode === null) {
    return { text: EXPIRED_INVITATION_TEXT, keyboard: new InlineKeyboard() };
  }
  return { text: boardText(game), keyboard: boardKeyboard(game) };
}
