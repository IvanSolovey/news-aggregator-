import { createHash } from 'crypto';

export function isAutoTranslate(): boolean {
  return process.env.AUTO_TRANSLATE === 'true';
}

export function shortHash(input: string): string {
  return createHash('md5').update(input).digest('hex').slice(0, 12);
}
