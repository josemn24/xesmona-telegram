// Runs against the local Supabase (`pnpm db:start`); skipped when it isn't configured (CI).
// Checks supabase/schemas/30_realtime.sql: only a game's players receive its broadcasts.
import { createHmac } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@xesmona/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const envFile = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
const isLocal = !!url && /^http:\/\/(127\.0\.0\.1|localhost):/.test(url);
// The Supabase CLI's fixed local JWT secret (`supabase status -o env`, JWT_SECRET).
const jwtSecret =
  process.env.SUPABASE_JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long';
// The Mini App's key (`supabase status`, Publishable). Not the service role key: with it as
// `apikey` Realtime skips the policies and anyone can join.
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

// Ids far from real Telegram ids, removed after the run.
const ADA = 9_000_000_011;
const OUTSIDER = 9_000_000_012;

/** HS256 JWT like the one the server will sign for a player. */
function signJwt(sub: number): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    role: 'authenticated',
    aud: 'authenticated',
    sub: String(sub),
    iat: now,
    exp: now + 600,
  })}`;
  return `${body}.${createHmac('sha256', jwtSecret).update(body).digest('base64url')}`;
}

describe.skipIf(!url || !key)('game realtime (local database)', () => {
  const db = createClient<Database>(url ?? '', key ?? '', { auth: { persistSession: false } });
  let gameId = '';

  beforeAll(async () => {
    const { error } = await db.from('telegram_users').upsert([
      { id: ADA, first_name: 'Ada' },
      { id: OUTSIDER, first_name: 'Outsider' },
    ]);
    if (error) throw error;
    const { data, error: createError } = await db.rpc('create_game', {
      p_bot_id: 'games',
      p_game_type: 'four-in-a-row',
      p_created_by: ADA,
      p_status: 'playing',
      p_state: { test: 0 },
      p_mode: 'vs_bot',
      p_bot_level: 'easy',
      p_players: [
        { seat: 0, kind: 'human', telegram_user_id: ADA, display_name: 'Ada' },
        { seat: 1, kind: 'bot', display_name: 'Bot' },
      ],
    });
    if (createError) throw createError;
    if (!data) throw new Error('no game');
    gameId = data.id;
  });

  afterAll(async () => {
    if (gameId) await db.from('games').delete().eq('id', gameId);
    await db.from('telegram_users').delete().in('id', [ADA, OUTSIDER]);
  });

  it('is_game_player is true for a player and false for an outsider', async () => {
    const player = await db.rpc('is_game_player', { p_game_id: gameId, p_user_id: ADA });
    const outsider = await db.rpc('is_game_player', { p_game_id: gameId, p_user_id: OUTSIDER });
    expect(player.data).toBe(true);
    expect(outsider.data).toBe(false);
  });

  it.skipIf(!isLocal)(
    'only players receive the private game broadcast',
    async () => {
      const clients: SupabaseClient[] = [];
      const received: Record<string, unknown[]> = { player: [], outsider: [] };

      /** Resolves with the final subscribe status (SUBSCRIBED or an error status). */
      async function subscribe(name: string, sub: number): Promise<string> {
        const client = createClient(url ?? '', publishableKey, { auth: { persistSession: false } });
        clients.push(client);
        // Before subscribing: otherwise the join is authorized with the key's (anon) claims.
        await client.realtime.setAuth(signJwt(sub));
        const channel: RealtimeChannel = client
          .channel(`game:${gameId}`, { config: { private: true } })
          .on('broadcast', { event: 'game' }, ({ payload }) => received[name]?.push(payload));
        return new Promise((resolve) => {
          channel.subscribe((status) => {
            if (status !== 'CLOSED') resolve(status);
          });
        });
      }

      try {
        const [playerStatus, outsiderStatus] = await Promise.all([
          subscribe('player', ADA),
          subscribe('outsider', OUTSIDER),
        ]);
        expect(playerStatus).toBe('SUBSCRIBED');
        // Realtime refuses the join when the select policy denies it.
        expect(outsiderStatus).not.toBe('SUBSCRIBED');

        const { data, error } = await db.rpc('save_game', {
          p_game_id: gameId,
          p_expected_version: 0,
          p_state: { test: 1 },
          p_status: 'playing',
          p_round: 0,
          p_moves: [{ seat: 0, move: { column: 3 } }],
        });
        if (error) throw error;
        expect(data?.version).toBe(1);

        const deadline = Date.now() + 5000;
        while (received.player?.length === 0 && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        expect(received.player).toEqual([
          expect.objectContaining({
            version: 1,
            state: { test: 1 },
            status: 'playing',
            result: null,
            winner_seat: null,
            round: 0,
            mode: 'vs_bot',
          }),
        ]);
        expect(received.outsider).toEqual([]);
      } finally {
        await Promise.all(clients.map((client) => client.removeAllChannels()));
      }
    },
    15_000,
  );
});
