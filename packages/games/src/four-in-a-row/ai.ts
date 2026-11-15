// Four in a row bot (ADR 0005). Pure: the random source is injected so tests are deterministic.
// Hard is a depth-limited negamax with alpha-beta pruning and a window-count heuristic: strong
// enough to punish mistakes, cheap enough to run inside a request.
import { other, pick, type BotLevel, type Seat } from '../engine';
import {
  COLUMNS,
  LINES,
  ROWS,
  applyMove,
  cellIndex,
  dropRow,
  legalMoves,
  outcome,
  type State,
} from './engine';

export const HARD_DEPTH = 6;

const WIN = 1_000_000;
/** Centre columns first: better moves earlier means more pruning. */
const ORDER = [3, 2, 4, 1, 5, 0, 6].filter((column) => column < COLUMNS);
/** Lines through each cell, to check a win only around the last disc. */
const LINES_BY_CELL: number[][][] = Array.from({ length: ROWS * COLUMNS }, (_, cell) =>
  LINES.filter((line) => line.includes(cell)).map((line) => [...line]),
);

function play(state: State, seat: Seat, column: number): State {
  const result = applyMove(state, seat, column);
  if (!result.ok) throw new Error(`Illegal column ${column}: ${result.reason}`);
  return result.state;
}

/** A column that wins on the spot for `seat`, if any. */
function winningMove(state: State, seat: Seat): number | undefined {
  const asSeat = { ...state, turn: seat };
  return legalMoves(asSeat).find((column) => {
    const result = outcome(play(asSeat, seat, column));
    return result !== null && result !== 'draw' && result.winner === seat;
  });
}

// --- Hard: search on a mutable board for speed -------------------------------------------

type Board = (Seat | null)[];

function wins(board: Board, cell: number, seat: Seat): boolean {
  return (LINES_BY_CELL[cell] ?? []).some((line) => line.every((i) => board[i] === seat));
}

/** Static score from `seat`'s point of view. */
function evaluate(board: Board, seat: Seat): number {
  const opponent = other(seat);
  let score = 0;
  for (let row = 0; row < ROWS; row++) {
    const centre = board[cellIndex(row, 3)];
    if (centre === seat) score += 3;
    else if (centre === opponent) score -= 3;
  }
  for (const line of LINES) {
    let mine = 0;
    let theirs = 0;
    for (const i of line) {
      if (board[i] === seat) mine++;
      else if (board[i] === opponent) theirs++;
    }
    if (theirs === 0) score += mine === 3 ? 5 : mine === 2 ? 2 : 0;
    else if (mine === 0) score -= theirs === 3 ? 4 : theirs === 2 ? 2 : 0;
  }
  return score;
}

function negamax(board: Board, seat: Seat, depth: number, alpha: number, beta: number): number {
  const moves = ORDER.filter((column) => board[cellIndex(0, column)] === null);
  if (moves.length === 0) return 0;
  if (depth === 0) return evaluate(board, seat);
  let best = -Infinity;
  for (const column of moves) {
    const row = dropRow({ cells: board, turn: seat }, column) ?? 0;
    const cell = cellIndex(row, column);
    board[cell] = seat;
    // Faster wins (more depth left) score higher.
    const score = wins(board, cell, seat)
      ? WIN + depth
      : -negamax(board, other(seat), depth - 1, -beta, -alpha);
    board[cell] = null;
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function bestMoves(state: State, seat: Seat, depth: number): number[] {
  const board = [...state.cells];
  const scored: { column: number; score: number }[] = [];
  let best = -Infinity;
  for (const column of ORDER.filter((c) => legalMoves(state).includes(c))) {
    const row = dropRow(state, column) ?? 0;
    const cell = cellIndex(row, column);
    board[cell] = seat;
    // Window (best - 1, ∞): scores equal to the best so far come back exact, so ties are kept.
    const score = wins(board, cell, seat)
      ? WIN + depth
      : -negamax(board, other(seat), depth - 1, -Infinity, -(best - 1));
    board[cell] = null;
    scored.push({ column, score });
    if (score > best) best = score;
  }
  return scored.filter((s) => s.score === best).map((s) => s.column);
}

/** Chooses the bot's column for `seat` (which must be the seat to move). */
export function chooseMove(
  state: State,
  seat: Seat,
  level: BotLevel,
  rng: () => number = Math.random,
): number {
  const moves = legalMoves(state);
  if (moves.length === 0) throw new Error('No legal moves');
  switch (level) {
    case 'easy':
      return pick(moves, rng);
    case 'normal':
      return winningMove(state, seat) ?? winningMove(state, other(seat)) ?? pick(moves, rng);
    case 'hard':
      return pick(bestMoves(state, seat, HARD_DEPTH), rng);
  }
}
