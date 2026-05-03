import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createBot } from '../src/bot';

const bot = createBot();

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Validate Telegram webhook secret token
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (
    process.env.TELEGRAM_WEBHOOK_SECRET &&
    secret !== process.env.TELEGRAM_WEBHOOK_SECRET
  ) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // Respond to Telegram immediately so it doesn't retry or show a timeout
  res.status(200).json({ ok: true });

  // Process the update after responding — Vercel keeps the function alive
  // until this promise resolves (up to the plan's execution limit)
  bot.handleUpdate(req.body).catch(err => console.error('Webhook error:', err));
}
