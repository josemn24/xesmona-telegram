# xesmona-telegram

Xesmona Telegram bots and Mini Apps. Vision and architecture in
[docs/project-overview.md](docs/project-overview.md).

## Requirements

- Node 24 LTS (`.nvmrc`) and an up-to-date corepack (`npm i -g corepack@latest` if the pnpm
  signature check fails).
- Docker (for local Supabase) and the [Supabase CLI](https://supabase.com/docs/guides/cli).
- A **test** bot created with [@BotFather](https://t.me/BotFather) (don't use the production one).

## Getting started

```bash
corepack enable
pnpm install
cp .env.example .env   # fill in BOT_GAMES_TOKEN
pnpm db:start          # local Supabase; copy its URL and service_role key into .env
pnpm db:reset          # applies migrations and seed
pnpm dev
```

- Server: http://localhost:3000/health
- Mini App: http://localhost:5173/apps/games/ (outside Telegram the environment is mocked)
- Send `/ping` to the bot in Telegram: it replies `pong`. `/play` starts a tic-tac-toe game.

## Database changes

The schema lives in `supabase/schemas/` (declarative schemas). To change it:

1. Edit the files in `supabase/schemas/`.
2. `pnpm db:diff <name>` generates `supabase/migrations/<timestamp>_<name>.sql`; review it.
3. `pnpm db:reset` applies it locally and `pnpm db:types` regenerates the TypeScript types.

`db diff` doesn't capture everything (e.g. function privileges): add those as a hand-written
migration explaining why.

## Testing the Mini App inside Telegram

Telegram requires HTTPS. Expose Vite through a tunnel and register the URL in BotFather:

```bash
cloudflared tunnel --url http://localhost:5173
```

1. In @BotFather: `/newapp`, pick the bot and use `https://<tunnel>/apps/games/` as the URL.
2. Put the resulting direct link (`https://t.me/<bot>/<app>`) in `BOT_GAMES_MINIAPP_URL`.
3. Send `/start` to the bot and tap "Open games".

## Scripts

| Script                      | What it does                                   |
| --------------------------- | ---------------------------------------------- |
| `pnpm dev`                  | Server + Mini App in development mode          |
| `pnpm check`                | Lint, typecheck, tests and build (same as CI)  |
| `pnpm format`               | Formats with Prettier                          |
| `pnpm db:start` / `db:stop` | Starts/stops local Supabase                    |
| `pnpm db:reset`             | Recreates the DB applying migrations and seed  |
| `pnpm db:diff <name>`       | Generates a migration from `supabase/schemas/` |
| `pnpm db:types`             | Generates TS types from the schema             |

## Deployment (pending)

Railway: build `pnpm install --frozen-lockfile && pnpm build`, start
`pnpm --filter @xesmona/server start`, with `BOT_MODE=webhook`, `PUBLIC_URL` and
`BOT_<ID>_WEBHOOK_SECRET` set. Supabase Cloud in an EU region.
