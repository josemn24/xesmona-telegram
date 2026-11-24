// Runs against the local Supabase (`pnpm db:start`); skipped when it isn't configured.
// The message render queue and game expiry (ADR 0010), with a fake Telegram API.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@xesmona/contracts';
import { ticTacToe, type State } from '@xesmona/games/tic-tac-toe';
import { GrammyError, InlineKeyboard, type Api } from 'grammy';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_RENDER_ATTEMPTS,
  chatKey,
  clearCooldowns,
  cooldownLeft,
  processRenders,
  renderGame,
  type GameViews,
} from './render';
import {
  attachMessage,
  claimRenders,
  createGame,
  enqueueRender,
  expireGames,
  findGame,
  markRendered,
  saveGame,
  upsertUser,
  type Game,
} from './store';

const envFile = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;

// Ids far from real Telegram ids, removed after the run.
const ADA = { id: 9_000_000_041, first_name: 'Ada' };
const CHAT_ID = -9_000_000_041;

const view = { text: 'board', keyboard: new InlineKeyboard() };
const views: GameViews = { [ticTacToe.type]: () => view };

function apiError(error_code: number, description: string, retry_after?: number) {
  return new GrammyError(
    description,
    {
      ok: false,
      error_code,
      description,
      ...(retry_after !== undefined && { parameters: { retry_after } }),
    },
    'editMessageText',
    {},
  );
}

/** A Telegram API whose edits run `edit` (resolve: edited; throw: failed). */
function fakeApi(edit: () => Promise<unknown> = () => Promise.resolve(true)) {
  const editMessageText = vi.fn(edit);
  const editMessageTextInline = vi.fn(edit);
  return { api: { editMessageText, editMessageTextInline } as unknown as Api, editMessageText };
}

