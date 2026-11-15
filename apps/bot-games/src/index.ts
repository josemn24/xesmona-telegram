import { defineBot } from '@xesmona/contracts';
import { InlineKeyboard } from 'grammy';
import { registerSpikes, spikeHelp } from './spikes';
import { registerTicTacToe } from './tic-tac-toe/handlers';

export const gamesBot = defineBot({
  id: 'games',
  description: 'Xesmona multiplayer games',
  setup(bot, config, { db }) {
    bot.command('start', async (ctx) => {
      const text =
        "Hi! I'm the Xesmona games bot.\n\n" +
        '/play: tic-tac-toe here, against a friend or against me\n' +
        'Or type @' +
        ctx.me.username +
        ' in any chat to send a game there.';
      // `web_app` buttons are not allowed in groups: we use a `url` button
      // with the Mini App direct link (https://t.me/<bot>/<app>?startapp=...).
      if (!config.MINIAPP_URL) return void (await ctx.reply(text));
      await ctx.reply(text, {
        reply_markup: new InlineKeyboard().url('🎮 Open games', config.MINIAPP_URL),
      });
    });

    bot.command('ping', (ctx) => ctx.reply('pong 🏓'));

    // Phase 0 spike tools still needed for the Mini App (M1–M6) and rate-limit (R1) tests.
    // Registered first: its inline handler only takes "@bot burst…" queries.
    bot.command('spikes', (ctx) => ctx.reply(spikeHelp));
    registerSpikes(bot, config);

    registerTicTacToe(bot, db, 'games');
  },
});
