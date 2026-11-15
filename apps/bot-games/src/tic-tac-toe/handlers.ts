// Tic-tac-toe in the chat: /play, inline mode, moves, vs bot and rematch.
// Flows in docs/project-overview.md; decisions in ADR 0005 and ADR 0006.
import type { Db } from '@xesmona/contracts';
import type { Bot, CallbackQueryContext, Context } from 'grammy';
import type { InlineQueryResult } from 'grammy/types';
import {
  applyMove,
  chooseMove,
  initialState,
  other,
  outcome,
  startingSeat,
  type MoveError,
  type Seat,
  type State,
} from '@xesmona/games/tic-tac-toe';
import {
  LEVEL_BY_CODE,
  fromHex,
  inlineInvitationKeyboard,
  inlineLevelKeyboard,
  invitationKeyboard,
  levelKeyboard,
} from './keyboard';
import { renderCallbackMessage, renderGame } from '../games/render';
import {
  BOT_PLAYER_NAME,
  attachMessage,
  createGame,
  displayName,
  findGame,
  findGameByInlineMessage,
  getUserName,
  joinGame,
  saveGame,
  startVsBot,
  upsertUser,
  type Game,
  type SaveInput,
} from './store';
import { gameView, invitationText, levelText } from './text';

type CallbackCtx = CallbackQueryContext<Context>;

const MESSAGES = {
  notPlayer: "You're not playing this game.",
  stale: 'The board changed, try again.',
  gone: 'This game no longer exists.',
  over: 'The game is over.',
  started: 'This game has already started.',
  ownGame: 'You created this game: wait for someone to join, or play vs the bot.',
  onlyCreator: 'Only the player who sent the invitation can choose this.',
  expired: 'This invitation expired: send a new one.',
  error: 'Something went wrong, try again.',
} as const;

const MOVE_ERRORS: Record<MoveError, string> = {
  not_your_turn: "It's not your turn.",
  occupied: 'That cell is taken.',
  finished: MESSAGES.over,
  invalid_cell: MESSAGES.stale,
};

const toast = (ctx: CallbackCtx, text: string) => ctx.answerCallbackQuery({ text });
const alert = (ctx: CallbackCtx, text: string) =>
  ctx.answerCallbackQuery({ text, show_alert: true });

/** Keeps replies inside the forum topic the command came from (ADR 0006). */
function threadId(ctx: Context): number | undefined {
  return ctx.msg?.is_topic_message ? ctx.msg.message_thread_id : undefined;
}

const humanSeat = (game: Game, userId: number): Seat | undefined =>
  game.players.find((p) => p.kind === 'human' && p.telegramUserId === userId)?.seat;

function resultFields(state: State): Pick<SaveInput, 'status' | 'result' | 'winnerSeat'> {
  const result = outcome(state);
  if (!result) return { status: 'playing' };
  if (result === 'draw') return { status: 'finished', result: 'draw' };
  return { status: 'finished', result: 'win', winnerSeat: result.winner };
}

/** Tic-tac-toe entries of the bot's inline results (registered in src/index.ts). */
export function ticTacToeInlineResults(name: string, userId: number): InlineQueryResult[] {
  return [
    {
      type: 'article',
      id: 'challenge',
      title: 'Challenge someone to tic-tac-toe',
      description: 'Anyone in this chat can join',
      input_message_content: { message_text: invitationText(name) },
      reply_markup: inlineInvitationKeyboard(userId),
    },
    {
      type: 'article',
      id: 'vs-bot',
      title: 'Play tic-tac-toe vs the bot',
      description: 'Easy, Normal or Hard',
      input_message_content: { message_text: levelText(name) },
      reply_markup: inlineLevelKeyboard(userId),
    },
  ];
}

