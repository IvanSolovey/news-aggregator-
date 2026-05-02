import type { Context } from 'telegraf';
import { registerUser, addFeed, getUserFeeds, removeFeed } from '../../storage/redis';
import { fetchFeed } from '../../rss/fetcher';

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
    await ctx.reply('Вкажіть коректний URL.\nПриклад: /add https://feeds.bbci.co.uk/news/rss.xml');
    return;
  }

  const existing = await getUserFeeds(chatId);
  if (existing.some(f => f.url === url)) {
    await ctx.reply('Ця стрічка вже додана.');
    return;
  }

  if (existing.length >= 20) {
    await ctx.reply('Максимальна кількість стрічок — 20. Спочатку видаліть зайві командою /remove.');
    return;
  }

  await ctx.reply('Перевіряю стрічку…');

  let feedName: string;
  try {
    const result = await fetchFeed(url, null);
    feedName = result.feedName;
  } catch {
    await ctx.reply('Не вдалося отримати стрічку. Перевірте URL і спробуйте ще раз.');
    return;
  }

  await addFeed(chatId, url, feedName);
  await ctx.replyWithHTML(`✅ Додано: <b>${feedName}</b>`);
}

export async function handleList(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const feeds = await getUserFeeds(chatId);

  if (feeds.length === 0) {
    await ctx.reply('Ви не підписані на жодну стрічку.\nДодайте за допомогою /add <url>');
    return;
  }

  const lines = feeds.map((f, i) => `${i + 1}. <a href="${f.url}">${f.name}</a>`);
  await ctx.replyWithHTML(
    `📋 <b>Ваші RSS-стрічки (${feeds.length}):</b>\n\n` +
    lines.join('\n') +
    '\n\nВидалити: /remove &lt;номер&gt;',
    { link_preview_options: { is_disabled: true } }
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
        : `Вкажіть номер від 1 до ${feeds.length}.\nПоточні стрічки: /list`
    );
    return;
  }

  const feed = feeds[num - 1];
  await removeFeed(chatId, feed.url);
  await ctx.replyWithHTML(`🗑 Видалено: <b>${feed.name}</b>`);
}
