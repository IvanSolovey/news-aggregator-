import { Markup, type Context } from 'telegraf';

export function mainKeyboard() {
  return Markup.keyboard([
    ['/news', '/list'],
    ['/translate'],
  ]).resize();
}

export async function handleStart(ctx: Context): Promise<void> {
  await ctx.replyWithHTML(
    `👋 <b>Вітаю в News Aggregator Bot!</b>\n\n` +
    `Цей бот збирає новини з RSS-стрічок і надсилає їх прямо в чат.\n` +
    `Підтримується переклад на українську мову.\n\n` +
    `<b>Команди:</b>\n` +
    `/list — переглянути налаштовані стрічки\n` +
    `/translate — статус автоперекладу\n` +
    `/news — отримати свіжі новини зараз`,
    mainKeyboard()
  );
}
