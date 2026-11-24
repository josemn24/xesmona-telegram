# ADR 0011: Single-player games go in a separate bot

- Status: accepted (2026-11-15)
- Builds on: ADR 0004 (several bots in one process)

## Context

The `games` bot is multiplayer: two seats, turns, invitations in groups, versioned moves, play
vs bot and message renders in chats (ADRs 0005, 0006, 0009, 0010). Ideas for single-player games
have appeared (Wordle-style word games, Queens- and Zip-style puzzles). The question is whether
they belong in the same bot or in a second one.

The two kinds differ in what they need:

- **Multiplayer:** lives in groups, depends on inline mode, invitations, rematches, seats,
  `GameEngine` and rate-limited message edits.
- **Single-player:** private sessions, a daily puzzle, streaks and time rankings. No seats, no
  turns, no invitations, no vs bot. A puzzle generator with unique solutions instead of an
  engine that alternates turns.

The existing model (`games`, `game_players`, `game_moves`) and `GameEngine` fit matches, not
puzzle attempts. Forcing puzzles into them would bend the contract that Walls is meant to settle.

## Decision

- **Keep `games` as the multiplayer bot.** It stays as is through Phases 4 and 6.
- **Single-player games go in a second bot**, `apps/bot-puzzles` (name provisional), when the
  first one is started. Not before: there is no single-player game today, and abstractions wait
  for a second real case (project principle 4).
- It follows ADR 0004: its own `BotDefinition`, one line in the registry, `BOT_PUZZLES_*`
  variables, its own BotFather bot and token. It runs in the same server process.
- **Own data model.** Its tables don't reuse `games` or `game_moves`, and its puzzles don't
  implement `GameEngine`. Rows carry `bot_id` as ADR 0004 requires.
- **Own Mini App or its own route** (`apps/miniapp-puzzles`, or another path of an existing
  Mini App). ADR 0004 already lets one Mini App serve several bots: `initData` is validated with
  the token of the bot that opened it.
- **Shared identity.** Both bots see the same `telegram_user_id`, so a profile or achievements
  can be shared later without changing this decision.
- This is the "second bot or module" of Phase 5. Only then is the common part extracted
  (session, registry, Mini App utilities), with two real cases in hand.
- **Cross-promotion** is a link between the two bots' `/start` messages. No shared Mini App or
  data is needed for it.

## Reasons

- Two distinct products: groups and invitations versus private daily habits. One bot would blur
  its description, commands and menu.
- Little shared code beyond `telegram-auth`, the server and Supabase.
- Telegram's rate limits (ADR 0008) are per bot and per chat. A busy group using the multiplayer
  bot's edit budget doesn't affect the puzzles.
- Separate name, photo and description make each bot easy to find.

## Consequences

- Two audiences to build from zero, and each bot needs its own BotFather setup, token, webhook
  and Mini App registration. Discovery between them must be built (links, not automatic).
- A single-player game can no longer feed multiplayer through invitations in the same bot.
- Both bots share one process (ADR 0004): a serious failure in one can affect the other's
  webhooks. Mitigation: a `bot.catch` per bot and, if puzzles turn out heavy, a separate
  Railway service.

## When to revisit

- If single-player games become a **social race** ("solve the same puzzle as my friend in this
  group"), they would share invitations, groups and results with multiplayer, and one bot may
  fit better.
- If the puzzles bot never gets a second game, it may not justify its own bot, and the first
  puzzle could start as a section of `games` until it does.
