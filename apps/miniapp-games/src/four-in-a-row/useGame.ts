// State of one Four in a row game in the Mini App: snapshot from the API, live updates from
// Realtime, and optimistic moves with the shared engine. The server's answer always wins.
import type { GameSnapshot } from '@xesmona/games/api';
import { fourInARow, type State } from '@xesmona/games/four-in-a-row';
import { on } from '@tma.js/sdk-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../api';
import { subscribeToGame, type ChannelStatus } from '../realtime';

type Snapshot = GameSnapshot<State>;

const ERRORS: Record<string, string> = {
  stale: 'The board changed. Try again.',
  not_your_turn: "It's not your turn.",
  invalid_move: "You can't play there.",
  not_playing: 'The game is over.',
  offline: "Can't reach the server. Check your connection.",
  not_found: 'This game no longer exists.',
};

const SESSION_EXPIRED = 'This game session expired. Close and reopen the game.';

/** A message for the player; never the raw error code. */
function messageFor(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  // Every 401 comes from the initData check: expired (24 h max age), missing or invalid.
  // Only reopening the Mini App gets Telegram to sign a fresh one.
  if (error.status === 401) return SESSION_EXPIRED;
  return ERRORS[error.code] ?? fallback;
}

export function useGame(gameId: string) {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [loadError, setLoadError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [channel, setChannel] = useState<ChannelStatus>('connecting');
  const [sending, setSending] = useState(false);
  // The latest server version seen: older answers or broadcasts never overwrite newer state.
  const serverVersion = useRef(-1);

  const accept = useCallback((next: Snapshot) => {
    if (next.version < serverVersion.current) return;
    serverVersion.current = next.version;
    setSnapshot(next);
  }, []);

  // State is only set in the promise callbacks, never synchronously.
  const refresh = useCallback(
    () =>
      api<Snapshot>(`/four-in-a-row/${gameId}`).then(
        (next) => {
          // A refresh is the source of truth, even at the same version (drops optimistic state).
          if (next.version < serverVersion.current) return;
          serverVersion.current = next.version;
          setSnapshot(next);
          setLoadError(undefined);
        },
        (error: unknown) => {
          const message = messageFor(error, 'Something went wrong. Try again.');
          setLoadError(message);
          // With a board on screen loadError isn't shown, and an expired session won't recover.
          if (error instanceof ApiError && error.status === 401) setNotice(message);
        },
      ),
    [gameId],
  );

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribeToGame<State>(
      gameId,
      (payload) => {
        // Checked outside the updater: React may call updaters twice, so they stay pure.
        if (payload.version <= serverVersion.current) return;
        serverVersion.current = payload.version;
        setSnapshot((current) => {
          if (!current) return current;
          return {
            ...current,
            version: payload.version,
            state: payload.state,
            status: payload.status,
            result: payload.result,
            winnerSeat: payload.winner_seat,
            round: payload.round,
            mode: payload.mode,
          };
        });
      },
      (status) => {
        setChannel(status);
        // (Re)joined: fetch anything missed while the channel was down.
        if (status === 'live') void refresh();
      },
    );
    // Back from the background or a network drop: the broadcasts may have been missed.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onOnline = () => void refresh();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    // Telegram's `activated` event (`visibility_changed` in the SDK's bridge): desktop clients
    // don't always fire visibilitychange when the Mini App is selected again.
    const offActivated = on('visibility_changed', ({ is_visible }) => {
      if (is_visible) void refresh();
    });
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      offActivated();
    };
  }, [gameId, refresh]);

  const play = useCallback(
    async (column: number) => {
      if (!snapshot || snapshot.you === null || sending) return;
      const optimistic = fourInARow.applyMove(snapshot.state, snapshot.you, column);
      if (!optimistic.ok) {
        if (optimistic.reason === 'column_full') setNotice('That column is full.');
        return;
      }
      setNotice(undefined);
      setSending(true);
      setSnapshot({ ...snapshot, state: optimistic.state });
      try {
        accept(
          await api<Snapshot>(`/four-in-a-row/${gameId}/moves`, {
            method: 'POST',
            body: { version: snapshot.version, move: fourInARow.encodeMove(column) },
          }),
        );
      } catch (error) {
        setNotice(messageFor(error, 'Something went wrong. Try again.'));
        await refresh();
      } finally {
        setSending(false);
      }
    },
    [accept, gameId, refresh, sending, snapshot],
  );

  return { snapshot, loadError, notice, channel, sending, play };
}
