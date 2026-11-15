# Deploying

One production environment (ADR 0002): a single Railway service running `apps/server` (API,
webhooks, workers and the Mini Apps' static files) and a Supabase Cloud project in the EU.
Local development stays on long polling with a test bot (see the README and `.env.example`).

## First-time setup

### 1. Supabase Cloud

1. Create a project in an EU region. Keep the database password in a password manager.
2. Link and apply the migrations from the repo root:

   ```bash
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push
   ```

   `db push` never runs `seed.sql`. Data every environment needs (the `games` bot row) is in a
   hand-written migration.

3. From the dashboard (Project Settings → API keys / JWT), collect:
   - the project URL → `SUPABASE_URL`
   - a secret key (or the legacy `service_role` key) → `SUPABASE_SERVICE_ROLE_KEY`
   - the publishable key → `SUPABASE_PUBLISHABLE_KEY`
   - the **legacy JWT secret** → `SUPABASE_JWT_SECRET`

   **Check this first:** ADR 0009 signs Mini App players' Realtime tokens with the HS256 JWT
   secret. Projects created with asymmetric JWT signing keys must still have the legacy secret
   available and trusted by Realtime. If they don't, Mini App games can't connect; amend ADR 0009
   before going further.

### 2. Production bot

Use a different bot from the local test bot.

1. In @BotFather, `/newbot`, then `/setinline` and `/setinlinefeedback` (enabled). Leave privacy
   mode on.
2. After the first Railway deploy (you need its domain), `/newapp` with the URL
   `https://<railway-domain>/apps/games/`. The direct link it gives, `https://t.me/<bot>/<app>`, is
   `BOT_GAMES_MINIAPP_URL`.

### 3. Railway

1. Create a project from this GitHub repository. `railway.json` selects the `Dockerfile` build,
   the `/health` healthcheck and one replica.
2. Generate a public domain for the service.
3. Set the variables:

   | Variable                    | Value                                                         |
   | --------------------------- | ------------------------------------------------------------- |
   | `NODE_ENV`                  | `production`                                                  |
   | `BOT_MODE`                  | `webhook`                                                     |
   | `PUBLIC_URL`                | `https://<railway-domain>`                                    |
   | `SUPABASE_URL`              | from step 1                                                   |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 1                                                   |
   | `SUPABASE_PUBLISHABLE_KEY`  | from step 1                                                   |
   | `SUPABASE_JWT_SECRET`       | from step 1                                                   |
   | `BOT_GAMES_TOKEN`           | production bot token                                          |
   | `BOT_GAMES_WEBHOOK_SECRET`  | random, 16–256 chars `[A-Za-z0-9_-]` (`openssl rand -hex 32`) |
   | `BOT_GAMES_MINIAPP_URL`     | direct link from step 2                                       |

   Railway sets `PORT`. On start the server registers each bot's webhook at
   `PUBLIC_URL/webhook/<id>`.

## Deploying a change

1. If the change has a migration, run `supabase db push` **before** the code that needs it goes
   live. Migrations must stay compatible with the running code for the few minutes of a deploy.
2. Push to `main`. Railway builds the image, waits for `/health` and switches traffic.

## Checking it works

- `https://<railway-domain>/health` answers `{"ok":true,"mode":"webhook","bots":["games"]}`.
- Webhook status (no `last_error_message`, `pending_update_count` near 0):

  ```bash
  curl -s "https://api.telegram.org/bot$BOT_GAMES_TOKEN/getWebhookInfo"
  ```

- Railway logs: `[bot:games] webhook registered at …` on start; `[bot:games] update took over …`
  means a handler is too slow (the update was answered with 200 and not redelivered).

## Rotating secrets

- **Webhook secret:** change `BOT_GAMES_WEBHOOK_SECRET` in Railway. The redeploy registers the
  webhook with the new secret.
- **Bot token:** `/revoke` in @BotFather, then update `BOT_GAMES_TOKEN`. Open Mini Apps fail
  validation until reopened, because initData is signed with the token.
- **Supabase JWT secret:** rotating it invalidates every player's Realtime token. The Mini Apps
  fetch a new one on their next session refresh.