export function registerTicTacToe(bot: Bot, db: Db, botId: string) {
  /** Registers a callback handler that always answers the query, even on errors. */
  function onCallback(pattern: RegExp, handler: (ctx: CallbackCtx) => Promise<unknown>) {
    bot.callbackQuery(pattern, async (ctx) => {
      try {
        await handler(ctx);
      } catch (error) {
        console.error('[tic-tac-toe] callback failed', error);
        await ctx.answerCallbackQuery({ text: MESSAGES.error }).catch(() => undefined);
      }
    });
  }

  const match = (ctx: CallbackCtx, index: number) => (ctx.match as RegExpMatchArray)[index] ?? '';

  // --- Invitations -------------------------------------------------------------

  bot.command('play', async (ctx) => {
    if (!ctx.from) return;
    await upsertUser(db, ctx.from);
    const game = await createGame(db, {
      botId,
      createdBy: ctx.from.id,
      status: 'waiting',
      state: initialState(0),
      players: [
        { seat: 0, kind: 'human', telegramUserId: ctx.from.id, displayName: displayName(ctx.from) },
      ],
    });
    if (!game) throw new Error('create_game returned no game');
    const thread = threadId(ctx);
    const message = await ctx.reply(invitationText(displayName(ctx.from)), {
      reply_markup: invitationKeyboard(game),
      ...(thread !== undefined && { message_thread_id: thread }),
    });
    await attachMessage(db, game.id, message.chat.id, message.message_id, thread);
  });

  // Join a /play invitation.
  onCallback(/^ttj:([0-9a-f]{32}):(\d+)$/, async (ctx) => {
    const game = await findGame(db, fromHex(match(ctx, 1)));
    if (!game) return toast(ctx, MESSAGES.gone);
    if (game.status !== 'waiting') return toast(ctx, MESSAGES.started);
    if (ctx.from.id === game.createdBy) return alert(ctx, MESSAGES.ownGame);
    if (Number(match(ctx, 2)) !== game.version) return toast(ctx, MESSAGES.stale);
    await upsertUser(db, ctx.from);
    const joined = await joinGame(db, game, ctx.from, initialState(startingSeat('pvp', 0)));
    if (!joined) return toast(ctx, MESSAGES.started);
    await ctx.answerCallbackQuery();
    await renderGame(ctx.api, db, joined, gameView(joined));
  });

  // "Play vs bot" on a /play invitation: show the levels.
  onCallback(/^ttb:([0-9a-f]{32}):(\d+)$/, async (ctx) => {
    const game = await findGame(db, fromHex(match(ctx, 1)));
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

  // Level chosen on a /play invitation: start vs bot.
  onCallback(/^ttl:([0-9a-f]{32}):([enh]):(\d+)$/, async (ctx) => {
    const game = await findGame(db, fromHex(match(ctx, 1)));
    const level = LEVEL_BY_CODE[match(ctx, 2)];
    if (!game || !level) return toast(ctx, MESSAGES.gone);
    if (game.status !== 'waiting') return toast(ctx, MESSAGES.started);
    if (ctx.from.id !== game.createdBy) return alert(ctx, MESSAGES.onlyCreator);
    if (Number(match(ctx, 3)) !== game.version) return toast(ctx, MESSAGES.stale);
    const started = await startVsBot(db, game, level, initialState(startingSeat('vs_bot', 0)));
    if (!started) return toast(ctx, MESSAGES.started);
    await ctx.answerCallbackQuery();
    await renderGame(ctx.api, db, started, gameView(started));
  });

  // First tap on an inline message: the game is created now (ADR 0006).
  onCallback(/^tti:([jbenh]):(\d+)$/, async (ctx) => {
    const inlineMessageId = ctx.callbackQuery.inline_message_id;
    if (!inlineMessageId) return toast(ctx, MESSAGES.gone);
    if (await findGameByInlineMessage(db, botId, inlineMessageId)) {
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
      const game = await createGame(db, {
        ...common,
        mode: 'pvp',
        state: initialState(startingSeat('pvp', 0)),
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
      await ctx.answerCallbackQuery();
      return renderGame(ctx.api, db, game, gameView(game));
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
    const game = await createGame(db, {
      ...common,
      mode: 'vs_bot',
      botLevel: level,
      state: initialState(startingSeat('vs_bot', 0)),
      players: [creator, { seat: 1, kind: 'bot', displayName: BOT_PLAYER_NAME }],
    });
    if (!game) return toast(ctx, MESSAGES.started);
    await ctx.answerCallbackQuery();
    return renderGame(ctx.api, db, game, gameView(game));
  });

  // --- Playing -----------------------------------------------------------------

  onCallback(/^ttt:([0-9a-f]{32}):(\d):(\d+)$/, async (ctx) => {
    const game = await findGame(db, fromHex(match(ctx, 1)));
    if (!game) return toast(ctx, MESSAGES.gone);
    const seat = humanSeat(game, ctx.from.id);
    // Alert (modal) for outsiders, toast for players (ADR 0006).
    if (seat === undefined) return alert(ctx, MESSAGES.notPlayer);
    if (Number(match(ctx, 3)) !== game.version) return toast(ctx, MESSAGES.stale);
    if (game.status !== 'playing') return toast(ctx, MESSAGES.over);

    const cell = Number(match(ctx, 2));
    const human = applyMove(game.state, seat, cell);
    if (!human.ok) return toast(ctx, MOVE_ERRORS[human.reason]);
    let state = human.state;
    const moves = [{ seat, cell }];

    // Vs bot: the bot replies in the same save, so the message is edited once (ADR 0005).
    if (game.mode === 'vs_bot' && game.botLevel && !outcome(state)) {
      const botSeat = other(seat);
      const botCell = chooseMove(state, botSeat, game.botLevel);
      const reply = applyMove(state, botSeat, botCell);
      if (!reply.ok) throw new Error(`Bot chose an illegal move: ${reply.reason}`);
      state = reply.state;
      moves.push({ seat: botSeat, cell: botCell });
    }

    const saved = await saveGame(db, game, {
      state,
      round: game.round,
      moves,
      ...resultFields(state),
    });
    // Someone else changed the game first (e.g. a simultaneous tap).
    if (!saved) return toast(ctx, MESSAGES.stale);
    await ctx.answerCallbackQuery();
    await renderGame(ctx.api, db, saved, gameView(saved));
  });

  onCallback(/^ttr:([0-9a-f]{32}):(\d+)$/, async (ctx) => {
    const game = await findGame(db, fromHex(match(ctx, 1)));
    if (!game) return toast(ctx, MESSAGES.gone);
    if (humanSeat(game, ctx.from.id) === undefined) return alert(ctx, MESSAGES.notPlayer);
    const over = game.status === 'finished' || game.status === 'expired';
    if (Number(match(ctx, 2)) !== game.version || !over) {
      return toast(ctx, MESSAGES.stale);
    }
    const round = game.round + 1;
    const saved = await saveGame(db, game, {
      state: initialState(startingSeat(game.mode ?? 'pvp', round)),
      status: 'playing',
      round,
      moves: [],
    });
    if (!saved) return toast(ctx, MESSAGES.stale);
    await ctx.answerCallbackQuery();
    await renderGame(ctx.api, db, saved, gameView(saved));
  });
}
