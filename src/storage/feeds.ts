import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface FeedInfo {
  url: string;
  name: string;
}

const KEY = 'feeds';

export async function addFeed(url: string, name: string): Promise<void> {
  await redis.hset(KEY, { [url]: name });
}

export async function removeFeed(url: string): Promise<void> {
  await redis.hdel(KEY, url);
}

export async function getFeeds(): Promise<FeedInfo[]> {
  const data = await redis.hgetall<Record<string, string>>(KEY);
  if (!data) return [];
  return Object.entries(data).map(([url, name]) => ({ url, name }));
}
