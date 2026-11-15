import { gamesBot } from '@xesmona/bot-games';
import {
  botEnvPrefix,
  readBotEnv,
  type BotDefinition,
  type BotEnv,
  type BotServices,
} from '@xesmona/contracts';
import { Bot } from 'grammy';

/** Static bot registry. Add each new apps/bot-<id> here. */
const definitions: BotDefinition[] = [gamesBot];

export interface RunningBot {
  id: string;
  bot: Bot;
  config: BotEnv;
}

/** `getServices` is called only if at least one bot starts (it may exit when misconfigured). */
export function createBots(
  env: Record<string, string | undefined>,
  getServices: () => BotServices,
): RunningBot[] {
  const bots: RunningBot[] = [];
  let services: BotServices | undefined;
  for (const definition of definitions) {
    const prefix = botEnvPrefix(definition.id);
    if (!env[`${prefix}TOKEN`]) {
      console.warn(`[bots] ${prefix}TOKEN not set: bot "${definition.id}" will not start`);
      continue;
    }
    const config = readBotEnv(definition.id, env);
    const bot = new Bot(config.TOKEN);
    services ??= getServices();
    definition.setup(bot, config, services);
    bot.catch((err) => console.error(`[bot:${definition.id}]`, err.error));
    bots.push({ id: definition.id, bot, config });
  }
  return bots;
}
