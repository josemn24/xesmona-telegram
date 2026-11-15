import { defineBot } from '@xesmona/contracts';
import { InlineKeyboard } from 'grammy';
import { gamesApi } from './api';
import { fourInARowInlineResults, registerFourInARow } from './four-in-a-row/handlers';
import { displayName, upsertUser } from './games/store';
import { registerTicTacToe, ticTacToeInlineResults } from './tic-tac-toe/handlers';

export const gamesBot = defineBot({
  id: 'games',
  description: 'Xesmona multiplayer games',
  setup(bot, config, { db }) {
    bot.command('start', async (ctx) => {
      const text =
        "Hi! I'm the Xesmona games bot.\n\n" +
        '/play: tic-tac-toe here, against a friend or against me\n' +
        (config.MINIAPP_URL ? '/four: Four in a row in the Mini App\n' : '') +
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

    // One inline answer for every game: Telegram uses the first answer only.
    bot.on('inline_query', async (ctx) => {
      await upsertUser(db, ctx.from);
      const name = displayName(ctx.from);
      await ctx.answerInlineQuery(
        [
          ...ticTacToeInlineResults(name, ctx.from.id),
          ...fourInARowInlineResults(name, ctx.from.id, config.MINIAPP_URL),
        ],
        // Buttons carry the sender's id, so results can't be shared between users.
        { cache_time: 0, is_personal: true },
      );
    });

    registerTicTacToe(bot, db, 'games');
    registerFourInARow(bot, db, 'games', config.MINIAPP_URL);
  },
  api: gamesApi,
});
