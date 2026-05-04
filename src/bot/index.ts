import { Telegraf } from 'telegraf';
import { handleStart } from './commands/start';
import { handleList } from './commands/feeds';
import { handleTranslate } from './commands/settings';
import { handleNews, articleHash } from './commands/news';
import { getConfiguredFeeds, shortHash } from '../config';
import { fetchFeed } from '../rss/fetcher';
import { translateArticleViaClaude } from '../translation';
import { formatArticle } from '../rss/formatter';

export function createBot(): Telegraf {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');

  const bot = new Telegraf(token);

  bot.command('start', handleStart);
  bot.command('help', handleStart);
  bot.command('list', handleList);
  bot.command('translate', handleTranslate);
  bot.command('news', handleNews);

  // Callback data format: tr:<feedHash12>:<articleHash12>
  bot.action(/^tr:([a-f0-9]{12}):([a-f0-9]{12})$/, async (ctx) => {
    const feedHash = ctx.match[1];
    const artHash = ctx.match[2];

    await ctx.answerCbQuery('⏳ Перекладаю…');

    try {
      const feeds = getConfiguredFeeds();
      const feedUrl = feeds.find(u => shortHash(u) === feedHash);
      if (!feedUrl) {
        await ctx.reply('Стрічка більше не налаштована.');
        return;
      }

      const result = await fetchFeed(feedUrl, null);
      const article = result.articles.find(a => articleHash(a.link) === artHash);
      if (!article) {
        await ctx.reply('Стаття більше недоступна в стрічці.');
        return;
      }

      let translated: { title: string; summary: string };
      try {
        translated = await translateArticleViaClaude(article.title, article.summary);
      } catch {
        await ctx.reply('Помилка перекладу. Спробуйте пізніше.');
        return;
      }

      const translatedText = formatArticle(article, translated);
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
    } catch {
      await ctx.reply('Технічна помилка. Спробуйте пізніше.').catch(() => {});
    }
  });

  bot.on('message', ctx =>
    ctx.reply('Невідома команда. Напишіть /help щоб побачити список команд.')
  );

  return bot;
}
