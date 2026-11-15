// Shapes of the games API between the server and the Mini Apps (ADR 0009). Types only, so the
// Mini Apps don't depend on the server's packages.
import type { BotLevel, Mode, Seat } from './engine';

export interface SessionResponse {
  supabaseUrl: string;
  publishableKey: string;
  /** Supabase JWT for Realtime only; moves still go through the API. */
  token: string;
  /** Unix seconds. */
  expiresAt: number;
}

export interface SnapshotPlayer {
  seat: Seat;
  kind: 'human' | 'bot';
  displayName: string;
}

export interface GameSnapshot<State> {
  id: string;
  gameType: string;
  status: 'waiting' | 'playing' | 'finished';
  mode: Mode | null;
  botLevel: BotLevel | null;
  version: number;
  round: number;
  state: State;
  result: 'win' | 'draw' | null;
  winnerSeat: Seat | null;
  players: SnapshotPlayer[];
  /** The caller's seat, or null when they don't play this game (read only). */
  you: Seat | null;
}

/** Payload of the Realtime `game` broadcast (supabase/schemas/30_realtime.sql). */
export interface GameBroadcast<State> {
  version: number;
  state: State;
  status: GameSnapshot<State>['status'];
  result: GameSnapshot<State>['result'];
  winner_seat: Seat | null;
  round: number;
  mode: Mode | null;
}

export interface MoveRequest {
  /** The version the client saw; a stale one gets 409. */
  version: number;
  move: unknown;
}

export type ApiErrorCode =
  | 'missing_init_data'
  | 'invalid_hash'
  | 'missing_hash'
  | 'expired'
  | 'invalid_payload'
  | 'not_found'
  | 'not_player'
  | 'stale'
  | 'not_playing'
  | 'invalid_move'
  | 'not_your_turn'
  | 'realtime_unavailable';
