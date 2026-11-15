# ADR 0008: Telegram rate limits for messages and edits

- Status: accepted (2026-11-15)

## Context

In-chat games edit a message on every turn (ADR 0006), and Mini App games will post and edit
invitations and results. Telegram limits how fast a bot can send and edit messages, and the
limits are not fully documented. We measured them with the Phase 0 burst spike. Evidence is in
[phase-0-results.md](../spikes/phase-0-results.md), case R1.

Measured (R1):

| Where                         | Behaviour                                                       |
| ----------------------------- | --------------------------------------------------------------- |
| Private chat                  | 30 edits in about 4 s (~7/s), no 429                            |
| Supergroup                    | Slowed to ~1/s; 429 after 20 edits in 22 s, `retry_after` 39 s  |
| Inline message sent in group  | Slowed to ~1/s; 429 after 21 edits in 19 s, `retry_after` 41 s  |
| `sendMessage` right after 429 | Also 429 in the same group: edits and new messages share budget |

## Decision

**Budget**

- Plan for **about 20 messages plus edits per minute per group**, shared by every game and
  message the bot has in that group. Inline messages sent in a group count against the same
  kind of budget; they're grouped by `chat_instance` (ADR 0006).
- Private chats are not a practical constraint at game speed.

**Spending less**

- One edit per turn, also vs bot (ADR 0005, ADR 0006). No cosmetic edits: no countdowns,
  "thinking…" states or animations through message edits.
- Mini App games don't use message edits for live play: moves go through Realtime, and the
  chat only gets the invitation and one edit with the result.

**When Telegram answers 429**

- The move is already committed in the database before the edit, so a failed edit never loses
  a move; the message is only out of date.
- Never wait `retry_after` inside the update handler: about 40 s is far longer than a webhook
  request should take. The callback query is answered right away.
- Every edit renders the whole board from the latest database state, so a delayed edit only
  needs the newest state: pending edits for the same message are coalesced into one, sent
  after `retry_after`.
- Until the Phase 3 queue exists, a failed edit (429 included) is only logged by the
  tic-tac-toe `render` helper and the board stays stale until the next successful edit, which
  shows the full current state.

## Consequences

- Phase 3 adds a per-chat edit queue (Supabase Queues) that honours `retry_after` and
  coalesces edits by message.
- No blind auto-retry middleware (such as grammY's auto-retry plugin with long waits) on the
  webhook path.
- Busy groups with several fast in-chat games at once can hit the limit; that's a reason to
  move fast-paced games to Mini Apps rather than to raise edit frequency.
- Not measured: the global per-bot limit across many chats. Revisit if the bot grows into
  many active groups.
