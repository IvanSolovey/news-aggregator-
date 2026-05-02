import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createBot } from '../src/bot';
import { getAllUserIds } from '../src/storage/redis';
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
  const userIds = await getAllUserIds();

  let delivered = 0;
  let errors = 0;

  for (const chatId of userIds) {
    try {
      await deliverNewArticles(bot, chatId);
      delivered++;
    } catch (err) {
      console.error(`Failed to deliver articles to ${chatId}:`, err);
      errors++;
    }
  }

  console.log(`Cron: processed ${userIds.length} users, delivered=${delivered}, errors=${errors}`);
  res.status(200).json({ ok: true, users: userIds.length, delivered, errors });
}
