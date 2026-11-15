import { z } from 'zod';
import type { GameEngine } from '../engine';
import { chooseMove } from './ai';
import { applyMove, initialState, legalMoves, outcome, type MoveError, type State } from './engine';

export * from './engine';
export { BOT_LEVELS, type BotLevel } from '../engine';
export { chooseMove } from './ai';

const moveSchema = z.object({ cell: z.number().int().min(0).max(8) });

/** Tic-tac-toe as a GameEngine. A move is the cell index (0–8), stored as `{ cell }`. */
export const ticTacToe: GameEngine<State, number, MoveError> = {
  type: 'tic-tac-toe',
  initialState,
  parseMove: (input) => moveSchema.safeParse(input).data?.cell,
  encodeMove: (cell) => ({ cell }),
  applyMove,
  outcome,
  legalMoves,
  chooseMove,
};
