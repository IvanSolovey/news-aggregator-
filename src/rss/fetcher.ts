import Parser from 'rss-parser';
import type { Article } from '../types';

type FeedItem = {
  title?: string;
  link?: string;
  contentSnippet?: string;
  content?: string;
  summary?: string;
  isoDate?: string;
  pubDate?: string;
  enclosure?: { url?: string };
  'media:content'?: { $?: { url?: string } };
  'media:thumbnail'?: { $?: { url?: string } };
};

const parser = new Parser<Record<string, unknown>, FeedItem>({
  customFields: {
    item: [
      ['media:content', 'media:content'],
      ['media:thumbnail', 'media:thumbnail'],
      'enclosure',
    ],
  },
  timeout: 10000,
});

function extractImage(item: FeedItem): string | undefined {
  return (
    item.enclosure?.url ||
    item['media:content']?.$?.url ||
    item['media:thumbnail']?.$?.url
  );
}

function extractSummary(item: FeedItem): string {
  const raw = item.contentSnippet ?? item.summary ?? item.content ?? '';
  // Strip leftover HTML tags and collapse whitespace
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function fetchFeed(
  feedUrl: string,
  since: Date | null
): Promise<{ feedName: string; articles: Article[] }> {
  const feed = await parser.parseURL(feedUrl);
  const feedName = feed.title ?? feedUrl;

  const articles: Article[] = [];

  for (const item of feed.items) {
    if (!item.link) continue;

    const pubDate = item.isoDate
      ? new Date(item.isoDate)
      : item.pubDate
      ? new Date(item.pubDate)
      : null;

    // Skip articles older than the last fetch (with 2-min buffer)
    if (since && pubDate && pubDate.getTime() < since.getTime() - 2 * 60 * 1000) {
      continue;
    }

    articles.push({
      title: item.title?.trim() ?? 'Без заголовку',
      link: item.link,
      summary: extractSummary(item),
      imageUrl: extractImage(item),
      pubDate: pubDate ?? undefined,
      feedName,
      feedUrl,
    });
  }

  return { feedName, articles };
}
