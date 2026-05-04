import { Markup, type Context } from 'telegraf';
import { getFeeds, isArticleSent, markArticleSent } from '../../storage/feeds';
import { isAutoTranslate, shortHash } from '../../config';
import { fetchFeed } from '../../rss/fetcher';
import { formatArticle } from '../../rss/formatter';
import { translateArticle, isClaudeTranslationAvailable } from '../../translation';
import type { Article } from '../../types';
import type { Telegraf } from 'telegraf';

const NEWS_WINDOW_MS = 24 * 60 * 60 * 1000;

function isLikelyUkrainian(text: string): boolean {
  return /[їЇєЄґҐ]/.test(text);
}

export function articleHash(link: string): string {
  return shortHash(link);
}

export function translateKeyboard(feedHash: string, artHash: string) {
  return Markup.inlineKeyboard([[
    Markup.button.callback('🌐 Перекласти', `tr:${feedHash}:${artHash}`),
  ]]);
}


export async function handleNews(ctx: Context): Promise<void> {
  const feeds = await getFeeds();
  if (feeds.length === 0) {
    await ctx.reply('Ви не підписані на жодну стрічку.\nДодайте за допомогою /add <url>');
    return;
  }

  await ctx.reply('⏳ Завантажую новини…');

  const since = new Date(Date.now() - NEWS_WINDOW_MS);
  const autoTranslate = isAutoTranslate();
  let sent = 0;

  for (const feed of feeds) {
    let articles: Article[];
    try {
      const result = await fetchFeed(feed.url, since);
      articles = result.articles;
    } catch {
      continue;
    }

    for (const article of articles) {
      const hash = articleHash(article.link);
      if (await isArticleSent(hash)) continue;

      let translated: { title: string; summary: string } | undefined;
      if (autoTranslate && article.summary) {
        try { translated = await translateArticle(article.title, article.summary); } catch { /* skip */ }
      }

      const text = formatArticle(article, translated);
      const feedHash = shortHash(feed.url);
      const showButton = isClaudeTranslationAvailable() && !translated &&
        !isLikelyUkrainian(article.title + ' ' + article.summary);
      const keyboard = showButton ? translateKeyboard(feedHash, hash) : {};

      try {
        if (article.imageUrl) {
          await ctx.replyWithPhoto(article.imageUrl, { caption: text, parse_mode: 'HTML', ...keyboard });
        } else {
          await ctx.replyWithHTML(text, { link_preview_options: { is_disabled: true }, ...keyboard });
        }
      } catch {
        await ctx.replyWithHTML(text, { link_preview_options: { is_disabled: true }, ...keyboard }).catch(() => {});
      }
      await markArticleSent(hash);
      sent++;
    }
  }

  if (sent === 0) {
    await ctx.reply('Нових статей немає. Всі вже були надіслані раніше.');
  }
}

// Used by the cron job
export async function deliverNewArticles(bot: Telegraf, chatId: number): Promise<void> {
  const feeds = await getFeeds();
  const since = new Date(Date.now() - NEWS_WINDOW_MS);
  const autoTranslate = isAutoTranslate();

  for (const feed of feeds) {
    let articles: Article[];
    try {
      const result = await fetchFeed(feed.url, since);
      articles = result.articles;
    } catch {
      continue;
    }

    for (const article of articles) {
      const hash = articleHash(article.link);
      if (await isArticleSent(hash)) continue;

      let translated: { title: string; summary: string } | undefined;
      if (autoTranslate && article.summary) {
        try { translated = await translateArticle(article.title, article.summary); } catch { /* skip */ }
      }

      const text = formatArticle(article, translated);
      const feedHash = shortHash(feed.url);
      const artHash = articleHash(article.link);
      const showButton = isClaudeTranslationAvailable() && !translated &&
        !isLikelyUkrainian(article.title + ' ' + article.summary);
      const replyMarkup = showButton ? translateKeyboard(feedHash, artHash).reply_markup : undefined;

      try {
        if (article.imageUrl) {
          await bot.telegram.sendPhoto(chatId, article.imageUrl, {
            caption: text, parse_mode: 'HTML', reply_markup: replyMarkup,
          });
        } else {
          await bot.telegram.sendMessage(chatId, text, {
            parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: replyMarkup,
          });
        }
        await markArticleSent(hash);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('bot was blocked') || msg.includes('chat not found')) return;
        try {
          await bot.telegram.sendMessage(chatId, text, {
            parse_mode: 'HTML', link_preview_options: { is_disabled: true }, reply_markup: replyMarkup,
          });
          await markArticleSent(hash);
        } catch { /* skip */ }
      }
    }
  }
}
