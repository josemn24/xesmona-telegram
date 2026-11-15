// Runs against the local Supabase (`pnpm db:start`); skipped when it isn't configured (CI).
// The generic store with a game other than tic-tac-toe.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@xesmona/contracts';
import { fourInARow, type State } from '@xesmona/games/four-in-a-row';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BOT_PLAYER_NAME, createGame, findGame, saveGame, upsertUser } from './store';

const envFile = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;

// Ids far from real Telegram ids, removed after the run.
const ADA = { id: 9_000_000_021, first_name: 'Ada' };

describe.skipIf(!url || !key)('game store with four in a row (local database)', () => {
  const db = createClient<Database>(url ?? '', key ?? '', { auth: { persistSession: false } });
  const created: string[] = [];

  beforeAll(() => upsertUser(db, ADA));

  afterAll(async () => {
    await db.from('games').delete().in('id', created);
    await db.from('telegram_users').delete().eq('id', ADA.id);
  });

  it('saves one of two moves with the same version, in the engine format', async () => {
    const game = await createGame<State>(db, {
      botId: 'games',
      gameType: fourInARow.type,
      createdBy: ADA.id,
      status: 'playing',
      mode: 'vs_bot',
      botLevel: 'easy',
      state: fourInARow.initialState(0),
      players: [
        { seat: 0, kind: 'human', telegramUserId: ADA.id, displayName: 'Ada' },
        { seat: 1, kind: 'bot', displayName: BOT_PLAYER_NAME },
      ],
    });
    if (!game) throw new Error('no game');
    created.push(game.id);
    expect(game.message).toBeNull();

    const save = (column: number) => {
      const result = fourInARow.applyMove(game.state, 0, column);
      if (!result.ok) throw new Error(result.reason);
      return saveGame(db, game, {
        state: result.state,
        status: 'playing',
        round: 0,
        moves: [{ seat: 0, move: fourInARow.encodeMove(column) }],
      });
    };
    const results = await Promise.all([save(2), save(4)]);
    expect(results.filter(Boolean)).toHaveLength(1);

    const { data: moves } = await db
      .from('game_moves')
      .select('version, move')
      .eq('game_id', game.id);
    expect(moves).toHaveLength(1);
    expect(fourInARow.parseMove(moves?.[0]?.move)).toBeTypeOf('number');
  });

  it('does not load a game as another game type', async () => {
    const [id] = created;
    expect(await findGame(db, fourInARow.type, id ?? '')).toBeDefined();
    expect(await findGame(db, 'tic-tac-toe', id ?? '')).toBeUndefined();
  });
});
