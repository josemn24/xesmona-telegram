// Phase 0 spike: remove once the Mini App (M1–M6) and rate-limit (R1) tests are done.
// Handlers to test Telegram behaviour in real chats. Results go in docs/spikes/phase-0-results.md.
import type { BotEnv } from '@xesmona/contracts';
import { GrammyError, InlineKeyboard, type Bot, type Context } from 'grammy';
import { callbackData } from '../tic-tac-toe/keyboard';

export const spikeHelp = [
  'Phase 0 spikes:',
  '/spike_app <param>: Mini App direct link buttons',
  '/spike_webapp <https-url>: try a web_app button here',
  '/spike_burst <n>: edit one message n times (rate limits)',
  '"@<bot> burst <n>" in any chat: the same in an inline message',
].join('\n');

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
  // --- Inline burst (R1): only "@bot burst…" queries; the rest go to the real games.
  bot.inlineQuery(/^burst/i, async (ctx) => {
    logOrigin(`inline_query "${ctx.inlineQuery.query}"`, ctx);
    const n = clampBurst(ctx.inlineQuery.query.match(/^burst\s*(\d+)?/i)?.[1]);
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
