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

  const updateType = req.body.message ? 'message'
    : req.body.callback_query ? 'callback_query'
    : Object.keys(req.body).find(k => k !== 'update_id') ?? 'unknown';
  console.log(`[webhook] update_id=${req.body.update_id} type=${updateType}` +
    (req.body.callback_query ? ` data="${req.body.callback_query.data}"` : ''));

  try {
    await bot.handleUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[webhook] handleUpdate error:', err);
    res.status(200).json({ ok: false });
  }
}
