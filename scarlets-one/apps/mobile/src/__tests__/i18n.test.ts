import { createTranslator, translationCoverage } from '@scarlets/domain';
import { cy } from '@/i18n/cy';
import { en } from '@/i18n/en';

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort().join(',');

describe('UI strings', () => {
  it('has no Welsh string without an English source', () => {
    const orphans = Object.keys(cy).filter((key) => !(key in en));
    expect(orphans).toEqual([]);
  });

  it('keeps the same placeholders in Welsh as in English', () => {
    for (const [key, value] of Object.entries(cy)) {
      expect(`${key}: ${placeholders(value as string)}`).toBe(
        `${key}: ${placeholders(en[key as keyof typeof en])}`,
      );
    }
  });

  it('translates every tab label and the main navigation', () => {
    for (const key of [
      'tab.home',
      'tab.match',
      'tab.matchday',
      'tab.passport',
      'tab.fanzone',
      'more.title',
    ] as const) {
      expect(cy[key]).toBeTruthy();
    }
  });

  it('covers at least half the interface, and reports the rest honestly', () => {
    const coverage = translationCoverage(en, cy);
    expect(coverage.ratio).toBeGreaterThanOrEqual(0.5);
    expect(coverage.translated + coverage.missing.length).toBe(coverage.total);
  });

  it('falls back to English for an untranslated key instead of showing a blank', () => {
    const t = createTranslator('cy', { en, cy });
    expect(t('tab.home')).toBe('Hafan');
    expect(t('settings.delete.body')).toBe(en['settings.delete.body']);
    expect(t('home.planner.progress', { done: 2, total: 10 })).toBe('2 o 10 wedi’u gwneud');
  });

  it('never calls the concept an official product', () => {
    expect(en['concept.banner']).toMatch(/Not an official/);
    for (const value of Object.values(en)) {
      expect(value).not.toMatch(/official Scarlets app\b(?!\.)/i);
    }
  });
});
