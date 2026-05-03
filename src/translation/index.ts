import * as deepl from 'deepl-node';
import Anthropic from '@anthropic-ai/sdk';

const TARGET_LANG = 'uk' as deepl.TargetLanguageCode;

let deeplClient: deepl.Translator | null = null;
let anthropicClient: Anthropic | null = null;

function getDeepLClient(): deepl.Translator | null {
  if (!process.env.DEEPL_API_KEY) return null;
  if (!deeplClient) {
    deeplClient = new deepl.Translator(process.env.DEEPL_API_KEY);
  }
  return deeplClient;
}

function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return anthropicClient;
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

export async function translateArticleViaClaude(
  title: string,
  summary: string
): Promise<{ title: string; summary: string }> {
  const client = getAnthropicClient();
  if (!client) throw new Error('ANTHROPIC_API_KEY is not set');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content:
          'Translate the following news article title and summary into Ukrainian. ' +
          'Respond with a JSON object containing "title" and "summary" fields only. ' +
          'Keep proper nouns, names, brands, and URLs unchanged.\n\n' +
          `Title: ${title}\n` +
          `Summary: ${summary}`,
      },
    ],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text : '';

  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Claude returned unexpected format');

  const parsed = JSON.parse(jsonMatch[0]) as { title?: string; summary?: string };
  return {
    title: parsed.title?.trim() || title,
    summary: parsed.summary?.trim() || summary,
  };
}

export function isTranslationAvailable(): boolean {
  return Boolean(
    process.env.DEEPL_API_KEY ||
    process.env.LIBRETRANSLATE_URL ||
    process.env.ANTHROPIC_API_KEY
  );
}

export function isClaudeTranslationAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
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
