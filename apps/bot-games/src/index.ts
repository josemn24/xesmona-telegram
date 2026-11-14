import { defineBot } from '@xesmona/contracts';
import { InlineKeyboard } from 'grammy';

export const gamesBot = defineBot({
  id: 'games',
  description: 'Xesmona multiplayer games',
  setup(bot, config) {
    bot.command('start', async (ctx) => {
      const text =
        "Hi! I'm the Xesmona games bot. Soon you'll be able to challenge your friends here.";
      // `web_app` buttons are not allowed in groups: we use a `url` button
      // with the Mini App direct link (https://t.me/<bot>/<app>?startapp=...).
      if (!config.MINIAPP_URL) return void (await ctx.reply(text));
      await ctx.reply(text, {
        reply_markup: new InlineKeyboard().url('🎮 Open games', config.MINIAPP_URL),
      });
    });

    bot.command('ping', (ctx) => ctx.reply('pong 🏓'));
  },
});
