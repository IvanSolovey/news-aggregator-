import { createHash } from 'crypto';

export function isAutoTranslate(): boolean {
  return process.env.AUTO_TRANSLATE === 'true';
}

export function getChatId(): number {
  const id = parseInt(process.env.TELEGRAM_CHAT_ID ?? '', 10);
  if (isNaN(id)) throw new Error('TELEGRAM_CHAT_ID is not set or invalid');
  return id;
}

export function shortHash(input: string): string {
  return createHash('md5').update(input).digest('hex').slice(0, 12);
}
