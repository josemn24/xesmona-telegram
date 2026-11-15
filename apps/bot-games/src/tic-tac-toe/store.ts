// Tic-tac-toe persistence. The engine decides; the SQL functions in
// supabase/schemas/20_functions.sql make sure only one change per version is saved.
import type { Database, Db, Json } from '@xesmona/contracts';
import type { User } from 'grammy/types';
import type { BotLevel } from './ai';
import type { Mode, Seat, State } from './engine';

export const GAME_TYPE = 'tic-tac-toe';
export const BOT_PLAYER_NAME = '🤖 Bot';

type GameRow = Database['public']['Tables']['games']['Row'];
type PlayerRow = Database['public']['Tables']['game_players']['Row'];

export interface Player {
  seat: Seat;
  kind: 'human' | 'bot';
  telegramUserId: number | null;
  displayName: string;
}

export interface Game {
  id: string;
  mode: Mode | null;
  botLevel: BotLevel | null;
  status: 'waiting' | 'playing' | 'finished';
  state: State;
  version: number;
  round: number;
  createdBy: number;
  players: Player[];
}

export type NewPlayer = Omit<Player, 'telegramUserId'> & { telegramUserId?: number };

export function displayName(user: {
  first_name: string;
  username?: string | null | undefined;
}): string {
  return user.username ? `@${user.username}` : user.first_name;
}

function toPlayer(row: PlayerRow): Player {
  return {
    seat: row.seat as Seat,
    kind: row.kind as Player['kind'],
    telegramUserId: row.telegram_user_id,
    displayName: row.display_name,
  };
}

function toGame(row: GameRow, players: Player[]): Game {
  return {
    id: row.id,
    mode: row.mode as Mode | null,
    botLevel: row.bot_level as BotLevel | null,
    status: row.status as Game['status'],
    // Written only by this module from the engine's State.
    state: row.state as unknown as State,
    version: row.version,
    round: row.round,
    createdBy: row.created_by,
    players: [...players].sort((a, b) => a.seat - b.seat),
  };
}

function fail(action: string, error: { message: string }): never {
  throw new Error(`[tic-tac-toe] ${action} failed: ${error.message}`);
}

const asJson = (value: unknown) => value as Json;

/** Remembers a Telegram user's name (inline callbacks only carry the user who taps). */
export async function upsertUser(db: Db, user: User): Promise<void> {
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

async function findBy(db: Db, column: 'id' | 'inline_message_id', value: string, botId?: string) {
  let query = db.from('games').select(GAME_WITH_PLAYERS).eq(column, value);
  if (botId) query = query.eq('bot_id', botId);
  const { data, error } = await query.maybeSingle();
  if (error) fail('findGame', error);
  return data ? toGame(data, data.game_players.map(toPlayer)) : undefined;
}

export const findGame = (db: Db, id: string) => findBy(db, 'id', id);

export const findGameByInlineMessage = (db: Db, botId: string, inlineMessageId: string) =>
  findBy(db, 'inline_message_id', inlineMessageId, botId);

export interface CreateGameInput {
  botId: string;
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
export async function createGame(db: Db, input: CreateGameInput): Promise<Game | undefined> {
  const { data, error } = await db.rpc('create_game', {
    p_bot_id: input.botId,
    p_game_type: GAME_TYPE,
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
  return data?.id ? findGame(db, data.id) : undefined;
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
export async function joinGame(
  db: Db,
  game: Game,
  user: User,
  state: State,
): Promise<Game | undefined> {
  const { data, error } = await db.rpc('join_game', {
    p_game_id: game.id,
    p_expected_version: game.version,
    p_telegram_user_id: user.id,
    p_display_name: displayName(user),
    p_state: asJson(state),
  });
  if (error) fail('joinGame', error);
  return data?.id ? findGame(db, data.id) : undefined;
}

export async function startVsBot(
  db: Db,
  game: Game,
  level: BotLevel,
  state: State,
): Promise<Game | undefined> {
  const { data, error } = await db.rpc('start_vs_bot', {
    p_game_id: game.id,
    p_expected_version: game.version,
    p_bot_level: level,
    p_bot_name: BOT_PLAYER_NAME,
    p_state: asJson(state),
  });
  if (error) fail('startVsBot', error);
  return data?.id ? findGame(db, data.id) : undefined;
}

export interface SaveInput {
  state: State;
  status: 'playing' | 'finished';
  round: number;
  moves: { seat: Seat; cell: number }[];
  result?: 'win' | 'draw';
  winnerSeat?: Seat;
}

/** Saves moves (or a rematch, with no moves). Undefined when the version no longer matches. */
export async function saveGame(db: Db, game: Game, input: SaveInput): Promise<Game | undefined> {
  const { data, error } = await db.rpc('save_game', {
    p_game_id: game.id,
    p_expected_version: game.version,
    p_state: asJson(input.state),
    p_status: input.status,
    p_round: input.round,
    p_moves: asJson(input.moves.map((m) => ({ seat: m.seat, move: { cell: m.cell } }))),
    ...(input.result && { p_result: input.result }),
    ...(input.winnerSeat !== undefined && { p_winner_seat: input.winnerSeat }),
  });
  if (error) fail('saveGame', error);
  return data?.id ? toGame(data, game.players) : undefined;
}
