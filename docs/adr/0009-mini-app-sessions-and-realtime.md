# ADR 0009: Mini App sessions, Realtime and GameEngine v1

- Status: accepted (2026-11-15)

## Context

Phase 2 plays Four in a row in a Mini App. Players must see each other's moves live, the
server must stay the authority (moves validated and versioned, ADR 0005 and 0006), and the
Mini App must not get broad database access. ADR 0007 settled how the Mini App opens and how
its `initData` is validated; this ADR covers what happens after it opens. Four in a row is
also the second game, so the shared engine contract is set here.

## Decision

**Identity on every request**

- Every API call sends `Authorization: tma <initData>` and the server validates it with the
  bot's token (`@xesmona/telegram-auth`). There's no server-side session to store.
- Accepted `initData` age is 24 hours: Telegram signs it once when the Mini App opens, and a
  long session still needs to refresh its Realtime token.

**Moves go through the API**

- `POST /api/games/four-in-a-row/:id/moves` with `{ version, move }`. The server parses the
  move with the engine, applies it, adds the bot's reply vs bot, and saves everything with
  `save_game` in one transaction. Errors: 403 not a player, 409 stale version or wrong turn,
  422 illegal or malformed move.
- `GET /api/games/four-in-a-row/:id` returns a snapshot with the caller's seat (`you`), or
  `null` for someone who doesn't play it (read only, no live updates).
- The Mini App applies a move optimistically with the same engine and always replaces it with
  the server's answer.

**Live updates: Supabase Realtime broadcast from the database**

- An `after update` trigger on `games` calls `realtime.send` on the private topic
  `game:<game uuid>` whenever `version` changes, with the new state, status, result, round
  and mode. It runs inside the save's transaction, so only committed changes are broadcast,
  and moves from any source (the other player, the bot, the chat) reach the Mini App.
- RLS on `realtime.messages` lets `authenticated` users receive a `game:` broadcast only when
  `is_game_player(game, sub)` is true. There's no insert policy: clients never broadcast.
- The Mini App never reads tables; RLS without policies still blocks them for every role
  except the service role.
- The client keeps the highest version it has seen and ignores older answers or broadcasts.
  On every (re)subscribe and when the Mini App becomes visible again it fetches a snapshot,
  which covers anything missed while offline.

**Realtime token**

- `POST /api/games/session` returns the Supabase URL, the publishable key and a JWT with
  `role: authenticated`, `aud: authenticated`, `sub: <Telegram user id>` and a 1-hour expiry.
- The JWT is signed with HS256 and the project's JWT secret (`SUPABASE_JWT_SECRET`, server
  only). Realtime accepts it with no extra setup; this was checked against local Supabase
  (`apps/bot-games/src/realtime.db.test.ts`). It's used only to subscribe; it can't read
  tables or call the game functions (their `execute` is revoked from `authenticated`).
- `supabase-js` is loaded on demand in the Mini App, only on game screens (ADR 0003).

**In the chat**

- `/four` and the `@bot` inline results post an invitation with Join and Play vs bot, as for
  tic-tac-toe (ADR 0006). When the game starts, the message becomes a summary with an
  "Open game" `url` button (`startapp=<game id>`, ADR 0007).
- The chat message is edited when the game starts and when it ends (result and Rematch), never
  per move (ADR 0008).

**GameEngine v1** (`@xesmona/games`)

- Every game is a pure `GameEngine<State, Move, MoveError>`: `type`, `initialState`,
  `parseMove` (untrusted JSON), `encodeMove`, `applyMove`, `outcome` (with the winning line
  when there is one), `legalMoves` and `chooseMove(state, seat, level, rng)`.
- Tic-tac-toe and Four in a row implement it. The package has no Node or DOM types, so the
  server and the Mini Apps share it, together with the API types (`@xesmona/games/api`).
- `games.state` holds the engine's state as JSON and `game_moves.move` its `encodeMove` form.

## Consequences

- Mini App games need `SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_JWT_SECRET`; without them the
  server warns, `/session` answers 503 and chat games keep working.
- Supabase is moving projects to asymmetric JWT signing keys. While the legacy JWT secret is
  enabled this keeps working; if it's revoked, the server must sign with a private key
  imported into the project's signing keys (ES256 with a `kid`) instead.
- Walls (Phase 4) reuses the session, the trigger, the policy and the snapshot and move
  routes; it settles whether `GameEngine` needs more (several kinds of move, limited
  resources).
- Local development can open a game in a desktop browser with `?devInitData=<signed initData>`
  (dev builds only); signed initData must include a `signature` field for the SDK to accept it.
- Reconnection beyond refetching a snapshot, abandoned games and a queue for the result edit
  are Phase 3.
