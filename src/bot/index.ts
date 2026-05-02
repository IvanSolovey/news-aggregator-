import { Telegraf } from 'telegraf';
import { handleStart } from './commands/start';
import { handleAdd, handleList, handleRemove, handleRemoveCallback } from './commands/feeds';
import { handleTranslate, handleTranslateCallback } from './commands/settings';
import { handleNews } from './commands/news';

export function createBot(): Telegraf {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');

  const bot = new Telegraf(token);

  // Commands
  bot.command('start', handleStart);
  bot.command('help', handleStart);
  bot.command('add', handleAdd);
  bot.command('list', handleList);
  bot.command('remove', handleRemove);
  bot.command('translate', handleTranslate);
  bot.command('news', handleNews);

  // Inline button callbacks
  bot.action('news', async ctx => {
    await ctx.answerCbQuery();
    await handleNews(ctx);
  });

  bot.action('list', async ctx => {
    await ctx.answerCbQuery();
    await handleList(ctx);
  });

  bot.action('translate', async ctx => {
    await handleTranslateCallback(ctx);
  });

  // rm:<urlHash> — remove feed by hash
  bot.action(/^rm:(.+)$/, async ctx => {
    const hash = ctx.match[1];
    await handleRemoveCallback(ctx, hash);
  });

  // noop — feed name buttons in /list are decorative
  bot.action('noop', ctx => ctx.answerCbQuery());

  bot.on('message', ctx =>
    ctx.reply('Невідома команда. Напишіть /help щоб побачити список команд.')
  );

  return bot;
}
