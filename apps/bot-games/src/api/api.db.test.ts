// Runs against the local Supabase (`pnpm db:start`); skipped when it isn't configured (CI).
// The games API end to end with signed initData (ADR 0007, ADR 0009).
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@xesmona/contracts';
import type { GameSnapshot, SessionResponse } from '@xesmona/games/api';
import { fourInARow, type State } from '@xesmona/games/four-in-a-row';
import { signInitData } from '@xesmona/telegram-auth/testing';
import type { Bot } from 'grammy';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOT_PLAYER_NAME,
  attachMessage,
  createGame,
  upsertUser,
  type Game,
  type NewPlayer,
} from '../games/store';
import { gamesApi } from '.';

const envFile = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;

const TOKEN = '123456:TEST-token_for-unit-tests';
const MINIAPP_URL = 'https://t.me/test_bot/games';
// Ids far from real Telegram ids, removed after the run.
const ADA = { id: 9_000_000_031, first_name: 'Ada' };
const BEN = { id: 9_000_000_032, first_name: 'Ben' };
const CY = { id: 9_000_000_033, first_name: 'Cy' };

describe.skipIf(!url || !key)('games API (local database)', () => {
  // Created in a hook: `skipIf` still runs this callback, and createClient throws without a URL.
  let db: SupabaseClient<Database>;
  beforeAll(() => {
    db = createClient<Database>(url ?? '', key ?? '', { auth: { persistSession: false } });
  });
  const editMessageText = vi.fn();
  const editMessageTextInline = vi.fn();
  const bot = { api: { editMessageText, editMessageTextInline } } as unknown as Bot;
  let app: ReturnType<typeof gamesApi>;
  beforeAll(() => {
    app = gamesApi(
      bot,
      { TOKEN, MINIAPP_URL },
      {
        db,
        realtime: {
          supabaseUrl: url ?? '',
          publishableKey: 'sb_publishable_test',
          jwtSecret: 'test-secret-with-at-least-32-characters!',
        },
      },
    );
  });
  const created: string[] = [];

  const auth = (user: { id: number; first_name: string }, authDate?: Date) => ({
    authorization: `tma ${signInitData({ user, ...(authDate && { authDate }) }, TOKEN)}`,
  });
  const move = (gameId: string, user: typeof ADA, body: unknown) =>
    app.request(`/four-in-a-row/${gameId}/moves`, {
      method: 'POST',
      headers: { ...auth(user), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  async function newGame(players: NewPlayer[], extra: { botLevel?: 'easy' } = {}) {
    const game = await createGame<State>(db, {
      botId: 'games',
      gameType: fourInARow.type,
      createdBy: ADA.id,
      status: 'playing',
      mode: extra.botLevel ? 'vs_bot' : 'pvp',
      ...extra,
      state: fourInARow.initialState(0),
      players,
    });
    if (!game) throw new Error('no game');
    created.push(game.id);
    return game;
  }
  const pvp = () =>
    newGame([
      { seat: 0, kind: 'human', telegramUserId: ADA.id, displayName: 'Ada' },
      { seat: 1, kind: 'human', telegramUserId: BEN.id, displayName: 'Ben' },
    ]);

  beforeAll(async () => {
    for (const user of [ADA, BEN, CY]) await upsertUser(db, user);
  });
  beforeEach(() => {
    editMessageText.mockReset();
    editMessageTextInline.mockReset();
  });
  afterAll(async () => {
    await db.from('games').delete().in('id', created);
    await db.from('telegram_users').delete().in('id', [ADA.id, BEN.id, CY.id]);
  });

  describe('initData', () => {
    it('opens a session with a Realtime token for the verified user', async () => {
      const res = await app.request('/session', { method: 'POST', headers: auth(ADA) });
      expect(res.status).toBe(200);
      const body = (await res.json()) as SessionResponse;
      expect(body.publishableKey).toBe('sb_publishable_test');
      const claims = JSON.parse(
        Buffer.from(body.token.split('.')[1] ?? '', 'base64url').toString(),
      ) as Record<string, unknown>;
      expect(claims).toMatchObject({ sub: String(ADA.id), role: 'authenticated' });
    });

    it('rejects missing, forged and expired initData', async () => {
      const post = (headers: Record<string, string>) =>
        app.request('/session', { method: 'POST', headers });
      expect((await post({})).status).toBe(401);
      const forged = `tma ${signInitData({ user: ADA }, '999:other')}`;
      expect(await (await post({ authorization: forged })).json()).toEqual({
        code: 'invalid_hash',
      });
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      expect(await (await post(auth(ADA, twoDaysAgo))).json()).toEqual({ code: 'expired' });
    });
  });

  describe('moves', () => {
    it('returns the snapshot with the caller seat, read only for outsiders', async () => {
      const game = await pvp();
      const get = async (user: typeof ADA) =>
        (await (
          await app.request(`/four-in-a-row/${game.id}`, { headers: auth(user) })
        ).json()) as GameSnapshot<State>;
      expect((await get(BEN)).you).toBe(1);
      expect((await get(CY)).you).toBeNull();
      const missing = await app.request('/four-in-a-row/not-a-uuid', { headers: auth(ADA) });
      expect(missing.status).toBe(404);
    });

    it('refuses outsiders, stale versions, wrong turns and illegal columns', async () => {
      const game = await pvp();
      expect((await move(game.id, CY, { version: 0, move: { column: 3 } })).status).toBe(403);
      expect((await move(game.id, ADA, { version: 5, move: { column: 3 } })).status).toBe(409);
      expect((await move(game.id, BEN, { version: 0, move: { column: 3 } })).status).toBe(409);
      expect((await move(game.id, ADA, { version: 0, move: { column: 9 } })).status).toBe(422);
      expect((await move(game.id, ADA, { version: 0 })).status).toBe(422);

      const ok = await move(game.id, ADA, { version: 0, move: { column: 3 } });
      expect(ok.status).toBe(200);
      expect(((await ok.json()) as GameSnapshot<State>).version).toBe(1);
    });

    it('vs bot saves the move and the bot reply as two versions', async () => {
      const game = await newGame(
        [
          { seat: 0, kind: 'human', telegramUserId: ADA.id, displayName: 'Ada' },
          { seat: 1, kind: 'bot', displayName: BOT_PLAYER_NAME },
        ],
        { botLevel: 'easy' },
      );
      const res = await move(game.id, ADA, { version: 0, move: { column: 0 } });
      const snapshot = (await res.json()) as GameSnapshot<State>;
      expect(snapshot.version).toBe(2);
      expect(snapshot.state.cells.filter((cell) => cell !== null)).toHaveLength(2);
      expect(snapshot.state.turn).toBe(0);
      const { data: moves } = await db.from('game_moves').select('seat').eq('game_id', game.id);
      expect(moves?.map((m) => m.seat).sort()).toEqual([0, 1]);
    });

    it('edits the chat message once, when the game ends', async () => {
      let game: Game<State> = await pvp();
      await attachMessage(db, game.id, -100123, 42);
      // Ada stacks column 0, Ben column 1: Ada's fourth disc wins.
      const plan: [typeof ADA, number][] = [
        [ADA, 0],
        [BEN, 1],
        [ADA, 0],
        [BEN, 1],
        [ADA, 0],
        [BEN, 1],
        [ADA, 0],
      ];
      let snapshot: GameSnapshot<State> | undefined;
      for (const [user, column] of plan) {
        const res = await move(game.id, user, {
          version: snapshot?.version ?? game.version,
          move: { column },
        });
        expect(res.status).toBe(200);
        snapshot = (await res.json()) as GameSnapshot<State>;
      }
      expect(snapshot).toMatchObject({ status: 'finished', result: 'win', winnerSeat: 0 });
      expect(editMessageText).toHaveBeenCalledTimes(1);
      expect(editMessageText.mock.calls[0]?.slice(0, 2)).toEqual([-100123, 42]);
      expect(String(editMessageText.mock.calls[0]?.[2])).toContain('Ada wins');
      game = { ...game, version: snapshot?.version ?? 0 };
      expect(
        (await move(game.id, BEN, { version: game.version, move: { column: 2 } })).status,
      ).toBe(409);
    });
  });
});
