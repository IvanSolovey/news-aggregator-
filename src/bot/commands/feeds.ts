import { type Context } from 'telegraf';
import { addFeed, removeFeed, getFeeds } from '../../storage/feeds';
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
  const text = (ctx.message as { text?: string } | undefined)?.text ?? '';
  const url = text.trim().split(/\s+/)[1];

  if (!url || !isValidUrl(url)) {
    await ctx.reply('Вкажіть коректний URL.\nПриклад: /add https://feeds.bbci.co.uk/news/rss.xml');
    return;
  }

  const existing = await getFeeds();

  if (existing.some(f => f.url === url)) {
    await ctx.reply('Ця стрічка вже додана. Перегляньте список: /list');
    return;
  }

  if (existing.length >= 20) {
    await ctx.reply('Максимальна кількість стрічок — 20. Спочатку видаліть зайві: /list');
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

  await addFeed(url, feedName);
  await ctx.replyWithHTML(`✅ Додано: <b>${feedName}</b>`);
}

export async function handleList(ctx: Context): Promise<void> {
  const feeds = await getFeeds();

  if (feeds.length === 0) {
    await ctx.reply('Ви не підписані на жодну стрічку.\nДодайте за допомогою /add <url>');
    return;
  }

  const lines = feeds.map((f, i) => `${i + 1}. ${f.name}`).join('\n');
  await ctx.replyWithHTML(
    `📋 <b>Ваші RSS-стрічки (${feeds.length}):</b>\n\n${lines}\n\nДля видалення: /remove &lt;номер&gt;`
  );
}

export async function handleRemove(ctx: Context): Promise<void> {
  const text = (ctx.message as { text?: string } | undefined)?.text ?? '';
  const num = parseInt(text.trim().split(/\s+/)[1] ?? '', 10);

  const feeds = await getFeeds();

  if (isNaN(num) || num < 1 || num > feeds.length) {
    await ctx.reply(
      feeds.length === 0
        ? 'У вас немає підписок.'
        : `Вкажіть номер від 1 до ${feeds.length}.\nПерегляньте список: /list`
    );
    return;
  }

  const feed = feeds[num - 1];
  await removeFeed(feed.url);
  await ctx.replyWithHTML(`🗑 Видалено: <b>${feed.name}</b>`);
}
