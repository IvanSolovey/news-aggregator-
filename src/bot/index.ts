import { Telegraf } from 'telegraf';
import { handleStart } from './commands/start';
import { handleAdd, handleList, handleRemove } from './commands/feeds';
import { handleTranslate } from './commands/settings';
import { handleNews } from './commands/news';

export function createBot(): Telegraf {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set');

  const bot = new Telegraf(token);

  bot.command('start', handleStart);
  bot.command('help', handleStart);
  bot.command('add', handleAdd);
  bot.command('list', handleList);
  bot.command('remove', handleRemove);
  bot.command('translate', handleTranslate);
  bot.command('news', handleNews);

  bot.on('message', ctx =>
    ctx.reply('Невідома команда. Напишіть /help щоб побачити список команд.')
  );

  return bot;
}
