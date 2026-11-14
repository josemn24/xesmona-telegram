import { gamesBot } from '@xesmona/bot-games';
import { botEnvPrefix, readBotEnv, type BotDefinition, type BotEnv } from '@xesmona/contracts';
import { Bot } from 'grammy';

/** Registro estático de bots. Añade aquí cada nuevo apps/bot-<id>. */
const definitions: BotDefinition[] = [gamesBot];

export interface RunningBot {
  id: string;
  bot: Bot;
  config: BotEnv;
}

export function createBots(env: Record<string, string | undefined>): RunningBot[] {
  const bots: RunningBot[] = [];
  for (const definition of definitions) {
    const prefix = botEnvPrefix(definition.id);
    if (!env[`${prefix}TOKEN`]) {
      console.warn(`[bots] ${prefix}TOKEN no definido: el bot "${definition.id}" no se inicia`);
      continue;
    }
    const config = readBotEnv(definition.id, env);
    const bot = new Bot(config.TOKEN);
    definition.setup(bot, config);
    bot.catch((err) => console.error(`[bot:${definition.id}]`, err.error));
    bots.push({ id: definition.id, bot, config });
  }
  return bots;
}
