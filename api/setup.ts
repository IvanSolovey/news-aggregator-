import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createBot } from '../src/bot';

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const secret = (req.query.secret as string | undefined) ?? req.headers['x-setup-secret'];
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const webhookUrl = process.env.WEBHOOK_URL;
  if (!webhookUrl) {
    res.status(400).json({ error: 'WEBHOOK_URL env var is not set' });
    return;
  }

  const bot = createBot();
  await bot.telegram.setWebhook(webhookUrl, {
    allowed_updates: ['message', 'callback_query'],
    ...(process.env.TELEGRAM_WEBHOOK_SECRET
      ? { secret_token: process.env.TELEGRAM_WEBHOOK_SECRET }
      : {}),
  });

  const info = await bot.telegram.getWebhookInfo();
  res.status(200).json({ ok: true, webhook: info });
}
