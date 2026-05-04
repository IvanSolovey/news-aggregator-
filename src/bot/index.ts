import { Telegraf } from 'telegraf';
import { handleStart } from './commands/start';
import { handleAdd, handleList, handleRemove } from './commands/feeds';
import { handleTranslate } from './commands/settings';
import { handleNews, articleHash } from './commands/news';
import { getFeeds } from '../storage/feeds';
import { shortHash } from '../config';
import { fetchFeed } from '../rss/fetcher';
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

  // Handle all tr:* callback queries in one handler to avoid regex issues
  bot.action(/^tr:/, async (ctx) => {
    const data = (ctx.callbackQuery as { data?: string }).data ?? '';
    console.log(`[bot.action] tr: handler reached, data="${data}"`);

    await ctx.answerCbQuery('⏳ Перекладаю…').catch((e: unknown) => {
      console.error('[bot.action] answerCbQuery failed:', e);
    });

    const parts = data.split(':');

    // Old format: tr:<hash> — can no longer translate, data lost
    if (parts.length === 2) {
      await ctx.reply('Надішліть /news ще раз — формат кнопок оновлено.').catch(() => {});
      return;
    }

    if (parts.length !== 3) {
      await ctx.reply('Невідомий формат кнопки.').catch(() => {});
      return;
    }

    const [, feedHash, artHash] = parts;

    try {
      const feeds = await getFeeds();
      console.log(`[bot.action] feeds count=${feeds.length}, looking for feedHash=${feedHash}`);

      const feed = feeds.find(f => shortHash(f.url) === feedHash);
      if (!feed) {
        await ctx.reply('Стрічку видалено зі списку підписок.');
        return;
      }

      const result = await fetchFeed(feed.url, null);
      const article = result.articles.find(a => articleHash(a.link) === artHash);
      if (!article) {
        await ctx.reply('Стаття більше недоступна в стрічці.');
        return;
      }

      let translated: { title: string; summary: string };
      try {
        translated = await translateArticleViaClaude(article.title, article.summary);
      } catch (e) {
        console.error('[bot.action] translation error:', e);
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
      } catch { /* ignore if content identical */ }
    } catch (e) {
      console.error('[bot.action] outer error:', e);
      await ctx.reply('Технічна помилка. Спробуйте пізніше.').catch(() => {});
    }
  });

  bot.on('message', ctx =>
    ctx.reply('Невідома команда. Напишіть /help щоб побачити список команд.')
  );

  return bot;
}
