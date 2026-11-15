// Contract shared by every game engine (GameEngine v1). Engines are pure: no dependency on
// React, grammY or Supabase, so the server and the Mini Apps run the same rules.

export type Seat = 0 | 1;
export type Mode = 'pvp' | 'vs_bot';
export type BotLevel = 'easy' | 'normal' | 'hard';

export const BOT_LEVELS: readonly BotLevel[] = ['easy', 'normal', 'hard'];

/** `line` lists the cells that made the win, when the game can show them. */
export type Outcome = { winner: Seat; line?: readonly number[] } | 'draw' | null;

export type MoveResult<State, MoveError extends string> =
  { ok: true; state: State } | { ok: false; reason: MoveError };

/** Every engine's state says whose turn it is. */
export interface TurnState {
  turn: Seat;
}

export interface GameEngine<State extends TurnState, Move, MoveError extends string> {
  /** Stored in `games.game_type`. */
  type: string;
  initialState(starting: Seat): State;
  /** Reads a move from untrusted JSON (API body, stored move). Undefined if malformed. */
  parseMove(input: unknown): Move | undefined;
  /** The JSON form of a move, as stored in `game_moves.move` and sent by clients. */
  encodeMove(move: Move): Record<string, number>;
  applyMove(state: State, seat: Seat, move: Move): MoveResult<State, MoveError>;
  outcome(state: State): Outcome;
  legalMoves(state: State): Move[];
  /** The bot's move for `seat` (the seat to move). `rng` is injected for deterministic tests. */
  chooseMove(state: State, seat: Seat, level: BotLevel, rng?: () => number): Move;
}

export const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);

/** Vs bot the human (seat 0) always starts; two players take turns starting each round. */
export function startingSeat(mode: Mode, round: number): Seat {
  return mode === 'vs_bot' || round % 2 === 0 ? 0 : 1;
}

/** Picks one item with an injected random source in [0, 1). */
export function pick<T>(items: readonly T[], rng: () => number): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('Nothing to pick from');
  return item;
}
