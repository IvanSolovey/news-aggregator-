import { Markup, type Context } from 'telegraf';
import type { InlineKeyboardMarkup } from 'telegraf/types';
import {
  getUserFeeds,
  getUserSettings,
  isArticleSent,
  markArticleSent,
} from '../../storage/redis';
import { fetchFeed } from '../../rss/fetcher';
import { formatArticle } from '../../rss/formatter';
import { translateArticle } from '../../translation';
import type { Telegraf } from 'telegraf';

const MAX_ARTICLES_PER_COMMAND = 5;

function refreshKeyboard(): InlineKeyboardMarkup {
  return Markup.inlineKeyboard([[Markup.button.callback('🔄 Оновити', 'news')]]).reply_markup;
}

export async function handleNews(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const feeds = await getUserFeeds(chatId);
  if (feeds.length === 0) {
    await ctx.reply('Ви не підписані на жодну стрічку.\nДодайте за допомогою /add <url>');
    return;
  }

  await ctx.reply('⏳ Завантажую новини…');

  const settings = await getUserSettings(chatId);
  let sent = 0;

  for (const feed of feeds) {
    if (sent >= MAX_ARTICLES_PER_COMMAND) break;

    let articles;
    try {
      const result = await fetchFeed(feed.url, null);
      articles = result.articles.slice(0, MAX_ARTICLES_PER_COMMAND - sent);
    } catch {
      continue;
    }

    for (const article of articles) {
      if (sent >= MAX_ARTICLES_PER_COMMAND) break;
      if (await isArticleSent(chatId, article.link)) continue;

      let translated: { title: string; summary: string } | undefined;
      if (settings.translate && article.summary) {
        try {
          translated = await translateArticle(article.title, article.summary);
        } catch { /* send without translation */ }
      }

      const text = formatArticle(article, translated);
      const isLast = sent === MAX_ARTICLES_PER_COMMAND - 1;
      const keyboard = isLast ? refreshKeyboard() : undefined;

      try {
        if (article.imageUrl) {
          await ctx.replyWithPhoto(article.imageUrl, {
            caption: text,
            parse_mode: 'HTML',
            reply_markup: keyboard,
          });
        } else {
          await ctx.replyWithHTML(text, {
            link_preview_options: { is_disabled: true },
            reply_markup: keyboard,
          });
        }
        await markArticleSent(chatId, article.link);
        sent++;
      } catch {
        // photo inaccessible — retry as text
        try {
          await ctx.replyWithHTML(text, {
            link_preview_options: { is_disabled: true },
            reply_markup: keyboard,
          });
          await markArticleSent(chatId, article.link);
          sent++;
        } catch { /* skip */ }
      }
    }
  }

  if (sent === 0) {
    await ctx.reply('Нових статей немає. Перевірте пізніше або додайте більше стрічок.', {
      reply_markup: refreshKeyboard(),
    });
  }
}

// Used by the cron job
export async function deliverNewArticles(bot: Telegraf, chatId: number): Promise<void> {
  const [feeds, settings] = await Promise.all([
    getUserFeeds(chatId),
    getUserSettings(chatId),
  ]);

  for (const feed of feeds) {
    let articles;
    try {
      const result = await fetchFeed(feed.url, null);
      articles = result.articles;
    } catch {
      continue;
    }

    for (const article of articles) {
      if (await isArticleSent(chatId, article.link)) continue;

      let translated: { title: string; summary: string } | undefined;
      if (settings.translate && article.summary) {
        try {
          translated = await translateArticle(article.title, article.summary);
        } catch { /* send without translation */ }
      }

      const text = formatArticle(article, translated);

      try {
        if (article.imageUrl) {
          await bot.telegram.sendPhoto(chatId, article.imageUrl, {
            caption: text,
            parse_mode: 'HTML',
          });
        } else {
          await bot.telegram.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
          });
        }
        await markArticleSent(chatId, article.link);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('bot was blocked') || msg.includes('chat not found')) break;
        try {
          await bot.telegram.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
          });
          await markArticleSent(chatId, article.link);
        } catch { /* skip */ }
      }
    }
  }
}
