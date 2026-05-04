import { Markup, type Context } from 'telegraf';
import { saveChatId } from '../../storage/feeds';

export function mainKeyboard() {
  return Markup.keyboard([
    ['/news', '/list'],
    ['/add', '/translate'],
  ]).resize();
}

export async function handleStart(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (chatId) await saveChatId(chatId);

  await ctx.replyWithHTML(
    `👋 <b>Вітаю в News Aggregator Bot!</b>\n\n` +
    `Цей бот збирає новини з RSS-стрічок і надсилає їх прямо в чат.\n` +
    `Підтримується переклад на українську мову.\n\n` +
    `<b>Команди:</b>\n` +
    `/add &lt;url&gt; — додати RSS-стрічку\n` +
    `/list — переглянути підписки\n` +
    `/remove &lt;номер&gt; — видалити стрічку\n` +
    `/translate — статус автоперекладу\n` +
    `/news — отримати свіжі новини зараз\n\n` +
    `<b>Приклад:</b>\n` +
    `/add https://feeds.bbci.co.uk/news/rss.xml`,
    mainKeyboard()
  );
}
