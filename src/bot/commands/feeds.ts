import { type Context } from 'telegraf';
import { getConfiguredFeeds } from '../../config';

export async function handleList(ctx: Context): Promise<void> {
  const feeds = getConfiguredFeeds();

  if (feeds.length === 0) {
    await ctx.reply(
      'Не налаштовано жодної стрічки.\n' +
      'Додайте RSS_FEEDS до змінних оточення Vercel.\n' +
      'Приклад: https://feeds.bbci.co.uk/news/rss.xml,https://rss.nytimes.com/services/xml/rss/nyt/World.xml'
    );
    return;
  }

  const lines = feeds.map((url, i) => `${i + 1}. ${url}`).join('\n');
  await ctx.replyWithHTML(`📋 <b>RSS-стрічки (${feeds.length}):</b>\n\n${lines}`);
}
