# News Aggregator Telegram Bot

Telegram-бот для агрегації новин через RSS/Atom з підтримкою перекладу на українську мову. Розгортається на Vercel.

## Функції

- Підписка на будь-які RSS/Atom стрічки
- Автоматична перевірка нових статей (кожну годину через зовнішній cron)
- Переклад статей на українську (DeepL або LibreTranslate)
- Дедублікація — одна стаття не надсилається двічі
- До 20 стрічок на користувача

## Команди бота

| Команда | Опис |
|---|---|
| `/add <url>` | Додати RSS-стрічку |
| `/list` | Показати підписки |
| `/remove <n>` | Видалити стрічку за номером |
| `/translate` | Увімкнути/вимкнути переклад |
| `/news` | Отримати свіжі новини зараз |
| `/help` | Довідка |

## Розгортання

### 1. Створити бота

1. Напишіть [@BotFather](https://t.me/BotFather) → `/newbot`
2. Збережіть `TELEGRAM_BOT_TOKEN`

### 2. Створити Upstash Redis

1. Зареєструйтеся на [console.upstash.com](https://console.upstash.com)
2. Створіть нову базу даних Redis
3. Збережіть `UPSTASH_REDIS_REST_URL` та `UPSTASH_REDIS_REST_TOKEN`

### 3. Налаштування перекладу (опціонально)

**DeepL (рекомендовано):**
1. Зареєструйтеся на [deepl.com/pro-api](https://www.deepl.com/pro-api) (безкоштовно)
2. Збережіть `DEEPL_API_KEY`

**LibreTranslate (альтернатива):**
- Використовуйте публічний сервер: `https://libretranslate.com`
- Або розгорніть власний: [github.com/LibreTranslate/LibreTranslate](https://github.com/LibreTranslate/LibreTranslate)

### 4. Розгорнути на Vercel

```bash
# Встановити Vercel CLI
npm i -g vercel

# Розгорнути
vercel --prod
```

У налаштуваннях Vercel → Environment Variables додайте всі змінні з `.env.example`.

### 5. Зареєструвати webhook

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<your-app>.vercel.app/api/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

### 6. Налаштувати cron (для щогодинної перевірки)

Vercel Hobby план підтримує cron лише раз на день. Для щогодинної перевірки:

1. Зареєструйтеся на [cron-job.org](https://cron-job.org) (безкоштовно)
2. Створіть завдання:
   - URL: `https://<your-app>.vercel.app/api/cron?secret=<CRON_SECRET>`
   - Розклад: `0 * * * *` (кожну годину)

## Стек технологій

- **Node.js + TypeScript** — мова та рантайм
- **Telegraf v4** — фреймворк для Telegram-бота
- **rss-parser** — парсинг RSS/Atom стрічок
- **@upstash/redis** — зберігання стану (підписки, дедублікація)
- **deepl-node** — переклад через DeepL API
- **Vercel** — serverless хостинг
