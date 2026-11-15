// Runs against the local Supabase (`pnpm db:start`); skipped when it isn't configured (CI).
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@xesmona/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initialState } from '@xesmona/games/tic-tac-toe';
import {
  BOT_PLAYER_NAME,
  createGame,
  findGame,
  joinGame,
  saveGame,
  upsertUser,
  type Game,
} from './store';

const envFile = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;

// Ids far from real Telegram ids, removed after the run.
const ADA = { id: 9_000_000_001, is_bot: false, first_name: 'Ada' };
const BEN = { id: 9_000_000_002, is_bot: false, first_name: 'Ben', username: 'ben' };
const CY = { id: 9_000_000_003, is_bot: false, first_name: 'Cy' };

describe.skipIf(!url || !key)('tic-tac-toe store (local database)', () => {
  const db = createClient<Database>(url ?? '', key ?? '', { auth: { persistSession: false } });
  const created: string[] = [];

  async function newGame(input: Partial<Parameters<typeof createGame>[1]> = {}): Promise<Game> {
    const game = await createGame(db, {
      botId: 'games',
      createdBy: ADA.id,
      status: 'waiting',
      state: initialState(0),
      players: [{ seat: 0, kind: 'human', telegramUserId: ADA.id, displayName: 'Ada' }],
      ...input,
    });
    if (!game) throw new Error('no game');
    created.push(game.id);
    return game;
  }

  beforeAll(async () => {
    for (const user of [ADA, BEN, CY]) await upsertUser(db, user);
  });

  afterAll(async () => {
    await db.from('games').delete().in('id', created);
    await db.from('telegram_users').delete().in('id', [ADA.id, BEN.id, CY.id]);
  });

  it('only one of two saves with the same version wins, and moves get versions', async () => {
    const game = await newGame({
      status: 'playing',
      mode: 'vs_bot',
      botLevel: 'easy',
      players: [
        { seat: 0, kind: 'human', telegramUserId: ADA.id, displayName: 'Ada' },
        { seat: 1, kind: 'bot', displayName: BOT_PLAYER_NAME },
      ],
    });
    const save = (cell: number) =>
      saveGame(db, game, {
        state: { cells: game.state.cells.map((c, i) => (i === cell ? 0 : c)), turn: 1 },
        status: 'playing',
        round: 0,
        moves: [
          { seat: 0, cell },
          { seat: 1, cell: 8 },
        ],
      });
    const results = await Promise.all([save(0), save(1)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(results.find(Boolean)?.version).toBe(game.version + 2);

    const { data: moves } = await db
      .from('game_moves')
      .select('version, seat')
      .eq('game_id', game.id)
      .order('version');
    expect(moves).toEqual([
      { version: 1, seat: 0 },
      { version: 2, seat: 1 },
    ]);
  });

  it('only one of two players can join a waiting game', async () => {
    const game = await newGame();
    const results = await Promise.all([
      joinGame(db, game, BEN, initialState(0)),
      joinGame(db, game, CY, initialState(0)),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const joined = await findGame(db, game.id);
    expect(joined?.status).toBe('playing');
    expect(joined?.players).toHaveLength(2);
  });

  it('two first taps on the same inline message create one game', async () => {
    const inlineMessageId = `test-${Date.now()}`;
    const input = {
      status: 'playing' as const,
      mode: 'pvp' as const,
      inlineMessageId,
      players: [
        { seat: 0 as const, kind: 'human' as const, telegramUserId: ADA.id, displayName: 'Ada' },
        { seat: 1 as const, kind: 'human' as const, telegramUserId: BEN.id, displayName: '@ben' },
      ],
    };
    const results = await Promise.allSettled([newGame(input), newGame(input)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});
