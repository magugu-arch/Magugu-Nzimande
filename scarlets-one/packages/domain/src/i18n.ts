import { z } from 'zod';

export const locales = ['en', 'cy'] as const;
export type Locale = (typeof locales)[number];

/**
 * Every piece of content is stored as language variants from day one. English
 * is required; Welsh is optional so an untranslated item can still publish
 * with a visible fallback instead of blocking.
 */
export const localizedText = z.object({ en: z.string(), cy: z.string().optional() });
export type LocalizedText = z.infer<typeof localizedText>;

/** approved: signed off by the club. draft: machine or in-house draft. missing: no Welsh yet. */
export const translationStatus = z.enum(['approved', 'draft', 'missing']);
export type TranslationStatus = z.infer<typeof translationStatus>;

export const tx = (en: string, cy?: string): LocalizedText => (cy ? { en, cy } : { en });

export interface ResolvedText {
  value: string;
  /** The language actually shown, which is what a screen reader should be told. */
  locale: Locale;
  /** True when Welsh was asked for and English was shown instead. */
  fallback: boolean;
}

export function resolveText(text: LocalizedText, locale: Locale): ResolvedText {
  if (locale === 'cy') {
    const cy = text.cy?.trim();
    if (cy) return { value: cy, locale: 'cy', fallback: false };
    return { value: text.en, locale: 'en', fallback: true };
  }
  return { value: text.en, locale: 'en', fallback: false };
}

export type Messages = Record<string, string>;
export type MessageParams = Record<string, string | number>;

/**
 * UI string lookup. A missing Welsh string falls back to English; a missing
 * key returns the key so the gap is visible on screen rather than blank.
 */
export function createTranslator<M extends Messages>(
  locale: Locale,
  catalogues: { en: M; cy: Partial<Record<keyof M, string>> },
) {
  return function t(key: keyof M & string, params?: MessageParams): string {
    const template =
      (locale === 'cy' ? catalogues.cy[key] : undefined) ?? catalogues.en[key] ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  };
}

export function translationCoverage<M extends Messages>(
  en: M,
  cy: Partial<Record<keyof M, string>>,
): { total: number; translated: number; ratio: number; missing: string[] } {
  const keys = Object.keys(en);
  const missing = keys.filter((key) => !cy[key as keyof M]?.trim());
  const translated = keys.length - missing.length;
  return {
    total: keys.length,
    translated,
    ratio: keys.length ? translated / keys.length : 1,
    missing,
  };
}
