// Four in a row in the chat: /four, inline mode, joining, vs bot and rematch. The moves
// happen in the Mini App (./api.ts). Decisions in ADR 0005–0008.
import type { Db } from '@xesmona/contracts';
import { startingSeat } from '@xesmona/games';
import { fourInARow, type State } from '@xesmona/games/four-in-a-row';
import type { Api, Bot, CallbackQueryContext, Context } from 'grammy';
import type { InlineQueryResult } from 'grammy/types';
import { LEVEL_BY_CODE, fromHex } from '../games/callback';
import { renderCallbackMessage, renderGame } from '../games/render';
import {
  BOT_PLAYER_NAME,
  attachMessage,
  createGame,
  displayName,
  findGame,
  findGameByInlineMessage,
  getUserName,
  humanSeat,
  joinGame,
  saveGame,
  startVsBot,
  upsertUser,
  type Game,
} from '../games/store';
import {
  inlineInvitationKeyboard,
  inlineLevelKeyboard,
  invitationKeyboard,
  levelKeyboard,
} from './keyboard';
import { NO_MINI_APP, gameView, invitationText, levelText } from './text';

type CallbackCtx = CallbackQueryContext<Context>;

const GAME_TYPE = fourInARow.type;

const MESSAGES = {
  notPlayer: "You're not playing this game.",
  stale: 'The game changed, try again.',
  gone: 'This game no longer exists.',
  started: 'This game has already started.',
  notOver: 'The game is still on.',
  ownGame: 'You created this game: wait for someone to join, or play vs the bot.',
  onlyCreator: 'Only the player who sent the invitation can choose this.',
  expired: 'This invitation expired: send a new one.',
  error: 'Something went wrong, try again.',
} as const;

const toast = (ctx: CallbackCtx, text: string) => ctx.answerCallbackQuery({ text });
const alert = (ctx: CallbackCtx, text: string) =>
  ctx.answerCallbackQuery({ text, show_alert: true });

/**
 * Shows a game's current state in its chat message (callbacks, and the Mini App API when a game
 * ends). A 429 or a transient error queues the render for later (ADR 0010).
 */
export function renderGameMessage(api: Api, db: Db, game: Game<State>, miniAppUrl: string) {
  return renderGame(api, db, game, gameView(game, miniAppUrl));
}

/** Four in a row entries of the bot's inline results; none without the Mini App. */
export function fourInARowInlineResults(
  name: string,
  userId: number,
  miniAppUrl: string | undefined,
): InlineQueryResult[] {
  if (!miniAppUrl) return [];
  return [
    {
      type: 'article',
      id: 'c4-challenge',
      title: 'Challenge someone to Four in a row',
      description: 'Played in the Mini App; anyone in this chat can join',
      input_message_content: { message_text: invitationText(name) },
      reply_markup: inlineInvitationKeyboard(userId),
    },
    {
      type: 'article',
      id: 'c4-vs-bot',
      title: 'Play Four in a row vs the bot',
      description: 'Easy, Normal or Hard',
      input_message_content: { message_text: levelText(name) },
      reply_markup: inlineLevelKeyboard(userId),
    },
  ];
}

