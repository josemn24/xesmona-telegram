import { z } from 'zod';
import type { GameEngine } from '../engine';
import { chooseMove } from './ai';
import {
  COLUMNS,
  applyMove,
  initialState,
  legalMoves,
  outcome,
  type MoveError,
  type State,
} from './engine';

export * from './engine';
export { BOT_LEVELS, type BotLevel } from '../engine';
export { chooseMove } from './ai';

const moveSchema = z.object({
  column: z
    .number()
    .int()
    .min(0)
    .max(COLUMNS - 1),
});

/** Four in a row as a GameEngine. A move is the column (0–6), stored as `{ column }`. */
export const fourInARow: GameEngine<State, number, MoveError> = {
  type: 'four-in-a-row',
  initialState,
  parseMove: (input) => moveSchema.safeParse(input).data?.column,
  encodeMove: (column) => ({ column }),
  applyMove,
  outcome,
  legalMoves,
  chooseMove,
};
