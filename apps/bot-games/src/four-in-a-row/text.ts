// User-facing texts (English for now; i18n will use Telegram's language_code).
import { startingSeat, type Seat } from '@xesmona/games';
import type { State } from '@xesmona/games/four-in-a-row';
import { LEVEL_NAMES } from '../games/callback';
import type { Game } from '../games/store';

/** The seat that starts the round plays red. */
export const discOf = (seat: Seat, starting: Seat) => (seat === starting ? '🔴' : '🟡');

export const invitationText = (name: string) =>
  `${name} wants to play Four in a row. Who's in?\n\nOr play against the bot.`;

export const levelText = (name: string) =>
  `${name} is playing Four in a row vs the bot.\nPick a level:`;

export const NO_MINI_APP =
  'Four in a row is played in the Mini App, which is not set up for this bot yet.';

/** The game message in the chat: players, whose turn it is or the result. */
export function gameText(game: Game<State>): string {
  const starting = startingSeat(game.mode ?? 'pvp', game.round);
  const label = (seat: Seat) => {
    const player = game.players.find((p) => p.seat === seat);
    const name = player?.displayName ?? '…';
    const level = player?.kind === 'bot' && game.botLevel ? ` (${LEVEL_NAMES[game.botLevel]})` : '';
    return `${discOf(seat, starting)} ${name}${level}`;
  };
  const round = game.round > 0 ? ` · round ${game.round + 1}` : '';
  const header = `Four in a row\n${label(starting)} vs ${label(starting === 0 ? 1 : 0)}${round}`;

  if (game.status === 'finished') {
    if (game.result === 'draw') return `${header}\n\nDraw! 🤝`;
    const winner = game.players.find((p) => p.seat === game.winnerSeat);
    return winner?.kind === 'bot'
      ? `${header}\n\nThe bot wins! 🤖`
      : `${header}\n\n${winner?.displayName ?? '?'} wins! 🎉`;
  }
  // Moves happen in the Mini App; the chat message isn't edited per move (ADR 0008).
  return `${header}\n\nThe game is on: open it to play.`;
}
