import { Markup, type Context } from 'telegraf';
import { getUserSettings, setUserSettings } from '../../storage/redis';
import { isTranslationAvailable } from '../../translation';

function translateKeyboard(isOn: boolean) {
  const label = isOn ? '🔇 Вимкнути переклад' : '🌐 Увімкнути переклад';
  return Markup.inlineKeyboard([[Markup.button.callback(label, 'translate')]]).reply_markup;
}

function translateText(isOn: boolean): string {
  return isOn
    ? '🌐 Переклад на українську: <b>увімкнено</b>'
    : '🔇 Переклад: <b>вимкнено</b>';
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

  await ctx.replyWithHTML(translateText(newValue), {
    reply_markup: translateKeyboard(newValue),
  });
}

// Called from bot/index.ts after answerCbQuery is already sent
export async function handleTranslateCallback(ctx: Context): Promise<void> {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    await ctx.answerCbQuery().catch(() => {});
    return;
  }

  if (!isTranslationAvailable()) {
    await ctx.answerCbQuery('Переклад не налаштований.');
    return;
  }

  const settings = await getUserSettings(chatId);
  const newValue = !settings.translate;
  await setUserSettings(chatId, { translate: newValue });

  const status = newValue ? '🌐 Переклад увімкнено' : '🔇 Переклад вимкнено';
  await ctx.answerCbQuery(status);

  await ctx.editMessageText(translateText(newValue), {
    parse_mode: 'HTML',
    reply_markup: translateKeyboard(newValue),
  });
}
