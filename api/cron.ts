import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createBot } from '../src/bot';
import { getChatId } from '../src/config';
import { deliverNewArticles } from '../src/bot/commands/news';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Allow GET (cron-job.org) and POST (Vercel built-in cron)
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Protect with a shared secret
  const secret =
    (req.query.secret as string | undefined) ??
    req.headers['x-cron-secret'];

  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const bot = createBot();
  const chatId = getChatId();

  try {
    await deliverNewArticles(bot, chatId);
    console.log(`Cron: delivered articles to ${chatId}`);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Cron error:', err);
    res.status(200).json({ ok: false });
  }
}
