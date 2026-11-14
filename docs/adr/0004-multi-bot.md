# ADR 0004: Several bots in one process

- Status: accepted (2026-11-14)

## Context

Xesmona will have several bots (games, polls, community…) with their own branding and
configuration.

## Decision

- Each bot lives in `apps/bot-<id>` and exports a `BotDefinition` (`@xesmona/contracts`).
- `apps/server` keeps a static bot registry, creates one grammY instance per bot and exposes
  `POST /webhook/<id>` (validating `X-Telegram-Bot-Api-Secret-Token`).
- Per-bot configuration with the `BOT_<ID>_` environment prefix (`TOKEN`, `WEBHOOK_SECRET`,
  `MINIAPP_URL`). A bot without a token is skipped at startup.
- Data carries a `bot_id`. One Mini App can serve several bots: the backend validates the
  `initData` with the token of the bot that opened it.

## Consequences

- Adding a bot = a new app + one line in the registry + environment variables.
- A serious failure in one bot affects the shared process; mitigation: a `bot.catch` per bot
  and, if needed, moving the bot to its own service.
