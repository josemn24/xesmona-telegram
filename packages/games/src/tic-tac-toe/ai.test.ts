import { describe, expect, it } from 'vitest';
import { BOT_LEVELS, chooseMove } from './ai';
import { applyMove, initialState, legalMoves, outcome, type Seat, type State } from './engine';

function play(state: State, cell: number): State {
  const result = applyMove(state, state.turn, cell);
  if (!result.ok) throw new Error(`${cell}: ${result.reason}`);
  return result.state;
}

const board = (cells: string, turn: Seat): State => ({
  cells: [...cells].map((c) => (c === 'x' ? 0 : c === 'o' ? 1 : null)),
  turn,
});

describe('bot AI', () => {
  it.each(BOT_LEVELS)('%s always returns a legal move', (level) => {
    let rngCalls = 0;
    const rng = () => (rngCalls++ % 10) / 10;
    let state = initialState(0);
    while (legalMoves(state).length > 0) {
      const cell = chooseMove(state, state.turn, level, rng);
      expect(legalMoves(state)).toContain(cell);
      state = play(state, cell);
    }
  });

  it('throws when there is no move to make', () => {
    expect(() => chooseMove(board('xxx......', 1), 1, 'easy')).toThrow();
  });

  it.each(['normal', 'hard'] as const)('%s takes an immediate win', (level) => {
    // o to move; o wins with 5 (row 3-4-5); x also threatens 2.
    expect(chooseMove(board('xx.oo....', 1), 1, level, () => 0.99)).toBe(5);
  });

  it.each(['normal', 'hard'] as const)("%s blocks the opponent's win", (level) => {
    // o to move; x threatens 0-1-2 at cell 2.
    expect(chooseMove(board('xx..o....', 1), 1, level, () => 0)).toBe(2);
  });

  /** Plays every possible opponent move sequence against hard and returns all final states. */
  function allGames(state: State, botSeat: Seat): State[] {
    if (outcome(state)) return [state];
    if (state.turn === botSeat) {
      return allGames(
        play(
          state,
          chooseMove(state, botSeat, 'hard', () => 0),
        ),
        botSeat,
      );
    }
    return legalMoves(state).flatMap((cell) => allGames(play(state, cell), botSeat));
  }

  it.each([
    ['the bot starts', 1],
    ['the opponent starts', 0],
  ] as const)('hard never loses when %s', (_label, starting) => {
    const games = allGames(initialState(starting), 1);
    expect(games.length).toBeGreaterThan(0);
    for (const game of games) {
      const result = outcome(game);
      expect(result === 'draw' || result?.winner === 1).toBe(true);
    }
  });
});
