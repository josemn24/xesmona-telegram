import { initData, miniApp, useSignal } from '@tma.js/sdk-react';
import { useEffect, useState } from 'react';

type Health = { ok: boolean; bots: string[] } | 'error' | 'loading';

export function App() {
  const user = useSignal(initData.user);
  const startParam = useSignal(initData.startParam);
  const chatType = useSignal(initData.chatType);
  const isDark = useSignal(miniApp.isDark);
  const [health, setHealth] = useState<Health>('loading');

  useEffect(() => {
    fetch('/health')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { ok: boolean; bots: string[] }) => setHealth(data))
      .catch(() => setHealth('error'));
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <h1 className="text-2xl font-bold">Xesmona Games</h1>
      <p className="text-tg-hint">Set up mínimo: aún no hay juegos.</p>

      <section className="bg-tg-secondary rounded-2xl p-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-tg-hint">Usuario</dt>
          <dd>{user ? `${user.first_name}${user.username ? ` (@${user.username})` : ''}` : '—'}</dd>
          <dt className="text-tg-hint">start_param</dt>
          <dd>{startParam ?? '—'}</dd>
          <dt className="text-tg-hint">Chat</dt>
          <dd>{chatType ?? '—'}</dd>
          <dt className="text-tg-hint">Tema</dt>
          <dd>{isDark ? 'oscuro' : 'claro'}</dd>
          <dt className="text-tg-hint">Servidor</dt>
          <dd>
            {health === 'loading'
              ? 'comprobando…'
              : health === 'error'
                ? 'sin conexión'
                : `ok · bots: ${health.bots.join(', ') || 'ninguno'}`}
          </dd>
        </dl>
      </section>
    </main>
  );
}
