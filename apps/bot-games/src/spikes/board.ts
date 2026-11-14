// Phase 0 spike: remove in Phase 1.
// In-memory tic-tac-toe used only to test Telegram behaviour (keyboards, edits, inline mode).
import { randomUUID } from 'node:crypto';

export type Mark = 'X' | 'O';
export type Cell = Mark | null;

export interface SpikeGame {
  id: string;
  /** Telegram user ids; index 0 plays X, index 1 plays O. */
  players: [number, number | undefined];
  playerNames: [string, string | undefined];
  cells: Cell[];
  /** Index into `players` of whoever moves next. */
  turn: 0 | 1;
  /** Incremented on every accepted change; travels in callback_data. */
  version: number;
  /** Number of rematches played, to measure callback_data growth. */
  round: number;
}

export type MoveResult =
  | { ok: true; game: SpikeGame }
  | { ok: false; reason: 'not_player' | 'not_your_turn' | 'stale' | 'occupied' | 'finished' };

const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

/** Same size as a real Phase 1 id (UUID without dashes, 32 chars). */
export function newGameId(): string {
  return randomUUID().replaceAll('-', '');
}

export function createGame(id: string, creatorId: number, creatorName: string): SpikeGame {
  return {
    id,
    players: [creatorId, undefined],
    playerNames: [creatorName, undefined],
    cells: Array<Cell>(9).fill(null),
    turn: 0,
    version: 0,
    round: 0,
  };
}

export function winner(cells: readonly Cell[]): Mark | 'draw' | null {
  for (const [a, b, c] of LINES) {
    const mark = cells[a];
    if (mark && mark === cells[b] && mark === cells[c]) return mark;
  }
  return cells.every(Boolean) ? 'draw' : null;
}

export function join(
  game: SpikeGame,
  userId: number,
  name: string,
): { ok: true; game: SpikeGame } | { ok: false; reason: 'already_joined' | 'full' } {
  if (game.players[0] === userId) return { ok: false, reason: 'already_joined' };
  if (game.players[1] !== undefined) return { ok: false, reason: 'full' };
  return {
    ok: true,
    game: {
      ...game,
      players: [game.players[0], userId],
      playerNames: [game.playerNames[0], name],
      version: game.version + 1,
    },
  };
}

export function applyMove(
  game: SpikeGame,
  userId: number,
  cell: number,
  version: number,
): MoveResult {
  const index = game.players.indexOf(userId);
  if (index === -1) return { ok: false, reason: 'not_player' };
  if (version !== game.version) return { ok: false, reason: 'stale' };
  if (winner(game.cells)) return { ok: false, reason: 'finished' };
  if (index !== game.turn) return { ok: false, reason: 'not_your_turn' };
  if (game.cells[cell]) return { ok: false, reason: 'occupied' };

  const cells = [...game.cells];
  cells[cell] = game.turn === 0 ? 'X' : 'O';
  return {
    ok: true,
    game: { ...game, cells, turn: game.turn === 0 ? 1 : 0, version: game.version + 1 },
  };
}

export function rematch(game: SpikeGame): SpikeGame {
  // Swap sides so the other player starts.
  return {
    ...game,
    players: [game.players[1] ?? game.players[0], game.players[0]],
    playerNames: [game.playerNames[1] ?? game.playerNames[0], game.playerNames[0]],
    cells: Array<Cell>(9).fill(null),
    turn: 0,
    version: game.version + 1,
    round: game.round + 1,
  };
}

/** Process-local store. Lost on restart, which is fine for a spike. */
export const games = new Map<string, SpikeGame>();
