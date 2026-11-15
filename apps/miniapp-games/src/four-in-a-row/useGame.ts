// State of one Four in a row game in the Mini App: snapshot from the API, live updates from
// Realtime, and optimistic moves with the shared engine. The server's answer always wins.
import type { GameSnapshot } from '@xesmona/games/api';
import { fourInARow, type State } from '@xesmona/games/four-in-a-row';
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
};

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
          const code = error instanceof ApiError ? error.code : 'error';
          setLoadError(
            code === 'not_found' ? 'This game no longer exists.' : (ERRORS[code] ?? code),
          );
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
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
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
        const code = error instanceof ApiError ? error.code : 'error';
        setNotice(ERRORS[code] ?? 'Something went wrong. Try again.');
        await refresh();
      } finally {
        setSending(false);
      }
    },
    [accept, gameId, refresh, sending, snapshot],
  );

  return { snapshot, loadError, notice, channel, sending, play };
}