export function registerFourInARow(
  bot: Bot,
  db: Db,
  botId: string,
  miniAppUrl: string | undefined,
) {
  const initial = (mode: 'pvp' | 'vs_bot', round = 0) =>
    fourInARow.initialState(startingSeat(mode, round));
  const find = (id: string) => findGame<State>(db, GAME_TYPE, id);

  /** Registers a callback handler that always answers the query, even on errors. */
  function onCallback(
    pattern: RegExp,
    handler: (ctx: CallbackCtx, url: string) => Promise<unknown>,
  ) {
    bot.callbackQuery(pattern, async (ctx) => {
      try {
        if (!miniAppUrl) return await alert(ctx, NO_MINI_APP);
        await handler(ctx, miniAppUrl);
      } catch (error) {
        console.error('[four-in-a-row] callback failed', error);
        await ctx.answerCallbackQuery({ text: MESSAGES.error }).catch(() => undefined);
      }
    });
  }

  const match = (ctx: CallbackCtx, index: number) => (ctx.match as RegExpMatchArray)[index] ?? '';

  /** Shows a started game: players and the link that opens it in the Mini App. */
  async function showGame(ctx: CallbackCtx, game: Game<State>, url: string) {
    await ctx.answerCallbackQuery();
    await renderGameMessage(ctx.api, db, game, url);
  }

  bot.command('four', async (ctx) => {
    if (!ctx.from) return;
    if (!miniAppUrl) return void (await ctx.reply(NO_MINI_APP));
    await upsertUser(db, ctx.from);
    const game = await createGame<State>(db, {
      botId,
      gameType: GAME_TYPE,
      createdBy: ctx.from.id,
      status: 'waiting',
      state: initial('pvp'),
      players: [
        { seat: 0, kind: 'human', telegramUserId: ctx.from.id, displayName: displayName(ctx.from) },
      ],
    });
    if (!game) throw new Error('create_game returned no game');
    const thread = ctx.msg?.is_topic_message ? ctx.msg.message_thread_id : undefined;
    const message = await ctx.reply(invitationText(displayName(ctx.from)), {
      reply_markup: invitationKeyboard(game),
      ...(thread !== undefined && { message_thread_id: thread }),
    });
    await attachMessage(db, game.id, message.chat.id, message.message_id, thread);
  });

  // Join a /four invitation.
  onCallback(/^c4j:([0-9a-f]{32}):(\d+)$/, async (ctx, url) => {
    const game = await find(fromHex(match(ctx, 1)));
    if (!game) return toast(ctx, MESSAGES.gone);
    if (game.status !== 'waiting') return toast(ctx, MESSAGES.started);
    if (ctx.from.id === game.createdBy) return alert(ctx, MESSAGES.ownGame);
    if (Number(match(ctx, 2)) !== game.version) return toast(ctx, MESSAGES.stale);
    await upsertUser(db, ctx.from);
    const joined = await joinGame(db, game, ctx.from, initial('pvp'));
    if (!joined) return toast(ctx, MESSAGES.started);
    await showGame(ctx, joined, url);
  });

  // "Play vs bot" on a /four invitation: show the levels.
  onCallback(/^c4b:([0-9a-f]{32}):(\d+)$/, async (ctx) => {
    const game = await find(fromHex(match(ctx, 1)));
    if (!game) return toast(ctx, MESSAGES.gone);
    if (game.status !== 'waiting') return toast(ctx, MESSAGES.started);
    if (ctx.from.id !== game.createdBy) return alert(ctx, MESSAGES.onlyCreator);
    if (Number(match(ctx, 2)) !== game.version) return toast(ctx, MESSAGES.stale);
    await ctx.answerCallbackQuery();
    await renderCallbackMessage(ctx, {
      text: levelText(game.players[0]?.displayName ?? '?'),
      keyboard: levelKeyboard(game),
    });
  });

  // Level chosen on a /four invitation: start vs bot.
  onCallback(/^c4l:([0-9a-f]{32}):([enh]):(\d+)$/, async (ctx, url) => {
    const game = await find(fromHex(match(ctx, 1)));
    const level = LEVEL_BY_CODE[match(ctx, 2)];
    if (!game || !level) return toast(ctx, MESSAGES.gone);
    if (game.status !== 'waiting') return toast(ctx, MESSAGES.started);
    if (ctx.from.id !== game.createdBy) return alert(ctx, MESSAGES.onlyCreator);
    if (Number(match(ctx, 3)) !== game.version) return toast(ctx, MESSAGES.stale);
    const started = await startVsBot(db, game, level, initial('vs_bot'));
    if (!started) return toast(ctx, MESSAGES.started);
    await showGame(ctx, started, url);
  });

  // First tap on an inline message: the game is created now (ADR 0006).
  onCallback(/^c4i:([jbenh]):(\d+)$/, async (ctx, url) => {
    const inlineMessageId = ctx.callbackQuery.inline_message_id;
    if (!inlineMessageId) return toast(ctx, MESSAGES.gone);
    if (await findGameByInlineMessage(db, GAME_TYPE, botId, inlineMessageId)) {
      return toast(ctx, MESSAGES.stale);
    }
    const action = match(ctx, 1);
    const creatorId = Number(match(ctx, 2));
    const isCreator = ctx.from.id === creatorId;
    if (isCreator) await upsertUser(db, ctx.from);
    const creatorName = await getUserName(db, creatorId);
    if (!creatorName) return alert(ctx, MESSAGES.expired);
    const common = {
      botId,
      gameType: GAME_TYPE,
      createdBy: creatorId,
      status: 'playing' as const,
      inlineMessageId,
      chatInstance: ctx.callbackQuery.chat_instance,
    };
    const creator = {
      seat: 0 as const,
      kind: 'human' as const,
      telegramUserId: creatorId,
      displayName: creatorName,
    };

    if (action === 'j') {
      if (isCreator) return alert(ctx, MESSAGES.ownGame);
      await upsertUser(db, ctx.from);
      const game = await createGame<State>(db, {
        ...common,
        mode: 'pvp',
        state: initial('pvp'),
        players: [
          creator,
          {
            seat: 1,
            kind: 'human',
            telegramUserId: ctx.from.id,
            displayName: displayName(ctx.from),
          },
        ],
      });
      if (!game) return toast(ctx, MESSAGES.started);
      return showGame(ctx, game, url);
    }

    if (!isCreator) return alert(ctx, MESSAGES.onlyCreator);
    if (action === 'b') {
      await ctx.answerCallbackQuery();
      return renderCallbackMessage(ctx, {
        text: levelText(creatorName),
        keyboard: inlineLevelKeyboard(creatorId),
      });
    }

    const level = LEVEL_BY_CODE[action];
    if (!level) return toast(ctx, MESSAGES.gone);
    const game = await createGame<State>(db, {
      ...common,
      mode: 'vs_bot',
      botLevel: level,
      state: initial('vs_bot'),
      players: [creator, { seat: 1, kind: 'bot', displayName: BOT_PLAYER_NAME }],
    });
    if (!game) return toast(ctx, MESSAGES.started);
    return showGame(ctx, game, url);
  });

  // Rematch on a finished game: a new round with the same players, in the same message.
  onCallback(/^c4r:([0-9a-f]{32}):(\d+)$/, async (ctx, url) => {
    const game = await find(fromHex(match(ctx, 1)));
    if (!game) return toast(ctx, MESSAGES.gone);
    if (humanSeat(game, ctx.from.id) === undefined) return alert(ctx, MESSAGES.notPlayer);
    if (game.status !== 'finished' && game.status !== 'expired') {
      return toast(ctx, MESSAGES.notOver);
    }
    if (Number(match(ctx, 2)) !== game.version) return toast(ctx, MESSAGES.stale);
    const round = game.round + 1;
    const saved = await saveGame(db, game, {
      state: initial(game.mode ?? 'pvp', round),
      status: 'playing',
      round,
      moves: [],
    });
    if (!saved) return toast(ctx, MESSAGES.stale);
    await showGame(ctx, saved, url);
  });
}
