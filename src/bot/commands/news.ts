import { Markup, type Context } from 'telegraf';
import { getConfiguredFeeds, isAutoTranslate, shortHash } from '../../config';
import { fetchFeed } from '../../rss/fetcher';
import { formatArticle } from '../../rss/formatter';
import { translateArticle, isClaudeTranslationAvailable } from '../../translation';
import type { Article } from '../../types';
import type { Telegraf } from 'telegraf';

const MAX_ARTICLES_PER_COMMAND = 5;
const NEWS_WINDOW_MS = 24 * 60 * 60 * 1000;

// ї is exclusively Ukrainian — reliable enough for our purposes
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
  const feeds = getConfiguredFeeds();
  if (feeds.length === 0) {
    await ctx.reply('Не налаштовано жодної стрічки. Додайте RSS_FEEDS до змінних оточення.');
    return;
  }

  await ctx.reply('⏳ Завантажую новини…');

  const since = new Date(Date.now() - NEWS_WINDOW_MS);
  const autoTranslate = isAutoTranslate();
  const seenLinks = new Set<string>();

  const toSend: Array<{ article: Article; translated?: { title: string; summary: string }; feedUrl: string }> = [];

  for (const feedUrl of feeds) {
    if (toSend.length >= MAX_ARTICLES_PER_COMMAND) break;
    let articles: Article[];
    try {
      const result = await fetchFeed(feedUrl, since);
      articles = result.articles.slice(0, MAX_ARTICLES_PER_COMMAND - toSend.length);
    } catch {
      continue;
    }

    for (const article of articles) {
      if (toSend.length >= MAX_ARTICLES_PER_COMMAND) break;
      if (seenLinks.has(article.link)) continue;
      seenLinks.add(article.link);

      let translated: { title: string; summary: string } | undefined;
      if (autoTranslate && article.summary) {
        try {
          translated = await translateArticle(article.title, article.summary);
        } catch { /* send without translation */ }
      }

      toSend.push({ article, translated, feedUrl });
    }
  }

  if (toSend.length === 0) {
    await ctx.reply('Нових статей за останні 24 години немає.');
    return;
  }

  for (const { article, translated, feedUrl } of toSend) {
    const text = formatArticle(article, translated);
    const feedHash = shortHash(feedUrl);
    const artHash = articleHash(article.link);
    const showButton = isClaudeTranslationAvailable() && !translated &&
      !isLikelyUkrainian(article.title + ' ' + article.summary);

    try {
      if (article.imageUrl) {
        await ctx.replyWithPhoto(article.imageUrl, {
          caption: text,
          parse_mode: 'HTML',
          ...(showButton ? translateKeyboard(feedHash, artHash) : {}),
        });
      } else {
        await ctx.replyWithHTML(text, {
          link_preview_options: { is_disabled: true },
          ...(showButton ? translateKeyboard(feedHash, artHash) : {}),
        });
      }
    } catch {
      // photo inaccessible — retry as text
      try {
        await ctx.replyWithHTML(text, {
          link_preview_options: { is_disabled: true },
          ...(showButton ? translateKeyboard(feedHash, artHash) : {}),
        });
      } catch { /* skip */ }
    }
  }
}

// Used by the cron job
export async function deliverNewArticles(bot: Telegraf, chatId: number): Promise<void> {
  const feeds = getConfiguredFeeds();
  const since = new Date(Date.now() - NEWS_WINDOW_MS);
  const autoTranslate = isAutoTranslate();
  const seenLinks = new Set<string>();

  for (const feedUrl of feeds) {
    let articles: Article[];
    try {
      const result = await fetchFeed(feedUrl, since);
      articles = result.articles;
    } catch {
      continue;
    }

    for (const article of articles) {
      if (seenLinks.has(article.link)) continue;
      seenLinks.add(article.link);

      let translated: { title: string; summary: string } | undefined;
      if (autoTranslate && article.summary) {
        try {
          translated = await translateArticle(article.title, article.summary);
        } catch { /* send without translation */ }
      }

      const text = formatArticle(article, translated);
      const feedHash = shortHash(feedUrl);
      const artHash = articleHash(article.link);
      const showButton = isClaudeTranslationAvailable() && !translated &&
        !isLikelyUkrainian(article.title + ' ' + article.summary);

      const replyMarkup = showButton
        ? translateKeyboard(feedHash, artHash).reply_markup
        : undefined;

      try {
        if (article.imageUrl) {
          await bot.telegram.sendPhoto(chatId, article.imageUrl, {
            caption: text,
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
          });
        } else {
          await bot.telegram.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
            reply_markup: replyMarkup,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('bot was blocked') || msg.includes('chat not found')) return;
        try {
          await bot.telegram.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
            reply_markup: replyMarkup,
          });
        } catch { /* skip */ }
      }
    }
  }
}
