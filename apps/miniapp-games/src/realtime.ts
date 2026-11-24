// Live game updates through Supabase Realtime (ADR 0009). The server hands out a short-lived
// JWT for the player; RLS on realtime.messages only lets the game's players join `game:<id>`.
// The client never reads tables or sends broadcasts: moves go through the API.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GameBroadcast, SessionResponse } from '@xesmona/games/api';
import { api } from './api';

/** Refresh the token this long before it expires. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

let session: SessionResponse | undefined;
let pending: Promise<SessionResponse> | undefined;
let client: SupabaseClient | undefined;

async function getSession(): Promise<SessionResponse> {
  if (session && session.expiresAt * 1000 - Date.now() > REFRESH_MARGIN_MS) return session;
  pending ??= api<SessionResponse>('/session', { method: 'POST' }).finally(() => {
    pending = undefined;
  });
  session = await pending;
  return session;
}

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * In development the server's Supabase is on this machine's loopback, which a page opened in
 * Telegram through the tunnel can't reach. Then Realtime goes through the page's own origin,
 * proxied by Vite (vite.config.ts). Production URLs are never loopback.
 */
function reachableUrl(supabaseUrl: string): string {
  const pageIsLocal = LOOPBACK.has(window.location.hostname);
  if (import.meta.env.DEV && LOOPBACK.has(new URL(supabaseUrl).hostname) && !pageIsLocal) {
    return window.location.origin;
  }
  return supabaseUrl;
}

async function getClient(): Promise<SupabaseClient> {
  const { supabaseUrl, publishableKey } = await getSession();
  // Loaded on demand: most of the bundle, and only game screens need it (ADR 0003).
  const { createClient } = await import('@supabase/supabase-js');
  // `accessToken` gives Realtime our token (and refreshes it); there's no Supabase Auth user.
  client ??= createClient(reachableUrl(supabaseUrl), publishableKey, {
    accessToken: async () => (await getSession()).token,
  });
  return client;
}

export type ChannelStatus = 'connecting' | 'live' | 'offline';

/** Backoff between our own rejoin attempts: 1 s, 2 s, 4 s… capped at 30 s. */
const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 30 * 1000;

/**
 * Listens to a game's broadcasts. `onStatus('live')` fires on every (re)subscribe, so the
 * caller can fetch a fresh snapshot for anything missed while offline. Returns an unsubscribe.
 *
 * When the channel closes, errors or times out we drop it and join a fresh one with capped
 * exponential backoff (with a fresh token), instead of relying only on supabase-js's rejoin.
 */
export function subscribeToGame<State>(
  gameId: string,
  onBroadcast: (payload: GameBroadcast<State>) => void,
  onStatus: (status: ChannelStatus) => void,
): () => void {
  let stopped = false;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  // Removes the current channel; resolves once supabase-js has forgotten it, since it hands
  // back an existing channel with the same topic instead of creating a new one.
  let removeCurrent: (() => Promise<unknown>) | undefined;
  let removing: Promise<unknown> = Promise.resolve();

  const dropCurrent = () => {
    const remove = removeCurrent;
    removeCurrent = undefined;
    if (remove) removing = remove().catch(() => {});
  };

  const scheduleRetry = () => {
    if (stopped || retryTimer !== undefined) return;
    dropCurrent();
    const delay = Math.min(RETRY_MIN_MS * 2 ** attempt, RETRY_MAX_MS);
    attempt += 1;
    console.debug('[miniapp] realtime retry in', delay, 'ms', gameId);
    retryTimer = setTimeout(() => {
      retryTimer = undefined;
      void connect();
    }, delay);
  };

  async function connect() {
    try {
      await removing;
      const supabase = await getClient();
      // Authorize before joining: otherwise the join uses the publishable key's (anon) claims.
      await supabase.realtime.setAuth((await getSession()).token);
      if (stopped) return;
      const channel = supabase
        .channel(`game:${gameId}`, { config: { private: true } })
        .on('broadcast', { event: 'game' }, ({ payload }) => {
          const update = payload as GameBroadcast<State>;
          console.debug('[miniapp] realtime update', gameId, update.version);
          onBroadcast(update);
        });
      const remove = () => supabase.removeChannel(channel);
      removeCurrent = remove;
      channel.subscribe((status, error) => {
        console.debug('[miniapp] realtime', gameId, status, error?.message ?? '');
        // Ignore a channel we already dropped (removing it reports CLOSED).
        if (stopped || removeCurrent !== remove) return;
        if (status === 'SUBSCRIBED') {
          attempt = 0;
          onStatus('live');
          return;
        }
        // CLOSED, CHANNEL_ERROR or TIMED_OUT.
        onStatus('offline');
        scheduleRetry();
      });
    } catch (error) {
      console.warn('[miniapp] realtime unavailable', error);
      if (stopped) return;
      onStatus('offline');
      scheduleRetry();
    }
  }

  onStatus('connecting');
  void connect();

  return () => {
    stopped = true;
    clearTimeout(retryTimer);
    dropCurrent();
  };
}
