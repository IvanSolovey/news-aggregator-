import type { Article } from '../types';

const SUMMARY_LIMIT = 300;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncate(text: string, limit: number): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit).trimEnd() + '…';
}

export function formatArticle(
  article: Article,
  translated?: { title: string; summary: string }
): string {
  const title = escapeHtml(translated?.title ?? article.title);
  const summary = truncate(
    escapeHtml(translated?.summary ?? article.summary),
    SUMMARY_LIMIT
  );
  const source = escapeHtml(article.feedName);

  let text = `<b>${title}</b>`;

  if (summary) {
    text += `\n\n${summary}`;
  }

  text += `\n\n<a href="${article.link}">Читати повністю →</a>`;
  text += `\n📡 ${source}`;

  return text;
}
