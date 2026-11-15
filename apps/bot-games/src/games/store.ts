// Game persistence shared by every game. The engine decides; the SQL functions in
// supabase/schemas/20_functions.sql make sure only one change per version is saved.
import type { Database, Db, Json } from '@xesmona/contracts';
import type { BotLevel, Mode, Seat } from '@xesmona/games';
import type { User } from 'grammy/types';

export const BOT_PLAYER_NAME = '🤖 Bot';

type GameRow = Database['public']['Tables']['games']['Row'];
type PlayerRow = Database['public']['Tables']['game_players']['Row'];

export interface Player {
  seat: Seat;
  kind: 'human' | 'bot';
  telegramUserId: number | null;
  displayName: string;
}

/**
 * Where the game's message lives: a chat message or an inline message (ADR 0006). Inline
 * messages carry the chat_instance, which groups them by chat for rate limits (ADR 0008).
 */
export type MessageRef =
  | { chatId: number; messageId: number; threadId: number | null }
  | { inlineMessageId: string; chatInstance: string | null };

export type GameStatus = 'waiting' | 'playing' | 'finished' | 'expired';

export interface Game<State> {
  id: string;
  gameType: string;
  mode: Mode | null;
  botLevel: BotLevel | null;
  status: GameStatus;
  state: State;
  version: number;
  /** The version the chat message is known to show (ADR 0010). */
  renderedVersion: number | null;
  round: number;
  result: 'win' | 'draw' | null;
  winnerSeat: Seat | null;
  createdBy: number;
  players: Player[];
  message: MessageRef | null;
}

export type NewPlayer = Omit<Player, 'telegramUserId'> & { telegramUserId?: number };

/** A move as stored in `game_moves.move` (the engine's `encodeMove`). */
export interface SavedMove {
  seat: Seat;
  move: Record<string, number>;
}

export function displayName(user: {
  first_name: string;
  username?: string | null | undefined;
}): string {
  return user.username ? `@${user.username}` : user.first_name;
}

/** The seat of a Telegram user in the game, if they play it. */
export const humanSeat = (game: Game<unknown>, userId: number): Seat | undefined =>
  game.players.find((p) => p.kind === 'human' && p.telegramUserId === userId)?.seat;

function toPlayer(row: PlayerRow): Player {
  return {
    seat: row.seat as Seat,
    kind: row.kind as Player['kind'],
    telegramUserId: row.telegram_user_id,
    displayName: row.display_name,
  };
}

function toMessage(row: GameRow): MessageRef | null {
  if (row.inline_message_id) {
    return { inlineMessageId: row.inline_message_id, chatInstance: row.chat_instance };
  }
  if (row.chat_id !== null && row.message_id !== null) {
    return { chatId: row.chat_id, messageId: row.message_id, threadId: row.message_thread_id };
  }
  return null;
}

function toGame<State>(row: GameRow, players: Player[]): Game<State> {
  return {
    id: row.id,
    gameType: row.game_type,
    mode: row.mode as Mode | null,
    botLevel: row.bot_level as BotLevel | null,
    status: row.status as GameStatus,
    // Written only through this module from the engine's State.
    state: row.state as unknown as State,
    version: row.version,
    renderedVersion: row.rendered_version,
    round: row.round,
    result: row.result as Game<State>['result'],
    winnerSeat: row.winner_seat as Seat | null,
    createdBy: row.created_by,
    players: [...players].sort((a, b) => a.seat - b.seat),
    message: toMessage(row),
  };
}

function fail(action: string, error: { message: string }): never {
  throw new Error(`[games] ${action} failed: ${error.message}`);
}

const asJson = (value: unknown) => value as Json;

/** Remembers a Telegram user's name (inline callbacks only carry the user who taps). */
export async function upsertUser(
  db: Db,
  user: {
    id: number;
    first_name: string;
    username?: string | undefined;
    language_code?: string | undefined;
  },
): Promise<void> {
  const { error } = await db.from('telegram_users').upsert({
    id: user.id,
    first_name: user.first_name,
    username: user.username ?? null,
    language_code: user.language_code ?? null,
    updated_at: new Date().toISOString(),
  });
  if (error) fail('upsertUser', error);
}

