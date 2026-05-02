import * as deepl from 'deepl-node';

const TARGET_LANG = 'uk' as deepl.TargetLanguageCode;

let deeplClient: deepl.Translator | null = null;

function getDeepLClient(): deepl.Translator | null {
  if (!process.env.DEEPL_API_KEY) return null;
  if (!deeplClient) {
    deeplClient = new deepl.Translator(process.env.DEEPL_API_KEY);
  }
  return deeplClient;
}

async function translateViaDeepL(text: string): Promise<string> {
  const client = getDeepLClient()!;
  const result = await client.translateText(text, null, TARGET_LANG);
  return Array.isArray(result) ? result[0].text : result.text;
}

async function translateViaLibreTranslate(text: string): Promise<string> {
  const baseUrl = process.env.LIBRETRANSLATE_URL!.replace(/\/$/, '');
  const body: Record<string, string> = {
    q: text,
    source: 'auto',
    target: 'uk',
    format: 'text',
  };
  if (process.env.LIBRETRANSLATE_API_KEY) {
    body.api_key = process.env.LIBRETRANSLATE_API_KEY;
  }

  const { default: fetch } = await import('node-fetch');
  const res = await fetch(`${baseUrl}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`LibreTranslate error: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { translatedText: string };
  return data.translatedText;
}

export function isTranslationAvailable(): boolean {
  return Boolean(process.env.DEEPL_API_KEY || process.env.LIBRETRANSLATE_URL);
}

export async function translate(text: string): Promise<string> {
  if (!text.trim()) return text;

  if (process.env.DEEPL_API_KEY) {
    return translateViaDeepL(text);
  }

  if (process.env.LIBRETRANSLATE_URL) {
    return translateViaLibreTranslate(text);
  }

  throw new Error('No translation provider configured');
}

export async function translateArticle(
  title: string,
  summary: string
): Promise<{ title: string; summary: string }> {
  // Batch into one request to save API quota where possible
  const separator = '\n\n---SPLIT---\n\n';
  const combined = `${title}${separator}${summary}`;

  try {
    const result = await translate(combined);
    const parts = result.split(/---SPLIT---/);
    return {
      title: parts[0]?.trim() ?? title,
      summary: parts[1]?.trim() ?? summary,
    };
  } catch {
    // If batching fails, try individually
    const [translatedTitle, translatedSummary] = await Promise.all([
      translate(title).catch(() => title),
      translate(summary).catch(() => summary),
    ]);
    return { title: translatedTitle, summary: translatedSummary };
  }
}
