import { startingSeat, type Seat } from '@xesmona/games';
import { fourInARow } from '@xesmona/games/four-in-a-row';
import { hapticFeedback, miniApp } from '@tma.js/sdk-react';
import { Board, DISC_COLORS } from './Board';
import { useGame } from './useGame';

const LEVEL_NAMES = { easy: 'Easy', normal: 'Normal', hard: 'Hard' } as const;

function tap() {
  if (hapticFeedback.impactOccurred.isAvailable()) hapticFeedback.impactOccurred('light');
}

export function GameScreen({ gameId }: { gameId: string }) {
  const { snapshot, loadError, notice, channel, sending, play } = useGame(gameId);

  if (!snapshot) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-4 text-center">
        <p className="text-tg-hint">{loadError ?? 'Loading the game…'}</p>
      </main>
    );
  }

  const starting = startingSeat(snapshot.mode ?? 'pvp', snapshot.round);
  const outcome = fourInARow.outcome(snapshot.state);
  const turn = snapshot.state.turn;
  const myTurn = snapshot.status === 'playing' && snapshot.you === turn && outcome === null;
  const player = (seat: Seat) => snapshot.players.find((p) => p.seat === seat);
  const nameOf = (seat: Seat) => {
    const p = player(seat);
    if (!p) return '…';
    if (p.kind === 'bot') {
      return `Bot${snapshot.botLevel ? ` (${LEVEL_NAMES[snapshot.botLevel]})` : ''}`;
    }
    return seat === snapshot.you ? `${p.displayName} (you)` : p.displayName;
  };
  const colorOf = (seat: Seat) => (seat === starting ? DISC_COLORS.red : DISC_COLORS.yellow);

  const winner =
    snapshot.winnerSeat ?? (outcome !== null && outcome !== 'draw' ? outcome.winner : null);
  const isDraw = snapshot.result === 'draw' || outcome === 'draw';

  let status: string;
  if (snapshot.status === 'waiting') status = 'Waiting for players…';
  else if (snapshot.status === 'finished' || outcome !== null) {
    if (isDraw) status = 'Draw! 🤝';
    else if (winner === null) status = 'Game over';
    else if (winner === snapshot.you) status = 'You win! 🎉';
    else if (player(winner)?.kind === 'bot') status = 'The bot wins! 🤖';
    else status = `${player(winner)?.displayName ?? '?'} wins!`;
  } else if (snapshot.you === null) status = `${nameOf(turn)} to move · watching`;
  else status = myTurn ? (sending ? 'Sending…' : 'Your turn') : `Waiting for ${nameOf(turn)}…`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center justify-between gap-2 text-sm">
        {([starting, starting === 0 ? 1 : 0] as Seat[]).map((seat) => (
          <span
            key={seat}
            className={`flex min-w-0 items-center gap-2 rounded-full px-3 py-1 ${
              seat === turn && outcome === null ? 'bg-tg-secondary font-semibold' : ''
            }`}
          >
            <span
              className="size-3 shrink-0 rounded-full"
              style={{ background: colorOf(seat) }}
              aria-hidden
            />
            <span className="truncate">{nameOf(seat)}</span>
          </span>
        ))}
      </header>

      <Board
        state={snapshot.state}
        starting={starting}
        outcome={outcome}
        round={snapshot.round}
        canPlay={myTurn && !sending}
        onPlay={(column) => {
          tap();
          void play(column);
        }}
      />

      <p className="text-center text-lg font-semibold" aria-live="polite">
        {status}
      </p>
      {notice && <p className="text-tg-hint text-center text-sm">{notice}</p>}
      {channel === 'offline' && snapshot.status === 'playing' && (
        <p className="text-tg-hint text-center text-xs">
          Live updates paused; the board refreshes when you come back.
        </p>
      )}
      {snapshot.status === 'finished' && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-tg-hint text-center text-sm">Tap Rematch in the chat to play again.</p>
          {miniApp.close.isAvailable() && (
            <button
              type="button"
              className="bg-tg-button text-tg-button-text rounded-xl px-4 py-2"
              onClick={() => miniApp.close()}
            >
              Back to the chat
            </button>
          )}
        </div>
      )}
    </main>
  );
}
