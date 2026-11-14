// Phase 0 spike: remove in Phase 1.
import { InlineKeyboard } from 'grammy';
import { winner, type SpikeGame } from './board';

/** Telegram's limit for callback_data, in bytes. */
export const CALLBACK_DATA_MAX_BYTES = 64;

let longestCallbackData = 0;

/** Builds callback_data and fails loudly if it would exceed Telegram's limit. */
export function callbackData(...parts: (string | number)[]): string {
  const data = parts.join(':');
  const bytes = Buffer.byteLength(data, 'utf8');
  if (bytes > CALLBACK_DATA_MAX_BYTES) {
    throw new Error(`callback_data is ${bytes} bytes (max ${CALLBACK_DATA_MAX_BYTES}): ${data}`);
  }
  if (bytes > longestCallbackData) {
    longestCallbackData = bytes;
    console.log(`[spike] longest callback_data so far: ${bytes} bytes (${data})`);
  }
  return data;
}

export const moveData = (game: SpikeGame, cell: number) =>
  callbackData('ttt', game.id, cell, game.version);
export const joinData = (gameId: string) => callbackData('ttj', gameId);
export const rematchData = (game: SpikeGame) => callbackData('ttr', game.id, game.version);

export function invitationKeyboard(gameId: string): InlineKeyboard {
  return new InlineKeyboard().text('✋ Join', joinData(gameId));
}

export function boardKeyboard(game: SpikeGame): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  game.cells.forEach((cell, i) => {
    keyboard.text(cell === 'X' ? '❌' : cell === 'O' ? '⭕' : '·', moveData(game, i));
    if (i % 3 === 2) keyboard.row();
  });
  if (winner(game.cells)) keyboard.text('🔁 Rematch', rematchData(game));
  return keyboard;
}

export function boardText(game: SpikeGame): string {
  const [x, o] = game.playerNames;
  const header = `❌ ${x} vs ⭕ ${o ?? '…'}  (v${game.version}, round ${game.round + 1})`;
  const result = winner(game.cells);
  if (result === 'draw') return `${header}\nDraw!`;
  if (result) return `${header}\n${result === 'X' ? x : o} wins!`;
  return `${header}\nTurn: ${game.turn === 0 ? `❌ ${x}` : `⭕ ${o}`}`;
}
