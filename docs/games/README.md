# Games

Catalogue of the games in Xesmona's games bot: what is built, what is planned and what is only an
idea. Product vision and roadmap are in [project-overview.md](../project-overview.md).

## Catalogue

| Game                 | Status      | Where it's played | Roadmap phase  | Bot levels                       | Page                                 |
| -------------------- | ----------- | ----------------- | -------------- | -------------------------------- | ------------------------------------ |
| Tic-tac-toe          | Implemented | Chat (inline kbd) | 1              | Easy, Normal, Hard (minimax)     | [tic-tac-toe.md](tic-tac-toe.md)     |
| Four in a row        | Implemented | Mini App          | 2              | Easy, Normal, Hard (search)      | [four-in-a-row.md](four-in-a-row.md) |
| Walls                | Planned     | Mini App          | 4 (2p), 6 (4p) | After the 2-player version works | [ideas.md](ideas.md#walls)           |
| Dice game (original) | Planned     | Mini App          | 6              | To be decided                    | [ideas.md](ideas.md#dice-game)       |
| Dots and boxes       | Idea        | Chat or Mini App  | Not scheduled  | To be decided                    | [ideas.md](ideas.md#dots-and-boxes)  |
| Chess                | Backlog     | Mini App          | Not scheduled  | To be decided                    | [ideas.md](ideas.md#chess)           |

Status meanings: **Implemented** = playable end to end; **Planned** = has a roadmap phase;
**Idea** = worth keeping, no decision yet; **Backlog** = accepted but unscheduled.

## What every game shares

- **Engine contract** (`GameEngine` in [packages/games/src/engine.ts](../../packages/games/src/engine.ts)):
  `initialState`, `parseMove`, `encodeMove`, `applyMove`, `outcome`, `legalMoves` and
  `chooseMove`. Engines are pure: no React, grammY or Supabase. The contract is v1 and is
  settled with Walls (principle 4 in the overview).
- **Two seats.** Seat 0 and seat 1. Two players take turns starting each round; vs bot the human
  always starts ([ADR 0005](../adr/0005-play-vs-bot.md)).
- **Server authority.** Every move is validated, versioned and saved in a transaction. A stale
  version is rejected, which is how simultaneous taps are resolved.
- **Play vs bot.** The bot is a player of kind `bot`, with levels Easy / Normal / Hard. Vs-bot
  games don't count towards rankings. Details in [ADR 0005](../adr/0005-play-vs-bot.md).
- **Where it's played** decides the delivery:
  - In chat: inline keyboard, `callback_data` carries `<game>:<id>:<move>:<version>`
    ([ADR 0006](../adr/0006-in-chat-games-inline-keyboards.md)).
  - Mini App: invitation with a direct link, identity from `initData`, live updates through
    Realtime ([ADR 0007](../adr/0007-opening-mini-apps-from-chats.md),
    [ADR 0009](../adr/0009-mini-app-sessions-and-realtime.md)).
- **Message edits** go through the render queue and game expiry in
  [ADR 0010](../adr/0010-message-renders-and-expiry.md), because of Telegram's rate limits
  ([ADR 0008](../adr/0008-telegram-rate-limits.md)).
- **Naming.** Use generic or original names. Avoid trademarks: "Connect Four", "Quoridor",
  "Barricade".

## Choosing the delivery for a new game

| If the game…                                     | Prefer                                         |
| ------------------------------------------------ | ---------------------------------------------- |
| Fits a small grid of buttons (about 8×8 at most) | Chat: no Mini App, works in any chat           |
| Needs drag, hidden information or animation      | Mini App                                       |
| Has long turns or many moves per turn            | Mini App (fewer message edits)                 |
| Is real time                                     | Out of scope for now: the server is turn based |

## Adding a game

1. Write its page here (rules, state, move format, bot) and add it to the catalogue.
2. Engine in `packages/games/src/<game>/` with `engine.ts`, `ai.ts` and tests, implementing
   `GameEngine`. No other package may be needed.
3. Register it in the bot (`apps/bot-games/src/<game>/`) and, if it is a Mini App game, add its
   screen in `apps/miniapp-games/src/<game>/`.
4. Record any decision that is not obvious from the code in an ADR.
5. Update the roadmap in the overview.
