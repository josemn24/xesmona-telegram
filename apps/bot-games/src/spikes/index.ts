// Phase 0 spike: remove in Phase 1.
// Handlers to test Telegram behaviour in real chats. Results go in docs/spikes/phase-0-results.md.
import type { BotEnv } from '@xesmona/contracts';
import { GrammyError, InlineKeyboard, type Bot, type Context } from 'grammy';
import {
  createGame,
  createVsBotGame,
  games,
  join,
  newGameId,
  playTurn,
  rematch,
  type SpikeGame,
} from './board';
import { boardKeyboard, boardText, callbackData, invitationKeyboard } from './keyboard';

export const spikeHelp = [
  'Phase 0 spikes:',
  '/spike_ttt: tic-tac-toe in this chat',
  '/spike_ttt bot: play against the bot (Easy)',
  '/spike_app <param>: Mini App direct link buttons',
  '/spike_webapp <https-url>: try a web_app button here',
  '/spike_burst <n>: edit one message n times (rate limits)',
  '@<bot> in any chat: inline tic-tac-toe; "@<bot> bot" vs the bot; "@<bot> burst" for rate limits',
].join('\n');

const REFUSALS = {
  not_player: "You're not playing this game.",
  not_your_turn: "It's not your turn.",
  stale: 'The board changed, try again.',
  occupied: 'That cell is taken.',
  finished: 'The game is over.',
  already_joined: 'You created this game: wait for someone else.',
  full: 'This game already has two players.',
} as const;

const displayName = (ctx: Context) =>
  ctx.from?.username ? `@${ctx.from.username}` : (ctx.from?.first_name ?? '?');

/** Logs where an update came from: the data we need for the ADRs. */
function logOrigin(label: string, ctx: Context) {
  const msg = ctx.msg;
  console.log(`[spike] ${label}`, {
    from: ctx.from?.id,
    // Inline queries have no `chat`, but Telegram says where they were typed in `chat_type`.
    chatType: ctx.chat?.type ?? ctx.inlineQuery?.chat_type,
    chatId: ctx.chat?.id,
    threadId: msg?.message_thread_id,
    isTopicMessage: msg?.is_topic_message,
    inlineMessageId:
      ctx.callbackQuery?.inline_message_id ?? ctx.chosenInlineResult?.inline_message_id,
    chatInstance: ctx.callbackQuery?.chat_instance,
  });
}

/** Keeps replies inside the forum topic the command came from (G5). */
function threadOptions(ctx: Context): { message_thread_id?: number } {
  const threadId = ctx.msg?.is_topic_message ? ctx.msg.message_thread_id : undefined;
  return threadId === undefined ? {} : { message_thread_id: threadId };
}

function describeError(error: unknown): string {
  return error instanceof GrammyError ? `${error.error_code}: ${error.description}` : String(error);
}

async function showBoard(ctx: Context, game: SpikeGame) {
  try {
    // Works for chat messages and for inline messages (grammY uses inline_message_id).
    await ctx.editMessageText(boardText(game), { reply_markup: boardKeyboard(game) });
  } catch (error) {
    console.error('[spike] edit failed', describeError(error));
  }
}

/** Edits a message as fast as possible until the first 429 (R1). */
async function burst(edit: (text: string) => Promise<unknown>, n: number): Promise<string> {
  const started = Date.now();
  for (let i = 1; i <= n; i++) {
    try {
      await edit(`Burst edit ${i}/${n}`);
    } catch (error) {
      const elapsed = Date.now() - started;
      if (error instanceof GrammyError && error.error_code === 429) {
        const summary = `429 after ${i - 1} edits in ${elapsed} ms, retry_after=${error.parameters.retry_after}s`;
        console.warn(`[spike] burst ${summary}`);
        return summary;
      }
      const summary = `error after ${i - 1} edits in ${elapsed} ms: ${describeError(error)}`;
      console.error(`[spike] burst ${summary}`);
      return summary;
    }
  }
  const summary = `${n} edits in ${Date.now() - started} ms without a 429`;
  console.log(`[spike] burst ${summary}`);
  return summary;
}

const clampBurst = (raw: string | undefined) =>
  Math.min(Math.max(Number.parseInt(raw ?? '', 10) || 30, 1), 200);

