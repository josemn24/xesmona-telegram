import { defineBot } from '@xesmona/contracts';
import { InlineKeyboard } from 'grammy';
import { registerSpikes, spikeHelp } from './spikes';

export const gamesBot = defineBot({
  id: 'games',
  description: 'Xesmona multiplayer games',
  setup(bot, config) {
    bot.command('start', async (ctx) => {
      const text =
        "Hi! I'm the Xesmona games bot. Soon you'll be able to challenge your friends here.\n" +
        'Testing? Send /spikes for the Phase 0 commands.';
      // `web_app` buttons are not allowed in groups: we use a `url` button
      // with the Mini App direct link (https://t.me/<bot>/<app>?startapp=...).
      if (!config.MINIAPP_URL) return void (await ctx.reply(text));
      await ctx.reply(text, {
        reply_markup: new InlineKeyboard().url('🎮 Open games', config.MINIAPP_URL),
      });
    });

    bot.command('ping', (ctx) => ctx.reply('pong 🏓'));

    bot.command('spikes', (ctx) => ctx.reply(spikeHelp));
    registerSpikes(bot, config); // Phase 0 spike: remove in Phase 1
  },
});
