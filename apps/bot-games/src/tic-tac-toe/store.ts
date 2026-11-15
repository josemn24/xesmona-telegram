// Tic-tac-toe persistence: the shared game store bound to this game's type and moves.
import type { Db } from '@xesmona/contracts';
import { ticTacToe, type Seat, type State } from '@xesmona/games/tic-tac-toe';
import * as store from '../games/store';

export {
  BOT_PLAYER_NAME,
  attachMessage,
  displayName,
  getUserName,
  joinGame,
  startVsBot,
  upsertUser,
  type NewPlayer,
  type Player,
} from '../games/store';

export const GAME_TYPE = ticTacToe.type;

export type Game = store.Game<State>;

export const findGame = (db: Db, id: string) => store.findGame<State>(db, GAME_TYPE, id);

export const findGameByInlineMessage = (db: Db, botId: string, inlineMessageId: string) =>
  store.findGameByInlineMessage<State>(db, GAME_TYPE, botId, inlineMessageId);

export type CreateGameInput = Omit<store.CreateGameInput<State>, 'gameType'>;

/** Returns undefined if the inline message already has a game (two first taps at once). */
export const createGame = (db: Db, input: CreateGameInput) =>
  store.createGame<State>(db, { ...input, gameType: GAME_TYPE });

export interface SaveInput extends Omit<store.SaveInput<State>, 'moves'> {
  moves: { seat: Seat; cell: number }[];
}

/** Saves moves (or a rematch, with no moves). Undefined when the version no longer matches. */
export const saveGame = (db: Db, game: Game, { moves, ...input }: SaveInput) =>
  store.saveGame<State>(db, game, {
    ...input,
    moves: moves.map((m) => ({ seat: m.seat, move: ticTacToe.encodeMove(m.cell) })),
  });