export async function getUserName(db: Db, id: number): Promise<string | undefined> {
  const { data, error } = await db
    .from('telegram_users')
    .select('first_name, username')
    .eq('id', id)
    .maybeSingle();
  if (error) fail('getUserName', error);
  return data ? displayName(data) : undefined;
}

const GAME_WITH_PLAYERS = '*, game_players(*)';

/** Loads a game of the given type (an id of another game type is "not found"). */
export async function findGame<State>(
  db: Db,
  gameType: string,
  id: string,
): Promise<Game<State> | undefined> {
  const { data, error } = await db
    .from('games')
    .select(GAME_WITH_PLAYERS)
    .eq('id', id)
    .eq('game_type', gameType)
    .maybeSingle();
  if (error) fail('findGame', error);
  return data ? toGame<State>(data, data.game_players.map(toPlayer)) : undefined;
}

/** Loads a game of any type (the render worker only knows the id). */
export async function loadGame(db: Db, id: string): Promise<Game<unknown> | undefined> {
  const { data, error } = await db
    .from('games')
    .select(GAME_WITH_PLAYERS)
    .eq('id', id)
    .maybeSingle();
  if (error) fail('loadGame', error);
  return data ? toGame<unknown>(data, data.game_players.map(toPlayer)) : undefined;
}

export async function findGameByInlineMessage<State>(
  db: Db,
  gameType: string,
  botId: string,
  inlineMessageId: string,
): Promise<Game<State> | undefined> {
  const { data, error } = await db
    .from('games')
    .select(GAME_WITH_PLAYERS)
    .eq('bot_id', botId)
    .eq('inline_message_id', inlineMessageId)
    .maybeSingle();
  if (error) fail('findGameByInlineMessage', error);
  // An inline message holds one game; if it's another type, it isn't this game's message.
  if (!data || data.game_type !== gameType) return undefined;
  return toGame<State>(data, data.game_players.map(toPlayer));
}

export interface CreateGameInput<State> {
  botId: string;
  gameType: string;
  createdBy: number;
  status: 'waiting' | 'playing';
  state: State;
  players: NewPlayer[];
  mode?: Mode;
  botLevel?: BotLevel;
  inlineMessageId?: string;
  chatInstance?: string;
}

/** Returns undefined if the inline message already has a game (two first taps at once). */
export async function createGame<State>(
  db: Db,
  input: CreateGameInput<State>,
): Promise<Game<State> | undefined> {
  const { data, error } = await db.rpc('create_game', {
    p_bot_id: input.botId,
    p_game_type: input.gameType,
    p_created_by: input.createdBy,
    p_status: input.status,
    p_state: asJson(input.state),
    p_players: asJson(
      input.players.map((p) => ({
        seat: p.seat,
        kind: p.kind,
        telegram_user_id: p.telegramUserId ?? null,
        display_name: p.displayName,
      })),
    ),
    ...(input.mode && { p_mode: input.mode }),
    ...(input.botLevel && { p_bot_level: input.botLevel }),
    ...(input.inlineMessageId && { p_inline_message_id: input.inlineMessageId }),
    ...(input.chatInstance && { p_chat_instance: input.chatInstance }),
  });
  if (error) fail('createGame', error);
  return data?.id ? findGame<State>(db, input.gameType, data.id) : undefined;
}

export async function attachMessage(
  db: Db,
  gameId: string,
  chatId: number,
  messageId: number,
  threadId?: number,
): Promise<void> {
  const { error } = await db.rpc('attach_message', {
    p_game_id: gameId,
    p_chat_id: chatId,
    p_message_id: messageId,
    ...(threadId !== undefined && { p_message_thread_id: threadId }),
  });
  if (error) fail('attachMessage', error);
}