describe.skipIf(!url || !key)('message renders (local database)', () => {
  // Created in a hook: `skipIf` still runs this callback, and createClient throws without a URL.
  let db: SupabaseClient<Database>;
  beforeAll(() => {
    db = createClient<Database>(url ?? '', key ?? '', { auth: { persistSession: false } });
  });
  const created: string[] = [];
  let messageId = 1;

  /** A two-player game with a chat message, waiting or playing. */
  async function newGame(status: 'waiting' | 'playing' = 'playing'): Promise<Game<State>> {
    const game = await createGame<State>(db, {
      botId: 'games',
      gameType: ticTacToe.type,
      createdBy: ADA.id,
      status,
      state: ticTacToe.initialState(0),
      ...(status === 'playing' && { mode: 'vs_bot' as const, botLevel: 'easy' as const }),
      players: [{ seat: 0, kind: 'human', telegramUserId: ADA.id, displayName: 'Ada' }],
    });
    if (!game) throw new Error('no game');
    created.push(game.id);
    await attachMessage(db, game.id, CHAT_ID, messageId++);
    const attached = await findGame<State>(db, ticTacToe.type, game.id);
    if (!attached) throw new Error('no game');
    return attached;
  }

  async function pending(gameId: string) {
    const { data } = await db.from('message_renders').select('*').eq('game_id', gameId);
    return data ?? [];
  }

  /** Makes the game's pending render due now. */
  const makeDue = (gameId: string) =>
    db
      .from('message_renders')
      .update({ not_before: new Date(Date.now() - 1000).toISOString() })
      .eq('game_id', gameId);

  /** A move, so the game's version moves past what the message shows. */
  async function move(game: Game<State>, cell: number) {
    const result = ticTacToe.applyMove(game.state, game.state.turn, cell);
    if (!result.ok) throw new Error(result.reason);
    const saved = await saveGame(db, game, {
      state: result.state,
      status: 'playing',
      round: 0,
      moves: [{ seat: game.state.turn, move: ticTacToe.encodeMove(cell) }],
    });
    if (!saved) throw new Error('stale');
    return saved;
  }

  beforeAll(() => upsertUser(db, ADA));
  beforeEach(() => clearCooldowns());

  afterAll(async () => {
    await db.from('games').delete().in('id', created);
    await db.from('telegram_users').delete().eq('id', ADA.id);
  });

  it('coalesces renders of one game and keeps the later not_before', async () => {
    const game = await newGame();
    await enqueueRender(db, game.id, 60);
    await enqueueRender(db, game.id, 0);
    const rows = await pending(game.id);
    expect(rows).toHaveLength(1);
    expect(new Date(rows[0]?.not_before ?? 0).getTime()).toBeGreaterThan(Date.now() + 50_000);
  });

  it('claims only due rows and leases them', async () => {
    const due = await newGame();
    const later = await newGame();
    await enqueueRender(db, due.id);
    await enqueueRender(db, later.id, 60);

    const claimed = (await claimRenders(db, 100)).map((r) => r.gameId);
    expect(claimed).toContain(due.id);
    expect(claimed).not.toContain(later.id);
    // Leased: a second worker doesn't get it.
    expect((await claimRenders(db, 100)).map((r) => r.gameId)).not.toContain(due.id);
  });

  it('keeps the render when an older version is confirmed', async () => {
    const game = await newGame();
    const moved = await move(game, 4);
    await enqueueRender(db, game.id);
    await markRendered(db, game.id, game.version);
    expect(await pending(game.id)).toHaveLength(1);
    await markRendered(db, game.id, moved.version);
    expect(await pending(game.id)).toHaveLength(0);
    // Never moves back.
    await markRendered(db, game.id, game.version);
    expect((await findGame<State>(db, ticTacToe.type, game.id))?.renderedVersion).toBe(
      moved.version,
    );
  });

  it('edits and marks the version on success, treating "not modified" as success', async () => {
    const game = await newGame();
    await renderGame(fakeApi().api, db, game, view);
    expect((await findGame<State>(db, ticTacToe.type, game.id))?.renderedVersion).toBe(
      game.version,
    );

    const moved = await move(game, 0);
    const { api } = fakeApi(() =>
      Promise.reject(apiError(400, 'Bad Request: message is not modified')),
    );
    await renderGame(api, db, moved, view);
    expect((await findGame<State>(db, ticTacToe.type, game.id))?.renderedVersion).toBe(
      moved.version,
    );
  });

  it('on 429 starts the chat cooldown and queues instead of editing again', async () => {
    const game = await newGame();
    const limited = fakeApi(() =>
      Promise.reject(apiError(429, 'Too Many Requests: retry after 39', 39)),
    );
    await renderGame(limited.api, db, game, view);
    const key = chatKey({ chatId: CHAT_ID, messageId: 0, threadId: null });
    expect(cooldownLeft(key)).toBeGreaterThan(30);
    const [row] = await pending(game.id);
    expect(new Date(row?.not_before ?? 0).getTime()).toBeGreaterThan(Date.now() + 30_000);

    // Another game in the same chat: queued without calling Telegram.
    const other = await newGame();
    const ok = fakeApi();
    await renderGame(ok.api, db, other, view);
    expect(ok.editMessageText).not.toHaveBeenCalled();
    expect(await pending(other.id)).toHaveLength(1);
  });

  it('drops the render when the message is gone', async () => {
    const game = await newGame();
    await enqueueRender(db, game.id);
    const { api } = fakeApi(() =>
      Promise.reject(apiError(400, 'Bad Request: message to edit not found')),
    );
    await renderGame(api, db, game, view);
    expect(await pending(game.id)).toHaveLength(0);
  });

  it('worker renders due games once and skips games already rendered', async () => {
    const behind = await newGame();
    const current = await newGame();
    await markRendered(db, current.id, current.version);
    await enqueueRender(db, behind.id);
    await enqueueRender(db, current.id);

    const { api, editMessageText } = fakeApi();
    await processRenders(api, db, views);
    expect(editMessageText).toHaveBeenCalledTimes(1);
    const message = behind.message;
    expect(editMessageText.mock.calls[0]?.slice(0, 2)).toEqual(
      message && 'messageId' in message ? [message.chatId, message.messageId] : [],
    );
    expect(await pending(behind.id)).toHaveLength(0);
    expect(await pending(current.id)).toHaveLength(0);
  });

  it('worker gives up after too many attempts', async () => {
    const game = await newGame();
    await enqueueRender(db, game.id);
    await db
      .from('message_renders')
      .update({ attempts: MAX_RENDER_ATTEMPTS })
      .eq('game_id', game.id);
    const { api, editMessageText } = fakeApi();
    await makeDue(game.id);
    await processRenders(api, db, views);
    expect(editMessageText).not.toHaveBeenCalled();
    expect(await pending(game.id)).toHaveLength(0);
  });

  it('expires abandoned games, bumps the version and queues their messages', async () => {
    const invitation = await newGame('waiting');
    const idle = await newGame('playing');
    const active = await newGame('playing');
    const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();
    await db
      .from('games')
      .update({ updated_at: ago(25) })
      .eq('id', invitation.id);
    await db
      .from('games')
      .update({ updated_at: ago(8 * 24) })
      .eq('id', idle.id);
    await db
      .from('games')
      .update({ updated_at: ago(25) })
      .eq('id', active.id);

    expect(await expireGames(db)).toBeGreaterThanOrEqual(2);
    const load = (id: string) => findGame<State>(db, ticTacToe.type, id);
    const [inv, old, live] = await Promise.all([
      load(invitation.id),
      load(idle.id),
      load(active.id),
    ]);
    expect(inv).toMatchObject({ status: 'expired', version: invitation.version + 1, mode: null });
    expect(old).toMatchObject({ status: 'expired', version: idle.version + 1 });
    expect(live?.status).toBe('playing');
    expect(await pending(invitation.id)).toHaveLength(1);
    expect(await pending(idle.id)).toHaveLength(1);
    expect(await pending(active.id)).toHaveLength(0);
  });
});
