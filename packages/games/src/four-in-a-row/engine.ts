// Four in a row rules. Pure: no dependency on grammY, Supabase or React.
// The board is 7 columns × 6 rows; a disc dropped in a column falls to the lowest free row.

import { other, type MoveResult as Result, type Outcome, type Seat } from '../engine';

export const COLUMNS = 7;
export const ROWS = 6;

export interface State {
  /** 42 cells, row by row from the top (index = row * COLUMNS + column). */
  cells: (Seat | null)[];
  /** Seat that moves next. */
  turn: Seat;
}

export type MoveError = 'not_your_turn' | 'column_full' | 'finished' | 'invalid_column';

export type MoveResult = Result<State, MoveError>;

export const cellIndex = (row: number, column: number) => row * COLUMNS + column;

/** Every run of four cells that wins: horizontal, vertical and both diagonals. */
const LINES: readonly (readonly number[])[] = (() => {
  const lines: number[][] = [];
  const directions = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const;
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column < COLUMNS; column++) {
      for (const [dr, dc] of directions) {
        const endRow = row + 3 * dr;
        const endColumn = column + 3 * dc;
        if (endRow < 0 || endRow >= ROWS || endColumn < 0 || endColumn >= COLUMNS) continue;
        lines.push([0, 1, 2, 3].map((i) => cellIndex(row + i * dr, column + i * dc)));
      }
    }
  }
  return lines;
})();

export function initialState(starting: Seat): State {
  return { cells: Array<Seat | null>(ROWS * COLUMNS).fill(null), turn: starting };
}

/** Lowest free row of a column, or undefined when it's full. */
export function dropRow(state: State, column: number): number | undefined {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (state.cells[cellIndex(row, column)] === null) return row;
  }
  return undefined;
}

export function outcome(state: State): Outcome {
  for (const line of LINES) {
    const seat = state.cells[line[0] ?? -1];
    if (seat !== null && seat !== undefined && line.every((i) => state.cells[i] === seat)) {
      return { winner: seat, line };
    }
  }
  return state.cells.every((cell) => cell !== null) ? 'draw' : null;
}

export function legalMoves(state: State): number[] {
  if (outcome(state)) return [];
  return Array.from({ length: COLUMNS }, (_, column) => column).filter(
    (column) => state.cells[cellIndex(0, column)] === null,
  );
}

export function applyMove(state: State, seat: Seat, column: number): MoveResult {
  if (!Number.isInteger(column) || column < 0 || column >= COLUMNS) {
    return { ok: false, reason: 'invalid_column' };
  }
  if (outcome(state)) return { ok: false, reason: 'finished' };
  if (seat !== state.turn) return { ok: false, reason: 'not_your_turn' };
  const row = dropRow(state, column);
  if (row === undefined) return { ok: false, reason: 'column_full' };
  const cells = [...state.cells];
  cells[cellIndex(row, column)] = seat;
  return { ok: true, state: { cells, turn: other(seat) } };
}

export { LINES };
