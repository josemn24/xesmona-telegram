# xesmona-telegram

Monorepo of Xesmona Telegram bots and Mini Apps. Vision, stack and roadmap in
[docs/project-overview.md](docs/project-overview.md); decisions in [docs/adr/](docs/adr/).

## Commands

- Node 24 (`.nvmrc`) and pnpm via corepack (`packageManager` in package.json).
- `pnpm dev`: server (Hono + bots in long polling, :3000) and Mini App (Vite, :5173/apps/games/).
- `pnpm check`: lint + typecheck + test + build (same as CI).
- `pnpm --filter <package> <script>`: a single workspace, e.g. `pnpm --filter @xesmona/telegram-auth test`.
- `pnpm db:start | db:reset | db:types`: local Supabase (requires Docker).
- `pnpm format`: Prettier.

## Structure

- `apps/server`: the only Node process. Hono API, `/webhook/<botId>` webhooks, bot registry
  (`src/bots.ts`), Mini App static files at `/apps/<name>/`.
- `apps/bot-<id>`: each bot's definition (`defineBot`); starts no processes.
- `apps/miniapp-<name>`: Vite + React + Tailwind + `@tma.js/sdk-react` SPA.
- `packages/contracts`: Zod env schemas, `BotDefinition` and shared contracts.
- `packages/telegram-auth`: `initData` validation (+ `./testing` with `signInitData`).
- `packages/config`: shared tsconfigs.
- `supabase/`: versioned SQL migrations and seed.

## Rules

- The server is the authority: never trust the client or `initDataUnsafe`.
- Game engines are pure functions with no dependency on React, grammY or Supabase.
- Don't create new abstractions or packages until there is a second real case.
- In groups, the Mini App opens with `url` buttons + direct link, not `web_app` buttons.
- Bot variables use the `BOT_<ID>_` prefix; document any new variable in `.env.example`.
- Secrets only on the server and never in git.
- Relative imports without extension; internal packages as `@xesmona/<name>`.
- Code, comments, logs and docs in English.
- User-facing texts in English for now; when i18n arrives, use Telegram's `language_code`.
