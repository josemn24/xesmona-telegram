# Planned games and ideas

Games not built yet. **Walls** and the **dice game** have a roadmap phase; the rest are
proposals. Nothing here is a final rule set: it records intent so decisions aren't lost. When a
game is started, move it to its own page and mark it in the [catalogue](README.md).

## Walls

- **Status:** planned, Phase 4 (2 players) and Phase 6 (4 players)
- **Where:** Mini App
- **Why:** first game with a real engine of its own. It settles `GameEngine`: two kinds of move
  (move pawn, place wall), limited resources (walls left) and a path-based win condition.
- **Name:** own name and design. Don't use "Quoridor" (registered trademark).

Rules as currently intended:

- 9×9 board. Each player moves their pawn to the opposite side.
- Instead of moving, a player may place a two-square wall to slow the opponent.
- A wall can never cut off a player's last path to their goal; every placement is checked with a
  path search.
- Jumps over the adjacent pawn are part of Phase 4.

Open questions: walls per player, exact jump rules when a wall is behind the pawn, how the Mini
App previews a wall before confirming, and whether the bot uses search or a shortest-path
heuristic (the bot comes after the 2-player version works, ADR 0005).

## Dice game

- **Status:** planned, Phase 6
- **Where:** Mini App
- **Name:** original name and design. Don't use "Barricade" (registered trademark).
- Not designed yet. Needs a decision on randomness: dice rolls must be generated on the server
  and stored with the move, so the engine stays pure and replayable (inject the random source,
  as `chooseMove` already does with `rng`).

## Dots and boxes

- **Status:** idea
- **Where:** chat (small grids fit an inline keyboard) or Mini App (nicer for larger grids)
- A player who completes a box moves again, so turns are not strictly alternating. The engine
  contract assumes `turn` changes after each move, so this is a useful stress test for
  `GameEngine`.
- Bot: Normal = take any box that completes, avoid giving the third side; Hard = chain-counting
  or search.

## Chess

- **Status:** backlog
- **Where:** Mini App
- Large rules surface (castling, en passant, promotion, draws), so it needs a library or a very
  careful engine. Check that a third-party rules library keeps the "pure engine" principle and
  fits the server bundle before building one.
- Bot: wrapping an existing engine is more realistic than writing one. Strength control is the
  question.

## Other ideas

Add one line each; promote to a section when someone commits to it.

- Checkers / draughts: small rules, a good second use of a grid.
- Reversi: grid game with large board changes per move; stresses move size and animation.
- Battleship-style game: hidden information per player. Needs per-seat state views, which the
  current engine contract doesn't have.
- Hangman or word games: single secret, may suit chat.

## Single-player puzzles

- **Status:** idea (Wordle-style word games, Queens- and Zip-style puzzles)
- **Where:** a separate bot, not `games`, decided in
  [ADR 0011](../adr/0011-separate-bot-for-single-player-games.md).
- They aren't duels: no seats, turns or vs bot, so they don't implement `GameEngine`. They need
  a puzzle generator with unique solutions, a daily puzzle and time rankings.
- The names "Queens" and "Zip" belong to LinkedIn; use original names.
- A social race variant (same puzzle, first to solve) would change the ADR's conclusion.

## What new games teach the engine

| Game           | Stresses in `GameEngine`                         |
| -------------- | ------------------------------------------------ |
| Walls          | Several move types, resources, path validation   |
| Dice game      | Randomness stored with the move                  |
| Dots and boxes | Extra turn after a scoring move                  |
| Battleship     | Hidden state, per-seat views                     |
| Chess          | Large state, rich move encoding, many draw rules |
