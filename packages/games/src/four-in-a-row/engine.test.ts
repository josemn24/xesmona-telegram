import { describe, expect, it } from 'vitest';
import type { Seat } from '../engine';
import { fourInARow } from '.';
import {
  COLUMNS,
  ROWS,
  applyMove,
  cellIndex,
  initialState,
  legalMoves,
  outcome,
  type State,
} from './engine';

/** Plays alternating columns from an initial state, failing on any illegal one. */
function playAll(columns: number[], starting: Seat = 0): State {
  return columns.reduce((state, column) => {
    const result = applyMove(state, state.turn, column);
    if (!result.ok) throw new Error(`${column}: ${result.reason}`);
    return result.state;
  }, initialState(starting));
}

/** Builds a state from 6 strings of 7 chars, top row first: x = seat 0, o = seat 1. */
const board = (rows: string[], turn: Seat = 0): State => ({
  cells: rows.flatMap((row) => [...row].map((c) => (c === 'x' ? 0 : c === 'o' ? 1 : null))),
  turn,
});

describe('four in a row engine', () => {
  it('starts empty with the given seat to move', () => {
    const state = initialState(1);
    expect(state.cells).toHaveLength(ROWS * COLUMNS);
    expect(state.cells.every((cell) => cell === null)).toBe(true);
    expect(state.turn).toBe(1);
    expect(legalMoves(state)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('drops discs to the lowest free row and never mutates the input', () => {
    const start = initialState(0);
    const first = applyMove(start, 0, 3);
    if (!first.ok) throw new Error(first.reason);
    expect(first.state.cells[cellIndex(5, 3)]).toBe(0);
    expect(first.state.turn).toBe(1);
    expect(start.cells[cellIndex(5, 3)]).toBeNull();

    const second = applyMove(first.state, 1, 3);
    if (!second.ok) throw new Error(second.reason);
    expect(second.state.cells[cellIndex(4, 3)]).toBe(1);
  });

  it('rejects wrong turn, full and invalid columns', () => {
    const full = playAll([0, 0, 0, 0, 0, 0]);
    expect(applyMove(full, 1, 1)).toEqual({ ok: false, reason: 'not_your_turn' });
    expect(applyMove(full, 0, 0)).toEqual({ ok: false, reason: 'column_full' });
    expect(applyMove(full, 0, 7)).toEqual({ ok: false, reason: 'invalid_column' });
    expect(applyMove(full, 0, -1)).toEqual({ ok: false, reason: 'invalid_column' });
    expect(applyMove(full, 0, 1.5)).toEqual({ ok: false, reason: 'invalid_column' });
    expect(legalMoves(full)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it.each([
    [
      'horizontal',
      ['.......', '.......', '.......', '.......', 'ooo....', 'xxxx...'],
      [35, 36, 37, 38],
    ],
    [
      'vertical',
      ['.......', '.......', 'x......', 'xo.....', 'xo.....', 'xo.....'],
      [14, 21, 28, 35],
    ],
    [
      'rising diagonal',
      ['.......', '.......', '...x...', '..xo...', '.xoo...', 'xooxx..'],
      [17, 23, 29, 35],
    ],
    [
      'falling diagonal',
      ['.......', '.......', 'x......', 'ox.....', 'oox....', 'ooxx...'],
      [14, 22, 30, 38],
    ],
  ])('detects a %s win with its line and stops the game', (_label, rows, line) => {
    const state = board(rows, 1);
    expect(outcome(state)).toEqual({ winner: 0, line });
    expect(legalMoves(state)).toEqual([]);
    expect(applyMove(state, 1, 6)).toEqual({ ok: false, reason: 'finished' });
  });

  it('detects a draw on a full board with no four', () => {
    const rows = ['xxoxxox', 'ooxooxo', 'xxoxxox', 'ooxooxo', 'xxoxxox', 'ooxooxo'];
    const state = board(rows);
    expect(outcome(state)).toBe('draw');
    expect(legalMoves(state)).toEqual([]);
  });

  it('parses and encodes moves for the API and storage', () => {
    expect(fourInARow.parseMove({ column: 6 })).toBe(6);
    expect(fourInARow.parseMove({ column: 7 })).toBeUndefined();
    expect(fourInARow.parseMove({ column: '3' })).toBeUndefined();
    expect(fourInARow.parseMove(null)).toBeUndefined();
    expect(fourInARow.encodeMove(2)).toEqual({ column: 2 });
  });
});
