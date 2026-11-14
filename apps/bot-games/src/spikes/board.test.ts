// Phase 0 spike: remove in Phase 1.
import { describe, expect, it } from 'vitest';
import { applyMove, createGame, join, newGameId, rematch, winner, type SpikeGame } from './board';
import {
  CALLBACK_DATA_MAX_BYTES,
  boardKeyboard,
  joinData,
  moveData,
  rematchData,
} from './keyboard';

const A = 1;
const B = 2;

function started(): SpikeGame {
  const result = join(createGame(newGameId(), A, 'A'), B, 'B');
  if (!result.ok) throw new Error('join failed');
  return result.game;
}

function play(game: SpikeGame, moves: [number, number][]): SpikeGame {
  return moves.reduce((g, [user, cell]) => {
    const result = applyMove(g, user, cell, g.version);
    if (!result.ok) throw new Error(result.reason);
    return result.game;
  }, game);
}

describe('spike board', () => {
  it('refuses joining your own game and a full game', () => {
    const game = createGame('g', A, 'A');
    expect(join(game, A, 'A')).toEqual({ ok: false, reason: 'already_joined' });
    expect(join(started(), 3, 'C')).toEqual({ ok: false, reason: 'full' });
  });

  it('enforces players, turn, version and free cells', () => {
    const game = started();
    expect(applyMove(game, 3, 0, game.version)).toMatchObject({ reason: 'not_player' });
    expect(applyMove(game, B, 0, game.version)).toMatchObject({ reason: 'not_your_turn' });
    expect(applyMove(game, A, 0, game.version - 1)).toMatchObject({ reason: 'stale' });
    const next = play(game, [[A, 0]]);
    expect(next.version).toBe(game.version + 1);
    expect(applyMove(next, B, 0, next.version)).toMatchObject({ reason: 'occupied' });
  });

  it('only the first of two taps with the same version is accepted', () => {
    const game = started();
    const first = applyMove(game, A, 0, game.version);
    if (!first.ok) throw new Error(first.reason);
    expect(applyMove(first.game, A, 1, game.version)).toMatchObject({ reason: 'stale' });
  });

  it('detects wins and draws and stops the game', () => {
    const won = play(started(), [
      [A, 0],
      [B, 3],
      [A, 1],
      [B, 4],
      [A, 2],
    ]);
    expect(winner(won.cells)).toBe('X');
    expect(applyMove(won, B, 5, won.version)).toMatchObject({ reason: 'finished' });

    const draw = play(started(), [
      [A, 0],
      [B, 1],
      [A, 2],
      [B, 4],
      [A, 3],
      [B, 5],
      [A, 7],
      [B, 6],
      [A, 8],
    ]);
    expect(winner(draw.cells)).toBe('draw');
  });

  it('rematch swaps sides and resets the board', () => {
    const next = rematch(play(started(), [[A, 0]]));
    expect(next.players).toEqual([B, A]);
    expect(next.cells.every((c) => c === null)).toBe(true);
    expect(next.round).toBe(1);
  });
});

describe('spike callback_data', () => {
  it('stays within 64 bytes even with large versions', () => {
    const game = { ...started(), version: 99_999 };
    for (const data of [moveData(game, 8), joinData(game.id), rematchData(game)]) {
      expect(Buffer.byteLength(data)).toBeLessThanOrEqual(CALLBACK_DATA_MAX_BYTES);
    }
    expect(() => boardKeyboard(game)).not.toThrow();
  });
});
