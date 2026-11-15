// Bot opponent (ADR 0005). Pure: the random source is injected so tests are deterministic.
import { applyMove, legalMoves, other, outcome, type Seat, type State } from './engine';

export type BotLevel = 'easy' | 'normal' | 'hard';

export const BOT_LEVELS: readonly BotLevel[] = ['easy', 'normal', 'hard'];

function pick<T>(items: readonly T[], rng: () => number): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) throw new Error('Nothing to pick from');
  return item;
}

function play(state: State, seat: Seat, cell: number): State {
  const result = applyMove(state, seat, cell);
  if (!result.ok) throw new Error(`Illegal move ${cell}: ${result.reason}`);
  return result.state;
}

/** A move that wins on the spot for `seat`, if any. */
function winningMove(state: State, seat: Seat): number | undefined {
  // Look at the board as if it were `seat`'s turn, to also find the opponent's threats.
  const asSeat = { ...state, turn: seat };
  return legalMoves(asSeat).find((cell) => {
    const result = outcome(play(asSeat, seat, cell));
    return result !== null && result !== 'draw' && result.winner === seat;
  });
}

/** Minimax score from `seat`'s point of view: +10 win, −10 loss, 0 draw; faster wins score higher. */
function score(state: State, seat: Seat, depth: number): number {
  const result = outcome(state);
  if (result === 'draw') return 0;
  if (result) return result.winner === seat ? 10 - depth : depth - 10;
  const scores = legalMoves(state).map((cell) =>
    score(play(state, state.turn, cell), seat, depth + 1),
  );
  return state.turn === seat ? Math.max(...scores) : Math.min(...scores);
}

function bestMoves(state: State, seat: Seat): number[] {
  const scored = legalMoves(state).map((cell) => ({
    cell,
    value: score(play(state, seat, cell), seat, 1),
  }));
  const best = Math.max(...scored.map((s) => s.value));
  return scored.filter((s) => s.value === best).map((s) => s.cell);
}

/** Chooses the bot's move for `seat` (which must be the seat to move). */
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
      return pick(bestMoves(state, seat), rng);
  }
}
