# xesmona-telegram

Monorepo de bots de Telegram y Mini Apps de Xesmona. Visión, stack y roadmap en
[docs/project-overview.md](docs/project-overview.md); decisiones en [docs/adr/](docs/adr/).

## Comandos

- Node 24 (`.nvmrc`) y pnpm por corepack (`packageManager` en package.json).
- `pnpm dev`: servidor (Hono + bots en long polling, :3000) y Mini App (Vite, :5173/apps/games/).
- `pnpm check`: lint + typecheck + test + build (lo mismo que la CI).
- `pnpm --filter <paquete> <script>`: un solo workspace, p. ej. `pnpm --filter @xesmona/telegram-auth test`.
- `pnpm db:start | db:reset | db:types`: Supabase local (requiere Docker).
- `pnpm format`: Prettier.

## Estructura

- `apps/server`: único proceso Node. API Hono, webhooks `/webhook/<botId>`, registro de bots
  (`src/bots.ts`), estáticos de Mini Apps en `/apps/<nombre>/`.
- `apps/bot-<id>`: definición de cada bot (`defineBot`); no arranca procesos.
- `apps/miniapp-<nombre>`: SPA Vite + React + Tailwind + `@tma.js/sdk-react`.
- `packages/contracts`: esquemas Zod de entorno, `BotDefinition` y contratos compartidos.
- `packages/telegram-auth`: validación de `initData` (+ `./testing` con `signInitData`).
- `packages/config`: tsconfig compartidos.
- `supabase/`: migraciones SQL versionadas y seed.

## Reglas

- El servidor es la autoridad: nunca confíes en el cliente ni en `initDataUnsafe`.
- Los motores de juego son funciones puras sin dependencias de React, grammY ni Supabase.
- No crees abstracciones ni paquetes nuevos hasta que haya un segundo caso real.
- En grupos, la Mini App se abre con botones `url` + direct link, no con botones `web_app`.
- Variables de un bot con prefijo `BOT_<ID>_`; documenta cualquier variable nueva en `.env.example`.
- Secretos solo en servidor y nunca en git.
- Imports relativos sin extensión; paquetes internos como `@xesmona/<nombre>`.
- Textos de usuario en español por ahora; cuando haya i18n, se usará `language_code` de Telegram.