/** Returns undefined when the version no longer matches (someone else changed the game). */
export async function joinGame<State>(
  db: Db,
  game: Game<State>,
  user: Pick<User, 'id' | 'first_name' | 'username'>,
  state: State,
): Promise<Game<State> | undefined> {
  const { data, error } = await db.rpc('join_game', {
    p_game_id: game.id,
    p_expected_version: game.version,
    p_telegram_user_id: user.id,
    p_display_name: displayName(user),
    p_state: asJson(state),
  });
  if (error) fail('joinGame', error);
  return data?.id ? findGame<State>(db, game.gameType, data.id) : undefined;
}

export async function startVsBot<State>(
  db: Db,
  game: Game<State>,
  level: BotLevel,
  state: State,
): Promise<Game<State> | undefined> {
  const { data, error } = await db.rpc('start_vs_bot', {
    p_game_id: game.id,
    p_expected_version: game.version,
    p_bot_level: level,
    p_bot_name: BOT_PLAYER_NAME,
    p_state: asJson(state),
  });
  if (error) fail('startVsBot', error);
  return data?.id ? findGame<State>(db, game.gameType, data.id) : undefined;
}

export interface SaveInput<State> {
  state: State;
  status: 'playing' | 'finished';
  round: number;
  moves: SavedMove[];
  result?: 'win' | 'draw';
  winnerSeat?: Seat;
}

/** Saves moves (or a rematch, with no moves). Undefined when the version no longer matches. */
export async function saveGame<State>(
  db: Db,
  game: Game<State>,
  input: SaveInput<State>,
): Promise<Game<State> | undefined> {
  const { data, error } = await db.rpc('save_game', {
    p_game_id: game.id,
    p_expected_version: game.version,
    p_state: asJson(input.state),
    p_status: input.status,
    p_round: input.round,
    p_moves: asJson(input.moves),
    ...(input.result && { p_result: input.result }),
    ...(input.winnerSeat !== undefined && { p_winner_seat: input.winnerSeat }),
  });
  if (error) fail('saveGame', error);
  return data?.id ? toGame<State>(data, game.players) : undefined;
}

// --- Message renders (ADR 0010) ---------------------------------------------------

export interface PendingRender {
  gameId: string;
  /** Claims so far, this one included. */
  attempts: number;
}

/** Queues a render of the game's message; coalesces with a pending one. */
export async function enqueueRender(db: Db, gameId: string, delaySeconds = 0): Promise<void> {
  const { error } = await db.rpc('enqueue_render', {
    p_game_id: gameId,
    p_delay_seconds: Math.ceil(delaySeconds),
  });
  if (error) fail('enqueueRender', error);
}

/** Claims due renders; claimed rows are leased so no other worker takes them meanwhile. */
export async function claimRenders(db: Db, limit = 20): Promise<PendingRender[]> {
  const { data, error } = await db.rpc('claim_renders', { p_limit: limit });
  if (error) fail('claimRenders', error);
  return (data ?? []).map((row) => ({ gameId: row.game_id, attempts: row.attempts }));
}

/** The message shows `version`: the pending render is dropped if nothing newer is left. */
export async function markRendered(db: Db, gameId: string, version: number): Promise<void> {
  const { error } = await db.rpc('mark_rendered', { p_game_id: gameId, p_version: version });
  if (error) fail('markRendered', error);
}

/** Gives up on a game's pending render (message gone, bot removed, too many attempts). */
export async function dropRender(db: Db, gameId: string): Promise<void> {
  const { error } = await db.from('message_renders').delete().eq('game_id', gameId);
  if (error) fail('dropRender', error);
}

/** Expires abandoned games and queues their message renders. Returns how many expired. */
export async function expireGames(db: Db): Promise<number> {
  const { data, error } = await db.rpc('expire_games');
  if (error) fail('expireGames', error);
  return data ?? 0;
}
