// Four in a row moves from the Mini App. The server is the authority: every move is validated
// with the engine, saved with its version and, vs bot, saved together with the bot's reply
// (ADR 0005). The Realtime broadcast comes from the database (supabase/schemas/30_realtime.sql).
import type { Db } from '@xesmona/contracts';
import { other, type Seat } from '@xesmona/games';
import type { ApiErrorCode, GameSnapshot, MoveRequest } from '@xesmona/games/api';
import { fourInARow, type State } from '@xesmona/games/four-in-a-row';
import type { Api } from 'grammy';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AuthEnv } from '../api/auth';
import { findGame, humanSeat, saveGame, type Game, type SavedMove } from '../games/store';
import { renderGameMessage } from './handlers';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function toSnapshot(game: Game<State>, userId: number): GameSnapshot<State> {
  return {
    id: game.id,
    gameType: game.gameType,
    status: game.status,
    mode: game.mode,
    botLevel: game.botLevel,
    version: game.version,
    round: game.round,
    state: game.state,
    result: game.result,
    winnerSeat: game.winnerSeat,
    players: game.players.map(({ seat, kind, displayName }) => ({ seat, kind, displayName })),
    you: humanSeat(game, userId) ?? null,
  };
}

type PlayResult =
  { ok: true; game: Game<State> } | { ok: false; status: ContentfulStatusCode; code: ApiErrorCode };

/** Applies a player's move (and the bot's reply, vs bot) and saves them in one transaction. */
export async function playMove(
  db: Db,
  game: Game<State>,
  seat: Seat,
  version: number,
  move: unknown,
  rng: () => number = Math.random,
): Promise<PlayResult> {
  if (version !== game.version) return { ok: false, status: 409, code: 'stale' };
  if (game.status !== 'playing') return { ok: false, status: 409, code: 'not_playing' };
  const column = fourInARow.parseMove(move);
  if (column === undefined) return { ok: false, status: 422, code: 'invalid_move' };

  const human = fourInARow.applyMove(game.state, seat, column);
  if (!human.ok) {
    return human.reason === 'not_your_turn'
      ? { ok: false, status: 409, code: 'not_your_turn' }
      : { ok: false, status: 422, code: 'invalid_move' };
  }
  let state = human.state;
  const moves: SavedMove[] = [{ seat, move: fourInARow.encodeMove(column) }];

  if (game.mode === 'vs_bot' && game.botLevel && !fourInARow.outcome(state)) {
    const botSeat = other(seat);
    const botColumn = fourInARow.chooseMove(state, botSeat, game.botLevel, rng);
    const reply = fourInARow.applyMove(state, botSeat, botColumn);
    if (!reply.ok) throw new Error(`Bot chose an illegal column: ${reply.reason}`);
    state = reply.state;
    moves.push({ seat: botSeat, move: fourInARow.encodeMove(botColumn) });
  }

  const result = fourInARow.outcome(state);
  const saved = await saveGame(db, game, {
    state,
    round: game.round,
    moves,
    status: result ? 'finished' : 'playing',
    ...(result === 'draw' && { result: 'draw' as const }),
    ...(result && result !== 'draw' && { result: 'win' as const, winnerSeat: result.winner }),
  });
  // Someone else changed the game first (e.g. the other player's simultaneous move).
  if (!saved) return { ok: false, status: 409, code: 'stale' };
  return { ok: true, game: saved };
}

export function fourInARowApi(db: Db, api: Api, miniAppUrl: string | undefined) {
  const app = new Hono<AuthEnv>();
  const load = (id: string) =>
    UUID.test(id) ? findGame<State>(db, fourInARow.type, id) : undefined;

  app.get('/:id', async (c) => {
    const game = await load(c.req.param('id'));
    if (!game) return c.json({ code: 'not_found' satisfies ApiErrorCode }, 404);
    return c.json(toSnapshot(game, c.var.user.id));
  });

  app.post('/:id/moves', async (c) => {
    const game = await load(c.req.param('id'));
    if (!game) return c.json({ code: 'not_found' satisfies ApiErrorCode }, 404);
    const seat = humanSeat(game, c.var.user.id);
    if (seat === undefined) return c.json({ code: 'not_player' satisfies ApiErrorCode }, 403);

    const body = (await c.req.json().catch(() => null)) as Partial<MoveRequest> | null;
    if (typeof body?.version !== 'number') {
      return c.json({ code: 'invalid_move' satisfies ApiErrorCode }, 422);
    }
    const played = await playMove(db, game, seat, body.version, body.move);
    if (!played.ok) return c.json({ code: played.code }, played.status);

    // The chat message only changes when the game ends (ADR 0008).
    if (played.game.status === 'finished' && miniAppUrl) {
      await renderGameMessage(api, db, played.game, miniAppUrl);
    }
    return c.json(toSnapshot(played.game, c.var.user.id));
  });

  return app;
}
