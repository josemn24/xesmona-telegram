# ADR 0007: Opening Mini Apps from chats

- Status: accepted (2026-11-15); a second user's `chat_instance` (M6) and Android (M1) pending

## Context

From Phase 2, games such as Four in a row are played in a Mini App that players open from a
group, a private chat or an inline message. Before building the pipeline we tested how
Telegram opens a Mini App from those places and what it tells the app. Evidence is in
[phase-0-results.md](../spikes/phase-0-results.md); case ids (M1, M5…) refer to rows there.

## Decision

**How the Mini App opens**

- Always with a `url` button carrying the **direct link**
  `https://t.me/<bot>/<app>?startapp=<param>`. It opens the Mini App in basic groups,
  supergroups and forum topics, on macOS and iOS, after a Telegram confirmation dialog (M1).
- No `web_app` buttons: in groups `sendMessage` fails with `BUTTON_TYPE_INVALID` (M4). They do
  work in the private chat with the bot, but one kind of button everywhere keeps one code path.

**`startapp`**

- It carries the **game id** (32 hex chars), which the Mini App needs to load the game.
- Characters limited to `[A-Za-z0-9_-]`: with `.` Telegram opens the bot chat instead of the
  Mini App (M5). Keep it at 64 characters or fewer; 512 arrived intact but is the documented
  maximum, so nothing relies on more (M5).
- `initData` has no topic or thread id (M1). The server finds the game's chat and topic from
  the game row, never from the Mini App.

**Identity**

- The Mini App sends the raw `initData` as `Authorization: tma <initData>`; the server
  validates it with the token of the bot that opened it (M2), via `@xesmona/telegram-auth`.
  `initDataUnsafe` is never used for anything the server decides.
- `start_param` is covered by the signature, but it's only a lookup key: the server still
  checks that the validated user may see or play that game.
- `chat_instance` in `initData` equals the one on callbacks from the same group, and doesn't
  depend on the client (M6). It may be stored to tie a Mini App session to the chat of the
  invitation, but it isn't an authorization check: it changes when a basic group is upgraded
  to a supergroup (M6) and a second user's value is still unconfirmed.
- Opened from the private chat with the bot, `chat_type` is `sender` and there's no
  `start_param` (M2): the Mini App must handle having no game id (e.g. show a game list).

**Layout**

- Links don't use `mode=compact` by default. iOS honours it (half-height sheet, 525 px), macOS
  ignores it and reports no viewport height (M3).
- Boards must fit in about 500 px of height and lay out with CSS, without depending on the
  viewport height reported by the SDK.

## Pending

- M6 with account B: does a second user get the same `chat_instance` for the same group?
- M1 on Android (no device yet).

## Consequences

- Invitations for Mini App games are messages with a `url` button; the `BOT_<ID>_MINIAPP_URL`
  variable holds the direct link and handlers append `?startapp=<game id>`.
- The Phase 2 endpoint that exchanges `initData` for a session token reuses the same
  validation; the spike `POST /api/spike/whoami` and the Mini App test screen go away once M6
  is closed.
- A game row must keep its chat, topic and message ids, since the Mini App can't supply them.
