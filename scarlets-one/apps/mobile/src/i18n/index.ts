import {
  createTranslator,
  resolveText,
  translationCoverage,
  type Locale,
  type LocalizedText,
  type MessageParams,
  type ResolvedText,
} from '@scarlets/domain';
import { getLocales } from 'expo-localization';
import { useCallback, useMemo } from 'react';
import { usePrefs } from '@/state/prefs';
import { cy } from './cy';
import { en, type MessageKey } from './en';

export type { MessageKey };
export type Translate = (key: MessageKey, params?: MessageParams) => string;

/** How much of the UI has a Welsh string. Shown in Settings so the gap is honest. */
export const welshCoverage = translationCoverage(en, cy);

export function deviceLocale(): Locale {
  try {
    return getLocales()[0]?.languageCode === 'cy' ? 'cy' : 'en';
  } catch {
    return 'en';
  }
}

/** The supporter's chosen language, or the device language until they choose. */
export function useLocale(): Locale {
  const chosen = usePrefs((s) => s.locale);
  return chosen ?? deviceLocale();
}

export function useT(): Translate {
  const locale = useLocale();
  return useMemo(() => createTranslator(locale, { en, cy }), [locale]);
}

/** Resolve content text to the current language, falling back to English. */
export function useL(): (text: LocalizedText) => string {
  const locale = useLocale();
  return useCallback((text: LocalizedText) => resolveText(text, locale).value, [locale]);
}

export function useResolve(): (text: LocalizedText) => ResolvedText {
  const locale = useLocale();
  return useCallback((text: LocalizedText) => resolveText(text, locale), [locale]);
}
