import { type Context } from 'telegraf';
import { isTranslationAvailable } from '../../translation';
import { isAutoTranslate } from '../../config';

export async function handleTranslate(ctx: Context): Promise<void> {
  if (!isTranslationAvailable()) {
    await ctx.reply(
      'Переклад недоступний: не налаштований жоден провайдер.\n' +
      'Вкажіть ANTHROPIC_API_KEY у змінних оточення.'
    );
    return;
  }

  const isOn = isAutoTranslate();
  await ctx.replyWithHTML(
    isOn
      ? '🌐 Автопереклад: <b>увімкнено</b>\n\nЩоб вимкнути — встановіть <code>AUTO_TRANSLATE=false</code> у змінних оточення Vercel.'
      : '🔇 Автопереклад: <b>вимкнено</b>\n\nЩоб увімкнути — встановіть <code>AUTO_TRANSLATE=true</code> у змінних оточення Vercel.\n\nАбо натисніть кнопку 🌐 Перекласти під статтею.'
  );
}
