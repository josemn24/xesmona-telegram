// Chat message renders for every game (ADR 0008, ADR 0010). A game's message always shows the
// game's latest state, so a render that can't be sent now is queued (one row per game, so
// pending edits coalesce) and the render worker sends the newest state later.
//
// Nothing here waits for Telegram's `retry_after` or throws into a handler: the move is already
// committed, and a failed render only leaves the message behind for a while.
import type { Db } from '@xesmona/contracts';
import { GrammyError, type Api, type Context, type InlineKeyboard } from 'grammy';
import {
  claimRenders,
  dropRender,
  enqueueRender,
  expireGames,
  loadGame,
  markRendered,
  type Game,
  type MessageRef,
} from './store';

export interface GameView {
  text: string;
  keyboard: InlineKeyboard;
}

/** How each game type shows a game in its chat message. Undefined: the type can't render. */
export type GameViews = Record<string, ((game: Game<unknown>) => GameView) | undefined>;

/** The worker gives up on a message after this many claims. */
export const MAX_RENDER_ATTEMPTS = 10;

// --- Per-chat cooldowns ----------------------------------------------------------------
// After a 429, Telegram refuses every message and edit in that chat for `retry_after` seconds
// (ADR 0008). Kept in memory: there's one server process, and after a restart the worst case
// is one more 429, which sets the cooldown again.

const cooldowns = new Map<string, number>();

/**
 * The rate-limit bucket of a message: the chat for chat messages, the chat_instance for inline
 * ones (ADR 0006, ADR 0008).
 */
export function chatKey(message: MessageRef): string {
  if ('inlineMessageId' in message) {
    return `inline:${message.chatInstance ?? message.inlineMessageId}`;
  }
  return `chat:${message.chatId}`;
}

/** Seconds left in the chat's cooldown, 0 when it can be edited. */
export function cooldownLeft(key: string, now = Date.now()): number {
  const until = cooldowns.get(key);
  if (until === undefined) return 0;
  if (until <= now) {
    cooldowns.delete(key);
    return 0;
  }
  return (until - now) / 1000;
}

function startCooldown(key: string, seconds: number, now = Date.now()) {
  cooldowns.set(key, Math.max(cooldowns.get(key) ?? 0, now + seconds * 1000));
}

/** For tests. */
export function clearCooldowns() {
  cooldowns.clear();
}

// --- Editing ---------------------------------------------------------------------------

type EditOutcome =
  | { kind: 'done' }
  | { kind: 'rate_limited'; retryAfter: number }
  /** Won't work later either: message deleted, bot removed from the chat, bad request. */
  | { kind: 'permanent'; error: unknown }
  /** Network or Telegram trouble: try again later. */
  | { kind: 'transient'; error: unknown };

function classify(error: unknown): EditOutcome {
  if (!(error instanceof GrammyError)) return { kind: 'transient', error };
  if (error.description.includes('message is not modified')) return { kind: 'done' };
  if (error.error_code === 429) {
    return { kind: 'rate_limited', retryAfter: error.parameters.retry_after ?? 30 };
  }
  if (error.error_code === 400 || error.error_code === 403) return { kind: 'permanent', error };
  return { kind: 'transient', error };
}

async function edit(api: Api, message: MessageRef, view: GameView): Promise<EditOutcome> {
  const options = { reply_markup: view.keyboard };
  try {
    if ('inlineMessageId' in message) {
      await api.editMessageTextInline(message.inlineMessageId, view.text, options);
    } else {
      await api.editMessageText(message.chatId, message.messageId, view.text, options);
    }
    return { kind: 'done' };
  } catch (error) {
    return classify(error);
  }
}

/** Retry delay for transient errors: 5 s, 10 s, 20 s… up to 10 minutes. */
export const retryDelaySeconds = (attempts: number) => Math.min(5 * 2 ** attempts, 600);

/**
 * Shows the game's current state in its chat message, or queues it for later. `attempts` is
 * how many times the worker already claimed it (0 from a handler). Never throws.
 */
