import { initData, miniApp, useSignal } from '@tma.js/sdk-react';
import { useEffect, useState } from 'react';

type Health = { ok: boolean; bots: string[] } | 'error' | 'loading';

// Phase 0 spike: remove in Phase 1.
type Whoami =
  { ok: true; user: { first_name: string; id: number } } | { ok: false; code: string } | 'loading';

export function App() {
  const user = useSignal(initData.user);
  const startParam = useSignal(initData.startParam);
  const chatType = useSignal(initData.chatType);
  const chatInstance = useSignal(initData.chatInstance);
  const rawInitData = useSignal(initData.raw);
  const isDark = useSignal(miniApp.isDark);
  const [health, setHealth] = useState<Health>('loading');
  const [whoami, setWhoami] = useState<Whoami>('loading');

  useEffect(() => {
    fetch('/health')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { ok: boolean; bots: string[] }) => setHealth(data))
      .catch(() => setHealth('error'));
  }, []);

  // Phase 0 spike: the server validates the original initData (never initDataUnsafe).
  useEffect(() => {
    fetch('/api/spike/whoami', {
      method: 'POST',
      headers: { Authorization: `tma ${rawInitData ?? ''}` },
    })
      .then((res) => res.json() as Promise<Exclude<Whoami, 'loading'>>)
      .then(setWhoami)
      .catch(() => setWhoami({ ok: false, code: 'offline' }));
  }, [rawInitData]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <h1 className="text-2xl font-bold">Xesmona Games</h1>
      <p className="text-tg-hint">Minimal setup: no games yet.</p>

      <section className="bg-tg-secondary rounded-2xl p-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-tg-hint">User</dt>
          <dd>{user ? `${user.first_name}${user.username ? ` (@${user.username})` : ''}` : '—'}</dd>
          <dt className="text-tg-hint">start_param</dt>
          <dd className="break-all">{startParam ?? '—'}</dd>
          <dt className="text-tg-hint">Chat</dt>
          <dd>{chatType ?? '—'}</dd>
          <dt className="text-tg-hint">chat_instance</dt>
          <dd className="break-all">{chatInstance ?? '—'}</dd>
          <dt className="text-tg-hint">Theme</dt>
          <dd>{isDark ? 'dark' : 'light'}</dd>
          <dt className="text-tg-hint">Server</dt>
          <dd>
            {health === 'loading'
              ? 'checking…'
              : health === 'error'
                ? 'offline'
                : `ok · bots: ${health.bots.join(', ') || 'none'}`}
          </dd>
          <dt className="text-tg-hint">Server check</dt>
          <dd data-testid="server-check">
            {whoami === 'loading'
              ? 'checking…'
              : whoami.ok
                ? `verified as ${whoami.user.first_name} (${whoami.user.id})`
                : whoami.code}
          </dd>
        </dl>
      </section>
    </main>
  );
}
