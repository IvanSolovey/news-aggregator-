import type { Context } from 'telegraf';
import { getUserSettings, setUserSettings } from '../../storage/redis';
import { isTranslationAvailable } from '../../translation';

export async function handleTranslate(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  if (!isTranslationAvailable()) {
    await ctx.reply(
      'Переклад недоступний: не налаштований жоден провайдер.\n' +
      'Адміністратор має вказати DEEPL_API_KEY або LIBRETRANSLATE_URL.'
    );
    return;
  }

  const settings = await getUserSettings(chatId);
  const newValue = !settings.translate;
  await setUserSettings(chatId, { translate: newValue });

  if (newValue) {
    await ctx.reply('🌐 Переклад на українську увімкнено.');
  } else {
    await ctx.reply('🔇 Переклад вимкнено.');
  }
}
