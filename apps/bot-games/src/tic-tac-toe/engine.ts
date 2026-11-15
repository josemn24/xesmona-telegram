// Tic-tac-toe rules. Pure: no dependency on grammY, Supabase or React.

export type Seat = 0 | 1;
export type Mode = 'pvp' | 'vs_bot';

export interface State {
  /** 9 cells, row by row; each holds the seat that played it. */
  cells: (Seat | null)[];
  /** Seat that moves next. */
  turn: Seat;
}

export type Outcome = { winner: Seat } | 'draw' | null;

export type MoveError = 'not_your_turn' | 'occupied' | 'finished' | 'invalid_cell';

export type MoveResult = { ok: true; state: State } | { ok: false; reason: MoveError };

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

export const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);

/** Vs bot the human (seat 0) always starts; two players take turns starting each round. */
export function startingSeat(mode: Mode, round: number): Seat {
  return mode === 'vs_bot' || round % 2 === 0 ? 0 : 1;
}

/** The seat that starts the round plays X. */
export function markOf(seat: Seat, starting: Seat): 'X' | 'O' {
  return seat === starting ? 'X' : 'O';
}

export function initialState(starting: Seat): State {
  return { cells: Array<Seat | null>(9).fill(null), turn: starting };
}

export function outcome(state: State): Outcome {
  for (const [a, b, c] of LINES) {
    const seat = state.cells[a];
    if (seat !== null && seat !== undefined && seat === state.cells[b] && seat === state.cells[c]) {
      return { winner: seat };
    }
  }
  return state.cells.every((cell) => cell !== null) ? 'draw' : null;
}

export function legalMoves(state: State): number[] {
  if (outcome(state)) return [];
  return state.cells.flatMap((cell, i) => (cell === null ? [i] : []));
}

export function applyMove(state: State, seat: Seat, cell: number): MoveResult {
  if (!Number.isInteger(cell) || cell < 0 || cell > 8) return { ok: false, reason: 'invalid_cell' };
  if (outcome(state)) return { ok: false, reason: 'finished' };
  if (seat !== state.turn) return { ok: false, reason: 'not_your_turn' };
  if (state.cells[cell] !== null) return { ok: false, reason: 'occupied' };
  const cells = [...state.cells];
  cells[cell] = seat;
  return { ok: true, state: { cells, turn: other(seat) } };
}
