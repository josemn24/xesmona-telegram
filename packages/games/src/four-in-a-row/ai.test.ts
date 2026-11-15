import { describe, expect, it } from 'vitest';
import { BOT_LEVELS, type Seat } from '../engine';
import { chooseMove } from './ai';
import { applyMove, initialState, legalMoves, outcome, type State } from './engine';

function play(state: State, column: number): State {
  const result = applyMove(state, state.turn, column);
  if (!result.ok) throw new Error(`${column}: ${result.reason}`);
  return result.state;
}

/** 6 strings of 7 chars, top row first: x = seat 0, o = seat 1. */
const board = (rows: string[], turn: Seat): State => ({
  cells: rows.flatMap((row) => [...row].map((c) => (c === 'x' ? 0 : c === 'o' ? 1 : null))),
  turn,
});

const EMPTY = '.......';

describe('four in a row bot', () => {
  it.each(BOT_LEVELS)('%s always returns a legal move until the game ends', (level) => {
    let calls = 0;
    const rng = () => (calls++ % 10) / 10;
    let state = initialState(0);
    while (legalMoves(state).length > 0) {
      const column = chooseMove(state, state.turn, level, rng);
      expect(legalMoves(state)).toContain(column);
      state = play(state, column);
    }
    expect(outcome(state)).not.toBeNull();
  });

  it('throws when there is no move to make', () => {
    const won = board([EMPTY, EMPTY, EMPTY, EMPTY, 'ooo....', 'xxxx...'], 1);
    expect(() => chooseMove(won, 1, 'easy')).toThrow();
  });

  it.each(['normal', 'hard'] as const)('%s takes an immediate win', (level) => {
    // o to move: three o on the bottom row (4-5-6) win at column 3; x threatens column 0.
    const state = board([EMPTY, EMPTY, EMPTY, 'x......', 'x......', 'x...ooo'], 1);
    expect(chooseMove(state, 1, level, () => 0.99)).toBe(3);
  });

  it.each(['normal', 'hard'] as const)("%s blocks the opponent's win", (level) => {
    // o to move; x threatens to complete 0-1-2-3 on the bottom row at column 3.
    const state = board([EMPTY, EMPTY, EMPTY, EMPTY, 'oo.....', 'xxx...o'], 1);
    expect(chooseMove(state, 1, level, () => 0)).toBe(3);
  });

  it('hard sets up a double threat it can force', () => {
    // x to move with x on columns 2 and 3 of the bottom row and both ends open: playing 1 or 4
    // makes three in a row with two open ends, which o can't block both.
    const state = board([EMPTY, EMPTY, EMPTY, EMPTY, '..oo...', '..xx...'], 0);
    expect([1, 4]).toContain(chooseMove(state, 0, 'hard', () => 0));
  });

  it('hard answers within a request budget from the opening', () => {
    const started = Date.now();
    chooseMove(initialState(0), 0, 'hard', () => 0);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it('hard beats easy from either side', () => {
    for (const hardSeat of [0, 1] as const) {
      let state = initialState(0);
      let calls = 0;
      const rng = () => ((calls++ * 7919) % 1000) / 1000;
      while (!outcome(state)) {
        const level = state.turn === hardSeat ? 'hard' : 'easy';
        state = play(state, chooseMove(state, state.turn, level, rng));
      }
      expect(outcome(state)).toMatchObject({ winner: hardSeat });
    }
  });
});
