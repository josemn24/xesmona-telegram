# ADR 0006: In-chat games with inline keyboards

- Status: accepted (2026-11-14); two-player cases still to confirm (see Pending)

## Context

Tic-tac-toe (Phase 1) is played in the chat itself: the board is an inline keyboard and every
move edits the message. Before building it we tested the Telegram behaviour it depends on with
the Phase 0 spike. Evidence is in [phase-0-results.md](../spikes/phase-0-results.md); case
ids (G1, I3…) refer to rows there.

## Decision

**Where games start**

- `/play` works in private chats, basic groups and supergroups with **privacy mode on**: both
  `/cmd` and `/cmd@bot` reach the bot (G1). Privacy mode stays on in production.
- Inline mode (`@bot`) works in chats where the bot isn't a member (I1). Inline messages are
  identified only by `inline_message_id` (I2), and their callbacks have no `chat` (I3).
- In forum topics, replies pass the command's `message_thread_id`; edits keep the message in
  its topic (G5).

**Identifying a game's message**

- Chat messages: `(chat_id, message_id)`. Inline messages: `inline_message_id`. A game row
  stores exactly one of the two.
- Inline games are created **on the first button tap**, keyed by `inline_message_id`, not on
  `chosen_inline_result`: that update depends on a BotFather setting (it did arrive in I2, but
  the game shouldn't rely on it).
- Every callback carries `chat_instance`, inline ones included; it's stable per chat (G2, I3).
  Store it so games can be grouped by chat even when inline.

**Buttons and moves**

- `callback_data` format: `<action>:<game id as 32 hex chars>:<cell>:<version>`. Observed
  maximum 41 bytes with a 2-digit version, out of 64 (G2). Build it through one helper that
  checks the byte length.
- Every move carries the game version. A tap with an old version gets a toast ("The board
  changed"); a tap by someone who isn't playing gets an alert pop-up (G3, partly confirmed).
- One edit per turn, also vs bot, where the bot's reply is saved with the human move (G2,
  ADR 0005). Edits work the same in private chats, groups, topics and inline messages
  (G2, G5, I3).
- Rematch reuses the same message for a new round (G2).

## Pending

- Two-player games: Join by another user, outsider taps (G3) and simultaneous taps (G4) need a
  second account. The version check is covered by unit tests; to be confirmed in Telegram when
  account B is available.
- Editing a message older than 48 hours (G6).
- Edit rate limits (R1) go in ADR 0008.

## Consequences

- The Phase 1 schema has `chat_id`, `message_id`, `inline_message_id` and `chat_instance` on
  games, with a check that exactly one message reference is set.
- Handlers must always answer the callback query, even when they refuse a tap, or the client
  keeps a loading spinner.
- No dependency on BotFather's inline feedback setting.
