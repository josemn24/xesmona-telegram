# ADR 0010: Message render queue, background worker and game expiry

- Status: accepted (2026-11-15)
- Amends: ADR 0008 (the queue is a table, not Supabase Queues)

## Context

ADR 0008 measured Telegram's limits: about 20 messages plus edits per minute per group, and a
429 with `retry_after` around 40 s when a chat goes over. Until now a failed edit was only
logged, so the chat message could stay behind the game until the next successful edit, and
when a Mini App game ended during a cooldown the result might never be shown. ADR 0008
planned a per-chat queue on Supabase Queues (pgmq) that honours `retry_after` and coalesces
edits by message.

Phase 3 also needs abandoned games to end. Invitations nobody accepts and games nobody plays
stay `waiting` or `playing` forever, with buttons that still look live.

## Decision

**Renders, not edits.** Every edit already renders the whole message from the latest database
state. So a pending edit is just "this game's message is behind", not a list of edits to replay.

- `message_renders` holds one row per game. Queuing a render again upserts the same row, which
  is the coalescing ADR 0008 asks for. pgmq can't deduplicate messages, so we use a plain
  table instead of Supabase Queues.
- `games.rendered_version` records the version the message is known to show. A render is done
  when `rendered_version >= version`. `mark_rendered` never moves it back.
- Handlers still edit right away (`renderGame` in `apps/bot-games/src/games/render.ts`):
  - on success or "message is not modified": mark the version as rendered;
  - on **429**: start the chat's cooldown and queue the render for after `retry_after`. Nothing
    waits inside a handler;
  - on **400/403** (message deleted, bot removed): drop it, since it won't work later either;
  - on anything else: queue it with backoff (5 s doubling, at most 10 minutes).
- **Cooldowns per chat** use the rate-limit bucket: `chat:<chat_id>` for chat messages and
  `inline:<chat_instance>` for inline messages (ADR 0006, ADR 0008). While a chat is cooling
  down, renders for any game in it are queued without calling Telegram. Cooldowns live in the
  server's memory. There's one process (ADR 0002), and after a restart the worst case is one
  more 429, which sets the cooldown again.
- Edits that don't show a game's state (the level picker) have nothing to queue. A 429 there
  only starts the cooldown.

**Background worker.** `BotDefinition` gets an optional `start()` that returns a stop function.
The server calls it once it's listening and awaits the stop function on shutdown. The games
bot uses it for one worker:

- every 2 s, `claim_renders` leases due rows (`for update skip locked`, 30 s lease), and the
  worker renders each from the game's current row. It gives up after 10 attempts;
- every 10 minutes, `expire_games()` runs.

pg_cron isn't used: keeping all jobs in one place means the SQL and the worker are covered by
the same DB tests. Two instances (e.g. during a rolling deploy) are safe, because claims are
leased and renders are idempotent.

**Expiry.** A new status, `expired`, with no winner (there are no rankings yet):

- `waiting` games expire 24 h after their last change, and `playing` games after 7 days;
- expiring bumps `version`. The Realtime trigger tells open Mini Apps, and buttons that still
  show the old version are rejected as stale;
- games with a message get a queued render. Expired invitations say so and lose their buttons.
  Expired games show the board and offer a rematch.

## Consequences

- A rate-limited chat catches up with one edit per game after `retry_after`, however many moves
  happened meanwhile.
- The webhook path never waits on Telegram's limits. The cost is one extra RPC
  (`mark_rendered`) per successful edit.
- Moving to several server instances needs the cooldowns in the database (a `chat_cooldowns`
  table). The queue itself already works across instances.
- Editing very old messages (Phase 0 check G6) may fail. If it does, the expiry render is
  dropped and logged, and the game is still expired in the database.
- Thresholds (24 h, 7 days) are SQL defaults of `expire_games`. Turn timers and forfeits can
  come with rankings.
