import { Redis } from '@upstash/redis';
import { createHash } from 'crypto';
import type { UserSettings, FeedInfo } from '../types';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const SENT_TTL = 60 * 60 * 24 * 7; // 7 days in seconds
const FETCH_TTL = 60 * 60 * 25;    // 25 hours in seconds

function urlHash(url: string): string {
  return createHash('md5').update(url).digest('hex').slice(0, 12);
}

// --- Users ---

export async function registerUser(chatId: number): Promise<void> {
  await redis.sadd('all_users', String(chatId));
}

export async function getAllUserIds(): Promise<number[]> {
  const ids = await redis.smembers('all_users');
  return ids.map(Number);
}

// --- Feeds ---

export async function addFeed(chatId: number, url: string, name: string): Promise<void> {
  await Promise.all([
    redis.sadd(`user:${chatId}:feeds`, url),
    redis.set(`feed:${urlHash(url)}:name`, name),
  ]);
}

export async function removeFeed(chatId: number, url: string): Promise<void> {
  await redis.srem(`user:${chatId}:feeds`, url);
}

export async function getUserFeeds(chatId: number): Promise<FeedInfo[]> {
  const urls = await redis.smembers(`user:${chatId}:feeds`);
  if (urls.length === 0) return [];

  const nameKeys = urls.map(u => `feed:${urlHash(u)}:name`);
  const names = await Promise.all(nameKeys.map(k => redis.get<string>(k)));

  return urls.map((url, i) => ({ url, name: names[i] ?? url }));
}

// --- Settings ---

const DEFAULT_SETTINGS: UserSettings = { translate: false };

export async function getUserSettings(chatId: number): Promise<UserSettings> {
  const raw = await redis.hgetall<Record<string, string>>(`user:${chatId}:settings`);
  if (!raw) return DEFAULT_SETTINGS;
  return { translate: raw.translate === '1' };
}

export async function setUserSettings(chatId: number, settings: Partial<UserSettings>): Promise<void> {
  const patch: Record<string, string> = {};
  if (settings.translate !== undefined) patch.translate = settings.translate ? '1' : '0';
  if (Object.keys(patch).length > 0) {
    await redis.hset(`user:${chatId}:settings`, patch);
  }
}

// --- Deduplication ---

export async function isArticleSent(chatId: number, articleUrl: string): Promise<boolean> {
  const key = `sent:${chatId}:${urlHash(articleUrl)}`;
  const val = await redis.get(key);
  return val !== null;
}

export async function markArticleSent(chatId: number, articleUrl: string): Promise<void> {
  const key = `sent:${chatId}:${urlHash(articleUrl)}`;
  await redis.set(key, '1', { ex: SENT_TTL });
}

export function feedUrlHash(url: string): string {
  return urlHash(url);
}

export async function getFeedUrlByHash(chatId: number, hash: string): Promise<string | null> {
  const urls = await redis.smembers(`user:${chatId}:feeds`);
  return urls.find(u => urlHash(u) === hash) ?? null;
}

// --- Article translation cache ---

const ARTICLE_TTL = 60 * 60 * 24; // 24 hours

export interface ArticleTranslationData {
  title: string;
  summary: string;
  link: string;
  feedName: string;
  imageUrl?: string;
}

export async function storeArticleForTranslation(
  hash: string,
  data: ArticleTranslationData
): Promise<void> {
  await redis.set(`article:${hash}`, JSON.stringify(data), { ex: ARTICLE_TTL });
}

export async function getArticleForTranslation(
  hash: string
): Promise<ArticleTranslationData | null> {
  const raw = await redis.get<string | ArticleTranslationData>(`article:${hash}`);
  if (!raw) return null;
  if (typeof raw === 'object') return raw as ArticleTranslationData;
  try {
    return JSON.parse(raw) as ArticleTranslationData;
  } catch {
    return null;
  }
}

// --- Feed fetch timestamps ---

export async function getLastFetchTime(feedUrl: string): Promise<Date | null> {
  const key = `feed:${urlHash(feedUrl)}:lastFetch`;
  const val = await redis.get<string>(key);
  return val ? new Date(val) : null;
}

export async function setLastFetchTime(feedUrl: string, date: Date): Promise<void> {
  const key = `feed:${urlHash(feedUrl)}:lastFetch`;
  await redis.set(key, date.toISOString(), { ex: FETCH_TTL });
}
