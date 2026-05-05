# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run type-check   # TypeScript type check (no build step needed for Vercel)
```

There are no tests. Vercel deploys automatically on push to main.

## Architecture

Single-user Telegram bot deployed as Vercel serverless functions. No build step — Vercel compiles TypeScript directly.

### Entry points (`api/`)

| File | Trigger | Purpose |
|---|---|---|
| `webhook.ts` | POST from Telegram | Handles all bot updates (messages, callback_query) |
| `cron.ts` | External cron (cron-job.org) | Delivers new articles to the stored chat ID |
| `setup.ts` | Manual GET | Re-registers the Telegram webhook with `allowed_updates` |

### Data flow

1. User sends `/start` → chat ID saved to Redis (`chat_id` key)
2. User sends `/add <url>` → feed saved to Redis hash (`feeds` key: `url → name`), all existing articles marked as sent to prevent flood
3. `/news` or cron → `fetchFeed(url, since)` with 24h window → deduplicate via `sent:<md5hash>` keys (7-day TTL) → send via Telegraf
4. Inline "Перекласти" button → callback `tr:<feedHash12>:<artHash12>` → re-fetch feed → find article → Claude API → edit message

### Key modules

- **`src/storage/feeds.ts`** — all Redis access. Feeds stored as a single hash. Sent-article dedup via individual `sent:` keys with 7-day TTL. Redis env vars: `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Vercel Marketplace naming).
- **`src/rss/fetcher.ts`** — wraps `rss-parser`, handles `media:content`/`media:thumbnail` for images, filters by `pubDate`.
- **`src/translation/index.ts`** — three providers checked in order: DeepL → LibreTranslate → (throws). Claude (`translateArticleViaClaude`) is used separately only for on-demand inline button translation.
- **`src/config.ts`** — `shortHash(s)` returns 12-char MD5 hex. Used for callback data (must stay ≤ 64 bytes total: `tr:12:12` = 28 bytes).
- **`src/bot/index.ts`** — bot setup. Callback queries use a single `/^tr:/` catch-all action to avoid Telegraf regex issues.

### Translation providers

- `ANTHROPIC_API_KEY` → enables per-article inline "Перекласти" button (Claude Haiku)
- `DEEPL_API_KEY` → powers `/translate` auto-translation (500K chars/month free)
- `LIBRETRANSLATE_URL` → fallback for auto-translation
- `AUTO_TRANSLATE=true` env var enables automatic translation on every article

### Webhook registration

The webhook must be registered with `allowed_updates=["message","callback_query"]` — without `callback_query`, inline buttons silently fail. Use `api/setup.ts` or call `setWebhook` directly via the Telegram API.

### Vercel function limits

- `webhook.ts`: 60s max (translation can be slow)
- `cron.ts`: 300s max (processes all feeds)
- `setup.ts`: 10s max
