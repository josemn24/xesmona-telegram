# Tic-tac-toe

- **Status:** implemented (Phase 1, done 2026-11-15)
- **Where:** in the chat, as a 3×3 inline keyboard. No Mini App.
- **Engine:** [packages/games/src/tic-tac-toe/](../../packages/games/src/tic-tac-toe/)
- **Bot handlers:** [apps/bot-games/src/tic-tac-toe/](../../apps/bot-games/src/tic-tac-toe/)
- **Decisions:** [ADR 0005](../adr/0005-play-vs-bot.md) (vs bot),
  [ADR 0006](../adr/0006-in-chat-games-inline-keyboards.md) (inline keyboards)

## Rules

Standard 3×3 game. Seat 0 and seat 1 alternate placing a mark in an empty cell; three in a row
(horizontal, vertical or diagonal) wins, a full board without a winner is a draw. A win reports
the three cells (`Outcome.line`) so the message can highlight them.

## How it is played in Telegram

1. `@bot` in any chat (inline mode) or `/play` in a group posts an invitation.
2. A second player taps "Join", or the creator taps "Play vs bot" and picks a level.
3. Each button carries `ttt:<game>:<cell>:<version>` in `callback_data` (64-byte limit).
4. The server checks turn and version, saves the move and edits the message. A user who isn't
   playing gets an alert.
5. At the end the message shows the result and a rematch button. In inline mode the callbacks
   arrive with `inline_message_id`, so the bot doesn't need to be in the chat.

Rematch: two players alternate who starts; vs bot the human keeps the first move.

## Bot

| Level  | Behaviour                                                   |
| ------ | ----------------------------------------------------------- |
| Easy   | Random legal move                                           |
| Normal | Wins if it can, else blocks the opponent's win, else random |
| Hard   | Best possible play (minimax); it can't lose                 |

## Verified

Two-player games, outsider taps and simultaneous taps confirmed with two accounts (ADR 0006).
