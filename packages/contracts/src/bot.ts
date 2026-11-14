import type { Bot } from 'grammy';
import type { BotEnv } from './env';

/**
 * Definición declarativa de un bot. Cada bot de Xesmona vive en apps/bot-<id> y
 * exporta una de estas; el servidor la registra y gestiona su ciclo de vida.
 */
export interface BotDefinition {
  /** Identificador estable: ruta del webhook (/webhook/<id>) y prefijo de env (BOT_<ID>_). */
  id: string;
  description: string;
  setup(bot: Bot, config: BotEnv): void;
}

export function defineBot(definition: BotDefinition): BotDefinition {
  if (!/^[a-z][a-z0-9-]*$/.test(definition.id)) {
    throw new Error(`Id de bot inválido: "${definition.id}" (usa minúsculas, números y guiones)`);
  }
  return definition;
}
