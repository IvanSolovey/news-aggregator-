import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createBot } from '../src/bot';
import { getStoredChatId } from '../src/storage/feeds';
import { deliverNewArticles } from '../src/bot/commands/news';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret =
    (req.query.secret as string | undefined) ??
    req.headers['x-cron-secret'];

  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const chatId = await getStoredChatId();
  if (!chatId) {
    console.log('Cron: no chat ID registered — send /start to the bot first');
    res.status(200).json({ ok: true, skipped: true });
    return;
  }

  const bot = createBot();

  try {
    await deliverNewArticles(bot, chatId);
    console.log(`Cron: delivered articles to ${chatId}`);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Cron error:', err);
    res.status(200).json({ ok: false });
  }
}
