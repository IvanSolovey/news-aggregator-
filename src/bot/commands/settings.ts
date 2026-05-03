import { type Context } from 'telegraf';
import { getUserSettings, setUserSettings } from '../../storage/redis';
import { isTranslationAvailable } from '../../translation';

function translateText(isOn: boolean): string {
  return isOn
    ? '🌐 Переклад на українську: <b>увімкнено</b>\n\nНатисніть /translate щоб вимкнути.'
    : '🔇 Переклад: <b>вимкнено</b>\n\nНатисніть /translate щоб увімкнути.';
}

export async function handleTranslate(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  if (!isTranslationAvailable()) {
    await ctx.reply(
      'Переклад недоступний: не налаштований жоден провайдер.\n' +
      'Вкажіть DEEPL_API_KEY або LIBRETRANSLATE_URL у змінних оточення.'
    );
    return;
  }

  const settings = await getUserSettings(chatId);
  const newValue = !settings.translate;
  await setUserSettings(chatId, { translate: newValue });

  await ctx.replyWithHTML(translateText(newValue));
}
