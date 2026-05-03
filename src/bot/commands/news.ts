import { Markup, type Context } from 'telegraf';
import { createHash } from 'crypto';
import {
  getUserFeeds,
  getUserSettings,
  isArticleSent,
  markArticleSent,
  storeArticleForTranslation,
} from '../../storage/redis';
import { fetchFeed } from '../../rss/fetcher';
import { formatArticle } from '../../rss/formatter';
import { translateArticle, isClaudeTranslationAvailable } from '../../translation';
import type { Article } from '../../types';
import type { Telegraf } from 'telegraf';

const MAX_ARTICLES_PER_COMMAND = 5;

export function articleHash(link: string): string {
  return createHash('md5').update(link).digest('hex').slice(0, 12);
}

export function translateKeyboard(hash: string) {
  return Markup.inlineKeyboard([[
    Markup.button.callback('🌐 Перекласти', `tr:${hash}`),
  ]]);
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

  const toSend: Array<{ article: Article; translated?: { title: string; summary: string } }> = [];

  for (const feed of feeds) {
    if (toSend.length >= MAX_ARTICLES_PER_COMMAND) break;

    let articles: Article[];
    try {
      const result = await fetchFeed(feed.url, null);
      articles = result.articles.slice(0, MAX_ARTICLES_PER_COMMAND - toSend.length);
    } catch {
      continue;
    }

    for (const article of articles) {
      if (toSend.length >= MAX_ARTICLES_PER_COMMAND) break;
      if (await isArticleSent(chatId, article.link)) continue;

      let translated: { title: string; summary: string } | undefined;
      if (settings.translate && article.summary) {
        try {
          translated = await translateArticle(article.title, article.summary);
        } catch { /* send without translation */ }
      }

      toSend.push({ article, translated });
    }
  }

  if (toSend.length === 0) {
    await ctx.reply('Нових статей немає. Перевірте пізніше або натисніть /news знову.');
    return;
  }

  for (const { article, translated } of toSend) {
    const text = formatArticle(article, translated);
    const hash = articleHash(article.link);
    const showButton = isClaudeTranslationAvailable() && !translated;

    await storeArticleForTranslation(hash, {
      title: article.title,
      summary: article.summary,
      link: article.link,
      feedName: article.feedName,
      imageUrl: article.imageUrl,
    });

    try {
      if (article.imageUrl) {
        await ctx.replyWithPhoto(article.imageUrl, {
          caption: text,
          parse_mode: 'HTML',
          ...(showButton ? translateKeyboard(hash) : {}),
        });
      } else {
        await ctx.replyWithHTML(text, {
          link_preview_options: { is_disabled: true },
          ...(showButton ? translateKeyboard(hash) : {}),
        });
      }
      await markArticleSent(chatId, article.link);
    } catch {
      // photo inaccessible — retry as text
      try {
        await ctx.replyWithHTML(text, {
          link_preview_options: { is_disabled: true },
          ...(showButton ? translateKeyboard(hash) : {}),
        });
        await markArticleSent(chatId, article.link);
      } catch { /* skip */ }
    }
  }
}

// Used by the cron job
export async function deliverNewArticles(bot: Telegraf, chatId: number): Promise<void> {
  const [feeds, settings] = await Promise.all([
    getUserFeeds(chatId),
    getUserSettings(chatId),
  ]);

  for (const feed of feeds) {
    let articles: Article[];
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
      const hash = articleHash(article.link);
      const showButton = isClaudeTranslationAvailable() && !translated;

      await storeArticleForTranslation(hash, {
        title: article.title,
        summary: article.summary,
        link: article.link,
        feedName: article.feedName,
        imageUrl: article.imageUrl,
      });

      const replyMarkup = showButton ? translateKeyboard(hash).reply_markup : undefined;

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
        await markArticleSent(chatId, article.link);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('bot was blocked') || msg.includes('chat not found')) break;
        try {
          await bot.telegram.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            link_preview_options: { is_disabled: true },
            reply_markup: replyMarkup,
          });
          await markArticleSent(chatId, article.link);
        } catch { /* skip */ }
      }
    }
  }
}
