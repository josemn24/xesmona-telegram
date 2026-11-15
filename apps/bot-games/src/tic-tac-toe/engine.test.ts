import { describe, expect, it } from 'vitest';
import {
  applyMove,
  initialState,
  legalMoves,
  markOf,
  outcome,
  startingSeat,
  type Seat,
  type State,
} from './engine';

/** Plays alternating moves from an initial state, failing on any illegal one. */
function playAll(cells: number[], starting: Seat = 0): State {
  return cells.reduce((state, cell) => {
    const result = applyMove(state, state.turn, cell);
    if (!result.ok) throw new Error(`${cell}: ${result.reason}`);
    return result.state;
  }, initialState(starting));
}

describe('tic-tac-toe engine', () => {
  it('starts empty with the given seat to move', () => {
    const state = initialState(1);
    expect(state.cells).toEqual(Array(9).fill(null));
    expect(state.turn).toBe(1);
    expect(legalMoves(state)).toHaveLength(9);
  });

  it('alternates turns and never mutates the input', () => {
    const start = initialState(0);
    const result = applyMove(start, 0, 4);
    if (!result.ok) throw new Error(result.reason);
    expect(result.state.cells[4]).toBe(0);
    expect(result.state.turn).toBe(1);
    expect(start.cells[4]).toBeNull();
  });

  it('rejects wrong turn, occupied and invalid cells', () => {
    const state = playAll([4]);
    expect(applyMove(state, 0, 0)).toEqual({ ok: false, reason: 'not_your_turn' });
    expect(applyMove(state, 1, 4)).toEqual({ ok: false, reason: 'occupied' });
    expect(applyMove(state, 1, 9)).toEqual({ ok: false, reason: 'invalid_cell' });
    expect(applyMove(state, 1, 1.5)).toEqual({ ok: false, reason: 'invalid_cell' });
  });

  it.each([
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ])('detects a win on %i-%i-%i and stops the game', (a, b, c) => {
    const cells = Array<Seat | null>(9).fill(null);
    cells[a] = cells[b] = cells[c] = 1;
    const state: State = { cells, turn: 0 };
    expect(outcome(state)).toEqual({ winner: 1 });
    expect(legalMoves(state)).toEqual([]);
    const free = cells.findIndex((cell) => cell === null);
    expect(applyMove(state, 0, free)).toEqual({ ok: false, reason: 'finished' });
  });

  it('detects a draw', () => {
    expect(outcome(playAll([0, 1, 2, 4, 3, 5, 7, 6, 8]))).toBe('draw');
  });

  it('picks who starts each round and their mark', () => {
    expect([0, 1, 2, 3].map((round) => startingSeat('pvp', round))).toEqual([0, 1, 0, 1]);
    expect([0, 1, 2].map((round) => startingSeat('vs_bot', round))).toEqual([0, 0, 0]);
    expect(markOf(0, 0)).toBe('X');
    expect(markOf(1, 0)).toBe('O');
    expect(markOf(1, 1)).toBe('X');
  });
});
