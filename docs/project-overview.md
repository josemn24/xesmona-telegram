# xesmona-telegram: overview

## What it is

Monorepo (pnpm + Turborepo) for building **several Xesmona Telegram bots** that share game
engines, Mini Apps and common services. Each bot is a small app that combines the pieces it
needs. The first bot is a **games** bot: it starts with **Tic-tac-toe** played in the chat
itself, continues with **Four in a row** as the first Mini App, and then comes **Walls**, the
first game with a real engine of its own.

## Games

| Game          | Where it's played         | What it's for                                                                                                                         |
| ------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Tic-tac-toe   | Chat: 3×3 inline keyboard | MVP. Validates the bot, persistence, move versioning and concurrency without a Mini App.                                              |
| Four in a row | Mini App                  | Trivial engine (7×6 with gravity): validates the full Mini App pipeline (`initData` → JWT → Realtime). First version of `GameEngine`. |
| Walls         | Mini App                  | Pawn race and wall placement. Non-trivial engine; settles `GameEngine`.                                                               |
| Dice          | Mini App                  | Dice game with its own name and design (not "Barricade", a registered trademark).                                                     |

**Walls** (own name and design; don't use "Quoridor", a registered trademark): 9×9 board; each
player moves their pawn to the opposite side or places two-square walls to slow down the
opponent. A wall can never cut off a player's last path to their goal (checked with a path
search on every placement). 2 players first; 4 players later.

Use generic or original game names: avoid trademarks such as "Connect Four", "Quoridor" or
"Barricade".

## Stack

| Layer     | Technology                                                                 |
| --------- | -------------------------------------------------------------------------- |
| Language  | Strict TypeScript, Node 24 LTS                                             |
| Bots      | grammY (webhook in production, long polling locally)                       |
| API       | Hono, in the same Node process as the bots                                 |
| Mini Apps | Vite + React (SPA), Tailwind, Motion + SVG for boards, `@tma.js/sdk-react` |
| Data      | Supabase Postgres, SQL migrations, Zod                                     |
| Realtime  | Supabase Realtime (private channels; events emitted from Postgres)         |
| Jobs      | Supabase Queues (pgmq)                                                     |
| Hosting   | Railway (one Node service + static Mini Apps) and Supabase Cloud (EU)      |
| Quality   | ESLint, Prettier, Vitest, Playwright (Phase 2), GitHub Actions             |

## Principles

1. **The server is the authority.** The client only shows optimistic state; every move is
   validated, versioned and persisted in a transaction.
2. **Pure engines.** A game's rules don't depend on React, grammY or Supabase.
3. **Verified identity.** In the Mini App, always validate the original `initData` with the
   token of the bot that opened it; never `initDataUnsafe`. In the chat, identity is the `from`
   of the callback query Telegram sends.
4. **Abstractions at the second case.** The `GameEngine` contract gets a minimal first version
   with Four in a row and is settled with Walls (two kinds of move, limited resources and a
   different win condition); the module SDK, when the second bot or module arrives.
5. **Telegram in groups:** `web_app` buttons are not allowed in groups; use `url` buttons with
   a direct link (`https://t.me/<bot>/<app>?startapp=<param>`). Inline mode allows inviting from
   any chat.

## Flows

### Tic-tac-toe in the chat (MVP)

1. `@bot` in any chat (inline mode) or `/play` in a group.
2. The bot posts the invitation; a second player taps "Join".
3. The board is a 3×3 inline keyboard. Each button carries `ttt:<game>:<cell>:<version>` in
   `callback_data` (max 64 bytes).
4. The server checks that the player whose turn it is made the move and that the version
   matches, saves the move in a transaction and edits the message. Anyone not playing gets an
   alert.
5. When the game ends, the message shows the result and a rematch button. In inline mode,
   callbacks arrive with `inline_message_id` and the bot doesn't need to be in the chat.

### Mini App games (Four in a row, Walls)

1. `@bot` in any chat (inline mode) or `/play` in a group.
2. The bot posts the invitation with a direct link to the Mini App.
3. A second player joins; both open the Mini App, the backend validates their identity and
   grants them access to the game's private channel.
4. Every move is validated on the server and saved with its version; the Realtime event is
   emitted from the database.
5. When the game ends, a queue job edits the invitation with the result and a rematch button.

## Roadmap

0. **Technical tests:** inline keyboards and message edits in groups and in inline mode; direct
   link to the Mini App in groups. Outcome: ADRs.
1. **Tic-tac-toe in the chat, end to end:** `/play`, inline mode, moves persisted with
   versions, rematch.
2. **Four in a row as a Mini App:** full pipeline (`initData` → JWT → private channel with RLS
   → Realtime), result posted in the group. First version of `GameEngine`.
3. **Reliability:** Telegram limits when editing messages, simultaneous taps, reconnection in
   the Mini App, abandoned and expired games, queues.
4. **Walls for 2 players:** wall placement, path validation, jumps. Settles `GameEngine`.
5. **Second bot or module (e.g. polls):** the module SDK is extracted.
6. **Walls for 4 players, original dice game and rankings.**

**Backlog:** chess.
