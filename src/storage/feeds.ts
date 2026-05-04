import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export interface FeedInfo {
  url: string;
  name: string;
}

const FEEDS_KEY = 'feeds';
const CHAT_ID_KEY = 'chat_id';

export async function addFeed(url: string, name: string): Promise<void> {
  await redis.hset(FEEDS_KEY, { [url]: name });
}

export async function removeFeed(url: string): Promise<void> {
  await redis.hdel(FEEDS_KEY, url);
}

export async function getFeeds(): Promise<FeedInfo[]> {
  const data = await redis.hgetall<Record<string, string>>(FEEDS_KEY);
  if (!data) return [];
  return Object.entries(data).map(([url, name]) => ({ url, name }));
}

export async function saveChatId(chatId: number): Promise<void> {
  await redis.set(CHAT_ID_KEY, chatId);
}

export async function getStoredChatId(): Promise<number | null> {
  return redis.get<number>(CHAT_ID_KEY);
}

const SENT_TTL = 60 * 60 * 24 * 7; // 7 days

export async function isArticleSent(articleHash: string): Promise<boolean> {
  return (await redis.get(`sent:${articleHash}`)) !== null;
}

export async function markArticleSent(articleHash: string): Promise<void> {
  await redis.set(`sent:${articleHash}`, 1, { ex: SENT_TTL });
}
