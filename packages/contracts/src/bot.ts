import type { Bot } from 'grammy';
import type { BotEnv } from './env';

/**
 * Declarative bot definition. Each Xesmona bot lives in apps/bot-<id> and exports
 * one of these; the server registers it and manages its lifecycle.
 */
export interface BotDefinition {
  /** Stable identifier: webhook route (/webhook/<id>) and env prefix (BOT_<ID>_). */
  id: string;
  description: string;
  setup(bot: Bot, config: BotEnv): void;
}

export function defineBot(definition: BotDefinition): BotDefinition {
  if (!/^[a-z][a-z0-9-]*$/.test(definition.id)) {
    throw new Error(
      `Invalid bot id: "${definition.id}" (use lowercase letters, digits and hyphens)`,
    );
  }
  return definition;
}
