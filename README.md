# News Aggregator Telegram Bot

Telegram-бот для агрегації новин через RSS/Atom з підтримкою перекладу на українську мову. Хоститься на Vercel безкоштовно.

## Команди бота

| Команда | Опис |
|---|---|
| `/add <url>` | Додати RSS-стрічку |
| `/list` | Показати підписки |
| `/remove <n>` | Видалити стрічку за номером |
| `/translate` | Увімкнути/вимкнути переклад на українську |
| `/news` | Отримати свіжі новини прямо зараз |
| `/help` | Довідка |

---

## Деплой: покрокова інструкція

### Крок 1 — Створити Telegram-бота

1. Відкрийте Telegram, знайдіть [@BotFather](https://t.me/BotFather)
2. Надішліть команду `/newbot`
3. Введіть назву бота (наприклад: `My News Bot`)
4. Введіть username бота (має закінчуватись на `bot`, наприклад: `mynews_aggregator_bot`)
5. BotFather надішле вам токен виду `1234567890:AAF...xyz`
6. **Збережіть цей токен** — він знадобиться далі

---

### Крок 2 — Створити базу даних Upstash Redis

1. Перейдіть на [console.upstash.com](https://console.upstash.com)
2. Зареєструйтеся (безкоштовно, можна через GitHub або Google)
3. Натисніть **"Create Database"**
4. Налаштування:
   - Name: `news-bot` (будь-яка назва)
   - Type: **Regional**
   - Region: виберіть найближчий (наприклад, `EU-West-1`)
   - Натисніть **"Create"**
5. Відкрийте створену базу → вкладка **"REST API"**
6. Збережіть два значення:
   - `UPSTASH_REDIS_REST_URL` — рядок виду `https://...upstash.io`
   - `UPSTASH_REDIS_REST_TOKEN` — довгий рядок токена

---

### Крок 3 — Отримати ключ для перекладу (опціонально)

Без цього кроку бот працює, але переклад буде недоступний.

**Варіант A: DeepL** (рекомендовано, 500 000 символів/місяць безкоштовно)

1. Перейдіть на [deepl.com/pro-api](https://www.deepl.com/pro-api)
2. Натисніть **"Sign up for free"**
3. Зареєструйтеся та підтвердіть email
4. Перейдіть в [Account → API Keys](https://www.deepl.com/account/summary)
5. Збережіть ключ — він починається на `....:fx` (Free plan)

**Варіант B: LibreTranslate** (без реєстрації)

- Просто збережіть URL: `https://libretranslate.com`
- Безкоштовний, але може мати ліміти швидкості

---

### Крок 4 — Задеплоїти на Vercel

1. Перейдіть на [vercel.com](https://vercel.com) та зареєструйтеся через GitHub
2. Натисніть **"Add New Project"**
3. Виберіть репозиторій **`news-aggregator-`** зі списку
4. Vercel автоматично визначить налаштування — нічого не змінюйте
5. Розгорніть розділ **"Environment Variables"** та додайте ці змінні:

| Назва | Значення |
|---|---|
| `TELEGRAM_BOT_TOKEN` | токен від BotFather (Крок 1) |
| `TELEGRAM_WEBHOOK_SECRET` | придумайте рядок 32+ символів, наприклад `mySuperSecret2024XyZ` |
| `CRON_SECRET` | придумайте ще один рядок, наприклад `cronSecret9876AbC` |
| `UPSTASH_REDIS_REST_URL` | URL з Upstash (Крок 2) |
| `UPSTASH_REDIS_REST_TOKEN` | токен з Upstash (Крок 2) |
| `DEEPL_API_KEY` | ключ DeepL (Крок 3A, якщо обрали) |
| `LIBRETRANSLATE_URL` | `https://libretranslate.com` (Крок 3B, якщо обрали) |

6. Натисніть **"Deploy"**
7. Зачекайте 1-2 хвилини — Vercel встановить залежності та збере проєкт
8. Після успіху скопіюйте URL проєкту, наприклад: `https://news-aggregator-abc123.vercel.app`

---

### Крок 5 — Зареєструвати Telegram Webhook

Відкрийте браузер і перейдіть за цим посиланням (замінивши значення у `<...>`):

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<ВАШ_VERCEL_URL>/api/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

**Приклад:**
```
https://api.telegram.org/bot1234567890:AAFxyz/setWebhook?url=https://news-aggregator-abc123.vercel.app/api/webhook&secret_token=mySuperSecret2024XyZ
```

Відповідь має бути:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

Якщо все добре — бот вже відповідає на команди!

---

### Крок 6 — Налаштувати щогодинний cron (обов'язково)

Vercel безкоштовний план дозволяє cron лише раз на день, тому використовуємо безкоштовний зовнішній сервіс.

1. Перейдіть на [cron-job.org](https://cron-job.org) та зареєструйтеся
2. Натисніть **"Create cronjob"**
3. Заповніть форму:
   - **Title:** `News Bot Hourly Fetch`
   - **URL:** `https://<ВАШ_VERCEL_URL>/api/cron?secret=<CRON_SECRET>`
     > Приклад: `https://news-aggregator-abc123.vercel.app/api/cron?secret=cronSecret9876AbC`
   - **Schedule:** виберіть `Every hour` (або вручну: `0 * * * *`)
4. Натисніть **"Create"**

Тепер бот автоматично перевірятиме нові статті кожну годину.

---

### Крок 7 — Перевірка

1. Відкрийте вашого бота в Telegram
2. Надішліть `/start` — має прийти привітальне повідомлення
3. Додайте стрічку: `/add https://feeds.bbci.co.uk/news/world/rss.xml`
4. Якщо налаштували переклад: `/translate`
5. Отримайте новини: `/news`

---

## Оновлення бота

Якщо ви змінили код і запушили до GitHub:
1. Vercel автоматично зробить новий деплой (займає ~1 хв)
2. Webhook переєстровувати не потрібно

---

## Популярні RSS-стрічки для тесту

```
# Міжнародні новини (англійська)
https://feeds.bbci.co.uk/news/world/rss.xml
https://rss.nytimes.com/services/xml/rss/nyt/World.xml
https://feeds.reuters.com/reuters/worldNews

# Технології
https://feeds.feedburner.com/TechCrunch
https://www.theverge.com/rss/index.xml

# Українські новини
https://www.pravda.com.ua/rss/view_news/
https://ukrinform.ua/rss/block-other_news
```