export async function renderGame(
  api: Api,
  db: Db,
  game: Game<unknown>,
  view: GameView,
  attempts = 0,
): Promise<void> {
  const message = game.message;
  if (!message) return;
  const key = chatKey(message);
  try {
    const wait = cooldownLeft(key);
    if (wait > 0) return await enqueueRender(db, game.id, wait);

    const outcome = await edit(api, message, view);
    switch (outcome.kind) {
      case 'done':
        return await markRendered(db, game.id, game.version);
      case 'rate_limited':
        console.warn(`[render] 429 in ${key}: retry after ${outcome.retryAfter} s`, game.id);
        startCooldown(key, outcome.retryAfter);
        return await enqueueRender(db, game.id, outcome.retryAfter);
      case 'permanent':
        console.warn('[render] giving up on message', game.id, outcome.error);
        return await dropRender(db, game.id);
      case 'transient':
        console.warn('[render] edit failed, will retry', game.id, outcome.error);
        return await enqueueRender(db, game.id, retryDelaySeconds(attempts));
    }
  } catch (error) {
    // The queue itself failed (database down): the next render of this game fixes the message.
    console.error('[render] could not render or queue', game.id, error);
  }
}

/**
 * Edits the message of a callback with something that isn't a game's state (e.g. the level
 * picker), so there's nothing to queue: a 429 only starts the chat's cooldown.
 */
export async function renderCallbackMessage(ctx: Context, view: GameView): Promise<void> {
  const outcome = await ctx
    .editMessageText(view.text, { reply_markup: view.keyboard })
    .then((): EditOutcome => ({ kind: 'done' }), classify);
  if (outcome.kind === 'done') return;
  if (outcome.kind === 'rate_limited') {
    const query = ctx.callbackQuery;
    const chatId = ctx.chat?.id;
    const key = query?.inline_message_id
      ? chatKey({ inlineMessageId: query.inline_message_id, chatInstance: query.chat_instance })
      : chatId !== undefined
        ? `chat:${chatId}`
        : undefined;
    if (key) startCooldown(key, outcome.retryAfter);
  }
  console.warn('[render] callback edit failed', outcome);
}

// --- Worker ----------------------------------------------------------------------------

/** Renders the due queued messages once. Returns how many it claimed. */
export async function processRenders(api: Api, db: Db, views: GameViews): Promise<number> {
  const pending = await claimRenders(db);
  for (const { gameId, attempts } of pending) {
    const game = await loadGame(db, gameId);
    const view = game && views[game.gameType];
    if (!game?.message || !view) {
      await dropRender(db, gameId);
      continue;
    }
    // Rendered meanwhile (e.g. by the next move's handler).
    if ((game.renderedVersion ?? -1) >= game.version) {
      await markRendered(db, game.id, game.version);
      continue;
    }
    if (attempts > MAX_RENDER_ATTEMPTS) {
      console.warn('[render] too many attempts, giving up', game.id);
      await dropRender(db, game.id);
      continue;
    }
    await renderGame(api, db, game, view(game), attempts);
  }
  return pending.length;
}

export interface WorkerOptions {
  /** How often to look for due renders. */
  pollMs?: number;
  /** How often to expire abandoned games. */
  expireEveryMs?: number;
}

/**
 * Background jobs of the games bot, in the server process: drains the render queue and
 * expires abandoned games. Returns a function that stops it and waits for the current run.
 */
export function startWorker(
  api: Api,
  db: Db,
  views: GameViews,
  { pollMs = 2_000, expireEveryMs = 10 * 60_000 }: WorkerOptions = {},
): () => Promise<void> {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let current: Promise<void> = Promise.resolve();
  let lastExpiry = 0;

  async function run() {
    try {
      if (Date.now() - lastExpiry >= expireEveryMs) {
        lastExpiry = Date.now();
        const expired = await expireGames(db);
        if (expired > 0) console.log(`[worker] expired ${expired} abandoned games`);
      }
      await processRenders(api, db, views);
    } catch (error) {
      console.error('[worker] run failed', error);
    }
  }

  function schedule() {
    if (stopped) return;
    timer = setTimeout(() => {
      current = run().finally(schedule);
    }, pollMs);
  }

  schedule();
  return async () => {
    stopped = true;
    clearTimeout(timer);
    await current;
  };
}
