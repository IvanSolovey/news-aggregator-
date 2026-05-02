import { Markup, type Context } from 'telegraf';
import {
  registerUser,
  addFeed,
  getUserFeeds,
  removeFeed,
  feedUrlHash,
  getFeedUrlByHash,
} from '../../storage/redis';
import { fetchFeed } from '../../rss/fetcher';
import { mainKeyboard } from './start';

function feedListKeyboard(feeds: { url: string; name: string }[]) {
  const rows = feeds.map((f, i) =>
    [
      Markup.button.callback(`${i + 1}. ${f.name}`, `noop`),
      Markup.button.callback('❌', `rm:${feedUrlHash(f.url)}`),
    ]
  );
  rows.push([Markup.button.callback('📰 Отримати новини', 'news')]);
  return Markup.inlineKeyboard(rows);
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function handleAdd(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  await registerUser(chatId);

  const text = (ctx.message as { text?: string } | undefined)?.text ?? '';
  const parts = text.trim().split(/\s+/);
  const url = parts[1];

  if (!url || !isValidUrl(url)) {
    await ctx.reply(
      'Вкажіть коректний URL.\nПриклад: /add https://feeds.bbci.co.uk/news/rss.xml'
    );
    return;
  }

  const existing = await getUserFeeds(chatId);
  if (existing.some(f => f.url === url)) {
    await ctx.reply('Ця стрічка вже додана.', feedListKeyboard(existing));
    return;
  }

  if (existing.length >= 20) {
    await ctx.reply(
      'Максимальна кількість стрічок — 20. Спочатку видаліть зайві.',
      feedListKeyboard(existing)
    );
    return;
  }

  await ctx.reply('⏳ Перевіряю стрічку…');

  let feedName: string;
  try {
    const result = await fetchFeed(url, null);
    feedName = result.feedName;
  } catch {
    await ctx.reply('Не вдалося отримати стрічку. Перевірте URL і спробуйте ще раз.');
    return;
  }

  await addFeed(chatId, url, feedName);

  const updated = await getUserFeeds(chatId);
  await ctx.replyWithHTML(
    `✅ Додано: <b>${feedName}</b>`,
    feedListKeyboard(updated)
  );
}

export async function handleList(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const feeds = await getUserFeeds(chatId);

  if (feeds.length === 0) {
    await ctx.reply(
      'Ви не підписані на жодну стрічку.\nДодайте за допомогою /add <url>',
      mainKeyboard()
    );
    return;
  }

  await ctx.replyWithHTML(
    `📋 <b>Ваші RSS-стрічки (${feeds.length}):</b>\n\nНатисніть ❌ щоб видалити стрічку.`,
    feedListKeyboard(feeds)
  );
}

export async function handleRemove(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const text = (ctx.message as { text?: string } | undefined)?.text ?? '';
  const parts = text.trim().split(/\s+/);
  const num = parseInt(parts[1] ?? '', 10);

  const feeds = await getUserFeeds(chatId);

  if (isNaN(num) || num < 1 || num > feeds.length) {
    await ctx.reply(
      feeds.length === 0
        ? 'У вас немає підписок.'
        : `Вкажіть номер від 1 до ${feeds.length}.`,
      feeds.length > 0 ? feedListKeyboard(feeds) : mainKeyboard()
    );
    return;
  }

  const feed = feeds[num - 1];
  await removeFeed(chatId, feed.url);

  const updated = await getUserFeeds(chatId);
  if (updated.length === 0) {
    await ctx.replyWithHTML(`🗑 Видалено: <b>${feed.name}</b>`, mainKeyboard());
  } else {
    await ctx.replyWithHTML(`🗑 Видалено: <b>${feed.name}</b>`, feedListKeyboard(updated));
  }
}

// Callback: rm:<hash>
export async function handleRemoveCallback(ctx: Context, hash: string): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const url = await getFeedUrlByHash(chatId, hash);
  if (!url) {
    await ctx.answerCbQuery('Стрічку не знайдено.');
    return;
  }

  const feeds = await getUserFeeds(chatId);
  const feed = feeds.find(f => f.url === url);
  await removeFeed(chatId, url);

  const updated = await getUserFeeds(chatId);
  await ctx.answerCbQuery(`Видалено: ${feed?.name ?? url}`);

  if (updated.length === 0) {
    await ctx.editMessageText(
      'Список стрічок порожній.\nДодайте нову командою /add <url>',
      { ...mainKeyboard(), parse_mode: 'HTML' }
    );
  } else {
    await ctx.editMessageText(
      `📋 <b>Ваші RSS-стрічки (${updated.length}):</b>\n\nНатисніть ❌ щоб видалити стрічку.`,
      { ...feedListKeyboard(updated), parse_mode: 'HTML' }
    );
  }
}
