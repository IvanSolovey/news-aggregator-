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

  // Callbacks: answer immediately to stop the spinner, then do work
  bot.action('news', async ctx => {
    await ctx.answerCbQuery().catch(() => {});
    await handleNews(ctx).catch(console.error);
  });

  bot.action('list', async ctx => {
    await ctx.answerCbQuery().catch(() => {});
    await handleList(ctx).catch(console.error);
  });

  bot.action('translate', async ctx => {
    await ctx.answerCbQuery().catch(() => {});
    await handleTranslateCallback(ctx).catch(async err => {
      console.error('translate callback error:', err);
    });
  });

  bot.action(/^rm:(.+)$/, async ctx => {
    await ctx.answerCbQuery().catch(() => {});
    const hash = ctx.match[1];
    await handleRemoveCallback(ctx, hash).catch(console.error);
  });

  bot.action('noop', async ctx => {
    await ctx.answerCbQuery().catch(() => {});
  });

  bot.on('message', ctx =>
    ctx.reply('Невідома команда. Напишіть /help щоб побачити список команд.')
  );

  return bot;
}
