import type { SupabaseClient } from '@supabase/supabase-js';
import type { Bot } from 'grammy';
import type { Hono } from 'hono';
import type { Database } from './database.types';
import type { BotEnv } from './env';

/** Typed Supabase client (service role: server only). */
export type Db = SupabaseClient<Database>;

/** What the server needs to give Mini App players live updates (ADR 0009). */
export interface RealtimeConfig {
  supabaseUrl: string;
  publishableKey: string;
  jwtSecret: string;
}

/** Shared services the server creates once and gives to every bot. */
export interface BotServices {
  db: Db;
  /** Missing when the Supabase Realtime variables aren't set: Mini App games can't start. */
  realtime?: RealtimeConfig;
}

/**
 * Declarative bot definition. Each Xesmona bot lives in apps/bot-<id> and exports
 * one of these; the server registers it and manages its lifecycle.
 */
export interface BotDefinition {
  /** Stable identifier: webhook route (/webhook/<id>) and env prefix (BOT_<ID>_). */
  id: string;
  description: string;
  setup(bot: Bot, config: BotEnv, services: BotServices): void;
  /** Optional HTTP API for the bot's Mini Apps, mounted by the server at /api/<id>. */
  api?(bot: Bot, config: BotEnv, services: BotServices): Hono;
}

export function defineBot(definition: BotDefinition): BotDefinition {
  if (!/^[a-z][a-z0-9-]*$/.test(definition.id)) {
    throw new Error(
      `Invalid bot id: "${definition.id}" (use lowercase letters, digits and hyphens)`,
    );
  }
  return definition;
}
