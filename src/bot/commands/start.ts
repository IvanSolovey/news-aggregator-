import { Markup, type Context } from 'telegraf';
import { registerUser } from '../../storage/redis';

export function mainKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📰 Новини', 'news'),
      Markup.button.callback('📋 Мої стрічки', 'list'),
    ],
    [
      Markup.button.callback('🌐 Переклад', 'translate'),
    ],
  ]);
}

export async function handleStart(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  await registerUser(chatId);

  await ctx.replyWithHTML(
    `👋 <b>Вітаю в News Aggregator Bot!</b>\n\n` +
    `Цей бот збирає новини з RSS-стрічок і надсилає їх прямо в чат.\n` +
    `Підтримується переклад на українську мову.\n\n` +
    `<b>Команди:</b>\n` +
    `/add &lt;url&gt; — додати RSS-стрічку\n` +
    `/list — переглянути підписки\n` +
    `/remove &lt;номер&gt; — видалити стрічку\n` +
    `/translate — увімкнути/вимкнути переклад\n` +
    `/news — отримати свіжі новини зараз\n\n` +
    `<b>Приклад:</b>\n` +
    `/add https://feeds.bbci.co.uk/news/rss.xml`,
    mainKeyboard()
  );
}
