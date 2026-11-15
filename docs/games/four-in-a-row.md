# Four in a row

- **Status:** implemented (Phase 2, built 2026-11-15)
- **Where:** Mini App, opened from an invitation in the chat.
- **Engine:** [packages/games/src/four-in-a-row/](../../packages/games/src/four-in-a-row/)
- **Bot handlers:** [apps/bot-games/src/four-in-a-row/](../../apps/bot-games/src/four-in-a-row/)
- **Mini App:** [apps/miniapp-games/src/four-in-a-row/](../../apps/miniapp-games/src/four-in-a-row/)
- **Decisions:** [ADR 0005](../adr/0005-play-vs-bot.md),
  [ADR 0007](../adr/0007-opening-mini-apps-from-chats.md),
  [ADR 0009](../adr/0009-mini-app-sessions-and-realtime.md),
  [ADR 0010](../adr/0010-message-renders-and-expiry.md)

Named generically on purpose: "Connect Four" is a trademark.

## Rules

7 columns × 6 rows. A move is a column; the disc falls to the lowest free row. Four discs in a
line (horizontal, vertical or either diagonal) win; a full board is a draw. Illegal moves are
rejected with `not_your_turn`, `column_full`, `finished` or `invalid_column`. The state is 42
cells, row by row from the top, plus whose turn it is.

## Flow

1. `/four` in a group or `@bot` in any chat (inline mode) posts an invitation with a direct
   link to the Mini App (`url` button, not `web_app`, because groups don't allow `web_app`).
2. A second player joins, or the creator chooses vs bot.
3. Each player opens the Mini App; the server validates `initData` with the bot's token, issues
   a session and a Realtime token for the game's private channel.
4. Moves go to the server, which validates and versions them; the event reaches both players
   through Realtime. The Mini App reconnects with backoff and refreshes when it resumes.
5. At the end the server edits the invitation once with the result and a rematch button
   (queued and retried under rate limits, ADR 0010). Abandoned games expire.

## Bot

| Level  | Behaviour                                                                                |
| ------ | ---------------------------------------------------------------------------------------- |
| Easy   | Random legal move                                                                        |
| Normal | Wins if it can, else blocks the opponent's win, else random                              |
| Hard   | Negamax with alpha-beta pruning, depth 6 and a window-count heuristic (centre preferred) |

Hard is strong enough to punish mistakes but is not a solver. It runs inside the request, so
depth is a cost trade-off (`HARD_DEPTH` in `ai.ts`).

## Verified and pending

Played with two accounts (inline invitation, live updates on iOS and macOS, a single result
edit, rematch) and vs Normal. **Still to try:** Easy and Hard, a two-player `/four` in a group,
Android.
