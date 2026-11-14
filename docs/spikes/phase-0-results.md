# Phase 0: Telegram technical tests — results

Manual tests run against a **test** bot with the spike commands in
`apps/bot-games/src/spikes/` and `POST /api/spike/whoami` (`apps/server/src/spike-routes.ts`).
Send `/spikes` to the bot for the command list. Server logs lines prefixed with `[spike]`.
These results feed ADRs 0005–0007. The spike code is removed in Phase 1.

## Setup

- [ ] Test bot token in `.env` (`BOT_GAMES_TOKEN`), `BOT_MODE=polling`
- [ ] BotFather: `/setinline` enabled, `/setinlinefeedback` enabled, privacy mode left on
- [ ] Accounts A and B; a basic group and a supergroup with topics (A, B, bot); a private
      A–B chat without the bot; a group without the bot
- [ ] `cloudflared tunnel --url http://localhost:5173`; BotFather `/newapp` →
      `https://<tunnel>/apps/games/`; direct link in `BOT_GAMES_MINIAPP_URL`
- [ ] `pnpm dev` running

Date: — · Telegram clients/versions: —

## Results

Status: ✅ works as expected · ⚠️ works with caveats · ❌ doesn't work · ⏳ pending

| #   | Case                                           | How                                           | Expected                                               | Status | Observed / log notes |
| --- | ---------------------------------------------- | --------------------------------------------- | ------------------------------------------------------ | ------ | -------------------- |
| G1  | Command reaches the bot with privacy mode on   | `/spike_ttt@<bot>` and `/spike_ttt`           | Invitation posted in both group types                  | ⏳     |                      |
| G2  | Full game, message edited in place             | B taps Join, A and B play                     | One message, edited per move; result + rematch         | ⏳     |                      |
| G3  | Outsider or wrong player taps                  | Third account taps a cell                     | Alert (outsider) / toast (player), no edit             | ⏳     |                      |
| G4  | Simultaneous taps / double tap                 | Both tap at once; double-tap a cell           | Only one move; the other gets "board changed"          | ⏳     |                      |
| G5  | Forum topic                                    | `/spike_ttt` inside a topic                   | Invitation and board stay in the topic                 | ⏳     |                      |
| G6  | Editing an old message                         | Tap a board left for 48 h+                    | Edit still works (or note the error)                   | ⏳     |                      |
| I1  | Inline mode where the bot isn't a member       | `@<bot>` in the A–B private chat              | Result shown and sent                                  | ⏳     |                      |
| I2  | `chosen_inline_result` has `inline_message_id` | Same as I1; check log                         | `inlineMessageId` logged                               | ⏳     |                      |
| I3  | Full game via inline callbacks                 | B taps Join, play; private chat and group     | Edits via `inline_message_id` work; no `chat`          | ⏳     |                      |
| I4  | Inline invite into a group without the bot     | `@<bot>` in that group                        | Works like I1–I3                                       | ⏳     |                      |
| M1  | Direct link opens the Mini App from a group    | `/spike_app test`, tap on iOS/Android/Desktop | Mini App opens                                         | ⏳     |                      |
| M2  | `initData` fields and server verification      | Read the Mini App screen                      | start_param, chat_type, chat_instance; "verified as …" | ⏳     |                      |
| M3  | `mode=compact`                                 | "Open (compact)" button                       | Opens in compact mode (note per platform)              | ⏳     |                      |
| M4  | `web_app` button in a group                    | `/spike_webapp https://<tunnel>/apps/games/`  | Rejected (`BUTTON_TYPE_INVALID`?)                      | ⏳     |                      |
| M5  | `startapp` limits                              | `/spike_app` with 64 chars, 65 chars, `a.b`   | Note what Telegram does with each                      | ⏳     |                      |
| M6  | Same `chat_instance` for A and B               | Both open the same link                       | Same value for the same group                          | ⏳     |                      |
| R1  | Edit rate limit                                | `/spike_burst 30`; `@<bot> burst 30`          | First 429 and `retry_after` noted                      | ⏳     |                      |

## Findings for the ADRs

- callback_data: longest seen — bytes (log line `longest callback_data so far`).
- —
