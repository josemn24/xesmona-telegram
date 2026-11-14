# ADR 0005: Play vs bot

- Status: accepted (2026-11-14)

## Context

Every game so far needs two people. Players who are alone, or in a chat where nobody answers
the invitation, can't play at all. During Phase 0 this also blocked testing message edits with
a single Telegram account.

## Decision

- Every game can be played **against the bot**, from `/play` in any chat and from inline mode
  (including Saved Messages).
- Three levels: **Easy** (random legal move), **Normal** (win if possible, else block the
  opponent's win, else random), **Hard** (best possible play; minimax for Tic-tac-toe).
- The bot's move is chosen by a **pure engine function** `chooseMove(state, level, rng)`, next
  to the game's rules, with no dependency on grammY or Supabase. `rng` is injected so tests are
  deterministic.
- The bot is a **player** in the game with `kind = 'bot'` and no Telegram user id. Vs-bot games
  use the same validation, versioning and persistence as two-player games.
- After a human move the server computes the bot's reply and **saves both moves in one
  transaction** (two consecutive versions), then edits the message **once**.
- In vs-bot rematches the human keeps the first move.
- Vs-bot games **don't count towards rankings**.

## Consequences

- The database must allow players that aren't Telegram users (`game_players.kind`,
  nullable `telegram_user_id` only for bots).
- One edit per turn halves message edits compared with editing after each move, which helps
  with Telegram's edit rate limits.
- Each new game needs its own bot logic. Four in a row gets a simple search; Walls gets its bot
  after the 2-player version works.
- Single-player testing of the full game flow (edits, topics, inline messages) no longer needs
  a second account.
