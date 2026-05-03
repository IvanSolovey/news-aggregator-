import { Telegraf } from 'telegraf';
import { handleStart } from './commands/start';
import { handleAdd, handleList, handleRemove } from './commands/feeds';
import { handleTranslate } from './commands/settings';
import { handleNews } from './commands/news';
import { getArticleForTranslation } from '../storage/redis';
import { translateArticleViaClaude } from '../translation';
import { formatArticle } from '../rss/formatter';

export function createBot(): Telegraf {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');

  const bot = new Telegraf(token);

  bot.command('start', handleStart);
  bot.command('help', handleStart);
  bot.command('add', handleAdd);
  bot.command('list', handleList);
  bot.command('remove', handleRemove);
  bot.command('translate', handleTranslate);
  bot.command('news', handleNews);

  bot.action(/^tr:(.+)$/, async (ctx) => {
    const hash = ctx.match[1];

    const article = await getArticleForTranslation(hash);
    if (!article) {
      await ctx.answerCbQuery('Стаття більше недоступна для перекладу.');
      return;
    }

    await ctx.answerCbQuery('⏳ Перекладаю…');

    let translated: { title: string; summary: string };
    try {
      translated = await translateArticleViaClaude(article.title, article.summary);
    } catch {
      await ctx.answerCbQuery('Помилка перекладу. Спробуйте пізніше.', { show_alert: true });
      return;
    }

    const fakeArticle = {
      title: article.title,
      link: article.link,
      summary: article.summary,
      feedName: article.feedName,
      feedUrl: '',
    };
    const translatedText = formatArticle(fakeArticle, translated);

    const msg = ctx.callbackQuery.message;
    if (!msg) return;

    try {
      if ('photo' in msg && msg.photo) {
        await ctx.editMessageCaption(translatedText, {
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [] },
        });
      } else {
        await ctx.editMessageText(translatedText, {
          parse_mode: 'HTML',
          link_preview_options: { is_disabled: true },
          reply_markup: { inline_keyboard: [] },
        });
      }
    } catch { /* editing may fail if content is identical — ignore */ }
  });

  bot.on('message', ctx =>
    ctx.reply('Невідома команда. Напишіть /help щоб побачити список команд.')
  );

  return bot;
}
