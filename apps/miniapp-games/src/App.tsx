import { initData, useSignal } from '@tma.js/sdk-react';
import { GameScreen } from './four-in-a-row/GameScreen';

/** `startapp` carries the game id as 32 hex chars (ADR 0007). */
const GAME_ID = /^[0-9a-f]{32}$/;

const fromHex = (hex: string) =>
  `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

export function App() {
  const startParam = useSignal(initData.startParam);

  if (startParam && GAME_ID.test(startParam)) return <GameScreen gameId={fromHex(startParam)} />;

  // Opened without a game (e.g. from the bot's private chat: no start_param, ADR 0007).
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 p-4 text-center">
      <h1 className="text-2xl font-bold">Xesmona Games</h1>
      <p className="text-tg-hint">
        Start a game from a chat: send <strong>/four</strong> in a group, or type the bot&apos;s
        name in any chat. Then tap <strong>Open game</strong>.
      </p>
    </main>
  );
}
