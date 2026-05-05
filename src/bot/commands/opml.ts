import { type Context } from 'telegraf';
import { XMLParser } from 'fast-xml-parser';
import { getFeeds, addFeed, markArticleSent } from '../../storage/feeds';
import { fetchFeed } from '../../rss/fetcher';
import { shortHash } from '../../config';

const MAX_FEEDS = 20;

interface Outline {
  '@_xmlUrl'?: string;
  '@_type'?: string;
  outline?: Outline | Outline[];
}

function extractUrls(outlines: Outline[]): string[] {
  const urls: string[] = [];
  for (const o of outlines) {
    if (o['@_xmlUrl']) urls.push(o['@_xmlUrl']);
    if (o.outline) {
      const nested = Array.isArray(o.outline) ? o.outline : [o.outline];
      urls.push(...extractUrls(nested));
    }
  }
  return urls;
}

export async function handleOpmlFile(ctx: Context): Promise<void> {
  const doc = (ctx.message as { document?: { file_id: string; file_name?: string; mime_type?: string } } | undefined)?.document;
  if (!doc) return;

  const name = doc.file_name ?? '';
  const mime = doc.mime_type ?? '';
  const isOpml = name.endsWith('.opml') || name.endsWith('.xml') ||
    mime.includes('xml') || mime.includes('opml');

  if (!isOpml) {
    await ctx.reply('Невідома команда. Для імпорту стрічок надішліть файл .opml');
    return;
  }

  await ctx.reply('⏳ Читаю OPML файл…');

  // Download file
  const file = await ctx.telegram.getFile(doc.file_id);
  if (!file.file_path) {
    await ctx.reply('Не вдалося завантажити файл.');
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN!;
  const { default: fetch } = await import('node-fetch');
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`);
  const xml = await res.text();

  // Parse OPML
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  let parsed: { opml?: { body?: { outline?: Outline | Outline[] } } };
  try {
    parsed = parser.parse(xml) as typeof parsed;
  } catch {
    await ctx.reply('Не вдалося розпарсити файл. Переконайтесь що це валідний OPML.');
    return;
  }

  const bodyOutline = parsed?.opml?.body?.outline;
  if (!bodyOutline) {
    await ctx.reply('В OPML файлі не знайдено жодної RSS стрічки.');
    return;
  }

  const rawOutlines = Array.isArray(bodyOutline) ? bodyOutline : [bodyOutline];
  const allUrls = [...new Set(extractUrls(rawOutlines))];

  if (allUrls.length === 0) {
    await ctx.reply('В OPML файлі не знайдено жодної RSS стрічки.');
    return;
  }

  const existing = await getFeeds();
  const existingUrls = new Set(existing.map(f => f.url));
  const alreadyAdded = allUrls.filter(u => existingUrls.has(u)).length;
  const toAdd = allUrls.filter(u => !existingUrls.has(u));

  const slots = MAX_FEEDS - existing.length;
  if (slots <= 0) {
    await ctx.reply(`Досягнуто ліміт ${MAX_FEEDS} стрічок. Спочатку видаліть зайві: /list`);
    return;
  }

  const batch = toAdd.slice(0, slots);
  const skipped = toAdd.length - batch.length;

  await ctx.reply(`⏳ Додаю ${batch.length} стрічок…`);

  let added = 0;
  let failed = 0;

  for (const url of batch) {
    try {
      const result = await fetchFeed(url, null);
      await addFeed(url, result.feedName);
      await Promise.all(result.articles.map(a => markArticleSent(shortHash(a.link))));
      added++;
    } catch {
      failed++;
    }
  }

  const lines: string[] = [];
  if (added > 0)      lines.push(`✅ Додано: ${added}`);
  if (alreadyAdded > 0) lines.push(`⏭ Вже були: ${alreadyAdded}`);
  if (failed > 0)     lines.push(`❌ Недоступні: ${failed}`);
  if (skipped > 0)    lines.push(`⚠️ Пропущено через ліміт ${MAX_FEEDS}: ${skipped}`);

  await ctx.reply(lines.join('\n'));
}
