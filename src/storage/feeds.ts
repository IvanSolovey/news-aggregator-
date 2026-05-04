import { kv } from '@vercel/kv';

export interface FeedInfo {
  url: string;
  name: string;
}

const KEY = 'feeds';

export async function addFeed(url: string, name: string): Promise<void> {
  await kv.hset(KEY, { [url]: name });
}

export async function removeFeed(url: string): Promise<void> {
  await kv.hdel(KEY, url);
}

export async function getFeeds(): Promise<FeedInfo[]> {
  const data = await kv.hgetall<Record<string, string>>(KEY);
  if (!data) return [];
  return Object.entries(data).map(([url, name]) => ({ url, name }));
}