export function registerSpikes(bot: Bot, config: BotEnv) {
  // --- Group flow (G1–G6) ----------------------------------------------------
  bot.command('spike_ttt', async (ctx) => {
    logOrigin('spike_ttt', ctx);
    if (!ctx.from) return;
    if (ctx.match.trim().toLowerCase() === 'bot') {
      const game = createVsBotGame(newGameId(), ctx.from.id, displayName(ctx));
      games.set(game.id, game);
      await ctx.reply(boardText(game), {
        reply_markup: boardKeyboard(game),
        ...threadOptions(ctx),
      });
      return;
    }
    const game = createGame(newGameId(), ctx.from.id, displayName(ctx));
    games.set(game.id, game);
    await ctx.reply(`${displayName(ctx)} wants to play tic-tac-toe. Who's in?`, {
      reply_markup: invitationKeyboard(game.id),
      ...threadOptions(ctx),
    });
  });

  // --- Inline flow (I1–I4) ---------------------------------------------------
  bot.on('inline_query', async (ctx) => {
    logOrigin(`inline_query "${ctx.inlineQuery.query}"`, ctx);
    const n = clampBurst(ctx.inlineQuery.query.match(/^burst\s*(\d+)?/i)?.[1]);
    if (/^burst/i.test(ctx.inlineQuery.query)) {
      await ctx.answerInlineQuery(
        [
          {
            type: 'article',
            id: `burst-${n}`,
            title: `Burst test: ${n} edits`,
            input_message_content: { message_text: `Burst test (${n} edits). Tap to start.` },
            reply_markup: new InlineKeyboard().text('⚡ Start', callbackData('spb', n)),
          },
        ],
        { cache_time: 0, is_personal: true },
      );
      return;
    }

    // Games are created when results are shown: callbacks may arrive even if
    // chosen_inline_result feedback is disabled in BotFather.
    if (/^bot/i.test(ctx.inlineQuery.query)) {
      const game = createVsBotGame(newGameId(), ctx.from.id, displayName(ctx));
      games.set(game.id, game);
      await ctx.answerInlineQuery(
        [
          {
            type: 'article',
            id: game.id,
            title: 'Tic-tac-toe vs bot (spike)',
            description: 'Play against the bot (Easy) right here',
            input_message_content: { message_text: boardText(game) },
            reply_markup: boardKeyboard(game),
          },
        ],
        { cache_time: 0, is_personal: true },
      );
      return;
    }

    const game = createGame(newGameId(), ctx.from.id, displayName(ctx));
    games.set(game.id, game);
    await ctx.answerInlineQuery(
      [
        {
          type: 'article',
          id: game.id,
          title: 'Tic-tac-toe (spike)',
          description: 'Challenge someone in this chat',
          input_message_content: {
            message_text: `${displayName(ctx)} wants to play tic-tac-toe. Who's in?`,
          },
          reply_markup: invitationKeyboard(game.id),
        },
      ],
      { cache_time: 0, is_personal: true },
    );
  });

  bot.on('chosen_inline_result', (ctx) => {
    // Requires /setinlinefeedback; inline_message_id only comes if the result has a keyboard.
    logOrigin(`chosen_inline_result ${ctx.chosenInlineResult.result_id}`, ctx);
  });

  // --- Callbacks (shared by group and inline) --------------------------------
  bot.callbackQuery(/^ttj:(\w+)$/, async (ctx) => {
    logOrigin('join', ctx);
    const game = games.get(ctx.match[1]!);
    if (!game) return ctx.answerCallbackQuery({ text: 'Game not found (server restarted?)' });
    const result = join(game, ctx.from.id, displayName(ctx));
    if (!result.ok) {
      return ctx.answerCallbackQuery({ text: REFUSALS[result.reason], show_alert: true });
    }
    games.set(game.id, result.game);
    await ctx.answerCallbackQuery();
    await showBoard(ctx, result.game);
  });

  bot.callbackQuery(/^ttt:(\w+):(\d):(\d+)$/, async (ctx) => {
    logOrigin('move', ctx);
    const game = games.get(ctx.match[1]!);
    if (!game) return ctx.answerCallbackQuery({ text: 'Game not found (server restarted?)' });
    // Synchronous check-and-set: safe against simultaneous taps in one process (G4).
    // Vs bot, the bot's reply is applied too, so there's one edit per turn.
    const result = playTurn(game, ctx.from.id, Number(ctx.match[2]), Number(ctx.match[3]));
    if (!result.ok) {
      console.log(`[spike] move refused: ${result.reason}`);
      // Alert (modal) for outsiders, toast for players (G3).
      return ctx.answerCallbackQuery({
        text: REFUSALS[result.reason],
        show_alert: result.reason === 'not_player',
      });
    }
    games.set(game.id, result.game);
    await ctx.answerCallbackQuery();
    console.log(`[spike] edit for version ${result.game.version}`);
    await showBoard(ctx, result.game);
  });

  bot.callbackQuery(/^ttr:(\w+):(\d+)$/, async (ctx) => {
    logOrigin('rematch', ctx);
    const game = games.get(ctx.match[1]!);
    if (!game) return ctx.answerCallbackQuery({ text: 'Game not found (server restarted?)' });
    if (!game.players.includes(ctx.from.id)) {
      return ctx.answerCallbackQuery({ text: REFUSALS.not_player, show_alert: true });
    }
    if (Number(ctx.match[2]) !== game.version) {
      return ctx.answerCallbackQuery({ text: REFUSALS.stale });
    }
    const next = rematch(game);
    games.set(game.id, next);
    await ctx.answerCallbackQuery();
    await showBoard(ctx, next);
  });

  // --- Mini App direct link in groups (M1–M6) --------------------------------
  bot.command('spike_app', async (ctx) => {
    logOrigin('spike_app', ctx);
    if (!config.MINIAPP_URL) return void (await ctx.reply('Set BOT_GAMES_MINIAPP_URL first.'));
    const param = ctx.match.trim() || 'spike';
    const link = `${config.MINIAPP_URL}?startapp=${param}`;
    try {
      await ctx.reply(`Mini App links (startapp=${param}, ${param.length} chars)`, {
        reply_markup: new InlineKeyboard()
          .url('🎮 Open (fullsize)', link)
          .row()
          .url('🎮 Open (compact)', `${link}&mode=compact`),
        ...threadOptions(ctx),
      });
    } catch (error) {
      await ctx.reply(`Telegram rejected the buttons: ${describeError(error)}`, threadOptions(ctx));
    }
  });

  bot.command('spike_webapp', async (ctx) => {
    logOrigin('spike_webapp', ctx);
    const url = ctx.match.trim();
    if (!url.startsWith('https://')) {
      return void (await ctx.reply('Usage: /spike_webapp https://<tunnel>/apps/games/'));
    }
    try {
      await ctx.reply('web_app button:', {
        reply_markup: new InlineKeyboard().webApp('🎮 Open (web_app)', url),
        ...threadOptions(ctx),
      });
    } catch (error) {
      // Expected in groups: BUTTON_TYPE_INVALID (M4).
      console.warn('[spike] web_app button rejected', describeError(error));
      await ctx.reply(
        `Telegram rejected the web_app button: ${describeError(error)}`,
        threadOptions(ctx),
      );
    }
  });

  // --- Rate limits (R1) ------------------------------------------------------
  bot.command('spike_burst', async (ctx) => {
    logOrigin('spike_burst', ctx);
    const n = clampBurst(ctx.match);
    const message = await ctx.reply(`Burst test: ${n} edits`, threadOptions(ctx));
    const summary = await burst(
      (text) => ctx.api.editMessageText(message.chat.id, message.message_id, text),
      n,
    );
    await ctx.reply(`Burst result: ${summary}`, threadOptions(ctx));
  });

  bot.callbackQuery(/^spb:(\d+)$/, async (ctx) => {
    logOrigin('inline burst', ctx);
    await ctx.answerCallbackQuery({ text: 'Running…' });
    const n = clampBurst(ctx.match[1]);
    const summary = await burst((text) => ctx.editMessageText(text), n);
    // After a 429 this edit may also fail; the server log has the result either way.
    await ctx.editMessageText(`Burst result: ${summary}`).catch(() => undefined);
  });
}
