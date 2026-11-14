import { defineBot } from '@xesmona/contracts';
import { InlineKeyboard } from 'grammy';

export const gamesBot = defineBot({
  id: 'games',
  description: 'Juegos multijugador de Xesmona',
  setup(bot, config) {
    bot.command('start', async (ctx) => {
      const text = '¡Hola! Soy el bot de juegos de Xesmona. Pronto podrás retar a tus amigos aquí.';
      // En grupos los botones `web_app` no están permitidos: usamos un botón `url`
      // con el direct link de la Mini App (https://t.me/<bot>/<app>?startapp=...).
      if (!config.MINIAPP_URL) return void (await ctx.reply(text));
      await ctx.reply(text, {
        reply_markup: new InlineKeyboard().url('🎮 Abrir juegos', config.MINIAPP_URL),
      });
    });

    bot.command('ping', (ctx) => ctx.reply('pong 🏓'));
  },
});
